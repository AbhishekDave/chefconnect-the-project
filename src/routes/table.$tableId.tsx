import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import {
  getOrCreateAnonymousSessionToken,
  bumpNudgeCount,
  getNudgeCount,
} from "@/lib/anonymousSession";
import { useAuth } from "@/lib/auth";
import { VisitProofForm } from "@/components/VisitProofForm";
import { Heart } from "@/components/Heart";
import { countHearts } from "@/lib/hearts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SearchSchema = z.object({
  src: z.enum(["nfc", "qr", "link"]).default("link").catch("link"),
});

export type EntryMethod = z.infer<typeof SearchSchema>["src"];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/table/$tableId")({
  validateSearch: zodValidator(SearchSchema),
  head: () => ({ meta: [{ title: "At the table — Cheftoman" }] }),
  component: TablePage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-md px-5 py-10">
      <h1 className="font-serif text-3xl">Table not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The NFC tag or link you used isn't linked to a table yet. Ask a server to
        check it.
      </p>
      <Link to="/" className="mt-6 inline-block text-xs text-muted-foreground hover:text-foreground">
        ← Home
      </Link>
    </main>
  ),
});

type Dish = {
  id: string;
  dish_name: string;
  description: string | null;
  image_url: string | null;
  dietary_type: string | null;
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  is_gluten_free: boolean | null;
  assigned_crew_id: string | null;
};
type Chef = { id: string; crewId: string; full_name: string; role: string };
type TableInfo = {
  id: string;
  table_number: string | number | null;
  restaurant: { id: string; name: string; slug: string };
};

type TableRow = {
  id: string;
  table_number: string | number | null;
  restaurant_id: string;
  restaurants: { id: string; name: string; slug: string } | null;
};

