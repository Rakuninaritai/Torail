import React, { useEffect } from 'react'
import { useState } from 'react';
import { api } from "../../api";
import { Navigate, useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';

const Settings_User = () => {
  const [isLoading, setLoading] = useState(false);
  const navigate = useNavigate(); 
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  // 引っ張ってきたデータ(こいつがformdataと一緒なら送らない)
  const [initialData, setinitialData] = useState({ username: '', email: '', password: '' ,pk:''});
  const [isEditing, setIsEditing] = useState(false);
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
  useEffect(()=>{
    const shutoku = async ()=>{
              setLoading(true)
              try{
                const ss=await api('/auth/user/',{
                  method: 'GET',
                })
                // form用これを変えていく
                setFormData({
                    username: ss.username,
                    email: ss.email,
                    password: ''   // パスワードは空で初期化
                  })
                // 引っ張て来たデータ参照用
                setinitialData({
                    username: ss.username,
                    email: ss.email,
                    password: '',  // パスワードは空で初期化
                    pk:ss.pk,
                  })
                  setLoading(false)
              }catch (err) {
                // console.error(err);
                setLoading(false)
                setErrors(err)
              }
                
            }
            shutoku()
  },[])
  const handleEdit=()=>{
    setIsEditing(!isEditing)
  }
  const handleDelete=async ()=>{
      // 確認ダイアログ
      const result=window.confirm("本当に削除してもよいですか。")
      if (result){
        setLoading(true)
        // DELETE リクエストを使って、既存のレコードを削除する
        try{
            const data=await api(`/users/${initialData.pk}/`,{
            method: 'DELETE',
            })
            // console.log("削除が完了しました。",data)
            toast.success("削除が完了しました!")
            setLoading(false)
            // replacetrueで履歴付けずにリダイレクト
            navigate('/', { replace: true });
            }catch(err){
              // console.error(err);
              toast.error("削除に失敗しました。")
              setLoading(false)
              setErrors(err)
            }
      }
    }
  const handleChange=(e)=>{
    setFormData({...formData,[e.target.name]:e.target.value})
  }
  const handleSubmit=async (e)=>{
    // ページがreloadして送信をデフォルトではしようとするがそれをキャンセルしている
    e.preventDefault();
    
    // 送るデータ
    const recordData={
      ...formData,
    }
    // 変更がなければ送らないようにする
    if(recordData.username===initialData.username){
      delete recordData.username
    }
    if(recordData.email===initialData.email){
      delete recordData.email
    }
    if(!recordData.password){
      delete recordData.password
    }
    console.log(recordData)
    // 送る
    try{
        setLoading(true)
        const data=await api(`/users/${initialData.pk}/`,{
        method: 'PATCH',
        body:JSON.stringify(recordData),
        })
        // console.log("ユーザー情報が更新されました",data)
        toast.success("ユーザー情報が更新されました!")
        setLoading(false)
        handleEdit()
        }catch(err){
          // console.error(err);
          toast.error("ユーザー情報の更新に失敗しました。")
          setLoading(false)
          setErrors(err)
        }
  }
  return (
    <div className='timer-card mx-auto'>
      <form onSubmit={handleSubmit}>
        <h2>ユーザー編集・削除</h2>
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
        {isLoading?<Skeleton/>:(
          <>
              <label  htmlFor="username" className="form-label">ユーザー名</label>
            <input type="text" className='form-control mb-3' name='username' value={formData.username} onChange={handleChange} required disabled={!isEditing} autoComplete="username" pattern="[!-~]+"
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
            <input type="email" className='form-control mb-3' name='email' value={formData.email} onChange={handleChange} required disabled={!isEditing}/>
            {errors.email && (
              <div className="text-danger mt-1">
                {errors.email.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
              </div>
            )}
          
          <br />
          <label   htmlFor="password" className="form-label">パスワード</label>
            <small  className="form-text text-muted  d-block">8文字以上で、大文字と数字を含めてください</small>
            <input type="password" className='form-control mb-3' name='password' value={formData.password} onChange={handleChange}  minLength={8}
            pattern="(?=.*[A-Z])(?=.*\d).+"
            title="パスワードは8文字以上で、大文字と数字を含めてください"
            onInvalid={e => e.target.setCustomValidity("8文字以上で、大文字と数字を含む必要があります")}
            onInput={e => e.target.setCustomValidity("")} disabled={!isEditing} autoComplete="current-password"/>
            {errors.password1 && (
              <div className="text-danger mt-1">
                {errors.password1.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
              </div>
            )}
          
          
          <div className="d-flex justify-content-center gap-3 mt-3">
            {!isEditing ? (
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={()=>{
                    // マウスのmouseupが終わってから切り替える
                    window.requestAnimationFrame(() => handleEdit());
                }}
                  >
                    <i className="bi bi-pencil" /> 編集
                  </button>
                ) : (
                  <>
                    <button id="startBtn"  type='submit' className="btn btn-info btn-lg"><i className="bi bi-door-open"></i></button>
                    <button
                      type="button"
                      onClick={handleEdit}
                      className="btn btn-secondary"
                    >
                      キャンセル
                    </button>
                    <button className="btn btn-outline-danger btn-lg"   onClick={handleDelete}>
                      <i className="bi bi-trash"></i>
                    </button>
                  </>
                )}
            
          </div>
          </>
        )}
        
        {/* {message&&<p>{message}</p>} */}
      </form>
    </div>
    // <div>
    //     <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
    //       <h2 className="text-xl font-semibold mb-4 text-center">プロフィール設定</h2>
    //       <form onSubmit={handleSubmit}>
    //         <div className="mb-4">
    //           <label className="block mb-1 font-medium" htmlFor="username">ユーザー名</label>
    //           <input
    //             type="text"
    //             id="username"
    //             name="username"
    //             value={formData.username}
    //             onChange={handleChange}
    //             disabled={!isEditing}
    //             className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
    //           />
    //         </div>
    //         <div className="mb-4">
    //           <label className="block mb-1 font-medium" htmlFor="email">メールアドレス</label>
    //           <input
    //             type="email"
    //             id="email"
    //             name="email"
    //             value={formData.email}
    //             onChange={handleChange}
    //             disabled={!isEditing}
    //             className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
    //           />
    //         </div>
    //         <div className="mb-6">
    //           <label className="block mb-1 font-medium" htmlFor="password">パスワード</label>
    //           <input
    //             type="password"
    //             id="password"
    //             name="password"
    //             value={formData.password}
    //             onChange={handleChange}
    //             disabled={!isEditing}
    //             placeholder="新しいパスワード"
    //             className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
    //           />
    //         </div>
    //         <div className="flex justify-center space-x-4">
    //           {!isEditing ? (
    //             <button
    //               type="button"
    //               onClick={handleEdit}
    //               className="px-4 py-2 bg-blue-600 text-white rounded"
    //             >
    //               編集
    //             </button>
    //           ) : (
    //             <>
    //               <button
    //                 type="submit"
    //                 className="px-4 py-2 bg-green-600 text-white rounded"
    //               >
    //                 保存
    //               </button>
    //               <button
    //                 type="button"
    //                 onClick={handleEdit}
    //                 className="px-4 py-2 bg-gray-600 text-white rounded"
    //               >
    //                 キャンセル
    //               </button>
    //             </>
    //           )}
    //         </div>
    //       </form>
    //     </div>
    // </div>
  )
}

export default Settings_User