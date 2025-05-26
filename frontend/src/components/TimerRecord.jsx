import React, { useEffect, useState } from 'react'
import SectoMin from './SectoMin'
import DeleteTimer from './DeleteTimer'
import { api } from "../api";

// タイマー終了後記録を保存するコンポーネント(確定させる?)
const TimerRecord = ({token,record,settimerchange}) => {
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  // formdata(送るデータ)のusestate
  const [formData,setFormData]=useState({
    language:"",
    description:"",
  })
  // 選択肢のある奴のusestate
  const [languages,setLanguages]=useState([])
  // データ取得(選択肢の)(第二が[]につきレンダリング時のみ実行)
  useEffect(()=>{
    // 言語
    const shutoku = async ()=>{
      try{
        const data=await api('/languages/',{
          method: 'GET',
        })
        setLanguages(data)
        
      }catch (err) {
        console.error(err);
        setErrors(err)
      }
        
    }
   shutoku()
    
  },[])
  // 値が変わったら更新する
  const handleChange=(e)=>{
    setFormData({...formData,[e.target.name]:e.target.value})
  }
  // 送信ボタン押されたら
  const handleSubmit=async(e)=>{
    // ページがreloadして送信をデフォルトではしようとするがそれをキャンセルしている
    e.preventDefault();
    // 送るデータにformとデータ入力日と終了のstate2を追加する
    const recordData={
      ...formData,
      date:new Date().toISOString(),
      timer_state:2,
    }
    // 更新
    try{
        const data=await api(`/records/${record.id}/`,{
        method: 'PATCH',
        body:JSON.stringify(recordData),
        })
        console.log("レコード更新しました",data)
        settimerchange()
    }catch(err){
          console.error(err);
          setErrors(err)
          }
  }
  return (
    <div>
       <div>
          <h5>教科 : <span className=''>{record.subject.name}</span></h5>
          <h5>課題 : {record.task.name}</h5>
          <h5>ユーザー : {record.user.username}</h5>
          <SectoMin times={record.duration/1000}/>
        </div>
      <form onSubmit={handleSubmit}>
        <h2>学習記録を追加</h2>
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
        <label htmlFor="language" className="form-label">言語</label>
        {errors.language && (
        <div className="text-danger mt-1">
          {errors.language.map((msg, i) => (
            <div key={i}>{msg}</div>
          ))}
      </div>)}
        <select  className='form-control mb-3' name='language' value={formData.language} onChange={handleChange} required>
          <option value="">選択してください</option>
          {languages.map((lang)=>(
              <option key={lang.id} value={lang.id}>{lang.name}</option>
            ))}
        </select>
        <label htmlFor="description" className="form-label">説明</label>
        {errors.description && (
        <div className="text-danger mt-1">
          {errors.description.map((msg, i) => (
            <div key={i}>{msg}</div>
          ))}
      </div>)}
        <textarea name='description' placeholder='学習の詳細'  className='form-control mb-3' value={formData.description} onChange={handleChange}  />
        <div className="d-flex justify-content-center gap-3 mt-3">
            {/* ── 保存ボタン ───────────────────── */}
            <button className="btn btn-info btn-lg" type='sumit'>
              <i className="bi bi-save"></i>
            </button>
            {/* {btnLabelState} */}
            <DeleteTimer token={token} record={record} settimerchange={settimerchange}/>
          </div>
      </form>
    </div>
  )
}

export default TimerRecord