import React, { useState } from 'react'
import { api } from "../api";
//  タイマー削除用コンポーネント
const DeleteTimer = ({token,record,settimerchange}) => {
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  // 削除ボタン押下時関数
  const handleDelete=async ()=>{
     // 確認ダイアログ
    const result=window.confirm("本当に削除してもよいですか。")
    if (result){
      // DELETE リクエストを使って、既存のレコードを削除する
      try{
          const data=await api(`/records/${record.id}/`,{
          method: 'DELETE',
          })
          console.log("削除が完了しました。",data)
          settimerchange()
          }catch(err){
            console.error(err);
            setErrors(err)
          }
      // fetch(`${API_BASE}records/${record.id}/`, {
      //   method: "DELETE",
      //   headers: {
      //     "Authorization": `Token ${token}`
      //   },
      // })
      //   .then(response => {
      //     if (!response.ok) {
      //       throw new Error("レコード更新に失敗しました");
      //     }
      //     // return response.json();
      //     console.log("削除完了")
      //     settimerchange()
      //   })


        // .then(data => {
        //   console.log("更新完了:", data);
        //   settimerchange()
        // })
        // .catch(error => console.error("更新エラー:", error));
    }
  }
  return (
    <div>
        {/* 送信エラー */}
        {errors.detail && (
          <div className="text-danger mt-1">
            <div>{errors.detail}</div>
          </div>
        )}
        {/* ── 削除ボタン ───────────────────── */}
        <button className="btn btn-outline-danger btn-lg"   onClick={handleDelete}>
          <i className="bi bi-trash"></i>
        </button>
    </div>
  )
}

export default DeleteTimer