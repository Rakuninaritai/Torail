import React, { useMemo, useState } from "react";
import ScoutFilters from "../components/Scoutbox/ScoutFilters";
import ScoutList from "../components/Scoutbox/ScoutList";
import DetailDrawer from "../components/Scoutbox/DetailDrawer";
import "../components/Scoutbox/scoutbox.css";

export default function ScoutBoxPage() {
  // ダミーデータ
  const [items, setItems] = useState([
    {
      id: "1",
      company: "Torail株式会社",
      status: "未読",
      subject: "カジュアル面談のご相談",
      snippet: "山本さん、Pythonの継続が素晴らしく… 現在ストリーク8日達成中とのことで…",
      tags: ["新卒", "フルリモート"],
      sentAt: "2025-09-12 14:21",
      body: "山本さん、Pythonの継続が素晴らしく、現状のプロジェクトでも活躍できると感じました。平日18–21時のどこかでオンラインにてお話できませんか？",
      jobUrl: "#",
      from: "採用担当 田中",
    },
    {
      id: "2",
      company: "Example Inc.",
      status: "返信あり",
      subject: "長期インターンのご提案",
      snippet: "TypeScriptでの開発経験を拝見し…ポジションのご紹介を…",
      tags: ["インターン", "出社/一部リモート"],
      sentAt: "2025-09-10 10:03",
      body: "TypeScriptとReact中心の長期インターンです。週3〜、学業優先で柔軟に調整可能です。",
      jobUrl: "#",
      from: "HR 佐藤",
    },
    {
      id: "3",
      company: "TechWorks LLC",
      status: "既読",
      subject: "Pythonエンジニア募集について",
      snippet: "AIチームでのバックエンド開発を…",
      tags: ["新卒", "フルリモート"],
      sentAt: "2025-09-05 18:40",
      body: "バックエンドAPIとバッチの実装が主担当です。Python, Django経験が活きます。",
      jobUrl: "#",
      from: "採用担当 鈴木",
    },
  ]);

  const [filters, setFilters] = useState({ q: "", status: "すべて", range: "指定なし", sort: "新着" });
  const [quickFilter, setQuickFilter] = useState("すべて");
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(null);

  // フィルタ適用
  const filtered = useMemo(() => {
    let arr = [...items];
    // キーワード
    if (filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      arr = arr.filter(x =>
        x.company.toLowerCase().includes(q) ||
        x.subject.toLowerCase().includes(q) ||
        x.snippet.toLowerCase().includes(q)
      );
    }
    // 状態
    const wanted = (quickFilter !== "すべて") ? quickFilter : (filters.status !== "すべて" ? filters.status : null);
    if (wanted) arr = arr.filter(x => x.status === wanted);

    // ソート（ダミー）
    if (filters.sort === "企業名") arr.sort((a,b)=>a.company.localeCompare(b.company));
    if (filters.sort === "未読優先") arr.sort((a,b)=>{
      const score = (s)=> s==="未読"?0 : s==="返信あり"?1 : s==="既読"?2 : 3;
      return score(a.status)-score(b.status);
    });
    return arr;
  }, [items, filters, quickFilter]);

  const openDetail = (it) => { setCurrent(it); setOpen(true); };
  const closeDetail = () => setOpen(false);

  const reply = () => {
    if (!current) return;
    setItems(list => list.map(x => x.id===current.id ? { ...x, status: "返信あり" } : x));
    setOpen(false);
  };

  const decline = () => {
    if (!current) return;
    setItems(list => list.map(x => x.id===current.id ? { ...x, status: "辞退" } : x));
    setOpen(false);
  };

  const insertTemplate = (text) => {
    if (!text) return;
    const el = document.getElementById("replyBox");
    if (!el) return;
    el.value = (el.value ? el.value + "\n" : "") + text;
  };

  return (
    <main className="container-xxl pb-5">
      <div className="page-header mb-3">
        <i className="bi bi-inbox fs-4" />
        <h1 className="title h4 mb-0">スカウトBOX</h1>
        <span className="subtle ms-2">企業からのスカウトを一元管理</span>
      </div>

      <ScoutFilters value={filters} onChange={setFilters} />

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <ScoutList
            items={filtered}
            onPick={openDetail}
            quickFilter={quickFilter}
            setQuickFilter={setQuickFilter}
          />
        </div>

        <div className="col-12 col-xl-5">
          <section className="torail-card mb-3">
            <h6 className="mb-2">ヒント</h6>
            <ul className="mb-0 text-muted small">
              <li>返信したくない場合は「辞退」で丁寧に通知できます。</li>
              <li>テンプレ返信を使うと、初回レスが楽です。</li>
            </ul>
          </section>

          <section className="torail-card">
            <h6 className="mb-2">テンプレ（返信）</h6>
            <div className="d-grid gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={()=>insertTemplate("まずはカジュアルにご挨拶できれば嬉しいです。")}>まずはカジュアルに</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={()=>insertTemplate("詳細の業務内容と稼働条件についてお伺いしたいです。")}>詳細を伺いたい</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={()=>insertTemplate("今回は見送りとさせてください。機会があればまたお願いします。")}>今回は見送り</button>
            </div>
          </section>
        </div>
      </div>

      <DetailDrawer
        open={open}
        data={current}
        onClose={closeDetail}
        onReply={reply}
        onDecline={decline}
        onInsertTemplate={insertTemplate}
      />
    </main>
  );
}
