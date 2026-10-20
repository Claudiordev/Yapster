"use client";

import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Gamepad2,
  Globe2,
  Menu,
  Mic,
  MonitorUp,
  PhoneOff,
  Server,
  Settings,
  Trophy,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  SHOWCASE_COPY,
  SHOWCASE_LANGUAGES,
  isShowcaseLanguage,
  type ShowcaseCopy,
  type ShowcaseLanguage,
} from "./showcase-copy";
import { SocialLogos } from "./social-logos";
import { EVENTS, money } from "./events-data";
import "@/styles/showcase-updates.css";

const CopyContext = createContext<ShowcaseCopy>(SHOWCASE_COPY.en);
const useCopy = () => useContext(CopyContext);

const COMMUNITY_EVENT = EVENTS.find((event) => event.id === "league-arena")!;

const PLAY_PHRASES = [
  { label: "playForPrizes", Icon: Trophy },
  { label: "shareTheMoment", Icon: MonitorUp },
  { label: "stayInVoice", Icon: Mic },
  { label: "hostGameNights", Icon: Server },
  { label: "buildYourCommunity", Icon: Gamepad2 },
] as const;

function Brand() {
  const t = useCopy();
  return (
    <a className="brand" href="#top" aria-label={t.home}>
      <Image
        priority
        alt=""
        height={44}
        className="voxsi-logo"
        src="/voxsi-logo-flat-letter.png"
        width={44}
      />
      <span>Voxsi</span>
    </a>
  );
}

function Avatar({
  tone,
  children,
}: {
  tone: string;
  children: React.ReactNode;
}) {
  return <span className={`avatar avatar--${tone}`}>{children}</span>;
}

function CounterStrike2Icon() {
  return (
    <Image
      aria-hidden="true"
      alt=""
      className="cs2-icon"
      height={40}
      src="/images/counter-strike-2-icon.png"
      width={40}
    />
  );
}