type CrewRow = {
  id: string;
  chef_profile_id: string;
  crew_role: string;
  chef_profiles:
    | { id: string; users: { full_name: string | null } | null }
    | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function firstName(name: string) {
  return name.split(/\s+/)[0] ?? name;
}

function startOfDayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function fetchTableContext(tableId: string) {
  const cols =
    "id, table_number, restaurant_id, restaurants:restaurant_id(id, name, slug)";

  let { data: t, error } = await supabase
    .from("restaurant_tables")
    .select(cols)
    .eq("table_slug", tableId)
    .maybeSingle();

  if (!t && !error && UUID_RE.test(tableId)) {
    const res = await supabase
      .from("restaurant_tables")
      .select(cols)
      .eq("id", tableId)
      .maybeSingle();
    t = res.data;
    error = res.error;
  }

  if (error) throw error;
  if (!t) throw notFound();

  const tRow = t as unknown as TableRow;
  const restaurant = tRow.restaurants;
  if (!restaurant) throw new Error("Table has no restaurant");

  const [{ data: dishes }, { data: crew }] = await Promise.all([
    supabase
      .from("signature_dishes")
      .select(
        "id, dish_name, description, image_url, dietary_type, is_vegetarian, is_vegan, is_gluten_free, assigned_crew_id",
      )
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .limit(20),
    supabase
      .from("restaurant_crew")
      .select(
        "id, chef_profile_id, crew_role, chef_profiles:chef_profile_id(id, user_id, users:user_id(full_name))",
      )
      .eq("restaurant_id", restaurant.id),
  ]);

  const chefs: Chef[] = ((crew as unknown as CrewRow[] | null) ?? [])
    .map((r) => ({
      id: r.chef_profiles?.id ?? "",
      crewId: r.id,
      full_name: r.chef_profiles?.users?.full_name ?? "Chef",
      role: r.crew_role ?? "kitchen",
    }))
    .filter((c) => c.id);

  return {
    table: { id: tRow.id, table_number: tRow.table_number, restaurant } as TableInfo,
    dishes: (dishes ?? []) as Dish[],
    chefs,
  };
}

function useHeart({
  targetType,
  targetId,
  entryMethod,
}: {
  targetType: "chef_profile" | "dish";
  targetId: string;
  entryMethod: EntryMethod;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const identity = user?.id ?? `anon:${getOrCreateAnonymousSessionToken()}`;
  const countKey = ["hearts-count", targetType, targetId];
  const heartedKey = ["hearted", identity, targetType, targetId];

  const { data: count } = useQuery({
    queryKey: countKey,
    queryFn: () => countHearts(targetType, targetId),
  });

  const { data: myHeart } = useQuery({
    queryKey: heartedKey,
    queryFn: async () => {
      let q = supabase
        .from("hearts")
        .select("id")
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .limit(1);
      q = user
        ? q.eq("from_user_id", user.id)
        : q.eq("anonymous_session_token", getOrCreateAnonymousSessionToken());
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data as { id: string } | null;
    },
  });

  const [optimisticHearted, setOptimisticHearted] = useState(false);
  const inFlightRef = useRef(false);
  const hearted = !!myHeart || optimisticHearted;

  useEffect(() => {
    const ch = supabase
      .channel(`hearts-${targetType}-${targetId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hearts", filter: `target_id=eq.${targetId}` },
        () => {
          qc.invalidateQueries({ queryKey: countKey });
          qc.invalidateQueries({ queryKey: heartedKey });
          qc.invalidateQueries({ queryKey: ["chef-rollup"] });
          qc.invalidateQueries({ queryKey: ["venue-rollup"] });
          qc.invalidateQueries({ queryKey: ["hearts-today"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, targetId, qc, identity]);

  async function tap() {
    if (hearted || inFlightRef.current) return;
    inFlightRef.current = true;
    setOptimisticHearted(true);
    const token = getOrCreateAnonymousSessionToken();
    try {
      const { error } = await supabase.from("hearts").insert({
        target_type: targetType,
        target_id: targetId,
        anonymous_session_token: token,
        from_user_id: user?.id ?? null,
        is_gps_verified: entryMethod === "nfc",
      });
      if (error) {
        setOptimisticHearted(false);
        toast.error(error.message);
        return;
      }
      if (!user) bumpNudgeCount();
      qc.invalidateQueries({ queryKey: countKey });
      qc.invalidateQueries({ queryKey: heartedKey });
      qc.invalidateQueries({ queryKey: ["chef-rollup"] });
      qc.invalidateQueries({ queryKey: ["venue-rollup"] });
      qc.invalidateQueries({ queryKey: ["hearts-today"] });
    } finally {
      inFlightRef.current = false;
    }
  }

  return { count: count ?? null, hearted, tap };
}

function CrewHeart({ chef, entryMethod }: { chef: Chef; entryMethod: EntryMethod }) {
  const { count, hearted, tap } = useHeart({
    targetType: "chef_profile",
    targetId: chef.id,
    entryMethod,
  });
  return (
    <Heart
      variant="interactive"
      size="md"
      count={count}
      hearted={hearted}
      onHeart={tap}
      label={`Heart ${chef.full_name}`}
    />
  );
}

function DishHeart({ dishId, entryMethod }: { dishId: string; entryMethod: EntryMethod }) {
  const { count, hearted, tap } = useHeart({
    targetType: "dish",
    targetId: dishId,
    entryMethod,
  });
  return (
    <Heart
      variant="interactive"
      size="sm"
      count={count}
      hearted={hearted}
      onHeart={tap}
    />
  );
}

function scrollToCrew(chefId: string) {
  const el = document.getElementById(`crew-${chefId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-ember", "ring-offset-2", "ring-offset-cream");
  setTimeout(() => {
    el.classList.remove("ring-2", "ring-ember", "ring-offset-2", "ring-offset-cream");
  }, 1400);
}

function TablePage() {
  const { tableId } = Route.useParams();
  const { src } = Route.useSearch();
  const { user, foodieProfileId } = useAuth();

  const tableQuery = useQuery({
    queryKey: ["table-ctx", tableId],
    queryFn: () => fetchTableContext(tableId),
    retry: false,
  });

  const resolvedTableUuid = tableQuery.data?.table.id ?? null;

  useEffect(() => {
    if (!resolvedTableUuid) return;
    const token = getOrCreateAnonymousSessionToken();
    const key = `cheftoman.connected.${resolvedTableUuid}`;
    if (typeof window !== "undefined" && window.sessionStorage.getItem(key)) return;
    void supabase
      .from("table_connections")
      .insert({
        table_id: resolvedTableUuid,
        anonymous_session_token: token,
        entry_method: src,
        is_verified_presence: src === "nfc",
      })
      .then(({ error }) => {
        if (!error && typeof window !== "undefined") window.sessionStorage.setItem(key, "1");
        else if (error) console.warn("table_connections insert", error);
      });
  }, [resolvedTableUuid, src]);

  if (tableQuery.isLoading) return <p className="p-6 text-sm text-muted-foreground">Setting your table…</p>;
  if (tableQuery.error) {
    return <p className="p-6 text-sm text-destructive">{(tableQuery.error as Error).message}</p>;
  }
  if (!tableQuery.data) return null;

  const { table, dishes, chefs } = tableQuery.data;
  const nudge = !user ? getNudgeCount() : 0;

  const chefIds = chefs.map((c) => c.id);
  const dishIds = dishes.map((d) => d.id);

  return (
    <main className={cn("mx-auto max-w-md px-5 py-7", !user && nudge > 0 ? "pb-44" : "pb-32")}>
      {/* Verified chip strip */}
      <div className="inline-flex items-center gap-1.5 rounded-full bg-ember/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-ember">
        <span>Table {table.table_number ?? ""}</span>
        <span className="opacity-50">·</span>
        <span>{src === "nfc" ? "NFC verified" : "at the table"}</span>
      </div>

      {/* Hero */}
      <header className="mt-4 animate-fade-up">
        <h1 className="font-serif text-[2.1rem] leading-[1.1] text-ink">
          <span className="italic text-ink/70">Tonight, your table was looked after by</span>
          <br />
          <span className="text-ember">
            {chefs.length === 0
              ? table.restaurant.name
              : chefs.map((c, i) => (
                  <span key={c.id}>
                    <Link
                      to="/chef/$chefId"
                      params={{ chefId: c.id }}
                      className="underline decoration-ember/30 decoration-1 underline-offset-4 transition-colors hover:decoration-ember"
                    >
                      {firstName(c.full_name)}
                    </Link>
                    {i < chefs.length - 1 ? <span className="text-ink/40">, </span> : "."}
                  </span>
                ))}
          </span>
        </h1>
        <Link
          to="/restaurant/$slug"
          params={{ slug: table.restaurant.slug }}
          className="mt-2 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          {table.restaurant.name} →
        </Link>
      </header>

      {/* The kitchen tonight */}
      <Section title="The kitchen tonight">
        {chefs.length === 0 ? (
          <Empty>The pass is quiet — the kitchen hasn't checked in yet.</Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {chefs.map((c) => (
              <li
                key={c.id}
                id={`crew-${c.id}`}
                className="flex items-center gap-3 rounded-[14px] bg-card p-4 shadow-warm transition-shadow"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ember/15 font-serif text-lg text-ember">
                  {initials(c.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-serif text-lg leading-tight text-ink">
                    {c.full_name}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {c.role}
                  </div>
                </div>
                <CrewHeart chef={c} entryMethod={src} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Tonight's dishes */}
      <Section title="Tonight's dishes">
        {dishes.length === 0 ? (
          <Empty>No dishes listed yet.</Empty>
        ) : (
          <ol className="space-y-3">
            {dishes.map((d, i) => {
              const cookedBy = d.assigned_crew_id
                ? chefs.find((c) => c.crewId === d.assigned_crew_id)
                : null;
              return (
                <li
                  key={d.id}
                  className="flex items-start gap-3 rounded-[14px] bg-card p-3.5 shadow-warm"
                >
                  <span className="mt-0.5 w-6 shrink-0 font-serif text-base text-ember/70 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-lg leading-tight text-ink">
                      {d.dish_name}
                    </div>
                    {d.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {d.description}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <DietaryChips dish={d} />
                      {cookedBy && (
                        <button
                          type="button"
                          onClick={() => scrollToCrew(cookedBy.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-ember/30 bg-ember/5 px-2 py-0.5 text-[11px] text-ember transition-colors hover:bg-ember/10"
                        >
                          <span className="opacity-60">cooked by</span>
                          <span className="font-medium">{firstName(cookedBy.full_name)}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="h-14 w-14 overflow-hidden rounded-[10px] bg-accent">
                      {d.image_url ? (
                        <img
                          src={d.image_url}
                          alt={d.dish_name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-serif text-xl text-ember/40">
                          ◐
                        </div>
                      )}
                    </div>
                    <DishHeart dishId={d.id} entryMethod={src} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      {/* Prove you ate here */}
      <Section title="Prove you ate here">
        <div className="rounded-[14px] bg-card p-4 shadow-warm">
          <VisitProofForm
            tableId={table.id}
            restaurantId={table.restaurant.id}
            foodieProfileId={foodieProfileId}
          />
        </div>
      </Section>

      {/* Thank-you ritual */}
      <Section title="Send a thank-you">
        <ThankYouRitual chefs={chefs} foodieProfileId={foodieProfileId} />
      </Section>

      <LoveMeter chefIds={chefIds} dishIds={dishIds} />

      {!user && nudge > 0 && <NudgeBanner count={nudge} />}
    </main>
  );
}

function DietaryChips({ dish }: { dish: Dish }) {
  const tags: string[] = [];
  if (dish.is_vegan) tags.push("Vegan");
  else if (dish.is_vegetarian) tags.push("Vegetarian");
  if (dish.is_gluten_free) tags.push("GF");
  if (tags.length === 0 && dish.dietary_type) tags.push(dish.dietary_type);
  return (
    <>
      {tags.map((t) => (
        <span
          key={t}
          className="inline-block rounded-full bg-accent px-2 py-0.5 text-[11px] text-ink/70"
        >
          {t}
        </span>
      ))}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9 animate-fade-up">
      <h2 className="mb-3 font-serif text-[1.35rem] text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[14px] border border-dashed border-border bg-card/60 p-4 text-sm italic text-muted-foreground">
      {children}
    </p>
  );
}

function LoveMeter({ chefIds, dishIds }: { chefIds: string[]; dishIds: string[] }) {
  const since = useMemo(() => startOfDayIso(), []);
  const { data } = useQuery({
    queryKey: ["hearts-today", chefIds.join(","), dishIds.join(",")],
    enabled: chefIds.length > 0 || dishIds.length > 0,
    queryFn: async () => {
      let chefN = 0;
      let dishN = 0;
      if (chefIds.length) {
        const { count } = await supabase
          .from("hearts")
          .select("id", { count: "exact", head: true })
          .eq("target_type", "chef_profile")
          .in("target_id", chefIds)
          .gte("created_at", since);
        chefN = count ?? 0;
      }
      if (dishIds.length) {
        const { count } = await supabase
          .from("hearts")
          .select("id", { count: "exact", head: true })
          .eq("target_type", "dish")
          .in("target_id", dishIds)
          .gte("created_at", since);
        dishN = count ?? 0;
      }
      return chefN + dishN;
    },
  });

  const n = data ?? null;
  return (
    <div className="mt-10 flex items-center justify-center gap-2 text-center font-serif text-sm italic text-ink/70">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full bg-ember animate-ticker-pulse"
      />
      {n === null ? (
        <span>Counting hearts in the kitchen…</span>
      ) : n === 0 ? (
        <span>Be the first heart tonight.</span>
      ) : (
        <span>
          {n} {n === 1 ? "diner has" : "diners have"} loved this kitchen tonight
        </span>
      )}
    </div>
  );
}

function ThankYouRitual({
  chefs,
  foodieProfileId,
}: {
  chefs: Chef[];
  foodieProfileId: string | null;
}) {
  const [chefId, setChefId] = useState<string>("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [flying, setFlying] = useState(false);
  const [delivered, setDelivered] = useState<{ name: string; at: string } | null>(null);
  const { user } = useAuth();

  if (chefs.length === 0) return <Empty>No chefs to thank yet.</Empty>;

  const chef = chefs.find((c) => c.id === chefId);
  const chefName = chef ? firstName(chef.full_name) : "";
  const canSend = !!chefId && content.trim().length >= 3 && content.length <= 500;

  if (delivered) {
    return (
      <div className="rounded-[14px] bg-card p-6 text-center shadow-warm animate-fade-up">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-ember/10 text-ember">
          ✓
        </div>
        <div className="mt-3 font-serif text-lg italic text-ink">
          Delivered to {delivered.name}'s pass · {delivered.at}
        </div>
        <button
          type="button"
          onClick={() => {
            setDelivered(null);
            setChefId("");
            setContent("");
          }}
          className="mt-4 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Thank another chef
        </button>
      </div>
    );
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setBusy(true);
    setFlying(true);
    try {
      const token = getOrCreateAnonymousSessionToken();
      const { error } = await supabase.from("thank_you_notes").insert({
        target_chef_id: chefId,
        note_content: content.trim(),
        anonymous_session_token: token,
        from_foodie_id: foodieProfileId,
      });
      if (error) throw error;
      if (!user) bumpNudgeCount();
      // let the note fly, then reveal stamp
      await new Promise((r) => setTimeout(r, 750));
      const at = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      setDelivered({ name: chefName || "the chef", at });
    } catch (err) {
      setFlying(false);
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="rounded-[14px] bg-card p-5 shadow-warm space-y-4">
      {/* Step 1 */}
      <div>
        <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          1 · Who do you want to thank?
        </div>
        <div className="flex flex-wrap gap-2">
          {chefs.map((c) => {
            const active = c.id === chefId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setChefId(c.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-ember bg-ember/10 text-ember"
                    : "border-border bg-cream text-ink/80 hover:border-ember/40",
                )}
              >
                {firstName(c.full_name)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2 */}
      {chefId && (
        <div className="animate-fade-up">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            2 · A note for {chefName}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Tell them what they made you feel…"
            className="w-full rounded-[12px] border border-border bg-cream/60 px-3 py-3 font-serif text-base italic text-ink placeholder:text-ink/40 focus:border-ember focus:outline-none"
          />
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-accent/60">
            <div
              className="h-full bg-ember transition-all"
              style={{ width: `${Math.min(100, (content.trim().length / 3) * 100)}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{content.trim().length < 3 ? "A few more words…" : "Ready to send."}</span>
            <span className="tabular-nums">{content.length}/500</span>
          </div>
        </div>
      )}

      {/* Step 3 — send */}
      {chefId && (
        <div className="relative pt-1">
          <button
            type="submit"
            disabled={!canSend || busy}
            className={cn(
              "w-full rounded-full bg-ember px-4 py-3 text-sm font-medium text-cream transition-all shadow-warm",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              !busy && canSend && "hover:brightness-105 active:scale-[0.99]",
              flying && "animate-note-fly pointer-events-none",
            )}
          >
            {busy && !flying ? "Folding the note…" : `Send to ${chefName || "the kitchen"}`}
          </button>
        </div>
      )}
    </form>
  );
}

function NudgeBanner({ count }: { count: number }) {
  if (count === 1) {
    return (
      <Link
        to="/auth"
        className="fixed bottom-4 right-4 z-50 rounded-full bg-ember px-3.5 py-2 text-xs font-medium text-cream shadow-warm"
      >
        Claim your profile
      </Link>
    );
  }
  if (count === 2) {
    return (
      <div className="fixed inset-x-4 bottom-4 z-50 rounded-[14px] border border-ember/30 bg-card p-4 shadow-warm">
        <div className="font-serif text-base text-ink">Claim your profile</div>
        <div className="mt-1 text-xs text-muted-foreground">Your {count} hearts come with you.</div>
        <Link
          to="/auth"
          className="mt-3 inline-block rounded-full bg-ember px-3.5 py-1.5 text-xs font-medium text-cream"
        >
          Continue
        </Link>
      </div>
    );
  }
  return (
    <Link
      to="/auth"
      className="fixed inset-x-0 bottom-0 z-50 block bg-ember px-5 py-3 text-center text-sm font-medium text-cream"
    >
      Claim your profile — your {count} hearts come with you.
    </Link>
  );
}
