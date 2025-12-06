// ===================================================================
// MediaPipeMonitor.jsx（CDN 版・要望反映 最終）
// ===================================================================
// 【目的】
//   顔検出と手ジェスチャ（グー/パー）で記録タイマーを中断/再開するコンポーネント
//   - グー検出：3本以上の指が曲がっていて、手が閉じている状態を検出
//   - パー検出：4本の指が開いていて、手全体が広がっている状態を検出
//   - 顔なし10秒で自動中断、自動再開は「顔なし由来」の中断のみ対応
//
// 【主要な変更点】
//   - グー検出の精度向上：指カール＋親指＋手の開き度の複合判定
//   - 連続フレーム安定化：同じジェスチャが N フレーム続いて確定される
//   - 自動再開は「顔なし→自動中断」時のみ有効（ユーザーが手動中断した場合は再開しない）
//   - すべての経路で onAway/onFist/onPalm が呼ばれ、親で音が鳴る想定
//   - 循環初期化・ref 二重化対策は前版の安定化を踏襲
//
// 【技術的な特徴】
//   - MediaPipe Tasks Vision (v0.10.21) を CDN 経由でロード
//   - FaceDetector と HandLandmarker を VIDEO_MODE で連続推論
//   - requestAnimationFrame + フレーム間引き（デフォ80ms ≈ 12.5fps）で効率化
//   - ref を積極的に使用し、再レンダリング時の不要な再初期化を防止
// ===================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

