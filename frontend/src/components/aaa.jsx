import { api } from "../api";


// エラー表示などのmessagestate
const [errors,setErrors]=useState("")


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



  // postで送る
      try{
          const data=await api('/records/',{
            method: 'POST',
            body:JSON.stringify(recordData),
          })
          console.log("学習記録が追加されました",data)
          onRecordAdded();//呼び出してる、Appの更新状態用stateを反転させる関数を(appで反転するとリスと再読み込みさせてる)
      }catch(err){
        console.error(err);
        setErrors(err)
      }



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
{errors.username && (
  <div className="text-danger mt-1">
    {errors.username.map((msg, i) => (
      <div key={i}>{msg}</div>
    ))}
</div>)}