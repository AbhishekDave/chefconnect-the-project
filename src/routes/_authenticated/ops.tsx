import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCrewContextForCurrentUser } from "@/lib/crew";

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

  if (crewQ.isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!crewQ.data || crewQ.data.restaurantIds.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="text-3xl">Ops</h1>
        <p className="mt-4 rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
          Not authorized — your account isn't linked to a restaurant crew.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pb-12">
      <h1 className="text-3xl">Venue Love Meter</h1>
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

function RestaurantOps({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();

  // restaurant meta
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

  // Hearts: two filtered queries, no phantom restaurant target.
  const hearts = useQuery({
    queryKey: ["ops-hearts", restaurantId, dishIds.join(","), chefIds.join(",")],
    enabled: meta.isSuccess,
    queryFn: async () => {
      const out: { target_type: string; target_id: string }[] = [];
      if (chefIds.length > 0) {
        const { data, error } = await supabase
          .from("hearts")
          .select("target_type, target_id")
          .eq("target_type", "chef_profile")
          .in("target_id", chefIds);
        if (error) throw error;
        out.push(...((data ?? []) as { target_type: string; target_id: string }[]));
      }
      if (dishIds.length > 0) {
        const { data, error } = await supabase
          .from("hearts")
          .select("target_type, target_id")
          .eq("target_type", "dish")
          .in("target_id", dishIds);
        if (error) throw error;
        out.push(...((data ?? []) as { target_type: string; target_id: string }[]));
      }
      return out;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`ops-hearts-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hearts" }, () =>
        qc.invalidateQueries({ queryKey: ["ops-hearts", restaurantId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [restaurantId, qc]);

  // Server-side scope: pull this venue's table ids first, then filter
  // table_connections by `.in('table_id', tableIds)`. Stops other venues'
  // connections from ever entering the result set.
  const tableIdsQ = useQuery({
    queryKey: ["ops-table-ids", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("id")
        .eq("restaurant_id", restaurantId);
      if (error) throw error;
      return ((data ?? []) as { id: string }[]).map((r) => r.id);
    },
  });
  const tableIds = tableIdsQ.data ?? [];

  const conns = useQuery({
    queryKey: ["ops-conns", restaurantId, tableIds.join(",")],
    enabled: tableIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_connections")
        .select("id, entry_method, is_verified_presence, created_at, table_id, restaurant_tables:table_id(table_number)")
        .in("table_id", tableIds)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data as unknown as Array<{
        id: string;
        entry_method: string | null;
        is_verified_presence: boolean | null;
        created_at: string;
        table_id: string;
        restaurant_tables: { table_number: string | number | null } | null;
      }>) ?? [];
    },
  });

  const notes = useQuery({
    queryKey: ["ops-notes", restaurantId, chefIds.join(",")],
    enabled: chefIds.length > 0,
    queryFn: async () => {
      if (chefIds.length === 0) return [];
      const { data, error } = await supabase
        .from("thank_you_notes")
        .select("id, note_content, created_at, target_chef_id")
        .in("target_chef_id", chefIds)
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
        qc.invalidateQueries({ queryKey: ["ops-notes", restaurantId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [restaurantId, qc]);

  const heartList = hearts.data ?? [];
  // null while loading so we render an em-dash instead of a misleading "0".
  const total: number | null = hearts.isLoading || !hearts.data ? null : heartList.length;
  const perDish = (meta.data?.dishes ?? [])
    .map((d) => ({ ...d, n: heartList.filter((h) => h.target_type === "dish" && h.target_id === d.id).length }))
    .sort((a, b) => b.n - a.n);
  const perChef = (meta.data?.chefs ?? [])
    .map((c) => {
      const directHearts = heartList.filter(
        (h) => h.target_type === "chef_profile" && h.target_id === c.id,
      ).length;
      const chefDishIds = (meta.data?.dishes ?? [])
        .filter((d) => d.assigned_crew_id === c.crewId)
        .map((d) => d.id);
      const dishHearts = heartList.filter(
        (h) => h.target_type === "dish" && chefDishIds.includes(h.target_id),
      ).length;
      return { ...c, n: directHearts + dishHearts };
    })
    .sort((a, b) => b.n - a.n);

  return (
    <section className="mt-6">
      <h2 className="text-xl">{meta.data?.restaurant?.name ?? "Restaurant"}</h2>
      <div className="mt-3 rounded-lg border border-border bg-card p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Hearts received</div>
        <div className="mt-1 text-5xl text-primary tabular-nums">
          {total === null ? <span className="text-muted-foreground">—</span> : total}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Chef hearts + dish hearts. No phantom restaurant target.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Panel title="Per chef">
          {perChef.length === 0 ? (
            <Empty>No chefs.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {perChef.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-card-foreground">{c.full_name}</span>
                  <span className="text-primary tabular-nums">♥ {c.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Per dish">
          {perDish.length === 0 ? (
            <Empty>No dishes.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {perDish.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span className="text-card-foreground">{d.dish_name}</span>
                  <span className="text-primary tabular-nums">♥ {d.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Panel title="Live table connections">
          {!conns.data?.length ? (
            <Empty>No connections yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {conns.data.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-xs">
                  <span className="text-card-foreground">
                    Table {c.restaurant_tables?.table_number ?? "?"}
                    {c.is_verified_presence && <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-primary">verified</span>}
                  </span>
                  <span className="text-muted-foreground">{c.entry_method} · {new Date(c.created_at).toLocaleTimeString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Thank-you notes">
          {!notes.data?.length ? (
            <Empty>No notes yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {notes.data.map((n) => {
                const chef = meta.data?.chefs.find((c) => c.id === n.target_chef_id);
                return (
                  <li key={n.id} className="rounded border border-border p-2 text-xs">
                    <div className="text-muted-foreground">→ {chef?.full_name ?? "Chef"}</div>
                    <div className="mt-0.5 text-card-foreground">{n.note_content}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
