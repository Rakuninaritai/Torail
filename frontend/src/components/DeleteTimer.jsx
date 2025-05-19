import React from 'react'
//  タイマー削除用コンポーネント
const DeleteTimer = ({token,record,settimerchange}) => {
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  // 削除ボタン押下時関数
  const handleDelete=()=>{
     // 確認ダイアログ
    const result=window.confirm("本当に削除してもよいですか。")
    if (result){
      // DELETE リクエストを使って、既存のレコードを削除する
      fetch(`${API_BASE}/records/${record.id}/`, {
        method: "DELETE",
        headers: {
          "Authorization": `Token ${token}`
        },
      })
        .then(response => {
          if (!response.ok) {
            throw new Error("レコード更新に失敗しました");
          }
          // return response.json();
          console.log("削除完了")
          settimerchange()
        })
        // .then(data => {
        //   console.log("更新完了:", data);
        //   settimerchange()
        // })
        // .catch(error => console.error("更新エラー:", error));
    }
  }
  return (
    <div>
        {/* ── 削除ボタン ───────────────────── */}
        <button className="btn btn-outline-danger btn-lg"   onClick={handleDelete}>
          <i className="bi bi-trash"></i>
        </button>
    </div>
  )
}

export default DeleteTimer