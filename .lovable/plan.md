
Small content/visual pass on `src/routes/index.tsx`, plus two new stub route files. No data or logic changes.

## 1. Localize the lead form (`LeadForm()` in `src/routes/index.tsx`)

| Field | Old placeholder | New placeholder |
|---|---|---|
| Your name | `Alex Garcia` | `Anna Schmidt` |
| Restaurant | `La Cantina` | `Weinhaus Hubertus` |
| City | `Barcelona` | `Koblenz` |
| WhatsApp | `+34 600 000 000` | `+49 151 2345678` |

Scanned the rest of the file — these are the only Barcelona/+34/La Cantina occurrences.

## 2. Region focus line

> *"Starting in the Koblenz–Bonn–Cologne–Frankfurt region."*

Add once in the hero (small, muted, all caps tracking, directly under the CTA) and once in the footer. Phrased as where we're focused, not where we already operate.

## 3. Header anchors

New thin header inside `Landing()`, above `<Hero />` — wordmark left, anchor links right. Plain `<a>` for hash anchors, TanStack `<Link>` for routes. No mobile nav (anchors hidden on small screens; wordmark + Sign in only).

| Label | Target |
|---|---|
| How it works | `#how-it-works` |
| For chefs | `#for-chefs` |
| For owners | `#for-owners` |
| See a live table | `/table/trattoria-demo-t01` (new tab) |
| Sign in | `/auth` |

Add matching `id` attributes to the existing `HowItWorks`, `ForYourKitchen`, and `FreePilot` `<section>` elements. Section copy itself is unchanged (renaming "For your kitchen" → "For chefs" is held for the full redesign).

## 4. Real footer

Replace the current minimal `Footer()` with a three-column layout (stacked on mobile). Uses existing `EMAIL_FALLBACK` and `WA_NUMBER` constants.

- **Left — brand**
  - Wordmark "Cheftoman"
  - Region focus line
  - "We handle your data under GDPR."
  - © {year} Cheftoman

- **Middle — Talk to us**
  - Email → `mailto:cheftoman_official@outlook.com`
  - WhatsApp → `https://wa.me/4915123702524`
  - Instagram → `https://instagram.com/cheftoman_official`
  - X → `https://x.com/cheftoman`
  - (Instagram and X handles are intentionally different — used exactly as given.)

- **Right — Explore & Legal**
  - See a live table → `/table/trattoria-demo-t01`
  - How it works → `#how-it-works`
  - Restaurant sign-in → `/auth`
  - Impressum → `/impressum`
  - Datenschutz → `/datenschutz`

## 5. Stub legal routes (new files)

Two minimal placeholder pages, same shell, real legal copy added later.

- `src/routes/impressum.tsx` — `createFileRoute("/impressum")`, H1 "Impressum", one line: "Legal disclosure coming soon. For inquiries, contact cheftoman_official@outlook.com.", back link to `/`. `head()` with title + description + `noindex` robots meta.
- `src/routes/datenschutz.tsx` — `createFileRoute("/datenschutz")`, H1 "Datenschutz", one line: "Our full privacy policy is being prepared. We handle your data under GDPR. For data requests, contact cheftoman_official@outlook.com.", back link to `/`. Same `head()` shape with `noindex`.

Both use existing tokens (`bg-background`, `text-foreground`, `font-serif`) — no new styles.

## Out of scope (still deferred to the full marketing-home redesign)

- Rewriting "For your kitchen" as a real "For chefs" section
- A dedicated "For owners" section distinct from the pilot card
- Mobile drawer for header anchors
- Hero composition / product mocks / three-sided story
- Real legal copy for Impressum and Datenschutz
