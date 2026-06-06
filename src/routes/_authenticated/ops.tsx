import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCrewContextForCurrentUser } from "@/lib/crew";
import { Heart } from "@/components/Heart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ops")({
  component: OpsPage,
});

function OpsPage() {
  const { user } = useAuth();
  const crewQ = useQuery({
    queryKey: ["crew-ctx", user?.id],
    enabled: !!user?.id,
    queryFn: () => getCrewContextForCurrentUser(user!.id),
  });

  if (crewQ.isLoading)
    return <p className="p-6 text-sm text-muted-foreground">Loading the pass…</p>;
  if (!crewQ.data || crewQ.data.restaurantIds.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="font-serif text-4xl text-ink">The pass</h1>
        <p className="mt-4 rounded-[14px] border border-dashed border-border bg-card/60 p-6 text-sm italic text-muted-foreground">
          Not authorized — your account isn't linked to a restaurant crew.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pb-16 pt-6">
      {crewQ.data.restaurantIds.map((rid) => (
        <RestaurantOps key={rid} restaurantId={rid} />
      ))}
    </main>
  );
}

type CrewRow = {
  id: string;
  chef_profiles:
    | { id: string; users: { full_name: string | null } | null }
    | null;
};

type HeartRow = { target_type: string; target_id: string; created_at: string };

function startOfDayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

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

