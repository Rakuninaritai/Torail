import React, { useEffect } from 'react'
import { useState } from 'react';
import { api } from "../../api";
import { Navigate, useNavigate } from 'react-router-dom';
import { useTeam } from '../../context/TeamContext';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';
import NotifyMethodSelector from './NotifyMethodSelector';
import DiscordPanel from './DiscordPanel';
import SlackPanel from './SlackPanel';
import EmailPanel from './EmailPanel';

const Settings_Team = () => {
  const [isLoading, setLoading] = useState(false);
  const { currentTeamId, refreshTeams,selectTeam} = useTeam();
  const navigate = useNavigate(); 
  const [formData, setFormData] = useState({ name: '', });
  // 引っ張ってきたデータ(こいつがformdataと一緒なら送らない)
  const [initialData, setinitialData] = useState({ name: '' ,id:''});
  const [isEditing, setIsEditing] = useState(false);
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
  const [team, setTeam] = useState(null); // name等もまとめて保持
  const [notifyMode, setNotifyMode] = useState("off");

  useEffect(() => {
  const f = async () => {
    setLoading(true);
    try {
      const t = await api(`/teams/${currentTeamId}/`, { method: "GET" });
      setTeam(t);
      // form用これを変えていく
      setFormData({ name: t.name });
      // 引っ張て来たデータ参照用
      setinitialData({ name: t.name, id: t.id });
      setNotifyMode(t.notify_mode || "auto");
    } catch (e) { setErrors(e); }
    finally { setLoading(false); }
  };
  if (currentTeamId) f();
}, [currentTeamId]);
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
            const data=await api(`/teams/${currentTeamId}/`,{
            method: 'DELETE',
            })
            // console.log("削除が完了しました。",data)
            toast.success("削除が完了しました!")
            selectTeam(null)
            setLoading(false)
            // replacetrueで履歴付けずにリダイレクト
            refreshTeams()
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
    setFormData({...formData,[e.target.name]:e.target.value.replace(/\//g, '')})
  }
  const handleSubmit=async (e)=>{
    setLoading(true)
    // ページがreloadして送信をデフォルトではしようとするがそれをキャンセルしている
    e.preventDefault();
    
    // 送るデータ
    const recordData={
      ...formData,
    }
    // 変更がなければ送らないようにする
    if(recordData.name===initialData.name){
      setLoading(false)
      delete recordData.name
    }
    console.log(recordData)
    // 送る
    try{
        const data=await api(`/teams/${currentTeamId}/`,{
        method: 'PATCH',
        body:JSON.stringify(recordData),
        })
        // console.log("ユーザー情報が更新されました",data)
        toast.success("チーム情報が更新されました!")
        setLoading(false)
        await refreshTeams()
        navigate(`/${encodeURIComponent(recordData.name)}/settings`, { replace: true });
        handleEdit()
        }catch(err){
          // console.error(err);
          toast.error("チーム情報更新に失敗しました。")
          setLoading(false)
          setErrors(err)
        }
  }


  return (
    <div className='timer-card mx-auto'>
      <form onSubmit={handleSubmit}>
        <h2>チーム編集・削除</h2>
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
            <label  htmlFor="name" className="form-label">チーム名</label>
            <input type="text" className='form-control mb-3' name='name' value={formData.name} onChange={handleChange} required disabled={!isEditing} pattern="(?!.*\/)[!-~]+"
             title="半角英数字・記号（!～~）のみで入力してください。ただし / は使用不可。"/>
            {errors.name && (
              <div className="text-danger mt-1">
                {errors.username.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
              </div>
            )}
          
          <br />
          
          
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
        
      </form>
      <hr className="my-4" />
      <h3 className="mb-3">通知設定</h3>

      {isLoading ? (
        // セレクタ＋3パネル分のSkeletonをまとめて
        <div className="d-grid gap-3">
          <Skeleton height={80} />
          <Skeleton height={220} />
          <Skeleton height={220} />
          <Skeleton height={140} />
        </div>
      ) : (
        <>
          <NotifyMethodSelector
            teamId={currentTeamId}
            initialMode={notifyMode}
            onChange={setNotifyMode}
            loading={isLoading || notifyMode === null}
          />
          <div className="mt-3 d-grid gap-3">
            <SlackPanel   teamId={currentTeamId} enabled={notifyMode === "slack"} />
            <DiscordPanel teamId={currentTeamId} enabled={notifyMode === "discord"} />
            <EmailPanel   teamId={currentTeamId} enabled={notifyMode === "email"} />
          </div>
        </>
      )}


    </div>
    
  )
}

export default Settings_Team