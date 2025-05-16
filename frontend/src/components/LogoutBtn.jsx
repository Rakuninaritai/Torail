import React from 'react'

const LogoutBtn = ({onLogoutSuccess}) => {
  const handleLogout=()=>{
    localStorage.removeItem("access_token")
    onLogoutSuccess&&onLogoutSuccess()
  }
  return (
    <button onClick={handleLogout}>ログアウト</button>
  )
}

export default LogoutBtn