function RestaurantOps({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const todayIso = useMemo(() => startOfDayIso(), []);
  const weekAgoIso = useMemo(() => daysAgoIso(7), []);

  const meta = useQuery({
    queryKey: ["ops-meta", restaurantId],
    queryFn: async () => {
      const [{ data: r }, { data: dishes }, { data: crew }] = await Promise.all([
        supabase.from("restaurants").select("id, name").eq("id", restaurantId).maybeSingle(),
        supabase
          .from("signature_dishes")
          .select("id, dish_name, assigned_crew_id")
          .eq("restaurant_id", restaurantId)
          .eq("is_active", true),
        supabase
          .from("restaurant_crew")
          .select("id, chef_profiles:chef_profile_id(id, user_id, users:user_id(full_name))")
          .eq("restaurant_id", restaurantId),
      ]);
      const chefs = ((crew as unknown as CrewRow[] | null) ?? [])
        .map((row) => ({
          crewId: row.id,
          id: row.chef_profiles?.id ?? "",
          full_name: row.chef_profiles?.users?.full_name ?? "Chef",
        }))
        .filter((c) => c.id);
      return {
        restaurant: r as { id: string; name: string } | null,
        dishes: (dishes ?? []) as { id: string; dish_name: string; assigned_crew_id: string | null }[],
        chefs,
      };
    },
  });

  const dishIds = useMemo(() => meta.data?.dishes.map((d) => d.id) ?? [], [meta.data]);
  const chefIds = useMemo(() => meta.data?.chefs.map((c) => c.id) ?? [], [meta.data]);

  const hearts = useQuery({
    queryKey: ["ops-hearts", restaurantId, dishIds.join(","), chefIds.join(",")],
    enabled: meta.isSuccess,
    queryFn: async () => {
      const out: HeartRow[] = [];
      if (chefIds.length > 0) {
        const { data, error } = await supabase
          .from("hearts")
          .select("target_type, target_id, created_at")
          .eq("target_type", "chef_profile")
          .in("target_id", chefIds);
        if (error) throw error;
        out.push(...((data ?? []) as HeartRow[]));
      }
      if (dishIds.length > 0) {
        const { data, error } = await supabase
          .from("hearts")
          .select("target_type, target_id, created_at")
          .eq("target_type", "dish")
          .in("target_id", dishIds);
        if (error) throw error;
        out.push(...((data ?? []) as HeartRow[]));
      }
      return out;
    },
  });

  // Realtime pulse keys.
  const [topPulseKey, setTopPulseKey] = useState(0);
  const [chefPulse, setChefPulse] = useState<Record<string, number>>({});

  useEffect(() => {
    const ch = supabase
      .channel(`ops-hearts-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "hearts" },
        (payload) => {
          const row = payload.new as { target_type: string; target_id: string };
          let touched = false;
          if (row.target_type === "chef_profile" && chefIds.includes(row.target_id)) {
            setChefPulse((p) => ({ ...p, [row.target_id]: (p[row.target_id] ?? 0) + 1 }));
            touched = true;
          } else if (row.target_type === "dish" && dishIds.includes(row.target_id)) {
            const dish = meta.data?.dishes.find((d) => d.id === row.target_id);
            const chef = dish?.assigned_crew_id
              ? meta.data?.chefs.find((c) => c.crewId === dish.assigned_crew_id)
              : null;
            if (chef) {
              setChefPulse((p) => ({ ...p, [chef.id]: (p[chef.id] ?? 0) + 1 }));
            }
            touched = true;
          }
          if (touched) {
            setTopPulseKey((k) => k + 1);
            qc.invalidateQueries({ queryKey: ["ops-hearts", restaurantId] });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [restaurantId, qc, chefIds, dishIds, meta.data]);

  const tableIdsQ = useQuery({
    queryKey: ["ops-table-ids", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("id, table_number")
        .eq("restaurant_id", restaurantId);
      if (error) throw error;
      return ((data ?? []) as { id: string; table_number: string | number | null }[]);
    },
  });
  const tableRows = tableIdsQ.data ?? [];
  const tableIds = tableRows.map((t) => t.id);
  const tableNumberById = useMemo(() => {
    const m = new Map<string, string | number | null>();
    for (const t of tableRows) m.set(t.id, t.table_number);
    return m;
  }, [tableRows]);

  const conns = useQuery({
    queryKey: ["ops-conns", restaurantId, tableIds.join(",")],
    enabled: tableIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_connections")
        .select("id, entry_method, is_verified_presence, created_at, table_id, anonymous_session_token, restaurant_tables:table_id(table_number)")
        .in("table_id", tableIds)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data as unknown as Array<{
        id: string;
        entry_method: string | null;
        is_verified_presence: boolean | null;
        created_at: string;
        table_id: string;
        anonymous_session_token: string | null;
        restaurant_tables: { table_number: string | number | null } | null;
      }>) ?? [];
    },
  });

  const notes = useQuery({
    queryKey: ["ops-notes-public", restaurantId, chefIds.join(",")],
    enabled: chefIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("thank_you_notes")
        .select("id, note_content, created_at, target_chef_id, anonymous_session_token, is_public")
        .in("target_chef_id", chefIds)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`ops-feeds-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_connections" }, () =>
        qc.invalidateQueries({ queryKey: ["ops-conns", restaurantId] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "thank_you_notes" }, () =>
        qc.invalidateQueries({ queryKey: ["ops-notes-public", restaurantId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [restaurantId, qc]);

  const heartList = hearts.data ?? [];
  const heartsTodayList = heartList.filter((h) => h.created_at >= todayIso);
  const heartsWeekN = heartList.filter((h) => h.created_at >= weekAgoIso).length;
  const heartsTodayN: number | null =
    hearts.isLoading || !hearts.data ? null : heartsTodayList.length;

  const notesTodayN =
    notes.data?.filter((n) => (n.created_at as string) >= todayIso).length ?? 0;
  const notesWeekN =
    notes.data?.filter((n) => (n.created_at as string) >= weekAgoIso).length ?? 0;

  const connsToday = conns.data?.filter((c) => c.created_at >= todayIso) ?? [];
  const connsTodayN = connsToday.length;

  // Repeat diners this week: anonymous session tokens seen more than once.
  const repeatDinersWeekN = useMemo(() => {
    const seen = new Map<string, number>();
    for (const c of conns.data ?? []) {
      if (c.created_at < weekAgoIso || !c.anonymous_session_token) continue;
      seen.set(c.anonymous_session_token, (seen.get(c.anonymous_session_token) ?? 0) + 1);
    }
    let n = 0;
    for (const v of seen.values()) if (v > 1) n++;
    return n;
  }, [conns.data, weekAgoIso]);

  // Per chef today (direct + dish hearts via assigned_crew_id)
  const perChefToday = (meta.data?.chefs ?? [])
    .map((c) => {
      const direct = heartsTodayList.filter(
        (h) => h.target_type === "chef_profile" && h.target_id === c.id,
      ).length;
      const chefDishIds = (meta.data?.dishes ?? [])
        .filter((d) => d.assigned_crew_id === c.crewId)
        .map((d) => d.id);
      const viaDish = heartsTodayList.filter(
        (h) => h.target_type === "dish" && chefDishIds.includes(h.target_id),
      ).length;
      return { ...c, n: direct + viaDish };
    })
    .sort((a, b) => b.n - a.n);

  const perDishToday = (meta.data?.dishes ?? [])
    .map((d) => ({
      ...d,
      n: heartsTodayList.filter((h) => h.target_type === "dish" && h.target_id === d.id).length,
    }))
    .sort((a, b) => b.n - a.n);

  // Best-effort: match a note to a same-day table connection by anon session token.
  const tableForNote = (note: { anonymous_session_token: string | null; created_at: string }) => {
    if (!note.anonymous_session_token) return null;
    const conn = (conns.data ?? []).find(
      (c) =>
        c.anonymous_session_token === note.anonymous_session_token &&
        Math.abs(
          new Date(note.created_at).getTime() - new Date(c.created_at).getTime(),
        ) < 6 * 60 * 60 * 1000,
    );
    if (!conn) return null;
    return tableNumberById.get(conn.table_id) ?? null;
  };

  return (
    <section className="space-y-8">
      {/* Top band — Love meter today */}
      <div className="rounded-[14px] bg-card p-6 shadow-warm">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Tonight at {meta.data?.restaurant?.name ?? "your kitchen"}
        </div>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div className="font-serif text-6xl leading-none text-ink tabular-nums">
            {heartsTodayN === null ? <span className="text-muted-foreground">—</span> : heartsTodayN}
            <span className="ml-2 align-baseline font-serif text-base italic text-muted-foreground">
              hearts today
            </span>
          </div>
          <Heart variant="pulse" size="lg" pulseKey={topPulseKey} hideCount />
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          {notesTodayN > 0 ? `${notesTodayN} thank-you note${notesTodayN === 1 ? "" : "s"}` : "No notes yet today"}
          {" · "}
          {connsTodayN > 0
            ? `${connsTodayN} table${connsTodayN === 1 ? "" : "s"} connected`
            : "No tables connected yet"}
        </div>
      </div>

      {/* On the pass right now */}
      <div>
        <h2 className="mb-3 font-serif text-xl text-ink">On the pass right now</h2>
        {perChefToday.length === 0 ? (
          <Empty>The pass is quiet — first heart of the night coming up.</Empty>
        ) : (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {perChefToday.map((c) => (
              <PulseChip
                key={c.id}
                name={c.full_name}
                count={c.n}
                pulseKey={chefPulse[c.id] ?? 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tonight's most loved dishes */}
      <div>
        <h2 className="mb-3 font-serif text-xl text-ink">Tonight's most loved dishes</h2>
        {perDishToday.length === 0 || perDishToday.every((d) => d.n === 0) ? (
          <Empty>No dishes hearted yet tonight.</Empty>
        ) : (
          <ol className="space-y-2 rounded-[14px] bg-card p-4 shadow-warm">
            {perDishToday
              .filter((d) => d.n > 0)
              .slice(0, 8)
              .map((d, i) => (
                <li key={d.id} className="flex items-center justify-between">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="w-5 font-serif text-sm text-ember/70 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate font-serif text-base text-ink">{d.dish_name}</span>
                  </span>
                  <Heart variant="quiet" size="sm" count={d.n} />
                </li>
              ))}
          </ol>
        )}
      </div>

      {/* Weekly tiles */}
      <div className="grid grid-cols-3 gap-3">
        <Tile label="Repeat diners (7d)" value={conns.isLoading ? null : repeatDinersWeekN} hint="returning sessions" />
        <Tile label="Hearts (7d)" value={hearts.isLoading ? null : heartsWeekN} hint="across crew & dishes" />
        <Tile label="Notes (7d)" value={notes.isLoading ? null : notesWeekN} hint="public thank-yous" />
      </div>

      {/* Public thank-you notes */}
      <div>
        <h2 className="mb-3 font-serif text-xl text-ink">Recent thank-you notes</h2>
        {!notes.data?.length ? (
          <Empty>Once a diner shares one publicly, it'll land here.</Empty>
        ) : (
          <ul className="space-y-3">
            {notes.data.map((n) => {
              const chef = meta.data?.chefs.find((c) => c.id === n.target_chef_id);
              const chefName = chef ? firstName(chef.full_name) : "the chef";
              const tNum = tableForNote(n as { anonymous_session_token: string | null; created_at: string });
              const attribution = tNum ? `a diner at table ${tNum}` : "a diner";
              const restName = meta.data?.restaurant?.name ?? "the kitchen";
              const copyText = `"${n.note_content}" — to Chef ${chefName} at ${restName}`;
              return (
                <li
                  key={n.id}
                  className="rounded-[14px] bg-card p-4 shadow-warm animate-slide-in-soft"
                >
                  <p className="font-serif text-base italic leading-snug text-ink">
                    "{n.note_content}"
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                    <span>
                      to Chef {chefName} · from {attribution}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(copyText);
                      }}
                      className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink/70 transition-colors hover:border-ember/40 hover:text-ember"
                    >
                      Copy
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Live table connections */}
      <div>
        <h2 className="mb-3 font-serif text-xl text-ink">Live table connections</h2>
        {!conns.data?.length ? (
          <Empty>No tables connected yet.</Empty>
        ) : (
          <ul className="space-y-2 rounded-[14px] bg-card p-4 shadow-warm">
            {conns.data.slice(0, 20).map((c) => (
              <li key={c.id} className="flex items-center justify-between text-xs">
                <span className="text-ink">
                  Table {c.restaurant_tables?.table_number ?? "?"}
                  {c.is_verified_presence && (
                    <span className="ml-1.5 rounded-full bg-ember/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ember">
                      verified
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {c.entry_method} · {new Date(c.created_at).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PulseChip({
  name,
  count,
  pulseKey,
}: {
  name: string;
  count: number;
  pulseKey: number;
}) {
  const [pulse, setPulse] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 1500);
    return () => clearTimeout(t);
  }, [pulseKey]);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-warm transition-colors",
        pulse && "border-ember bg-ember/10 animate-pulse-ember",
      )}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ember/15 font-serif text-xs text-ember">
        {initials(name)}
      </span>
      <span className="text-sm font-medium text-ink">{firstName(name)}</span>
      <Heart variant="quiet" size="sm" count={count} />
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | null;
  hint: string;
}) {
  return (
    <div className="rounded-[14px] bg-card p-4 shadow-warm">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-serif text-3xl text-ink tabular-nums">
        {value === null ? <span className="text-muted-foreground">—</span> : value}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[14px] border border-dashed border-border bg-card/60 p-4 text-sm italic text-muted-foreground">
      {children}
    </p>
  );
}
