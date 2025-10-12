 import React, { useEffect, useMemo, useState } from "react";
 import { useParams } from "react-router-dom";
import HeaderCard from "../components/Userpage/HeaderCard";
import TextAreaCard from "../components/Userpage/TextAreaCard";
import MetricsCard from "../components/Userpage/MetricsCard";
import PrefsCard from "../components/Userpage/PrefsCard";
import PortfolioCard from "../components/Userpage/PortFolioCard";
import "../components/Userpage/user-cards.css";
import { api } from "../api";

export default function UserPage({ token }) {
  const { username } = useParams();
  const isOwner = useMemo(() => (token?.username === username), [token, username]);

  // 公開プロフィール（閲覧用）
  const [pub, setPub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // 編集用（所有者のみ）: /api/profile/me/
  const [me, setMe] = useState(null);
  const [saving, setSaving] = useState(false);

  // SNS / PF は owner のみ編集。閲覧時は pub.sns_links / pub.portfolio_items を使う
  const [sns, setSns] = useState([]);           // [{id, icon_class, url}]
  const [portfolio, setPortfolio] = useState([]); // [{id,title,stack,url,github,description}]

  // マスター（選択肢）
  const [masters, setMasters] = useState({ jobs: [], techs: [], domains: [], langs: [] });

  // 公開プロフィール取得（username → backend 側でユーザー引けるようにしています）
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const p = await api(`/public/username/${encodeURIComponent(username)}/profile/`, { method: 'GET' });
        if (ignore) return;
        setPub(p);
      } catch (e) {
        if (!ignore) setErr(e);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [username]);

  // 所有者なら編集用データと付属リストを取得
  useEffect(() => {
    if (!isOwner) return;
    let ignore = false;
    (async () => {
      const [mine, snsList, pfList] = await Promise.all([
        api('/profile/me/', { method: 'GET' }),
        api('/profile/sns/', { method: 'GET' }),
        api('/profile/portfolio/', { method: 'GET' }),
      ]);
      if (ignore) return;
      setMe(mine);
      setSns(snsList);
      setPortfolio(pfList);
    })().catch(()=>{});
    return () => { ignore = true; };
  }, [isOwner]);

  // マスター取得（閲覧だけでも名称表示に使える）
  useEffect(() => {
    (async () => {
      const [jobs, techs, domains, langs] = await Promise.all([
        api('/master/jobroles/', { method: 'GET' }),
        api('/master/techareas/', { method: 'GET' }),
        api('/master/productdomains/', { method: 'GET' }),
        api('/master/languages/', { method: 'GET' }),
      ]);
      setMasters({ jobs: jobs?.results || jobs, techs: techs?.results || techs, domains: domains?.results || domains, langs: langs?.results || langs });
    })().catch(()=>{});
  }, []);

  // 表示用に、pub を UI モデルへ変換（null セーフ）
  const profile = useMemo(() => {
    if (!pub) return null;
    return {
      displayName: pub.display_name || username,
      school: pub.school || "—",
      grade: pub.grade || "—",
      pref: pub.prefecture || "—",
      avatarUrl: "", // avatar 未実装。将来 S3 等に載せる想定。
      // 閲覧時の SNS: backend は icon_class と url。label は省略（title 属性で代替）
      sns: (pub.sns_links || []).map(s => ({ label: '', url: s.url, icon: s.icon_class })),
    };
  }, [pub, username]);

  // 自己紹介/ビジョンは UserProfile.bio を 2 分割派生（簡易運用）
  // 例: "----" 区切りで前半=自己紹介、後半=ビジョン。無ければ同文。
  const [intro, vision] = useMemo(() => {
    const bio = pub?.bio || "";
    const [a, b] = String(bio).split("\n----\n");
    return [a || "", b || a || ""];
  }, [pub]);

  // KPI / ヒートマップ / 言語円グラフは別 API を用意しても良いですが、
  // まずはダッシュボード完成後に移植予定のためプレースホルダ（0で安全）
  const kpi = { streakNow: 0, goal: 20, streakMax: 0, maxBase: 30, lastUpdate: "—", active7: 0, active30: 0, offHint: "—" };
  const activity30 = useMemo(() => Array.from({ length: 30 }, () => 0), []);
  const langBreakdown = useMemo(() => {
    const arr = pub?.languages || []; // [{id,name,slug}]
    return arr.slice(0,6).map(x => ({ label: x.name, hours: 1 }));
  }, [pub]);

  // 保存（プロフィール）
  const saveProfile = async (draft) => {
    if (!isOwner) return;
    setSaving(true);
    try {
      // grade/prefecture/display_name, bio は別カードで送るのでここは基本情報だけ
      const payload = {
        display_name: draft.displayName,
        school: draft.school,
        grade: draft.grade,
        prefecture: draft.pref,
      };
      const updated = await api('/profile/me/', { method: 'PATCH', body: JSON.stringify(payload) });
      setMe(updated);
      // 表示を即時反映
      setPub(p => p ? ({ ...p, ...payload }) : p);
    } finally {
      setSaving(false);
    }
  };

  // 自己紹介/ビジョン保存 → bio をまとめて保存（区切り文字）
  const saveIntro = async (text) => {
    if (!isOwner) return;
    const bio = `${text}\n----\n${vision || ""}`;
    const updated = await api('/profile/me/', { method: 'PATCH', body: JSON.stringify({ bio }) });
    setPub(p => p ? ({ ...p, bio: updated.bio }) : p);
  };
  const saveVision = async (text) => {
    if (!isOwner) return;
    const bio = `${intro || ""}\n----\n${text}`;
    const updated = await api('/profile/me/', { method: 'PATCH', body: JSON.stringify({ bio }) });
    setPub(p => p ? ({ ...p, bio: updated.bio }) : p);
  };

  // 希望/技術/ドメインの保存（ID 配列）
  const savePrefs = async ({ roles, techSelected, domain }) => {
    if (!isOwner) return;
    // 入力が文字列のときは名称→ID 変換（簡易。名称がなければ無視）
    const byName = (list, names) =>
      (names || []).map(n => list.find(x => (x.name === n || x.id === n))?.id).filter(Boolean);
    const payload = {};
    if (roles)       payload.desired_jobs    = byName(masters.jobs, roles);
    if (techSelected)payload.tech_areas      = (techSelected || []).map(id => id); // すでにIDの想定
    if (domain)      payload.product_domains = byName(masters.domains, domain);
    if (!Object.keys(payload).length) return;
    const updated = await api('/profile/me/', { method: 'PATCH', body: JSON.stringify(payload) });
    setPub(p => p ? ({ ...p, ...updated }) : p);
  };

  // SNS 追加/削除
  const addSns = async (item) => {
    if (!isOwner) return;
    const posted = await api('/profile/sns/', { method:'POST', body: JSON.stringify({ icon_class: item.icon, url: item.url }) });
    setSns(x => [posted, ...x]);
    // 表示側も反映
    setPub(p => p ? ({ ...p, sns_links: [posted, ...(p.sns_links || [])] }) : p);
  };
  const removeSns = async (idx) => {
    if (!isOwner) return;
    const target = sns[idx];
    if (!target) return;
    await api(`/profile/sns/${target.id}/`, { method: 'DELETE' });
    setSns(x => x.filter((_,i)=>i!==idx));
    setPub(p => p ? ({ ...p, sns_links: (p.sns_links || []).filter((_,i)=>i!==idx) }) : p);
  };

  // PF 追加/削除（UI の命名とモデルの項目名をマッピング）
  const addPortfolio = async (it) => {
    if (!isOwner) return;
    const body = {
      title: it.title,
      stack: it.tags,
      description: it.summary,
      url: it.url,
      github: it.git,
    };
    const posted = await api('/profile/portfolio/', { method: 'POST', body: JSON.stringify(body) });
    setPortfolio(x => [posted, ...x]);
  };
  const removePortfolio = async (idx) => {
    if (!isOwner) return;
    const target = portfolio[idx];
    if (!target) return;
    await api(`/profile/portfolio/${target.id}/`, { method: 'DELETE' });
    setPortfolio(x => x.filter((_,i)=>i!==idx));
  };

  if (loading) return <main className="container-xxl pb-5"><div className="subtle">読み込み中…</div></main>;
  if (err || !pub) return <main className="container-xxl pb-5"><div className="text-danger">ユーザーが見つかりません。</div></main>;



  return (
    <main className="container-xxl pb-5">
      <div className="page-header mb-3">
        <i className="bi bi-person-circle fs-4" />
        <h1 className="title h4 mb-0">マイページ</h1>
        <span className="subtle ms-1">自己PR・継続可視化</span>
      </div>

      <HeaderCard profile={profile} isOwner={isOwner} onSave={saveProfile} onAddSns={addSns} onRemoveSns={removeSns} saving={saving} />

      <TextAreaCard title="じこしょうかい" value={intro} isOwner={isOwner} onSave={saveIntro} />

      <MetricsCard kpi={kpi} activity30={activity30} langBreakdown={langBreakdown} />

      <TextAreaCard title="どんなエンジニアになりたいか" value={vision} isOwner={isOwner} onSave={saveVision} />

      <PrefsCard
        roles={(pub?.desired_jobs || []).map(x => x.name)}
        techOptions={(masters.techs || []).map(x => ({ id:x.id, name:x.name }))}
        techSelected={(pub?.tech_areas || []).map(x => x.id)}
        domain={(pub?.product_domains || []).map(x => x.name)}
        isOwner={isOwner}
        onSave={savePrefs}
      />

       <PortfolioCard
        items={(isOwner ? portfolio : (pub?.portfolio_items || [])).map(it => ({
          id: it.id, title: it.title, tags: it.stack, summary: it.description, url: it.url, git: it.github
        }))}
        isOwner={isOwner}
        onAdd={addPortfolio}
        onRemove={removePortfolio}
      />
    </main>
  );
}
