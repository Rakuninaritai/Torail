import React, { useEffect } from 'react'
import { useState } from 'react';
import { api } from "../api";
import { Navigate, useNavigate } from 'react-router-dom';
import { useTeam } from '../context/TeamContext';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';

const Settings_Team = () => {
  const [isLoading, setLoading] = useState(false);
  const { currentTeamId, refreshTeams } = useTeam();
  const navigate = useNavigate(); 
  const [formData, setFormData] = useState({ name: '', });
  // 引っ張ってきたデータ(こいつがformdataと一緒なら送らない)
  const [initialData, setinitialData] = useState({ name: '' ,id:''});
  const [isEditing, setIsEditing] = useState(false);
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
  useEffect(()=>{
    const shutoku = async ()=>{
              setLoading(true)
              try{
                const ss=await api(`/teams/${currentTeamId}/`,{
                  method: 'GET',
                })
                // form用これを変えていく
                setFormData({
                    name: ss.name,   
                  })
                // 引っ張て来たデータ参照用
                setinitialData({
                    name: ss.name,
                    id:ss.id,
                  })
                setLoading(false)
              }catch (err) {
                // console.error(err);
                setLoading(false)
                setErrors(err)
              }
                
            }
            shutoku()
  },[])
  const handleEdit=()=>{
    setIsEditing(!isEditing)
  }
  const handleDelete=async ()=>{
      // 確認ダイアログ
      const result=window.confirm("本当に削除してもよいですか。")
      if (result){
        setLoading(true)
        // DELETE リクエストを使って、既存のレコードを削除する
        try{
            const data=await api(`/teams/${currentTeamId}/`,{
            method: 'DELETE',
            })
            // console.log("削除が完了しました。",data)
            toast.success("削除が完了しました!")
            setLoading(false)
            // replacetrueで履歴付けずにリダイレクト
            refreshTeams()
            navigate('/', { replace: true });
            }catch(err){
              // console.error(err);
              toast.error("削除に失敗しました。")
              setLoading(false)
              setErrors(err)
            }
      }
    }
  const handleChange=(e)=>{
    setFormData({...formData,[e.target.name]:e.target.value})
  }
  const handleSubmit=async (e)=>{
    setLoading(true)
    // ページがreloadして送信をデフォルトではしようとするがそれをキャンセルしている
    e.preventDefault();
    
    // 送るデータ
    const recordData={
      ...formData,
    }
    // 変更がなければ送らないようにする
    if(recordData.name===initialData.name){
      setLoading(false)
      delete recordData.name
    }
    console.log(recordData)
    // 送る
    try{
        const data=await api(`/teams/${currentTeamId}/`,{
        method: 'PATCH',
        body:JSON.stringify(recordData),
        })
        // console.log("ユーザー情報が更新されました",data)
        toast.success("チーム情報が更新されました!")
        setLoading(false)
        refreshTeams()
        handleEdit()
        }catch(err){
          // console.error(err);
          toast.error("チーム情報更新に失敗しました。")
          setLoading(false)
          setErrors(err)
        }
  }
  return (
    <div className='timer-card mx-auto'>
      <form onSubmit={handleSubmit}>
        <h2>チーム編集・削除</h2>
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
        {isLoading?<Skeleton/>:(
          <>
            <label  htmlFor="name" className="form-label">チーム名</label>
            <input type="text" className='form-control mb-3' name='name' value={formData.name} onChange={handleChange} required disabled={!isEditing}/>
            {errors.name && (
              <div className="text-danger mt-1">
                {errors.username.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
              </div>
            )}
          
          <br />
          
          
          <div className="d-flex justify-content-center gap-3 mt-3">
            {!isEditing ? (
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={()=>{
                    // マウスのmouseupが終わってから切り替える
                    window.requestAnimationFrame(() => handleEdit());
                }}
                  >
                    <i className="bi bi-pencil" /> 編集
                  </button>
                ) : (
                  <>
                    <button id="startBtn"  type='submit' className="btn btn-info btn-lg"><i className="bi bi-door-open"></i></button>
                    <button
                      type="button"
                      onClick={handleEdit}
                      className="btn btn-secondary"
                    >
                      キャンセル
                    </button>
                    <button className="btn btn-outline-danger btn-lg"   onClick={handleDelete}>
                      <i className="bi bi-trash"></i>
                    </button>
                  </>
                )}
            
          </div>
          </>
        )}
        
      </form>
    </div>
    
  )
}

export default Settings_Team