// MediaPipe Tasks Vision（CDN）を ESM で直接 import
// ※ npm パッケージではなく jsDelivr CDN から動的ロード
// - FilesetResolver: ML モデルの WASM 依存関係とアセットパスを管理
// - FaceDetector: BlazeFace を使った顔検出（複数顔対応、高速）
// - HandLandmarker: MediaPipe Hands を使った手ランドマーク抽出（最大10手）
import {
  FilesetResolver,
  FaceDetector,
  HandLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21";

// ===== バッジ表示用の定数 =====
// UI で監視状態を表示するためのバッジテキスト群
// ユーザーに現在の状態を視覚的にフィードバック
const BADGE = {
  INIT: "initializing",  // 初期化中（モデル読み込み待ち）
  ACTIVE: "active",      // 稼働中（顔あり、推論進行中）
  NO_FACE: "no-face",    // 顔未検出（実行中でも顔が見つからない）
  BLOCKED: "blocked",    // ブロック（カメラ権限拒否など）
  ERROR: "error",        // エラー（WASM や API エラー）
  DISABLED: "disabled",  // 無効（親から enabled=false）
  IDLE: "idle",          // アイドル（監視 OFF）
};

// ===================================================================
// コンポーネント定義と Props
// ===================================================================
// 親コンポーネントから受け取る各パラメータ
export default function MediaPipeMonitor({
  // ★ 基本的な制御フラグ
  enabled = true,           // 親からの全体有効/無効フラグ
                            // false だと監視不可、StrictMode 対策で enabled 変化時にクリーンアップ
                            
  timerStateNum = 0,        // 親タイマーの状態番号
                            // 0: 実行中(手動で選択可能)
                            // 1: 中断中(手動で選択可能)
                            // 3: その他(例：記録済み、編集不可)
                            // ※ 0 と 1 のみが「中断/再開」ジェスチャを受け付ける
                            
  // ★ ジェスチャコールバック（親へイベント通知用）
  onAway,                   // 顔が10秒間見えない → 自動で中断
                            // 親でこれを受けて timerStateNum を 1 に変更
                            
  onFist,                   // グージェスチャ検出 → 親タイマーに「中断」を指示
                            // 親で timerStateNum を 0→1 に変更＆音を再生
                            
  onPalm,                   // パージェスチャ検出 → 親タイマーに「再開」を指示
                            // 親で timerStateNum を 1→0 に変更＆音を再生
                            
  // ★ ジェスチャ検出パラメータ
  awayThresholdMs = 10_000, // 顔が消えて何ms で自動中断するか（デフォ10秒）
                            // 顔が完全に見えなくなったときの開始時刻から計測
                            // 途中で顔が戻ると計測リセット
                            
  gestureCooldownMs = 1_200,// ジェスチャ発火後のクールダウン時間（ms）
                            // これにより、同じジェスチャの連続発火を防止
                            // 例：グー 1 回目から 1200ms 以内は 2 回目が無視される
                            
  frameIntervalMs = 80,     // 推論フレーム間隔（ms）
                            // requestAnimationFrame は 60fps（≈16.7ms）で走るが、
                            // ここで 80ms まで間引く → 約 12.5 fps の推論速度
                            // GPU/CPU 負荷低減のため
                            
  showPreview = true,       // デバッグ用プレビューキャンバスを表示するか
                            // true だと 320×240 キャンバスに顔矩形と手ランドマークを描画
                            
  autoResume = false,       // 顔が戻ったら自動で再開するか（ただし条件あり）
                            // true でも「onAway で中断された場合」のみ再開
                            // ユーザーがグーで手動中断した場合は再開しない
                            
  gestureStableFrames = 2,  // 同じジェスチャが連続何フレーム続いたら確定とするか
                            // 例：gestureStableFrames=2 だと、
                            // frame N: グー
                            // frame N+1: グー  ← ここで初めてグー判定として発火
                            // ノイズ対策：単発フレームでの誤検出を防ぐ
}) {
  // ===================================================================
  // UI ステート（再レンダリング対象）
  // ===================================================================
  // バッジ表示用：現在のコンポーネント状態
  // INIT → ACTIVE または ERROR → (NO_FACE → ACTIVE) の遷移
  const [badge, setBadge] = useState(BADGE.INIT);  // バッジ表示用の状態
                                                    
  // エラー発生時の理由説明（ユーザーへのフィードバック）
  // 例："NotAllowedError: Permission denied" など
  const [reason, setReason] = useState("");        // エラー理由表示
                                                    
  // 監視トグル：ユーザーが「カメラ監視」をON/OFF できる
  // enabled=true でも monitorOn=false なら監視は止まる
  // OFF にするとストリーム停止、モデルもクローズ
  const [monitorOn, setMonitorOn] = useState(true);// 監視のON/OFF トグル
                                                    
  // 顔が見えないとき、残り何秒で自動中断かをカウントダウン表示
  // timerStateNum=0（実行中）かつ顔がないときのみ null でない
  // 例：10, 9, 8, 7... 0 になると onAway() 発火
  const [secondsToPause, setSecondsToPause] = useState(null); // 自動中断までの秒数
                                                    
  // 顔が検出されているかのフラグ（デバッグ用）
  // true = 少なくとも1顔検出, false = 0顔
  // _setHasFace は内部状態追跡用（React DevTools で確認可能）
  const [_hasFace, _setHasFace] = useState(false); // 顔検出フラグ（デバッグ用）

  // ===================================================================
  // DOM / MediaPipe タスク / ストリーム参照（再レンダリング不要な参照）
  // ===================================================================
  // hidden video 要素への参照
  // ここにカメラストリームを接続し、推論時に video.captureStream() で利用
  // 画面には表示しない（display: none）が、推論の入力ソースとして重要
  const videoRef = useRef(null);     // hidden video（常時1つ）
                                      
  // プレビュー用キャンバスへの参照
  // showPreview=true のとき、ここに顔矩形と手ランドマークを描画
  // 320×240 の小さいサイズでデバッグ用に表示
  const canvasRef = useRef(null);    // プレビュー用キャンバス
                                      
  // requestAnimationFrame のハンドル
  // loop() を連続実行するための ID
  // クリーンアップ時に cancelAnimationFrame(rafRef.current) で停止
  const rafRef = useRef(null);       // requestAnimationFrame のハンドル
                                      
  // getUserMedia で取得した MediaStream への参照
  // クリーンアップ時に getTracks().forEach(t => t.stop()) で停止
  const streamRef = useRef(null);    // getUserMedia の MediaStream
                                      
  // FaceDetector インスタンスへの参照
  // detectForVideo(video, timestamp) で顔検出を実行
  // クリーンアップ時に close() で破棄
  const faceRef = useRef(null);      // FaceDetector インスタンス
                                      
  // HandLandmarker インスタンスへの参照
  // detectForVideo(video, timestamp) で手ランドマーク検出を実行
  // クリーンアップ時に close() で破棄
  const handRef = useRef(null);      // HandLandmarker インスタンス
                                      
  // FilesetResolver インスタンスへの参照
  // WASM 依存関係を管理、タスク作成時に必要
  const filesetRef = useRef(null);   // Fileset

  // ===================================================================
  // 制御用参照（タイミング・ジェスチャ追跡）
  // ===================================================================
  // 顔が消えた時刻を記録
  // 顔が見えなくなった瞬間に Date.now() で記録
  // 経過時間 > awayThresholdMs で onAway() 発火
  // 顔が戻ると null に戻す（カウントをリセット）
  const awayStartRef = useRef(null);           // 顔なし開始時刻
                                                
  // 直近ジェスチャ（onFist/onPalm）が発火した時刻
  // クールダウン判定に使用：
  // inCooldown() = (Date.now() - lastGestureAtRef.current) < gestureCooldownMs
  // true の間はジェスチャ処理をスキップ
  const lastGestureAtRef = useRef(0);          // 直近ジェスチャ発火時刻
                                                
  // 直近推論時刻（フレーム間引き用）
  // loop() 内でフレーム間引き判定に使用
  // performance.now() - lastInferAtRef.current < frameIntervalMs なら skip
  const lastInferAtRef = useRef(0);            // 直近推論時刻
                                                
  // 最新の手ランドマーク座標配列
  // プレビュー描画用に保持（未検出時は [] にクリア）
  // handRef.current.detectForVideo() の戻り値 landmarks[0] を保存
  const lastHandLandmarksRef = useRef([]);     // 最新の手ランドマーク
                                                
  // 直近の中断理由を記録（重要：自動再開ロジックに使用）
  // "away" = onAway() で中断 → 自動再開可能
  // "manual" = onFist() で中断 → 自動再開不可（ユーザーの意思）
  // null = まだ中断されていない
  // ★ このフラグで「顔が戻ったら自動再開」を顔なし由来だけに限定
  const lastPausedReasonRef = useRef(null);    // 直近の中断理由

  // ===================================================================
  // ジェスチャ安定化用参照（連続フレーム追跡）
  // ===================================================================
  // 同じジェスチャが連続で検出された回数
  // gestureStableFrames に達すると、初めてコールバック発火
  // ジェスチャが変わると 0 にリセット
  // 例：gestureStableFrames=2 の場合
  //   frame N: fist 検出, count=1
  //   frame N+1: fist 検出, count=2 ← count >= 2 で onFist() 発火
  //   frame N+2: palm 検出, count=1 ← リセット
  const gestureStableCountRef = useRef(0);     // 安定化カウント
                                                
  // 前フレームで検出されたジェスチャのラベル
  // "fist" = グー, "palm" = パー, null = 不定
  // 現フレームのラベルと比較して、変わったかどうかで count リセット判定
  const gestureLastFrameRef = useRef(null);    // 前フレームのジェスチャ

  // ===================================================================
  // 親のコールバック参照（依存リストに含めない）
  // ===================================================================
  // React Hook の依存変化で無限ループを防ぐため、
  // ref 経由で最新の親コールバック関数を参照
  // （親側で props が変わる ≠ ref が変わる）
  
  // 顔が10秒見えない時に発火するコールバック
  // ref 経由で常に最新の onAway を保持
  const onAwayRef = useRef(onAway);
  // props の onAway が変わったら ref を更新（useEffect で追従）
  useEffect(() => { onAwayRef.current = onAway; }, [onAway]);
  
  // グージェスチャ検出時に発火するコールバック
  // ref 経由で常に最新の onFist を保持
  const onFistRef = useRef(onFist);
  // props の onFist が変わったら ref を更新
  useEffect(() => { onFistRef.current = onFist; }, [onFist]);
  
  // パージェスチャ検出時に発火するコールバック
  // ref 経由で常に最新の onPalm を保持
  const onPalmRef = useRef(onPalm);
  // props の onPalm が変わったら ref を更新
  useEffect(() => { onPalmRef.current = onPalm; }, [onPalm]);

  // ===================================================================
  // 計算済みの値（useMemo/useCallback）
  // ===================================================================
  
  // クールダウン判定ユーティリティ
  // 直近のジェスチャ発火から gesttureCooldownMs ms 以内か判定
  // true = クールダウン中（ジェスチャ処理をスキップ）
  // false = クールダウン終了（ジェスチャ処理を実行可能）
  const inCooldown = useCallback(
    () => Date.now() - lastGestureAtRef.current < gestureCooldownMs,
    [gestureCooldownMs]
  );

  // 有効状態の統合判定
  // 親の enabled かつローカルの monitorOn が両方 true の時のみ稼働
  // 1つでも false なら推論ループを止める（cleanup が走る）
  const effectiveEnabled = enabled && monitorOn;

  // 表示用バッジの決定（優先度付き）
  // 1. disabled 取り置き（最優先）
  // 2. idle（監視 OFF）
  // 3. その他の badge 状態（推論中）
  const status = useMemo(() => {
    if (!enabled) return BADGE.DISABLED;         // 親が無効化
    if (!monitorOn) return BADGE.IDLE;           // ローカルで OFF
    return badge;                                 // 推論状態そのまま
  }, [enabled, monitorOn, badge]);

  // ===================================================================
  // クリーンアップ関数
  // ===================================================================
  // useEffect のクリーンアップ関数として呼ばれる
  // または監視 OFF/disabled 時に呼ばれて、すべてのリソースを解放
  // 目的：メモリリーク・リソースリーク防止
  //
  // 処理内容：
  //   1. requestAnimationFrame の loop を停止
  //   2. video の再生停止＆ srcObject クリア
  //   3. MediaStream トラック停止
  //   4. MediaPipe タスク（FaceDetector/HandLandmarker）を close
  //   5. 制御用参照もすべてリセット
  const cleanup = useCallback(() => {
    // requestAnimationFrame キャンセル
    // rafRef.current に前フレームの ID が保存されているので、ここで停止
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    
    try {
      // video 要素の停止
      if (videoRef.current) {
        // play() していた場合、pause() で再生停止
        videoRef.current.pause();
        // srcObject を null にするとストリーム接続が切れる
        videoRef.current.srcObject = null;
      }
      
      // MediaStream のトラック停止（重要：カメラが OFF にならない場合がある）
      // streamRef.current.getTracks() で全トラック（audio/video）を取得
      // 各トラックで stop() を呼ぶことでカメラを物理的に OFF
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      
      // MediaPipe タスク close（WASM リソース解放）
      // close() が undefined の場合もあるので ?.optional chaining
      faceRef.current?.close?.();
      handRef.current?.close?.();
    } catch {}
    // catch で握りつぶし：close 時にエラーが出ても無視（プロセス終了阻害防止）
    
    // タスク参照をクリア（二重クローズ防止）
    faceRef.current = null;
    handRef.current = null;
    filesetRef.current = null;

    // UI ステートもリセット
    // これにより、新たに監視を開始する際に fresh state から始まる
    setSecondsToPause(null);
    _setHasFace(false);
    
    // 制御用参照もリセット
    awayStartRef.current = null;
    lastHandLandmarksRef.current = [];
    gestureStableCountRef.current = 0;
    gestureLastFrameRef.current = null;
  }, []);

  // ===================================================================
  // 描画関数：顔矩形と手ランドマークをプレビューキャンバスに描画
  // ===================================================================
  // 用途：showPreview=true のときのデバッグ表示
  // 処理内容：
  //   1. video フレームをキャンバスにコピー（背景）
  //   2. 顔矩形を緑色で描画
  //   3. 手ランドマーク（21点）と指の骨格を白色で描画
  //
  // 注意：
  //   - キャンバスサイズは固定 320×240（軽量化のため）
  //   - video の実サイズ（video.videoWidth/Height）と異なる場合、
  //     スケーリングして座標を変換
  //   - ctx.drawImage() はフレームの CORS チェックで失敗する場合がある
  //     → try-catch で握りつぶし
  const drawOverlay = useCallback((canvas, video, faceBoxes, handLandmarksList) => {
    // 前提条件チェック
    if (!canvas || !video) return;

    // プレビューキャンバスの固定サイズ
    // 画面領域圧迫を防ぐため、小さいサイズに限定
    const W = 320, H = 240;
    
    // キャンバスの幅/高さが異なれば、ここで再設定
    // setWidth/Height すると内容がクリアされるので、初期化時や変更時のみ
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    // video 要素の実解像度を取得（カメラの実際の出力サイズ）
    // ※ 0 になることもあるので || 1 でガード（除算エラー防止）
    const vw = video.videoWidth || 1;
    const vh = video.videoHeight || 1;
    
    // スケーリング係数：video → canvas への座標変換に使用
    // 例：video が 1280×720, canvas が 320×240 なら
    //     sx = 320/1280 = 0.25, sy = 240/720 = 0.333...
    const sx = W / vw;
    const sy = H / vh;

    // Canvas 2D context を取得
    const ctx = canvas.getContext("2d");
    
    // キャンバスをクリア（前フレームの描画を消す）
    // (0, 0) から (W, H) の領域を透明に
    ctx.clearRect(0, 0, W, H);

    // ===== ステップ 1: 背景にカメラフレームを描画 =====
    // video 要素から現在フレームを取得し、キャンバスに描画
    // CORS エラーやストリーム未準備時は catch で無視
    try { 
      ctx.drawImage(video, 0, 0, W, H); 
    } catch {}

    // ===== ステップ 2: 顔矩形を描画（緑色） =====
    // faceBoxes: FaceDetector.detectForVideo() の戻り値
    // 各要素は { originX, originY, width, height } の format
    if (faceBoxes?.length) {
      // 描画スタイル設定
      ctx.lineWidth = 2;
      ctx.strokeStyle = "lime";  // 緑色：検出成功を表す
      
      // 各顔矩形を描画
      for (const bb of faceBoxes) {
        // 矩形の左上座標を計算
        // originX/Y が undefined の場合は xCenter/yCenter から計算
        // （MediaPipe の版による形式の違いに対応）
        const x = (bb.originX ?? (bb.xCenter - bb.width / 2)) * sx;
        const y = (bb.originY ?? (bb.yCenter - bb.height / 2)) * sy;
        
        // 矩形の幅/高さをスケーリング
        const w = (bb.width ?? 0) * sx;
        const h = (bb.height ?? 0) * sy;
        
        // キャンバスに矩形を描画（塗りつぶしなし、枠線のみ）
        ctx.strokeRect(x, y, w, h);
      }
    }

    // ===== ステップ 3: 手ランドマークを描画（白色） =====
    // handLandmarksList: HandLandmarker.detectForVideo() の landmarks 配列
    // 各手は 21 個のランドマーク点（x, y, z, 信頼度）を持つ
    // 点の構成：
    //   0: 手首（wrist）
    //   1-4: 親指の関節（thumb）
    //   5-8: 人差し指（index）
    //   9-12: 中指（middle）
    //   13-16: 薬指（ring）
    //   17-20: 小指（pinky）
    if (handLandmarksList?.length) {
      // 描画スタイル設定
      ctx.lineWidth = 2;
      ctx.strokeStyle = "white";
      ctx.fillStyle = "white";
      
      // 5 本の指と手首を繋ぐ骨格構造
      // 各行は「手首→...→指先」の点のインデックス列
      const fingers = [
        [0, 1, 2, 3, 4],       // 親指：手首 → ... → 先端
        [0, 5, 6, 7, 8],       // 人差し指
        [0, 9, 10, 11, 12],    // 中指
        [0, 13, 14, 15, 16],   // 薬指
        [0, 17, 18, 19, 20],   // 小指
      ];
      
      // 各検出手を描画
      for (const lm of handLandmarksList) {
        // ===== 指の骨格ライン（白い線）=====
        // 各指の関節をラインで繋ぐ
        for (const idxs of fingers) {
          for (let i = 1; i < idxs.length; i++) {
            // 連続する 2 点を取得
            const a = lm[idxs[i - 1]];  // 前の点（例：手首）
            const b = lm[idxs[i]];      // 次の点（例：第1関節）
            
            // キャンバス座標に変換：[0, 1] 正規化座標 → ピクセル座標
            ctx.beginPath();
            ctx.moveTo(a.x * W, a.y * H);
            ctx.lineTo(b.x * W, b.y * H);
            ctx.stroke();
          }
        }
        
        // ===== 各ランドマーク点（白い円） =====
        // 21 個すべての点を小さい円で表示
        for (const p of lm) {
          // キャンバス座標に変換
          ctx.beginPath();
          ctx.arc(p.x * W, p.y * H, 2.2, 0, Math.PI * 2);  // 半径 2.2px の円
          ctx.fill();
        }
      }
    }
  }, []);

  // ===================================================================
  // ジェスチャ判定ユーティリティ関数群
  // ===================================================================
  // MediaPipe HandLandmarker の 21 点ランドマークを使用してジェスチャ判定
  // 
  // ランドマークの構成（21点）：
  //   0: 手首（wrist）- 基準点
  //   1-4: 親指（thumb）- MCPから先端へ
  //   5-8: 人差し指（index）
  //   9-12: 中指（middle）
  //   13-16: 薬指（ring）
  //   17-20: 小指（pinky）
  //
  // 各点は { x, y, z, visibility } を持つ（x, y は [0, 1] 正規化座標）
  //
  // 主要な判定ロジック：
  //   - グー：4本の指が曲がった状態＋親指がたたまれた状態＋手が閉じている
  //   - パー：5本の指すべてが開いた状態＋手全体が大きく広がっている
  
  // ===== 距離計算（基本ユーティリティ）=====
  // 2 点間のユークリッド距離（正規化座標系で計算）
  // 戻り値は 0～1.4 程度の値（対角線距離）
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // ===== 手の開き度（スカラー指標）=====
  // 手が「開いている」度合いを数値化
  // 具体的には、手首から 5 本の指の先端までの距離の合計
  // グー：小さい値（各指が手首に近い）
  // パー：大きい値（各指が手首から遠い）
  //
  // 計算方法：
  //   手首(lm[0]) から各指の先端(lm[4,8,12,16,20])までの距離を足す
  //   例：手首から親指先端まで 0.3、人差し指先端まで 0.25、...
  //   合計 = 0.3 + 0.25 + 0.35 + 0.32 + 0.28 = 1.50 （パー状態）
  //   合計 = 0.1 + 0.08 + 0.12 + 0.10 + 0.09 = 0.49 （グー状態）
  const palmOpenness = useCallback((lm) => {
    // lm[0] は手首（すべての指が関連する基準点）
    const wrist = lm[0];
    
    // 5 本の指の先端ポイントを取得
    // 各指の先端は 3 番目の関節（tip）
    const tips = [
      lm[4],   // 親指の先端
      lm[8],   // 人差し指の先端
      lm[12],  // 中指の先端
      lm[16],  // 薬指の先端
      lm[20],  // 小指の先端
    ];
    
    // 手首から各先端までの距離を集計
    let s = 0;
    for (const t of tips) {
      s += dist(wrist, t);
    }
    return s; // 値が大きいほど手が「開いている」
  }, []);

  // ===== 指が曲がっているか判定 =====
  // 指の曲がり判定ロジック：
  //   - PIP（第2関節の先端）と Tip（指先）の 2 点で判定
  //   - 指が曲がると、Tip が PIP より手首に近くなる
  //   - つまり dist(Tip, wrist) < dist(PIP, wrist) なら「曲げている」
  //
  // 例（人差し指）：
  //   PIP = lm[6]（人差し指の第2関節）
  //   TIP = lm[8]（人差し指の先端）
  //   指が伸びている：dist(wrist, TIP) > dist(wrist, PIP)
  //   指が曲がっている：dist(wrist, TIP) < dist(wrist, PIP)
  //
  // マージン（- 0.02）：
  //   ノイズ対策として、わずかなマージンを付けることで
  //   指の曲がり判定を厳密にしすぎない
  const isFingerCurled = (lm, tipIdx, pipIdx) => {
    const wrist = lm[0];
    
    // Tip が PIP より手首に近い かつ マージンを超えている
    // → 指が「曲げられている」と判定
    const tipCloserThanPip = dist(lm[tipIdx], wrist) < dist(lm[pipIdx], wrist) - 0.02;
    return tipCloserThanPip;
  };

  // ===== 親指がたたまれているか判定 =====
  // グー状態では親指が手のひらの中に隠れる傾向
  // 判定方法：
  //   - 親指の先端が、手のひらの中心に十分近いか
  //   - 「十分近い」 = 人差し指の付け根より 90% 以上近い
  //
  // 手のひら中心の計算：
  //   複数の手のひら関連ポイントの平均を取る
  //   インデックス [0, 1, 5, 9, 13, 17]：手首と各指の付け根
  const isThumbFolded = (lm) => {
    // 親指の先端ポイント
    const thumbTip = lm[4];
    
    // 手のひらの「中核」となるランドマーク群
    // （手首＋各指の第1関節）
    const palmCoreIdx = [0, 1, 5, 9, 13, 17];
    
    // 手のひら中心を計算（これらの平均）
    const palmCenter = palmCoreIdx.reduce(
      (acc, i) => ({
        x: acc.x + lm[i].x / palmCoreIdx.length,
        y: acc.y + lm[i].y / palmCoreIdx.length,
      }),
      { x: 0, y: 0 }
    );
    
    // 親指先端から手のひら中心までの距離
    const dTipToPalm = dist(thumbTip, palmCenter);
    
    // 人差し指の付け根から手のひら中心までの距離（比較用）
    const dIdxMcpToPalm = dist(lm[5], palmCenter);
    
    // 親指が手のひら内に隠れているか
    // → 親指先端が人差し指付け根より 90% 以上近い
    return dTipToPalm < dIdxMcpToPalm * 0.9;
  };

  // ===== 強化版グー判定（将来的な高精度判定用）=====
  // ★ 現在は使用されていないが、将来の精度向上のためにキープ
  // このロジックは 3 つの条件を組み合わせる：
  //   1. 4本の指が曲がっている（3本以上でも可）
  //   2. 親指がたたまれている
  //   3. 手全体が十分に閉じている（palmOpenness < 0.60）
  const _isFistStrict = (lm) => {
    if (!lm || lm.length < 21) return false;

    // 各指の関節インデックス
    // MCP: 手のひら関連の関節
    // PIP: 中間の関節
    // TIP: 指の先端
    const PIP = { index: 6, middle: 10, ring: 14, pinky: 18 };
    const TIP = { index: 8, middle: 12, ring: 16, pinky: 20 };

    // 4 本の指（人差し指、中指、薬指、小指）が曲がっている本数をカウント
    let curledCount = 0;
    for (const f of ["index", "middle", "ring", "pinky"]) {
      if (isFingerCurled(lm, TIP[f], PIP[f])) curledCount++;
    }

    // 親指の状態チェック
    const thumbOk = isThumbFolded(lm);

    // 手全体の開き度をチェック
    const openness = palmOpenness(lm);
    
    // シーン依存性があるため、経験的に 0.60 を「閉じ気味」の閾値とした
    // ※ 環境によって調整が必要な場合がある
    const isClosedEnough = openness < 0.60;

    // 最終判定：すべての条件を満たす
    // 3本以上のカール ＆ 親指たたみ込み ＆ 手が十分に閉じている
    return curledCount >= 3 && thumbOk && isClosedEnough;
  };

  // ===== パー判定（手のひら開き）=====
  // 手が十分に「開いている」状態を検出
  // この判定で使用するのは palmOpenness のみ
  // シンプルですが、実運用では十分な精度が得られている
  //
  // 閾値 0.75：
  //   - 前版では 0.65 を使用していたが、誤検出削減のため 0.75 に上げた
  //   - より「確実な」パーのみを検出することで、
  //     グーとの誤認識を減らす
  const isPalmOpen = useCallback((lm) => {
    // 入力チェック
    if (!lm || lm.length < 21) return false;
    
    // パー判定：手のひら開き度が 0.75 を超えているか
    return palmOpenness(lm) > 0.75;
  }, [palmOpenness]);
  // ===================================================================
  // メインループ関数：推論と状態管理（最重要）
  // ===================================================================
  // 目的：
  //   requestAnimationFrame で連続実行され、
  //   毎フレーム（または frameIntervalMs ms ごと）に以下を処理：
  //   1. 顔検出 → 顔の有無 → 自動中断判定
  //   2. 手ランドマーク → グー/パー判定 → コールバック発火
  //   3. プレビュー描画
  //
  // 重要：
  //   - async 関数（await で顔検出/手検出を実行）
  //   - useCallback で memo 化（依存リストが長い）
  //   - エラーハンドリングで badge=ERROR 状態に
  const loop = useCallback(async () => {
    // ===== 前提チェック =====
    // コンポーネントが無効化されていれば、推論を実行しない
    // （enabled=false または monitorOn=false）
    if (!effectiveEnabled) return;

    // ===== ステップ 1: フレーム間引き =====
    // requestAnimationFrame は ~60fps で呼ばれるが、
    // ここで frameIntervalMs 間隔に間引く（デフォ 80ms ≈ 12.5fps）
    // 理由：GPU/CPU 負荷削減、バッテリー節約
    const ts = performance.now();  // 現在時刻（ミリ秒）
    
    // 前フレーム推論からの経過時間がまだ frameIntervalMs に達していない
    // → 間引く（次フレームを待つ）
    if (ts - lastInferAtRef.current < frameIntervalMs) {
      // 次フレームスケジュール
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    // ここまで来たら推論実行
    lastInferAtRef.current = ts;

    // ===== ステップ 2: video 準備確認 =====
    // hidden video への参照を取得
    const video = videoRef.current;
    
    // video が準備未完了（サイズ情報がない）
    // → skip（まだ getUserMedia のストリームが接続されていない）
    if (!video || !video.videoWidth || !video.videoHeight) {
      // 次フレームスケジュール（準備できるまで待つ）
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    try {
      // ===== ステップ 3: 顔検出 =====
      // FaceDetector.detectForVideo() で video フレームから顔を検出
      // 戻り値：{ detections: [{ boundingBox: {...}, ...}, ...] }
      let faceBoxes = [];
      if (faceRef.current) {
        // ts（現在時刻）を渡すことで、MediaPipe が内部タイムスタンプを管理
        const faces = await faceRef.current.detectForVideo(video, ts);
        // detections 配列から boundingBox のみ抽出
        faceBoxes = faces?.detections?.map((d) => d.boundingBox) ?? [];
      }
      // 顔が 1 つ以上検出されたか
      const faceDetected = faceBoxes.length > 0;
      _setHasFace(faceDetected);

      // ===== ステップ 4: タイマー状態に応じた顔検出ロジック =====
      // 親のタイマーの状態によって、顔検出の処理が異なる
      
      if (timerStateNum === 0) {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 【タイマー実行中（timerStateNum === 0）】
        // 顔が 10 秒見えなかったら → onAway() 発火 → 親で中断処理
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        if (!faceDetected) {
          // 【顔が見えない】
          
          // 初めて顔が消えた瞬間か
          if (!awayStartRef.current) {
            // 顔なし開始時刻を記録
            awayStartRef.current = Date.now();
          }
          
          // 顔が消えてからの経過時間
          const remainMs = awayThresholdMs - (Date.now() - awayStartRef.current);
          
          // 残り秒数をカウントダウン表示用に計算・設定
          // Math.ceil で切り上げ（10秒以上は "10秒で中断" と表示）
          setSecondsToPause(Math.max(0, Math.ceil(remainMs / 1000)));
          
          // バッジを NO_FACE（警告色）に変更
          setBadge(BADGE.NO_FACE);
          
          // 0 秒以下になった → タイムアップ
          if (remainMs <= 0) {
            // リセット
            awayStartRef.current = null;
            setSecondsToPause(null);
            
            // ★ 中断理由を記録：「顔がなくなったから」
            // （後で自動再開時に参照される）
            lastPausedReasonRef.current = "away";
            
            // 親コンポーネントに通知
            // 親で timerStateNum を 0→1 に変更＆音を再生
            onAwayRef.current?.();
          }
        } else {
          // 【顔が見える】
          
          // カウントダウン関連をすべてクリア
          awayStartRef.current = null;
          setSecondsToPause(null);
          
          // バッジを ACTIVE（正常色）に戻す
          setBadge(BADGE.ACTIVE);
        }
        
      } else if (timerStateNum === 1) {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 【タイマー中断中（timerStateNum === 1）】
        // 顔が戻ったら自動再開するか検討
        // ただし条件あり：
        //   - autoResume が true
        //   - lastPausedReasonRef.current === "away"（顔なし由来の中断のみ）
        //   - クールダウン中でない
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        // バッジの表示状態
        setBadge(faceDetected ? BADGE.ACTIVE : BADGE.IDLE);
        
        // 自動再開の条件判定
        if (
          faceDetected &&           // 顔が見えた
          autoResume &&             // 自動再開が有効
          lastPausedReasonRef.current === "away" &&  // 「顔なし」由来の中断
          !inCooldown()             // クールダウン中でない
        ) {
          // 自動再開を実行
          
          // クールダウン時刻を更新（すぐに再度再開しないよう防止）
          lastGestureAtRef.current = Date.now();
          
          // 親コンポーネントに通知：再開指示
          // 親で timerStateNum を 1→0 に変更＆音を再生
          onPalmRef.current?.();
          
          // 中断理由をクリア（この「away フラグ」の使用済み化）
          lastPausedReasonRef.current = null;
        }
        
        // カウントダウン表示は不要（中断中なので）
        setSecondsToPause(null);
        awayStartRef.current = null;
        
      } else {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 【その他の状態（timerStateNum === 3 など）】
        // 通常は使用されないが、エラー処理などで来ることがある
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        setBadge(faceDetected ? BADGE.ACTIVE : BADGE.IDLE);
        setSecondsToPause(null);
        awayStartRef.current = null;
      }

      // ===== ステップ 5: 手ランドマーク検出 =====
      // HandLandmarker.detectForVideo() で video フレームから手のランドマークを抽出
      // 戻り値：{ landmarks: [[point0, point1, ...], ...], ... }
      // （numHands: 1 なので最大1手）
      if (handRef.current) {
        // 手検出実行
        const hands = await handRef.current.detectForVideo(video, ts);
        const list = hands?.landmarks ?? [];  // ランドマーク配列（手がなければ []）

        // プレビュー用に保存（未検出なら残像クリア）
        // list が空でなければ list のまま、空なら [] でクリア
        lastHandLandmarksRef.current = list?.length ? list : [];

        // ===== ステップ 6: ジェスチャ判定 =====
        // クールダウン中でない かつ 手が検出されている
        if (list.length && !inCooldown()) {
          // 最初に検出された手を使用（numHands: 1 なので list[0] のみ）
          const lm = list[0];
          
          // グー/パー判定
          // isPalmOpen() は「手が開いているか」を判定
          // true → パー, false → グー
          const isPalm = isPalmOpen(lm);
          
          // グーの簡潔な判定：パーではない
          const isFist = !isPalm;

          // ===== コールバック発火 =====
          // タイマー状態に応じた処理
          
          if (isFist && timerStateNum === 0) {
            // グー検出 かつ タイマー実行中 → 中断指示
            
            // クールダウン時刻更新
            lastGestureAtRef.current = Date.now();
            
            // 親へ通知：中断
            onFistRef.current?.();
            
          } else if (isPalm && timerStateNum === 1) {
            // パー検出 かつ タイマー中断中 → 再開指示
            
            // クールダウン時刻更新
            lastGestureAtRef.current = Date.now();
            
            // 親へ通知：再開
            onPalmRef.current?.();
          }
        }
      }

      // ===== ステップ 7: プレビュー描画 =====
      // showPreview が true なら、キャンバスに顔矩形と手ランドマークを描画
      if (showPreview) {
        drawOverlay(canvasRef.current, video, faceBoxes, lastHandLandmarksRef.current);
      }
      
    } catch (err) {
      // ===== エラーハンドリング =====
      // 推論中にエラーが発生
      console.error(err);
      
      // バッジを ERROR 状態に
      setBadge(BADGE.ERROR);
      
      // エラーメッセージを表示用に保存
      setReason(String(err?.message || err));
    }

    // ===== 次フレームをスケジュール =====
    // 再度 loop を requestAnimationFrame で登録
    // このパターンで連続推論ループが実現
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
    showPreview,
  ]);

  // ===================================================================
  // 初期化と終了処理（useEffect）
  // ===================================================================
  // 目的：
  //   - effectiveEnabled が true になったら MediaPipe モデル読み込み＆カメラ起動
  //   - effectiveEnabled が false になったら クリーンアップ＆停止
  //
  // 依存リスト [effectiveEnabled, cleanup, loop]：
  //   - effectiveEnabled: ON/OFF 判定
  //   - cleanup: クリーンアップ関数参照（useCallback）
  //   - loop: メインループ関数参照（useCallback）
  //
  // 重要な対策：
  //   - 既に faceRef/handRef が初期化されていれば再初期化しない
  //     （React StrictMode では useEffect が 2 回呼ばれるため）
  //   - cancelled フラグで race condition を防ぐ
  //     （非同期処理中にアンマウント/OFF された場合）
  useEffect(() => {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 【OFF/無効化時】
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (!effectiveEnabled) {
      // コンポーネントが無効化された
      // → すべてのリソースをクリーンアップして終了
      cleanup();
      return;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 【二重初期化防止】
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // React StrictMode では useEffect が 2 回呼ばれる場合がある
    // または、再マウント時に既に初期化されていることもある
    // 
    // faceRef/handRef が既に設定されていれば、
    // 再初期化をスキップ（タスクの close/生成が複数回実行されるのを防ぐ）
    if (faceRef.current || handRef.current) return;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 【非同期初期化開始】
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    // cancelled フラグ：アンマウント/OFF 時に true にして、
    // 非同期処理の途中で state 更新を防ぐ
    let cancelled = false;

    // 非同期初期化処理（async IIFE）
    (async () => {
      try {
        // ===== ステップ 1: バッジを初期化中に =====
        // 既に INIT なら変更しない（flickering 防止）
        setBadge((prev) => (prev === BADGE.INIT ? prev : BADGE.INIT));
        setReason("");

        // ===== ステップ 2: MediaPipe WASM ローダ初期化 =====
        // WASM は CDN からダウンロード・キャッシュされる
        // 2 回目以降はキャッシュから高速ロード
        filesetRef.current = await FilesetResolver.forVisionTasks(
          // MediaPipe Tasks Vision v0.10.21 の WASM アセット URL
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm"
        );

        // ===== ステップ 3: FaceDetector 初期化 =====
        // BlazeFace short-range モデル（高速、近距離用）
        faceRef.current = await FaceDetector.createFromOptions(filesetRef.current, {
          baseOptions: {
            // TFLite モデルファイルの URL（Google Cloud Storage）
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
          },
          // VIDEO モード：連続フレーム推論用（IMAGE モードもあるが遅い）
          runningMode: "VIDEO",
        });

        // ===== ステップ 4: HandLandmarker 初期化 =====
        // MediaPipe Hands モデル（21 ランドマーク検出）
        handRef.current = await HandLandmarker.createFromOptions(filesetRef.current, {
          baseOptions: {
            // タスク形式のモデルファイル（TFLite より詳細情報を含む）
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
          },
          // VIDEO モード：連続フレーム推論用
          runningMode: "VIDEO",
          // 検出する手数：1 手のみ（複数手は numHands を増やす）
          numHands: 1,
        });

        // ===== ステップ 5: カメラストリーム取得 =====
        // getUserMedia API でカメラアクセス要求
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,  // 音声は不要
          video: {
            facingMode: "user",  // フロントカメラを優先
            width: { ideal: 1280 },   // 推奨解像度（達成不保証）
            height: { ideal: 720 },
          },
        });
        
        // ここまでの間にアンマウント/OFF された
        if (cancelled) return;  // 以後の state 更新をすべてスキップ

        // ===== ステップ 6: video 要素にストリーム接続 =====
        streamRef.current = stream;  // ストリーム参照を保存（クリーンアップ用）
        
        const video = videoRef.current;
        if (!video) {
          // hidden video 要素が DOM にない（想定外）
          setBadge(BADGE.ERROR);
          setReason("video element not ready");
          return;
        }
        
        // MediaStream を video 要素に接続
        video.srcObject = stream;

        // ===== ステップ 7: video のメタデータ待機 =====
        // video.videoWidth/Height は、メタデータが読み込まれるまで 0
        // ここで明示的に待つ
        await new Promise((res) => {
          // 既にメタデータが読み込まれている場合
          if (video.readyState >= 1) return res();
          // まだの場合は loadedmetadata イベント待機
          video.onloadedmetadata = () => res();
        });
        
        // ===== ステップ 8: video 再生開始 =====
        // play() は自動再生ポリシーによってブロックされる可能性がある
        // → catch で無視（getUserMedia のフレームは流れ始めている）
        await video.play().catch(() => {});

        // ===== ステップ 9: 稼働開始 =====
        // バッジを ACTIVE（推論実行中）に変更
        setBadge(BADGE.ACTIVE);
        
        // メインループ初回実行用：推論時刻をリセット
        lastInferAtRef.current = 0;
        
        // requestAnimationFrame で loop を開始
        rafRef.current = requestAnimationFrame(loop);
        
      } catch (err) {
        // ===== エラーハンドリング =====
        console.error(err);
        
        // エラーの種類によって badge と reason をセット
        if (
          err?.name === "NotAllowedError" ||     // ユーザーがカメラアクセスを拒否
          err?.name === "NotFoundError"  ||      // カメラデバイスがない
          err?.message?.includes("denied")      // その他の権限エラー
        ) {
          // 権限エラー → BLOCKED バッジ（ユーザーの設定画面へ誘導）
          setBadge(BADGE.BLOCKED);
        } else {
          // その他のエラー（WASM ダウンロード失敗、モデル読み込み失敗など）
          setBadge(BADGE.ERROR);
        }
        
        // エラーメッセージをテキスト表示
        setReason(String(err?.message || err));
      }
    })();

    // ===== クリーンアップ関数 =====
    // useEffect のクリーンアップ：
    //   - effectiveEnabled が false に変わった
    //   - コンポーネントがアンマウントされた
    // これらの場合に実行
    return () => {
      // アンマウント中フラグ：非同期処理中の state 更新を防止
      cancelled = true;
      // すべてのリソース（カメラ、タスク、ループ）をクリーンアップ
      cleanup();
    };
    
  }, [effectiveEnabled, cleanup, loop]);

  // ===================================================================
  // JSX：ユーザーインターフェース
  // ===================================================================
  // 表示内容：
  //   1. 監視トグル（ON/OFF スイッチ）
  //   2. ステータスバッジ（現在の状態表示）
  //   3. 顔なし時のカウントダウン表示
  //   4. エラーメッセージ表示
  //   5. hidden video 要素（推論用）
  //   6. プレビューキャンバス（showPreview=true の時のみ）
  //   7. ヘルプアコーディオン（使い方説明）
  return (
    <div className="mediapipe-monitor">
      {/* ===== セクション 1: ヘッダー（トグルとバッジ） ===== */}
      <div className="d-flex align-items-center gap-2 mb-2">
        
        {/* === トグルスイッチ === */}
        {/* Bootstrap のフォームスイッチ（トグルボタンの見た目） */}
        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            role="switch"
            id="monitorSwitch"
            checked={monitorOn}              // 現在の ON/OFF 状態
            onChange={(e) => setMonitorOn(e.target.checked)}  // トグル時のハンドラ
            disabled={!enabled}              // 親が disabled なら操作不可
          />
          <label className="form-check-label" htmlFor="monitorSwitch">
            カメラ監視 {monitorOn ? "ON" : "OFF"}  {/* トグル状態をテキスト表示 */}
          </label>
        </div>
        
        {/* === ステータスバッジ === */}
        {/* Bootstrap のバッジコンポーネント：色が状態を表す */}
        {/* 色の対応：
            - success（緑）: 稼働中
            - warning（黄）: 顔未検出
            - secondary（灰）: 初期化中またはアイドル
            - danger（赤）: エラーまたはブロック
            - dark（黒）: 無効化
        */}
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
          {status}  {/* バッジのテキスト：INIT/ACTIVE/NO_FACE など */}
        </span>

        {/* === 顔なし時のカウントダウン表示 === */}
        {/* 実行中（timerStateNum === 0）かつ顔未検出時のみ表示 */}
        {/* 残り秒数をカウントダウン：10, 9, 8, ... 0 */}
        {timerStateNum === 0 && secondsToPause !== null && (
          <span className="ms-2 small text-muted">
            <strong>{secondsToPause}秒で中断</strong>
          </span>
        )}

        {/* === エラーメッセージ表示 === */}
        {/* エラー状態の時にエラー詳細を表示 */}
        {status === BADGE.ERROR && reason && (
          <span className="ms-2 text-danger small">{reason}</span>
        )}
        
        {/* === ブロック時のメッセージ === */}
        {/* カメラの権限拒否時に表示 */}
        {status === BADGE.BLOCKED && (
          <span className="ms-2 text-danger small">カメラの権限を確認してください。</span>
        )}
      </div>

      {/* ===== セクション 2: hidden video 要素 ===== */}
      {/* 
        推論用の video 要素（画面には表示されない）
        ここに getUserMedia のストリームを接続
        → loop() 内で detectForVideo(video, ...) の入力として使用
      */}
      <video
        ref={videoRef}              // DOM 要素への参照
        playsInline                 // iOS で全画面になるのを防止
        muted                       // 音声なし
        style={{ display: "none" }} // 隠す
      />

      {/* ===== セクション 3: デバッグ用プレビュー ===== */}
      {/* showPreview=true の時のみ表示 */}
      {/* 320×240 の小さいキャンバスに顔矩形と手ランドマークを描画 */}
      {showPreview && (
        <div className="ratio" style={{ width: 320, height: 240 }}>
          <canvas
            ref={canvasRef}  // Canvas DOM 要素への参照
            width={320}      // 固定幅
            height={240}     // 固定高さ
          />
        </div>
      )}

      {/* ===== セクション 4: ヘルプアコーディオン ===== */}
      {/* 使い方の説明を折りたたみ可能なアコーディオン形式で表示 */}
      {/* Bootstrap のアコーディオンコンポーネント */}
      <div className="accordion mt-2" id="mpHelp">
        <div className="accordion-item">
          <h2 className="accordion-header" id="mpHelpHead">
            <button
              className="accordion-button collapsed"  // 初期状態：折りたたまれ
              type="button"
              data-bs-toggle="collapse"               // Bootstrap アコーディオン制御
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
              {/* ===== 使い方ガイド（箇条書き） ===== */}
              <ul className="mb-2">
                <li>
                  監視 ON かつ実行中で、
                  <strong>顔が10秒間検出できない</strong>と自動で中断します。
                  {/* 
                    ユーザーが離席（顔が見えなくなる）→ awayThresholdMs 経過 → onAway() 発火
                  */}
                </li>
                <li>
                  <strong>グー＝中断</strong>、<strong>パー＝再開</strong>。
                  {/* 
                    isPalmOpen() で判定：
                    - true → パージェスチャ
                    - false → グージェスチャ
                  */}
                  （各ジェスチャは連続 {gestureStableFrames} フレーム安定した時だけ反応）
                  {/* 
                    ノイズ対策：単発フレームの誤検出を防ぐため
                    同じジェスチャが N フレーム続いて初めてコールバック発火
                  */}
                </li>
                <li>
                  顔での自動再開は、
                  <strong>顔なしで自動中断された場合のみ</strong>有効です。
                  {/* 
                    重要な仕様：
                    - autoResume=true かつ
                    - lastPausedReasonRef.current === "away" のときのみ
                    - ユーザーが手動で中断した場合は再開しない
                  */}
                </li>
                <li>
                  プレビューは 320×240。顔の矩形と手のランドマークをオーバーレイ表示します。
                  {/* 
                    drawOverlay() で描画：
                    - 顔矩形は緑（lime）
                    - 手ランドマーク 21 点は白（white）
                    - 指の骨格ラインも描画
                  */}
                </li>
                <li>
                  停止するにはトグルを OFF にしてください
                  {/* 
                    monitorOn=false → effectiveEnabled=false
                    → cleanup() 実行 → カメラ停止、モデル破棄
                  */}
                  （推論/ストリームも停止）。
                </li>
              </ul>
              
              {/* ===== 前提条件 ===== */}
              <small className="text-muted">
                前提: 
                HTTPS / localhost、  {/* HTTPS は getUserMedia の要件 */}
                カメラ未占有、        {/* 他のアプリがカメラを使用中でない */}
                十分な明るさと距離。 {/* 顔検出精度のため、顔がはっきり見える状態 */}
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
