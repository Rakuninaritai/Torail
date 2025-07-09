import React, { useState } from 'react'
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';

const RegisterForm = ({onLoginSuccess,settoken,hc}) => {
    const [isLoading, setLoading] = useState(false);
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
      setLoading(true)
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
          // console.log(data)
          toast.error("エラーが発生しました。")
          setLoading(false)
          return
        }

        // ④ 成功時の処理
        // console.log('Registration successful:', data)
        toast.success("登録成功です!")
        setLoading(false)
        settoken(data.key)
        onLoginSuccess&&onLoginSuccess()
    } catch (err) {
      // ネットワークエラー等
      // console.error('Network or unexpected error:', err)
      setErrors({non_field_errors:"通信エラーが発生しました。再度お試しください。"})
      toast.error("通信エラーが発生しました。")
      setLoading(false)
    }
    }
  
  return (
    <div className='timer-card mx-auto'>
      <form onSubmit={handleSubmit}>
        <h2>登録</h2>
        <div className="d-flex justify-content-center gap-3 mt-3">
          <button type='button'  className="btn btn-dark btn-md" onClick={()=>hc()}   >ログインはこちら</button>
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
        <small  className="form-text text-muted  d-block">半角英数記号のみで入力してください。</small>
          <input type="text" className='form-control mb-3' name='username' value={credentials.username} onChange={handleChange} required autoComplete="username" pattern="[!-~]+"
          title="半角英数字・記号（!～~）のみで入力してください。"/>
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
          onInput={e => e.target.setCustomValidity("")}
          autoComplete="new-password"/>
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
          <input type="password" className='form-control mb-3' name='password2' value={credentials.password2} onChange={handleChange} required  autoComplete="new-password"/>
          {errors.password2 && (
            <div className="text-danger mt-1">
              {errors.password2.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          )}
        
        <br />
         {/* 利用規約チェック */}
        <div className="form-check mb-3">
          <input
            className="form-check-input"
            type="checkbox"
            id="termsCheck"
            required
          />
          <label className="form-check-label" htmlFor="termsCheck">
            <a
              href="#"
              data-bs-toggle="modal"
              data-bs-target="#termsModal"
            >
              利用規約・プライバシーポリシー
            </a>
            に同意します
          </label>
        </div>

        <br />
        <div className="d-flex justify-content-center gap-3 mt-3">
          {isLoading?<Skeleton/>:(
            <button id="startBtn"  type='submit' className="btn btn-info btn-lg"><i className="bi bi-door-open"></i></button>
          )}
          
        </div>
        {/* {message&&<p>{message}</p>} */}
      </form>
      {/* モーダル本体 */}
      <div
        className="modal fade"
        id="termsModal"
        tabIndex={-1}
        aria-labelledby="termsModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="termsModalLabel">
                利用規約・プライバシーポリシー
              </h5>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="閉じる"
              />
            </div>
            <div
              className="modal-body"
              style={{ whiteSpace: 'pre-wrap' }}
            >
              <div className="container my-5">

                {/* 利用規約 */}
                <div className="card mb-4">
                  <div className="card-header bg-primary text-white">
                    利用規約
                  </div>
                  <div className="card-body">
                    <h5 className="mt-3">第1条（適用）</h5>
                    <p>
                      本規約は、本サービスTorail（以下「本サービス」といいます）の利用条件を定めるものです。
                    </p>

                    <h5 className="mt-3">第2条（登録）</h5>
                    <p>
                      ユーザーは正確な登録情報を提供するものとし、登録後は自己責任で管理してください。
                    </p>

                    <h5 className="mt-3">第3条（禁止事項）</h5>
                    <ul>
                      <li>法令または公序良俗に反する行為</li>
                      <li>第三者の権利を侵害・妨害する行為</li>
                      <li>本サービス運営を妨げる行為</li>
                    </ul>

                    <h5 className="mt-3">第4条（サービス内容の変更・停止）</h5>
                    <p>
                      当社は予告なく本サービスの内容変更、提供中断・停止を行うことができます。
                    </p>

                    <h5 className="mt-3">第5条（免責事項）</h5>
                    <p>
                      1. 本サービスは現状有姿で提供され、一切の保証を行いません。<br />
                      2. 当社はデータの消失・漏洩・遅延等により発生した損害について、一切の責任を負いません。<br />
                      3. ユーザー同士のトラブルについても当社は関与せず、責任を負いません。
                    </p>

                    <h5 className="mt-3">第6条（知的財産権）</h5>
                    <p>
                      本サービスに関する著作権・商標権などの知的財産権は当社または正当な権利者に帰属します。
                    </p>

                    <h5 className="mt-3">第7条（準拠法・裁判管轄）</h5>
                    <p>
                      本規約の解釈には日本法を適用し、本サービスに関して紛争が生じた場合、
                      東京地方裁判所を第一審の専属管轄裁判所とします。
                    </p>
                  </div>
                </div>

                {/* プライバシーポリシー */}
                <div className="card mb-4">
                  <div className="card-header bg-secondary text-white">
                    プライバシーポリシー
                  </div>
                  <div className="card-body">
                    <h5 className="mt-3">第1条（個人情報の定義）</h5>
                    <p>
                      「個人情報」とは、生存する個人に関する情報で、メールアドレスその他の記述等により識別できるものを指します。
                    </p>

                    <h5 className="mt-3">第2条（収集する情報）</h5>
                    <ul>
                      <li>登録情報：ユーザー名、メールアドレス、パスワード等</li>
                      <li>タイムトラッキングデータ：利用時間、使用言語、分類、メモ等</li>
                      <li>ログ情報：アクセス日時、IPアドレス、ブラウザ情報等</li>
                    </ul>

                    <h5 className="mt-3">第3条（利用目的）</h5>
                    <ul>
                      <li>本サービスの提供・運営のため</li>
                      <li>登録メールアドレスへの通知（チーム共有時のメール送信含む）</li>
                      <li>統計データの作成およびサービス改善</li>
                      <li>将来の広告配信・求人スカウトなどの案内</li>
                      <li>提携企業への登録情報、タイムトラッキングデータ提供</li>
                    </ul>

                    <h5 className="mt-3">第4条（第三者提供）</h5>
                    <p>
                      当社はユーザーの同意がある場合、または法令に基づく場合を除き、
                      個人情報を第三者に提供しません。ただし将来、有料プランや提携企業への
                      情報提供を実施する際は、別途同意を取得のうえ行うことがあります。
                    </p>

                    <h5 className="mt-3">第5条（Cookie等の利用）</h5>
                    <p>
                      本サービスでは Cookie や Web Beacon を利用してユーザーの利用状況を収集・分析します。
                    </p>

                    <h5 className="mt-3">第6条（安全管理措置）</h5>
                    <p>
                      技術的・組織的安全管理措置を講じますが、完全な安全性を保証するものではありません。
                      データ漏洩等のリスクをユーザー自身もご理解のうえご利用ください。
                    </p>

                    <h5 className="mt-3">第7条（開示・訂正・利用停止等）</h5>
                    <p>
                      ユーザーは当社に対し、自己の個人情報の開示・訂正・利用停止を求めることができます。
                      手続き方法は本サービスメールアドレス(Torail.app@gmail.com)にてご案内します。
                    </p>

                    <h5 className="mt-3">第8条（ポリシーの変更）</h5>
                    <p>
                      本ポリシーは予告なく変更されることがあります。変更後の内容は本サイト上に
                      掲載した時点から効力を有します。
                    </p>

                    <hr />
                    <p className="text-end mb-0">制定：2025年7月9日</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                data-bs-dismiss="modal"
              >
                閉じる
              </button>
              <button
                type="button"
                className="btn btn-primary"
                data-bs-dismiss="modal"
                onClick={() => {
                  document.getElementById('termsCheck').checked = true;
                }}
              >
                同意して閉じる
              </button>
            </div>
          </div>
        </div>
      </div>
  </div>
  )
}

export default RegisterForm