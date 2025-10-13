import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Chart } from 'chart.js/auto';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export default function RecordsGraph({ records = [] }) {
  const [isLoading, setLoading] = useState(false);
  const [hasData, setHasData]   = useState(true);
  const [detail, setDetail]     = useState(null); // ["label", hours]

  const [breakdown, setBreakdown] = useState({ breakdown: 'language', filter: 'all' });
  const [subjects, setSubjects]   = useState([]);
  const [choiceSubject, setChoiceSubject] = useState({ subject: '' });

  // ---- canvas 安全取得（callback ref）
  const chartRef = useRef(null);
  const [canvasEl, setCanvasEl] = useState(null);
  const canvasRef = useCallback(node => setCanvasEl(node), []);

  // ---- 初期の科目候補（ユニーク）
  useEffect(() => {
    setLoading(true);
    const map = new Map();
    records.forEach(r => {
      const s = r?.subject;
      if (s?.id) map.set(s.id, s);
    });
    setSubjects(Array.from(map.values()));
    setLoading(false);
  }, [records]);

  // ---- ヘルパ
  const getRecordDate = r =>
    new Date(r?.date ?? r?.end_time ?? r?.start_time ?? Date.now());
  const getRecordHours = r => Math.max(0, (r?.duration ?? 0) / 1000 / 60 / 60);
  const getRecLanguages = r => {
    if (Array.isArray(r?.languages) && r.languages.length) return r.languages;
    if (r?.language) return [r.language]; // 後方互換
    return [];
  };

  // ---- 集計（メモ化）
  const stats = useMemo(() => {
    // 1) 期間フィルタ
    let filtered = records;
    if (breakdown.filter !== 'all') {
      const now = new Date();
      const start = new Date(now);
      if (breakdown.filter === 'week')  start.setDate(now.getDate() - 7);
      if (breakdown.filter === 'month') start.setMonth(now.getMonth() - 1);
      filtered = records.filter(r => getRecordDate(r) >= start);
    }

    // 2) task 内訳のときは subject で絞る
    if (breakdown.breakdown === 'task' && choiceSubject.subject) {
      filtered = filtered.filter(r => String(r?.subject?.id) === String(choiceSubject.subject));
    }

    // 3) グルーピング
    const bucket = {};
    if (breakdown.breakdown === 'language') {
      // 言語：空配列は**完全除外**
      filtered.forEach(r => {
        const hours = getRecordHours(r);
        const langs = getRecLanguages(r);
        if (!langs.length) return;
        const share = hours / langs.length;
        langs.forEach(l => {
          const key = l?.name ?? '(unknown)';
          bucket[key] = (bucket[key] || 0) + share;
        });
      });
    } else {
      filtered.forEach(r => {
        const dt = getRecordDate(r);
        let key = '（不明）';
        switch (breakdown.breakdown) {
          case 'subject': key = r?.subject?.name ?? '（不明）'; break;
          case 'date':    key = dt.toLocaleDateString();        break;
          case 'task':    key = r?.task?.name ?? '（不明）';     break;
          default: break;
        }
        bucket[key] = (bucket[key] || 0) + getRecordHours(r);
      });
    }

    const labels  = Object.keys(bucket);
    const data    = labels.map(k => Number(bucket[k].toFixed(2)));
    const details = labels.map(k => [k, bucket[k]]);

    return { labels, data, details };
  }, [records, breakdown, choiceSubject]);

  // ---- グラフ描画
  useEffect(() => {
    // canvas がまだなら抜ける
    if (!canvasEl || typeof canvasEl.getContext !== 'function') return;

    const { labels, data, details } = stats;

    if (!labels.length) {
      chartRef.current?.destroy();
      chartRef.current = null;
      setHasData(false);
      setDetail(null);
      return;
    }
    setHasData(true);

    // 既存破棄
    chartRef.current?.destroy();
    chartRef.current = null;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: labels.map((_, i) => {
          // HSLの色相を均等にずらしてカラフルに
          const hue = (i * 360 / Math.max(1, labels.length)); // 0〜360を等分
          return `hsl(${hue} 80% 55%)`; // 彩度高め・明度中間でパキッと
        })
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_evt, els) => {
          if (!els?.length) return;
          const idx = els[0].index;
          setDetail([details[idx][0], Number(details[idx][1].toFixed(2))]);
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${Number(ctx.raw).toFixed(2)}h`
            }
          }
        }
      }
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [canvasEl, stats]);

  // ---- ハンドラ
  const onChangeBreakdown = e => {
    const val = e.target.value;
    setBreakdown(b => ({ ...b, breakdown: val }));
    if (val === 'task' && !choiceSubject.subject && subjects[0]) {
      setChoiceSubject({ subject: String(subjects[0].id) });
    }
  };
  const onChangeFilter = e => setBreakdown(b => ({ ...b, filter: e.target.value }));
  const onChangeSubject = e => setChoiceSubject({ subject: e.target.value });

  return (
    <div>
      <div className="row g-3 mt-3 mb-4">
        <div className="col-6 col-md-4">
          <label htmlFor="breakdown" className="form-label">内訳</label>
          <select id="breakdown" className="form-select" value={breakdown.breakdown} onChange={onChangeBreakdown}>
            <option value="subject">全科目別</option>
            <option value="date">日付別</option>
            <option value="language">言語別</option>
            <option value="task">各科目別</option>
          </select>
        </div>

        {breakdown.breakdown === 'task' && (
          <div className="col-6 col-md-4">
            <label htmlFor="subject" className="form-label">科目</label>
            <select id="subject" className="form-select" value={choiceSubject.subject} onChange={onChangeSubject}>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        <div className="col-6 col-md-4">
          <label htmlFor="filter" className="form-label">期間</label>
          <select id="filter" className="form-select" value={breakdown.filter} onChange={onChangeFilter}>
            <option value="all">全期間</option>
            <option value="week">今週</option>
            <option value="month">今月</option>
          </select>
        </div>
      </div>

      <div className="stats-card mx-auto">
        {isLoading ? (
          <Skeleton height="100%" width="100%" />
        ) : (
          <>
            {/* キャンバスは常にマウントしておく（refのnull化を避ける） */}
            <div className="chart-container" style={{ height: 'min(48vh, 360px)' }}>
              <canvas ref={canvasRef} />
            </div>

            {!hasData && (
              <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: 60 }}>
                データがありません
              </div>
            )}

            <div className="mt-3 text-center text-muted stats-detail">
              {detail ? (
                <>
                  <strong>{detail[0]}</strong>
                  <span>{detail[1].toFixed(2)}h</span>
                </>
              ) : (
                <em>クリックで詳細表示</em>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
