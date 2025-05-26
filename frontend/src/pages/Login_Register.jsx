import React from 'react'
import LoginForm from '../components/LoginForm'
import RegisterForm from '../components/RegisterForm'

const Login_Register = ({onLoginSuccess,settoken}) => {
  return (
    <div>
      <h1><i className="bi bi-person"></i> ログイン/登録</h1>
      <LoginForm onLoginSuccess={onLoginSuccess} settoken={settoken}/>
      <RegisterForm  onLoginSuccess={onLoginSuccess} settoken={settoken}/>
    </div>
  )
}

export default Login_Register