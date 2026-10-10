"use client";

import {
  Bell,
  Check,
  ChevronDown,
  Compass,
  Copy,
  Crown,
  Headphones,
  LogOut,
  Lock,
  Megaphone,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Pin,
  Plus,
  Search,
  SendHorizontal,
  Settings,
  Shield,
  Smile,
  Trash2,
  UserPlus,
  Users,
  Volume2,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  INITIAL_SERVERS,
  PERMISSIONS,
  TIER_RANK,
  TONES,
  defaultRoles,
  type Channel,
  type Member,
  type Message,
  type Perm,
  type Role,
  type ServerData,
  type Status,
  type Tier,
} from "./servers-mock-data";

type ModalKind = null | "invite" | "create-server" | "create-channel" | "settings";

const GRADIENTS = [
  "linear-gradient(145deg,#7ab8ff,#3a64d8)",
  "linear-gradient(145deg,#7ee0a1,#2a9d63)",
  "linear-gradient(145deg,#c9a2ff,#7a45d6)",
  "linear-gradient(145deg,#8be3e0,#2a8f9e)",
];

const STATUS_LABEL: Record<Status, string> = { online: "Online", idle: "Idle", busy: "Do not disturb", offline: "Offline" };

function Avatar({ name, tone, size = 36, status, bot }: { name: string; tone: number; size?: number; status?: Status; bot?: boolean }) {
  return (
    <span className="sm-avatar" style={{ width: size, height: size, background: TONES[tone % TONES.length], fontSize: size * 0.4 }}>
      {name.slice(0, 1).toUpperCase()}
      {status && <i className={`sm-status sm-status--${status}`} title={STATUS_LABEL[status]} />}
      {bot && <b className="sm-bot">BOT</b>}
    </span>
  );
}

function ChannelIcon({ kind, locked }: { kind: Channel["kind"]; locked?: boolean }) {
  if (locked) return <Lock size={13} />;
  if (kind === "announce") return <Megaphone size={13} />;
  return <b className={`sm-glyph ${kind === "voice" ? "sm-glyph--voice" : ""}`}>{kind === "voice" ? "⌁" : "#"}</b>;
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="sm-modal-wrap" role="dialog" aria-modal="true" aria-label={title} onMouseDown={onClose}>
      <div className={`sm-modal ${wide ? "sm-modal--wide" : ""}`} onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} className={`sm-toggle ${on ? "is-on" : ""}`} onClick={onChange}>
      <i />
    </button>
  );
}

function makeServer(name: string, template: string): ServerData {
  const id = `s${Date.now()}`;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const roles = defaultRoles(id);
  const base: Channel[] = [
    { id: `${id}-general`, name: "general", kind: "text", category: "TEXT CHANNELS", minView: "member", minSend: "member" },
    { id: `${id}-voice`, name: "General", kind: "voice", category: "VOICE CHANNELS", minView: "member", minSend: "member", voiceMembers: [] },
  ];
  const extra: Record<string, Channel[]> = {
    gaming: [
      { id: `${id}-lfg`, name: "looking-for-group", kind: "text", category: "TEXT CHANNELS", minView: "member", minSend: "member" },
      { id: `${id}-clips`, name: "clips", kind: "text", category: "TEXT CHANNELS", minView: "member", minSend: "member" },
      { id: `${id}-squad`, name: "Squad 1", kind: "voice", category: "VOICE CHANNELS", minView: "member", minSend: "member", voiceMembers: [] },
    ],
    community: [
      { id: `${id}-rules`, name: "rules", kind: "announce", category: "INFO", minView: "member", minSend: "mod" },
      { id: `${id}-intro`, name: "introductions", kind: "text", category: "TEXT CHANNELS", minView: "member", minSend: "member" },
    ],
    friends: [],
  };
  return {
    id,
    name,
    short: initials || "NS",
    gradient: GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)],
    ownerId: "you",
    roles,
    members: [],
    channels: [...(template === "community" ? extra.community : []), ...base, ...(extra[template] && template !== "community" ? extra[template] : [])],
    messages: {},
  };
}

