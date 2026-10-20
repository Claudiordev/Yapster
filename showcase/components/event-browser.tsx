"use client";

import {
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  Clock3,
  Crosshair,
  Gamepad2,
  Heart,
  Rocket,
  Search,
  Shield,
  Swords,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  EVENTS,
  GAMES,
  money,
  type GameId,
  type PrizeEvent,
} from "./events-data";

export function GameIcon({ game, size = 24 }: { game: GameId; size?: number }) {
  if (game === "league")
    return (
      <Image
        src="/images/league-of-legends-gold-blue.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        style={{ objectFit: "contain", flexShrink: 0 }}
      />
    );
  const Icon = {
    cs2: Crosshair,
    valorant: Swords,
    minecraft: Box,
    rocket: Rocket,
    rust: Shield,
    among: Gamepad2,
  }[game];
  return <Icon size={size} aria-hidden="true" />;
}

type Mode =
  | "games"
  | "list"
  | "detail"
  | "join"
  | "donate"
  | "joined"
  | "donated";
export type BrowseTarget = { game?: GameId; event?: PrizeEvent };

export function EventBrowser({
  target,
  onClose,
  joined,
  onJoin,
  donations,
  onDonate,
}: {
  target: BrowseTarget;
  onClose: () => void;
  joined: string[];
  onJoin: (id: string) => void;
  donations: Record<string, number>;
  onDonate: (id: string, amount: number) => void;
}) {
  const [mode, setMode] = useState<Mode>(
    target.event ? "detail" : target.game ? "list" : "games",
  );
  const [game, setGame] = useState<GameId>(
    target.event?.game || target.game || "cs2",
  );
  const [event, setEvent] = useState<PrizeEvent>(target.event || EVENTS[0]);
  const [filter, setFilter] = useState<"all" | "live" | "upcoming">("all");
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("10");
  const [lastDonation, setLastDonation] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const selectedGame = GAMES.find((item) => item.id === game)!;
  const isJoined = joined.includes(event.id);
  const currentPrize = event.prize + (donations[event.id] || 0);
  const titles: Record<Mode, string> = {
    games: "Find your game.",
    list: selectedGame.name,
    detail: event.name,
    join: "Save your spot.",
    donate: "Give the prize a boost.",
    joined: "You’re on the list!",
    donated: "A little boost. A big thanks.",
  };

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input:not([disabled]),[tabindex="0"]',
        ) || [],
      ).filter((el) => el.getClientRects().length > 0);
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === title.current)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === title.current)
      ) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    title.current?.focus();
    dialog.current?.scrollTo(0, 0);
  }, [mode, game]);

  function back() {
    if (mode === "list") {
      setMode("games");
      setQuery("");
    } else if (mode === "detail") setMode("list");
    else setMode("detail");
  }
  function chooseGame(id: GameId) {
    setGame(id);
    setFilter("all");
    setQuery("");
    setMode("list");
  }
  const visibleEvents = EVENTS.filter(
    (item) =>
      item.game === game &&
      (filter === "all" || (filter === "live" ? item.live : !item.live)) &&
      item.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div
      className="event-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="event-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-dialog-title"
        ref={dialog}
      >
        <div className="modal-top">
          <span className="eyebrow">
            <Trophy size={15} /> VOXSI EVENTS
          </span>
          <span className="demo-label">Interactive demo</span>
          <button
            className="icon-button"
            aria-label="Close events"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-content">
          {mode !== "games" && (
            <button className="back-button" onClick={back}>
              <ArrowLeft size={15} />{" "}
              {mode === "list"
                ? "All games"
                : mode === "detail"
                  ? `${selectedGame.name} events`
                  : "Event details"}
            </button>
          )}
          <h2 ref={title} tabIndex={-1} id="event-dialog-title">
            {titles[mode]}
          </h2>
          {mode === "games" && (
            <>
              <p className="modal-description">
                Pick a game. Find your people. Play for{" "}
                <span className="gold">cash prizes.</span>
              </p>
              <div className="modal-games">
                {GAMES.map((item) => (
                  <button
                    className={`modal-game tone-${item.tone}`}
                    key={item.id}
                    onClick={() => chooseGame(item.id)}
                  >
                    <span className="game-symbol">
                      <GameIcon game={item.id} size={30} />
                    </span>
                    <strong>{item.name}</strong>
                    <small>
                      {EVENTS.filter((e) => e.game === item.id).length} events{" "}
                      <ArrowRight size={13} />
                    </small>
                  </button>
                ))}
              </div>
            </>
          )}
          {mode === "list" && (
            <>
              <p className="modal-description">
                Your next good game starts here. All demo events are free to
                enter.
              </p>
              <div className="event-filters">
                <div className="segmented" aria-label="Filter events">
                  {(["all", "live", "upcoming"] as const).map((value) => (
                    <button
                      key={value}
                      aria-pressed={filter === value}
                      className={filter === value ? "active" : ""}
                      onClick={() => setFilter(value)}
                    >
                      {value === "all"
                        ? "All events"
                        : value === "live"
                          ? "Live now"
                          : "Upcoming"}
                    </button>
                  ))}
                </div>
                <label className="event-search">
                  <Search size={16} />
                  <input
                    aria-label="Search events"
                    placeholder="Find an event"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="event-list">
                {visibleEvents.length ? (
                  visibleEvents.map((item) => (
                    <button
                      className="event-list-item"
                      key={item.id}
                      onClick={() => {
                        setEvent(item);
                        setMode("detail");
                      }}
                    >
                      <span
                        className={`list-game-icon tone-${selectedGame.tone}`}
                      >
                        <GameIcon game={game} />
                      </span>
                      <span className="event-list-copy">
                        <span
                          className={`event-time ${item.live ? "is-live" : ""}`}
                        >
                          {item.live ? (
                            <span className="live-dot" />
                          ) : (
                            <Clock3 size={12} />
                          )}
                          {item.time}
                        </span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.format} ·{" "}
                          {item.players + (joined.includes(item.id) ? 1 : 0)}/
                          {item.capacity} players
                          {joined.includes(item.id) ? " · Joined ✓" : ""}
                        </small>
                      </span>
                      <span className="list-prize">
                        <small>PRIZE POOL</small>
                        <strong>
                          {money(item.prize + (donations[item.id] || 0))}
                        </strong>
                      </span>
                      <ArrowRight size={17} />
                    </button>
                  ))
                ) : (
                  <div className="empty-events">
                    <Search size={28} />
                    <h3>No events found</h3>
                    <p>Try another search or view all events.</p>
                    <button
                      className="button secondary"
                      onClick={() => {
                        setFilter("all");
                        setQuery("");
                      }}
                    >
                      Reset filters
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
          {mode === "detail" && (
            <>
              <div className={`detail-game tone-${selectedGame.tone}`}>
                <GameIcon game={game} size={44} />
                <span>
                  <small>{selectedGame.name}</small>
                  <strong>{event.format}</strong>
                </span>
                <span className={`status-pill ${event.live ? "live" : ""}`}>
                  <span />
                  {event.live ? "Live now" : "Registration open"}
                </span>
              </div>
              <p className="detail-description">{event.description}</p>
              <div className="detail-stats">
                <div>
                  <Trophy size={18} />
                  <small>PRIZE POOL</small>
                  <strong className="gold">{money(currentPrize)}</strong>
                </div>
                <div>
                  <Users size={18} />
                  <small>PLAYERS</small>
                  <strong>
                    {event.players + (isJoined ? 1 : 0)}
                    <em> / {event.capacity}</em>
                  </strong>
                </div>
                <div>
                  <Clock3 size={18} />
                  <small>STARTS</small>
                  <strong className="time-value">{event.time}</strong>
                </div>
              </div>
              <div className="event-rules">
                <h3>Good games start with good people.</h3>
                <ul>
                  <li>
                    Free entry. Bring a squad or meet players in the lobby.
                  </li>
                  <li>
                    Check in 15 minutes before your match and follow the host’s
                    rules.
                  </li>
                  <li>
                    Play fair, respect your opponents, and have a good time.
                  </li>
                </ul>
              </div>
              <div className="detail-actions">
                <button
                  className={`button primary ${isJoined ? "is-joined" : ""}`}
                  disabled={isJoined}
                  onClick={() => setMode("join")}
                >
                  {isJoined ? (
                    <>
                      <Check size={18} /> You’ve joined
                    </>
                  ) : (
                    <>
                      Join event <ArrowRight size={17} />
                    </>
                  )}
                </button>
                <button
                  className="button secondary"
                  onClick={() => setMode("donate")}
                >
                  <Heart size={17} /> Donate to prize pool
                </button>
              </div>
            </>
          )}
          {mode === "join" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) {
                  onJoin(event.id);
                  setMode("joined");
                }
              }}
            >
              <p className="modal-description">
                You’re joining <strong>{event.name}</strong>. Pick the name your
                teammates will see.
              </p>
              <label className="field-label" htmlFor="player-name">
                Display name
              </label>
              <input
                className="text-input"
                id="player-name"
                autoComplete="nickname"
                required
                minLength={2}
                maxLength={24}
                placeholder="Your in-game name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="order-row">
                <span>Event entry</span>
                <strong className="mint">Free</strong>
              </div>
              <button
                className="button primary wide"
                type="submit"
                disabled={name.trim().length < 2}
              >
                Confirm spot <ArrowRight size={17} />
              </button>
            </form>
          )}
          {mode === "donate" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number(amount);
                if (Number.isFinite(n) && n >= 1 && n <= 1000) {
                  onDonate(event.id, n);
                  setLastDonation(n);
                  setMode("donated");
                }
              }}
            >
              <p className="modal-description">
                Support <strong>{event.name}</strong> by adding to its prize
                pool. Every little bit makes game night better.
              </p>
              <div className="donation-options">
                {[5, 10, 25, 50].map((n) => (
                  <button
                    type="button"
                    key={n}
                    aria-pressed={Number(amount) === n}
                    className={Number(amount) === n ? "selected" : ""}
                    onClick={() => setAmount(String(n))}
                  >
                    {money(n)}
                  </button>
                ))}
              </div>
              <label className="field-label" htmlFor="donation-amount">
                Or choose an amount (USD)
              </label>
              <input
                id="donation-amount"
                className="text-input"
                type="number"
                min="1"
                max="1000"
                step="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="order-row">
                <span>Prize pool after your donation</span>
                <strong className="gold">
                  {money(currentPrize + (Number(amount) || 0))}
                </strong>
              </div>
              <p className="demo-payment-note">
                This is a demo. No payment details are collected and no money is
                charged.
              </p>
              <button
                className="button primary wide"
                type="submit"
                disabled={
                  !amount || Number(amount) < 1 || Number(amount) > 1000
                }
              >
                <Heart size={17} /> Confirm demo donation
              </button>
            </form>
          )}
          {(mode === "joined" || mode === "donated") && (
            <div className="success-state">
              <span className="success-icon">
                {mode === "joined" ? <Check size={36} /> : <Heart size={36} />}
              </span>
              <p role="status">
                {mode === "joined" ? (
                  <>
                    <strong>{name.trim()}</strong>, your demo spot in{" "}
                    <strong>{event.name}</strong> is saved.
                  </>
                ) : (
                  <>
                    You added{" "}
                    <strong className="gold">{money(lastDonation)}</strong> to
                    the demo prize pool for <strong>{event.name}</strong>.
                  </>
                )}
              </p>
              <button
                className="button primary"
                onClick={() => setMode("detail")}
              >
                Back to event <ArrowRight size={17} />
              </button>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <Shield size={14} />
          <span>
            Demo events. Prizes, players, joins, and donations are illustrative.
          </span>
        </div>
      </div>
    </div>
  );
}
