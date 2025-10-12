import React, { useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";
import "./user-cards.css";

/** シンプルなヒートマップ（0〜4の強度配列） */
function Heatmap({ values }) {
  return (
    <div className="heatmap">
      {values.map((v, i) => <div key={i} className={`cell${v ? ` on-${v}` : ""}`} />)}
    </div>
  );
}

function useChart(ref, config) {
  const chartRef = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(ref.current.getContext("2d"), config);
    return () => chartRef.current?.destroy();
  }, [ref, JSON.stringify(config)]);
}

/** 継続・活動状況（見やすいKPI＋ヒートマップ＋スパークライン＋円グラフ） */
export default function MetricsCard({ kpi, activity30, langBreakdown }) {
  const sparkRef = useRef(null);
  const pieRef = useRef(null);

  // スパークライン（0/1）
  useChart(sparkRef, {
    type: "line",
    data: {
      labels: activity30.map((_, i) => i + 1),
      datasets: [{ data: activity30.map((v) => (v > 0 ? 1 : 0)), tension: 0.25, pointRadius: 0 }],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 1, ticks: { stepSize: 1 } } } },
  });

  // 言語円グラフ
  const labels = langBreakdown.map((x) => x.label);
  const data = langBreakdown.map((x) => Number(x.hours.toFixed(2)));
  useChart(pieRef, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: labels.map((_, i) => {
          const L = 72 - (32 * i / Math.max(1, labels.length - 1));
          return `hsl(210 60% ${Math.max(40, L)}%)`;
        })
      }]
    },
    options: { plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 12 } } } },
  });

  const pct = (x, base) => Math.max(0, Math.min(100, Math.round((x / base) * 100)));

  return (
    <section className="torail-card mb-4">
      <div className="d-flex align-items-center justify-content-between">
        <h6 className="mb-0">継続・活動状況</h6>
      </div>

      {/* KPIs */}
      <div className="kpi-row mt-2">
        <div className="kpi">
          <div className="label">現在ストリーク</div>
          <div className="value"><span>{kpi.streakNow}</span>日</div>
          <div className="bar mt-1"><span style={{ width: `${pct(kpi.streakNow, kpi.goal || 20)}%` }} /></div>
          <small className="text-muted">目標: {kpi.goal || 20}日</small>
        </div>
        <div className="kpi">
          <div className="label">最長ストリーク</div>
          <div className="value"><span>{kpi.streakMax}</span>日</div>
          <div className="bar mt-1"><span style={{ width: `${pct(kpi.streakMax, kpi.maxBase || 30)}%` }} /></div>
          <small className="text-muted">直近更新: {kpi.lastUpdate || "—"}</small>
        </div>
        <div className="kpi">
          <div className="label">直近7日</div>
          <div className="value"><span>{kpi.active7}</span>日</div>
          <div className="bar mt-1"><span style={{ width: `${pct(kpi.active7, 7)}%` }} /></div>
          <small className="text-muted">休み: {kpi.offHint || "—"}</small>
        </div>
        <div className="kpi">
          <div className="label">直近30日</div>
          <div className="value"><span>{kpi.active30}</span>日</div>
          <div className="bar mt-1"><span style={{ width: `${pct(kpi.active30, 30)}%` }} /></div>
          <small className="text-muted">達成率 {pct(kpi.active30, 30)}%</small>
        </div>
      </div>

      <div className="row g-3 mt-2">
        <div className="col-12">
          <div className="subtle mb-1">直近30日の活動ヒートマップ</div>
          <Heatmap values={activity30} />
        </div>
        <div className="col-12 col-lg-7">
          <canvas ref={sparkRef} height="120" />
        </div>
        <div className="col-12 col-lg-5">
          <div className="subtle mb-1">これまで使ってきた言語（参考）</div>
          <div style={{ height: 170 }}><canvas ref={pieRef} /></div>
        </div>
      </div>
    </section>
  );
}
