import React, { useState } from 'react'

const  RegistrationForm = ({onRegistered})=> {
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  // 会員登録用のデータ
  const [formData,setFormData]=useState({
    username:"",
    email:"",
    password1:"",
    password2:"",
  })
  // エラー時のメッセージ用state
  const [message,setMessage]=useState("")

  // formに変化があった時にforomdataの値を変える
  const handleChange=(e)=>{
    // formdata(送るデータ)辞書の更新
    setFormData({...formData,[e.target.name]: e.target.value})
  }

  // 送信ボタンを押された時
  const handleSubmit=(e)=>{
    // 通常の送信をなし
    e.preventDefault()
    // 会員登録用エンドポイントに送信
    fetch(`${API_BASE}/auth/registration/`,{
      method:"POST",
      headers:{
        // djangoにjson形式データであることを伝える
        "Content-Type":"application/json",
      },
      // formdataをjsonにする
      body:JSON.stringify(formData),
    })
    // 帰ってきたデータが
    .then((res)=>{
      // 成功じゃなかったら
      if(!res.ok){
        // そのjsonをcatchに流す
        return res.json().then((data)=>{
          // newerrorであらたにエラーを作成しcatchに投げる(throwする)
          // errorは文字列で返すのでjsonをjson文字列にしてる
          throw new Error(JSON.stringify(data))
        })
      }
      // 成功してればそのままjsonに
      return res.json()
    })
    // json化したのをdataとして受け取る
    .then((data)=>{
      console.log("登録成功",data)
      setMessage("登録が成功しました")
      // 会員登録後に動きがあればそれを引き渡して実行
      onRegistered && onRegistered()//why
    })
    // データをとってこれなかったり失敗だったらこっち
    .catch((error)=>{
      console.error("登録エラー:",error)
      setMessage("登録に失敗しました"+error.message)
    })

  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>会員登録</h2>
      <label>
        ユーザー名:
        <input type="text" name='username' value={formData.username} onChange={handleChange} required/>
      </label>
      <br />
      <label>
        メール:
        <input type="email" name='email' value={formData.email} onChange={handleChange} autoComplete='email' required/>
      </label>
      <br />
      <label>
        パスワード:
        {/* autocomplateはブラウザに自動補完の指示newpasswordで既存のパスワードを使いまわす補完をしない */}
        <input type="password" name='password1' value={formData.password1} onChange={handleChange} autoComplete='new-password' required/>
      </label>
      <br />
      <label>
        パスワード再入力:
        <input type="password" name='password2' value={formData.password2} onChange={handleChange} autoComplete='new-password' required/>
      </label>
      <br />
      <button type='submit'>登録</button>
      {message && <p>{message}</p>}
    </form>
  )
}

export default RegistrationForm