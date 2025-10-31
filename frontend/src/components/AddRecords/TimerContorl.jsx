// import React, { useEffect, useRef, useState } from 'react'
// import TimerRecord from './TimerRecord'
// import DeleteTimer from '../Records/DeleteTimer'
// import SectoMin from './SectoMin'
// import { api } from "../../api";
// import { useTeam } from '../../context/TeamContext';
// import Skeleton from 'react-loading-skeleton';
// import 'react-loading-skeleton/dist/skeleton.css';
// import { toast } from 'react-toastify';
// import MediaPipeMonitor from './MediaPipeMonitor';
// import useSound from '../../utils/useSound';
// // チーム対応済

// // タイマーコンポーネント(計測やストップ)
// // ユーザーtokenやタイマーのレコードやタイマーの状態が変化したとき用のstateを持つ
// const TimerContorl = ({token,records,settimerchange}) => {
//   const { playPause, playResume } = useSound();
//   const [isLoading, setLoading] = useState(false);
//   const { currentTeamId } = useTeam();
//   // エラー表示などのmessagestate
//   const [errors,setErrors]=useState("")
//   // CO: カメラON/OFFトグル
//   const [camEnabled, setCamEnabled] = useState(true);
//   const toggleCam = () => setCamEnabled(v => !v);
//   // Vite のケース
//   const API_BASE = import.meta.env.VITE_API_BASE_URL
//    // タイマー計測はstateが0なら(今の時刻-starttime or stop_timeが存在していれば今の時刻-stop_time)
//   // stateが2ならaddコンポネが出る
//   // 中断時は経過時間を保存と、endtimeを保存(言うまでもなく終わっていないが中断から終了された時の為に保存しておく、中断していることは保存してるstateで管理してる)してstateを1に
//   // 再開時はstoptimeを今の時刻にしstoptimeとの差分+経過時間をとりstateを0に
//   // 終了時は時刻をendtimeに格納しstateを3に経過時間を保存と登録し終えたら2になる
//   // 時間用state
//   const [time,setTime]=useState(0)
//   // timer_state表示用state
//   const [timerState,setTimerState]=useState()
//   // btnのラベル用state(今のタイマーの逆)
//   const [btnLabelState,setBtnLabelState]=useState()
//   // timerid保持用ref(refはコンポーネント再レンダリングでも値保持)
//   const timerIdRef=useRef(null)
//   const record = records;
//   // 二重操作防止（手動ボタン/MediaPipe共通）
//   const opBusyRef = useRef(false);
//   const withBusy = (fn) => async (...args) => {
//     if (opBusyRef.current) return;
//     opBusyRef.current = true;
//     try { await fn(...args); } finally { opBusyRef.current = false; }
//   };
  
//   // 経過時間取り出し(中断していたらその数字、していないなら0)
//   const inialElaapsed = record?.duration ? record.duration : 0;
//   // console.log(inialElaapsed)
//   const subtr = record?.stop_time ? new Date(record.stop_time) : (record?.start_time ? new Date(record.start_time) : null);
//   // console.log(subtr)
 
//   useEffect(()=>{
//     // record が無ければ何もしない
//     if (!record) return;
//     setLoading(true);

//     // 既存のタイマーを一旦クリア
//     clearInterval(timerIdRef.current);

//     // 実行中の場合
//     if (record.timer_state === 0) {
//       setTimerState("実行中");
//       setBtnLabelState(
//         <button id="stopBtn" className="btn btn-secondary btn-lg" onClick={handleSusupend}>
//           <i className="bi bi-stop-fill"></i>
//         </button>
//       );
//       timerIdRef.current = setInterval(() => {
//         if (!subtr) return; // 安全ガード
//         const elapsedSec = Math.floor(((Date.now() - subtr) / 1000) + (inialElaapsed/1000));
//         setTime(elapsedSec);
//         const mins = Math.floor(elapsedSec / 60);
//         const secs = Math.floor(elapsedSec % 60);
//         const taskName = record?.task?.name ?? 'Timer';
//         // document.title も安全に
//         try { document.title = `${taskName}:${mins}分${secs}秒`; } catch {}
//       }, 1000);
//     }

//     // 中断中の場合
//     if (record.timer_state === 1) {
//       setTimerState("中断中");
//       setBtnLabelState(
//         <button id="startBtn" className="btn btn-primary btn-lg" onClick={handleContinue}>
//           <i className="bi bi-play-fill"></i>
//         </button>
//       );
//       setTime(inialElaapsed/1000);
//     }

