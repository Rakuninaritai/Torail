// RecordsGraph.jsx（差し替え：詳細はここだけでOK）
import React, { useEffect, useRef, useState } from 'react'
import { Chart } from 'chart.js/auto';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const PALETTE = [
  '#4C78A8', '#F58518', '#54A24B', '#E45756',
  '#72B7B2', '#FF9DA6', '#B279A2', '#9D755D',
]; // 地味め、ループ使用

export default function RecordsGraph({ records }) {
  const [isLoading, setLoading] = useState(false);
  const [hasData, setHasData] = useState(true);
  const [breakdown, setBreakdown] = useState({ breakdown: 'language', filter: 'all' });
  const [selectSubject, SetSelectSubject] = useState([]);
  const [choiceSubject, setChoiceSubject] = useState({ subject: '' });

  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [activeDetail, setActiveDetail] = useState(null); // クリック時の詳細

  // 安全ヘルパ
  const getRecordDate = (r) => new Date(r?.date ?? r?.end_time ?? r?.start_time ?? Date.now());
  const getRecordHours = (r) => Math.max(0, ((r?.duration ?? 0) / 1000 / 60 / 60));
  const getRecLanguages = (r) => {
    if (Array.isArray(r?.languages) && r.languages.length) return r.languages;
    if (r?.language) return [r.language];
    return [];
  };
  const getLangName = (l) =>
    typeof l === 'string' ? l : (l?.name ?? '未選択');

  useEffect(() => {
    setLoading(true);
    const m = new Map();
    records.forEach(r => { if (r?.subject?.id) m.set(r.subject.id, r.subject); });
    SetSelectSubject(Array.from(m.values()));
    setLoading(false);
  }, [records]);

  // task内訳に切替直後のガード
  useEffect(() => {
    if (breakdown.breakdown === 'task' && !choiceSubject.subject && selectSubject.length > 0) {
      setChoiceSubject({ subject: String(selectSubject[0].id) });
    }
  }, [breakdown.breakdown, selectSubject]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setBreakdown(prev => ({ ...prev, [name]: value }));
    if (name === 'breakdown' && value === 'task' && !choiceSubject.subject && selectSubject[0]) {
      setChoiceSubject({ subject: String(selectSubject[0].id) });
    }
  };
  const handleChangeSub = (e) => setChoiceSubject({ ...choiceSubject, [e.target.name]: e.target.value });

  const computeStats = () => {
    let filtered = records;
    if (breakdown.filter !== 'all') {
      const now = new Date();
      const start = new Date(now);
      if (breakdown.filter === 'week') start.setDate(now.getDate() - 7);
      if (breakdown.filter === 'month') start.setMonth(now.getMonth() - 1);
      filtered = records.filter((r) => getRecordDate(r) >= start);
    }
    if (breakdown.breakdown === 'task' && choiceSubject.subject) {
      filtered = filtered.filter((r) => String(r?.subject?.id) === String(choiceSubject.subject));
    }

    const bucket = {};
    if (breakdown.breakdown === 'language') {
      filtered.forEach((r) => {
        const hours = getRecordHours(r);
        const langs = getRecLanguages(r);
        if (!langs.length) {
          bucket['未選択'] = (bucket['未選択'] || 0) + hours;
          return;
        }
        const share = hours / langs.length;
        langs.forEach((l) => {
          const key = getLangName(l);
          bucket[key] = (bucket[key] || 0) + share;
        });
      });
    } else {
      filtered.forEach((r) => {
        const dt = getRecordDate(r);
        let key = '（不明）';
        switch (breakdown.breakdown) {
          case 'subject': key = r?.subject?.name ?? '（不明）'; break;
          case 'date':    key = dt.toLocaleDateString();      break;
          case 'task':    key = r?.task?.name ?? '（不明）';   break;
          default: break;
        }
        bucket[key] = (bucket[key] || 0) + getRecordHours(r);
      });
    }

    const labels = Object.keys(bucket);
    const data = labels.map(k => Number(bucket[k].toFixed(2)));
    const details = labels.map(k => ({ label: k, hours: bucket[k] }));
    return { labels, data, details };
  };

  useEffect(() => {
    const { labels, data, details } = computeStats();
    if (!labels.length) {
      chartRef.current?.destroy();
      setHasData(false);
      setActiveDetail(null);
      return;
    }
    setHasData(true);

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 14, usePointStyle: true, pointStyle: 'circle' } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed.toFixed(2)} h` } }
        },
        onClick: (_, el) => {
          if (!el.length) return;
          const idx = el[0].index;
          setActiveDetail(details[idx]); // stateで描画
        }
      }
    });

    return () => chartRef.current?.destroy();
  }, [records, breakdown, choiceSubject]);

  return (
    <div>
      <div className="row g-3 mt-3 mb-4">
        <div className="col-12 col-md-4">
          <label htmlFor="breakdown" className="form-label">内訳</label>
          <select id="breakdown" className="form-select" name="breakdown"
            value={breakdown.breakdown} onChange={handleChange}>
            <option value="subject">全科目別</option>
            <option value="date">日付別</option>
            <option value="language">言語別</option>
            <option value="task">各科目別</option>
          </select>
        </div>

        {breakdown.breakdown === 'task' && (
          <div className="col-12 col-md-4">
            <label htmlFor="subject" className="form-label">科目</label>
            <select id="subject" name="subject" className="form-select"
              value={choiceSubject.subject} onChange={handleChangeSub}>
              {selectSubject.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="col-12 col-md-4">
          <label htmlFor="filter" className="form-label">期間</label>
          <select id="filter" className="form-select" name="filter"
            value={breakdown.filter} onChange={handleChange}>
            <option value="all">全期間</option>
            <option value="week">今週</option>
            <option value="month">今月</option>
          </select>
        </div>
      </div>

      <div className="stats-card mx-auto">
        {isLoading ? (
          <Skeleton height="100%" width="100%" />
        ) : !hasData ? (
          <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: '100%' }}>
            データがありません
          </div>
        ) : (
          <>
            <div className="chart-container" style={{ height: 'clamp(220px, 32vh, 360px)' }}>
              <canvas ref={canvasRef} />
            </div>
            <div className="mt-3 d-flex justify-content-center">
              {activeDetail ? (
                <div style={{
                  maxWidth: '640px', width: '100%', padding: '12px 14px',
                  border: '1px solid #e5e7eb', borderRadius: 8,
                  display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap'
                }}>
                  <span style={{ fontWeight: 600, wordBreak: 'break-word' }}>{activeDetail.label}</span>
                  <span style={{ color: '#6b7280' }}>{activeDetail.hours.toFixed(2)} h</span>
                </div>
              ) : (
                <div className="text-muted"><em>セグメントをクリックで詳細</em></div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
