import React, { useState } from 'react'

const AddSubjectForm = ({token,changes}) => {
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const [formData,setFormData]=useState({
    name:"",
  })
  const handleChange=(e)=>{
    setFormData({...formData,[e.target.name]:e.target.value})
  }
  // 送信ボタン押されたら
  const handleSubmit=(e)=>{
    // ページがreloadして送信をデフォルトではしようとするがそれをキャンセルしている
    e.preventDefault();
    // postで送る
    fetch(`${API_BASE}subjects/`,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization": `Token ${token}`
      },
      body:JSON.stringify(formData),
    })
    .then((response)=>response.text())
    .then((data)=>{
      console.log("学習記録が追加されました",data)
      // onRecordAdded();//呼び出してる、Appの更新状態用stateを反転させる関数を(appで反転するとリスと再読み込みさせてる)
      changes()
    })
    .catch((error)=>console.log("Error adding record:",error))
  }
  return (
    <form onSubmit={handleSubmit}>
      <input type='text' name='name' placeholder='教科' className='form-control mb-3' value={formData.name} onChange={handleChange}  />
      <div className="d-flex justify-content-center gap-3 mt-3">
          <button type='submit'  className="btn btn-dark btn-lg" data-bs-dismiss="modal"  >追加</button>
      </div>
      
    </form>
    
  )
}

export default AddSubjectForm