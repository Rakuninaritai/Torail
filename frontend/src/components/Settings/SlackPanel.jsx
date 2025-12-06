// ============================================================
// Slack 連携設定パネル - React コンポーネント
// ============================================================
//
// 【役割】
// -------
// フロント側の Slack 連携設定 UI。
// 以下の機能を提供：
//   1. Slack ワークスペースに接続
//   2. チャンネル一覧を取得・選択
//   3. 通知先チャンネルを保存
//   4. テスト送信で動作確認
//
// 【フロー】
// --------
// 1. 「Slack に接続」ボタン
//    → window.location.assign(バックエンド OAuth URL)
//    → ユーザーが Slack で認可
//    → slack_callback でリダイレクト
//    → ?slack=connected で戻ってくる
//
// 2. URLパラメータから slack=connected を検出
//    → handleFetchChannels() を自動実行
//    → チャンネル一覧をバックエンドから取得
//
// 3. プルダウンからチャンネル選択
//    → 「保存」ボタンで DB に保存
//
// 4. 「テスト送信」で動作確認
//    → テストメッセージが Slack に投稿される
//

import { useState, useEffect } from "react";
import { api } from "../../api";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function SlackPanel({ teamId, enabled }) {
  // ==========================================
  // State 管理
  // ==========================================
  const [hydrating, setHydrating] = useState(true); // 初期取得中フラグ
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);    // 接続済みか？
  const [status, setStatus] = useState(null);          // ワークスペース情報
  const [channels, setChannels] = useState([]);         // チャンネル一覧
  const [selected, setSelected] = useState("");         // 選択中のチャンネルID

  const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || "http://localhost:8000";

  // ==========================================
  // 接続ステータス取得
  // ==========================================
  const fetchStatus = async () => {
    /**
     * バックエンド /integrations/slack/status/ から
     * 現在の接続状態を取得。
     * 
     * 返す値：
     * {
     *   connected: true/false,
     *   workspace: {id, name},
     *   channel: {id, name}
     * }
     */
    try {
      const data = await api(`/integrations/slack/status/?team_id=${teamId}`, { method: "GET" });
      if (data.ok && data.connected) {
        setConnected(true);
        setStatus(data);
        if (data.channel?.id) setSelected(data.channel.id);
      } else {
        setConnected(false);
        setStatus(null);
      }
    } catch {
      setConnected(false);
      setStatus(null);
    }
  };

  // ==========================================
  // 初期化 & OAuth 戻り処理
  // ==========================================
  useEffect(() => {
    if (!teamId) return;
    let mounted = true;
    const init = async () => {
      setHydrating(true);
      try {
        // URL に ?slack=connected が付いているか確認
        // (slack_callback から戻ってきた合図)
        const params = new URLSearchParams(window.location.search);
        const ok = params.get("slack");
        
        // 現在の接続状態を取得
        await fetchStatus();
        
        // 新たに接続された場合、チャンネル一覧を自動取得
        if (ok === "connected") {
          await handleFetchChannels();
          // URL を整形して履歴から削除
          params.delete("slack");
          const qs = params.toString();
          window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
        }
      } finally {
        if (mounted) setHydrating(false);
      }
    };
    init();
    return () => { mounted = false; };
  }, [teamId]);

  // ==========================================
  // ハンドラー関数群
  // ==========================================

  const handleConnect = () => {
    /**
     * 「Slack に接続」ボタンのクリック。
     * バックエンド OAuth URL へ遷移。
     */
    if (!teamId) return toast.error("チームが選択されていません。");
    const url = `${BACKEND_ORIGIN}/api/integrations/slack/connect/?team_id=${encodeURIComponent(teamId)}`;
    window.location.assign(url);  // ← フルページ遷移
  };

  const handleFetchChannels = async () => {
    /**
     * バックエンド /integrations/slack/channels/ から
     * チャンネル一覧を取得。
     */
    if (!teamId) return toast.error("チームが選択されていません。");
    setLoading(true);
    try {
      const res = await api(`/integrations/slack/channels/?team_id=${teamId}`, { method: "GET" });
      if (res.ok) {
        setConnected(true);
        const list = res.channels || [];
        setChannels(list);
        if (list.length === 0) toast.info("チャンネルが見つかりません。権限を確認してください。");
        else toast.success("チャンネル一覧を取得しました。");
      } else if (res.error === "not_connected") {
        setConnected(false);
        toast.warn("先に『Slackに接続』してください。");
      } else {
        toast.error(`チャンネル取得に失敗: ${res.error || "unknown error"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChannel = async () => {
    /**
     * 選択したチャンネルID をバックエンドに保存。
     * /integrations/slack/save_channel/ に POST
     */
    if (!selected) return toast.error("チャンネルを選択してください。");
    setLoading(true);
    try {
      await api(`/integrations/slack/save_channel/`, {
        method: "POST",
        body: JSON.stringify({ team_id: teamId, channel_id: selected }),
      });
      toast.success("チャンネルを保存しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    /**
     * テストメッセージ送信。
     * /integrations/slack/test/ に POST
     */
    setLoading(true);
    try {
      const data = await api(`/integrations/slack/test/?team_id=${teamId}`, { method: "POST" });
      if (data.ok) toast.success("Slackへテスト送信しました。");
      else if (data.error === "not_ready") toast.warn("チャンネル未設定です。");
      else if (data.error === "not_connected") toast.warn("未接続です。");
      else toast.error(`失敗: ${data.error || "unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // レンダリング
  // ==========================================

  if (hydrating) {
    return <Skeleton height={220} />;
  }

  const disabled = !enabled || loading;

  return (
    <div className={`card p-3 ${!enabled ? "opacity-50" : ""}`}>
      <h5 className="mb-2">Slack 連携</h5>

      {status?.connected ? (
        <div className="alert alert-success py-2">
          連携済：<strong>{status.workspace?.name ?? "（名称取得不可）"}</strong>
          {status.channel?.name && <> / <span>#{status.channel.name}</span></>}
        </div>
      ) : (
        <div className="alert alert-secondary py-2">未連携</div>
      )}

      <div className="d-flex flex-column gap-2">
        <button className="btn btn-outline-dark" onClick={handleConnect} disabled={disabled}>
          {connected ? "ワークスペース変更 / 再接続" : "Slackに接続"}
        </button>

        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={handleFetchChannels} disabled={disabled}>
            {loading ? "取得中..." : "チャンネル取得"}
          </button>

          <select
            className="form-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!enabled || !connected || loading || channels.length === 0}
            style={{ maxWidth: 300 }}
          >
            <option value="">チャンネルを選択</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>#{c.name}</option>
            ))}
          </select>

        <button className="btn btn-primary" onClick={handleSaveChannel} disabled={!enabled || !selected || loading}>
            保存
          </button>
        </div>

        <button className="btn btn-success" onClick={handleTest} disabled={disabled}>
          テスト送信
        </button>
      </div>
    </div>
  );
}
