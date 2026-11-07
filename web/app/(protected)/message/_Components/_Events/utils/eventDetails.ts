import type { GameEvent } from "@/types/event";
import { EVENT_GAME_BY_ID } from "./eventGames";

/** Share of the prize pool for 1st / 2nd / 3rd place. */
const PRIZE_SPLIT = [0.6, 0.3, 0.1];
const PLACES = ["1st place", "2nd place", "3rd place"];

export interface EventStep {
  title: string;
  text: string;
}

/** "6 matches", "1 round". */
export function roundsText(event: GameEvent) {
  const game = EVENT_GAME_BY_ID[event.game];

  return `${event.rounds} ${event.rounds === 1 ? game.roundNounOne : game.roundNoun}`;
}

/** "Join as" only applies to squad games; Among Us players just join the lobby. */
function joinAs(event: GameEvent) {
  if (EVENT_GAME_BY_ID[event.game].competitor === "players") return null;
  if (event.format === "Trios") return "Solo, duo, or full trio";
  if (event.format === "Duos") return "Solo or full duo";

  return "Solo";
}

function intro(event: GameEvent) {
  const game = EVENT_GAME_BY_ID[event.game];

  if (game.competitor === "players") {
    return "Crewmates win by finishing tasks or voting out all impostors, and impostors win by eliminating enough crewmates. Everyone still alive on the winning side shares the prize.";
  }

  const bring =
    event.format === "Trios"
      ? "Join solo or bring up to two friends"
      : event.format === "Duos"
        ? "Join solo or bring a friend"
        : "Drop in on your own";

  return `Your next win starts with your squad. ${bring} for ${event.rounds} ${game.modeLabel} ${event.rounds === 1 ? game.roundNounOne : game.roundNoun}. Earn placement and kill points, climb the standings, and compete for a share of the cash prize pool.`;
}

/** The "Starts" text: the date, or for a start-when-full lobby how many spots are left. */
export function getStarts(event: GameEvent): { label: string; detail: string } {
  if (!event.startsWhenFull)
    return { label: event.startsLabel, detail: event.detail };

  const left = event.maxPlayers - event.players;

  return left <= 0
    ? { label: "Starting now", detail: "The lobby is full" }
    : {
        label: "When full",
        detail: `${left} spot${left === 1 ? "" : "s"} to go`,
      };
}

/** Prize card: Among Us splits the pool between the winners; squad games pay the top three places. */
function prizeSection(event: GameEvent) {
  if (EVENT_GAME_BY_ID[event.game].competitor === "players") {
    return {
      prizeTitle: "Prize description",
      prizeText: [
        "The prize is divided equally by the winners.",
        "Alive crewmates or imposters receive the same divided amount at the end of the game.",
      ],
      // One box: the whole pool, which the winners split equally.
      prizes: [{ place: "Prize pool", amount: event.prizePool }],
    };
  }

  return {
    prizeTitle: "Something worth playing for.",
    prizeText: ["The prize pool goes to the top squads."],
    prizes: PRIZE_SPLIT.map((share, i) => ({
      place: PLACES[i],
      amount: Math.round(event.prizePool * share),
    })),
  };
}

export function getEventDetails(event: GameEvent) {
  const game = EVENT_GAME_BY_ID[event.game];
  const individual = game.competitor === "players";

  const register: EventStep = {
    title: "Register your spot",
    text: individual
      ? "Grab the room code and secure your seat in the lobby."
      : "Join solo or choose friends to play with.",
  };
  const winners: EventStep = {
    title: "Celebrate the winners",
    text: "Final placements and prize shares appear in Results.",
  };

  // Among Us has no check-in: you are either in the room or playing the round.
  const steps: EventStep[] = individual
    ? [
        register,
        {
          title: "Play the round",
          text: "The game is on. Stay in the room until the round ends.",
        },
        winners,
      ]
    : [
        register,
        {
          title: "Check in before you play",
          text: "Check-in opens 30 minutes before the scheduled start.",
        },
        {
          title: "Drop into the private match",
          text: "After check-in, get the host's lobby code and your squad assignment.",
        },
        winners,
      ];

  // Which step you are on: register → (check in →) play → results.
  const playStep = individual ? 1 : 2;
  const currentStep =
    event.status === "finished"
      ? steps.length - 1
      : event.status === "live"
        ? playStep
        : event.joined
          ? 1
          : 0;

  return {
    game,
    introTitle:
      game.competitor === "players"
        ? "Spot the impostor. Share the prize."
        : "Good games start with good people.",
    intro: intro(event),
    facts: [
      {
        label: "Game mode",
        value:
          game.competitor === "players"
            ? game.modeLabel
            : `${event.format} · ${game.modeLabel}`,
      },
      { label: "Skill level", value: game.skillText },
      { label: "Join as", value: joinAs(event) },
    ].filter(
      (fact): fact is { label: string; value: string } => fact.value !== null,
    ),
    formatText: `${event.format} · ${roundsText(event)}`,
    ...prizeSection(event),
    steps,
    currentStep,
  };
}
