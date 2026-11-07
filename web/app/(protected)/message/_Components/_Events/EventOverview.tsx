import { Icon } from "@/components/Icon/Icon";
import type { GameEvent } from "@/types/event";
import { getEventDetails } from "./utils/eventDetails";
import { formatPrize } from "./utils/eventFilters";

/** The raised card every section of the detail page sits in. */
export const CARD_CLASS =
  "rounded-large border-2 border-surface-border bg-content1 p-6 shadow-[0_4px_0_#1e1f22] dark:bg-surface-chat";

const TILE_CLASS = "rounded-medium border border-divider bg-black/20 px-4 py-3";

const PRIZE_TILE: string[] = [
  "border-[#f5b73b]/50 bg-[#f5b73b]/15",
  "border-divider bg-black/20",
  "border-divider bg-black/20",
];

/** Overview tab: intro with the key facts, prize split and the step-by-step timeline. */
export function EventOverview({ event }: { event: GameEvent }) {
  const details = getEventDetails(event);
  const facts = details.facts;

  const intro = (
    <section className={CARD_CLASS}>
      <h2 className="text-lg font-bold text-foreground">
        {details.introTitle}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-default-500">
        {details.intro}
      </p>
      <div
        className={`mt-5 grid gap-3 ${facts.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
      >
        {facts.map((fact) => (
          <div key={fact.label} className={TILE_CLASS}>
            <p className="text-tiny text-default-400">{fact.label}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {fact.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
  const prize = (
    <section className={CARD_CLASS}>
      <h2 className="text-lg font-bold text-foreground">
        {details.prizeTitle}
      </h2>
      {details.prizeText.map((line) => (
        <p key={line} className="mt-2 text-sm text-default-500">
          {line}
        </p>
      ))}
      {details.prizes && (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {details.prizes.map((prize, i) => (
            <div
              key={prize.place}
              className={`flex flex-col items-center gap-1 rounded-medium border px-4 py-4 ${PRIZE_TILE[i]} ${
                // A lone box sits in the middle column.
                details.prizes.length === 1 ? "sm:col-start-2" : ""
              }`}
            >
              <Icon className="text-[#f5b73b]" name="trophy" size={18} />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-default-500">
                {prize.place}
              </p>
              <p className="text-xl font-bold text-[#f5b73b]">
                {formatPrize(prize.amount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  // Among Us leads with how the prize is paid; Apex leads with the intro.
  const prizeFirst = details.game.competitor === "players";

  return (
    <div className="flex flex-col gap-5">
      {prizeFirst ? prize : intro}
      {prizeFirst ? intro : prize}

      <section className={CARD_CLASS}>
        <h2 className="text-lg font-bold text-foreground">
          Your event, step by step.
        </h2>
        <ol className="mt-5 flex flex-col">
          {details.steps.map((step, i) => {
            const done = i < details.currentStep;
            const current = i === details.currentStep;

            return (
              <li
                key={step.title}
                className="relative flex gap-4 pb-6 last:pb-0"
              >
                {i < details.steps.length - 1 && (
                  <span
                    aria-hidden
                    className={`absolute left-[5px] top-4 h-full w-px ${done ? "bg-brand/60" : "bg-divider"}`}
                  />
                )}
                <span
                  aria-hidden
                  className={`relative mt-1 h-[11px] w-[11px] flex-shrink-0 rounded-full ${
                    current
                      ? "bg-brand ring-4 ring-brand/25"
                      : done
                        ? "bg-brand/60"
                        : "bg-default-300"
                  }`}
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-tiny text-default-500">
                    {step.text}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
