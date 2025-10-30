import React, { useState } from 'react'
import LoginForm from '../components/Login_Register/LoginForm'
import RegisterForm from '../components/Login_Register/RegisterForm'

const Login_Register = ({onLoginSuccess,settoken,redirectTo,defaultTab, fixedAccountType, companyFlow}) => {
  document.title="Torail|ログイン/会員登録"
  const [Login,setLogin]=useState(defaultTab ? defaultTab !== 'register' : true)
  const handleChange=()=>{
    setLogin(!Login)
  }

  return (
    <div>
      <h1><i className="bi bi-person"></i> ログイン/会員登録</h1>
      {Login
        ? <LoginForm onLoginSuccess={()=>{
            onLoginSuccess?.();
            if (redirectTo) window.location.replace(redirectTo);
          }} settoken={settoken} hc={handleChange} />
        : <RegisterForm
            onLoginSuccess={()=>{
              onLoginSuccess?.();
              if (redirectTo) window.location.replace(redirectTo);
            }}
            settoken={settoken}
            hc={handleChange}
            fixedAccountType={fixedAccountType}
            companyFlow={companyFlow}
          />
      }
      
      {/* <RegisterForm  onLoginSuccess={onLoginSuccess} settoken={settoken}/> */}
    </div>
  )
}

export default Login_Register