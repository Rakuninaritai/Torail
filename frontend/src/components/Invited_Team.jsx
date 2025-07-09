import React, { useEffect } from 'react'
import { useState } from 'react';
import { api } from "../api";
import { Navigate, useNavigate } from 'react-router-dom';
import { useTeam } from '../context/TeamContext';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';

const Invited_Team = ({set}) => {
  const { currentTeamId,refreshTeams} = useTeam();
  const [isLoading, setLoading] = useState(false);
  // ユーザー一覧
  const [initialData, setinitialData] = useState([]);
  
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
  useEffect(()=>{
    const shutoku = async ()=>{
              setLoading(true)
              try{
                const ied=await api(`/invitations/?accepted=false`,{
                  method: 'GET',
                })
                // console.log(ied)
                const user=await api('auth/user/',{
                  method: 'GET',
                  })
                // console.log(user)
                
                
                if(currentTeamId){
                  // チームならそのチームが送った招待
                  const im=await api(`/invitations/?team=${currentTeamId}&accepted=false`,{
                    method: 'GET',
                  })
                  setinitialData([])
                  // console.log(im)
                  // console.log("チームのif")
                  setinitialData(im)
                  setLoading(false)
                }else{
                  // 個人なら自分に送られた招待
                  setinitialData([])
                  setinitialData(ied.filter(iu=>iu.invited_user==user.pk))
                  // console.log((ied.filter(iu=>iu.invited_user==user.pk)))
                  setLoading(false)
                }
                
              }catch (err) {
                // console.error(err);
                setErrors(err)
                setLoading(false)
                toast.error("データの取得に失敗しました。")
              }
                
            }
            shutoku()
  },[currentTeamId])
  const OnClickAccept=async (id,name)=>{
    // 確認ダイアログ
    const result=window.confirm(`${name}チームに入りますか?`)
    // 送る
    if(result){
      setLoading(true)
      try{
          const data=await api(`/invitations/${id}/accept/`,{
          method: 'POST',
          })
          // console.log("承認が送られました",data)
          toast.success("承認が送られました!")
          refreshTeams()
          setLoading(false)
          set()
          }catch(err){
            // console.error(err);
            setErrors(err)
            toast.error("送信に失敗しました。")
            setLoading(false)
          }
      }

  }
  const OnClickDelete=async (id,name)=>{
     // 確認ダイアログ
    const result=window.confirm(`${name}への招待を削除しますか?`)
    // 送る
    if(result){
      setLoading(true)
      try{
          const data=await api(`/invitations/${id}/`,{
          method: 'DELETE',
          })
          // console.log("招待が削除がされました",data)
          toast.success("招待が取消されました!")
          setLoading(false)
          set()
          }catch(err){
            // console.error(err);
            toast.error("取消できませんでした。")
            setErrors(err)
            setLoading(false)
          }
      }
  }
  return (
    <div className='timer-card mx-auto'>
      <h2>{currentTeamId?"招待しているユーザー":"招待されているチーム"}</h2>
      {/* ── フォーム全体エラー(non_field_errors) ── */}
        {errors.non_field_errors && (
          <div className="alert alert-danger">
            {errors.non_field_errors.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>)}

      {/* ユーザー一覧 */}
      <ul className="list-group" id="userResult">
        {initialData?.length?(initialData.map(data=>(
            <li  key={data.id} className="list-group-item d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <img
              src="https://placehold.co/32x32"
              alt="avatar"
              width="32"
              height="32"
              className="rounded-circle"
            />
            <span className="fw-semibold">{currentTeamId?data.invited_user_name:data.team_name}</span>
            <small className="text-muted ms-1"></small>
          </div>
          {isLoading?<Skeleton/>:(
            <button
              type="button"
              className="btn btn-sm btn-primary"
              data-user-id="USER_UUID"
              aria-label={currentTeamId?"取消":"承認"}
              onClick={currentTeamId?(()=>OnClickDelete(data.id,data.invited_user_name)):(()=>OnClickAccept(data.id,data.team_name))}
            >
              <i className={currentTeamId?"bi bi-trash me-1":"bi bi-envelope-plus me-1"}></i>
              {/* <i className="bi bi-trash me-1"></i> */}
              {currentTeamId?"取消":"承認"}
            </button>
            )}
          
        </li>
        ))):<p>{currentTeamId?"招待しているユーザーは":"招待されているチームは"}ありません</p>}
        
      </ul>

    </div>
    
  )
}

export default Invited_Team