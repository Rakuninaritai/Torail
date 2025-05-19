import React, { useEffect, useState } from 'react'
import RecordsGraph from './RecordsGraph';
import RecordDetailBtn from './RecordDetailBtn';
import RecordDetail from './RecordDetail';
import DeleteTimer from './DeleteTimer';

const RecordsList = ({token}) => {
  // Vite のケース
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const [records,setRecords]=useState([]);
  // 詳細ボタンが押されたらこのstateを変えて切換え(押されたらtrue)
  const [detailPush,setDetailPush]=useState(null)
  // 初回のみ実行
  useEffect(() => {
    // APIを呼び出す
    fetch(`${API_BASE}/records/`,{
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${token}`
      }
    })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json(); // JSONデータを取得
    })
    .then((data) => {
      console.log("Fetched records:", data);
      // 保存済みのstateのみ取得
      const runninged = data.filter(record => record.timer_state===2 );
      setRecords(runninged);  // data は配列のはず
    })
    // エラーが出るとcatchでerrorに格納
    .catch((error)=>console.error("Error fetching records:",error));
  },[detailPush]);

  return (
    
    <div>
      {detailPush===null?(
        <div>
          <div className="table-responsive">
            <table className="table mb-0">
              <thead className="table-light"><tr><th>科目</th><th>時間</th><th>日時</th><th>詳細・編集・削除</th></tr></thead>
              <tbody id="recordsBody">
                {records.map((record)=>(
                <tr key={record.id}>
                  <td>{record.date}</td>
                  <td>{record.task.name}</td>
                  <td>{record.duration}分</td>
                  {/* 詳細ボタン */}
                  <td><RecordDetailBtn cf={setDetailPush} rec={record}/></td>
                </tr>
                ))}
              </tbody>
            </table>
        </div>
        {/* ここに円グラフコンポーネント作る */}
        {/* 絞り込み対象は二つ(日付(総作業時間)、言語、科目、さらに科目指定(課題)) */}
        {/* 範囲は全期間、今月、今週、今日 */}
        {/* もしかしたらdateの取得をグラフのコンポ根で実施して表示データ自体を絞るかも */}
        <RecordsGraph records={records}/>
      </div>
      ):(<RecordDetail cf={setDetailPush} rec={detailPush} token={token}/>)}
      
    
    </div>
  )
}

export default RecordsList