//     // 保存中の場合
//     if (record.timer_state === 3) {
//       setTimerState("保存中");
//     }

//     setLoading(false);

//     // クリーンアップ
//     return () => {
//       clearInterval(timerIdRef.current);
//     };
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [record?.id, record?.timer_state, record?.start_time, record?.stop_time, inialElaapsed, currentTeamId]);
  
//   // 中断ボタン押下時関数
//   const handleSusupend = async () => {
//     if (!record) return;
//     setLoading(true);
//     const updateData = {
//       // 今の時間を経過時間として保存
//       duration: time * 1000,
//       // end時間として今の時刻を
//       end_time: new Date().toISOString(),
//       // timerのstateを中断中とする
//       timer_state: 1,
//     };
//      try{
//        await api(`/records/${record.id}/`,{
//          method: 'PATCH',
//          body: JSON.stringify(updateData),
//        });
//        toast.success("タイマーを中断しました!");
//        playPause(); // ★ 中断音
//        setLoading(false);
//        clearInterval(timerIdRef.current);
//        settimerchange();
//      }catch(err){
//        toast.error("タイマー中断に失敗しました。");
//        setLoading(false);
//        setErrors(err);
//      }
//   };

//   // 再開ボタン押下時関数
//   const handleContinue = async () => {
//     if (!record) return;
//     setLoading(true);
//     const updateData = {
//       // stop時間として今の時刻を
//       stop_time: new Date().toISOString(),
//       // timerのstateを実行中とする
//       timer_state: 0,
//     };
//      try{
//        await api(`/records/${record.id}/`,{
//          method: 'PATCH',
//          body: JSON.stringify(updateData),
//        });
//        toast.success("タイマーが再開しました!");
//        playResume(); // ★ 再開音
//        setLoading(false);
//        clearInterval(timerIdRef.current);
//        settimerchange();
//      }catch(err){
//        toast.error("タイマーの再開に失敗しました。");
//        setLoading(false);
//        setErrors(err);
//      }
//   };

//   // btnIF
//   // const handleClick=()=>{
//   //   if(timerState==="実行中"){
//   //     handleSusupend()
//   //   }
//   //   if(timerState==="中断中"){
//   //     handleContinue()
//   //   }
//   // }

//   // 終了ボタン押下時関数
//   const handleFnish = async () => {
//     if (!record) return;
//     // 確認ダイアログ
//     const result = window.confirm("本当に終了してもよいですか。");
//     // ダイアログがtrueなら
//     if (result){
//       setLoading(true);
//       // ★ ISO文字列としてAPIに渡す（中断中→既存end_timeを採用、無ければ現在時刻）
//       const endtime = (timerState==="中断中" && record?.end_time)
//         ? new Date(record.end_time).toISOString()
//         : new Date().toISOString();
      
//       const updateData = {
//         // 今の時間を経過時間として保存
//         duration: time * 1000,
//         // end時間として上でやった時刻を
//         end_time: endtime,
//         // timerのstateを保存中とする
//         timer_state: 3,
//       };
//       try{
//         await api(`/records/${record.id}/`,{
//           method: 'PATCH',
//           body: JSON.stringify(updateData),
//         });
//         toast.success("タイマーが停止しました!");
//         setLoading(false);
//         clearInterval(timerIdRef.current);
//         settimerchange();
//       }catch(err){
//         toast.error("タイマーの更新に失敗しました。");
//         setLoading(false);
//         setErrors(err);
//       }
//     }
//   };

//   if (!record) {
//     return (
//       <div className="timer-card mx-auto">
//         <Skeleton />
//       </div>
//     );
//   }

//   return (
//     <div className="timer-card mx-auto">
//       {record?.timer_state===3 ? (
//         <TimerRecord token={token} record={record} settimerchange={settimerchange} />
//       ) : (
//         <div>
//           {/* 送信エラー */}
//           {errors?.detail && (
//             <div className="text-danger mt-1">
//               <div>{errors.detail}</div>
//             </div>
//           )}
//           {/* ── フォーム全体エラー(non_field_errors) ── */}
//           {errors?.non_field_errors && (
//             <div className="alert alert-danger">
//               {errors.non_field_errors.map((msg, i) => (
//                 <div key={i}>{msg}</div>
//               ))}
//             </div>
//           )}

