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
    console.log("timerchange!!")
  }
  // 今計測中のレコードを格納用のstate
  const [runningRecord,setRunningRecord]=useState()
  // 計測中のレコードを取得(appのレコード作成管理用のstateのsetを引っ張って状態更新してるんでそのstateを持ってきて状態管理)
  useEffect(() => {
    const shutoku = async ()=>{
          setLoading(true)
          setRunningRecord([])
          try{
            // console.log(token)
            setOtherAddnow("")
            // const path = currentTeamId
            // ? `/records/?team=${currentTeamId}`
            // : '/records/';
            // const ss=await api(path,{
            //   method: 'GET',
            // })
            const aa=await api(`/records/`,{
              method: 'GET',
            })
            // console.log(ss)
            // 停止でないタイマーがあればallへ
            const all = aa.filter(record => record.timer_state!=2 );
            const running = all.filter(r => {
              const isMine = r.user.id === token.pk;
              if (currentTeamId) {
                return isMine && r.team === currentTeamId;
              } else {
                // r.team が null か undefined のみを許可する
                return isMine && (r.team === null || r.team === undefined);
              }
          });
            if(all.length>0&&running.length===0){
              setOtherAddnow("ほかのチームまたは個人であなたは計測中です。")
            }
            setLoading(false)
            setRunningRecord(running);
            // console.log(running)
            
          }catch (err) {
            // console.error(err);
            setErrors(err)
            setLoading(false)
          }
          
          
        }
        shutoku()

   
  }, [token,updateFlag,TimerChange,currentTeamId]);
  return (
    <div id='record'>
      <h1><i className="bi bi-clock"></i> 測定</h1>
      {isLoading?(<div className="timer-card mx-auto"><Skeleton/></div>):(<>{OtherAddNow?(<div className="timer-card mx-auto">{OtherAddNow}</div>):runningRecord && runningRecord.length > 0?(<TimerContorl token={token} records={runningRecord} key={runningRecord} settimerchange={Timer_State_Change}/>):(
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