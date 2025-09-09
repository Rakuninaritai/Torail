import React, { useState, useSyncExternalStore } from 'react'
import { useTeam } from '../context/TeamContext'
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';
import { useLocation } from 'react-router-dom';

const LoginForm = ({onLoginSuccess,settoken,hc}) => {
  const location = useLocation();
  const next = new URLSearchParams(location.search).get('next');
  const [isLoading, setLoading] = useState(false);
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  // 送るやつのstate
  const [credentials,setCredentials]=useState({username:"",password:""})
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
  const { refreshTeams,selectTeam } = useTeam()

  // input変わるとデータ取得
  const handleChange=(e)=>{
    // targetnameをキーにするために[]で囲むES6の機能[]なしだときーはe.target.nameという文字になってしまう
    setCredentials({...credentials,[e.target.name]:e.target.value})
  }

  // 送信ボタン押されたら動作
    const handleSubmit = async (e)=>{
      setLoading(true)
      e.preventDefault()
      try {
        // ① fetch 実行
        const res = await fetch(`${API_BASE}token/`, {
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
          toast.error("エラーが発生しました。")
          setLoading(false)
          // console.log(data)
          return
        }

        // ④ 成功時の処理
        // console.log('Registration successful:', data)
        toast.success("ログインに成功しました!")
        setLoading(false)
        refreshTeams()
        selectTeam(null)
        
        onLoginSuccess&&onLoginSuccess()
    } catch (err) {
      // ネットワークエラー等
      // console.error('Network or unexpected error:', err)
      setErrors({non_field_errors: ["通信エラーが発生しました。再度お試しください。"]})
      toast.error("通信エラーが発生しました。")
      setLoading(false)
    }
    }

  const BACKEND_BASE = import.meta.env.VITE_BACKEND_ORIGIN;


  
  return (
    <div className='timer-card mx-auto'>
      <form onSubmit={handleSubmit}>
        <h2>ログイン</h2>
        <div className="d-flex justify-content-center gap-3 mt-3">
          <button type='button'  className="btn btn-dark btn-md" onClick={()=>hc()}   >会員登録はこちら</button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => {
               const here = `${window.location.origin}${location.pathname}${location.search}${location.hash}`;
               const nextParam = encodeURIComponent(next || here);
               window.location.href = `${BACKEND_BASE}/accounts/google/login/?process=login&next=${nextParam}`;
            }}
          >
            <i className="bi bi-google me-1"></i> Googleで続行
          </button>
        </div>
        
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
          {errors.username && (
            <div className="text-danger mt-1">
              {errors.username.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
          </div>)}
          <input type="text" className='form-control mb-3' name='username' value={credentials.username} onChange={handleChange} required autoComplete="username" pattern="[!-~]+"
          title="半角英数字・記号（!～~）のみで入力してください。"/>
        
        <br />
        <label   htmlFor="password" className="form-label">パスワード</label>
        <small  className="form-text text-muted  d-block">8文字以上で、大文字と数字を含めてください</small>
        {errors.password && (
            <div className="text-danger mt-1">
              {errors.password.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          )}
        <input type="password" className='form-control mb-3' name='password' value={credentials.password} onChange={handleChange} required 
        minLength={8} //最低8文字
        pattern="(?=.*[A-Z])(?=.*\d).+"  //大文字小文字数字含めて
        title="パスワードは8文字以上で、大文字と数字を含めてください"  //フォールドにホバー時表示
        onInvalid={e => e.target.setCustomValidity("8文字以上で、大文字と数字を含む必要があります")}  //エラー時表示文字
        onInput={e => e.target.setCustomValidity("")}  //クリア文字
        autoComplete="current-password"
        />
        
        <br />
        <div className="d-flex justify-content-center gap-3 mt-3">
          {isLoading?<Skeleton/>:(
            <button id="startBtn"  type='submit' className="btn btn-info btn-lg"><i className="bi bi-door-open"></i></button>
          )}
          
        </div>
        {/* {message&&<p>{message}</p>} */}
      </form>
    </div>
  )
}

export default LoginForm