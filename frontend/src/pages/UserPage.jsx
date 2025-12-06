 import React, { useEffect, useMemo, useState } from "react";
 import { useParams } from "react-router-dom";
import HeaderCard from "../components/Userpage/HeaderCard";
import TextAreaCard from "../components/Userpage/TextAreaCard";
import MetricsCard from "../components/Userpage/MetricsCard";
import PrefsCard from "../components/Userpage/PrefsCard";
import PortfolioCard from "../components/Userpage/PortFolioCard";
import "../components/Userpage/user-cards.css";
import { api } from "../api";
import { toast } from 'react-toastify';
const KPI_INIT = { streakNow: 0, streakMax: 0, lastUpdate: "—", active7: 0, active30: 0, offHint: "—" };

export default function UserPage({ token }) {
  const { username } = useParams();
  // 第二引数は依存配列usememoを使うと再レンダリング時も毎回比較しない
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
  // 公開KPI
  const [kpi, setKpi] = useState(KPI_INIT);
  const [activity30, setActivity30] = useState(Array.from({ length: 30 }, () => 0));
  const [langBreakdown, setLangBreakdown] = useState([]); // [{label, hours}]
  // エラーメッセージ抽出のヘルパ
  const msg = (e, fallback) => {
    // APIの中身（たぶん Response.json() 済みのオブジェクト）
    const data = e?.response?.data || e;

    if (typeof data === 'object' && data !== null) {
      // DRF形式 {"url":["有効なURLを入力してください。"], "title":["必須です。"]}
      const fieldErrors = Object.entries(data)
        .map(([key, val]) => {
          if (Array.isArray(val)) return `${key}: ${val.join(" ")}`;
          if (typeof val === "string") return `${key}: ${val}`;
          return null;
        })
        .filter(Boolean);

      if (fieldErrors.length) {
        return fieldErrors.join("\n");
      }

      // 1段下に detail があるケース
      if (data.detail) return data.detail;
    }

    // 通常のError.messageなど
    const m =
      e?.message ||
      e?.response?.statusText ||
      fallback ||
      "エラーが発生しました。";
    return String(m);
  };

  // 公開プロフィール取得（username → backend 側でユーザー引けるようにしています）
  // ignoreでアンマウント(描画されなくなった時)にawait後にstateに値を入れてしまうのを防いでいる。(アンマウント時returnが実行されtrueに)
  // try:通常の処理,catch:例外,finally:成功や失敗にかかわらず最後に実行
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
        toast.error(msg(e, 'プロフィールの取得に失敗しました'));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [username]);
  // 公開KPI（scopeは必要に応じて 'all'|'personal'|'team' 指定可能）
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await api(`/public/username/${encodeURIComponent(username)}/activity_kpi/?scope=all`, { method: 'GET' });
        if (ignore) return;
        setKpi(res?.kpi ?? KPI_INIT);
        setActivity30(Array.isArray(res?.activity30) ? res.activity30 : Array.from({ length: 30 }, () => 0));
        setLangBreakdown(Array.isArray(res?.lang_breakdown) ? res.lang_breakdown : []);
      } catch {
        // KPIは非クリティカル：警告のみ
        console.warn('public activity_kpi fetch failed');
      }
    })();
    return () => { ignore = true; };
  }, [username]);
  
  // 所有者なら編集用データと付属リストを取得
  useEffect(() => {
    if (!isOwner) return;
    let ignore = false;
    (async () => {
      // それぞれのデータをいれる(promiseallで高速取得)
      const [mine, snsList, pfList] = await Promise.all([
        api('/profile/me/', { method: 'GET' }),
        api('/profile/sns/', { method: 'GET' }),
        api('/profile/portfolio/', { method: 'GET' }),
      ]);
      if (ignore) return;
      setMe(mine);
      setSns(snsList);
      setPortfolio(pfList);
    })().catch((e)=>{
      if (!ignore) toast.error(msg(e, '編集用データの取得に失敗しました'));
    });
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
      
    })().catch((e)=>{
      toast.error(msg(e, '候補データの取得に失敗しました'));
    });
  }, []);

  // 表示用に、pub を UI モデルへ変換（null セーフ）
  const profile = useMemo(() => {
    if (!pub) return null;
    return {
      displayName: pub.display_name || username,
      school: pub.school || "",
      grade: pub.grade || "",
      pref: pub.prefecture || "",
      gradYear: pub.grad_year || "",
      avatarUrl: pub.avatar_url || "",
      // 閲覧時の SNS: backend は icon_class と url。label は省略（title 属性で代替）
      sns: (pub.sns_links || []).map(s => ({ label: '', url: s.url, icon: s.icon_class })),
    };
  }, [pub, username]);



  // 保存（プロフィール）
  const saveProfile = async (draft) => {
    if (!isOwner) return;
    setSaving(true);
    try {
      // grade/prefecture/display_name, bio は別カードで送るのでここは基本情報だけ
      // const payload = {
      //   display_name: draft.displayName,
      //   school: draft.school,
      //   grade: draft.grade,
      //   prefecture: draft.pref,
      // };
      const fd = new FormData();
      fd.append("display_name", draft.displayName || "");
      fd.append("school", draft.school || "");
      fd.append("grade", draft.grade || "");
      fd.append("grad_year", draft.gradYear || "");
      fd.append("prefecture", draft.pref || "");
      if (draft._avatarFile) {
        fd.append("avatar", draft._avatarFile); // ← 画像
      }
      for (const [k, v] of fd.entries()) console.log('FD', k, v);
      // const updated = await api('/profile/me/', { method: 'PATCH', body: JSON.stringify(payload) });
      const updated = await api('/profile/me/', { method: 'PATCH', body: fd }); // ← Content-Typeは付けない
      setMe(updated);
      // 表示を即時反映
      setPub(p => p ? ({ ...p, ...updated }) : p);
      toast.success('プロフィールを保存しました');
    } catch (e) {
      toast.error(msg(e, 'プロフィールの保存に失敗しました'));
    }finally {
      setSaving(false);
    }
  };

  // 自己紹介/ビジョン保存 → bio をまとめて保存（区切り文字）
  const saveIntro = async (text) => {
    try{
      if (!isOwner) return;
      const updated = await api('/profile/me/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: text }),
      });
      setPub(p => p ? ({ ...p, bio: updated.bio }) : p);
      toast.success('自己紹介を保存しました');
     } catch (e) {
      toast.error(msg(e, '自己紹介の保存に失敗しました'));
    }
  };
  const saveVision = async (text) => {
    try{
      if (!isOwner) return;
      const updated = await api('/profile/me/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vision: text }),
      });
      setPub(p => p ? ({ ...p, vision: updated.vision }) : p);
      toast.success('ビジョンを保存しました');
    }catch(e){
      toast.error(msg(e, 'ビジョンの保存に失敗しました'));
    }
  };

  // 希望/技術/ドメインの保存（ID 配列）
  const savePrefs = async ({ roles, techSelected, domain }) => {
    if (!isOwner) return;
    try{
      // 入力が文字列のときは名称→ID 変換（簡易。名称がなければ無視）
      const byName = (list, names) =>
      // nameには選択したやつ,listにはidとnameの対応をやってnameかidが一致すればそれを返す
      // .filter(Boolean)は正だけをとってる(値があるとか)
        (names || []).map(n => list.find(x => (x.name === n || x.id === n))?.id).filter(Boolean);
      const payload = {};
      if (roles)       payload.desired_jobs    = (roles||[]).map(id=>id);
      if (techSelected)payload.tech_areas      = (techSelected || []).map(id => id); // すでにIDの想定
      if (domain)      payload.product_domains = (domain||[]).map(id=>id);
      if (!Object.keys(payload).length) return;
      const updated = await api('/profile/me/', { method: 'PATCH', body: JSON.stringify(payload) });
      setPub(p => p ? ({ ...p, ...updated }) : p);
      toast.success("希望条件を保存しました");
    }catch(e){
       toast.error(msg(e, '希望条件の保存に失敗しました'));
    }
  };

  // SNS 追加/削除
  const addSns = async (item) => {
    if (!isOwner) return;
    try{
      const posted = await api('/profile/sns/', { method:'POST', body: JSON.stringify({ icon_class: item.icon, url: item.url }) });
      setSns(x => [posted, ...x]);
      // 表示側も反映
      setPub(p => p ? ({ ...p, sns_links: [posted, ...(p.sns_links || [])] }) : p);
    }catch(e){
      toast.error(msg(e, 'SNSの追加に失敗しました'));
    }
    
  };
  const removeSns = async (idx) => {
    if (!isOwner) return;
    const target = sns[idx];
    if (!target) return;
    try{
      await api(`/profile/sns/${target.id}/`, { method: 'DELETE' });
      //(value,index)でそれが削除したい要素(idx)じゃなければ残す
      setSns(x => x.filter((_,i)=>i!==idx));
      setPub(p => p ? ({ ...p, sns_links: (p.sns_links || []).filter((_,i)=>i!==idx) }) : p);
      toast.success('SNSを削除しました');
    }catch(e){
      toast.error(msg(e, 'SNSの削除に失敗しました'));
    }
  };

  // PF 追加/削除（UI の命名とモデルの項目名をマッピング）
  const addPortfolio = async (it) => {
    if (!isOwner) return;
    try{
      const body = {
        title: it.title,
        stack: it.tags,
        description: it.summary,
        url: it.url,
        github: it.git,
      };
      const posted = await api('/profile/portfolio/', { method: 'POST', body: JSON.stringify(body) });
      setPortfolio(x => [posted, ...x]);
      toast.success('ポートフォリオを追加しました');
    }catch(e){
      toast.error(msg(e, 'ポートフォリオの追加に失敗しました'));
    }
    
  };
  const removePortfolio = async (idx) => {
    if (!isOwner) return;
    const target = portfolio[idx];
    if (!target) return;
    try{
      await api(`/profile/portfolio/${target.id}/`, { method: 'DELETE' });
      setPortfolio(x => x.filter((_,i)=>i!==idx));
      toast.success('ポートフォリオを削除しました');
    }catch(e){
      toast.error(msg(e, 'ポートフォリオの削除に失敗しました'));
    }
    
  };

  if (loading) return <main className="container-xxl pb-5"><div className="subtle">読み込み中…</div></main>;
  if (err || !pub) return <main className="container-xxl pb-5"><div className="text-danger">ユーザーが見つかりません。</div></main>;



  return (
    <main className="container-xxl pb-5">
      <div className="page-header mb-3">
        <i className="bi bi-person-circle fs-4" />
        <h1 className="title h4 mb-0">マイページ</h1>
        {/* <span className="subtle ms-1">自己PR・継続可視化</span> */}
      </div>

      <HeaderCard profile={profile} isOwner={isOwner} onSave={saveProfile} onAddSns={addSns} onRemoveSns={removeSns} saving={saving} />

      <TextAreaCard title="自己紹介" value={pub.bio} isOwner={isOwner} onSave={saveIntro} />

      {/* 公開KPI（個人+チーム） */}
      <MetricsCard kpi={kpi} activity30={activity30} langBreakdown={langBreakdown} />

      <TextAreaCard title="どんなエンジニアになりたいか" value={pub.vision} isOwner={isOwner} onSave={saveVision} />

      <PrefsCard
        rolesOptions={(masters.jobs || []).map(x => ({ id:x.id, name:x.name }))}
        rolesSelected={(pub.desired_jobs || []).map(x => x.id)}
        techOptions={(masters.techs || []).map(x => ({ id:x.id, name:x.name }))}
        techSelected={(pub.tech_areas || []).map(x => x.id)}
        domainOptions={(masters.domains || []).map(x => ({ id:x.id, name:x.name }))}
        domainSelected={(pub.product_domains || []).map(x => x.id)}
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
