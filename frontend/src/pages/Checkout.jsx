import React from 'react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export default function CheckoutButton({ amount = 1000, name = 'サービス購入', metadata = {} }) {
  // amount: integer (通貨の最小単位で渡すこと）
  async function handleClick() {
    try {
      // サーバーに Checkout Session を作成してもらう
      // - POST /api/stripe/create-checkout-session/ に必要パラメタを渡す
      // - サーバ側が Stripe API を呼び、sessionId を返す
      // - 返却された sessionId を使って stripe.redirectToCheckout() で決済ページへ遷移
      // 注意: サブスクを作る場合は price_id (price_...) を使うこと（product_... では動きません）
      const res = await fetch('/api/stripe/create-checkout-session/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency: 'jpy',
          name,
          success_url: window.location.origin + '/success',
          cancel_url: window.location.origin + '/cancel',
          metadata,
        }),
      });
      const data = await res.json();
      if (!data.sessionId && !data.url) {
        console.error('session creation failed', data);
        alert('決済セッションの作成に失敗しました');
        return;
      }

      // 新しい stripe.js では redirectToCheckout が廃止されているため、サーバーから返した URL に遷移する
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }

      // 互換性のため、まだ利用可能な場合は stripe.redirectToCheckout を試す
      const stripe = await stripePromise;
      try {
        const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
        if (error) {
          console.error(error);
          alert('決済ページへの遷移に失敗しました');
        }
      } catch (e) {
        console.warn('redirectToCheckout not available; please use session.url', e);
        alert('ブラウザで決済ページへ遷移できませんでした。ページをリロードして再試行してください。');
      }
    } catch (e) {
      console.error(e);
      alert('決済処理中にエラーが発生しました');
    }
  }

  return (
    <button onClick={handleClick} className="btn btn-primary">
      購入する
    </button>
  );
}
