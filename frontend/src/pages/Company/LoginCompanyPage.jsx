import React from "react";
import Login_Register from "../Login_Register";

export default function LoginCompanyPage() {
  return (
    <main className="container-sm py-5" style={{ maxWidth: 480 }}>
      <div className="text-center mb-4">
        <i className="bi bi-building fs-2 text-primary" />
        <h2 className="h5 mt-2">企業ログイン</h2>
        <p className="subtle">企業アカウントでログインしてください</p>
      </div>
      <Login_Register redirectTo="/company/dashboard" 
        defaultTab="register"              // 企業は最初から会員登録を前面に
        fixedAccountType="company"        // ← これが肝。登録時に company を送る
        companyFlow 
      />
    </main>
  );
}
