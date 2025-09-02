// components/DiscordPanel.jsx
import { useEffect, useState } from "react";
import { api } from "../api";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function DiscordPanel({ teamId, enabled }) {
  const [hydrating, setHydrating] = useState(true);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState(null); // { guild:{name}, channel:{name} }
  const [channels, setChannels] = useState([]);
  const [selected, setSelected] = useState("");

  const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || "http://localhost:8000";

  const fetchStatus = async () => {
    try {
      const data = await api(`/integrations/discord/status/?team_id=${teamId}`, { method: "GET" });
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
        const params = new URLSearchParams(window.location.search);
        const ok = params.get("discord");
        await fetchStatus();
        if (ok === "connected") {
          await handleFetchChannels();
          params.delete("discord");
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
    const url = `${BACKEND_ORIGIN}/api/integrations/discord/connect/?team_id=${encodeURIComponent(teamId)}`;
    window.location.assign(url);
  };

  const handleFetchChannels = async () => {
    if (!teamId) return toast.error("チームが選択されていません。");
    setLoading(true);
    try {
      const res = await api(`/integrations/discord/channels/?team_id=${teamId}`, { method: "GET" });
      if (res.ok) {
        setConnected(true);
        const list = res.channels || [];
        setChannels(list);
        if (list.length === 0) toast.info("チャンネルが見つかりません。Botの権限を確認してください。");
        else toast.success("チャンネル一覧を取得しました。");
      } else if (res.error === "not_connected") {
        setConnected(false);
        toast.warn("まだDiscordに接続されていません。");
      } else {
        toast.error(`チャンネル取得に失敗しました: ${res.error || "unknown error"}`);
      }
    } catch {
      toast.error("チャンネル取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChannel = async () => {
    if (!selected) return toast.error("チャンネルを選択してください。");
    setLoading(true);
    try {
      await api(`/integrations/discord/save_channel/`, {
        method: "POST",
        body: JSON.stringify({ team_id: teamId, channel_id: selected }),
      });
      toast.success("Discordチャンネルを保存しました。");
    } catch (err) {
      toast.error(`保存に失敗しました: ${err?.error || "unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setLoading(true);
    try {
      const data = await api(`/integrations/discord/test/?team_id=${teamId}`, { method: "POST" });
      if (data.ok) toast.success("Discordへテスト送信しました。");
      else if (data.error === "not_ready") toast.warn("チャンネル未設定です。");
      else if (data.error === "not_connected") toast.warn("Discord未接続です。");
      else toast.error(`テスト送信に失敗しました: ${data.error || "unknown error"}`);
    } catch {
      toast.error("テスト送信に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  if (hydrating) {
    return <Skeleton height={220} />;
  }

  const disabled = !enabled || loading;

  return (
    <div className={`card p-3 ${!enabled ? "opacity-50" : ""}`}>
      <h5 className="mb-2">Discord 連携</h5>

      {status?.connected ? (
        <div className="alert alert-success py-2">
          連携済み：<strong>{status.guild?.name ?? "（名称取得不可）"}</strong>
          {status.channel?.name && <> / <span>#{status.channel.name}</span></>}
        </div>
      ) : (
        <div className="alert alert-secondary py-2">未連携</div>
      )}

      <div className="d-flex flex-column gap-2">
        <button className="btn btn-outline-dark" onClick={handleConnect} disabled={disabled}>
          {connected ? "サーバー変更 / 再接続" : "Discordに接続"}
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

        <small className="text-muted">
          ※ 「チャンネル取得」で空の場合、Botの権限や対象チャンネルの閲覧権限を確認してください。
        </small>
      </div>
    </div>
  );
}
