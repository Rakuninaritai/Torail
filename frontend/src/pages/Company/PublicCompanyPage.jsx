import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CompanyProfileCard from "../../components/Company/settings/CompanyProfileCard";
import HiringInfoCard from "../../components/Company/settings/HiringInfoCard";
// import "../Company/companydash.css";
import { api } from "../../api";

export default function PublicCompanyPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api(`/public/companies/${slug}/`, { method: "GET" });
        setData(res);
      } catch (e) {
        console.error("企業情報の取得に失敗しました", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) return <main className="container-xxl pb-5">読み込み中...</main>;
  if (!data) return <main className="container-xxl pb-5 text-danger">企業情報が見つかりません。</main>;

  const { company, hirings } = data;

  return (
    <main className="container-xxl pb-5">
      <div className="page-header mb-3">
        <i className="bi bi-building fs-4" />
        <h1 className="title h4 mb-0">{company.name}</h1>
        <span className="subtle ms-2">{company.industry}</span>
      </div>

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
