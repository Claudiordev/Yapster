/** Games that host events. */
export type EventGame = "among-us" | "apex-legends";

export type EventStatus = "live" | "upcoming" | "finished";

/** Outcome of a finished Among Us round. */
export interface EventResult {
  winningSide: "crewmates" | "impostors";
  /** Players still alive at the end; they split the prize pool equally. */
  survivors: string[];
}

/** An event in the Events page list (named GameEvent to not clash with the DOM Event). */
export interface GameEvent {
  id: string;
  /** Public code that identifies the event (not secret, unlike roomCode), random 8 characters, e.g. "K7Q2M9XD". */
  eventCode: string;
  game: EventGame;
  name: string;
  hostedBy: string;
  /** Team format shown under the name, e.g. "Trios". */
  format: string;
  /** Entry fee in euros; 0 is free entry. */
  entryFee: number;
  status: EventStatus;
  /** No set date: the event starts as soon as every spot is taken. */
  startsWhenFull?: boolean;
  /** What the "Starts" column shows, e.g. "Today · 21:00". */
  startsLabel: string;
  /** Muted line under it, e.g. "Match 3 of 6 · in progress". */
  detail: string;
  /** Matches or rounds the event runs. */
  rounds: number;
  players: number;
  maxPlayers: number;
  /** Cash prize pool in euros. */
  prizePool: number;
  /** Final outcome, for finished events that have one. */
  result?: EventResult;
  /**
   * Code of the in-game room. Events with one are joined by entering this code in the game;
   * the player only counts once the join is verified.
   */
  roomCode?: string;
  /** The signed-in user has joined. */
  joined: boolean;
}
