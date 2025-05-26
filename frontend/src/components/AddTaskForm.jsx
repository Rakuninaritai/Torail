import React, {  useState } from 'react'
import { api } from "../api";

const AddTaskForm = ({token,changes,sub,subname}) => {
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
  const [formData,setFormData]=useState({
      subject:sub,
      name:"",
  })
  // const [subjects,setSubjects]=useState([])
  const handleChange=(e)=>{
    setFormData({...formData,[e.target.name]:e.target.value})
  }
  // useEffect(()=>{
  //   // subjectsのデータを取得し
  //   fetch("http://127.0.0.1:8000/api/subjects/",{
  //     headers: {
  //       "Content-Type": "application/json",
  //       "Authorization": `Token ${token}`
  //     }
  //   })
  //   // 取得出来たらresとして受け取りjson化
  //   .then((res)=>res.json())
  //   // json化したのをdataとしてsetsubjectsに入れる
  //   .then((data)=>setSubjects(data))
  //   // エラーが起きたらcatchにくる
  //   .catch((err)=>console.error(err))
  // },[])
  // 送信ボタン押されたら
  const handleSubmit=async (e)=>{
    // ページがreloadして送信をデフォルトではしようとするがそれをキャンセルしている
    e.preventDefault();
    // postで送る
    try{
        const data=await api('/tasks/',{
          method: 'POST',
          body:JSON.stringify(formData),
        })
        console.log("課題が追加されました",data)
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
      {errors.subject && (
        <div className="text-danger mt-1">
          {errors.subject.map((msg, i) => (
            <div key={i}>{msg}</div>
          ))}
      </div>)}
      <p>課題を追加する教科:{subname}</p>
      {errors.name && (
        <div className="text-danger mt-1">
          {errors.name.map((msg, i) => (
            <div key={i}>{msg}</div>
          ))}
      </div>)}
      <input type='text' name='name' placeholder='課題'  className='form-control mb-3' value={formData.name} onChange={handleChange}  />
      <div className="d-flex justify-content-center gap-3 mt-3">
        {subname?(<button type='submit'  className="btn btn-dark btn-lg" data-bs-dismiss="modal"  >追加</button>):("")}
      </div>
    </form>
  )
}

export default AddTaskForm