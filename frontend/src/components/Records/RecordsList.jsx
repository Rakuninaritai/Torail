import React, { useEffect, useState } from 'react'
import RecordsGraph from './RecordsGraph';
import RecordDetailBtn from './RecordDetailBtn';
import RecordDetail from './RecordDetail';
import DeleteTimer from './DeleteTimer';
import { api } from "../../api";
import { useTeam } from '../../context/TeamContext';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';

const RecordsList = ({token}) => {
  const [isLoading, setLoading] = useState(false);
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const [records,setRecords]=useState([]);
  // 詳細ボタンが押されたらこのstateを変えて切換え(押されたらtrue)
  const [detailPush,setDetailPush]=useState(null)
  const[teams,setTeams]=useState([])
  // 今選ばれてるteamのidornull(個人)
  const { currentTeamId} = useTeam();
  // 初回のみ実行
  useEffect(() => {
    const shutoku = async ()=>{
      setLoading(true)
      // 個人 or チーム API エンドポイントを切替
      const path = currentTeamId
        ? `/records/?team=${currentTeamId}`
        : '/records/?mine=true';
      try{
        const data=await api(path,{
          method: 'GET',
        })
        // 保存済みのstateのみ取得
        const runninged = data.filter(record => record.timer_state===2 );
        setRecords(runninged);  // data は配列のはず
        setLoading(false)
      }catch (err) {
        // console.error(err);
        setLoading(false)
        toast.error("データの取得に失敗しました。")
        setErrors(err)
      }
      // チーム一覧を取得
      setLoading(true)
      try{
      const data=await api('/teams/',{
        method: 'GET',
      })
      setTeams(data);  // data は配列のはず
      setLoading(false)
      // console.log(data)
      }catch (err) {
        // console.error(err);
        setLoading(false)
        toast.error("チームの取得に失敗しました。")
        setErrors(err)
      }
        
    }
   shutoku()
    
  },[detailPush,currentTeamId]);

  return (
    
    <div>
      {detailPush===null?(
        <div>
          {/* 送信エラー */}
          {errors.detail && (
            <div className="text-danger mt-1">
              <div>{errors.detail}</div>
            </div>
          )}
          {/* ここに円グラフコンポーネント作る */}
          {/* 絞り込み対象は二つ(日付(総作業時間)、言語、科目、さらに科目指定(タスク)) */}
          {/* 範囲は全期間、今月、今週、今日 */}
          {/* もしかしたらdateの取得をグラフのコンポ根で実施して表示データ自体を絞るかも */}
          <RecordsGraph records={records}/>
          <div className="table-responsive">
            <h2>記録一覧</h2>
            <table className="table mb-0">
              <thead className="table-light"><tr><th>日時</th>{currentTeamId?<th>ユーザー</th>:<th>チーム</th>}<th>科目</th><th>タスク</th><th>時間</th><th>詳細・編集・削除</th></tr></thead>
              <tbody id="recordsBody">
                {isLoading?<tr><td colSpan={6}><Skeleton width="100%"/></td></tr>:records.length==0?(<tr><td colSpan={6} className="text-center text-muted py-4">データがありません</td></tr>):(
                  records
                  .slice() // 破壊しないコピー
                  .sort((a, b) =>
                    // sortはabを取り出し比較する返り値が+なら入れ替える、-なら入れ替えない(data.parseはミリ秒にしてる)
                    Date.parse( b.date) -
                    Date.parse(a.date)
                  )
                  .map((record)=>(
                    <tr key={record.id}>
                      <td>{record.date}</td>
                      {currentTeamId?<td>{record.user.username}</td>:<td>{teams.find(team=>team.id===record.team)?.name?? '個人'}</td>}
                      <td>{record.subject.name}</td>
                      <td>{record.task.name}</td>
                      <td>{Math.round(record.duration/1000/60)}分</td>
                      {/* 詳細ボタン */}
                      <td><RecordDetailBtn cf={setDetailPush} rec={record}/></td>
                    </tr>
                    ))
                )}
                
              </tbody>
            </table>
        </div>
        
      </div>
      ):(<RecordDetail cf={setDetailPush} rec={detailPush} token={token} teams={teams}/>)}
      
    
    </div>
  )
}

export default RecordsList