import React, { useState } from 'react'

const RegisterForm = ({onLoginSuccess,settoken}) => {
  // Vite のケース
    const API_BASE = import.meta.env.VITE_API_BASE_URL
    // 送るやつのstate
    const [credentials,setCredentials]=useState({username:"",email:"",password1:"",password2:""})
    // エラー表示などのmessagestate
    const [errors,setErrors]=useState("")
  
    // input変わるとデータ取得
    const handleChange=(e)=>{
      // targetnameをキーにするために[]で囲むES6の機能[]なしだときーはe.target.nameという文字になってしまう
      setCredentials({...credentials,[e.target.name]:e.target.value})
    }
  
    // 送信ボタン押されたら動作
    const handleSubmit = async (e)=>{
      e.preventDefault()
      try {
        // ① fetch 実行
        const res = await fetch(`${API_BASE}auth/registration/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',                     // Cookie 認証するなら必須
          body: JSON.stringify(credentials),
        })

        // ② JSON にパース
        const data = await res.json()

        // ③ 400 系ならエラー state にセットして抜ける
        if (!res.ok) {
          setErrors(data)
          console.log(data)
          return
        }

        // ④ 成功時の処理
        console.log('Registration successful:', data)
        settoken(data.key)
        onLoginSuccess&&onLoginSuccess()
    } catch (err) {
      // ネットワークエラー等
      console.error('Network or unexpected error:', err)
      setErrors({non_field_errors:"通信エラーが発生しました。再度お試しください。"})
    }
    }
  
  return (
    <div className='timer-card mx-auto'>
      <form onSubmit={handleSubmit}>
        <h2>登録</h2>
        {/* 送信エラー */}
          {errors.detail && (
            <div className="text-danger mt-1">
              <div>{errors.detail}</div>
            </div>
          )}
        {/* ── フォーム全体エラー(non_field_errors) ── */}
        {errors.non_field_errors && (
          <div className="alert alert-danger">
            {errors.non_field_errors.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>)}
        <label  htmlFor="username" className="form-label">ユーザー名</label>
          <input type="text" className='form-control mb-3' name='username' value={credentials.username} onChange={handleChange} required />
          {errors.username && (
            <div className="text-danger mt-1">
              {errors.username.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          )}
        
        <br />
        <label  htmlFor="email" className="form-label">メールアドレス</label>
          <input type="email" className='form-control mb-3' name='email' value={credentials.email} onChange={handleChange} required />
          {errors.email && (
            <div className="text-danger mt-1">
              {errors.email.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          )}
        
        <br />
        <label   htmlFor="password1" className="form-label">パスワード</label>
          <small  className="form-text text-muted  d-block">8文字以上で、大文字と数字を含めてください</small>
          <input type="password" className='form-control mb-3' name='password1' value={credentials.password1} onChange={handleChange} required minLength={8}
          pattern="(?=.*[A-Z])(?=.*\d).+"
          title="パスワードは8文字以上で、大文字と数字を含めてください"
          onInvalid={e => e.target.setCustomValidity("8文字以上で、大文字と数字を含む必要があります")}
          onInput={e => e.target.setCustomValidity("")}/>
          {errors.password1 && (
            <div className="text-danger mt-1">
              {errors.password1.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          )}
        
        <br />
        <label   htmlFor="password2" className="form-label">パスワード(確認用)</label>
          <small  className="form-text text-muted  d-block">上と同じパスワードを入力してください</small>
          <input type="password" className='form-control mb-3' name='password2' value={credentials.password2} onChange={handleChange} required />
          {errors.password2 && (
            <div className="text-danger mt-1">
              {errors.password2.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          )}
        
        <br />
        <div className="d-flex justify-content-center gap-3 mt-3">
          <button id="startBtn"  type='submit' className="btn btn-info btn-lg"><i className="bi bi-door-open"></i></button>
        </div>
        {/* {message&&<p>{message}</p>} */}
      </form>
    </div>
  )
}

export default RegisterForm