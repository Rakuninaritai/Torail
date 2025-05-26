import React from 'react'

const LogoutBtn = ({onLogoutSuccess}) => {
  const handleLogout=()=>{
    onLogoutSuccess&&onLogoutSuccess()
  }
  return (
    <button onClick={handleLogout}>ログアウト</button>
  )
}

export default LogoutBtn