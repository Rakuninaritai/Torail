// components/SlackPanel.jsx
import { useState, useEffect } from "react";
import { api } from "../../api";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function SlackPanel({ teamId, enabled }) {
  const [hydrating, setHydrating] = useState(true); // 初期取得中フラグ
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState(null);
  const [channels, setChannels] = useState([]);
  const [selected, setSelected] = useState("");

  const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || "http://localhost:8000";

  const fetchStatus = async () => {
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

  useEffect(() => {
    if (!teamId) return;
    let mounted = true;
    const init = async () => {
      setHydrating(true);
      try {
        // ?slack=connected 対応
        const params = new URLSearchParams(window.location.search);
        const ok = params.get("slack");
        await fetchStatus();
        if (ok === "connected") {
          await handleFetchChannels();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const handleConnect = () => {
    if (!teamId) return toast.error("チームが選択されていません。");
    const url = `${BACKEND_ORIGIN}/api/integrations/slack/connect/?team_id=${encodeURIComponent(teamId)}`;
    window.location.assign(url);
  };

  const handleFetchChannels = async () => {
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

  // 初期ロード中はSkeletonのみ
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
