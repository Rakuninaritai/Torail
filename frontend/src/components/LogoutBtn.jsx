import React from 'react'
import { api } from "../api";
const LogoutBtn = ({onLogoutSuccess}) => {
  const handleLogout = async () => {
    const API_BASE = import.meta.env.VITE_API_BASE_URL
    try{
      const data=await api('/auth/logout/',{
      method: 'POST',
      })
      console.log("ログアウト完了",data)
      onLogoutSuccess&&onLogoutSuccess()
      }catch(err){
        console.error(err);
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
    <button onClick={handleLogout}>ログアウト</button>
  )
}

export default LogoutBtn