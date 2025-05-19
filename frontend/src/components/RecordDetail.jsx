import React, { useEffect, useState } from 'react'
import DeleteTimer from './DeleteTimer'

const RecordDetail = ({cf,rec,token}) => {
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const [isEditing,setIsediting]=useState(false)
  const onEdit=()=>{
    setIsediting(!isEditing)
  }
  // フォーム内の値をローカル state に保持
  const [formData, setFormData] = useState({
    subject:    rec.subject.id,
    task:       rec.task.id,
    language:   rec.language.id,
    duration:      rec.duration,
    date:       rec.date,
    description:       rec.description,
  })
  // 値が変わったら更新する
  const handleChange=(e)=>{
    setFormData({...formData,[e.target.name]:e.target.value})
  }


  // 選択肢のある奴のusestate
  const [subjects,setSubjects]=useState([])
  const [tasks,setTasks]=useState([])
  const [languages,setLanguages]=useState([])
  // 教科
  const [filteredTasks,setFilteredTasks]=useState([])
  // データ取得(第二が[]につきレンダリング時のみ実行)
  useEffect(()=>{
    // subjectsのデータを取得し
    fetch(`${API_BASE}/subjects/`,{
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
    fetch(`${API_BASE}/tasks/`,{
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${token}`
      }
    })
    .then((res)=>res.json())
    .then((data)=>setTasks(data))
    .catch((err)=>console.error(err))

    // 言語
    fetch(`${API_BASE}/languages/`,{
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${token}`
      }
    })
    .then((res)=>res.json())
    .then((data)=>setLanguages(data))
    .catch((err)=>console.error(err))
  },[])
  // formdataのsubjectが変わったら課題を更新する
  useEffect(()=>{
    // 教科に値が入っているなら(id)
    if(formData.subject){
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
    
    // 送るデータにformとstart時刻を追加する
    const recordData={
      ...formData,
    }
    // postで送る
    fetch(`${API_BASE}/records/${rec.id}/`,{
      method:"PATCH",
      headers:{
        "Content-Type":"application/json",
        "Authorization": `Token ${token}`
      },
      body:JSON.stringify(recordData),
    })
    .then((response)=>response.text())
    .then((data)=>{
      console.log("学習記録が追加されました",data)
      cf(null)
    })
    .catch((error)=>console.log("Error adding record:",error))
  }
  return (
    <div className="detail-wrapper">
    <div className="record-card">
      <h2 className="mb-3">
        <i className="bi bi-journal-text" /> 学習記録 詳細
      </h2>
      <form id="recordForm" onSubmit={e => e.preventDefault()} >
        {/* 科目・課題・言語 */}
        <div className="row g-3 mb-3">
          <div className="col-md">
            <label className="form-label" htmlFor="subject">科目</label>
            <select className='form-control ' name='subject' value={formData.subject} onChange={handleChange} disabled={!isEditing}>
              <option value="">選択してください</option>
              {/* usestateのsubjectsをmap関数で1つをsubとして回す */}
              {subjects.map((sub)=>(
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>
          <div className="col-md">
            <label className="form-label" htmlFor="task">課題</label>
            <select  className='form-control ' name='task' value={formData.task} onChange={handleChange} disabled={!isEditing}>
              <option value="">選択してください</option>
              {filteredTasks.map((task)=>(
                <option key={task.id} value={task.id}>{task.name}</option>
              ))}
            </select>
          </div>
          <div className="col-md">
            <label className="form-label" htmlFor="language">言語</label>
            <select  className='form-control ' name='language' value={formData.language} onChange={handleChange} disabled={!isEditing}>
              <option value="">選択してください</option>
              {languages.map((task)=>(
                <option key={task.id} value={task.id}>{task.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 時間・日付・開始時刻 */}
        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <label className="form-label" htmlFor="hours">学習時間 (ミリ秒)</label>
            <input
              id="hours"
              name="duration"
              type="number"
              step="0.1"
              className="form-control"
              value={formData.duration }
              disabled={!isEditing}
              onChange={handleChange}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="date">日付</label>
            <input
              id="date"
              name="date"
              type="date"
              className="form-control"
              value={formData.date}
              disabled={!isEditing}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* メモ */}
        <div className="mb-3">
          <label className="form-label" htmlFor="memo">メモ</label>
          <textarea
            id="memo"
            name="description"
            rows="3"
            className="form-control"
            value={formData.description}
            disabled={!isEditing}
            onChange={handleChange}
          />
        </div>

        {/* アクションボタン */}
        <div className="d-flex gap-2 justify-content-end">
          {!isEditing ? (
            <>
            <button
              type="button"
              id="editBtn"
              className="btn btn-outline-primary"
              onClick={onEdit}
            >
              <i className="bi bi-pencil" /> 編集
            </button>
            <DeleteTimer token={token} record={rec} settimerchange={()=>{cf(null)}}/>
            <button
                type="button"
                id="cancelBtn"
                className="btn btn-secondary"
                onClick={()=>cf(null)}
              >
                キャンセル
              </button>
              </>
          ) : (
            <>
              <button
                type="submit"
                id="saveBtn"
                className="btn btn-success"
                onClick={handleSubmit}
              >
                <i className="bi bi-save" /> 保存
              </button>
              <DeleteTimer token={token} record={rec} settimerchange={()=>{cf(null)}}/>
              <button
                type="button"
                id="cancelBtn"
                className="btn btn-secondary"
                onClick={()=>cf(null)}
              >
                キャンセル
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  </div>
  )
}

export default RecordDetail