// =============================================
// File: src/components/Timer/MediaPipeMonitor.jsx
// Purpose: Webcam-based monitoring using **CDN only** (no npm install)
// Features:
//   - 離席(顔なし)で自動中断
//   - グー(Closed_Fist)で中断/再開トグル
// How it works:
//   - modules/wasm/models すべてCDNから取得（ダウンロード/同梱不要）
//   - esm.run から ESM を動的 import
//   - jsDelivr / Google Cloud Storage の公式配布モデルを参照
//   - すべての行に日本語コメントを付与
// =============================================

// ▼ React の API を読み込む
import React, { useEffect, useRef, useState } from "react"; // useEffect: 副作用処理, useRef: 値の永続化, useState: 状態管理

// ▼ このコンポーネントは外部からコールバックを受け取り、
//   顔が一定時間検出されない時(onAway)や、グー検出時(onFist)に通知します。
export default function MediaPipeMonitor({
  enabled = true,              // enabled: 監視のON/OFFを親から制御（falseなら何もしない）
  onAway = () => {},           // onAway: 顔が一定時間検出されないと1回呼ばれるコールバック
  onFist = () => {},           // onFist: グー(Closed_Fist)検出時に呼ばれるコールバック（デバウンスあり）
  awayThresholdMs = 10_000,    // awayThresholdMs: 顔が見えない時間の閾値(ミリ秒)。既定10秒
  gestureCooldownMs = 1500,    // gestureCooldownMs: グー検出後のクールダウン(ミリ秒)。連続誤作動抑制
  minFistScore = 0.8,          // minFistScore: グー判定のスコア閾値。大きいほど厳しい
  frameIntervalMs = 66,        // frameIntervalMs: 推論ループの間隔(ミリ秒)。約15fps相当
  showPreview = false,         // showPreview: デバッグ用にビデオプレビューを表示するか
}) {                           // ここからコンポーネント本体

  // ▼ DOM 要素や定期処理を保持するための ref を定義
  const videoRef = useRef(null);             // videoRef: <video> 要素への参照（カメラ映像を表示/供給）
  const loopRef = useRef(null);              // loopRef: setTimeout によるループIDを保持して停止に使う
  const lastFaceSeenAtRef = useRef(Date.now()); // lastFaceSeenAtRef: 最後に顔を検出した時刻(ミリ秒)
  const lastGestureAtRef = useRef(0);        // lastGestureAtRef: 最後にグーを処理した時刻(デバウンス用)

  // ▼ 画面状態フラグ。モデル読み込み/カメラ準備が整ったら true
  const [ready, setReady] = useState(false); // ready: 初期化完了かをUI用に保持

  // ▼ MediaPipe タスクのインスタンスを格納する ref（初期化後に代入）
  const gestureRecognizerRef = useRef(null); // gestureRecognizerRef: 手のジェスチャー認識器
  const faceDetectorRef = useRef(null);      // faceDetectorRef: 顔検出器

  // ▼ 依存ファイルのCDN URLを定義（npm不要のため全て外部参照）
  const wasmBaseUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"; // MediaPipe Tasks の WASM 配布場所
  const gestureModel = "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task"; // ジェスチャー用モデル(.task)
  const faceModel = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite"; // 顔検出モデル(.tflite)

  // ▼ CDNから @mediapipe/tasks-vision を動的に読み込むヘルパー
  const loadTasks = async () => {                                        // loadTasks: ESM をランタイムで import
    const mod = await import("https://esm.run/@mediapipe/tasks-vision@latest"); // esm.run 経由で最新を取得（固定したい場合は@0.xに）
    return mod;                                                          // 読み込んだモジュール（FilesetResolver等が入っている）
  };

  // ▼ 監視ロジック：enabled が true の間だけ初期化＆ループを回す
  useEffect(() => {                                                      // useEffect: マウント/更新時に副作用を実行
    if (!enabled) return;                                                // enabled が false なら早期リターン（何もしない）

    let stream;                                                          // stream: カメラの MediaStream を保持
    let destroyed = false;                                               // destroyed: クリーンアップ済みかのフラグ（競合防止）

    async function init() {                                              // init: 初期化処理をまとめた非同期関数
      try {                                                              // try: 失敗時でも finally で後始末できるように
        // --- (1) カメラ起動 -------------------------------------------------
        stream = await navigator.mediaDevices.getUserMedia({             // getUserMedia: カメラ映像を要求
          video: { facingMode: "user" },                                // facingMode: フロントカメラ（ノートPCは通常これ）
          audio: false,                                                  // audio: 音声は不要なのでオフ
        });
        if (!videoRef.current) return;                                   // videoRef が未セットなら処理中断
        videoRef.current.srcObject = stream;                             // 取得したカメラ映像を <video> に流し込む
        await videoRef.current.play();                                   // ビデオ再生を開始（モバイルではユーザー操作が必要な場合あり）

        // --- (2) MediaPipe タスク読み込み --------------------------------------
        const { FilesetResolver, GestureRecognizer, FaceDetector } = await loadTasks(); // CDNからモジュール関数を取得
        const filesetResolver = await FilesetResolver.forVisionTasks(wasmBaseUrl);     // WASM の配置場所を指定して初期化

        gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(      // ジェスチャー認識器を生成
          filesetResolver,                                                             // ファイルセットリゾルバ（WASM解決）
          {
            baseOptions: { modelAssetPath: gestureModel },                             // 使用する .task モデルのURL
            runningMode: "VIDEO",                                                    // VIDEO: 連続フレーム入力モード
            numHands: 2,                                                               // 検出する手の最大数（2＝両手）
          }
        );

        faceDetectorRef.current = await FaceDetector.createFromOptions(                // 顔検出器を生成
          filesetResolver,                                                             // 同上
          {
            baseOptions: { modelAssetPath: faceModel },                                // 使用する顔検出モデル(.tflite)のURL
            runningMode: "VIDEO",                                                    // VIDEOモードでの推論
          }
        );

        setReady(true);                                                                // UI用フラグを true（準備完了）
        lastFaceSeenAtRef.current = Date.now();                                        // 最終顔検出時刻を現在に初期化

        // --- (3) 推論ループ -----------------------------------------------------
        const loop = async () => {                                                     // loop: 一定間隔で推論を回す関数
          if (!videoRef.current || destroyed) return;                                  // video が無い/破棄済みなら終了
          const video = videoRef.current;                                              // video: 局所変数に参照
          const tsMs = Date.now();                                                     // tsMs: このフレームのタイムスタンプ（ms）

          try {                                                                        // 推論エラーに備える
            // (a) 顔検出：離席/非注視の検出に利用
            if (faceDetectorRef.current) {                                             // 顔検出器が用意できているかチェック
              const faces = faceDetectorRef.current.detectForVideo(video, tsMs)?.detections ?? []; // 現フレームでの顔検出
              if (faces.length > 0) {                                                  // 顔が1つ以上検出された場合
                lastFaceSeenAtRef.current = tsMs;                                      // 最終検出時刻を更新
              } else {                                                                 // 顔が検出されない場合
                if (tsMs - lastFaceSeenAtRef.current >= awayThresholdMs) {             // 閾値を超えて不在が続いたら
                  lastFaceSeenAtRef.current = tsMs;                                    // 連発防止のため基準時刻を更新（簡易レート制限）
                  onAway();                                                            // 親へ「離席」と通知（タイマー中断を促す）
                }
              }
            }

            // (b) ジェスチャー認識：グー(Closed_Fist) でトグル
            if (gestureRecognizerRef.current) {                                        // ジェスチャー認識器があるか確認
              const result = gestureRecognizerRef.current.recognizeForVideo(video, tsMs); // 現フレームでの手指ジェスチャー推論
              const candidates = (result?.gestures ?? [])                               // gestures: 各手の候補配列(二次元)
                .flat()                                                                // 二次元配列を平坦化
                .sort((a, b) => b.score - a.score);                                    // スコア降順でソートして最上位を取りやすく
              const top = candidates[0];                                               // top: 最も確からしい候補
              if (top && top.categoryName === "Closed_Fist" && top.score >= minFistScore) { // グーかつスコアが閾値以上
                const now = Date.now();                                                // now: 現在時刻(ms)
                if (now - lastGestureAtRef.current >= gestureCooldownMs) {             // 前回からクールダウン経過？
                  lastGestureAtRef.current = now;                                      // 最終処理時刻を更新
                  onFist();                                                            // 親へ「グー」トリガを通知（中断/再開トグル）
                }
              }
            }
          } catch (e) {                                                                // 予期せぬ推論エラーを捕捉
            // console.warn(e);                                                        // 本番ではノイズになるため黙殺（必要なら有効化）
          }

          loopRef.current = setTimeout(loop, frameIntervalMs);                         // 次フレームの実行を予約（擬似的なfps制御）
        };

        loop();                                                                        // 最初のループを開始
      } catch (err) {                                                                  // カメラ権限エラー等を捕捉
        // 必要に応じて UI 側でトースト表示などを行う（このコンポーネント内では握りつぶし）
      }
    }

    init();                                                                            // 初期化を実行

    return () => {                                                                     // クリーンアップ関数（アンマウント時に実行）
      destroyed = true;                                                                // 破棄フラグを立て、ループ継続を防止
      if (loopRef.current) clearTimeout(loopRef.current);                              // 進行中の setTimeout をクリア
      try { videoRef.current && videoRef.current.pause(); } catch {}                   // video 再生を停止（例外は無視）
      if (stream) stream.getTracks().forEach(t => t.stop());                           // カメラの各トラックを停止（デバイス解放）
      setReady(false);                                                                 // UI用フラグをリセット
    };                                                                                 // クリーンアップここまで
  }, [enabled, awayThresholdMs, gestureCooldownMs, minFistScore, frameIntervalMs]);    // 依存配列：パラメータ変更時は再初期化

  // ▼ UI: プレビュー表示（デバッグ時のみ見える）。本番は非表示でOK
  return (
    <div className="mediapipe-monitor" style={{ display: showPreview ? "block" : "none" }}> {/* showPreview が true の時だけ表示 */}
      <video
        ref={videoRef}                                                                // ref: カメラ映像をアタッチする video 要素
        playsInline                                                                    // playsInline: iOS/Safari 向けインライン再生ヒント
        muted                                                                          // muted: 自動再生要件を満たすため無音
        style={{ width: 240, height: 180, background: "#000", borderRadius: 12 }}     // スタイル: 小さめのプレビュー枠
      />
      {!ready && <div className="text-muted text-sm">Loading MediaPipe…</div>}        {/* 準備中は簡単な表示 */}
    </div>
  );                                                                                   // コンポーネントの描画終了
}


