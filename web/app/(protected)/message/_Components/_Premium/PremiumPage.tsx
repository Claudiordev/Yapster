"use client";

import { useState } from "react";
import { Button } from "@heroui/button";

import { C } from "@/app/(protected)/message/_Components/_GameServers/utils/palette";
import { Icon } from "@/components/Icon/Icon";
import { RedVoidBackdrop } from "@/components/RedVoidBackdrop/RedVoidBackdrop";

interface Plan {
  id: string;
  name: string;
  /** Monthly price in euros, as displayed. */
  price: string;
  /** Price when billed yearly, in euros, as displayed. */
  yearlyPrice: string;
  /** Line above the feature list, e.g. "Everything in Premium, plus". */
  intro?: string;
  /** What the plan includes. Empty until the features are defined. */
  features: string[];
  /** The bigger plan gets the tinted card and the white button. */
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "premium",
    name: "Premium",
    price: "3.99",
    yearlyPrice: "39.99",
    features: [
      "500MB uploads",
      "1440p video streaming",
      "1 medium game server",
      "Creation of events",
      "10K message characters",
      "Premium badge",
      "Profile effects",
    ],
  },
  {
    id: "premium-plus",
    name: "Premium+",
    price: "8.99",
    yearlyPrice: "89.99",
    intro: "Everything in Premium, plus",
    features: ["1GB uploads", "2160p video streaming", "1 big game server", "Premium+ badge"],
    highlight: true,
  },
];

type Billing = "monthly" | "yearly";

/** What a yearly price works out to per month (39.99 -> 3.33). */
function perMonth(yearlyPrice: string): string {
  return (Number(yearlyPrice) / 12).toFixed(2);
}

