import React, { useState } from 'react'
import { api } from "../api";
const AddSubjectForm = ({token,changes}) => {
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const [formData,setFormData]=useState({
    name:"",
  })
  const handleChange=(e)=>{
    setFormData({...formData,[e.target.name]:e.target.value})
  }
  // 送信ボタン押されたら
  const handleSubmit=async (e)=>{
    // ページがreloadして送信をデフォルトではしようとするがそれをキャンセルしている
    e.preventDefault();
    
    // postで送る
    try{
        const data=await api('/subjects/',{
          method: 'POST',
          body:JSON.stringify(formData),
        })
        console.log("教科が追加されました",data)
        changes()
    }catch(err){
      console.error(err);
      setErrors(err)
    }
    
  }
  return (
    <form onSubmit={handleSubmit}>
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
        {errors.name && (
        <div className="text-danger mt-1">
          {errors.name.map((msg, i) => (
            <div key={i}>{msg}</div>
          ))}
      </div>)}
      <input type='text' name='name' placeholder='教科' className='form-control mb-3' value={formData.name} onChange={handleChange}  />
      <div className="d-flex justify-content-center gap-3 mt-3">
          <button type='submit'  className="btn btn-dark btn-lg" data-bs-dismiss="modal"  >追加</button>
      </div>
      
    </form>
    
  )
}

export default AddSubjectForm