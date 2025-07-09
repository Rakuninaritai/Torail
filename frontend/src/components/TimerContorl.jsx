import React, { useEffect, useRef, useState } from 'react'
import TimerRecord from './TimerRecord'
import DeleteTimer from './DeleteTimer'
import SectoMin from './SectoMin'
import { api } from "../api";
import { useTeam } from '../context/TeamContext';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';
// チーム対応済

// タイマーコンポーネント(計測やストップ)
// ユーザーtokenやタイマーのレコードやタイマーの状態が変化したとき用のstateを持つ
const TimerContorl = ({token,records,settimerchange}) => {
  const [isLoading, setLoading] = useState(false);
  const { currentTeamId } = useTeam();
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  // タイマの動作のstate
  // 実行中のレコードを取り出し
  const record=records.find(rec=>rec.user.id==token.pk)
  
  // 経過時間取り出し(中断していたらその数字、していないなら0)
  const inialElaapsed=record.duration? record.duration:0
  // console.log(inialElaapsed)
  const subtr=record.stop_time?new Date(record.stop_time):new Date(record.start_time)
  // console.log(subtr)
  // タイマー計測はstateが0なら(今の時刻-starttime or stop_timeが存在していれば今の時刻-stop_time)
  // stateが2ならaddコンポネが出る
  // 中断時は経過時間を保存と、endtimeを保存(言うまでもなく終わっていないが中断から終了された時の為に保存しておく、中断していることは保存してるstateで管理してる)してstateを1に
  // 再開時はstoptimeを今の時刻にしstoptimeとの差分+経過時間をとりstateを0に
  // 終了時は時刻をendtimeに格納しstateを3に経過時間を保存と登録し終えたら2になる
  // 時間用state
  const [time,setTime]=useState(0)
  // timer_state表示用state
  const [timerState,setTimerState]=useState()
  // btnのラベル用state(今のタイマーの逆)
  const [btnLabelState,setBtnLabelState]=useState()
  // timerid保持用ref(refはコンポーネント再レンダリングでも値保持)
  const timerIdRef=useRef(null)
  useEffect(()=>{
    setLoading(true)
    // console.log(token)
    // 実行中の場合
    record.timer_state===0&&(
      setTimerState("実行中"),
      setBtnLabelState(<button id="stopBtn" className="btn btn-secondary btn-lg"  onClick={handleSusupend} ><i className="bi bi-stop-fill"   ></i></button>),
      timerIdRef.current=setInterval(()=>{
        setTime(Math.floor(((new Date() - subtr) / 1000)+(inialElaapsed/1000)))
        document.title=`${record.task.name}:${(Math.floor((((new Date() - subtr) / 1000)+(inialElaapsed/1000))/60))}分${(Math.floor((((new Date() - subtr) / 1000)+(inialElaapsed/1000))%60))}秒`
      },1000)
    )
    // 中断中の場合
    record.timer_state===1&&(
      setTimerState("中断中"),
      setBtnLabelState(<button id="startBtn" className="btn btn-primary btn-lg" onClick={handleContinue} ><i className="bi bi-play-fill"></i></button>)
      ,setTime(inialElaapsed/1000)
    )
    // 保存中の場合
    record.timer_state===3&&(
      setTimerState("保存中")
    )
    setLoading(false)
  // コンポーネントがアンマウントされるときにタイマーをクリア
  return () => {
    clearInterval(timerIdRef.current);
  };
  },[record,currentTeamId])
  
  // 中断ボタン押下時関数
  const handleSusupend=async()=>{
    setLoading(true)
    // console.log("押してすぐのtime")
    // console.log(time)
    const updateData={
      // 今の時間を経過時間として保存
      duration:time*1000,
      // end時間として今の時刻を
      end_time:new Date().toISOString(),
      // timerのstateを中断中とする
      timer_state:1,
    }
    // console.log("今のタイム↓")
    // console.log(time)
     // PATCH リクエストを使って、既存のレコードを更新する
     try{
         const data=await api(`/records/${record.id}/`,{
         method: 'PATCH',
         body:JSON.stringify(updateData),
         })
        //  console.log("レコード更新しました",data)
        toast.success("タイマーを中断しました!")
        setLoading(false)
        clearInterval(timerIdRef.current);
        settimerchange()
      }catch(err){
          //  console.error(err);
          toast.error("タイマー中断に失敗しました。")
          setLoading(false)
          setErrors(err)
      }
  }


  
  // 再開ボタン押下時関数
  const handleContinue=async()=>{
    setLoading(true)
    const updateData={
      // stop時間として今の時刻を
      stop_time:new Date().toISOString(),
      // timerのstateを実行中とする
      timer_state:0,
    }
     // PATCH リクエストを使って、既存のレコードを更新する
     try{
         const data=await api(`/records/${record.id}/`,{
         method: 'PATCH',
         body:JSON.stringify(updateData),
         })
        //  console.log("レコード更新しました",data)
         toast.success("タイマーが再開しました!")
         setLoading(false)
         clearInterval(timerIdRef.current);
        settimerchange()
      }catch(err){
          //  console.error(err);
          toast.error("タイマーの再開に失敗しました。")
          setLoading(false)
          setErrors(err)
      }
  }
  // btnIF
  // const handleClick=()=>{
  //   if(timerState==="実行中"){
  //     handleSusupend()
  //   }
  //   if(timerState==="中断中"){
  //     handleContinue()
  //   }
  // }
// 終了ボタン押下時関数
const handleFnish=async()=>{
  // 確認ダイアログ
  const result=window.confirm("本当に終了してもよいですか。")
  // ダイアログがtrueなら
  if (result){
    setLoading(true)
    // 中断中なら終了時刻が入っているのでそのままそれ保存(意味ない)で、じゃなければ今の時刻にする
    const endtime=timerState==="中断中"?new Date(record.end_time):new Date().toISOString()
    
    const updateData={
      // 今の時間を経過時間として保存
      duration:time*1000,
      // end時間として上でやった時刻を
      end_time:endtime,
      // timerのstateを保存中とする
      timer_state:3,
    }
    // PATCH リクエストを使って、既存のレコードを更新する
    try{
         const data=await api(`/records/${record.id}/`,{
         method: 'PATCH',
         body:JSON.stringify(updateData),
         })
        //  console.log("レコード更新しました",data)
        toast.success("タイマーが停止しました!")
        setLoading(false)
        clearInterval(timerIdRef.current);
        settimerchange()
      }catch(err){
          //  console.error(err);
          toast.error("タイマーの更新に失敗しました。")
          setLoading(false)
          setErrors(err)
      }
  }
}

  return (
    <div className="timer-card mx-auto">
      {record.timer_state===3?(<TimerRecord token={token} record={record} settimerchange={settimerchange}  />):(
        <div>
          {/* 送信エラー */}
          {errors.detail && (
            <div className="text-danger mt-1">
              <div>{errors.detail}</div>
            </div>
          )}
          {/* ── フォーム全体エラー(non_field_errors) ── */}
          {errors.non_field_errors && (
            <div className="alert alert-danger">
              {errors.non_field_errors.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>)}
          {isLoading?<Skeleton/>:(
            <>
              <h5>教科 : <span className=''>{record.subject.name}</span></h5>
              <h5>課題 : {record.task.name}</h5>
              <h5>ユーザー : {record.user.username}</h5>
              <SectoMin times={time}/>
              <div className="d-flex justify-content-center gap-3 mt-3">
                {timerState === "実行中" && (
                    <button id="stopBtn" className="btn btn-secondary btn-lg"  onClick={handleSusupend} >
                      <i className="bi bi-stop-fill"   ></i>
                    </button>)}
                {timerState === "中断中" && (
                    <button id="startBtn" className="btn btn-primary btn-lg" onClick={handleContinue} >
                      <i className="bi bi-play-fill"></i>
                    </button>)}
                {/* ── 保存ボタン ───────────────────── */}
                <button className="btn btn-info btn-lg"  onClick={handleFnish}>
                  <i className="bi bi-save"></i>
                </button>
                {/* {btnLabelState} */}
                <DeleteTimer token={token} record={record} settimerchange={settimerchange}/>
              </div>
              {/* {timerState} */}
            </>
          )}
          
        </div>
      )}
      
    </div>
  )
}

export default TimerContorl