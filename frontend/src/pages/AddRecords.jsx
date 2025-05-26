import React, { useEffect, useState } from 'react'
import AddRecordForm from '../components/AddRecordForm'
import AddSubjectForm from '../components/AddSubjectForm'
import AddTaskForm from '../components/AddTaskForm'
import TimerContorl from '../components/TimerContorl'
import { api } from "../api";

const AddRecords= ({token,onRecordAdded,updateFlag}) => {
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  // 追加されたら選択肢変更用state
  const [Change,setChange]=useState(false)
  const [SelectSubject,SetSelectSubject]=useState("")
  const [SelectSubjectName,SetSelectSubjectName]=useState("")
  const [TimerChange,setTimerChange]=useState(false)
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
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
          try{
            const ss=await api('/records/',{
              method: 'GET',
            })
            const running = ss.filter(record => record.timer_state!=2 );
            setRunningRecord(running);
            console.log(running)
           
          }catch (err) {
            console.error(err);
            setErrors(err)
          }
            
        }
   shutoku()
  }, [token,updateFlag,TimerChange]);
  return (
    <div id='record'>
      <h1><i className="bi bi-clock"></i> 測定</h1>
      {runningRecord && runningRecord.length > 0?(<TimerContorl token={token} records={runningRecord} key={runningRecord} settimerchange={Timer_State_Change}/>):(
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
      )}
      
    </div>
  )
}

export default AddRecords