function ProductPreview({
  controls,
  onToggleControl,
}: {
  controls: Record<string, boolean>;
  onToggleControl: (control: string) => void;
}) {
  const t = useCopy();
  return (
    <div className="app-window" data-depth="0.35">
      <div className="window-bar">
        <div className="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="window-address">
          <span /> web.guildvo.com
        </div>
        <span className="window-live">
          <i /> {t.live}
        </span>
      </div>

      <div className="app-layout">
        <aside className="server-rail" aria-label={t.communityList}>
          <div className="mini-brand">
            <Image
              alt=""
              height={32}
              className="voxsi-logo"
              src="/voxsi-logo-flat-letter.png"
              width={32}
            />
          </div>
          <span className="rail-rule" />
          <button className="server-badge server-badge--active" type="button">
            NF
          </button>
          <button className="server-badge server-badge--sun" type="button">
            AR
          </button>
          <button className="server-badge server-badge--blue" type="button">
            +
          </button>
        </aside>

        <aside className="channel-panel">
          <div className="community-title">
            <span>Nightfall</span>
            <ChevronDown aria-hidden="true" />
          </div>
          <div className="channel-group">
            <p>{t.playground}</p>
            <span className="channel">
              <b>#</b> lobby
            </span>
            <span className="channel channel--active">
              <b>#</b> squad-chat <i>4</i>
            </span>
            <span className="channel">
              <b>#</b> clips-and-wins
            </span>
          </div>
          <div className="channel-group">
            <p>{t.voiceChannels}</p>
            <span className="channel">
              <b>⌁</b> {t.warmup}
            </span>
            <span className="channel channel--voice">
              <b>⌁</b> {t.ranked}
            </span>
            <div className="voice-member">
              <Avatar tone="one">M</Avatar> Maya <i />
            </div>
            <div className="voice-member">
              <Avatar tone="two">J</Avatar> Juno <i />
            </div>
            <div className="voice-member">
              <Avatar tone="three">K</Avatar> Kai <i />
            </div>
          </div>
          <div className="user-dock">
            <Avatar tone="four">Y</Avatar>
            <span>
              <strong>{t.you}</strong>
              <small>{t.voiceConnected}</small>
            </span>
            <div className="dock-icons">
              <b>⌁</b>
              <Settings aria-hidden="true" size={9} />
            </div>
          </div>
        </aside>

        <section className="call-panel" aria-label={t.callPreview}>
          <div className="call-header">
            <div>
              <span className="call-icon">⌁</span>
              <span>
                <strong>{t.ranked}</strong>
                <small>Nightfall · {t.fourConnected}</small>
              </span>
            </div>
            <Chip className="hd-pill" size="sm" variant="flat">
              1080p · 60 FPS
            </Chip>
          </div>

          <div className="video-grid">
            <div className="video-tile video-tile--main">
              <div className="screen-art">
                <div className="screen-sky" />
                <div className="screen-mountain screen-mountain--back" />
                <div className="screen-mountain screen-mountain--front" />
                <div className="screen-hud">
                  <span>{t.round} 08</span>
                  <strong>04 : 12</strong>
                  <span>{t.alive} 3</span>
                </div>
                <div className="crosshair">+</div>
              </div>
              <span className="tile-label">
                <i /> {t.mayaSharing}
              </span>
            </div>
            <div className="video-tile person-tile person-tile--one">
              <div className="person-avatar">J</div>
              <span className="tile-name">
                Juno <i className="voice-ring" />
              </span>
            </div>
            <div className="video-tile person-tile person-tile--two">
              <div className="person-avatar">K</div>
              <span className="tile-name">Kai</span>
            </div>
          </div>

          <div className="call-controls" aria-label={t.callControls}>
            <button
              className={controls.mic ? "is-off" : ""}
              type="button"
              aria-label={t.muteMicrophone}
              aria-pressed={controls.mic}
              onClick={() => onToggleControl("mic")}
            >
              <Mic aria-hidden="true" />
            </button>
            <button
              className={controls.camera ? "is-off" : ""}
              type="button"
              aria-label={t.toggleCamera}
              aria-pressed={controls.camera}
              onClick={() => onToggleControl("camera")}
            >
              <Video aria-hidden="true" />
            </button>
            <button
              className={controls.screen ? "control--active" : ""}
              type="button"
              aria-label={t.shareScreen}
              aria-pressed={controls.screen}
              onClick={() => onToggleControl("screen")}
            >
              <MonitorUp aria-hidden="true" />
            </button>
            <button
              className="control--end"
              type="button"
              aria-label={t.leaveCall}
            >
              <PhoneOff aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function EventCard() {
  const t = useCopy();
  return (
    <article className="float-card event-pop" data-depth="1.15">
      <div className="float-topline">
        <span className="float-icon float-icon--gold">
          <CounterStrike2Icon />
        </span>
        <span>
          <small>{t.communityEvent}</small>
          <strong>Counter-Strike 2 Clash</strong>
        </span>
        <Chip className="live-badge" size="sm" variant="flat">
          <i /> {t.open}
        </Chip>
      </div>
      <div className="event-row">
        <span>
          <small>{t.prizePool}</small>
          <strong>{money(EVENTS[0].prize)}</strong>
        </span>
        <span>
          <small>{t.spots}</small>
          <strong>385 / 500</strong>
        </span>
        <span className="event-preview-action">{t.joinEvent}</span>
      </div>
    </article>
  );
}

function FloatingCards() {
  const t = useCopy();
  const [serverJoined, setServerJoined] = useState(false);
  return (
    <>
      <EventCard />

      <article className="float-card server-pop" data-depth="0.9">
        <div className="server-art" aria-hidden="true">
          <span className="block block--one" />
          <span className="block block--two" />
          <span className="block block--three" />
        </div>
        <div className="server-copy">
          <small>{t.yourServer}</small>
          <strong>Survival World</strong>
          <span>
            <i /> {serverJoined ? t.joinedFriends : t.onlineFriends}
          </span>
        </div>
        <button
          type="button"
          className={serverJoined ? "is-joined" : ""}
          aria-label={serverJoined ? t.joinedServer : t.joinServer}
          aria-pressed={serverJoined}
          title={serverJoined ? t.joinedServer : t.joinServer}
          onClick={() => setServerJoined(true)}
        >
          {serverJoined ? (
            <Check aria-hidden="true" />
          ) : (
            <ChevronRight aria-hidden="true" />
          )}
        </button>
      </article>

      <article className="float-card file-pop" data-depth="1.35">
        <span className="file-type">ZIP</span>
        <span>
          <small>{t.newFile}</small>
          <strong>game-night-clips.zip</strong>
          <em>742 MB · {t.readyDownload}</em>
        </span>
        <b>1 GB</b>
      </article>
    </>
  );
}

function VideoFeature() {
  const t = useCopy();
  return (
    <article className="feature-card feature-card--video reveal">
      <div className="feature-copy">
        <span className="feature-icon">
          <Video aria-hidden="true" />
        </span>
        <h3>{t.freeVideo}</h3>
        <p>{t.videoDescription}</p>
      </div>
      <div className="video-visual" aria-hidden="true">
        <div className="video-visual-screen">
          <div className="screen-sky" />
          <div className="screen-mountain screen-mountain--back" />
          <div className="screen-mountain screen-mountain--front" />
          <span className="visual-live">
            <i /> {t.live.toLocaleUpperCase()} · 1080P
          </span>
          <div className="visual-player">
            <Avatar tone="one">M</Avatar>
            <b>{t.mayaScreen}</b>
            <small>60 FPS</small>
          </div>
        </div>
        <div className="visual-audience">
          <Avatar tone="two">J</Avatar>
          <Avatar tone="three">K</Avatar>
          <Avatar tone="four">Y</Avatar>
          <b>{t.watching}</b>
        </div>
      </div>
    </article>
  );
}

function EventsFeature() {
  const t = useCopy();
  const event = COMMUNITY_EVENT;
  return (
    <article className="feature-card feature-card--events reveal" id="events">
      <div className="feature-copy">
        <span className="feature-icon feature-icon--gold">
          <Gamepad2 aria-hidden="true" />
        </span>
        <h3>{t.prizeEvents}</h3>
        <p>
          {t.prizeDescription}{" "}
          <span className="prize-gold">{t.cashPrizes}.</span>
        </p>
      </div>
      <div className="bracket-visual">
        <div className="prize-head">
          <div className="prize-name">
            <span className="league-game-mark">
              <Image
                src="/images/league-of-legends-gold-blue.png"
                alt=""
                width={40}
                height={40}
                style={{ objectFit: "contain" }}
              />
            </span>
            <span>
              <small>{t.communityEvent}</small>
              <b>{event.name}</b>
            </span>
          </div>
          <div className="prize-amount">
            <span>{t.prizePool}</span>
            <strong>{money(event.prize)}</strong>
          </div>
        </div>
        <div className="event-spots">
          <span>{t.spotsFilled}</span>
          <strong>
            {event.players} / {event.capacity}
          </strong>
          <div>
            <i />
          </div>
        </div>
        <div className="match-foot">
          <span>LEAGUE OF LEGENDS · {t.friday} 20:00</span>
          <b>{t.registrationOpen}</b>
        </div>
      </div>
    </article>
  );
}

function ServersFeature() {
  const t = useCopy();
  return (
    <article className="feature-card feature-card--servers reveal">
      <div className="feature-copy">
        <span className="feature-icon feature-icon--green">
          <Server aria-hidden="true" />
        </span>
        <h3>{t.createServer}</h3>
        <p>{t.serverDescription}</p>
      </div>
      <div className="game-server-gallery">
        <div className="server-gallery-head">
          <span className="server-window-dots">
            <i />
            <i />
            <i />
          </span>
          <span className="server-gallery-title">
            <small>{t.gameServers}</small>
            <strong>{t.createServer}</strong>
          </span>
          <span className="server-ready">
            <i /> {t.serverReady}
          </span>
        </div>
        <div className="server-create-bar">
          <span className="server-setting">
            <small>{t.game}</small>
            <strong>{t.chooseGame}</strong>
          </span>
          <span className="server-setting">
            <small>{t.access}</small>
            <strong>{t.friendsOnly}</strong>
          </span>
          <span className="server-launch">
            {t.launchServer} <ChevronRight aria-hidden="true" />
          </span>
        </div>
        <figure className="game-server-shot">
          <div>
            <Image
              fill
              alt={t.minecraftAlt}
              sizes="(max-width: 680px) 42vw, 280px"
              src="/images/minecraft-server-first-person.png"
            />
          </div>
          <figcaption>
            <span>
              <i /> {t.minecraftServer}
            </span>
            <small>12 {t.playersOnline}</small>
          </figcaption>
        </figure>
        <figure className="game-server-shot">
          <div>
            <Image
              fill
              alt={t.counterStrikeAlt}
              sizes="(max-width: 680px) 42vw, 280px"
              src="/images/counter-strike-2-server-first-person.png"
            />
          </div>
          <figcaption>
            <span>
              <i /> Counter-Strike 2
            </span>
            <small>10 {t.playersOnline}</small>
          </figcaption>
        </figure>
      </div>
    </article>
  );
}

export function ShowcasePage() {
  const [language, setLanguage] = useState<ShowcaseLanguage>("en");
  const [languageLoaded, setLanguageLoaded] = useState(false);
  const t = SHOWCASE_COPY[language];

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("voxsi.language");
      if (isShowcaseLanguage(saved)) setLanguage(saved);
    } catch {
      /* Language switching also works when storage is unavailable. */
    }
    setLanguageLoaded(true);
  }, []);

  useEffect(() => {
    if (!languageLoaded) return;
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem("voxsi.language", language);
    } catch {
      /* Optional persistence. */
    }
  }, [language, languageLoaded]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadDialog = useRef<HTMLDialogElement>(null);
  const [controls, setControls] = useState({
    mic: false,
    camera: false,
    screen: true,
  });
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!downloadOpen) return;
    const previousOverflow = document.body.style.overflow;
    downloadDialog.current?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [downloadOpen]);

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 18);

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });

    const items = document.querySelectorAll<HTMLElement>(".reveal");
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-visible"));
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.1, rootMargin: "0px 0px -40px" },
      );

      items.forEach((item, index) => {
        item.style.transitionDelay = `${Math.min(index % 3, 2) * 80}ms`;
        observer.observe(item);
      });

      return () => {
        window.removeEventListener("scroll", updateHeader);
        observer.disconnect();
      };
    }

    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  function updateParallax(clientX: number, clientY: number) {
    const stage = stageRef.current;
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;

    const bounds = stage.getBoundingClientRect();
    const x = (clientX - bounds.left) / bounds.width - 0.5;
    const y = (clientY - bounds.top) / bounds.height - 0.5;

    stage.querySelectorAll<HTMLElement>("[data-depth]").forEach((element) => {
      const depth = Number(element.dataset.depth ?? 1);

      element.style.setProperty("--shift-x", `${x * 12 * depth}px`);
      element.style.setProperty("--shift-y", `${y * 12 * depth}px`);
    });
  }

  function resetParallax() {
    stageRef.current
      ?.querySelectorAll<HTMLElement>("[data-depth]")
      .forEach((element) => {
        element.style.setProperty("--shift-x", "0px");
        element.style.setProperty("--shift-y", "0px");
      });
  }

  function toggleControl(control: string) {
    setControls((current) => ({
      ...current,
      [control]: !current[control as keyof typeof current],
    }));
  }

  return (
    <CopyContext.Provider value={t}>
      <a className="skip-link" href="#main">
        {t.skip}
      </a>

      <div className="page-atmosphere" aria-hidden="true">
        <div className="nebula nebula--one" />
        <div className="nebula nebula--two" />
        <div className="stars stars--one" />
        <div className="stars stars--two" />
      </div>

      <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
        <nav className="nav shell" aria-label={t.mainNavigation}>
          <Brand />
          <button
            className="nav-toggle"
            type="button"
            aria-controls="nav-menu"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? t.closeNavigation : t.openNavigation}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
          <div
            className={`nav-menu ${menuOpen ? "is-open" : ""}`}
            id="nav-menu"
          >
            <a href="#features" onClick={() => setMenuOpen(false)}>
              {t.features}
            </a>
            <a href="#events" onClick={() => setMenuOpen(false)}>
              {t.events}
            </a>
          </div>
          <div className="nav-actions">
            <Button
              as="a"
              className="button button--small button--primary"
              href="https://web.guildvo.com"
              radius="lg"
            >
              {t.openBrowser} <ChevronRight aria-hidden="true" />
            </Button>
            <Button
              className="button button--small button--blue"
              onPress={() => setDownloadOpen(true)}
              radius="lg"
            >
              {t.download} <Download aria-hidden="true" />
            </Button>
          </div>
        </nav>
      </header>

      <main id="main">
        <section className="hero shell" id="top">
          <div className="hero-copy reveal">
            <span className="closed-beta-badge">
              <i aria-hidden="true" />
              {t.closedBeta}
            </span>
            <h1>
              {t.readyStart} <span>{t.readyEnd}</span>
            </h1>
            <p className="hero-lede">{t.heroDescription}</p>
            <div className="hero-actions">
              <Button
                as="a"
                className="button button--primary"
                href="https://web.guildvo.com"
                radius="lg"
              >
                {t.openBrowser} <ChevronRight aria-hidden="true" />
              </Button>
              <Button
                className="button button--blue"
                onPress={() => setDownloadOpen(true)}
                radius="lg"
              >
                {t.download} <Download aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div
            ref={stageRef}
            className="showcase-wrap reveal"
            onPointerMove={(event) =>
              updateParallax(event.clientX, event.clientY)
            }
            onPointerLeave={resetParallax}
          >
            <div className="showcase-glow" aria-hidden="true" />
            <div className="orbit orbit--one" aria-hidden="true" />
            <div className="orbit orbit--two" aria-hidden="true" />
            <ProductPreview
              controls={controls}
              onToggleControl={toggleControl}
            />
            <FloatingCards />
          </div>
        </section>

        <section
          className="signal-strip"
          aria-label={t.moreWaysLabel}
          tabIndex={0}
        >
          <div className="signal-track">
            {[0, 1].map((copy) => (
              <div
                className="signal-group"
                key={copy}
                aria-hidden={copy === 1 ? true : undefined}
              >
                {PLAY_PHRASES.map(({ label, Icon }) => (
                  <span
                    className={`signal-phrase ${label === "playForPrizes" ? "signal-phrase--prizes" : ""}`}
                    key={label}
                  >
                    <Icon aria-hidden="true" />
                    <span>{t[label]}</span>
                    <i aria-hidden="true">✦</i>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="features shell" id="features">
          <div className="section-heading reveal">
            <span className="kicker">{t.hub}</span>
            <h2>{t.moreWays}</h2>
          </div>
          <div className="bento-grid">
            <EventsFeature />
            <VideoFeature />
            <ServersFeature />
          </div>
        </section>

        <section className="closing shell reveal" id="download">
          <Image
            alt=""
            height={76}
            className="voxsi-logo"
            src="/voxsi-logo-flat-letter.png"
            width={76}
          />
          <span className="kicker">{t.builtForPlayers}</span>
          <h2>{t.ready}</h2>
          <p>
            {t.closingStart} <span className="prize-gold">{t.cashPrizes}</span>
            {t.closingEnd}
          </p>
          <div className="hero-actions">
            <Button
              as="a"
              className="button button--primary"
              href="https://web.guildvo.com"
              radius="lg"
            >
              {t.openBrowser} <ChevronRight aria-hidden="true" />
            </Button>
            <Button
              className="button button--blue"
              onPress={() => setDownloadOpen(true)}
              radius="lg"
            >
              {t.download} <Download aria-hidden="true" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-grid shell">
          <div className="footer-brand">
            <Brand />
            <p>{t.tagline}</p>
            <SocialLogos label={t.socialNetworks} />
          </div>
          <div>
            <strong>{t.product}</strong>
            <a href="#features">{t.features}</a>
            <a href="#events">{t.events}</a>
          </div>
        </div>
        <div className="footer-bottom shell">
          <span>© 2026 Voxsi</span>
          <span>{t.fromPlayers}</span>
          <label className="footer-language" htmlFor="site-language">
            <Globe2 aria-hidden="true" />
            <span className="visually-hidden">{t.language}</span>
            <select
              id="site-language"
              value={language}
              onChange={(event) => {
                if (isShowcaseLanguage(event.target.value))
                  setLanguage(event.target.value);
              }}
            >
              {SHOWCASE_LANGUAGES.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  lang={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" />
          </label>
        </div>
      </footer>
      <dialog
        ref={downloadDialog}
        className="download-dialog"
        aria-labelledby="download-title"
        aria-describedby="download-description"
        onClose={() => setDownloadOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget)
            downloadDialog.current?.close();
        }}
      >
        <button
          type="button"
          className="download-dialog-close"
          aria-label={t.closeDownload}
          autoFocus
          onClick={() => downloadDialog.current?.close()}
        >
          <X aria-hidden="true" />
        </button>
        <span className="download-dialog-icon">
          <Download aria-hidden="true" />
        </span>
        <h2 id="download-title">{t.desktopTitle}</h2>
        <p id="download-description">{t.desktopDescription}</p>
        <a className="button button--primary" href="https://web.guildvo.com">
          {t.openBrowser} <ChevronRight aria-hidden="true" />
        </a>
      </dialog>
    </CopyContext.Provider>
  );
}
