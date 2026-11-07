import { CARD_CLASS } from "./EventOverview";

interface Rule {
  title: string;
  text: string;
}

const AMONG_US_RULES: Rule[] = [
  {
    title: "Play fair",
    text: "No cheats, mods or exploits. One account per player. The host can remove anyone who breaks the rules and has the final say.",
  },
  {
    title: "Join the lobby",
    text: "The host shares the lobby code after check-in. Join with your account name, and don't leave once the round has started.",
  },
  {
    title: "Keep the secret",
    text: "Talk about the game only during meetings, in the game chat or the event voice channel. Don't reveal your role outside the game, and don't talk to living players once you're dead.",
  },
  {
    title: "Prize",
    text: "The prize is divided equally by the winners. Alive crewmates or impostors on the winning side receive the same amount at the end of the game.",
  },
  {
    title: "Be respectful",
    text: "No insults, harassment or spam. If something goes wrong, tell the host.",
  },
];

/** Rules tab of an Among Us event: everything in one card. */
export function AmongUsRules() {
  return (
    <section className={CARD_CLASS}>
      <h2 className="text-lg font-bold text-foreground">Rules</h2>
      <ol className="mt-5 flex flex-col gap-4">
        {AMONG_US_RULES.map((rule, i) => (
          <li key={rule.title} className="flex gap-4">
            <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-brand-deep text-tiny font-bold text-white">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {rule.title}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-default-500">
                {rule.text}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
