"use client";

import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  ChevronDown,
  ChevronRight,
  Gamepad2,
  Menu,
  Mic,
  MonitorUp,
  PhoneOff,
  Server,
  Settings,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="Voxsi home">
      <Image priority alt="" height={44} src="/voxsi-mark.svg" width={44} />
      <span>Voxsi</span>
    </a>
  );
}

function Avatar({ tone, children }: { tone: string; children: React.ReactNode }) {
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
  return (
    <div className="app-window" data-depth="0.35">
      <div className="window-bar">
        <div className="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="window-address">
          <span /> app.voxsi.com
        </div>
        <span className="window-live">
          <i /> Live
        </span>
      </div>

      <div className="app-layout">
        <aside className="server-rail" aria-label="Community list">
          <div className="mini-brand">
            <Image alt="" height={32} src="/voxsi-mark.svg" width={32} />
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
            <p>PLAYGROUND</p>
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
            <p>VOICE CHANNELS</p>
            <span className="channel">
              <b>⌁</b> The warmup
            </span>
            <span className="channel channel--voice">
              <b>⌁</b> Ranked grind
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
              <strong>You</strong>
              <small>Voice connected</small>
            </span>
            <div className="dock-icons">
              <b>⌁</b>
              <Settings aria-hidden="true" size={9} />
            </div>
          </div>
        </aside>

        <section className="call-panel" aria-label="Voxsi call preview">
          <div className="call-header">
            <div>
              <span className="call-icon">⌁</span>
              <span>
                <strong>Ranked grind</strong>
                <small>Nightfall · 4 connected</small>
              </span>
            </div>
            <Chip className="hd-pill" size="sm" variant="flat">
              1440p · 60 FPS
            </Chip>
          </div>

          <div className="video-grid">
            <div className="video-tile video-tile--main">
              <div className="screen-art">
                <div className="screen-sky" />
                <div className="screen-mountain screen-mountain--back" />
                <div className="screen-mountain screen-mountain--front" />
                <div className="screen-hud">
                  <span>ROUND 08</span>
                  <strong>04 : 12</strong>
                  <span>ALIVE 3</span>
                </div>
                <div className="crosshair">+</div>
              </div>
              <span className="tile-label">
                <i /> Maya is sharing
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

          <div className="call-controls" aria-label="Call controls">
            <button
              className={controls.mic ? "is-off" : ""}
              type="button"
              aria-label="Mute microphone"
              aria-pressed={controls.mic}
              onClick={() => onToggleControl("mic")}
            >
              <Mic aria-hidden="true" />
            </button>
            <button
              className={controls.camera ? "is-off" : ""}
              type="button"
              aria-label="Toggle camera"
              aria-pressed={controls.camera}
              onClick={() => onToggleControl("camera")}
            >
              <Video aria-hidden="true" />
            </button>
            <button
              className={controls.screen ? "control--active" : ""}
              type="button"
              aria-label="Share screen"
              aria-pressed={controls.screen}
              onClick={() => onToggleControl("screen")}
            >
              <MonitorUp aria-hidden="true" />
            </button>
            <button className="control--end" type="button" aria-label="Leave call">
              <PhoneOff aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function EventCard({ joined, onJoin }: { joined: boolean; onJoin: () => void }) {
  return (
    <article className="float-card event-pop" data-depth="1.15" id="events">
      <div className="float-topline">
        <span className="float-icon float-icon--gold">
          <CounterStrike2Icon />
        </span>
        <span>
          <small>COMMUNITY EVENT</small>
          <strong>Counter-Strike 2 Clash</strong>
        </span>
        <Chip className="live-badge" size="sm" variant="flat">
          <i /> OPEN
        </Chip>
      </div>
      <div className="event-row">
        <span>
          <small>1ST PRIZE</small>
          <strong>$1,500</strong>
        </span>
        <span>
          <small>SPOTS</small>
          <strong>{joined ? "386 / 500" : "385 / 500"}</strong>
        </span>
        <button className={joined ? "is-joined" : ""} type="button" onClick={onJoin}>
          {joined ? "Joined ✓" : "Join event"}
        </button>
      </div>
    </article>
  );
}

function FloatingCards({ joined, onJoin }: { joined: boolean; onJoin: () => void }) {
  return (
    <>
      <EventCard joined={joined} onJoin={onJoin} />

      <article className="float-card server-pop" data-depth="0.9">
        <div className="server-art" aria-hidden="true">
          <span className="block block--one" />
          <span className="block block--two" />
          <span className="block block--three" />
        </div>
        <div className="server-copy">
          <small>YOUR GAME SERVER</small>
          <strong>Survival World</strong>
          <span>
            <i /> Online · 8/20 friends
          </span>
        </div>
        <button type="button" aria-label="Open game server">
          <ChevronRight aria-hidden="true" />
        </button>
      </article>

      <article className="float-card file-pop" data-depth="1.35">
        <span className="file-type">ZIP</span>
        <span>
          <small>NEW FILE</small>
          <strong>game-night-clips.zip</strong>
          <em>742 MB · Ready to download</em>
        </span>
        <b>1 GB</b>
      </article>
    </>
  );
}

function VideoFeature() {
  return (
    <article className="feature-card feature-card--video reveal">
      <div className="feature-copy">
        <span className="feature-icon">
          <Video aria-hidden="true" />
        </span>
        <h3>1440p. Fully free.</h3>
        <p>
          Share your game in crisp 1440p and jump into low-latency voice or video without putting quality behind a payment.
        </p>
        <Chip className="feature-tag" size="sm" variant="bordered">
          1440p · Voice · Video · Screen share
        </Chip>
      </div>
      <div className="video-visual" aria-hidden="true">
        <div className="video-visual-screen">
          <div className="screen-sky" />
          <div className="screen-mountain screen-mountain--back" />
          <div className="screen-mountain screen-mountain--front" />
          <span className="visual-live">
            <i /> LIVE · 1440P
          </span>
          <div className="visual-player">
            <Avatar tone="one">M</Avatar>
            <b>Maya&apos;s screen</b>
            <small>60 FPS</small>
          </div>
        </div>
        <div className="visual-audience">
          <Avatar tone="two">J</Avatar>
          <Avatar tone="three">K</Avatar>
          <Avatar tone="four">Y</Avatar>
          <b>+8 watching</b>
        </div>
      </div>
    </article>
  );
}

function EventsFeature() {
  return (
    <article className="feature-card feature-card--events reveal">
      <div className="feature-copy">
        <span className="feature-icon feature-icon--gold">
          <Gamepad2 aria-hidden="true" />
        </span>
        <h3>Join prize events.</h3>
        <p>Play for more than bragging rights.</p>
      </div>
      <div className="bracket-visual" aria-hidden="true">
        <div className="prize-head">
          <div className="prize-name">
            <span className="cs2-game-mark"><CounterStrike2Icon /></span>
            <span><small>COMMUNITY EVENT</small><b>Counter-Strike 2 Clash</b></span>
          </div>
          <div className="prize-amount">
            <span>1ST PRIZE</span>
            <strong>$1,500</strong>
          </div>
        </div>
        <div className="event-spots">
          <span>SPOTS FILLED</span>
          <strong>385 / 500</strong>
          <div><i /></div>
        </div>
        <div className="match-foot">
          <span>COUNTER-STRIKE 2 · FRIDAY 20:00</span>
          <b>Registration open</b>
        </div>
      </div>
    </article>
  );
}

function ServersFeature() {
  return (
    <article className="feature-card feature-card--servers reveal">
      <div className="feature-copy">
        <span className="feature-icon feature-icon--green">
          <Server aria-hidden="true" />
        </span>
        <h3>Create a server for your crew.</h3>
        <p>Spin up a game server for your friends, see who&apos;s online, and jump from voice chat into the game in seconds.</p>
      </div>
      <div className="game-server-gallery">
        <div className="server-gallery-head">
          <span className="server-window-dots"><i /><i /><i /></span>
          <span className="server-gallery-title"><small>GAME SERVERS</small><strong>Create a server for your crew</strong></span>
          <span className="server-ready"><i /> READY</span>
        </div>
        <div className="server-create-bar">
          <span className="server-setting"><small>GAME</small><strong>Choose a game</strong></span>
          <span className="server-setting"><small>ACCESS</small><strong>Friends only</strong></span>
          <span className="server-launch">Launch server <ChevronRight aria-hidden="true" /></span>
        </div>
        <figure className="game-server-shot">
          <div>
            <Image
              fill
              alt="First-person view of friends playing together on a Minecraft server"
              sizes="(max-width: 680px) 42vw, 280px"
              src="/images/minecraft-server-first-person.png"
            />
          </div>
          <figcaption>
            <span><i /> Minecraft Server</span>
            <small>12 players online</small>
          </figcaption>
        </figure>
        <figure className="game-server-shot">
          <div>
            <Image
              fill
              alt="First-person Counter-Strike 2 view with teammates on a multiplayer server"
              sizes="(max-width: 680px) 42vw, 280px"
              src="/images/counter-strike-2-server-first-person.png"
            />
          </div>
          <figcaption>
            <span><i /> Counter-Strike 2</span>
            <small>10 players online</small>
          </figcaption>
        </figure>
      </div>
    </article>
  );
}

export function ShowcasePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [joined, setJoined] = useState(false);
  const [controls, setControls] = useState({ mic: false, camera: false, screen: true });
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 18);

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });

    const items = document.querySelectorAll<HTMLElement>(".reveal");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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
    stageRef.current?.querySelectorAll<HTMLElement>("[data-depth]").forEach((element) => {
      element.style.setProperty("--shift-x", "0px");
      element.style.setProperty("--shift-y", "0px");
    });
  }

  function toggleControl(control: string) {
    setControls((current) => ({ ...current, [control]: !current[control as keyof typeof current] }));
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="page-atmosphere" aria-hidden="true">
        <div className="nebula nebula--one" />
        <div className="nebula nebula--two" />
        <div className="stars stars--one" />
        <div className="stars stars--two" />
      </div>

      <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
        <nav className="nav shell" aria-label="Main navigation">
          <Brand />
          <button
            className="nav-toggle"
            type="button"
            aria-controls="nav-menu"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
          <div className={`nav-menu ${menuOpen ? "is-open" : ""}`} id="nav-menu">
            <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#events" onClick={() => setMenuOpen(false)}>Events</a>
          </div>
          <div className="nav-actions">
            <a className="text-link" href="/login">Log in</a>
            <Button as="a" className="button button--small button--light" href="/register" radius="lg">
              Open Voxsi <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </nav>
      </header>

      <main id="main">
        <section className="hero shell" id="top">
          <div className="hero-copy reveal">
            <h1>Ready when <span>you are.</span></h1>
            <p className="hero-lede">
              Join in, invite your friends, and make tonight the one everyone talks about tomorrow.
            </p>
            <div className="hero-actions">
              <Button as="a" className="button button--primary" href="/register" radius="lg">
                Open Voxsi in your Browser
              </Button>
              <Button as="a" className="button button--ghost" href="#features" radius="lg">
                See what&apos;s inside <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div
            ref={stageRef}
            className="showcase-wrap reveal"
            onPointerMove={(event) => updateParallax(event.clientX, event.clientY)}
            onPointerLeave={resetParallax}
          >
            <div className="showcase-glow" aria-hidden="true" />
            <div className="orbit orbit--one" aria-hidden="true" />
            <div className="orbit orbit--two" aria-hidden="true" />
            <ProductPreview controls={controls} onToggleControl={toggleControl} />
            <FloatingCards joined={joined} onJoin={() => setJoined((current) => !current)} />
          </div>
        </section>

        <section className="signal-strip" aria-label="Voxsi capabilities">
          <div>
            <span>VOICE</span><i>✦</i><span>2160P VIDEO</span><i>✦</i><span>EVENTS</span><i>✦</i><span>GAME SERVERS</span><i>✦</i><span>COMMUNITIES</span><i>✦</i><span>1 GB SHARING</span><i>✦</i>
            <span aria-hidden="true">VOICE</span><i aria-hidden="true">✦</i><span aria-hidden="true">2160P VIDEO</span><i aria-hidden="true">✦</i><span aria-hidden="true">EVENTS</span><i aria-hidden="true">✦</i>
          </div>
        </section>

        <section className="features shell" id="features">
          <div className="section-heading reveal">
            <span className="kicker">Everything in one place</span>
            <h2>More ways to be together.<br /><em>Less app-hopping.</em></h2>
            <p>Voxsi gives your people a home, from the first “you on?” to the final clip drop.</p>
          </div>
          <div className="bento-grid">
            <VideoFeature />
            <EventsFeature />
            <ServersFeature />
          </div>
        </section>

        <section className="closing shell reveal" id="download">
          <Image alt="" height={76} src="/voxsi-mark.svg" width={76} />
          <span className="kicker">Built for your crew</span>
          <h2>Ready when you are.</h2>
          <p>Join in, invite your friends, and make tonight the one everyone talks about tomorrow.</p>
          <div className="hero-actions">
            <Button as="a" className="button button--primary" href="/register" radius="lg">Get started free</Button>
            <Button as="a" className="button button--ghost" href="/login" radius="lg">Open in browser</Button>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-grid shell">
          <div className="footer-brand">
            <Brand />
            <p>Your world.<br />Your voice.<br />Talk, stream, compete.</p>
          </div>
          <div><strong>Product</strong><a href="#features">Features</a><a href="#events">Events</a></div>
        </div>
        <div className="footer-bottom shell">
          <span>© 2026 Voxsi</span>
          <span>Made for people who play together.</span>
        </div>
      </footer>
    </>
  );
}
