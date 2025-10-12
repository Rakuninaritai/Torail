import React, { useState } from 'react'
import { api } from "../../api";
import { useTeam } from '../../context/TeamContext';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';
const AddSubjectForm = ({token,changes}) => {
  const [isLoading, setLoading] = useState(false);
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
  // 今選ばれてるteamのidornull(個人)
  const { currentTeamId } = useTeam();
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const [formData,setFormData]=useState({
    name:"",
  })
  const handleChange=(e)=>{
    setFormData({...formData,[e.target.name]:e.target.value})
  }
  // 送信ボタン押されたら
  const handleSubmit=async (e)=>{
    setLoading(true)
    // ページがreloadして送信をデフォルトではしようとするがそれをキャンセルしている
    e.preventDefault();
    const sendData={
      ...formData,
      team:currentTeamId
    }
    // postで送る
    try{
        // 個人 or チーム API エンドポイントを切替
        const path = currentTeamId
          ? `/subjects/?team=${currentTeamId}`
          : '/subjects/';
        const data=await api(path,{
          method: 'POST',
          body:JSON.stringify(sendData),
        })
        // console.log("教科が追加されました",data)
        // 例: AddSubjectForm の handleSubmit 内、成功時に…
        const modalEl = document.getElementById('addSubjectModal'); // モーダルの <div id="addSubjectModal"> を指す
        // 既にインスタンスがあれば取得、なければ生成
        const bsModal = window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl);
        bsModal.hide();
        toast.success("教科が追加されました!")
        changes()
        setLoading(false)
    }catch(err){
      // console.error(err);
      setErrors(err)
      setLoading(false)
      toast.error("教科の追加に失敗しました。")
    }
    
  }
  return (
    <form onSubmit={handleSubmit}>
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
        {errors.name && (
        <div className="text-danger mt-1">
          {errors.name.map((msg, i) => (
            <div key={i}>{msg}</div>
          ))}
      </div>)}
      {isLoading?(<Skeleton/>):(<>
        <input type='text' name='name' placeholder='教科' className='form-control mb-3' value={formData.name} onChange={handleChange}  />
        <div className="d-flex justify-content-center gap-3 mt-3">
            <button type='submit'  className="btn btn-dark btn-lg"   >追加</button>
        </div>
      </>)}
      
      
    </form>
    
  )
}

export default AddSubjectForm