function BillingOption({
  label,
  selected,
  onSelect,
  highlight,
  children,
  detail,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  highlight: boolean;
  children: React.ReactNode;
  detail?: string;
}) {
  return (
    <button
      aria-checked={selected}
      className={`flex w-full items-center justify-between rounded-large border px-5 py-4 text-left transition-colors ${
        selected
          ? highlight
            ? "border-brand/70 bg-white/[0.04]"
            : "border-white/30 bg-white/[0.04]"
          : "border-transparent hover:bg-white/[0.03]"
      }`}
      role="radio"
      type="button"
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
            selected ? "border-brand" : "border-white/30"
          }`}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-brand" />}
        </span>
        <div className="flex flex-col">
          <span className="flex items-center gap-2 text-small font-bold text-white">
            {label}
          </span>
          {detail && <span className="text-tiny text-default-400">{detail}</span>}
        </div>
      </div>
      {children}
    </button>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const [billing, setBilling] = useState<Billing>("yearly");

  return (
    <section
      aria-label={`${plan.name} plan`}
      className={`flex h-full flex-col overflow-hidden rounded-[28px] border ${
        plan.highlight
          ? "border-white/10 bg-[linear-gradient(160deg,#5a1d3a_0%,#2c2430_38%,#2a2b30_100%)]"
          : "border-white/10 bg-[#2a2b30]"
      }`}
    >
      <div className="flex min-h-[340px] flex-1 flex-col gap-5 p-9">
        <h3 className="text-[34px] font-black uppercase italic leading-none tracking-tight text-white">
          {plan.name}
        </h3>

        {plan.intro && <p className="text-small font-bold text-white">{plan.intro}</p>}

        {plan.features.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-base font-medium text-white">
                <Icon className="text-white" name="check" size={16} />
                {feature}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-default-400">Features coming soon.</p>
        )}
      </div>

      <div className="border-t border-white/10 p-7">
        <div aria-label="Billing" className="flex flex-col gap-2" role="radiogroup">
          <BillingOption
            detail={`€${perMonth(plan.yearlyPrice)}/month billed annually`}
            highlight={!!plan.highlight}
            label="Yearly"
            selected={billing === "yearly"}
            onSelect={() => setBilling("yearly")}
          >
            <span className="text-lg font-extrabold text-white">€{plan.yearlyPrice}</span>
          </BillingOption>

          <BillingOption
            highlight={!!plan.highlight}
            label="Monthly"
            selected={billing === "monthly"}
            onSelect={() => setBilling("monthly")}
          >
            <span className="text-lg font-extrabold text-white">€{plan.price}</span>
          </BillingOption>
        </div>

        {/* No payment flow yet: Subscribe does nothing until billing exists. */}
        <Button
          className={`mt-5 h-12 w-full rounded-medium text-base font-bold ${
            plan.highlight ? "bg-white text-black" : "bg-white/10 text-default-300"
          }`}
          radius="none"
          startContent={<Icon name="star" size={16} />}
          variant="light"
        >
          Subscribe
        </Button>
      </div>
    </section>
  );
}

/** Star positions (percent of the sky), sizes in px and twinkle delays in seconds. */
const SKY_STARS = [
  { left: "50%", top: "20%", size: 20, delay: 0 },
  { left: "36%", top: "42%", size: 14, delay: 0.6 },
  { left: "63%", top: "46%", size: 16, delay: 1.1 },
  { left: "24%", top: "28%", size: 9, delay: 1.8 },
  { left: "76%", top: "26%", size: 11, delay: 0.3 },
  { left: "45%", top: "70%", size: 8, delay: 2.1 },
  { left: "58%", top: "76%", size: 12, delay: 1.4 },
  { left: "14%", top: "52%", size: 8, delay: 0.9 },
  { left: "86%", top: "50%", size: 9, delay: 2.4 },
  { left: "31%", top: "64%", size: 10, delay: 0.2 },
  { left: "69%", top: "68%", size: 10, delay: 1.7 },
  { left: "42%", top: "30%", size: 7, delay: 2.7 },
  { left: "57%", top: "34%", size: 7, delay: 0.5 },
  { left: "20%", top: "72%", size: 7, delay: 1.2 },
  { left: "80%", top: "74%", size: 8, delay: 2.0 },
  { left: "8%", top: "34%", size: 6, delay: 1.5 },
  { left: "92%", top: "36%", size: 6, delay: 0.8 },
  { left: "50%", top: "52%", size: 9, delay: 2.2 },
  { left: "27%", top: "18%", size: 6, delay: 2.9 },
  { left: "73%", top: "16%", size: 6, delay: 1.0 },
];

/** Stars behind the closing line, fading out at the edges. */
function PremiumSky() {
  return (
    <div aria-hidden className="premium-sky premium-sky--behind">
      <div className="auth-stars auth-stars-one" />
      <div className="auth-stars auth-stars-two" />
      {SKY_STARS.map((star) => (
        <span
          key={`${star.left}-${star.top}`}
          className="premium-sky-star"
          style={
            {
              left: star.left,
              top: star.top,
              "--s": `${star.size}px`,
              "--d": `${star.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** The Premium page: two monthly plans side by side. */
export default function PremiumPage({ onClose }: { onClose?: () => void }) {
  return (
    <div
      style={{
        backgroundColor: C.bg,
        height: "100%",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        color: C.w,
      }}
    >
      {/* Same animated galaxy (clouds, stars, shooting stars) as the login page. */}
      <RedVoidBackdrop />

      {onClose && (
        <button
          aria-label="Close"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "20px",
            zIndex: 3,
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            border: `1px solid ${C.bd}`,
            backgroundColor: C.surf,
            color: C.gi,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Icon name="close" size={16} />
        </button>
      )}

      <div className="premium-scroll relative z-[1] h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-[1500px] px-10 pb-16 pt-12">
          <h2 className="mb-10 text-center text-[34px] font-black uppercase italic tracking-tight text-white">
            Pick your plan
          </h2>

          <div className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-2">
            {PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>

          {/* The sky sits behind the closing line: same center, drawn underneath. */}
          <div className="relative mt-2 flex min-h-[230px] items-center justify-center">
            <PremiumSky />
            <p className="relative z-[1] text-center text-[56px] font-black uppercase italic leading-[1.05] tracking-tight text-white">
              What are you
              <br />
              waiting for?
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
