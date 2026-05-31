import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { StickyWhatsApp } from "@/components/marketing/StickyWhatsApp";
import { ScrollPopup } from "@/components/marketing/ScrollPopup";

const WA_NUMBER = "4915123702524";
// TODO: swap to info@cheftoman.com when domain email is live
const EMAIL_FALLBACK = "cheftoman_official@outlook.com";

function buildWaUrl(message: string) {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
}

function buildMailto(subject: string, body: string) {
  return `mailto:${EMAIL_FALLBACK}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const HERO_MSG =
  "Hi Cheftoman — I run a restaurant and I'd love to learn more about the free pilot.";
const PILOT_MSG =
  "Hi Cheftoman — I'd like a free sample stand for my restaurant. Can you send details?";
const FINAL_MSG = "Hi Cheftoman — let's set up the free pilot for my restaurant.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Cheftoman — Real love from real diners, straight to your kitchen",
      },
      {
        name: "description",
        content:
          "Cheftoman lets seated diners send hearts and thank-you notes straight to the cooks who made their meal. Presence-verified, kitchen-direct, no review networks.",
      },
      { property: "og:title", content: "Cheftoman — Real love from real diners" },
      {
        property: "og:description",
        content:
          "Seated diners tap a heart and write a note. It goes straight to the kitchen team. Free pilot for restaurants.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Hero />
      <WhatWeSolve />
      <HowItWorks />
      <span id="popup-sentinel" aria-hidden className="block h-px" />
      <PresenceVerified />
      <ForYourKitchen />
      <FreePilot />
      <LeadForm />
      <FinalCta />
      <Footer />
      <StickyWhatsApp href={buildWaUrl(HERO_MSG)} />
      <ScrollPopup href={buildWaUrl(PILOT_MSG)} sentinelId="popup-sentinel" />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-charcoal text-cream">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 80% 0%, color-mix(in oklab, var(--ember) 35%, transparent), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-24 text-center sm:pt-32">
        <p className="mb-5 inline-block rounded-full border border-cream/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cream/70">
          For restaurants
        </p>
        <h1 className="text-5xl leading-[1.05] text-cream sm:text-6xl">
          Real love from real diners,{" "}
          <span className="text-primary">straight to your kitchen.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-cream/80 sm:text-lg">
          Cheftoman lets seated diners tap a heart and write a thank-you note that
          lands on your cooks' screens — not on a review network.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={buildWaUrl(HERO_MSG)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 sm:w-auto"
          >
            Start a free pilot on WhatsApp
          </a>
          <a
            href="#lead-form"
            className="w-full rounded-md border border-cream/25 px-6 py-3 text-sm font-medium text-cream transition hover:bg-cream/10 sm:w-auto"
          >
            Request a free sample stand
          </a>
        </div>
      </div>
    </section>
  );
}

function WhatWeSolve() {
  const items = [
    {
      t: "The kitchen never hears it",
      d: "Compliments stay at the table. The cooks who made the dish never know it landed.",
    },
    {
      t: "Reviews go to platforms, not people",
      d: "Star ratings serve algorithms. They don't tell a line cook their sauce was perfect tonight.",
    },
    {
      t: "Anonymous feedback is noise",
      d: "Internet reviews are written by anyone, anytime. There's no signal a real diner was even there.",
    },
    {
      t: "Great cooks burn out unseen",
      d: "Recognition is the cheapest retention tool a kitchen has — and the one most restaurants skip.",
    },
  ];
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <h2 className="max-w-2xl text-3xl sm:text-4xl">What we solve</h2>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        The gap between a happy diner and the team that cooked their meal.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((i) => (
          <li
            key={i.t}
            className="rounded-xl border border-border bg-card p-5 text-card-foreground"
          >
            <div className="mb-2 h-1 w-8 rounded-full bg-primary" />
            <h3 className="text-lg">{i.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{i.d}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "Diner taps the table",
      d: "Each table has a small NFC stand. A phone tap (or QR scan) opens Cheftoman — no app install.",
    },
    {
      n: "02",
      t: "They send a heart + a note",
      d: "Pick the dish or the cook, tap a heart, write a quick thank-you. Takes ten seconds.",
    },
    {
      n: "03",
      t: "Your kitchen sees it live",
      d: "Hearts and notes stream into your ops view. Cooks see their own meter rise in real time.",
    },
  ];
  return (
    <section className="bg-accent/40">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-3xl sm:text-4xl">How it works</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <li
              key={s.n}
              className="rounded-xl border border-border bg-card p-6 text-card-foreground"
            >
              <div className="font-serif text-4xl text-primary">{s.n}</div>
              <h3 className="mt-3 text-xl">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function PresenceVerified() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <p className="text-xs uppercase tracking-[0.18em] text-primary">
        The Cheftoman difference
      </p>
      <h2 className="mt-3 text-3xl sm:text-4xl">
        Every heart comes from someone who actually sat at your table.
      </h2>
      <p className="mt-5 max-w-2xl text-muted-foreground">
        Cheftoman is presence-verified. A heart can only be sent from a real
        seated diner — through the NFC tag or QR code on the physical stand at
        their table. No off-site clicks, no drive-by ratings, no bots. What your
        kitchen sees is genuine appreciation from people who were there.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { t: "Verified at the table", d: "NFC + QR proof of presence." },
          { t: "Kitchen-direct", d: "Notes route to the cook, not a platform." },
          { t: "Real-time", d: "Live meters during service, not weekly reports." },
        ].map((x) => (
          <div key={x.t} className="rounded-lg border border-border bg-card p-4">
            <div className="text-sm font-medium text-card-foreground">{x.t}</div>
            <div className="mt-1 text-sm text-muted-foreground">{x.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ForYourKitchen() {
  const benefits = [
    "Cooks see recognition in real time, not weeks later",
    "Identify your signature dishes by what diners actually love",
    "Spot rising talent on the line by who's collecting hearts",
    "A retention tool that costs less than one bad month of turnover",
    "Zero new workflow for front of house — the stand does the work",
    "Owner dashboard with a venue-wide Love Meter and per-chef breakdown",
  ];
  return (
    <section className="bg-charcoal text-cream">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="max-w-2xl text-3xl text-cream sm:text-4xl">
          For your kitchen
        </h2>
        <p className="mt-3 max-w-2xl text-cream/70">
          Built for the people behind the pass.
        </p>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {benefits.map((b) => (
            <li
              key={b}
              className="flex items-start gap-3 rounded-lg border border-cream/15 bg-cream/5 p-4"
            >
              <span aria-hidden className="mt-1 text-primary">♥</span>
              <span className="text-sm text-cream/90">{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FreePilot() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <div className="rounded-2xl border border-border bg-card p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.18em] text-primary">
          Free pilot
        </p>
        <h2 className="mt-3 text-3xl text-card-foreground sm:text-4xl">
          Try Cheftoman in your dining room. On us.
        </h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          We'll send a sample stand, set up your venue page, and onboard your
          cooks. No subscription, no contract, no card. Keep it as long as
          you're getting value.
        </p>
        <ul className="mt-6 grid gap-2 text-sm text-card-foreground sm:grid-cols-2">
          <li>• 1 NFC + QR table stand, shipped free</li>
          <li>• Venue page with per-chef Love Meters</li>
          <li>• Owner ops view with live feeds</li>
          <li>• Cancel anytime, no questions</li>
        </ul>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href={buildWaUrl(PILOT_MSG)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-primary px-6 py-3 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Claim the free pilot on WhatsApp
          </a>
          <a
            href="#lead-form"
            className="rounded-md border border-border px-6 py-3 text-center text-sm font-medium text-foreground hover:bg-accent"
          >
            Or leave your details
          </a>
        </div>
      </div>
    </section>
  );
}

function LeadForm() {
  const [name, setName] = useState("");
  const [restaurant, setRestaurant] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = [
      "Hi Cheftoman — I'd like a free sample stand.",
      ``,
      `Name: ${name}`,
      `Restaurant: ${restaurant}`,
      `City: ${city}`,
      `WhatsApp: ${phone}`,
    ].join("\n");
    window.open(buildWaUrl(msg), "_blank", "noopener,noreferrer");
  }

  const inputClass =
    "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <section id="lead-form" className="bg-accent/40">
      <div className="mx-auto max-w-xl px-6 py-20">
        <h2 className="text-3xl sm:text-4xl">Request a free sample stand</h2>
        <p className="mt-3 text-muted-foreground">
          Four quick fields. Submitting opens WhatsApp with your details
          prefilled — we'll take it from there.
        </p>
        <form onSubmit={onSubmit} className="mt-8 grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Your name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Alex Garcia"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Restaurant</span>
            <input
              required
              value={restaurant}
              onChange={(e) => setRestaurant(e.target.value)}
              className={inputClass}
              placeholder="La Cantina"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">City</span>
            <input
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
              placeholder="Barcelona"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">WhatsApp number</span>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="+34 600 000 000"
            />
          </label>
          <button
            type="submit"
            className="mt-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Send via WhatsApp
          </button>
        </form>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h2 className="text-4xl sm:text-5xl">
        Give your cooks the credit they earned tonight.
      </h2>
      <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
        Set up takes one conversation. The pilot is free.
      </p>
      <a
        href={buildWaUrl(FINAL_MSG)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-block rounded-md bg-primary px-8 py-4 text-base font-medium text-primary-foreground hover:bg-primary/90"
      >
        Start on WhatsApp
      </a>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-3 px-6 py-8 sm:flex-row sm:items-center">
        <div className="font-serif text-xl text-card-foreground">Cheftoman</div>
        <div className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Cheftoman ·{" "}
          <Link to="/auth" className="underline hover:text-foreground">
            Restaurant sign-in
          </Link>
        </div>
      </div>
    </footer>
  );
}
