import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export const Route = createFileRoute("/_authenticated/me")({
  component: MePage,
});

/**
 * Returns the live row count, or `null` while loading / when the filter value
 * isn't ready yet. Callers render `—` for `null` so we never flash a
 * misleading "0" when the real total is unknown.
 */
function useCount(queryKey: unknown[], table: string, filterCol: string, filterVal: string | null): number | null {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey,
    enabled: !!filterVal,
    queryFn: async () => {
      if (!filterVal) return 0;
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq(filterCol, filterVal);
      return count ?? 0;
    },
  });
  useEffect(() => {
    if (!filterVal) return;
    const ch = supabase
      .channel(`me-${table}-${filterCol}-${filterVal}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `${filterCol}=eq.${filterVal}` },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [table, filterCol, filterVal, qc]);
  return q.data ?? null;
}

function MePage() {
  const { user, foodieProfileId } = useAuth();
  const [tab, setTab] = useState<"hearts" | "proofs" | "notes">("hearts");

  const heartsGiven = useCount(["me-hearts", user?.id], "hearts", "from_user_id", user?.id ?? null);
  const notesWritten = useCount(["me-notes", foodieProfileId], "thank_you_notes", "from_foodie_id", foodieProfileId);

  return (
    <main className="mx-auto max-w-3xl px-5 pb-12">
      <h1 className="text-3xl">Your Love Meter</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Stat label="Hearts given" value={heartsGiven} />
        <Stat label="Thank-you notes" value={notesWritten} />
      </div>

      <div className="mt-8 flex gap-2 rounded-md bg-secondary p-1 text-sm">
        {(["hearts", "proofs", "notes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded px-3 py-1.5 capitalize ${tab === t ? "bg-background text-foreground" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === "hearts" && <HeartsList userId={user!.id} />}
        {tab === "proofs" && <ProofsList foodieProfileId={foodieProfileId} />}
        {tab === "notes" && <NotesList foodieProfileId={foodieProfileId} />}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl text-primary tabular-nums">
        {value === null ? <span className="text-muted-foreground">—</span> : value}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">{children}</p>;
}

type HeartRow = { id: string; target_type: string; target_id: string; created_at: string };

function HeartsList({ userId }: { userId: string }) {
  const { data: hearts, isLoading } = useQuery({
    queryKey: ["me-hearts-list", userId],
    queryFn: async (): Promise<HeartRow[]> => {
      const { data, error } = await supabase
        .from("hearts")
        .select("id, target_type, target_id, created_at")
        .eq("from_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as HeartRow[];
    },
  });

  const chefIds = (hearts ?? []).filter((h) => h.target_type === "chef_profile").map((h) => h.target_id);
  const dishIds = (hearts ?? []).filter((h) => h.target_type === "dish").map((h) => h.target_id);

  // Resolve display names: chefs come from users.full_name via chef_profiles
  // (chef_profiles has no name column). Dishes come straight from
  // signature_dishes.dish_name.
  const { data: nameMap } = useQuery({
    queryKey: ["me-hearts-names", chefIds.join(","), dishIds.join(",")],
    enabled: !!hearts && hearts.length > 0,
    queryFn: async () => {
      const map: Record<string, string> = {};
      if (chefIds.length > 0) {
        const { data, error } = await supabase
          .from("chef_profiles")
          .select("id, users:user_id(full_name)")
          .in("id", chefIds);
        if (error) throw error;
        ((data ?? []) as unknown as Array<{ id: string; users: { full_name: string | null } | null }>).forEach((r) => {
          map[r.id] = r.users?.full_name?.trim() || `Chef ${r.id.slice(0, 6)}`;
        });
      }
      if (dishIds.length > 0) {
        const { data, error } = await supabase
          .from("signature_dishes")
          .select("id, dish_name")
          .in("id", dishIds);
        if (error) throw error;
        ((data ?? []) as Array<{ id: string; dish_name: string }>).forEach((r) => {
          map[r.id] = r.dish_name;
        });
      }
      return map;
    },
  });

  if (isLoading) return <Empty>Loading…</Empty>;
  if (!hearts?.length) return <Empty>No hearts given yet.</Empty>;
  return (
    <ul className="space-y-2">
      {hearts.map((h) => {
        const name = nameMap?.[h.target_id] ?? `${h.target_type === "dish" ? "Dish" : "Chef"} ${h.target_id.slice(0, 6)}`;
        return (
          <li key={h.id} className="rounded-lg border border-border bg-card p-3 text-sm text-card-foreground">
            <span className="text-primary">♥</span> {name}{" "}
            <span className="text-muted-foreground">· {new Date(h.created_at).toLocaleString()}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ProofsList({ foodieProfileId }: { foodieProfileId: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["me-proofs", foodieProfileId],
    enabled: !!foodieProfileId,
    queryFn: async () => {
      if (!foodieProfileId) return [];
      const { data, error } = await supabase
        .from("meal_visit_proofs")
        .select("id, image_url, created_at")
        .eq("foodie_profile_id", foodieProfileId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!foodieProfileId || isLoading) return <Empty>Loading…</Empty>;
  if (!data?.length) return <Empty>No proofs yet.</Empty>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {data.map((p) => (
        <li key={p.id}>
          <img src={p.image_url} alt="proof" className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
        </li>
      ))}
    </ul>
  );
}

function NotesList({ foodieProfileId }: { foodieProfileId: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["me-notes-list", foodieProfileId],
    enabled: !!foodieProfileId,
    queryFn: async () => {
      if (!foodieProfileId) return [];
      const { data, error } = await supabase
        .from("thank_you_notes")
        .select("id, note_content, created_at, target_chef_id")
        .eq("from_foodie_id", foodieProfileId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!foodieProfileId || isLoading) return <Empty>Loading…</Empty>;
  if (!data?.length) return <Empty>No notes yet.</Empty>;
  return (
    <ul className="space-y-2">
      {data.map((n) => (
        <li key={n.id} className="rounded-lg border border-border bg-card p-3 text-sm text-card-foreground">
          {n.note_content}
          <div className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
        </li>
      ))}
    </ul>
  );
}
