export type GameId =
  | "cs2"
  | "league"
  | "valorant"
  | "minecraft"
  | "rocket"
  | "rust"
  | "among";
export const GAMES: { id: GameId; name: string; tag: string; tone: string }[] =
  [
    {
      id: "cs2",
      name: "Counter-Strike 2",
      tag: "Tactical. Teamwork. Trophies.",
      tone: "amber",
    },
    {
      id: "league",
      name: "League of Legends",
      tag: "Team up. Enter the Arena.",
      tone: "amber",
    },
    {
      id: "valorant",
      name: "VALORANT",
      tag: "Your squad. Your moment.",
      tone: "coral",
    },
    {
      id: "minecraft",
      name: "Minecraft",
      tag: "Build something worth winning.",
      tone: "mint",
    },
    {
      id: "rocket",
      name: "Rocket League",
      tag: "Big goals. Bigger celebrations.",
      tone: "blue",
    },
    {
      id: "rust",
      name: "Rust",
      tag: "Survive. Team up. Take the win.",
      tone: "rust",
    },
    {
      id: "among",
      name: "Among Us",
      tag: "Good friends. Suspicious alibis.",
      tone: "violet",
    },
  ];
export type PrizeEvent = {
  id: string;
  game: GameId;
  name: string;
  time: string;
  prize: number;
  players: number;
  capacity: number;
  format: string;
  live: boolean;
  description: string;
};
export const EVENTS: PrizeEvent[] = [
  {
    id: "cs2-clash",
    game: "cs2",
    name: "Counter-Strike 2 Clash",
    time: "Friday · 20:00",
    prize: 1500,
    players: 385,
    capacity: 500,
    format: "5v5 · Single elimination",
    live: false,
    description:
      "Bring your squad or find teammates in the event chat. Play through the bracket, share the highlights, and take your shot at the top prize.",
  },
  {
    id: "league-arena",
    game: "league",
    name: "League of Legends Arena",
    time: "Friday · 20:00",
    prize: 1500,
    players: 385,
    capacity: 500,
    format: "Duos · Arena",
    live: false,
    description:
      "Pick a partner, choose your champions, and meet your teammates in voice. Join the community Arena session and compete for the prize pool.",
  },
  {
    id: "cs2-duo",
    game: "cs2",
    name: "Wingman Warmup",
    time: "Live now",
    prize: 150,
    players: 22,
    capacity: 32,
    format: "2v2 · Quick matches",
    live: true,
    description:
      "Pick a partner and jump into quick Wingman matches. New teams can join the next round while registration is open.",
  },
  {
    id: "cs2-cup",
    game: "cs2",
    name: "Community Cup",
    time: "Sunday · 18:00",
    prize: 1000,
    players: 61,
    capacity: 100,
    format: "5v5 · Community tournament",
    live: false,
    description:
      "A full evening of community matches. Meet your team in voice, check in before the first round, and compete for the community cup.",
  },
  {
    id: "val-clash",
    game: "valorant",
    name: "Spike Night",
    time: "Saturday · 19:00",
    prize: 400,
    players: 30,
    capacity: 50,
    format: "5v5 · Single elimination",
    live: false,
    description:
      "Gather five friends, pick your agents, and make every round count in this community tournament.",
  },
  {
    id: "val-live",
    game: "valorant",
    name: "Clutch Club",
    time: "Live now",
    prize: 100,
    players: 14,
    capacity: 20,
    format: "5v5 · Quick matches",
    live: true,
    description:
      "Join the next round of friendly competitive games. Meet your team in the event lobby before the match.",
  },
  {
    id: "mc-build",
    game: "minecraft",
    name: "The Great Build-Off",
    time: "Saturday · 16:00",
    prize: 200,
    players: 18,
    capacity: 40,
    format: "Solo · Build challenge",
    live: false,
    description:
      "One theme, one hour, and your imagination. Build your entry and join the community showcase when the timer runs out.",
  },
  {
    id: "mc-run",
    game: "minecraft",
    name: "Parkour Party",
    time: "Live now",
    prize: 75,
    players: 12,
    capacity: 24,
    format: "Solo · Timed challenge",
    live: true,
    description:
      "Find your rhythm on a community parkour course. Join the next run and see how your time stacks up.",
  },
  {
    id: "rl-cup",
    game: "rocket",
    name: "Overtime Cup",
    time: "Saturday · 20:00",
    prize: 300,
    players: 24,
    capacity: 48,
    format: "3v3 · Single elimination",
    live: false,
    description:
      "Bring your trio for a night of big saves and last-second goals. Teams meet in voice before the first kickoff.",
  },
  {
    id: "rust-run",
    game: "rust",
    name: "Survival Showdown",
    time: "Sunday · 17:00",
    prize: 250,
    players: 28,
    capacity: 60,
    format: "Teams of 4 · Survival challenge",
    live: false,
    description:
      "Gather resources, work with your team, and complete the event objectives in a timed community survival challenge.",
  },
  {
    id: "among-night",
    game: "among",
    name: "Trust No One",
    time: "Friday · 21:00",
    prize: 50,
    players: 7,
    capacity: 15,
    format: "Solo · Community game night",
    live: false,
    description:
      "A few tasks, a few suspicious friends, and a night of deductions. Join the lobby and let the accusations begin.",
  },
];
export const money = (value: number) => `$${value.toLocaleString("en-US")}`;
