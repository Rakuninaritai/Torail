import React, { useState } from 'react'
import { api } from "../api";
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';
// チーム対応済
//  タイマー削除用コンポーネント
const DeleteTimer = ({token,record,settimerchange}) => {
  const [isLoading, setLoading] = useState(false);
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  // 削除ボタン押下時関数
  const handleDelete=async ()=>{
     // 確認ダイアログ
    const result=window.confirm("本当に削除してもよいですか。")
    if (result){
      setLoading(true)
      // DELETE リクエストを使って、既存のレコードを削除する
      try{
          const data=await api(`/records/${record.id}/`,{
          method: 'DELETE',
          })
          // console.log("削除が完了しました。",data)
          toast.success("タイマーを削除しました!")
          setLoading(false)
          settimerchange()
          }catch(err){
            // console.error(err);
            toast.error("タイマーの削除に失敗しました。")
            setErrors(err)
            setLoading(false)
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
        {isLoading?<Skeleton/>:(
          <button className="btn btn-outline-danger btn-lg"   onClick={handleDelete}>
            <i className="bi bi-trash"></i>
          </button>
        )}
        
    </div>
  )
}

export default DeleteTimer