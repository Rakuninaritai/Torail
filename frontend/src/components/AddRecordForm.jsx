import React, { useEffect, useState } from 'react'
import AddSubjectForm from './AddSubjectForm'
import AddTaskForm from './AddTaskForm'

function AddRecordForm({token,onRecordAdded,selectSub,selectSubName,sencha,sub,subname}) {
  // formdata(送るデータ)のusestate
  const [formData,setFormData]=useState({
    subject:"",
    task:"",
    // language:"",
    // date:"",
    // description:"",
    // duration:"",
  })
  // 選択肢のある奴のusestate
  const [subjects,setSubjects]=useState([])
  const [tasks,setTasks]=useState([])
  // const [languages,setLanguages]=useState([])
  // 教科
  const [filteredTasks,setFilteredTasks]=useState([])

  // データ取得(第二が[]につきレンダリング時のみ実行)
  useEffect(()=>{
    // subjectsのデータを取得し
    fetch("http://127.0.0.1:8000/api/subjects/",{
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${token}`
      }
    })
    // 取得出来たらresとして受け取りjson化
    .then((res)=>res.json())
    // json化したのをdataとしてsetsubjectsに入れる
    .then((data)=>setSubjects(data))
    // エラーが起きたらcatchにくる
    .catch((err)=>console.error(err))

    // task
    fetch("http://127.0.0.1:8000/api/tasks/",{
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${token}`
      }
    })
    .then((res)=>res.json())
    .then((data)=>setTasks(data))
    .catch((err)=>console.error(err))

    // 言語
    fetch("http://127.0.0.1:8000/api/languages/",{
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${token}`
      }
    })
    .then((res)=>res.json())
    // .then((data)=>setLanguages(data))
    .catch((err)=>console.error(err))
  },[])

  // 値が変わったら更新する
  const handleChange=(e)=>{
    setFormData({...formData,[e.target.name]:e.target.value})
  }
  // formdataのsubjectが変わったら課題を更新する
  useEffect(()=>{
    // 教科に値が入っているなら(id)
    if(formData.subject){
      selectSub(formData.subject)
      const Ssname=subjects.filter(sub=>sub.id===formData.subject)
      selectSubName(Ssname[0].name)
      // 引っ張ってきたtaskそれぞれのsubjectと今回のsubjectが一致するもののみfilteredに入れる
      console.log(Ssname)
      const filtered = tasks.filter(task => task.subject === formData.subject)
      // それらを選択肢とする
      setFilteredTasks(filtered)
    } else {
      setFilteredTasks([])
    }
  },[formData.subject,tasks])

  // 送信ボタン押されたら
  const handleSubmit=(e)=>{
    // ページがreloadして送信をデフォルトではしようとするがそれをキャンセルしている
    e.preventDefault();
    // 現時刻を取得してnow格納
    const now=new Date().toISOString()
    // 送るデータにformとstart時刻を追加する
    const recordData={
      ...formData,
      start_time:now
    }
    // postで送る
    fetch("http://127.0.0.1:8000/api/records/",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization": `Token ${token}`
      },
      body:JSON.stringify(recordData),
    })
    .then((response)=>response.text())
    .then((data)=>{
      console.log("学習記録が追加されました",data)
      onRecordAdded();//呼び出してる、Appの更新状態用stateを反転させる関数を(appで反転するとリスと再読み込みさせてる)
    })
    .catch((error)=>console.log("Error adding record:",error))
  }
  return (
    <div className="timer-card mx-auto">
      <form onSubmit={handleSubmit}>
        <label htmlFor="subject" className="form-label">教科</label>
        <select className='form-control mb-3' name='subject' value={formData.subject} onChange={handleChange} required>
          <option value="">選択してください</option>
          {/* usestateのsubjectsをmap関数で1つをsubとして回す */}
          {subjects.map((sub)=>(
            <option key={sub.id} value={sub.id}>{sub.name}</option>
          ))}
        </select>
         {/* モーダルを開くボタン */}
         <button
          type="button"
          className="btn btn-outline-secondary me-2"
          data-bs-toggle="modal"
          data-bs-target="#addSubjectModal"
        >
          新しい教科を追加
        </button>
        <hr />
        <label htmlFor="task" className="form-label">課題</label>
        <select  className='form-control mb-3' name='task' value={formData.task} onChange={handleChange} required>
          <option value="">選択してください</option>
          {filteredTasks.map((task)=>(
            <option key={task.id} value={task.id}>{task.name}</option>
          ))}
        </select>
        {/* モーダルを開くボタン */}
        <button
          type="button"
          className="btn btn-outline-secondary me-2"
          data-bs-toggle="modal"
          data-bs-target="#addTaskModal"
        >
          新しい課題を追加
        </button>
        <div className="d-flex justify-content-center gap-3 mt-3">
          <button id="startBtn"  type='submit' className="btn btn-primary btn-lg"><i className="bi bi-play-fill"></i></button>
        </div>
      </form>

      {/* モーダル本体 */}
      <div
        className="modal fade"
        id="addSubjectModal"
        tabIndex={-1}
        aria-labelledby="addSubjectModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="addSubjectModalLabel">教科を追加</h5>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              {/* モーダル内では独立したフォームを使う */}
              <AddSubjectForm token={token} changes={sencha}/>

            </div>
          </div>
        </div>
      </div>

      {/* モーダル本体 */}
      <div
        className="modal fade"
        id="addTaskModal"
        tabIndex={-1}
        aria-labelledby="addTaskModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="addTaskModalLabel">課題を追加</h5>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              {/* モーダル内では独立したフォームを使う */}
              <AddTaskForm token={token} changes={sencha} sub={sub} subname={subname} key={sub}/>

            </div>
          </div>
        </div>
      </div>
        
    </div>
    
     
  )
}

export default AddRecordForm