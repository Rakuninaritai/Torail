import React, { useState } from 'react'
import { api } from "../api";
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';
import { useTeam } from '../context/TeamContext'
const LogoutBtn = ({onLogoutSuccess}) => {
  const { selectTeam } = useTeam()
  const [isLoading, setLoading] = useState(false);
  const navigate=useNavigate()
  const handleLogout = async () => {
    const API_BASE = import.meta.env.VITE_API_BASE_URL
    setLoading(true)
    try{
      const data=await api('/auth/logout/',{
      method: 'POST',
      })
      // console.log("ログアウト完了",data)
      toast.success("ログアウトが完了しました!")
      setLoading(false)
      selectTeam(null)
      // チームを呼び出すことで空に
      navigate("/")
      onLogoutSuccess()
      }catch(err){
        // console.error(err);
        toast.error("ログアウトに失敗しました。")
        setLoading(false)
      }
    
    // try {
    //   const res = await fetch(`${API_BASE}auth/logout/`, {
    //     method: 'POST',
    //     credentials: 'include',              // ← Cookie を送る
    //     headers: { 'Content-Type': 'application/json' },
    //   })
    //   if (res.ok) {
    //     // 成功したらアプリの認証状態をリセット
    //     onLogoutSuccess&&onLogoutSuccess()
    //   } else {
    //     console.error('Logout failed:', await res.text())
    //   }
    // } catch (err) {
    //   console.error('Network error on logout:', err)
    // }
}
  return (
    <>
      {isLoading?<Skeleton/>:(
        <button onClick={handleLogout}>ログアウト</button>
      )}
    </>
  )
}

export default LogoutBtn