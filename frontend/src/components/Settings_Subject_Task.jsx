import React, { useEffect, useState } from 'react'
import { api } from "../api";
import { useTeam } from '../context/TeamContext';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';


const Settings_Subject_Task = () => {
  const [isLoading, setLoading] = useState(false);
    const { currentTeamId } = useTeam();
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
                setLoading(true)
                // チームが変わったら一旦フォームを空に
                setFormData_Sub({ id: '', name: '' });
                setFormData_Tsk({ id: '', name: '' });
                setInitialSubject('');
                setInitialTask('');
                setFilteredTasks([]);
                // 個人 or チーム API エンドポイントを切替
                const path_sub = currentTeamId
                  ? `/subjects/?team=${currentTeamId}`
                  : '/subjects/';
                try{
                  const ss=await api(path_sub,{
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
                    // 個人 or チーム API エンドポイントを切替
                    const path_tsk = currentTeamId
                      ? `/tasks/?team=${currentTeamId}`
                      : '/tasks/';
                    const st=await api(path_tsk,{
                      method: 'GET',
                    })
                    setTasks(st)
                    setLoading(false)
                }catch (err) {
                  // console.error(err);
                  setLoading(false)
                  setErrors(err)
                }
                  
              }
              shutoku()
    },[sousin,currentTeamId])
    // formdataのsubjectが変わったら課題を更新する
      useEffect(()=>{
        // IDが なければクリア
        if (!formData_Sub.id) {
          setFilteredTasks([]);
          setFormData_Tsk({ id: "", name: "" });
          return;
        }
        // 教科に値が入っているなら(id)
        if(formData_Sub.id){
          // formdataはidなので文字を持ちたいのでfilterかけて取得してる
          const Ssname=subjects.find(sub=>sub.id===formData_Sub.id)
          if(Ssname){
          // 評価用のこし
          setInitialSubject(Ssname.name)
          setFormData_Sub({...formData_Sub,name:Ssname.name})
          const filtered = tasks.filter(task => task.subject === formData_Sub.id)
          // それらを選択肢とする
          setFilteredTasks(filtered)
          // filteredTasks の先頭を task の初期値に
          if (filtered.length>0) {
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
         }else{
            setInitialSubject("");
          }
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
          const Ssname=tasks.find(sub=>sub.id===formData_Tsk.id)
          setInitialTask(Ssname.name)
          setFormData_Tsk({...formData_Tsk,name:Ssname.name})
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
      setLoading(true)
      e.preventDefault();
      if(initialSubject===formData_Sub.name){
        return setLoading(false)
      };
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
          // console.log("教科情報が更新されました",data)
          toast.success("教科情報が更新されました!")
          setLoading(false)
          setSoushin(!sousin)
          }catch(err){
            // console.error(err);
            toast.error("教科情報の更新に失敗しました。")
            setLoading(false)
            setErrors(err)
          }
    }
    const handleDelete_Sub=async ()=>{
      // 確認ダイアログ
      const result=window.confirm("本当に削除してもよいですか。")
      if (result){
        setLoading(true)
        // DELETE リクエストを使って、既存のレコードを削除する
        try{
            const data=await api(`/subjects/${formData_Sub.id}/`,{
            method: 'DELETE',
            })
            // console.log("削除が完了しました。",data)
            toast.success("削除が完了しました!")
            setLoading(false)
            setSoushin(!sousin)
            }catch(err){
              // console.error(err);
              toast.error("削除に失敗しました。")
              setLoading(false)
              setErrors(err)
            }
      }
    }

    const handleSubmit_Tsk =async (e)=>{
      setLoading(true)
      // ページがreloadして送信をデフォルトではしようとするがそれをキャンセルしている
      e.preventDefault();
      if(initialTask===formData_Tsk.name){
        return setLoading(false)
      };
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
          // console.log("課題情報が更新されました",data)
          toast.success("課題情報が更新されました!")
          setLoading(false)
          setSoushin(!sousin)
          }catch(err){
            // console.error(err);
            toast.error("課題情報更新に失敗しました。")
            setLoading(false)
            setErrors(err)
          }
    }
  const handleDelete_Tsk=async ()=>{
      // 確認ダイアログ
      const result=window.confirm("本当に削除してもよいですか。")
      if (result){
        setLoading(true)
        // DELETE リクエストを使って、既存のレコードを削除する
        try{
            const data=await api(`/tasks/${formData_Tsk.id}/`,{
            method: 'DELETE',
            })
            // console.log("削除が完了しました。",data)
            toast.success("削除が完了しました!")
            setLoading(false)
            setSoushin(!sousin)
            }catch(err){
              // console.error(err);
              toast.error("削除に失敗しました。")
              setLoading(false)
              setErrors(err)
            }
      }
    }
  return (
    <div className='timer-card mx-auto'>
      {isLoading?<Skeleton/>:(
        <>
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
        </>
      )}
      
    </div>
  )
}

export default Settings_Subject_Task