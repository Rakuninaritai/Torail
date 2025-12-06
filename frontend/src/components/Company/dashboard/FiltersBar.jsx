import React, { useEffect, useState } from "react";
import "./companydash.css";
import LanguageModalPicker from "../../AddRecords/LanguageBubblPicker";
import { api } from "../../../api";

export default function FiltersBar({ value, onChange, onSaveCond }) {
  const v = value;
  const set = (k, val) => onChange?.({ ...v, [k]: val });

  const [langsOptions, setLangsOptions] = useState([]); // [{id,name}]

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await api('/master/languages/', { method: 'GET' });
        if (!ignore) setLangsOptions(Array.isArray(data) ? data : (data?.results || []));
      } catch (e) {
        if (!ignore) setLangsOptions([]);
      }
    })();
    return () => { ignore = true; };
  }, []);

  // LanguageModalPicker は id 配列を返すため、ここで相互変換を行う。
  // サーバ検索では slug を使うので、filters.languages には slug の配列を保持する。
  const selectedIds = (v.languages || []).map(slug => langsOptions.find(l => l.slug === slug)?.id).filter(Boolean);
  const onLangIdsChange = (ids) => {
    const slugs = ids.map(id => langsOptions.find(l => l.id === id)?.slug).filter(Boolean);
    set('languages', slugs);
  };

  return (
    <section className="torail-card mb-3">
      <div className="row g-3 align-items-end">
        <div className="col-12 col-xxl-4">
          <label className="form-label">言語（複数選択）</label>
          <LanguageModalPicker
            languages={langsOptions}
            value={selectedIds}
            onChange={onLangIdsChange}
            disabled={!langsOptions.length}
            buttonLabel="言語を選ぶ"
          />
          <div className="form-hint">マスター言語から選択してください（複数可）</div>
        </div>

        <div className="col-12 col-xxl-4">
          <label className="form-label">キーワード検索</label>
          <input
            type="search"
            className="form-control"
            placeholder="ユーザー名・表示名で検索"
            value={v.q ?? ""}
            onChange={(e)=>set("q", e.target.value)}
          />
          <div className="form-hint">部分一致で検索します（例: ユーザー名、表示名）</div>
        </div>

        <div className="col-6 col-md-2">
          <label className="form-label">直近N日稼働≧</label>
          <input type="number" className="form-control" placeholder="例: 14"
                 value={v.recentActiveDays ?? ""} min={0}
                 onChange={(e)=>set("recentActiveDays", e.target.value ? Number(e.target.value) : null)} />
        </div>

        <div className="col-6 col-md-2">
          <label className="form-label">現在ストリーク≧</label>
          <input type="number" className="form-control" placeholder="例: 3"
                 value={v.currentStreakMin ?? ""} min={0}
                 onChange={(e)=>set("currentStreakMin", e.target.value ? Number(e.target.value) : null)} />
        </div>

        <div className="col-6 col-md-2">
          <label className="form-label">最長ストリーク≧</label>
          <input type="number" className="form-control" placeholder="例: 10"
                 value={v.maxStreakMin ?? ""} min={0}
                 onChange={(e)=>set("maxStreakMin", e.target.value ? Number(e.target.value) : null)} />
        </div>

        <div className="col-6 col-md-2">
          <label className="form-label">学年</label>
          <select className="form-select" value={v.grade} onChange={(e)=>set("grade", e.target.value)}>
            <option value="">指定なし</option>
            <option value="1">1年</option>
            <option value="2">2年</option>
            <option value="3">3年</option>
            <option value="4">4年</option>
          </select>
        </div>

        <div className="col-6 col-md-2">
          <label className="form-label">地域</label>
          <select className="form-select" value={v.region} onChange={(e)=>set("region", e.target.value)}>
            <option value="">指定なし</option>
            <option>東海</option><option>関東</option><option>関西</option><option>九州</option>
          </select>
        </div>

        {/* 公開ステータスフィルタは不要のため削除 */}

        <div className="col-6 col-md-2">
          <label className="form-label">ソート</label>
          <select className="form-select" value={v.sort} onChange={(e)=>set("sort", e.target.value)}>
            <option>直近アクティブ度</option>
            <option>現在ストリーク（降順）</option>
            <option>最終記録日時</option>
            <option>新着</option>
          </select>
        </div>

        <div className="col-12 col-md-4 d-flex gap-2">
          <button className="btn btn-primary flex-grow-1" onClick={()=>onChange?.({...v})}>
            <i className="bi bi-funnel"></i> 絞り込む
          </button>
          <button className="btn btn-outline-secondary" onClick={onSaveCond}>
            <i className="bi bi-save"></i> 条件保存
          </button>
        </div>
      </div>
    </section>
  );
}
