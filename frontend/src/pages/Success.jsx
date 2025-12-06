import React, { useEffect, useState, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { api } from '../api';

export default function Success() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [polling, setPolling] = useState(false);
  const attemptsRef = useRef(0);
  const maxAttempts = 15; // 15 attempts * interval (2000ms) = 30 seconds
  const intervalMs = 2000;

  useEffect(() => {
    let mounted = true;
    async function fetchOnce() {
      try {
        const params = new URLSearchParams(location.search);
        const sessionId = params.get('session_id');
        let data;
        if (!sessionId) {
          data = await api(`/stripe/session/`);
        } else {
          data = await api(`/stripe/session/?session_id=${encodeURIComponent(sessionId)}`);
        }
        if (!mounted) return;
        setInfo(data);
        // If not yet paid / active, start polling
        const paid = data?.order?.paid === true;
        const active = data?.company_subscription?.status === 'active';
        if (!paid && !active) {
          setPolling(true);
          attemptsRef.current = 0;
        }
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        setError(e?.message || JSON.stringify(e));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    fetchOnce();

    return () => { mounted = false; };
  }, [location.search]);

  // Polling effect
  useEffect(() => {
    if (!polling) return;
    let timer = null;
    let mounted = true;
    const tryFetch = async () => {
      attemptsRef.current += 1;
      try {
        const params = new URLSearchParams(location.search);
        const sessionId = params.get('session_id');
        const url = sessionId ? `/stripe/session/?session_id=${encodeURIComponent(sessionId)}` : `/stripe/session/`;
        const data = await api(url);
        if (!mounted) return;
        setInfo(data);
        const paid = data?.order?.paid === true;
        const active = data?.company_subscription?.status === 'active';
        if (paid || active) {
          setPolling(false);
          return;
        }
        if (attemptsRef.current >= maxAttempts) {
          setPolling(false);
          return;
        }
      } catch (e) {
        console.error('polling error', e);
        // keep polling until attempts exhausted
        if (attemptsRef.current >= maxAttempts) {
          setPolling(false);
        }
      }
      timer = setTimeout(tryFetch, intervalMs);
    };
    // kick off
    timer = setTimeout(tryFetch, intervalMs);

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [polling, location.search]);

  if (loading) return <div className="container-xxl py-5">読み込み中...</div>;
  if (error) return (
    <div className="container-xxl py-5">
      <div className="torail-card">
        <h3>決済結果の確認に失敗しました</h3>
        <p className="text-danger">{String(error)}</p>
        <p>時間を置いて再度お試しください。問題が続く場合はサポートに連絡してください。</p>
        <Link to="/">ホームへ戻る</Link>
      </div>
    </div>
  );

  // 成功かどうかは webhook 側で決定するのが正しいので、ここでは Stripe の Session と DB の状態を表示する
  const stripe = info?.stripe || {};
  const order = info?.order || null;
  const sub = info?.company_subscription || null;

  return (
    <div className="container-xxl py-5">
      <div className="page-header mb-3">
        <h1 className="title h4 mb-0">決済完了</h1>
        <span className="subtle ms-2">決済状況を確認しています</span>
      </div>

      <section className="torail-card">
        <h3>Checkout セッション</h3>
        <dl>
          <dt>Session ID</dt><dd>{info?.sessionId || 'N/A'}</dd>
          <dt>Mode</dt><dd>{stripe.mode || 'unknown'}</dd>
          <dt>Payment status</dt><dd>{stripe.payment_status || stripe.status || 'unknown'}</dd>
          <dt>Subscription</dt><dd>{stripe.subscription || '-'}</dd>
        </dl>

        {order && (
          <>
            <h4>Order (内部)</h4>
            <dl>
              <dt>Order ID</dt><dd>{order.id}</dd>
              <dt>Paid</dt><dd>{String(order.paid)}</dd>
              <dt>Amount</dt><dd>{order.amount} {order.currency}</dd>
            </dl>
          </>
        )}

        {sub && (
          <>
            <h4>Company Subscription</h4>
            <dl>
              <dt>Subscription ID</dt><dd>{sub.id}</dd>
              <dt>Status</dt><dd>{sub.status}</dd>
              <dt>Current period end</dt><dd>{sub.current_period_end || '-'}</dd>
            </dl>
          </>
        )}

        <div className="mt-3">
          {polling ? (
            <div>
              <div className="mb-2">反映待ち: ウェブフックの反映を待っています（最大約30秒）...</div>
              <button className="btn btn-outline-secondary me-2" onClick={() => { setPolling(false); }}>待機を停止</button>
            </div>
          ) : (
            <>
              <Link className="btn btn-primary me-2" to="/">ホームへ</Link>
              <Link className="btn btn-outline-secondary" to="/company/dashboard">会社ダッシュボード</Link>
            </>
          )}
          {!polling && info && !(info?.order?.paid || info?.company_subscription?.status === 'active') && (
            <div className="mt-3">
              <div className="text-muted mb-2">まだ支払いが確定していません。数秒後に再確認してください。</div>
              <button className="btn btn-secondary" onClick={async () => {
                setLoading(true); setError(null);
                try {
                  const params = new URLSearchParams(location.search);
                  const sessionId = params.get('session_id');
                  const url = sessionId ? `/stripe/session/?session_id=${encodeURIComponent(sessionId)}` : `/stripe/session/`;
                  const data = await api(url);
                  setInfo(data);
                } catch (e) {
                  setError(e?.message || JSON.stringify(e));
                } finally {
                  setLoading(false);
                }
              }}>手動で再確認</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