// ==========================================================
// ▼ 既存ファイルへの組み込みメモ（すべてCDN前提 & 各行解説）
//    File: src/components/Timer/TimerContorl.jsx
// ==========================================================

// 1) 先頭の import 群の近くに以下を追加（相対パスは配置に合わせて修正）
// import MediaPipeMonitor from "./MediaPipeMonitor"; // MediaPipeの監視コンポーネントを読み込み

// 2) JSX のボタン群（停止/再開/保存）の少し上に、以下のブロックをそのまま挿入
// <MediaPipeMonitor
//   enabled={record?.timer_state !== 3}                 // 保存中(3)は監視不要なのでOFF、それ以外はON
//   onAway={() => {                                     // 顔不在の自動中断ロジック
//     if (record?.timer_state === 0) handleSusupend();  // 実行中(0)の時だけ中断APIを叩く
//   }}
//   onFist={() => {                                     // グー(Closed_Fist)検出時のトグル
//     if (record?.timer_state === 0) handleSusupend();  // 実行中なら中断
//     else if (record?.timer_state === 1) handleContinue(); // 中断中なら再開
//   }}
//   awayThresholdMs={10_000}                            // 顔なし10秒で onAway 発火
//   gestureCooldownMs={1500}                            // グー連続検出の誤作動防止(1.5秒)
//   minFistScore={0.8}                                   // グー認識の信頼度閾値
//   frameIntervalMs={66}                                 // 推論フレーム間隔（負荷が高ければ 100~150 に）
//   showPreview={false}                                  // デバッグ時のみ true（プレビュー表示）
// />

// 3) 備考
// - すべてCDN参照のため、npm i @mediapipe/tasks-vision は不要です。
// - ネットワーク遮断・CDNブロック環境では読み込めません。必要ならローカル同梱版に切替可。
// - 誤検知が気になる場合は minFistScore を 0.85~0.9 に、
//   反応が速すぎる場合は gestureCooldownMs を 2000~3000 に上げて調整してください。
