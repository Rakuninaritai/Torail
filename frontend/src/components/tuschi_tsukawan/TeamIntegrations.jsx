import { useEffect, useState } from 'react';
import { api } from '../api';
import { useTeam } from '../context/TeamContext';

export default function TeamIntegrations() {
  const { currentTeamId } = useTeam();
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState([]);
  const [channels, setChannels] = useState(null);

  useEffect(() => {
    if (!currentTeamId) return;

    (async () => {
      try {
        const data = await api(`/integrations/?team=${currentTeamId}`);
        setIntegrations(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentTeamId]);

  const connect = async provider => {
    const data = await api(`/integrations/${provider}/url/?team=${currentTeamId}`
    );
    window.location.href = data.url;
  };

  const fetchDiscordChannels = async () => {
    const integ = integrations.find(i => i.provider === 'discord');
    if (!integ) return;
    const data = await api(`/integrations/discord/channels/?integration=${integ.id}`
      );
    setChannels(data);
  };

  const saveChannel = async (integrationId, channelId) => {
    await api(`/integrations/${integrationId}/`, {
   method: 'PATCH',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ channel_id: channelId }),
 });
    setIntegrations(prev =>
      prev.map(i =>
        i.id === integrationId ? { ...i, channel_id: channelId } : i
      )
    );
  };

  if (loading) return <p>Loading...</p>;

  const discord = integrations.find(i => i.provider === 'discord');
  const slack   = integrations.find(i => i.provider === 'slack');

  return (
    <div className="space-y-6">
      {discord ? (
        <section>
          <h3 className="font-bold">Discord ✅</h3>
          {channels ? (
            <select
              value={discord.channel_id}
              onChange={e => saveChannel(discord.id, e.target.value)}
              className="border px-2 py-1 rounded"
            >
              {Object.entries(channels).map(([id, name]) => (
                <option key={id} value={id}>
                  #{name}
                </option>
              ))}
            </select>
          ) : (
            <button onClick={fetchDiscordChannels} className="btn btn-outline">
              チャンネルを選択
            </button>
          )}
        </section>
      ) : (
        <button onClick={() => connect('discord')} className="btn btn-primary">
          Discord と連携
        </button>
      )}

      {slack ? (
        <p>Slack ✅ （チャンネル変更 UI は同じ要領で）</p>
      ) : (
        <button onClick={() => connect('slack')} className="btn btn-primary">
          Slack と連携
        </button>
      )}
    </div>
  );
}
