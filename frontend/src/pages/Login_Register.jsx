import React, { useState } from 'react'
import LoginForm from '../components/LoginForm'
import RegisterForm from '../components/RegisterForm'

const Login_Register = ({onLoginSuccess,settoken}) => {
  const [Login,setLogin]=useState(true)
  const handleChange=()=>{
    setLogin(!Login)
  }

  return (
    <div>
      <h1><i className="bi bi-person"></i> ログイン/会員登録</h1>
      {Login==true?<LoginForm onLoginSuccess={onLoginSuccess} settoken={settoken} hc={handleChange}/>:<RegisterForm  onLoginSuccess={onLoginSuccess} settoken={settoken} hc={handleChange}/>}
      
      {/* <RegisterForm  onLoginSuccess={onLoginSuccess} settoken={settoken}/> */}
    </div>
  )
}

export default Login_Register