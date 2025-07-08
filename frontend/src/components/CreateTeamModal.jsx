import React, { useState } from 'react'
import { api } from '../api'
import { useTeam } from '../context/TeamContext'
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';
// チームを作成するためのコンポネ

const CreateTeamModal = () => {
  const [isLoading, setLoading] = useState(false);
  // 作りたいチーム名
  const [name, setName] = useState('')
  // コンテキストからチーム再取得関数と選んだチームを設定する用の関数を引っ張ってくる。
  const { refreshTeams, selectTeam } = useTeam()
  // エラー表示などのmessagestate
    const [errors,setErrors]=useState("")

  const handleSubmit = async e => {
    setLoading(true)
    e.preventDefault()
    try {
      // ① 新規チーム作成 API 呼び出し
      const team = await api('/teams/', {
        method: 'POST',
        body: JSON.stringify({ name })
      })
      setLoading(false)
      toast.success("チームが追加されました!")
      // ② チーム一覧更新 & 新規チームを選択
      await refreshTeams()
      selectTeam(team.id)
      // ③ モーダルクローズ（Bootstrap の data-bs-dismiss が効くよう nameクリア）
      setName('')
    } catch (err) {
      // console.error(err)
      // 必要ならエラーメッセージ表示用 state も追加
      setErrors(err)
      setLoading(false)
    }
  }

  return (
    <div
      className="modal fade"
      id="createTeamModal"
      tabIndex="-1"
      aria-hidden="true"
    >
      <div className="modal-dialog">
        <form className="modal-content" onSubmit={handleSubmit}>
          <div className="modal-header">
            <h5 className="modal-title">チーム作成</h5>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
            />
          </div>
          <div className="modal-body">
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
            <input
              type="text"
              className="form-control"
              placeholder="チーム名を入力"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="modal-footer d-flex justify-content-center">
            {isLoading?<Skeleton/>:(
              <>
                <button
                  type="submit"
                  className="btn btn-primary"
                  data-bs-dismiss="modal"
                >
                  作成
                </button>
              </>
             )}
            
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateTeamModal
