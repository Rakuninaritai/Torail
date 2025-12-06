import React, { useEffect, useState } from 'react'
import DeleteTimer from './DeleteTimer'
import { api } from "../../api";

import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';
import LanguageModalPicker from '../AddRecords/LanguageBubblPicker';

const RecordDetail = ({cf,rec,token,teams}) => {
  const [isLoading, setLoading] = useState(false);
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const [isEditing,setIsediting]=useState(false)
  const onEdit=()=>{
    setIsediting(!isEditing)
  }
  // フォーム内の値をローカル state に保持
  const [formData, setFormData] = useState({
    subject:    rec.subject.id,
    task:       rec.task.id,
    // 旧: rec.language.id → 新: 配列
    languages:  Array.isArray(rec.languages)
                  ? rec.languages.map(l => l.id)
                  : (rec.language ? [rec.language.id] : []),
    duration:      Math.round(rec.duration/1000/60),
    // ↑分にしてる
    date:       rec.date,
    description:       rec.description,
    user:rec.user.username,
    team:rec.team
  })
  // 値が変わったら更新する
  const handleChange=(e)=>{
    setFormData({...formData,[e.target.name]:e.target.value})
  }
  const handleTeamChange = e => {
    const nextTeam = e.target.value || null  // "" にして「個人」扱い
    // ★ まずそのチーム(or 個人)に属する科目を抽出
  const nextSubjects = subjects.filter((s) =>
    nextTeam == null ? s.team == null : s.team == nextTeam
  );

  // ★ 先頭科目 ID を決める（無ければ ""）
  const firstSubId = nextSubjects[0]?.id ?? "";
  const firstTasId= tasks.find(task => task.subject == firstSubId).id
    setFormData({
      ...formData,
      team:    nextTeam,
      subject: firstSubId, 
      task:    firstTasId,    
    })
  }

  // 個人の統計だと個人のもの全部見える(チーム問わず)
  // チームの統計だとチームの全部見える(編集はそのユーザーだけ)()

  // 選択肢のある奴のusestate
  const [subjects,setSubjects]=useState([])
  const [tasks,setTasks]=useState([])
  const [languages,setLanguages]=useState([])
  const [filteredSubjects,setFilteredSubjects]=useState([])
  // トピック
  const [filteredTasks,setFilteredTasks]=useState([])
  // データ取得(第二が[]につきレンダリング時のみ実行)
  useEffect(()=>{
    const shutoku = async ()=>{
          setLoading(true)
          try{
            const ss=await api('/subjects/?team=all',{
              method: 'GET',
            })
            setSubjects(ss)
            const st=await api('/tasks/?team=all',{
              method: 'GET',
            })
            setTasks(st)
            // console.log(ss)
            // console.log(st)
            // taskが一つ以上あるsubjectのみに変更
            const subjectsWithTasks = ss.filter(subject =>
              // 各subjectで1以上あればtrue返す
              st.some(task => task.subject === subject.id)
            );
            setSubjects(subjectsWithTasks)
            const sl=await api('/master/languages/',{
              method: 'GET',
            })
            setLanguages(sl)
            setLoading(false)
          }catch (err) {
            // console.error(err);
            setLoading(false)
            setErrors(err)
          }
            
        }
        shutoku()
  },[])
  useEffect(()=>{
    // チーム選択がない (個人モード) なら team=null の科目だけ
    if (!formData.team) {
      setFilteredSubjects(subjects.filter(sub => sub.team == null));
    } else {
      // チームモード ならチームのだけ
      setFilteredSubjects(
        subjects.filter(sub => {
          const tid =sub.team 
          return tid == formData.team;
        })
      );
    }
  },[formData.team,subjects])
  // formdataのsubjectが変わったらタスクを更新する
  useEffect(()=>{
    // トピックに値が入っているなら(id)
    if(formData.subject){
      const filtered = tasks.filter(task => task.subject == formData.subject)
      // それらを選択肢とする
      setFilteredTasks(filtered)
    } else {
      setFilteredTasks([])
    }
  },[formData.subject,tasks,formData.team])
  // figma記載の詳細編集対応して
  // バリでやって設定いってダッシュへ

  // 送信ボタン押されたら
  const handleSubmit=async (e)=>{
    setLoading(true)
    // ページがreloadして送信をデフォルトではしようとするがそれをキャンセルしている
    e.preventDefault();
    
    // 送るデータにformとstart時刻を追加する
    const recordData={
      ...formData,
      duration: formData.duration * 60 * 1000,
    }
    // postで送る
    try{
        const data=await api(`/records/${rec.id}/`,{
        method: 'PATCH',
        body:JSON.stringify(recordData),
        })
        // console.log("学習記録が追加されました",data)
        toast.success("学習記録が変更されました!")
        setLoading(false)
        cf(null)
        }catch(err){
          // console.error(err);
          toast.error("変更に失敗しました。")
          setLoading(false)
          setErrors(err)
        }
  }
  return (
    <div className="detail-wrapper">
    <div className="record-card">
      <h2 className="mb-3">
        <i className="bi bi-journal-text" /> 学習記録 詳細
      </h2>
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
      <form id="recordForm"  onSubmit={handleSubmit} >
        {/* 科目・タスク・言語 */}
        <div className="row g-3 mb-3">
          <div className="col-md">
            <label className="form-label" htmlFor="subject">科目</label>
            {errors.subject && (
              <div className="text-danger mt-1">
                {errors.subject.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
            </div>)}
            <select className='form-control ' name='subject' value={formData.subject} onChange={handleChange} disabled={!isEditing}>
              {/* usestateのsubjectsをmap関数で1つをsubとして回す */}
              {filteredSubjects.map((sub)=>(
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>
          <div className="col-md">
            <label className="form-label" htmlFor="task">タスク</label>
            {errors.task && (
              <div className="text-danger mt-1">
                {errors.task.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
            </div>)}
            <select  className='form-control ' name='task' value={formData.task} onChange={handleChange} disabled={!isEditing}>
              
              {filteredTasks.map((task)=>(
                <option key={task.id} value={task.id}>{task.name}</option>
              ))}
            </select>
          </div>
          <div className="col-md">
            <label className="form-label">言語（複数選択可）</label>
            {errors.languages && (
              <div className="text-danger mt-1">
                {errors.languages.map((msg, i) => <div key={i}>{msg}</div>)}
              </div>
            )}
            <LanguageModalPicker
              languages={languages}                 // GET /languages/ の結果
              value={formData.languages}            // 配列のID
              onChange={(ids) => setFormData(prev => ({ ...prev, languages: ids }))}
              disabled={!isEditing}
            />
          </div>
        </div>

        {/* 時間・日付・開始時刻 */}
        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <label className="form-label" htmlFor="hours">学習時間 (分)</label>
            {errors.duration && (
              <div className="text-danger mt-1">
                {errors.duration.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
            </div>)}
            <input
              id="hours"
              name="duration"
              type="number"
              step="0.1"
              className="form-control"
              value={formData.duration }
              disabled={!isEditing}
              min={0}//0以上
              onChange={handleChange}
              inputMode="numeric"      // スマホで数字キーボードを開く
              pattern="\d+"            // 数字（0–9）のみを許可
              title="正の整数を入力してください"
              onInvalid={e => e.target.setCustomValidity("正の整数を入力してください")}  //エラー時表示文字
              onInput={e => e.target.setCustomValidity("")}  //クリア文字
            />
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="date">日付</label>
            {errors.date && (
              <div className="text-danger mt-1">
                {errors.date.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
            </div>)}
            <input
              id="date"
              name="date"
              type="date"
              className="form-control"
              value={formData.date}
              disabled={!isEditing}
              onChange={handleChange}
            />
          </div>
          <div className="col-md">
            <label className="form-label" htmlFor="team">チーム</label>
            {errors.team && (
              <div className="text-danger mt-1">
                {errors.team.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
            </div>)}
            <select  className='form-control ' name='team' value={formData.team ?? null} onChange={handleTeamChange} disabled={!isEditing}>
              <option value="">個人</option>
              {teams.map((team)=>(
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* メモ */}
        <div className="mb-3">
          <label className="form-label" htmlFor="memo">メモ</label>
          {errors.description && (
              <div className="text-danger mt-1">
                {errors.description.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
            </div>)}
          <textarea
            id="memo"
            name="description"
            rows="3"
            className="form-control"
            value={formData.description}
            disabled={!isEditing}
            onChange={handleChange}
          />
        </div>
         {/* ユーザー */}
        <div className="mb-3">
          <label className="form-label" htmlFor="user">ユーザー</label>
          <input
            id="user"
            name="user"
            rows="3"
            className="form-control"
            value={formData.user}
            disabled
          />
        </div>

        {/* アクションボタン */}
        {isLoading?<Skeleton/>:(
          <div className="d-flex gap-2 justify-content-end">
            {!isEditing ? (
              // 記録者が今見てるユーザーか
              ((Number(token?.id ?? token?.pk) === rec.user.id) ? (
                <>
                <button
                  type="button"
                  id="editBtn"
                  className="btn btn-outline-primary"
                  onClick={()=>{
                    // マウスのmouseupが終わってから切り替える
                    window.requestAnimationFrame(() => onEdit());
                  }}
                >
                  <i className="bi bi-pencil" /> 編集
                </button>
                <DeleteTimer token={token} record={rec} settimerchange={()=>{cf(null)}}/>
                <button
                    type="button"
                    id="cancelBtn"
                    className="btn btn-secondary"
                    onClick={()=>cf(null)}
                  >
                    キャンセル
                  </button>
                </>
              ):(
                <>
                  <button
                  type="button"
                  id="cancelBtn"
                  className="btn btn-secondary"
                  onClick={()=>cf(null)}
                >
                  キャンセル
                </button>
                </>
              ))
              
            ) : (
              <>
                <button
                  type="submit"
                  // type="button"
                  id="saveBtn"
                  className="btn btn-success"
                  // onClick={handleSubmit}
                >
                  <i className="bi bi-save" /> 保存
                </button>
                <DeleteTimer token={token} record={rec} settimerchange={()=>{cf(null)}}/>
                <button
                  type="button"
                  id="cancelBtn"
                  className="btn btn-secondary"
                  onClick={()=>cf(null)}
                >
                  キャンセル
                </button>
              </>
            )}
          </div>
        )}
        
      </form>
    </div>
  </div>
  )
}

export default RecordDetail