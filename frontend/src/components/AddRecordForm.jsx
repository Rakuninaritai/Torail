import React, { useEffect, useState } from 'react'
import AddSubjectForm from './AddSubjectForm'
import AddTaskForm from './AddTaskForm'
import { api } from '../api'
import { useTeam } from '../context/TeamContext'
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';

function AddRecordForm({token,onRecordAdded,selectSub,selectSubName,sencha,sub,subname}) {
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const [isLoading, setLoading] = useState(false);
  // 今選ばれてるteamのidornull(個人)
  const { currentTeamId } = useTeam();
  // formdata(送るデータ)のusestate
  const [formData,setFormData]=useState({
    subject:"",
    task:"",
    // language:"",
    // date:"",
    // description:"",
    // duration:"",
  })
  // エラー表示用のstate
  const [errors,setErrors]=useState("")
  // 選択肢のある奴のusestate
  const [subjects,setSubjects]=useState([])
  const [tasks,setTasks]=useState([])
  // const [languages,setLanguages]=useState([])
  // 教科
  const [filteredTasks,setFilteredTasks]=useState([])

  // データ取得(第二が[]につきレンダリング時のみ実行)
  useEffect(  ()=>{
    setLoading(true)
    setFormData({ subject: "", task: "" });
    setFilteredTasks([]);
    const shutoku = async ()=>{
      try{
        const pathsubject = currentTeamId
        ? `/subjects/?team=${currentTeamId}`
        : '/subjects/?team__isnull=true';
        const ss=await api(pathsubject,{
          method: 'GET',
        })
        setSubjects(ss)
        const pathtasks = currentTeamId
        ? `/tasks/?team=${currentTeamId}`
        : '/tasks/';
        const st=await api(pathtasks,{
          method: 'GET',
        })
        setTasks(st)
        setLoading(false)
        // const sl=await api('/languages/',{
        //   method: 'GET',
        // })
        // setlanguages(sl)
      }catch (err) {
        // console.error(err);
        setErrors(err)
        setLoading(false)
      }
        
    }
    shutoku()
  },[currentTeamId])

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
      // console.log(Ssname)
      const filtered = tasks.filter(task => task.subject === formData.subject)
      // それらを選択肢とする
      setFilteredTasks(filtered)
    } else {
      setFilteredTasks([])
    }
  },[formData.subject,tasks,currentTeamId])

  // 送信ボタン押されたら
  const handleSubmit=async (e)=>{
    setLoading(true)
    // ページがreloadして送信をデフォルトではしようとするがそれをキャンセルしている
    e.preventDefault();
    // 現時刻を取得してnow格納
    const now=new Date().toISOString()
    // 送るデータにformとstart時刻を追加する
    const recordData={
      ...formData,
      start_time:now,
      team:currentTeamId,
    }
    // postで送る
    try{
        await api('/records/',{
          method: 'POST',
          body:JSON.stringify(recordData),
        })
        toast.success("タイマーが開始されました!")
        onRecordAdded();//呼び出してる、Appの更新状態用stateを反転させる関数を(appで反転するとリスと再読み込みさせてる)
        // エラー扱いになるが保存できている事象あり対応して(計測に戻ってしまうがhomeでは対応できる)
        setLoading(false)
    }catch(err){
      console.error(err);
      setErrors(err)
      toast.error("タイマーの開始に失敗しました。")
      setLoading(false)
    }
  }
  return (
    <div className="timer-card mx-auto">
      {isLoading?<Skeleton/>:(
        <>
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
            <label htmlFor="subject" className="form-label">教科</label>
            {errors.subject && (
                <div className="text-danger mt-1">
                  {errors.subject.map((msg, i) => (
                    <div key={i}>{msg}</div>
                  ))}
                </div>
              )}
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
            {errors.task && (
                <div className="text-danger mt-1">
                  {errors.task.map((msg, i) => (
                    <div key={i}>{msg}</div>
                  ))}
                </div>
              )}
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
        </>
      )}
      

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