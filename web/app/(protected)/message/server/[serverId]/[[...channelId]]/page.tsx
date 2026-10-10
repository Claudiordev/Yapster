import { ServerView } from "../../../_Components/_Servers/ServerView";

export default async function ServerPage({
  params,
}: {
  params: Promise<{ serverId: string; channelId?: string[] }>;
}) {
  const { serverId, channelId } = await params;

  return <ServerView channelId={channelId?.[0] ?? null} serverId={serverId} />;
}
