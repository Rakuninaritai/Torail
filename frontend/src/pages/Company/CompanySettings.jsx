import { useEffect, useState } from "react";
import { loadStripe } from '@stripe/stripe-js';
import { api } from "../../api";
import CompanyProfileCard from "../../components/Company/settings/CompanyProfileCard";
import HiringInfoCard from "../../components/Company/settings/HiringInfoCard";
import NotificationSettingsCard from "../../components/Company/settings/NotificationSettingsCard";
import MemberManagementCard from "../../components/Company/settings/MemberManagementCard";

// ────────────────────────────────────────────────────────────────
// 企業設定ページ
// ────────────────────────────────────────────────────────────────
// 企業のプロフィール、募集情報（CRUD）、公開設定、プラン管理、
// メンバー管理、通知設定を一元管理する。
// オーナーのみが編集可能（isAdmin フラグで制御）。
// ────────────────────────────────────────────────────────────────
export default function CompanySettingsPage() {
  // ─────────────────────────────────────────────────────────────
  // ① State 定義
  // ─────────────────────────────────────────────────────────────
  // company      = ログインユーザーが所属する企業の情報
  // isAdmin      = ユーザーがこの企業のオーナーかどうか
  // saving       = API 送信中フラグ
  // plans        = この企業の利用プランリスト（複数のプラン履歴が存在可能）
  // hirings      = この企業の募集情報（職種別）
  // showPlanModal = プラン比較モーダルの表示/非表示
  // ─────────────────────────────────────────────────────────────
  const [company, setCompany] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState([]);
  const [hirings, setHirings] = useState([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [priceId, setPriceId] = useState('');

  // ─────────────────────────────────────────────────────────────
  // ② プリセットプラン定義
  // ─────────────────────────────────────────────────────────────
  // 企業が選択可能な3つのプランテンプレート
  // Free（50件/月）、Pro（200件/月、中小企業向け）、
  // Enterprise（1000件/月、大量送信・専用サポート向け）
  // ─────────────────────────────────────────────────────────────
  const PLAN_PRESETS = [
    { key: 'free', name: 'Free', monthly_quota: 50, price_jpy: 0, desc: 'まずは気軽に試せるプラン' },
    { key: 'pro', name: 'Pro', monthly_quota: 200, price_jpy: 5000, desc: '中小企業向けの標準プラン' },
    { key: 'enterprise', name: 'Enterprise', monthly_quota: 1000, price_jpy: 20000, desc: '大量送信・専用サポート向け' },
  ];
  // NOTE (将来のプラン仕様変更に備えて):
  // - サーバー側で「現在のプラン」を明示するフィールド (例: `is_active` または `current: true`) があると確実です。
  // - 将来的に `monthly_quota` の代わりに `monthly_quota_per_team` など分割した値を導入する可能性があるため、
  //   フロントは `plans[0]` に頼らず、明示フラグを優先する実装に置き換えやすいようにしておいてください。
  // - Plan のフィールドは拡張される想定 (feature_flags, limits, integration) のため、表示ロジックを
  //   単純化しておくと将来的な差し替えが容易です。

  // ─────────────────────────────────────────────────────────────
  // ③ プラン適用関数
  // ─────────────────────────────────────────────────────────────
  // プリセットから選んだプランを POST /company_plans/ で作成
  // 成功後、plans リストの先頭に追加して UI に反映
  // ─────────────────────────────────────────────────────────────
  const applyPresetPlan = async (preset) => {
    if (!company) return;
    // NOTE: オーナーだけでなく会社メンバーならプランを適用できるように変更
    // （サーバー側でも権限チェックが必要な場合はそちらを優先してください）
    // 確認ダイアログ
    if (!confirm(`${preset.name} を適用しますか？この操作で新しいプランが作成されます。`)) return;
    try {
      setSaving(true);
      const body = {
        company: company.id,
        plan_type: preset.key,
        monthly_quota: preset.monthly_quota,
        price_jpy: preset.price_jpy,
        active_from: new Date().toISOString().slice(0, 10),  // 本日を開始日とする
      };
      const created = await api(`/company_plans/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      // 新プランを plans の先頭に追加（最新が前）
      setPlans(prev => [created, ...prev]);
      alert(`${preset.name}プランを適用しました`);
      setShowPlanModal(false);
    } catch {
      alert('プランの適用に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // ④ 初期化: 企業情報と関連データを取得
  // ─────────────────────────────────────────────────────────────
  // GET /companies/          → 所属企業リスト（先頭を使用）
  // GET /company_members/    → メンバー（isAdmin 判定用）
  // GET /company_plans/      → プラン履歴
  // GET /company_hirings/    → 募集情報
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        // ① 所属企業を取得（通常は1社のみ）
        const comps = await api("/companies/", { method: "GET" });
        const list = comps?.results || comps || [];
        const c = list[0];  // 最初の企業を使用
        if (!ignore) {
          setCompany(c);
        }
        if (c?.id) {
          // ② この企業のメンバーを取得（role = "owner" かどうかで isAdmin 判定）
          const mems = await api(`/company_members/?company=${c.id}`, { method: "GET" });
          const arr = mems?.results || mems || [];
          if (!ignore) setIsAdmin(!!arr.find(m => m.role === "owner"));

          // ③ この企業のプラン履歴を取得
          const pls = await api(`/company_plans/?company=${c.id}`, { method: "GET" });
          if (!ignore) setPlans(pls?.results || pls || []);

          // ④ この企業の募集情報を取得（失敗してもスルー）
          try {
            const hs = await api(`/company_hirings/?company=${c.id}`, { method: "GET" });
            if (!ignore) setHirings(hs?.results || hs || []);
          } catch {
            if (!ignore) setHirings([]);
          }
        }
      } catch {
        if (!ignore) setCompany(null);
      }
    })();
    return () => { ignore = true; };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // ⑤ 公開設定の保存
  // ─────────────────────────────────────────────────────────────
  // PATCH /companies/{id}/ で slug, is_public, show_hirings を更新
  // ─────────────────────────────────────────────────────────────
  const savePublicSettings = async (vals) => {
    if (!company) return;
    try {
      setSaving(true);
      const payload = { ...(vals || {}) };
      // PATCH でこれらの公開設定フィールドを更新
      const updated = await api(`/companies/${company.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // 成功後、company state を更新
      setCompany(updated);
      alert("公開設定を保存しました");
    } catch {
      alert("公開設定の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // ⑥ 条件分岐: company が取得できるまで待機
  // ─────────────────────────────────────────────────────────────
  if (!company) return <main className="container-xxl pb-5"><div className="subtle">読み込み中…</div></main>;

  const publicUrl = `/company/public/${company.slug || ""}`;
  // ─────────────────────────────────────────────────────────────
  // ⑦ JSX: 2カラムレイアウト（左8, 右4）
  // ─────────────────────────────────────────────────────────────
  // 左カラム: プロフィール、募集情報、公開設定
  // 右カラム: 通知設定、メンバー管理、プラン管理
  // ─────────────────────────────────────────────────────────────
  return (
    <>
      <main className="container-xxl pb-5">
        <div className="row g-4">
          {/* 左カラム (col-xxl-8): 企業基本情報と設定 */}
          <div className="col-12 col-xxl-8">
            {/* 企業プロフィール: 名前、業種、説明、Webサイト */}
            <CompanyProfileCard
              profile={{
                name: company.name,
                industry: company.industry || "",
                description: company.description || "",
                website: company.website || "",
                logo: null,
              }}
              onChange={() => { }}
              isAdmin={isAdmin}
            />

            {/* slug 入力は公開設定セクションに統合しました（下の「公開設定」ブロックを参照）。 */}

            {/* 募集情報セクション: 職種別の求人 CRUD */}
            <section className="torail-card mt-3">
              <h6 className="mb-2">募集情報</h6>
              {/* 募集追加ボタン: 空の draft オブジェクトを hirings の先頭に追加 */}
              <div className="mb-2">
                <button className="btn btn-outline-primary" disabled={!isAdmin} onClick={async () => {
                  // 新しい募集フォームをドラフト状態で追加
                  const draft = { title: "", detail: "", tech_stack: "", location: "", employment_type: "新卒" };
                  setHirings(prev => [draft, ...prev]);
                }}>募集を追加</button>
              </div>
              <div>
                {/* 募集リストの描画 or 空状態メッセージ */}
                {hirings.length === 0 && <div className="text-muted">募集情報はまだありません</div>}
                {hirings.map((h, idx) => (
                  <div key={h.id || `new-${idx}`} className="mb-3">
                    {/* 既存募集には削除ボタンを表示 */}
                    <div className="d-flex justify-content-end mb-2">
                      {h.id && <button className="btn btn-sm btn-danger me-2" disabled={!isAdmin}
                        onClick={async () => {
                          if (!h.id) return;
                          if (!confirm("本当にこの募集を削除しますか？")) return;
                          try {
                            // DELETE /company_hirings/{id}/
                            await api(`/company_hirings/${h.id}/`, { method: "DELETE" });
                            setHirings(prev => prev.filter(x => x.id !== h.id));
                          } catch { alert("削除に失敗しました"); }
                        }}>削除</button>}
                    </div>
                    {/* 各募集の詳細カード */}
                    <HiringInfoCard
                      info={{
                        category: h.employment_type || h.employmentType || "",
                        stack: h.tech_stack || h.stack || "",
                        location: h.location || "",
                        startDate: h.start_date || h.startDate || "",
                        __raw: h,  // オリジナルデータを保持（作成/更新時に使用）
                      }}
                      isAdmin={isAdmin}
                      // 募集情報の変更時: 作成または更新を実行
                      onChange={async (draft) => {
                        // draft は HiringInfoCard から返ってくるオブジェクト
                        // __raw フィールドにはオリジナルのデータが含まれている
                        const raw = draft.__raw || {};
                        const payload = {
                          company: company.id,
                          title: raw.title || draft.title || draft.category || "",
                          detail: raw.detail || draft.detail || "",
                          tech_stack: draft.stack || raw.tech_stack || "",
                          location: draft.location || raw.location || "",
                          employment_type: draft.category || raw.employment_type || "",
                        };
                        try {
                          if (raw && raw.id) {
                            // 既存: PATCH で更新
                            const updated = await api(`/company_hirings/${raw.id}/`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(payload),
                            });
                            // 更新済みアイテムで置換
                            setHirings(prev => prev.map(x => x.id === updated.id ? updated : x));
                          } else {
                            // 新規: POST で作成
                            const created = await api(`/company_hirings/`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(payload),
                            });
                            // ドラフト（id なし）を作成したものに置換
                            setHirings(prev => {
                              const replaced = prev.slice();
                              const i = replaced.findIndex(x => !x.id && (x.title === "" || x.location === ""));
                              if (i >= 0) { replaced[i] = created; return replaced; }
                              return [created, ...prev];
                            });
                          }
                          alert("保存しました");
                        } catch {
                          alert("保存に失敗しました");
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* 公開設定セクション: URL スラッグ、公開フラグ、募集表示フラッグ */}
            <section className="torail-card mt-3">
              <h6 className="mb-2">公開設定（URL と表示）</h6>
              {/* 会社ページの公開 URL スラッグ入力 */}
              <div className="mb-3">
                <label className="form-label">会社URLスラッグ（小文字英数とハイフン）</label>
                <input className="form-control"
                  value={company.slug || ""}
                  onChange={e => setCompany(c => ({ ...c, slug: e.target.value }))}
                  disabled={saving}
                  placeholder="例: torail-inc" />
                {/* 公開ページのプレビュー URL */}
                <div className="small text-muted mt-1">公開ページ: <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a></div>
              </div>

              {/* 会社ページの公開/非公開フラグ */}
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" id="is_public"
                  checked={company.is_public ?? true}
                  disabled={saving}
                  onChange={(e) => setCompany(c => ({ ...c, is_public: e.target.checked }))} />
                <label className="form-check-label" htmlFor="is_public">会社ページを公開する</label>
              </div>
              {/* 公開ページで募集情報を表示するかどうか */}
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" id="show_hirings"
                  checked={company.show_hirings ?? true}
                  disabled={saving}
                  onChange={(e) => setCompany(c => ({ ...c, show_hirings: e.target.checked }))} />
                <label className="form-check-label" htmlFor="show_hirings">公開ページで募集情報を表示する</label>
              </div>
              {/* 保存ボタンと公開ページプレビューボタン */}
              <div className="d-flex gap-2">
                <button className="btn btn-primary" disabled={saving}
                  onClick={() => savePublicSettings({ slug: company.slug, is_public: company.is_public, show_hirings: company.show_hirings })}>
                  保存
                </button>
                <a className="btn btn-outline-secondary" href={publicUrl} target="_blank" rel="noreferrer">公開ページを確認</a>
              </div>
            </section>
          </div>

          {/* 右カラム (col-xxl-4): 通知設定、メンバー管理、プラン管理 */}
          <div className="col-12 col-xxl-4">
            {/* 通知設定カード */}
            <NotificationSettingsCard notify={{ reply: true, limit: false }} onChange={() => { }} isAdmin={isAdmin} />
            
            {/* メンバー管理カード: オーナーのみ編集可能 */}
            <MemberManagementCard isAdmin={isAdmin} companyId={company.id} />
            
            {/* ─────────────────────────────────────────────────────────────
                プラン表示セクション（統合箇所）
                ─────────────────────────────────────────────────────────────
                このブロックが唯一のプラン管理 UI です。
                サーバー側が現在のプランを明示するフィールド（is_active または current）を返すようになったら、
                plans[0] ではなくそちらを優先して表示してください。
                プランのフィールドが将来拡張される想定なので、表示ロジックは最小限にしています。
                ─────────────────────────────────────────────────────────────
            */}
            <section className="torail-card mt-3">
              <h6 className="mb-2">プラン</h6>

              {/* 現在のプランを目立たせるカード */}
              <div className="mb-3 p-3 border rounded bg-light">
                {plans.length > 0 ? (
                  (() => {
                    // NOTE: 現状は API が最新のプランを先頭に返す前提で `plans[0]` を参照しています。
                    // 将来的に `current` フラグが追加されたら、ここを置き換えてください。
                    const current = plans.find(p => p.current) || plans[0];
                    return (
                      <div>
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="h6 mb-1">現在のプラン: <strong>{current.plan_type}</strong></div>
                            <div className="small text-muted">上限: {current.monthly_quota} 件/月</div>
                          </div>
                          <div className="text-end">
                            <div className="small text-muted">適用開始: {current.active_from || '—'}</div>
                            <div className="mt-2">{plans.length > 0 && plans[0]?.plan_type === current.plan_type && <span className="badge bg-primary">現在</span>}</div>
                          </div>
                        </div>
                        <div className="mt-2 small text-muted">備考: プランの詳細は将来的に `feature_flags` や `limits` などで拡張される可能性があります。</div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-muted">プランは未設定です</div>
                )}
              </div>

              {/* 比較モーダルは右カラムのここから開く（左カラムの重複表示を削除） */}
              <div className="mb-2">
                <button className="btn btn-outline-primary" onClick={() => setShowPlanModal(true)}>プランを比較して選ぶ</button>
              </div>

              {/* 現在のプラン上限と残り送信数表示
                  - ここでは現状 API が返す `monthly_quota` を「上限」として表示します。
                  - 残り件数 (remaining) を表示するにはサーバー側で使用済みカウントや remaining フィールドを返す必要があります。
                    例: API が `current_plan.remaining` を返すようになったら `current.remaining` を表示するように差し替えてください。
              */}
              <div className="mb-3">
                {plans.length > 0 ? (
                  (() => {
                    const current = plans.find(p => p.current) || plans[0];
                    return (
                      <div className="small text-muted">
                        <div>送信可能な新規DM（上限）: <strong>{current.monthly_quota} 件/月</strong></div>
                        {/* If API returns remaining, show it here. */}
                        {current.remaining !== undefined ? (
                          <div className="text-primary">残り送信可能数: <strong>{current.remaining}</strong> 件</div>
                        ) : (
                          <div className="text-secondary">残り送信可能数: <em>サーバー側の使用情報が必要です</em></div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-muted">プランは未設定です</div>
                )}
              </div>

                {/* Stripe 購入: Price ID を使ってサブスク Checkout を作る簡易 UI */}
                {/*
                  実装の流れ（フロント）:
                  1) オーナーが Price ID（price_...）を入力してボタンを押す
                  2) フロントは `/api/stripe/create-checkout-session/` に POST する
                     - このリクエストは Cookie ベースの認証を使い、サーバ側で権限チェックを行う（owner/admin のみ）
                  3) サーバが Stripe Checkout Session を作成して `sessionId` を返す
                  4) フロントは `stripe.redirectToCheckout({ sessionId })` で Stripe の決済ページへ遷移

                  注意:
                  - 「Price ID（price_...）」を必ず使ってください。Product ID（prod_...）は Checkout の line_items に直接使えません。
                  - 開発環境では Vite のプロキシを利用して `/api` にリクエストを投げ、HttpOnly Cookie を送受信する想定です。
                */}
                <div className="mb-3">
                  <label className="form-label">Stripe Price ID</label>
                  <input className="form-control mb-2" placeholder="price_... を入力" value={priceId} onChange={e => setPriceId(e.target.value)} />
                  <div className="d-flex gap-2">
                    <button className="btn btn-success" disabled={!priceId}
                      onClick={async () => {
                        if (!priceId) { alert('Price ID を入力してください'); return; }
                        // クライアント側で簡易検証: Stripe の Price ID は `price_` で始まる
                        // よくある間違い: Dashboard から Product ID（prod_...）をコピーしてしまうケース
                        if (!priceId.startsWith('price_')) {
                          if (priceId.startsWith('prod_')) {
                            alert('指定された ID は Product ID (prod_...) のようです。サブスクには Price ID (price_...) を入力してください。');
                          } else {
                            alert('Price ID は `price_...` で始まる必要があります。Stripe ダッシュボードの Price を確認してください。');
                          }
                          return;
                        }
                        try {
                          setSaving(true);
                          // サーバーに Checkout Session を作成してもらう
                          const payload = await api('/stripe/create-checkout-session/', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ mode: 'subscription', price_id: priceId, company_id: company.id })
                          });
                          console.log('create-checkout-session response payload:', payload);
                          const sessionId = payload?.sessionId;
                          if (!sessionId) {
                            console.error('sessionId not returned in payload', payload);
                            throw new Error('sessionId not returned');
                          }

                          // debug: ロードした publishable key を出力（キー全文は控えめに）
                          console.log('VITE_STRIPE_PUBLISHABLE_KEY (prefix):', (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '').slice(0, 12) + '...');

                          const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
                          if (!stripe) {
                            console.error('loadStripe returned null/undefined - check publishable key and network');
                            alert('Stripe の初期化に失敗しました（公開鍵を確認してください）');
                            return;
                          }

                          // Stripe.js の redirectToCheckout は廃止されているため、
                          // サーバーから返した `url` に直接遷移する（ホストされた Checkout ページ）
                          if (payload?.url) {
                            console.log('redirecting to hosted checkout url:', payload.url);
                            window.location.href = payload.url;
                            return;
                          }

                          // 互換のため、もし stripe.redirectToCheckout がまだ利用可能なら試す（ただし多くのバージョンで廃止）
                          try {
                            const result = await stripe.redirectToCheckout({ sessionId });
                            console.log('stripe.redirectToCheckout result:', result);
                            if (result && result.error) {
                              console.error('Stripe redirect error:', result.error);
                              alert('Stripe redirect error: ' + (result.error.message || result.error.toString()));
                            }
                          } catch (e) {
                            console.warn('redirectToCheckout not available or failed, please use session.url', e);
                          }
                        } catch (err) {
                          console.error(err);
                          alert('Checkout の作成に失敗しました');
                        } finally { setSaving(false); }
                      }}>Stripeで購入（サブスク）</button>
                    <button className="btn btn-outline-secondary" onClick={() => { setPriceId(''); }}>クリア</button>
                  </div>
                </div>
            </section>
          </div>
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          プラン比較モーダル
          ─────────────────────────────────────────────────────────────
          showPlanModal が true の時、3つのプリセットプランを表形式で比較表示
          各プランの「このプランにする」ボタンをクリックすると applyPresetPlan() を実行
          ─────────────────────────────────────────────────────────────
      */}
      {showPlanModal && (
        <>
          {/* モーダルバックドロップ（暗いオーバーレイ） */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 1040, background: 'rgba(0,0,0,0.45)' }} />
          {/* モーダルウィンドウ */}
          <div className="modal d-block" tabIndex={-1} role="dialog" style={{ zIndex: 1050 }}>
            <div className="modal-dialog modal-xl" role="document">
              <div className="modal-content" style={{ background: '#fff' }}>
                <div className="modal-header">
                  <h5 className="modal-title">プラン比較</h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowPlanModal(false)} />
                </div>
                <div className="modal-body">
                  <p className="small text-muted">各プランの特徴と初回に送れるDMの上限を比較できます。適用すると新しいプランが作成されます。</p>
                  <div className="table-responsive">
                    <table className="table table-bordered align-middle text-center">
                      <thead>
                        <tr>
                          <th className="w-25 text-start">項目</th>
                          {PLAN_PRESETS.map(p => (
                            <th key={p.key} className="position-relative align-top">
                              <div className="d-flex align-items-center justify-content-center gap-2">
                                <strong>{p.name}</strong>
                                {p.key === 'pro' && <span className="badge bg-success ms-2">推奨</span>}
                              </div>
                              {plans.length > 0 && plans[0]?.plan_type === p.key && (
                                <div className="small text-primary mt-1">現在のプラン</div>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="text-start">月額</td>
                          {PLAN_PRESETS.map(p => (
                            <td key={p.key}>{p.price_jpy === 0 ? <strong>無料</strong> : <strong>{p.price_jpy.toLocaleString()}円/月</strong>}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="text-start">初回DM送信可能数</td>
                          {PLAN_PRESETS.map(p => (
                            <td key={p.key}><strong>{p.monthly_quota}人</strong></td>
                          ))}
                        </tr>
                        <tr>
                          <td className="text-start">候補者の閲覧</td>
                          <td>最大100人</td>
                          <td>最大1,000人</td>
                          <td>無制限</td>
                        </tr>
                        <tr>
                          <td className="text-start">DMテンプレート利用</td>
                          <td>✅</td>
                          <td>✅</td>
                          <td>✅</td>
                        </tr>
                        <tr>
                          <td className="text-start">CSVエクスポート</td>
                          <td>—</td>
                          <td>あり</td>
                          <td>あり（API連携可）</td>
                        </tr>
                        <tr>
                          <td className="text-start">サポート</td>
                          <td>セルフサービス</td>
                          <td>メールサポート</td>
                          <td>専用担当（電話/SLAs）</td>
                        </tr>
                        <tr>
                          <td className="text-start">用途</td>
                          {PLAN_PRESETS.map(p => (
                            <td key={p.key}>{p.desc}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="text-start">操作</td>
                          {PLAN_PRESETS.map(p => (
                            <td key={p.key}>
                              <button className={`${plans.length > 0 && plans[0]?.plan_type === p.key ? 'btn btn-outline-secondary' : 'btn btn-primary'} w-100`}
                                onClick={async () => { await applyPresetPlan(p); }}
                                disabled={!isAdmin || saving}>
                                {plans.length > 0 && plans[0]?.plan_type === p.key ? '現在のプラン' : 'このプランにする'}
                              </button>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPlanModal(false)}>閉じる</button>
                </div>
              </div>
            </div>
          </div>
      </>
      )}
    </>
  );
}
