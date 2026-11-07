import type { GameEvent } from "@/types/event";

/** Every event is hosted by the platform for now. */
export const HOST_NAME = "Voxsy";

type Seed = Omit<GameEvent, "hostedBy" | "joined">;

const SEEDS: Seed[] = [
  { id: "e1", eventCode: "8E7QZFEH", rounds: 6, game: "apex-legends", name: "Dropzone · Community Series", format: "Trios", entryFee: 0, status: "live", startsLabel: "Live now", detail: "Match 3 of 6 · in progress", players: 60, maxPlayers: 60, prizePool: 750 },
  { id: "e2", eventCode: "E439QGQT", rounds: 1, game: "among-us", name: "Impostor Night", format: "10 players", entryFee: 0, status: "live", startsLabel: "Live now", detail: "Join between rounds", players: 8, maxPlayers: 10, prizePool: 100 },
  { id: "e3", eventCode: "XZ2KMWML", rounds: 5, game: "apex-legends", name: "Ranked Rumble", format: "Duos", entryFee: 5, status: "upcoming", startsLabel: "Today · 21:00", detail: "Starts in 2h 10m", players: 34, maxPlayers: 40, prizePool: 400 },
  { id: "e4", eventCode: "4HNZ8NJ2", rounds: 1, game: "among-us", name: "Sus Tournament", roomCode: "KFDLMA", format: "15 players", entryFee: 0, status: "upcoming", startsLabel: "Today · 22:30", detail: "Starts in 3h 40m", players: 15, maxPlayers: 15, prizePool: 150 },
  { id: "e5", eventCode: "PVSXFCDV", rounds: 6, game: "apex-legends", name: "Kings Canyon Cup", format: "Trios", entryFee: 10, status: "upcoming", startsLabel: "Tomorrow · 19:00", detail: "Starts in 1d 4h", players: 21, maxPlayers: 60, prizePool: 1200 },
  { id: "e6", eventCode: "RXNLC59N", rounds: 1, game: "among-us", name: "Crewmate Clash", roomCode: "QXZWRT", format: "12 players", entryFee: 0, status: "upcoming", startsWhenFull: true, startsLabel: "", detail: "", players: 3, maxPlayers: 12, prizePool: 1 },
  { id: "e7", eventCode: "ERKE8BA4", rounds: 4, game: "apex-legends", name: "Weekend Warzone", format: "Solo", entryFee: 0, status: "upcoming", startsLabel: "Sun · 16:00", detail: "Starts in 3d 1h", players: 12, maxPlayers: 30, prizePool: 250 },
  { id: "e8", eventCode: "WV9KDS7Y", rounds: 6, game: "apex-legends", name: "Season Opener", format: "Trios", entryFee: 0, status: "finished", startsLabel: "Finished", detail: "Won by Team Nova", players: 60, maxPlayers: 60, prizePool: 900 },
  { id: "e9", eventCode: "MR854FL2", rounds: 1, game: "among-us", name: "Vent Masters", result: { winningSide: "impostors", survivors: ["Nova", "Pixel"] }, format: "10 players", entryFee: 0, status: "finished", startsLabel: "Finished", detail: "Won by the impostors", players: 10, maxPlayers: 10, prizePool: 120 },
];

export const MOCK_EVENTS: GameEvent[] = SEEDS.map((seed) => ({
  ...seed,
  hostedBy: HOST_NAME,
  joined: false,
}));
