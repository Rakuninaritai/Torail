import React from "react";
import Login_Register from "../Login_Register";

// ────────────────────────────────────────────────────────────────
// 企業ログインページ
// ────────────────────────────────────────────────────────────────
// URL: /company/login
// 企業ユーザーのログイン・新規登録フロー。
// Login_Register コンポーネントに fixedAccountType="company" を渡すことで、
// 登録時に account_type = "company" で送信される。
// ────────────────────────────────────────────────────────────────
export default function LoginCompanyPage() {
  return (
    <main className="container-sm py-5" style={{ maxWidth: 480 }}>
      <div className="text-center mb-4">
        <i className="bi bi-building fs-2 text-primary" />
        <h2 className="h5 mt-2">企業ログイン</h2>
        <p className="subtle">企業アカウントでログインしてください</p>
      </div>
      
      {/* ─────────────────────────────────────────────────────────────
          Login_Register コンポーネント
          ─────────────────────────────────────────────────────────────
          - redirectTo="/company/dashboard" : ログイン後の遷移先
          - defaultTab="register" : 企業ユーザーは最初から登録フォーム表示
          - fixedAccountType="company" : account_type を "company" に固定
          - companyFlow : 企業フロー関連のオプション設定
          ─────────────────────────────────────────────────────────────
      */}
      <Login_Register redirectTo="/company/dashboard" 
        defaultTab="register"              // 企業は最初から会員登録を前面に
        fixedAccountType="company"        // ← これが肝。登録時に account_type="company" を送る
        companyFlow 
      />
    </main>
  );
}
