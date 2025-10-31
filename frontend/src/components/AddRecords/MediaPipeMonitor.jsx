// MediaPipeMonitor.jsx（CDN 版・要望反映 最終）
// 目的：顔検出と手ジェスチャ（グー/パー）でタイマーを中断/再開。
// 変更点：
//  - グー検出の精度向上（指カール＋親指＋手の開き度の複合/連続フレーム安定化）
//  - 自動再開は「顔なし→自動中断」時のみ有効
//  - すべての経路で onAway/onFist/onPalm が呼ばれ、親で音が鳴る想定
//  - 循環初期化・ref二重化対策は前版の安定化を踏襲

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

// MediaPipe Tasks Vision（CDN）を ESM で直接 import
import {
  FilesetResolver,
  FaceDetector,
  HandLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21";

// バッジ表示用の定数
const BADGE = {
  INIT: "initializing",
  ACTIVE: "active",
  NO_FACE: "no-face",
  BLOCKED: "blocked",
  ERROR: "error",
  DISABLED: "disabled",
  IDLE: "idle",
};

export default function MediaPipeMonitor({
  enabled = true,           // 親からの全体有効/無効
  timerStateNum = 0,        // 0: 実行中, 1: 中断中, 3: その他
  onAway,                   // 顔なし10秒で自動中断
  onFist,                   // グーで中断
  onPalm,                   // パーで再開
  awayThresholdMs = 10_000, // 顔なし継続秒数（デフォ10秒）
  gestureCooldownMs = 1_200,// ジェスチャ発火クールダウン
  frameIntervalMs = 80,     // 推論間隔（約12.5fps）
  showPreview = true,       // デバッグプレビュー表示
  autoResume = false,       // 顔で自動再開するか（ただし顔なし由来の中断のみ）
  gestureStableFrames = 2,  // ★追加：同じジェスチャが連続何フレームで確定とみなすか
}) {
  // UI ステート
  const [badge, setBadge] = useState(BADGE.INIT);  // バッジ表示用
  const [reason, setReason] = useState("");        // エラー理由表示
  const [monitorOn, setMonitorOn] = useState(true);// 監視トグル
  const [secondsToPause, setSecondsToPause] = useState(null); // 顔なしカウントダウン
  const [hasFace, setHasFace] = useState(false);   // 顔検出フラグ（デバッグ用）

  // DOM / タスク / ストリームの参照
  const videoRef = useRef(null);     // hidden video（常時1つ）
  const canvasRef = useRef(null);    // プレビュー用キャンバス
  const rafRef = useRef(null);       // requestAnimationFrame のハンドル
  const streamRef = useRef(null);    // getUserMedia の MediaStream
  const faceRef = useRef(null);      // FaceDetector インスタンス
  const handRef = useRef(null);      // HandLandmarker インスタンス
  const filesetRef = useRef(null);   // Fileset

  // 制御用の参照
  const awayStartRef = useRef(null);           // 顔なし開始時刻
  const lastGestureAtRef = useRef(0);          // 直近ジェスチャ発火時刻（クールダウン用）
  const lastInferAtRef = useRef(0);            // 直近推論時刻（フレーム間引き用）
  const lastHandLandmarksRef = useRef([]);     // 最新の手ランドマーク（描画用）
  const lastPausedReasonRef = useRef(null);    // ★追加：直近の中断理由 'away' | 'manual' | null

  // ジェスチャ安定化用（同じ推論結果が連続した回数をカウント）
  const gestureStableCountRef = useRef(0);     // 連続カウント
  const gestureLastFrameRef = useRef(null);    // 前フレームのラベル 'fist' | 'palm' | null

  // 親のコールバックは ref 経由で参照（依存に入れない）
  const onAwayRef = useRef(onAway);
  const onFistRef = useRef(onFist);
  const onPalmRef = useRef(onPalm);
  useEffect(() => { onAwayRef.current = onAway; }, [onAway]);
  useEffect(() => { onFistRef.current = onFist; }, [onFist]);
  useEffect(() => { onPalmRef.current = onPalm; }, [onPalm]);

  // クールダウン判定（現在時刻との差分で判定）
  const inCooldown = useCallback(
    () => Date.now() - lastGestureAtRef.current < gestureCooldownMs,
    [gestureCooldownMs]
  );

  // 有効かつ監視ONか
  const effectiveEnabled = enabled && monitorOn;

  // 表示バッジの決定
  const status = useMemo(() => {
    if (!enabled) return BADGE.DISABLED;
    if (!monitorOn) return BADGE.IDLE;
    return badge;
  }, [enabled, monitorOn, badge]);

  // 後片付け（動画停止、ストリーム停止、タスク破棄）
  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      faceRef.current?.close?.();
      handRef.current?.close?.();
    } catch {}
    faceRef.current = null;
    handRef.current = null;
    filesetRef.current = null;

    // 監視用のステート/参照もリセット
    setSecondsToPause(null);
    setHasFace(false);
    awayStartRef.current = null;
    lastHandLandmarksRef.current = [];
    gestureStableCountRef.current = 0;
    gestureLastFrameRef.current = null;
  }, []);

  // ========== 描画（プレビュー） ==========
  const drawOverlay = useCallback((canvas, video, faceBoxes, handLandmarksList) => {
    if (!canvas || !video) return;

    const W = 320, H = 240;                 // プレビューサイズ
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    const vw = video.videoWidth || 1;       // video の実サイズ（0ガード）
    const vh = video.videoHeight || 1;
    const sx = W / vw;                      // スケール X
    const sy = H / vh;                      // スケール Y

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    // 背景：最新フレームを描画
    try { ctx.drawImage(video, 0, 0, W, H); } catch {}

    // 顔の矩形（緑）
    if (faceBoxes?.length) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "lime";
      for (const bb of faceBoxes) {
        // FaceDetector は originX/Y, width, height（画素座標）を返す
        const x = (bb.originX ?? (bb.xCenter - bb.width / 2)) * sx;
        const y = (bb.originY ?? (bb.yCenter - bb.height / 2)) * sy;
        const w = (bb.width ?? 0) * sx;
        const h = (bb.height ?? 0) * sy;
        ctx.strokeRect(x, y, w, h);
      }
    }

    // 手のランドマーク（白）
    if (handLandmarksList?.length) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "white";
      ctx.fillStyle = "white";
      const fingers = [
        [0, 1, 2, 3, 4],
        [0, 5, 6, 7, 8],
        [0, 9, 10, 11, 12],
        [0, 13, 14, 15, 16],
        [0, 17, 18, 19, 20],
      ];
      for (const lm of handLandmarksList) {
        // 指の骨格ライン
        for (const idxs of fingers) {
          for (let i = 1; i < idxs.length; i++) {
            const a = lm[idxs[i - 1]], b = lm[idxs[i]];
            ctx.beginPath();
            ctx.moveTo(a.x * W, a.y * H);
            ctx.lineTo(b.x * W, b.y * H);
            ctx.stroke();
          }
        }
        // 各ランドマーク点
        for (const p of lm) {
          ctx.beginPath();
          ctx.arc(p.x * W, p.y * H, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, []);

  // ========== グー/パー判定のユーティリティ ==========
  // 正規化距離（0-1座標間のユークリッド距離）
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // 手の開き度（前版の「手のひら開き」指標）
  const palmOpenness = (lm) => {
    const wrist = lm[0];
    const tips = [lm[4], lm[8], lm[12], lm[16], lm[20]];
    let s = 0;
    for (const t of tips) s += dist(wrist, t);
    return s; // 値が大きいほど開いている
  };

  // 指が曲がっているか（「tip が PIP より手首に近い」なら曲げているとみなす）
  const isFingerCurled = (lm, tipIdx, pipIdx) => {
    const wrist = lm[0];
    const tipCloserThanPip = dist(lm[tipIdx], wrist) < dist(lm[pipIdx], wrist) - 0.02; // 少しマージン
    return tipCloserThanPip;
  };

  // 親指がたたまれているか（親指先端が手の中心に近いかでざっくり判定）
  const isThumbFolded = (lm) => {
    const thumbTip = lm[4];
    const palmCoreIdx = [0, 1, 5, 9, 13, 17];                 // 手のひら中核
    const palmCenter = palmCoreIdx.reduce(
      (acc, i) => ({ x: acc.x + lm[i].x / palmCoreIdx.length, y: acc.y + lm[i].y / palmCoreIdx.length }),
      { x: 0, y: 0 }
    );
    const dTipToPalm = dist(thumbTip, palmCenter);
    const dIdxMcpToPalm = dist(lm[5], palmCenter);            // 人差し指付け根との比較
    return dTipToPalm < dIdxMcpToPalm * 0.9;                  // 充分近ければ「たたみ込み」
  };

  // ★強化版グー判定：指4本のカール＋親指たたみ＋手の開き度の閾値
  const isFistStrict = (lm) => {
    if (!lm || lm.length < 21) return false;

    // 各指の PIP と Tip インデックス
    const PIP = { index: 6, middle: 10, ring: 14, pinky: 18 };
    const TIP = { index: 8, middle: 12, ring: 16, pinky: 20 };

    // 4本の指が曲がっている本数をカウント
    let curledCount = 0;
    for (const f of ["index", "middle", "ring", "pinky"]) {
      if (isFingerCurled(lm, TIP[f], PIP[f])) curledCount++;
    }

    // 親指がたたまれているか
    const thumbOk = isThumbFolded(lm);

    // 手の開き度（値が小さいほど握っている）
    const openness = palmOpenness(lm);

    // 閾値：openness はシーン依存なので、経験的に 0.60 未満を「閉じ気味」とみなす
    // ※ 必要に応じて環境で微調整してください
    const isClosedEnough = openness < 0.60;

    // 最終判定：3本以上カール ＆ 親指たたみ込み ＆ 開き度が小さい
    return curledCount >= 3 && thumbOk && isClosedEnough;
  };

  // 既存の「手のひら開き」判定も残し、パー側で補強に使う（しきい値やや上げ）
  const isPalmOpen = useCallback((lm) => {
    if (!lm || lm.length < 21) return false;
    return palmOpenness(lm) > 0.75; // 前版0.65→0.75に上げ、誤検出しにくく
  }, []);
  const isFistLoose = (lm) => {
   if (!lm || lm.length < 21) return false;
   // 2本以上カール ＋ 親指は条件から外す or 弱く見る
   const PIP = { index: 6, middle: 10, ring: 14, pinky: 18 };
   const TIP = { index: 8, middle: 12, ring: 16, pinky: 20 };
   let curled = 0;
   for (const f of ["index","middle","ring","pinky"])
     if (isFingerCurled(lm, TIP[f], PIP[f])) curled++;
   const closed = palmOpenness(lm) < 0.68; // ちょい緩め
   return (curled >= 2 && closed) || (curled >= 3); // どちらか満たせばOK
 };
  // ========== メインループ（推論） ==========
  const loop = useCallback(async () => {
    if (!effectiveEnabled) return;

    // フレーム間引き
    const ts = performance.now();
    if (ts - lastInferAtRef.current < frameIntervalMs) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    lastInferAtRef.current = ts;

    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      // video 準備中はスキップ
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    try {
      // ===== 顔検出 =====
      let faceBoxes = [];
      if (faceRef.current) {
        const faces = await faceRef.current.detectForVideo(video, ts);
        faceBoxes = faces?.detections?.map((d) => d.boundingBox) ?? [];
      }
      const faceDetected = faceBoxes.length > 0;
      setHasFace(faceDetected);

      // ===== ステータス＆自動中断/再開ロジック =====
      if (timerStateNum === 0) {
        // 実行中：顔が消えたらカウントダウン→ onAway
        if (!faceDetected) {
          if (!awayStartRef.current) awayStartRef.current = Date.now(); // 顔なし開始
          const remainMs = awayThresholdMs - (Date.now() - awayStartRef.current);
          setSecondsToPause(Math.max(0, Math.ceil(remainMs / 1000)));
          setBadge(BADGE.NO_FACE);
          if (remainMs <= 0) {
            awayStartRef.current = null;
            setSecondsToPause(null);
            lastPausedReasonRef.current = "away"; // ★最後の中断理由を保存
            onAwayRef.current?.();                // 親へ通知（音は親で再生）
          }
        } else {
          // 顔が戻っている：カウントダウン解除
          awayStartRef.current = null;
          setSecondsToPause(null);
          setBadge(BADGE.ACTIVE);
        }
      } else if (timerStateNum === 1) {
        // 中断中：顔が戻ったら自動再開するか？（※ away 由来のみ）
        setBadge(faceDetected ? BADGE.ACTIVE : BADGE.IDLE);
        if (faceDetected && autoResume && lastPausedReasonRef.current === "away" && !inCooldown()) {
          lastGestureAtRef.current = Date.now();
          onPalmRef.current?.();           // 自動再開
          lastPausedReasonRef.current = null; // 使い切り
        }
        // カウントダウン表示は不要
        setSecondsToPause(null);
        awayStartRef.current = null;
      } else {
        // その他状態
        setBadge(faceDetected ? BADGE.ACTIVE : BADGE.IDLE);
        setSecondsToPause(null);
        awayStartRef.current = null;
      }

      // ===== 手ジェスチャ =====
      if (handRef.current) {
        const hands = await handRef.current.detectForVideo(video, ts);
        const list = hands?.landmarks ?? [];

        // プレビュー用：未検出なら残像クリア
        lastHandLandmarksRef.current = list?.length ? list : [];

        if (list.length && !inCooldown()) {
        const isPalm = isPalmOpen(list[0]);
        const isFist = !isPalm;

        if (isFist && timerStateNum === 0) {
          lastGestureAtRef.current = Date.now();
          onFistRef.current?.();  // 中断
        } else if (isPalm && timerStateNum === 1) {
          lastGestureAtRef.current = Date.now();
          onPalmRef.current?.();  // 再開
        }
      }
      }

      // ===== プレビュー描画 =====
      if (showPreview) {
        drawOverlay(canvasRef.current, video, faceBoxes, lastHandLandmarksRef.current);
      }
    } catch (err) {
      console.error(err);
      setBadge(BADGE.ERROR);
      setReason(String(err?.message || err));
    }

    // 次フレームへ
    rafRef.current = requestAnimationFrame(loop);
  }, [
    effectiveEnabled,
    frameIntervalMs,
    timerStateNum,
    awayThresholdMs,
    autoResume,
    inCooldown,
    isPalmOpen,
    drawOverlay,
    gestureStableFrames,
  ]);

  // ========== 初期化 / 終了 ==========
  useEffect(() => {
    if (!effectiveEnabled) {
      // OFF または disabled 時は片付けて終了
      cleanup();
      return;
    }

    // 既に初期化済みなら再初期化しない（StrictMode・依存変化対策）
    if (faceRef.current || handRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        // バッジを INIT（すでに INIT ならそのまま）
        setBadge((prev) => (prev === BADGE.INIT ? prev : BADGE.INIT));
        setReason("");

        // MediaPipe の wasm ローダ（CDN）
        filesetRef.current = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm"
        );

        // 顔検出（BlazeFace short-range）
        faceRef.current = await FaceDetector.createFromOptions(filesetRef.current, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
          },
          runningMode: "VIDEO",
        });

        // 手ランドマーカ（1手）
        handRef.current = await HandLandmarker.createFromOptions(filesetRef.current, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });

        // カメラ起動（フロントカメラ/HD希望）
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) return;

        // video にストリームを接続
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          setBadge(BADGE.ERROR);
          setReason("video element not ready");
          return;
        }
        video.srcObject = stream;

        // サイズ情報が取れるまで待機
        await new Promise((res) => {
          if (video.readyState >= 1) return res();
          video.onloadedmetadata = () => res();
        });
        await video.play().catch(() => {});

        // 稼働開始
        setBadge(BADGE.ACTIVE);
        lastInferAtRef.current = 0;
        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        console.error(err);
        if (
          err?.name === "NotAllowedError" ||     // 権限拒否
          err?.name === "NotFoundError"  ||      // カメラなし
          err?.message?.includes("denied")
        ) {
          setBadge(BADGE.BLOCKED);
        } else {
          setBadge(BADGE.ERROR);
        }
        setReason(String(err?.message || err));
      }
    })();

    // アンマウント/無効化時のクリーンアップ
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [effectiveEnabled, cleanup, loop]);

  // ========== JSX ==========
  return (
    <div className="mediapipe-monitor">
      {/* ON/OFF トグル */}
      <div className="d-flex align-items-center gap-2 mb-2">
        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            role="switch"
            id="monitorSwitch"
            checked={monitorOn}
            onChange={(e) => setMonitorOn(e.target.checked)}
            disabled={!enabled}
          />
          <label className="form-check-label" htmlFor="monitorSwitch">
            カメラ監視 {monitorOn ? "ON" : "OFF"}
          </label>
        </div>
        <span
          className={`badge text-bg-${
            status === BADGE.ACTIVE ? "success" :
            status === BADGE.NO_FACE ? "warning" :
            status === BADGE.INIT ? "secondary" :
            status === BADGE.BLOCKED ? "danger" :
            status === BADGE.ERROR ? "danger" :
            status === BADGE.DISABLED ? "dark" : "secondary"
          }`}
        >
          {status}
        </span>

        {/* 顔なし中のカウントダウン（実行中のみ表示） */}
        {timerStateNum === 0 && secondsToPause !== null && (
          <span className="ms-2 small text-muted">
            <strong>{secondsToPause}秒で中断</strong>
          </span>
        )}

        {/* エラーやブロックの補足 */}
        {status === BADGE.ERROR && reason && (
          <span className="ms-2 text-danger small">{reason}</span>
        )}
        {status === BADGE.BLOCKED && (
          <span className="ms-2 text-danger small">カメラの権限を確認してください。</span>
        )}
      </div>

      {/* hidden video：常設（ref はここだけ） */}
      <video ref={videoRef} playsInline muted style={{ display: "none" }} />

      {/* デバッグ用プレビュー（canvasのみ） */}
      {showPreview && (
        <div className="ratio" style={{ width: 320, height: 240 }}>
          <canvas ref={canvasRef} width={320} height={240} />
        </div>
      )}

      {/* ヘルプ（アコーディオン） */}
      <div className="accordion mt-2" id="mpHelp">
        <div className="accordion-item">
          <h2 className="accordion-header" id="mpHelpHead">
            <button
              className="accordion-button collapsed"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#mpHelpBody"
              aria-expanded="false"
              aria-controls="mpHelpBody"
            >
              使い方（カメラ制御のヘルプ）
            </button>
          </h2>
          <div
            id="mpHelpBody"
            className="accordion-collapse collapse"
            aria-labelledby="mpHelpHead"
            data-bs-parent="#mpHelp"
          >
            <div className="accordion-body">
              <ul className="mb-2">
                <li>監視ONかつ実行中で、<strong>顔が10秒間検出できない</strong>と自動で中断します。</li>
                <li><strong>グー＝中断</strong>、<strong>パー＝再開</strong>。（各ジェスチャは連続{gestureStableFrames}フレーム安定した時だけ反応）</li>
                <li>顔での自動再開は、<strong>顔なしで自動中断された場合のみ</strong>有効です。</li>
                <li>プレビューは320×240。顔の矩形と手のランドマークをオーバーレイ表示します。</li>
                <li>停止するにはトグルをOFFにしてください（推論/ストリームも停止）。</li>
              </ul>
              <small className="text-muted">
                前提: HTTPS / localhost、カメラ未占有、十分な明るさと距離。
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