//           {isLoading ? <Skeleton/> : (
//             <>
//               <div className="d-flex flex-wrap justify-content-center gap-3 mt-3">
//                  <div className="d-flex flex-wrap justify-content-center gap-3 mt-3">
//                 {/* CO: カメラ ON/OFF トグル */}
//                 <button
//                   type="button"
//                   className={`btn btn-sm ${camEnabled ? 'btn-outline-success' : 'btn-outline-secondary'}`}
//                   onClick={toggleCam}
//                   title={camEnabled ? '監視ON' : '監視OFF'}
//                 >
//                   <i className={`bi ${camEnabled ? 'bi-camera-video' : 'bi-camera-video-off'}`}></i>
//                 </button>

//                 {/* === CO: 監視UI（ステータス＆ON/OFF） === */}
//                 <div className="d-flex align-items-center justify-content-between mb-2">
//                   <MediaPipeMonitor
//                     // CO: 監視ONかつ「保存中(3)でない」時のみ有効
//                     enabled={camEnabled && record?.timer_state !== 3}
//                     // CO: 顔なし10秒で自動中断（実行中のみ。withBusyで多重送信防止）
//                     onAway={withBusy(async () => { if (record?.timer_state === 0) await handleSusupend(); })}
//                     // CO: グー＝中断、パー＝再開（ボタンと同等のIF）
//                     onFist={withBusy(async () => { if (record?.timer_state === 0) await handleSusupend(); })}
//                     onPalm={withBusy(async () => { if (record?.timer_state === 1) await handleContinue(); })}
//                     awayThresholdMs={10_000}
//                     gestureCooldownMs={1200}
//                     minFistScore={0.8}
//                     frameIntervalMs={80}
//                     showPreview={true} // デバッグしたい時はtrue（将来OFF可）
//                     // ★ 追加: 親のタイマー状態を渡す（0:実行中/1:中断中/3:保存中）
//                     timerStateNum={record?.timer_state}
//                     // ★ 追加: 顔復帰で自動再開する
//                     autoResumeOnFace={true}
//                   />
//                 </div>
//               </div>
//               </div>

//               {/* === CO: 使い方の簡易説明（アコーディオン） === */}
//               <div className="accordion mb-3" id="timerHelpAccordion">
//                 <div className="accordion-item">
//                   <h2 className="accordion-header" id="timerHelpHeading">
//                     <button className="accordion-button collapsed" type="button"
//                       data-bs-toggle="collapse" data-bs-target="#timerHelpCollapse"
//                       aria-expanded="false" aria-controls="timerHelpCollapse">
//                       使い方
//                     </button>
//                   </h2>
//                   <div id="timerHelpCollapse" className="accordion-collapse collapse"
//                     aria-labelledby="timerHelpHeading" data-bs-parent="#timerHelpAccordion">
//                     <div className="accordion-body small">
//                       <ul className="mb-0 ps-3">
//                         <li>カメラ監視ONで、顔が一定時間（既定：<strong>10秒</strong>）検出できないと<strong>自動で中断</strong>します。</li>
//                         <li>手の<strong>グー</strong>で<strong>中断</strong>、<strong>パー</strong>で<strong>再開</strong>できます。</li>
//                         <li>プレビューには顔の矩形と手のランドマーク（点・線）を表示します（デバッグ用途）。</li>
//                         <li>監視を止めたいときは「<strong>OFF</strong>」ボタンを押してください。</li>
//                       </ul>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               <h5>トピック : <span className=''>{record?.subject?.name ?? '-'}</span></h5>
//               <h5>タスク : {record?.task?.name ?? '-'}</h5>
//               <h5>ユーザー : {record?.user?.username ?? '-'}</h5>
//               <SectoMin times={time}/>
//               <div className="d-flex justify-content-center gap-3 mt-3">
//                 {timerState === "実行中" && (
//                   <button id="stopBtn" className="btn btn-secondary btn-lg" onClick={withBusy(handleSusupend)}>
//                     <i className="bi bi-stop-fill"></i>
//                   </button>
//                 )}
//                 {timerState === "中断中" && (
//                   <button id="startBtn" className="btn btn-primary btn-lg" onClick={withBusy(handleContinue)}>
//                     <i className="bi bi-play-fill"></i>
//                   </button>
//                 )}
//                 {/* ── 保存ボタン ───────────────────── */}
//                 <button className="btn btn-info btn-lg" onClick={withBusy(handleFnish)}>
//                   <i className="bi bi-save"></i>
//                 </button>
//                 {/* {btnLabelState} */}
//                 <DeleteTimer token={token} record={record} settimerchange={settimerchange}/>
//               </div>
//               {/* {timerState} */}
//             </>
//           )}
//         </div>
//       )}
//     </div>
//   )
// }

