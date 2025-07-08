import React, { useEffect } from 'react'
import { useState } from 'react';
import { api } from "../api";
import { Navigate, useNavigate } from 'react-router-dom';
import { useTeam,  } from '../context/TeamContext';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';

const Leave_Team = () => {
  const [isLoading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { currentTeamId ,refreshTeams} = useTeam();
  
  // ユーザー一覧
  const [initialData, setinitialData] = useState([]);
  const [User,setUser]=useState("")
  
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
  useEffect(()=>{
    const shutoku = async ()=>{
              setLoading(true)
              try{
                
                const user=await api('auth/user/',{
                  method: 'GET',
                  })
                // console.log(user)
                setUser(user)
                const team=await api(`/teams/${currentTeamId}/`,{
                  method: 'GET',
                  })
                // console.log("teams",team)
                setinitialData(team)
                setLoading(false)
              }catch (err) {
                // console.error(err);
                toast.error("情報の取得に失敗しました。")
                setErrors(err)
                setLoading(false)
              }
                
            }
            shutoku()
  },[currentTeamId])
  const handleLeave=async ()=>{
    // 確認ダイアログ
    const result=window.confirm(`${initialData.name}チームを抜けますか`)
    // 送る
    if(result){
      setLoading(true)
      try{
          const data=await api(`/teams/${initialData.id}/leave/`,{
          method: 'POST',
          })
          // console.log("脱退できました",data)
          toast.success("チーム脱退に成功しました!")
          refreshTeams()
          navigate('/');
          setLoading(false)
          }catch(err){
            // console.error(err);
            toast.error("チーム脱退に失敗しました。")
            setErrors(err)
            setLoading(false)
          }
      }

  }
  const handleDelete=async ()=>{
     // 確認ダイアログ
    const result=window.confirm(`${initialData.name}チームを削除しますか?`)
    // 送る
    if(result){
      setLoading(true)
      try{
          const data=await api(`/teams/${initialData.id}/`,{
          method: 'DELETE',
          })
          // console.log("チームが削除がされました",data)
          toast.success("チームの削除に成功しました!")
          setLoading(false)
          refreshTeams()
          navigate('/');
          }catch(err){
            // console.error(err);
            toast.error("チームの削除に失敗しました。")
            setErrors(err)
            setLoading(false)
          }
      }
  }
  return (
    <div className='timer-card mx-auto'>
      <h2>{User.username==initialData.owner?"チームを削除":"チーム脱退"}</h2>
      {/* ── フォーム全体エラー(non_field_errors) ── */}
        {errors.non_field_errors && (
          <div className="alert alert-danger">
            {errors.non_field_errors.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>)}
          {isLoading?<Skeleton/>:(
            <div className="d-flex justify-content-center gap-3 mt-3">
              {User.username==initialData.owner?(
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={handleDelete}
                >
                  <i className="bi bi-trash me-1"></i>
                  チーム削除
                </button>):(<button
                  type="button"
                  className="btn btn-outline-warning"
                  onClick={handleLeave}
                >
                  <i className="bi bi-box-arrow-right me-1"></i>
                  脱退する
                </button>)}
            </div>
          )}
          

    </div>
    
  )
}

export default Leave_Team