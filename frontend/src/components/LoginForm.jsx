import React, { useState } from 'react'

const LoginForm = ({onLoginSuccess,settoken}) => {
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  // 送るやつのstate
  const [credentials,setCredentials]=useState({username:"",password:""})
  // エラー表示などのmessagestate
  const [message,setMessage]=useState("")

  // input変わるとデータ取得
  const handleChange=(e)=>{
    // targetnameをキーにするために[]で囲むES6の機能[]なしだときーはe.target.nameという文字になってしまう
    setCredentials({...credentials,[e.target.name]:e.target.value})
  }

  // 送信ボタン押されたら動作
  const handleSubmit=(e)=>{
    e.preventDefault()
    fetch(`${API_BASE}/auth/login/`,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
      },
      // 文字列をjson文字列にしてる
      body:JSON.stringify(credentials),
    })
    .then((response)=>{
      if(!response.ok){
        return response.json().then((data)=>{
          throw new Error(JSON.stringify(data))
        })
      }
      return response.json()
    })
    .then((data)=>{
      console.log("Login succcessful:",data)
      localStorage.setItem("access_token",data.key)
      onLoginSuccess&&onLoginSuccess()
      settoken(data.key)
    })
    .catch((error)=>{
      console.error("Login error:",error)
      setMessage("ログインに失敗しました:",+error.message)
    })
  }




  
  return (
    <form onSubmit={handleSubmit}>
      <h2>ログイン</h2>
      <label >
        ユーザー名:
        <input type="text" name='username' value={credentials.username} onChange={handleChange} required />
      </label>
      <br />
      <label >
        パスワード:
        <input type="password" name='password' value={credentials.password} onChange={handleChange} required />
      </label>
      <br />
      <button type='submit'>ログイン</button>
      {message&&<p>{message}</p>}
    </form>
  )
}

export default LoginForm