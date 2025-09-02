import React, { useEffect, useState} from 'react'
import AddRecordForm from '../components/AddRecordForm'
import AddSubjectForm from '../components/AddSubjectForm'
import AddTaskForm from '../components/AddTaskForm'
import TimerContorl from '../components/TimerContorl'
import { api } from "../api";
import { useTeam } from '../context/TeamContext';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const AddRecords= ({token,onRecordAdded,updateFlag}) => {
  document.title="Torail|測定"
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const { currentTeamId } = useTeam();
  // 追加されたら選択肢変更用state
  const [Change,setChange]=useState(false)
  const [SelectSubject,SetSelectSubject]=useState("")
  const [SelectSubjectName,SetSelectSubjectName]=useState("")
  const [TimerChange,setTimerChange]=useState(false)
  const [OtherAddNow,setOtherAddnow]=useState("")
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
  const [isLoading, setLoading] = useState(false);
  const SentakuChange =()=>{
    setChange(!Change)
  }
  // timerの中断等管理用state(これタイコンに渡してるんで値変わるとタイマー再取得のタイマーも再度レンダリング)
  const Timer_State_Change=()=>{
    setTimerChange(!TimerChange)
    // console.log("timerchange!!")
  }
  // 今計測中のレコードを格納用のstate
  const [runningRecord,setRunningRecord]=useState()
  // 計測中のレコードを取得(appのレコード作成管理用のstateのsetを引っ張って状態更新してるんでそのstateを持ってきて状態管理)
  useEffect(() => {
    let ignore=false; const ac=new AbortController();
    (async () => {
      setLoading(true);
      try{
        const teamParam = currentTeamId ? `?team=${currentTeamId}` : `?team=null`;
        // ← 同時に取得してレースを減らす
        const [all, ss] = await Promise.all([
          api(`/records/`, { method:'GET', signal: ac.signal }),
          api(`/records/${teamParam}`, { method:'GET', signal: ac.signal })
        ]);
        const allMine = all.filter(r => r.timer_state !== 2 && r.user.id === token.pk);
        const running = ss.filter(r => r.timer_state !== 2 && r.user.id === token.pk);
        if(!ignore){
          setOtherAddnow(allMine.length>0 && running.length===0 ? "ほかのチームまたは個人であなたは計測中です。" : "");
          setRunningRecord(running);           // ★ クリアしない
        }
      } catch(e){ if(!ignore) setErrors(e); }
      finally { if(!ignore) setLoading(false); }
    })();
    
    return ()=>{ ignore=true; ac.abort(); };
    
  }, [token, updateFlag, TimerChange, currentTeamId]);
  const toId = v => (v && typeof v === 'object') ? (v.id ?? null) : v ?? null;
    const scopedRunning = (runningRecord ?? []).filter(r => {
    const rTeam = toId(r.team);
    const cur    = toId(currentTeamId);
    const teamMatch = (rTeam === cur) || (!rTeam && !cur);
    return teamMatch && r.user.id === token.pk && r.timer_state !== 2;
    });
  return (
    <div id='record'>
      <h1><i className="bi bi-clock"></i> 測定</h1>
      {isLoading?(<div className="timer-card mx-auto"><Skeleton/></div>):(<>{OtherAddNow?(<div className="timer-card mx-auto">{OtherAddNow}</div>):scopedRunning.length > 0 ?(<TimerContorl token={token} records={scopedRunning}  settimerchange={Timer_State_Change}/>):(
        <div>
          {/* データ取得時エラー */}
          {errors.detail && (
            <div className="text-danger mt-1">
              <div>{errors.detail}</div>
            </div>
          )}
          {/* フィールド全体エラーいらん */}
          {/* {errors.non_field_errors && (
            <div className="text-danger mt-1">
              {errors.non_field_errors.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          )} */}
          <AddRecordForm token={token} onRecordAdded={onRecordAdded} selectSub={SetSelectSubject} selectSubName={SetSelectSubjectName} key={Change} sencha={SentakuChange} sub={SelectSubject} subname={SelectSubjectName} />
        </div>
      )}</>)}
      
    </div>
  )
}

export default AddRecords