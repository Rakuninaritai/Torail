import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CompanyProfileCard from "../../components/Company/settings/CompanyProfileCard";
import HiringInfoCard from "../../components/Company/settings/HiringInfoCard";
// import "../Company/companydash.css";
import { api } from "../../api";

// ────────────────────────────────────────────────────────────────
// 企業の公開ページ
// ────────────────────────────────────────────────────────────────
// URL: /company/public/:slug
// 非ログインユーザーや他社ユーザーが、企業の公開情報（プロフィール、求人）
// を参照する画面（読み取り専用）。
// ────────────────────────────────────────────────────────────────
export default function PublicCompanyPage() {
  // ─────────────────────────────────────────────────────────────
  // ① State と URL パラメータ
  // ─────────────────────────────────────────────────────────────
  // slug = URL から取得した企業のスラッグ（例: "torail-inc"）
  // data = GET /public/companies/{slug}/ から取得した企業情報
  //   - company オブジェクト（name, industry, description, website, logo_url など）
  //   - hirings 配列（公開中の求人リスト）
  // loading = データ取得中フラグ
  // ─────────────────────────────────────────────────────────────
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─────────────────────────────────────────────────────────────
  // ② 初期化: 企業情報を取得
  // ─────────────────────────────────────────────────────────────
  // GET /public/companies/{slug}/ で企業と公開中の求人を取得
  // 企業の is_public = true で、かつ show_hirings = true なら求人も表示
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        // アンオーセンティケーテッド（未ログイン）で企業情報を取得
        const res = await api(`/public/companies/${slug}/`, { method: "GET" });
        setData(res);
      } catch (e) {
        console.error("企業情報の取得に失敗しました", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // ─────────────────────────────────────────────────────────────
  // ③ 条件分岐描画
  // ─────────────────────────────────────────────────────────────
  // loading 中 = ローディングメッセージ
  // data が null = 企業が見つからない or 非公開 → エラーメッセージ
  // data がある = 企業プロフィール + 求人リスト表示
  // ─────────────────────────────────────────────────────────────
  if (loading) return <main className="container-xxl pb-5">読み込み中...</main>;
  if (!data) return <main className="container-xxl pb-5 text-danger">企業情報が見つかりません。</main>;

  // 企業情報と求人データを分割代入
  const { company, hirings } = data;

  return (
    <main className="container-xxl pb-5">
      {/* ページヘッダ: 企業名と業種 */}
      <div className="page-header mb-3">
        <i className="bi bi-building fs-4" />
        <h1 className="title h4 mb-0">{company.name}</h1>
        <span className="subtle ms-2">{company.industry}</span>
      </div>

      {/* 企業プロフィールカード: 読み取り専用（isAdmin=false） */}
      <CompanyProfileCard
        profile={{
          name: company.name,
          industry: company.industry,
          description: company.description,
          website: company.website,
          logo: company.logo_url,
        }}
        isAdmin={false}  // 編集ボタン非表示
        onChange={() => {}}
      />

      {/* 募集情報カード: 読 取り専用 */}
      <HiringInfoCard
        info={{
          category: "新卒 / インターン",
          stack: hirings?.map(h => h.tech_stack).join(", "),
          location: hirings?.map(h => h.location).join(", "),
          startDate: hirings?.[0]?.created_at?.slice(0, 10) || "—",
        }}
        isAdmin={false}
        onChange={() => {}}
      />

      {/* 公開中の求人リスト */}
      <section className="torail-card">
        <h6 className="mb-2">公開中の求人</h6>
        {hirings.length === 0 ? (
          <div className="text-muted">現在公開中の求人はありません。</div>
        ) : (
          <ul className="list-group">
            {hirings.map((h, i) => (
              <li key={i} className="list-group-item">
                <div className="fw-bold">{h.title}</div>
                <div className="text-muted small">{h.tech_stack}</div>
                <div className="small">{h.location}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