export function ServersMock() {
  const [servers, setServers] = useState<ServerData[]>(INITIAL_SERVERS);
  const [serverId, setServerId] = useState("nf");
  const [activeBy, setActiveBy] = useState<Record<string, string>>({ nf: "squad-chat", ar: "general" });
  const [viewAs, setViewAs] = useState<Tier>("owner");
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [membersOpen, setMembersOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [voice, setVoice] = useState<{ serverId: string; channelId: string } | null>(null);
  const [mic, setMic] = useState(true);
  const [deaf, setDeaf] = useState(false);
  const [screen, setScreen] = useState(false);
  const [card, setCard] = useState<{ id: string; y: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const server = servers.find((s) => s.id === serverId) ?? servers[0];

  function notify(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(null), 2600);
  }

  // ---- permission model (client-side mirror of what the backend would compute) ----
  const youRole = server.roles.find((r) => r.tier === viewAs) ?? server.roles[0];
  const perms = useMemo(() => {
    const set = new Set<Perm>();
    const memberRole = server.roles.find((r) => r.tier === "member");
    memberRole?.perms.forEach((p) => set.add(p));
    youRole.perms.forEach((p) => set.add(p));
    return set;
  }, [server.roles, youRole]);
  const has = (p: Perm) => viewAs === "owner" || perms.has("ADMINISTRATOR") || perms.has(p);
  const rank = TIER_RANK[viewAs];

  const canView = (c: Channel) => has("ADMINISTRATOR") || (has("VIEW_CHANNEL") && rank >= TIER_RANK[c.minView]);
  const canSend = (c: Channel) => canView(c) && (has("ADMINISTRATOR") || (has("SEND_MESSAGES") && rank >= TIER_RANK[c.minSend]));

  const visibleChannels = server.channels.filter(canView);
  const hiddenCount = server.channels.length - visibleChannels.length;
  const categories = [...new Set(visibleChannels.map((c) => c.category))];

  const activeId = activeBy[server.id];
  const active =
    visibleChannels.find((c) => c.id === activeId) ?? visibleChannels.find((c) => c.kind !== "voice") ?? visibleChannels[0];

  // ---- members with "You" slotted in according to the role being previewed ----
  const members: Member[] = useMemo(() => {
    const you: Member = { id: "you", name: "You", roleId: youRole.id, status: "online", tone: 0 };
    const rest = viewAs === "owner" ? server.members.filter((m) => m.id !== server.ownerId) : server.members;
    return [you, ...rest];
  }, [server.members, server.ownerId, viewAs, youRole.id]);
  const memberById = (id?: string) => members.find((m) => m.id === id) ?? server.members.find((m) => m.id === id);
  const roleById = (id: string) => server.roles.find((r) => r.id === id) as Role;

  const grouped = useMemo(() => {
    const out: { key: string; label: string; color?: string; list: Member[] }[] = [];
    const ordered = [...server.roles].sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier]);
    for (const role of ordered) {
      if (role.tier === "member") continue;
      const list = members.filter((m) => m.roleId === role.id && m.status !== "offline");
      if (list.length) out.push({ key: role.id, label: role.name + (role.name.endsWith("s") ? "" : "s"), color: role.color, list });
    }
    const online = members.filter((m) => roleById(m.roleId).tier === "member" && m.status !== "offline");
    if (online.length) out.push({ key: "online", label: "Online", list: online });
    const offline = members.filter((m) => m.status === "offline");
    if (offline.length) out.push({ key: "offline", label: "Offline", list: offline });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, server.roles]);

  const messages = active ? (server.messages[active.id] ?? []) : [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [active?.id, messages.length, serverId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setModal(null);
      setMenuOpen(false);
      setCard(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function updateServer(patch: (s: ServerData) => ServerData) {
    setServers((all) => all.map((s) => (s.id === server.id ? patch(s) : s)));
  }

  function selectChannel(c: Channel) {
    setActiveBy((prev) => ({ ...prev, [server.id]: c.id }));
    setCard(null);
  }

  function send() {
    const text = draft.trim();
    if (!text || !active || !canSend(active)) return;
    const msg: Message = {
      id: `m${Date.now()}`,
      authorId: "you",
      text,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    };
    updateServer((s) => ({ ...s, messages: { ...s.messages, [active.id]: [...(s.messages[active.id] ?? []), msg] } }));
    setDraft("");
  }

  function joinVoice(c: Channel) {
    if (!has("CONNECT")) return notify("Missing permission: CONNECT");
    setVoice({ serverId: server.id, channelId: c.id });
    setMic(true);
    setDeaf(false);
  }

  function kick(m: Member, ban: boolean) {
    updateServer((s) => ({ ...s, members: s.members.filter((x) => x.id !== m.id) }));
    setCard(null);
    notify(`${m.name} was ${ban ? "banned" : "kicked"}`);
  }

  function removeServer() {
    const rest = servers.filter((s) => s.id !== server.id);
    setServers(rest);
    if (voice?.serverId === server.id) setVoice(null);
    if (rest.length) setServerId(rest[0].id);
    setModal(null);
    setMenuOpen(false);
  }

  const connectedChannel = voice ? servers.find((s) => s.id === voice.serverId)?.channels.find((c) => c.id === voice.channelId) : null;
  const connectedServer = voice ? servers.find((s) => s.id === voice.serverId) : null;
  const cardMember = card ? memberById(card.id) : undefined;

  return (
    <div className="sm-root">
      <div className="page-atmosphere" aria-hidden="true">
        <div className="nebula nebula--one" />
        <div className="nebula nebula--two" />
        <div className="stars stars--one" />
        <div className="stars stars--two" />
      </div>
      <div className="sm-devbar">
        <Link href="/" className="sm-back">
          ← Showcase
        </Link>
        <span className="sm-devbar-note">UI mock · no backend yet · data is local</span>
        <div className="sm-viewas" role="radiogroup" aria-label="Preview as role">
          <span>Preview as</span>
          {(["owner", "mod", "member"] as Tier[]).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={viewAs === t} className={viewAs === t ? "is-active" : ""} onClick={() => setViewAs(t)}>
              {t === "owner" ? "Owner" : t === "mod" ? "Moderator" : "Member"}
            </button>
          ))}
        </div>
      </div>

      <div className="sm-window">
      <div className="sm-window-bar">
        <div className="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="window-address">
          <span /> app.voxsi.com/servers
        </div>
        <span className="window-live">
          <i /> Live
        </span>
      </div>
      <div className="sm-app">
        {/* ---- server rail ---- */}
        <nav className="sm-rail" aria-label="Your servers">
          <button type="button" className="sm-mini-brand" title="Home and direct messages" aria-label="Home and direct messages">
            <Image alt="" height={32} src="/voxsy-mark.svg" width={32} />
          </button>
          <span className="sm-rail-rule" />
          {servers.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`sm-server ${s.id === server.id ? "is-active" : ""}`}
              style={{ background: s.gradient }}
              title={s.name}
              aria-label={s.name}
              aria-current={s.id === server.id ? "true" : undefined}
              onClick={() => {
                setServerId(s.id);
                setMenuOpen(false);
                setCard(null);
              }}
            >
              {s.short}
              {s.unread && s.id !== server.id ? <b>{s.unread}</b> : null}
              <span className="sm-tip">{s.name}</span>
            </button>
          ))}
          <button type="button" className="sm-server sm-server--add" title="Create a server" aria-label="Create a server" onClick={() => setModal("create-server")}>
            <Plus size={20} />
            <span className="sm-tip">Create a server</span>
          </button>
          <span className="sm-rail-rule" />
          <button type="button" className="sm-server sm-server--explore" title="Explore communities" aria-label="Explore communities" onClick={() => notify("Explore is not part of this mock yet")}>
            <Compass size={20} />
            <span className="sm-tip">Explore communities</span>
          </button>
        </nav>

        {/* ---- channel panel ---- */}
        <aside className="sm-channels" aria-label="Channels">
          <div className="sm-server-head">
            <button type="button" className="sm-server-title" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
              <span>{server.name}</span>
              {menuOpen ? <X size={16} /> : <ChevronDown size={16} />}
            </button>
            {menuOpen && (
              <>
                <div className="sm-overlay" onClick={() => setMenuOpen(false)} />
                <div className="sm-menu" role="menu">
                  <button type="button" role="menuitem" disabled={!has("CREATE_INVITE")} onClick={() => { setModal("invite"); setMenuOpen(false); }}>
                    <span>Invite people</span> <UserPlus size={16} />
                  </button>
                  <button type="button" role="menuitem" disabled={!(has("MANAGE_SERVER") || has("MANAGE_ROLES"))} onClick={() => { setModal("settings"); setMenuOpen(false); }}>
                    <span>Server settings</span> <Settings size={16} />
                  </button>
                  <button type="button" role="menuitem" disabled={!has("MANAGE_CHANNELS")} onClick={() => { setModal("create-channel"); setMenuOpen(false); }}>
                    <span>Create channel</span> <Plus size={16} />
                  </button>
                  <span className="sm-menu-rule" />
                  <button type="button" role="menuitem" className="is-danger" disabled={viewAs === "owner"} title={viewAs === "owner" ? "Owners must delete or transfer the server" : ""} onClick={removeServer}>
                    <span>Leave server</span> <LogOut size={16} />
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="sm-channel-scroll">
            {categories.map((cat) => (
              <div className="sm-category" key={cat}>
                <p>
                  <ChevronDown size={11} /> {cat}
                  {has("MANAGE_CHANNELS") && (
                    <button type="button" aria-label="Create channel" onClick={() => setModal("create-channel")}>
                      <Plus size={14} />
                    </button>
                  )}
                </p>
                {visibleChannels
                  .filter((c) => c.category === cat)
                  .map((c) => {
                    const inVoice = voice?.serverId === server.id && voice.channelId === c.id;
                    const people = [...(c.voiceMembers ?? []), ...(inVoice ? ["you"] : [])];
                    return (
                      <div key={c.id}>
                        <button
                          type="button"
                          className={`sm-channel ${active?.id === c.id ? "is-active" : ""} ${inVoice ? "is-connected" : ""}`}
                          onClick={() => selectChannel(c)}
                        >
                          <ChannelIcon kind={c.kind} locked={c.minView !== "member"} />
                          <span>{c.name}</span>
                          {c.id === "squad-chat" && server.id === "nf" && active?.id !== c.id && <i>4</i>}
                          {c.kind === "voice" && people.length > 0 && <small>{people.length}</small>}
                        </button>
                        {c.kind === "voice" &&
                          people.map((pid) => {
                            const m = pid === "you" ? members[0] : memberById(pid);
                            if (!m) return null;
                            return (
                              <div className="sm-voice-member" key={pid}>
                                <Avatar name={m.name} tone={m.tone} size={22} />
                                <span>{m.name}</span>
                                {pid === "maya" && <MonitorUp size={13} className="sm-live-icon" />}
                                {pid === "echo" && <MicOff size={13} />}
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
              </div>
            ))}
            {hiddenCount > 0 && (
              <p className="sm-hidden-note">
                <Lock size={12} /> {hiddenCount} channel{hiddenCount > 1 ? "s" : ""} hidden by permissions
              </p>
            )}
          </div>

          {connectedChannel && connectedServer && (
            <div className="sm-voice-dock">
              <div>
                <strong>
                  <i /> Voice connected
                </strong>
                <small>
                  {connectedChannel.name} · {connectedServer.name}
                </small>
              </div>
              <button type="button" aria-label="Disconnect" onClick={() => setVoice(null)}>
                <PhoneOff size={16} />
              </button>
            </div>
          )}

          <div className="sm-user-dock">
            <Avatar name="You" tone={0} size={32} status="online" />
            <span>
              <strong>You</strong>
              <small style={{ color: youRole.color }}>{youRole.name}</small>
            </span>
            <div>
              <button type="button" aria-label="Mute" aria-pressed={!mic} className={!mic ? "is-off" : ""} onClick={() => setMic((v) => !v)}>
                {mic ? <Mic size={16} /> : <MicOff size={16} />}
              </button>
              <button type="button" aria-label="Deafen" aria-pressed={deaf} className={deaf ? "is-off" : ""} onClick={() => setDeaf((v) => !v)}>
                <Headphones size={16} />
              </button>
            </div>
          </div>
        </aside>

        {/* ---- main ---- */}
        <section className="sm-main">
          {active ? (
            <>
              <header className="sm-main-head">
                <ChannelIcon kind={active.kind} />
                <h1>{active.name}</h1>
                {active.topic && <span className="sm-topic">{active.topic}</span>}
                <div className="sm-head-actions">
                  <button type="button" aria-label="Pinned messages">
                    <Pin size={18} />
                  </button>
                  <button type="button" aria-label="Notifications">
                    <Bell size={18} />
                  </button>
                  <button type="button" aria-label="Toggle member list" aria-pressed={membersOpen} className={membersOpen ? "is-on" : ""} onClick={() => setMembersOpen((v) => !v)}>
                    <Users size={18} />
                  </button>
                  <label className="sm-search">
                    <Search size={14} />
                    <input placeholder="Search" aria-label="Search" />
                  </label>
                </div>
              </header>

              {active.kind === "voice" ? (
                <VoiceRoom
                  channel={active}
                  members={members}
                  connected={voice?.channelId === active.id && voice.serverId === server.id}
                  onJoin={() => joinVoice(active)}
                  onLeave={() => setVoice(null)}
                  mic={mic}
                  setMic={setMic}
                  screen={screen}
                  setScreen={setScreen}
                />
              ) : (
                <>
                  <div className="sm-messages" ref={scrollRef}>
                    <div className="sm-intro">
                      <span>
                        <ChannelIcon kind={active.kind} />
                      </span>
                      <h2>Welcome to #{active.name}</h2>
                      <p>This is the start of the #{active.name} channel.{active.topic ? ` ${active.topic}.` : ""}</p>
                    </div>
                    {messages.map((m, i) => {
                      if (m.system) {
                        return (
                          <div className="sm-system" key={m.id}>
                            <UserPlus size={14} /> {m.text} <small>{m.time}</small>
                          </div>
                        );
                      }
                      const author = memberById(m.authorId);
                      const prev = messages[i - 1];
                      const compact = prev && !prev.system && prev.authorId === m.authorId;
                      const role = author ? roleById(author.roleId) : undefined;
                      return (
                        <article className={`sm-msg ${compact ? "is-compact" : ""}`} key={m.id}>
                          {compact ? <time>{m.time.split(" ").slice(-2).join(" ")}</time> : author && <Avatar name={author.name} tone={author.tone} size={40} bot={author.bot} />}
                          <div>
                            {!compact && (
                              <h3>
                                <span style={{ color: role?.color }}>{author?.name ?? "Unknown"}</span>
                                {role?.tier === "owner" && <Crown size={13} className="sm-crown" />}
                                {author?.bot && <em>BOT</em>}
                                <time>{m.time}</time>
                              </h3>
                            )}
                            <p>{m.text}</p>
                            {m.reactions && (
                              <div className="sm-reactions">
                                {m.reactions.map((r) => (
                                  <span key={r.emoji} className={r.mine ? "is-mine" : ""}>
                                    {r.emoji} {r.count}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <form
                    className="sm-composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      send();
                    }}
                  >
                    {canSend(active) ? (
                      <>
                        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message #${active.name}`} aria-label="Message" />
                        <Smile size={20} />
                        <button type="submit" aria-label="Send" disabled={!draft.trim()}>
                          <SendHorizontal size={18} />
                        </button>
                      </>
                    ) : (
                      <p>
                        <Lock size={15} /> You do not have permission to send messages in this channel.
                      </p>
                    )}
                  </form>
                </>
              )}
            </>
          ) : (
            <div className="sm-empty">
              <Shield size={40} />
              <h2>No channels you can see</h2>
              <p>This role has no VIEW_CHANNEL permission.</p>
            </div>
          )}
        </section>

        {/* ---- members ---- */}
        {membersOpen && (
          <aside className="sm-members" aria-label="Members">
            {grouped.map((g) => (
              <div key={g.key}>
                <p>
                  {g.label} — {g.list.length}
                </p>
                {g.list.map((m) => {
                  const r = roleById(m.roleId);
                  return (
                    <button
                      type="button"
                      key={m.id}
                      className={`sm-member ${m.status === "offline" ? "is-offline" : ""}`}
                      onClick={(e) => setCard({ id: m.id, y: e.clientY })}
                    >
                      <Avatar name={m.name} tone={m.tone} size={32} status={m.status} />
                      <span style={{ color: m.status === "offline" ? undefined : r.color }}>{m.name}</span>
                      {r.tier === "owner" && <Crown size={13} className="sm-crown" />}
                      {m.bot && <em>BOT</em>}
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>
        )}
      </div>
      </div>

      {/* ---- member card ---- */}
      {card && cardMember && (
        <>
          <div className="sm-overlay" onClick={() => setCard(null)} />
          <div className="sm-card" style={{ top: Math.min(card.y, (typeof window === "undefined" ? 600 : window.innerHeight) - 280) }}>
            <div className="sm-card-banner" style={{ background: TONES[cardMember.tone % TONES.length] }} />
            <Avatar name={cardMember.name} tone={cardMember.tone} size={64} status={cardMember.status} />
            <h3>{cardMember.name}</h3>
            <p>{STATUS_LABEL[cardMember.status]}</p>
            <div className="sm-pills">
              <span style={{ borderColor: roleById(cardMember.roleId).color, color: roleById(cardMember.roleId).color }}>
                <i style={{ background: roleById(cardMember.roleId).color }} />
                {roleById(cardMember.roleId).name}
              </span>
            </div>
            {cardMember.id !== "you" && (
              <div className="sm-card-actions">
                <button type="button">Message</button>
                {(() => {
                  const outranks = TIER_RANK[roleById(cardMember.roleId).tier] < rank;
                  return (
                    <>
                      <button type="button" disabled={!(has("KICK_MEMBERS") && outranks)} title={outranks ? "" : "Role is not below yours"} onClick={() => kick(cardMember, false)}>
                        Kick
                      </button>
                      <button type="button" className="is-danger" disabled={!(has("BAN_MEMBERS") && outranks)} title={outranks ? "" : "Role is not below yours"} onClick={() => kick(cardMember, true)}>
                        Ban
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </>
      )}

      {/* ---- modals ---- */}
      {modal === "invite" && <InviteModal server={server} onClose={() => setModal(null)} notify={notify} />}
      {modal === "create-server" && (
        <CreateServerModal
          onClose={() => setModal(null)}
          onCreate={(name, template) => {
            const created = makeServer(name, template);
            setServers((all) => [...all, created]);
            setServerId(created.id);
            setViewAs("owner");
            setModal(null);
            notify(`Created ${name}. You are the owner.`);
          }}
        />
      )}
      {modal === "create-channel" && (
        <CreateChannelModal
          categories={[...new Set(server.channels.map((c) => c.category))]}
          onClose={() => setModal(null)}
          onCreate={(c) => {
            updateServer((s) => ({ ...s, channels: [...s.channels, c] }));
            setActiveBy((prev) => ({ ...prev, [server.id]: c.id }));
            setModal(null);
          }}
        />
      )}
      {modal === "settings" && (
        <SettingsModal
          server={server}
          canManageRoles={has("MANAGE_ROLES")}
          canManageServer={has("MANAGE_SERVER")}
          isOwner={viewAs === "owner"}
          memberCount={members.length}
          onClose={() => setModal(null)}
          onRename={(name) => updateServer((s) => ({ ...s, name }))}
          onTogglePerm={(roleId, perm) =>
            updateServer((s) => ({
              ...s,
              roles: s.roles.map((r) =>
                r.id !== roleId ? r : { ...r, perms: r.perms.includes(perm) ? r.perms.filter((p) => p !== perm) : [...r.perms, perm] },
              ),
            }))
          }
          onDelete={removeServer}
        />
      )}

      {toast && (
        <div className="sm-toast" role="status">
          <Check size={16} /> {toast}
        </div>
      )}
    </div>
  );
}

function VoiceRoom({
  channel,
  members,
  connected,
  onJoin,
  onLeave,
  mic,
  setMic,
  screen,
  setScreen,
}: {
  channel: Channel;
  members: Member[];
  connected: boolean;
  onJoin: () => void;
  onLeave: () => void;
  mic: boolean;
  setMic: (fn: (v: boolean) => boolean) => void;
  screen: boolean;
  setScreen: (fn: (v: boolean) => boolean) => void;
}) {
  const people = (channel.voiceMembers ?? []).map((id) => members.find((m) => m.id === id)).filter(Boolean) as Member[];
  const all = connected ? [...people, members[0]] : people;
  return (
    <div className="sm-voice-room">
      {all.length === 0 ? (
        <div className="sm-empty">
          <Volume2 size={40} />
          <h2>Nobody is here yet</h2>
          <p>Join to start talking. Anyone with CONNECT can hop in.</p>
        </div>
      ) : (
        <div className="sm-voice-grid">
          {all.map((m) => (
            <div className={`sm-voice-tile ${m.id === "maya" ? "is-speaking" : ""}`} key={m.id}>
              <Avatar name={m.name} tone={m.tone} size={72} />
              <span>{m.name}</span>
              {m.id === "echo" && <MicOff size={14} />}
            </div>
          ))}
        </div>
      )}
      <div className="sm-voice-controls">
        {connected ? (
          <>
            <button type="button" className={!mic ? "is-off" : ""} aria-label="Toggle microphone" onClick={() => setMic((v) => !v)}>
              {mic ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button type="button" className={screen ? "is-on" : ""} aria-label="Share screen" onClick={() => setScreen((v) => !v)}>
              <MonitorUp size={20} />
            </button>
            <button type="button" className="is-end" aria-label="Leave voice" onClick={onLeave}>
              <PhoneOff size={20} />
            </button>
          </>
        ) : (
          <button type="button" className="sm-join" onClick={onJoin}>
            <Volume2 size={18} /> Join voice
          </button>
        )}
      </div>
    </div>
  );
}

function InviteModal({ server, onClose, notify }: { server: ServerData; onClose: () => void; notify: (t: string) => void }) {
  const mk = () => `voxsi.gg/${server.short.toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`;
  const [link, setLink] = useState(mk);
  const [expires, setExpires] = useState("7 days");
  const [uses, setUses] = useState("No limit");
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState([
    { code: `${server.short.toLowerCase()}-9fK2a`, uses: "6 / 10", expires: "in 2 days" },
    { code: `${server.short.toLowerCase()}-x71Qe`, uses: "1 / 1", expires: "in 5 hours" },
  ]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`https://${link}`);
    } catch {
      /* clipboard may be blocked, still show feedback in the mock */
    }
    setCopied(true);
    notify("Invite link copied");
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Modal title={`Invite friends to ${server.name}`} onClose={onClose}>
      <div className="sm-modal-body">
        <label className="sm-label">Send an invite link</label>
        <div className="sm-copy">
          <input readOnly value={link} aria-label="Invite link" />
          <button type="button" className={copied ? "is-done" : ""} onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="sm-row">
          <label>
            <span className="sm-label">Expire after</span>
            <select value={expires} onChange={(e) => setExpires(e.target.value)}>
              {["30 minutes", "1 hour", "1 day", "7 days", "Never"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sm-label">Max uses</span>
            <select value={uses} onChange={(e) => setUses(e.target.value)}>
              {["No limit", "1 use", "5 uses", "10 uses", "25 uses"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" className="sm-btn sm-btn--ghost" onClick={() => {
          setActive((a) => [{ code: link.split("/")[1], uses: `0 / ${uses.split(" ")[0] === "No" ? "∞" : uses.split(" ")[0]}`, expires: expires === "Never" ? "never" : `in ${expires}` }, ...a]);
          setLink(mk());
        }}>
          Save this link and generate a new one
        </button>

        <label className="sm-label">Active invites</label>
        <ul className="sm-invites">
          {active.map((i) => (
            <li key={i.code}>
              <code>{i.code}</code>
              <span>{i.uses}</span>
              <span>{i.expires}</span>
              <button type="button" aria-label={`Revoke ${i.code}`} onClick={() => setActive((a) => a.filter((x) => x.code !== i.code))}>
                <Trash2 size={15} />
              </button>
            </li>
          ))}
          {active.length === 0 && <li className="is-empty">No active invites</li>}
        </ul>
      </div>
    </Modal>
  );
}

function CreateServerModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, template: string) => void }) {
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("gaming");
  const templates = [
    { id: "gaming", label: "Gaming crew", hint: "Looking-for-group, clips, squad voice" },
    { id: "friends", label: "Friends", hint: "One text and one voice channel" },
    { id: "community", label: "Community", hint: "Rules, announcements, introductions" },
  ];
  return (
    <Modal title="Create your server" onClose={onClose}>
      <form
        className="sm-modal-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onCreate(name.trim(), template);
        }}
      >
        <p className="sm-help">Your server is where you and your crew talk, play and share. You can change all of this later.</p>
        <label className="sm-label">Start from a template</label>
        <div className="sm-templates">
          {templates.map((t) => (
            <button type="button" key={t.id} className={template === t.id ? "is-active" : ""} onClick={() => setTemplate(t.id)}>
              <strong>{t.label}</strong>
              <small>{t.hint}</small>
            </button>
          ))}
        </div>
        <label className="sm-label" htmlFor="sm-server-name">
          Server name
        </label>
        <input id="sm-server-name" autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Night owls" />
        <footer>
          <button type="button" className="sm-btn sm-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="sm-btn" disabled={!name.trim()}>
            Create server
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function CreateChannelModal({ categories, onClose, onCreate }: { categories: string[]; onClose: () => void; onCreate: (c: Channel) => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Channel["kind"]>("text");
  const [category, setCategory] = useState(categories[0] ?? "TEXT CHANNELS");
  const [priv, setPriv] = useState(false);
  const clean = kind === "voice" ? name.trim() : name.trim().toLowerCase().replace(/\s+/g, "-");
  return (
    <Modal title="Create channel" onClose={onClose}>
      <form
        className="sm-modal-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (!clean) return;
          onCreate({
            id: `c${Date.now()}`,
            name: clean,
            kind,
            category: kind === "voice" && category === "TEXT CHANNELS" ? "VOICE CHANNELS" : category,
            minView: priv ? "mod" : "member",
            minSend: priv ? "mod" : "member",
            voiceMembers: kind === "voice" ? [] : undefined,
          });
        }}
      >
        <label className="sm-label">Channel type</label>
        <div className="sm-templates sm-templates--two">
          <button type="button" className={kind === "text" ? "is-active" : ""} onClick={() => setKind("text")}>
            <strong># Text</strong>
            <small>Messages, GIFs and links</small>
          </button>
          <button type="button" className={kind === "voice" ? "is-active" : ""} onClick={() => setKind("voice")}>
            <strong>🔊 Voice</strong>
            <small>Talk, video and screen share</small>
          </button>
        </div>
        <label className="sm-label" htmlFor="sm-channel-name">
          Channel name
        </label>
        <input id="sm-channel-name" autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={kind === "text" ? "new-channel" : "New voice room"} />
        <label className="sm-label" htmlFor="sm-channel-cat">
          Category
        </label>
        <select id="sm-channel-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <div className="sm-switch-row">
          <span>
            <strong>
              <Lock size={14} /> Private channel
            </strong>
            <small>Only Moderators and above can see it</small>
          </span>
          <Toggle on={priv} onChange={() => setPriv((v) => !v)} />
        </div>
        <footer>
          <button type="button" className="sm-btn sm-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="sm-btn" disabled={!clean}>
            Create channel
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function SettingsModal({
  server,
  canManageRoles,
  canManageServer,
  isOwner,
  memberCount,
  onClose,
  onRename,
  onTogglePerm,
  onDelete,
}: {
  server: ServerData;
  canManageRoles: boolean;
  canManageServer: boolean;
  isOwner: boolean;
  memberCount: number;
  onClose: () => void;
  onRename: (name: string) => void;
  onTogglePerm: (roleId: string, perm: Perm) => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "roles">("overview");
  const [name, setName] = useState(server.name);
  const [roleId, setRoleId] = useState(server.roles[1]?.id ?? server.roles[0].id);
  const role = server.roles.find((r) => r.id === roleId) ?? server.roles[0];
  const locked = role.tier === "owner";

  return (
    <Modal title={`${server.name} settings`} onClose={onClose} wide>
      <div className="sm-settings">
        <nav>
          <button type="button" className={tab === "overview" ? "is-active" : ""} onClick={() => setTab("overview")}>
            Overview
          </button>
          <button type="button" className={tab === "roles" ? "is-active" : ""} onClick={() => setTab("roles")}>
            Roles
          </button>
        </nav>
        <div className="sm-settings-body">
          {tab === "overview" ? (
            <>
              <label className="sm-label" htmlFor="sm-rename">
                Server name
              </label>
              <div className="sm-copy">
                <input id="sm-rename" value={name} maxLength={40} disabled={!canManageServer} onChange={(e) => setName(e.target.value)} />
                <button type="button" disabled={!canManageServer || !name.trim() || name === server.name} onClick={() => onRename(name.trim())}>
                  Save
                </button>
              </div>
              <dl className="sm-facts">
                <div>
                  <dt>Members</dt>
                  <dd>{memberCount}</dd>
                </div>
                <div>
                  <dt>Channels</dt>
                  <dd>{server.channels.length}</dd>
                </div>
                <div>
                  <dt>Roles</dt>
                  <dd>{server.roles.length}</dd>
                </div>
              </dl>
              <div className="sm-danger">
                <div>
                  <strong>Delete server</strong>
                  <small>Removes every channel and message. This cannot be undone.</small>
                </div>
                <button type="button" className="sm-btn sm-btn--danger" disabled={!isOwner} onClick={onDelete}>
                  Delete
                </button>
              </div>
            </>
          ) : (
            <div className="sm-roles">
              <ul>
                {server.roles.map((r) => (
                  <li key={r.id}>
                    <button type="button" className={r.id === roleId ? "is-active" : ""} onClick={() => setRoleId(r.id)}>
                      <i style={{ background: r.color }} /> {r.name}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="sm-perms">
                {!canManageRoles && <p className="sm-warn">You need MANAGE_ROLES to edit permissions.</p>}
                {locked && <p className="sm-warn">The owner role always has every permission.</p>}
                {PERMISSIONS.map((g) => (
                  <section key={g.group}>
                    <h4>{g.group}</h4>
                    {g.items.map((p) => (
                      <div className="sm-perm" key={p.key}>
                        <span>
                          <strong>{p.label}</strong>
                          <small>{p.hint}</small>
                        </span>
                        <Toggle on={locked || role.perms.includes(p.key)} disabled={!canManageRoles || locked} onChange={() => onTogglePerm(role.id, p.key)} />
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
