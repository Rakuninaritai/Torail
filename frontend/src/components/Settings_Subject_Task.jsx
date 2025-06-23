import React, { useEffect, useState } from 'react'
import { api } from "../api";

const Settings_Subject_Task = () => {
    const [formData_Sub, setFormData_Sub] = useState({id:'',name:'' });
    const [formData_Tsk, setFormData_Tsk] = useState({ id:'',name:'' });
    // 引っ張ってきたデータ(こいつがformdataと一緒なら送らない)
    const [initialSubject,setInitialSubject]=useState("")
    const [initialTask,setInitialTask]=useState("")
    const [subjects,setSubjects]=useState([])
    const [tasks,setTasks]=useState([])
    const [sousin,setSoushin]=useState(false)
    // 教科
    const [filteredTasks,setFilteredTasks]=useState([])
    // エラー表示などのmessagestate
    const [errors,setErrors]=useState("")
    useEffect(()=>{
      const shutoku = async ()=>{
                try{
                  const ss=await api('/subjects/',{
                      method: 'GET',
                    })
                    if (ss.length > 0) {
                      // 先頭の科目を初期選択に
                      setFormData_Sub({
                        id:   ss[0].id,
                        name: ss[0].name,
                        });
                      }
                    setSubjects(ss)
                    const st=await api('/tasks/',{
                      method: 'GET',
                    })
                    setTasks(st)
                }catch (err) {
                  console.error(err);
                  setErrors(err)
                }
                  
              }
              shutoku()
    },[sousin])
    // formdataのsubjectが変わったら課題を更新する
      useEffect(()=>{
        // 教科に値が入っているなら(id)
        if(formData_Sub.id){
          // formdataはidなので文字を持ちたいのでfilterかけて取得してる
          const Ssname=subjects.filter(sub=>sub.id===formData_Sub.id)
          // 評価用のこし
          setInitialSubject(Ssname[0].name)
          setFormData_Sub({...formData_Sub,name:Ssname[0].name})
          const filtered = tasks.filter(task => task.subject === formData_Sub.id)
          // それらを選択肢とする
          setFilteredTasks(filtered)
          // filteredTasks の先頭を task の初期値に
          if (filtered.length > 0) {
            setFormData_Tsk({
              id:   filtered[0].id,
              name: filtered[0].name,
            });
          }else{
            setFilteredTasks([])
            setFormData_Tsk({
                id:   '',
                name: '',
              });
          }
          console.log(filtered)
        } else {
          setFilteredTasks([])
          setFormData_Tsk({
              id:   '',
              name: '',
            });
        }
      },[formData_Sub.id,tasks,sousin])
    useEffect(()=>{
        // 教科に値が入っているなら(id)
        if(formData_Tsk.id){
          // formdataはidなので文字を持ちたいのでfilterかけて取得してる
          const Ssname=tasks.filter(sub=>sub.id===formData_Tsk.id)
          setInitialTask(Ssname[0].name)
          setFormData_Tsk({...formData_Tsk,name:Ssname[0].name})
        } 
      },[formData_Tsk.id,tasks])
    
    const handleChange_Sub=(e)=>{
      setFormData_Sub({...formData_Sub,[e.target.name]:e.target.value})
    }
    const handleChange_Tsk=(e)=>{
      setFormData_Tsk({...formData_Tsk,[e.target.name]:e.target.value})
    }
    const handleSubmit_Sub=async (e)=>{
      // ページがreloadして送信をデフォルトではしようとするがそれをキャンセルしている
      e.preventDefault();
      if(initialSubject===formData_Sub.name)return;
      // 送るデータ
      const recordData={
        ...formData_Sub,
      }
      // ここからやってくださいハンドルはそれぞれ分けてますあとはデリートも作ってください
      // 送る
      try{
          const data=await api(`/subjects/${formData_Sub.id}/`,{
          method: 'PATCH',
          body:JSON.stringify(recordData),
          })
          console.log("教科情報が更新されました",data)
          setSoushin(!sousin)
          }catch(err){
            console.error(err);
            setErrors(err)
          }
    }
    const handleDelete_Sub=async ()=>{
      // 確認ダイアログ
      const result=window.confirm("本当に削除してもよいですか。")
      if (result){
        // DELETE リクエストを使って、既存のレコードを削除する
        try{
            const data=await api(`/subjects/${formData_Sub.id}/`,{
            method: 'DELETE',
            })
            console.log("削除が完了しました。",data)
            setSoushin(!sousin)
            }catch(err){
              console.error(err);
              setErrors(err)
            }
      }
    }

    const handleSubmit_Tsk =async (e)=>{
      // ページがreloadして送信をデフォルトではしようとするがそれをキャンセルしている
      e.preventDefault();
      if(initialTask===formData_Tsk.name)return;
      // 送るデータ
      const recordData={
        ...formData_Tsk,
      }
      // 送る
      try{
          const data=await api(`/tasks/${formData_Tsk.id}/`,{
          method: 'PATCH',
          body:JSON.stringify(recordData),
          })
          console.log("課題情報が更新されました",data)
          setSoushin(!sousin)
          }catch(err){
            console.error(err);
            setErrors(err)
          }
    }
  const handleDelete_Tsk=async ()=>{
      // 確認ダイアログ
      const result=window.confirm("本当に削除してもよいですか。")
      if (result){
        // DELETE リクエストを使って、既存のレコードを削除する
        try{
            const data=await api(`/tasks/${formData_Tsk.id}/`,{
            method: 'DELETE',
            })
            console.log("削除が完了しました。",data)
            setSoushin(!sousin)
            }catch(err){
              console.error(err);
              setErrors(err)
            }
      }
    }
  return (
    <div className='timer-card mx-auto'>
      <form onSubmit={handleSubmit_Sub}>
        <h2>教科・課題</h2>
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
          <label htmlFor="subject" className="form-label">教科</label>
          {errors.subject && (
              <div className="text-danger mt-1">
                {errors.subject.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
              </div>
            )}
          <select  className='form-control mb-3' name='id' value={formData_Sub.id} onChange={handleChange_Sub} required>
          {/* <option value="">選択してください</option> */}
          {subjects.map((task)=>(
            <option key={task.id} value={task.id}>{task.name}</option>
          ))}
        </select>
        <label  htmlFor="name" className="form-label">教科名変更</label>
          <input type="text" className='form-control mb-3' name='name' value={formData_Sub.name} onChange={handleChange_Sub} required />
          {errors.name && (
            <div className="text-danger mt-1">
              {errors.username.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          )}
        <div className="d-flex justify-content-center gap-3 mt-3">
                <button
                  type="submit"
                  className="btn btn-outline-primary"
                  
                >
                  <i className="bi bi-pencil" /> 送信
                </button>
                <button className="btn btn-outline-danger btn-lg"   onClick={handleDelete_Sub}>
                  <i className="bi bi-trash"></i>
                </button>
          
        </div>
      </form>
      <br />
      <form onSubmit={handleSubmit_Tsk}>
        <label htmlFor="task" className="form-label">課題</label>
        {errors.task && (
            <div className="text-danger mt-1">
              {errors.task.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          )}
        <select  className='form-control mb-3' name='id' value={formData_Tsk.id} onChange={handleChange_Tsk} required>
          {/* <option value="">選択してください</option> */}
          {filteredTasks.map((task)=>(
            <option key={task.id} value={task.id}>{task.name}</option>
          ))}
        </select>
        <label  htmlFor="name" className="form-label">タスク名変更</label>
          <input type="text" className='form-control mb-3' name='name' value={formData_Tsk.name} onChange={handleChange_Tsk} required />
          {errors.name && (
            <div className="text-danger mt-1">
              {errors.email.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          )}
        <div className="d-flex justify-content-center gap-3 mt-3">
                <button
                  type="submit"
                  className="btn btn-outline-primary"
                >
                  <i className="bi bi-pencil" /> 送信
                </button>
                <button className="btn btn-outline-danger btn-lg"   onClick={handleDelete_Tsk}>
                  <i className="bi bi-trash"></i>
                </button>
          
        </div>
        
      </form>  
    </div>
  )
}

export default Settings_Subject_Task