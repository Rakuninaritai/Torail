import React, {  useState } from 'react'

const AddTaskForm = ({token,changes,sub,subname}) => {
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
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
  const handleSubmit=(e)=>{
    // ページがreloadして送信をデフォルトではしようとするがそれをキャンセルしている
    e.preventDefault();
    // postで送る
    fetch(`${API_BASE}tasks/`,{
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
      <p>課題を追加する教科:{subname}</p>
      <input type='text' name='name' placeholder='課題'  className='form-control mb-3' value={formData.name} onChange={handleChange}  />
      <div className="d-flex justify-content-center gap-3 mt-3">
        {subname?(<button type='submit'  className="btn btn-dark btn-lg" data-bs-dismiss="modal"  >追加</button>):("")}
      </div>
    </form>
  )
}

export default AddTaskForm