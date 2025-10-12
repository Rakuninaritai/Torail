import React, { useEffect } from 'react'
import { useState } from 'react';
import { api } from "../../api";
import { Navigate, useNavigate } from 'react-router-dom';
import { useTeam } from '../../context/TeamContext';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';

const Invition_Team = ({set}) => {
  const [isLoading, setLoading] = useState(false);
  const { currentTeamId } = useTeam();
  const [formData, setFormData] = useState({
    team: currentTeamId,
    invited_user:""
   });
  // ユーザー一覧
  const [initialData, setinitialData] = useState([]);
  // 検索ユーザー名
  const [searchUser,setSearchUser]=useState("")
  // 検索結果
  const [searchUsers,setSearchUsers]=useState([])
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
  useEffect(()=>{
    const shutoku = async ()=>{
              setLoading(true)
              try{
                const ss=await api(`/users/`,{
                  method: 'GET',
                })
                const tm=await api(`/teams/${currentTeamId}/`,{
                  method: 'GET',
                })
                // console.log(tm)
                const im=await api(`/invitations/?team=${currentTeamId}&accepted=false`,{
                  method: 'GET',
                })
                // console.log(ss.filter(user=>im.every(inv=>inv.invited_user!=user.id))[0])
                // チームメンバーホームに表示
                // チーム脱退
                // 残りsettingsにチーム脱退/チーム招待(個人なら受容か)
                // 受けた招待と出した招待を用意して
                setinitialData(ss.filter(user=>tm.memberships.every(member=>member.user!=user.username)&&im.every(inv=>inv.invited_user!=user.id)))
                setLoading(false)
                // console.log(ss.filter(user=>tm.memberships.every(member=>member.user!=user.username)&&im.every(inv=>inv.invited_user!=user.id)))
              }catch (err) {
                // console.error(err);
                setErrors(err)
                setLoading(false)
                toast.error("情報の取得に失敗しました。")
              }
                
            }
            shutoku()
  },[currentTeamId])
  useEffect(()=>{
    if(!searchUser.trim()){
      setSearchUsers(initialData)
      return
    }
    setSearchUsers(initialData.filter(data=>data.username==searchUser))
  },[searchUser])
  const OnClickInv=async (id,name)=>{
     // 確認ダイアログ
    const result=window.confirm(`${name}さんに招待を送りますか?`)
    // 送る
    if(result){
      setLoading(true)
      try{
          const recordData={
            ...formData,
            invited_user:id
          }
          const data=await api(`/invitations/`,{
          method: 'POST',
          body:JSON.stringify(recordData),
          })
          // console.log("招待が送られました",data)
          toast.success("招待が送られました。")
          setLoading(false)
          set()
          }catch(err){
            // console.error(err);
            setErrors(err)
            toast.error("招待に失敗しました。")
            setLoading(false)
          }
      }
  }
  return (
    <div className='timer-card mx-auto'>
      <h2>ユーザー招待</h2>
      {/* ── フォーム全体エラー(non_field_errors) ── */}
        {errors.non_field_errors && (
          <div className="alert alert-danger">
            {errors.non_field_errors.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>)}
      <div className="input-group mb-3">
        <input
          type="text"
          id="keyword"
          className="form-control"
          placeholder="ユーザー名を入力してください"
          aria-label="Search users"
          onChange={(e)=>(setSearchUser(e.target.value.toLowerCase()))}
        />
      </div>

      {/* ユーザー一覧 */}
      <ul className="list-group" id="userResult">
        {searchUsers.map(user=>(
            <li  key={user.id}  className="list-group-item d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <img
              src="https://placehold.co/32x32"
              alt="avatar"
              width="32"
              height="32"
              className="rounded-circle"
            />
            <span className="fw-semibold">{user.username}</span>
            {/* <small className="text-muted ms-1">{user.email}</small> */}
          </div>
          {isLoading?<Skeleton/>:(
            <button
              type="button"
              className="btn btn-sm btn-primary"
              data-user-id="USER_UUID"
              aria-label="招待"
              onClick={()=>OnClickInv(user.id,user.username)}
            >
              <i className="bi bi-envelope-plus me-1"></i>
              招待
            </button>
          )}
          
        </li>
        ))}
        
      </ul>

    </div>
    
  )
}

export default Invition_Team