// export default TimerContorl
import React, { useEffect, useRef, useState } from 'react';
import TimerRecord from './TimerRecord';
import DeleteTimer from '../Records/DeleteTimer';
import SectoMin from './SectoMin';
import { api } from "../../api";
import { useTeam } from '../../context/TeamContext';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';
import MediaPipeMonitor from './MediaPipeMonitor';
import useSound from '../../utils/useSound';

/**
 * TimerControl
 * - タイマー中断・再開・終了を制御
 * - MediaPipeMonitor連携で自動中断/再開/ジェスチャ制御
 * - カメラ監視ON/OFFトグル、音通知、アコーディオン形式ヘルプ付き
 * ※ コメントは残しています
 */
const TimerControl = ({ token, records, settimerchange }) => {
  const { playPause, playResume } = useSound();
  // 音をなりやすくするよう
  const unlockedRef = useRef(false);
  const unlockAudio = async () => {
    if (unlockedRef.current) return;
    try { await playResume(); } catch {}
    unlockedRef.current = true;
  };
  const [isLoading, setLoading] = useState(false);
  const { currentTeamId } = useTeam();
  const [errors, setErrors] = useState("");
  // カメラ監視 ON/OFF（ユーザトグル）
  const [camEnabled, setCamEnabled] = useState(true);
  const toggleCam = () => setCamEnabled(v => !v);

  // 時間・状態
  const [time, setTime] = useState(0);
  const [timerState, setTimerState] = useState();
  const timerIdRef = useRef(null);

  // 二重操作防止（手動ボタン/MediaPipe共通）
  const opBusyRef = useRef(false);
  const withBusy = (fn) => async (...args) => {
    if (opBusyRef.current) return;
    opBusyRef.current = true;
    try { await fn(...args); } finally { opBusyRef.current = false; }
  };

  // NOTE: ここでは records が単一レコード想定（配列なら親で絞り込み済み）
  const record = records ?? null;

  // 経過時間取り出し(中断していたらその数字、していないなら0)
  const inialElaapsed = record?.duration ? record.duration : 0;
  const subtr = record?.stop_time
    ? new Date(record.stop_time)
    : (record?.start_time ? new Date(record.start_time) : null);

  useEffect(() => {
    // record が無ければ何もしない
    if (!record) return;
    setLoading(true);

    // 既存のタイマーを一旦クリア
    clearInterval(timerIdRef.current);

    // 実行中の場合
    if (record.timer_state === 0) {
      setTimerState("実行中");
      timerIdRef.current = setInterval(() => {
        if (!subtr) return; // 安全ガード
        const elapsedSec = Math.floor(((Date.now() - subtr) / 1000) + (inialElaapsed / 1000));
        setTime(elapsedSec);
        const mins = Math.floor(elapsedSec / 60);
        const secs = Math.floor(elapsedSec % 60);
        const taskName = record?.task?.name ?? 'Timer';
        try { document.title = `${taskName}:${mins}分${secs}秒`; } catch {}
      }, 1000);
    }

    // 中断中の場合
    if (record.timer_state === 1) {
      setTimerState("中断中");
      setTime(Math.floor(inialElaapsed / 1000));
      try { document.title = `${record?.task?.name ?? 'Timer'}:中断中`; } catch {}
    }

    // 保存中の場合
    if (record.timer_state === 3) {
      setTimerState("保存中");
      try { document.title = `${record?.task?.name ?? 'Timer'}:保存中`; } catch {}
    }

    setLoading(false);

    // クリーンアップ
    return () => {
      clearInterval(timerIdRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id, record?.timer_state, record?.start_time, record?.stop_time, inialElaapsed, currentTeamId]);

  // ==== 中断 ====
  const handleSusupend = async () => {
    if (!record) return;
    setLoading(true);
    const updateData = {
      // 今の時間を経過時間として保存
      duration: time * 1000,
      // end時間として今の時刻を
      end_time: new Date().toISOString(),
      // timerのstateを中断中とする
      timer_state: 1,
    };
    try {
      await api(`/records/${record.id}/`, { method: 'PATCH', body: JSON.stringify(updateData) });
      toast.success("タイマーを中断しました!");
      try { await playPause(); } catch {}
      clearInterval(timerIdRef.current);
      settimerchange();
    } catch (err) {
      setErrors(err);
      toast.error("タイマー中断に失敗しました。");
    } finally { setLoading(false); }
  };

  // ==== 再開 ====
  const handleContinue = async () => {
    if (!record) return;
    setLoading(true);
    const updateData = {
      // stop時間として今の時刻を
      stop_time: new Date().toISOString(),
      // timerのstateを実行中とする
      timer_state: 0,
    };
    try {
      await api(`/records/${record.id}/`, { method: 'PATCH', body: JSON.stringify(updateData) });
      toast.success("タイマーが再開しました!");
      try { await playResume(); } catch {}
      clearInterval(timerIdRef.current);
      settimerchange();
    } catch (err) {
      setErrors(err);
      toast.error("タイマー再開に失敗しました。");
    } finally { setLoading(false); }
  };

  // ==== 終了 ====
  const handleFinish = async () => {
    if (!record) return;
    if (!window.confirm("本当に終了してもよいですか？")) return;
    setLoading(true);
    // ★ ISO文字列に統一（record.end_time が存在しても toISOString で送る）
    const endtimeIso = (timerState === "中断中" && record?.end_time)
      ? new Date(record.end_time).toISOString()
      : new Date().toISOString();

    const updateData = {
      duration: time * 1000,
      end_time: endtimeIso,
      timer_state: 3,
    };
    try {
      await api(`/records/${record.id}/`, { method: 'PATCH', body: JSON.stringify(updateData) });
      toast.success("タイマーが停止しました!");
      clearInterval(timerIdRef.current);
      settimerchange();
    } catch (err) {
      setErrors(err);
      toast.error("タイマー停止に失敗しました。");
    } finally { setLoading(false); }
  };

  if (!record) {
    return (
      <div className="timer-card mx-auto">
        <Skeleton />
      </div>
    );
  }

  return (
    <div className="timer-card mx-auto">
      {record.timer_state === 3 ? (
        <TimerRecord token={token} record={record} settimerchange={settimerchange} />
      ) : (
        <div>
          {/* 送信エラー */}
          {errors?.detail && (
            <div className="text-danger mt-1"><div>{errors.detail}</div></div>
          )}
          {/* ── フォーム全体エラー(non_field_errors) ── */}
          {errors?.non_field_errors && (
            <div className="alert alert-danger">
              {errors.non_field_errors.map((msg, i) => (<div key={i}>{msg}</div>))}
            </div>
          )}

          {isLoading ? <Skeleton/> : (
            <>
              {/* === 情報 === */}
              <h5>トピック: {record?.subject?.name ?? '-'}</h5>
              <h5>タスク: {record?.task?.name ?? '-'}</h5>
              <h5>ユーザー: {record?.user?.username ?? '-'}</h5>
              <SectoMin times={time} />

              {/* === 監視UI（MediaPipe） === */}
              <MediaPipeMonitor
                // 保存中(3)は監視不要なのでOFF + ユーザトグル
                enabled={camEnabled && record?.timer_state !== 3}
                // 親状態を子へ（0/1/3）
                timerStateNum={record?.timer_state}
                // 自動中断（多重送信防止 withBusy）
                onAway={withBusy(async () => { if (record?.timer_state === 0) await handleSusupend(); })}
                // グー（実行中のみ受付）
                onFist={withBusy(async () => { if (record?.timer_state === 0) await handleSusupend(); })}
                // パー（中断中のみ受付）
                onPalm={withBusy(async () => { if (record?.timer_state === 1) await handleContinue(); })}
                // 推奨デフォルト
                awayThresholdMs={10_000}
                gestureCooldownMs={1_200}
                frameIntervalMs={80}
                // プレビューは必要に応じて true/false
                showPreview={true}
                // 顔が戻ったら自動再開（既定はfalse）
                autoResume={true}
              />

              {/* === 操作ボタン === */}
              <div className="d-flex justify-content-center gap-3 mt-3">
                {timerState === "実行中" && (
                  <button className="btn btn-secondary btn-lg" onClick={withBusy(async () => { await unlockAudio(); await handleSusupend(); })}>
                    <i className="bi bi-stop-fill"></i>
                  </button>
                )}
                {timerState === "中断中" && (
                  <button className="btn btn-primary btn-lg" onClick={withBusy(async () => { await unlockAudio(); await handleContinue(); })}>
                    <i className="bi bi-play-fill"></i>
                  </button>
                )}
                <button className="btn btn-info btn-lg" onClick={withBusy(handleFinish)}>
                  <i className="bi bi-save"></i>
                </button>
                <DeleteTimer token={token} record={record} settimerchange={settimerchange} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TimerControl;
