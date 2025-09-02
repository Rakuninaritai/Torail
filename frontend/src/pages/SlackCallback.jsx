// src/pages/SlackCallback.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

export default function SlackCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state'); // team_id
      if (!code || !state) {
        toast.error("Slack 認可に失敗しました（code/state 不足）");
        navigate('/settings/', { replace: true });
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/slack/callback`;
        const res = await fetch('/api/integrations/slack/exchange/', {
          method: 'POST',
          credentials: 'include', // ★ JWT Cookie を送る
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, team_id: state, redirect_uri: redirectUri }),
        });
        const data = await res.json();
        if (data.ok) {
          toast.success("Slack接続が完了しました");
          // 設定ページへ戻す（?slack=connected で自動チャンネル取得）
          navigate(`/settings?team_id=${state}&slack=connected`, { replace: true });
        } else {
          toast.error(`Slack交換に失敗: ${data.error || 'unknown'}`);
          navigate(`/settings?team_id=${state}`, { replace: true });
        }
      } catch (e) {
        toast.error("Slack交換リクエストに失敗しました");
        navigate(`/settings?team_id=${state}`, { replace: true });
      }
    })();
  }, [navigate]);

  return <div className="container py-4">Slack と通信中…</div>;
}
