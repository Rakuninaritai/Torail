// import React, { useEffect, useState} from 'react'
// import AddRecordForm from '../components/AddRecords/AddRecordForm'
// import AddSubjectForm from '../components/AddRecords/AddSubjectForm'
// import AddTaskForm from '../components/AddRecords/AddTaskForm'
// import TimerContorl from '../components/AddRecords/TimerContorl'
// import { api } from "../api";
// import { useTeam } from '../context/TeamContext';
// import Skeleton from 'react-loading-skeleton';
// import 'react-loading-skeleton/dist/skeleton.css';

// const AddRecords= ({token,onRecordAdded,updateFlag}) => {
//   document.title="Torail|測定"
//   // Vite のケース
//   const API_BASE = import.meta.env.VITE_API_BASE_URL
//   const { currentTeamId } = useTeam();
//   // 追加されたら選択肢変更用state
//   const [Change,setChange]=useState(false)
//   const [SelectSubject,SetSelectSubject]=useState("")
//   const [SelectSubjectName,SetSelectSubjectName]=useState("")
//   const [TimerChange,setTimerChange]=useState(false)
//   const [OtherAddNow,setOtherAddnow]=useState("")
//   // エラー表示などのmessagestate
//   const [errors,setErrors]=useState("")
//   const [isLoading, setLoading] = useState(false);
//   const SentakuChange =()=>{
//     setChange(!Change)
//   }
//   // timerの中断等管理用state(これタイコンに渡してるんで値変わるとタイマー再取得のタイマーも再度レンダリング)
//   const Timer_State_Change=()=>{
//     setTimerChange(!TimerChange)
//     // console.log("timerchange!!")
//   }
//   // 今計測中のレコードを格納用のstate
//   const [runningRecord,setRunningRecord]=useState()
//   // 計測中のレコードを取得(appのレコード作成管理用のstateのsetを引っ張って状態更新してるんでそのstateを持ってきて状態管理)
//   useEffect(() => {
//     let ignore=false; const ac=new AbortController();
//     (async () => {
//       setLoading(true);
//       try{
//         // 単発フェッチ（全レコード）→ 自分＆未完了で絞る
//         const all = await api(`/records/`, { method:'GET', signal: ac.signal });
//         // 当該ユーザーで未完了に絞る
//         const allMine = (all ?? []).filter(r => r.user?.id === token.pk && r.timer_state !== 2);

//         // チーム一致（null 同士一致を含む）はフロントで判定
//         // toidで数値化オブジェクトかを吸収してidかする
//         const toId = v => (v && typeof v === 'object') ? (v.id ?? null) : v ?? null;
//         // 今のチームをidに
//         const curTeam = toId(currentTeamId);
//         // チームが一致するかの判定(null同氏も一致)
//         const teamMatch = r => {
//           const rTeam = toId(r.team);
//           return (rTeam === curTeam) || (!rTeam && !curTeam);
//         };
//         const running = allMine.filter(teamMatch);
//         if(!ignore){
//           // 別チーム(または個人)で走ってる時の注意文
//           setOtherAddnow(allMine.length>0 && running.length===0 ? "ほかのチームまたは個人であなたは計測中です。" : "");
//           setRunningRecord(running); // この時点で team フィルタ済み
//         }
//       } catch(e){
//      if(!ignore){
//        // Abort は正常キャンセルなので無視
//        if (e?.name !== 'AbortError') setErrors(e);
//      }}
//       finally { if(!ignore) setLoading(false); }
//     })();
    
//     return ()=>{ ignore=true; ac.abort(); };
    
//   }, [token, updateFlag, TimerChange, currentTeamId]);
//   // const toId = v => (v && typeof v === 'object') ? (v.id ?? null) : v ?? null;
//     // const scopedRunning = (runningRecord ?? []).filter(r => {
//     // const rTeam = toId(r.team);
//     // const cur    = toId(currentTeamId);
//     // const teamMatch = (rTeam === cur) || (!rTeam && !cur);
//     // return teamMatch && r.user.id === token.pk && r.timer_state !== 2;
//     // });
//   return (
//     <div id='record'>
//       <h1><i className="bi bi-clock"></i> 測定</h1>
//       {isLoading?(<div className="timer-card mx-auto"><Skeleton/></div>):(<>{OtherAddNow?(<div className="timer-card mx-auto">{OtherAddNow}</div>):runningRecord > 0 ?(<TimerContorl token={token} records={runningRecord}  settimerchange={Timer_State_Change}/>):(
//         <div>
//           {/* データ取得時エラー */}
//           {errors.detail && (
//             <div className="text-danger mt-1">
//               <div>{errors.detail}</div>
//             </div>
//           )}
//           {/* フィールド全体エラーいらん */}
//           {/* {errors.non_field_errors && (
//             <div className="text-danger mt-1">
//               {errors.non_field_errors.map((msg, i) => (
//                 <div key={i}>{msg}</div>
//               ))}
//             </div>
//           )} */}
//           <AddRecordForm token={token} onRecordAdded={onRecordAdded} selectSub={SetSelectSubject} selectSubName={SetSelectSubjectName} key={Change} sencha={SentakuChange} sub={SelectSubject} subname={SelectSubjectName} />
//         </div>
//       )}</>)}
      
