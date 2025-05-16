import React, { useEffect, useRef, useState } from 'react'
import { Chart } from 'chart.js/auto';

const RecordsGraph = ({records}) => {
  // recordsは各recordが入っている
  // ---選択しようstateのみなさん---
  // 各ブレイクダウンの状況用state
  const [breakdown,setBreakdown]=useState({
    breakdown:"language",
    filter:"all",
  })
  const [selectSubject,SetSelectSubject]=useState([])
  const [choiceSubject,setChoiceSubject]=useState(
    {
      subject:""
    }
  )
  useEffect(()=>{
    // 東福を排除して登録するためにmapにする
    const uniqueSubjects=new Map()
    // mapでsetを使うと重複項目は最後のもののみ保持される
    records.forEach(r => {
      uniqueSubjects.set(r.subject.id, r.subject);
    });
    // 配列にしてstateに入れてる(valuesに入っているらしい)
    SetSelectSubject(Array.from(uniqueSubjects.values()))
  },[records])
  // 値が変わったら更新する
  const handleChange=(e)=>{
    setBreakdown({...breakdown,[e.target.name]:e.target.value})
    // taskで最初の時は選ばれてない状態(onchangeだから)なので最初の教科の課題割合表示
    if(e.target.value==="task"&&choiceSubject.subject===""){
      setChoiceSubject({subject:String(selectSubject[0].id)})
    }
  }
  // 値が変わったら更新する(選んだ教科)
  const handleChangeSub=(e)=>{
    setChoiceSubject({...choiceSubject,[e.target.name]:e.target.value})
  }

  const canvasRef = useRef(null);   // <canvas> DOM 参照
  const chartRef  = useRef(null);   // Chart.js インスタンス

  // 集計関数
  const computeStats=()=>{
    // 期間フィルタ(allならこのままいく、下でフィルターかけたら再定義するのでlet)
    let filtered=records
    // フィルターが全日程でないなら
    if (breakdown.filter!=="all"){
      const now =new Date()
      const start = new Date(now)
      // フィルターが週ならstartは今の日にちから-7したとき
      if(breakdown.filter==="week"){
        start.setDate(now.getDate()-7)
      }
      // フィルターが月なら今の月から-1したとこがスタート
      if (breakdown.filter === 'month') {
        start.setMonth(now.getMonth() - 1)
      }
        filtered=records.filter(r=>new Date(r.date)>=start)
    }

    // 課題別
    if (breakdown.breakdown==="task"){
      filtered=filtered.filter(r=>String(r.subject.id)===choiceSubject.subject)
    }

    // 内訳に応じてkeyを決める
    const map ={}
    filtered.forEach(r=>{
       const dt = new Date(r.date);
      let key;
      // ーーーーーーーkeyは配列じゃないのにいけるの??
      switch (breakdown.breakdown) {
        // 内訳が教科なら教科名がkeyになる
        case "subject": key=r.subject.name ;break;
        case "date": key=dt.toLocaleDateString() ;break;
        case "language": key=r.language.name ;break;
        case "task": key=r.task.name;break;
        default:
          break;
      }
      // 時間を足し合わせる
      const hours    = r.duration/1000/60/60;
      // その教科(or 日にち)の時間にあれば足し合わせ、なければ0から
      map[key] = (map[key] || 0) + hours;
    })
    // ラベルずとして各keyだけを集める
    const labels=Object.keys(map)
    // データとして各値を2桁で取る
    const data=labels.map(l=>Number(map[l].toFixed(2)))
    // ラベルずがキーで数値が値の奴を作る(これはmapと同じだけど配列にしないとchartは)
    const details=labels.map(l=>[l,map[l]])
    return {labels,data,details}
  }
  //--useEffect-recordやui状態(選択) が変わるたびに描画
  useEffect(()=>{
    const {labels,data,details}=computeStats()
    // 古いグラフを破棄
    if(chartRef.current)chartRef.current.destroy();

    chartRef.current=new Chart(canvasRef.current,{
      type:"pie",
      data:{
        labels,
        datasets:[{
          data,
          backgroundColor:labels.map(
            (_,i)=>`hsl(${i*360/labels.length},75%,50%)`
          )
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        onClick:(_,el)=>{
          if(!el.length) return;
          const idx=el[0].index;
          const dt=details[idx];
          document.getElementById("detailView").innerHTML=
          `<strong>${dt[0]}</strong>:${dt[1].toFixed(2)}h`;
        }
      }
    })
    // クリーンアップ関数
    return()=>chartRef.current?.destroy()
  },[records,breakdown,choiceSubject])
  
  
  return (
    <div>
      <div className="row g-3 mt-3 mb-4">
          <div className="col-6 col-md-4">
            <label htmlFor="breakdown" className="form-label">内訳</label>
            <select id="breakdown" className="form-select" name='breakdown'  value={breakdown.breakdown} onChange={handleChange}>
              <option value="subject">全科目別</option>
              <option value="date">日付別</option>
              <option value="language">言語別</option>
              <option value="task">各科目別</option>
            </select>
          </div>
          {/* 各科目を選ばれたらそれを出す */}
          {breakdown.breakdown==="task"&&(<div className="col-6 col-md-4">
            <label htmlFor="subject" className="form-label">内訳</label>
            <select id="subject" name='subject' className="form-select"  value={choiceSubject.subject} onChange={handleChangeSub}>
              {/* usestateのsubjectsをmap関数で1つをsubとして回す */}
            {selectSubject.map((sub)=>(
              <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>)}
          <div className="col-6 col-md-4">
            <label htmlFor="filter" className="form-label">期間</label>
            <select id="filter" className="form-select"  name='filter' value={breakdown.filter} onChange={handleChange}>
              <option value="all">全期間</option>
              <option value="week">今週</option>
              <option value="month">今月</option>
            </select>
          </div>
        </div>
        <div className="stats-card mx-auto">
          <div className="chart-container"  style={{ height:'300px' }}>
            <canvas ref={canvasRef} />
          </div>
          <div id="detailView" className="mt-3 text-center text-muted">
            <em>クリックで詳細表示</em>
          </div>
        </div>
    </div>
  )
}

export default RecordsGraph