//     </div>
//   )
// }

// export default AddRecords
// src/pages/AddRecords.jsx
import React, { useEffect, useState } from 'react'
import AddRecordForm from '../components/AddRecords/AddRecordForm'
import TimerContorl from '../components/AddRecords/TimerContorl'
import { apiRaw } from "../api";                 // ★ 追加：statusが取れるヘルパ
import { useTeam } from '../context/TeamContext'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

const AddRecords = ({ token, onRecordAdded, updateFlag }) => {
  document.title = "Torail|測定"
  const { currentTeamId } = useTeam()
  
  // ★ “他スコープで稼働中”メッセージ
  const [otherMsg, setOtherMsg] = useState("")
  // ★ “このスコープ（今のチーム or 個人）での稼働レコード”
  const [runningRecord, setRunningRecord] = useState(null)
  const [errors, setErrors] = useState(null)
  const [isLoading, setLoading] = useState(false)
  const [TimerChange, setTimerChange] = useState(false)
  const [Change,setChange]=useState(false)
  const [SelectSubject,SetSelectSubject]=useState("")
  const [SelectSubjectName,SetSelectSubjectName]=useState("")
  const SentakuChange =()=>{
    setChange(!Change)
  }

  // ★ object/uuid/null → uuid/null を取り出す小ユーティリティ（既存と同等）
  const normalizeTeamId = (v) => {
   if (v === undefined || v === null) return null;   // 個人は null
   if (typeof v === 'object') return v.id ?? null;   // objectならid
   if (typeof v === 'string' && v.trim() === '') return ''; // 空文字は空文字
   return v; // uuidなど
 };
 const teamEquals = (a, b) => normalizeTeamId(a) === normalizeTeamId(b);

  // ★ トグル（TimerControl から呼ばれて再取得）
  const Timer_State_Change = () => setTimerChange(v => !v)

  useEffect(() => {
    let ignore = false
    const run = async () => {
      setLoading(true)
      setErrors(null)
      setOtherMsg("")
      setRunningRecord(null)

      try {
        // 1) ★ グローバルで今走ってるものを1件だけ取得
        //    GET /api/records/active/
        const { status, data } = await apiRaw(`/records/active/`, { method: 'GET' })

        if (ignore) return
        console.log('active status/data:', status, data, 'currentTeamId:', currentTeamId, 'token.pk:', token.pk)
        // 2) ★ 何も走ってない → フォーム表示へ（runningRecord=null のまま）
        if (status === 204) {
          setOtherMsg("")
          setRunningRecord(null)
          return
        }

        // 3) ★ 走っている → スコープ一致を判定
        //    - 一致：TimerContorlを表示（runningRecordにセット）
        //    - 不一致：フォームは隠し、“他スコープで実行中”メッセージだけ出す
        if (status === 200 && data) {
        const rec = data
        const MY_ID = token?.pk ?? token?.id ?? token?.user?.id ?? null; // ★ 追加
        if (MY_ID && rec.user?.id !== MY_ID) {
            // （想定外）念のため本人限定
            setOtherMsg("")
            setRunningRecord(null)
            return
          }
          if (teamEquals(rec.team, currentTeamId)) {
            // ★ このスコープの稼働 → タイマーを出す
            setRunningRecord(rec)
            setOtherMsg("")
          } else {
            // ★ 別スコープ（個人/他チーム）で稼働中
            setRunningRecord(null)
            setOtherMsg("ほかのチームまたは個人であなたは計測中です。")
          }
          return
        }

        // 4) ★ それ以外（エラー系）
        setErrors({ detail: `active取得に失敗（${status}）` })
      } catch (e) {
        if (!ignore) setErrors(e)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    run()
    return () => { ignore = true }
  }, [token, currentTeamId, updateFlag, TimerChange])   // ★ 依存関係は従来と同等

  return (
    <div id='record'>
      <h1><i className="bi bi-clock"></i> 測定</h1>

      {isLoading ? (
        <div className="timer-card mx-auto"><Skeleton /></div>
      ) : (
        <>
          {/* ★ 他スコープ警告（フォームは出さずにメッセージのみ） */}
          {otherMsg ? (
            <div className="timer-card mx-auto">{otherMsg}</div>
          ) : runningRecord ? (
            // ★ このスコープで稼働中 → タイマー表示
            <TimerContorl
              token={token}
              // 互換のため配列形式で渡してもOKだが、TimerContorl側が単体でも読めるなら単体で渡しても良い
              records={runningRecord}                      // ★ ここだけ変わる
              settimerchange={Timer_State_Change}
            />
          ) : (
            // ★ 何も走っていない → 新規作成フォーム
            <div>
              {errors?.detail && <div className="text-danger mt-1">{errors.detail}</div>}
              <AddRecordForm
                token={token}
                onRecordAdded={onRecordAdded}
                selectSub={SetSelectSubject} selectSubName={SetSelectSubjectName} key={Change} sencha={SentakuChange} sub={SelectSubject} subname={SelectSubjectName}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default AddRecords
