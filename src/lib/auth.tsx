import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { getAnonymousSessionToken } from "./anonymousSession";
import { toast } from "sonner";

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  foodieProfileId: string | null;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState>({
  loading: true,
  session: null,
  user: null,
  foodieProfileId: null,
  signOut: async () => {},
});

const FOODIE_KEY = "cheftoman.foodie_profile_id";

/**
 * Stitch anonymous activity (hearts, thank-you notes, meal proofs) onto a
 * newly-signed-in user. The deployed `stitch_anonymous_session` RPC is
 * expected to update ALL THREE anon-keyed columns in one transaction:
 *   - hearts.from_user_id           (where anonymous_session_token = anon_token)
 *   - thank_you_notes.from_foodie_id
 *   - meal_visit_proofs.foodie_profile_id
 * If a future schema adds a new anon-keyed table, the RPC MUST be updated to
 * cover it; otherwise the diner's history is silently orphaned.
 *
 * Throws on failure — callers MUST surface, not swallow.
 */
async function reconcileIdentity(user: User): Promise<string | null> {
  // 1. users upsert — keep existing full_name if present
  const incomingName = (user.user_metadata?.full_name as string | undefined)?.trim() || "";
  const { data: existing } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  let full_name: string;
  if (existing?.full_name) {
    full_name = existing.full_name;
  } else if (incomingName) {
    full_name = incomingName;
  } else {
    full_name = user.email ?? "Diner";
  }

  const { error: uErr } = await supabase
    .from("users")
    .upsert(
      { id: user.id, email: user.email ?? null, full_name, user_type: "foodie" },
      { onConflict: "id" },
    );
  if (uErr) throw new Error(`users upsert failed: ${uErr.message}`);

  // 2. foodie_profiles ensure-one
  let foodieProfileId: string | null = null;
  const { data: fp } = await supabase
    .from("foodie_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (fp?.id) {
    foodieProfileId = fp.id;
  } else {
    const { data: newFp, error: fErr } = await supabase
      .from("foodie_profiles")
      .insert({ user_id: user.id })
      .select("id")
      .maybeSingle();
    if (fErr) throw new Error(`foodie_profiles insert failed: ${fErr.message}`);
    foodieProfileId = newFp?.id ?? null;
  }
  if (foodieProfileId) {
    window.localStorage.setItem(FOODIE_KEY, foodieProfileId);
  }

  // 3. stitch anon session — surface RPC failures, do NOT swallow
  const token = getAnonymousSessionToken();
  if (token && foodieProfileId) {
    const { error: sErr } = await supabase.rpc("stitch_anonymous_session", {
      target_user_id: user.id,
      target_foodie_profile_id: foodieProfileId,
      anon_token: token,
    });
    if (sErr) {
      throw new Error(`stitch_anonymous_session failed: ${sErr.message}`);
    }

    // Dev-only sanity check: confirm at least one of the three anon-keyed
    // tables actually received the stitch. If all three are zero after a
    // known-active anon session, the RPC silently no-op'd.
    if (import.meta.env.DEV) {
      const [hearts, notes, proofs] = await Promise.all([
        supabase
          .from("hearts")
          .select("*", { count: "exact", head: true })
          .eq("from_user_id", user.id),
        supabase
          .from("thank_you_notes")
          .select("*", { count: "exact", head: true })
          .eq("from_foodie_id", foodieProfileId),
        supabase
          .from("meal_visit_proofs")
          .select("*", { count: "exact", head: true })
          .eq("foodie_profile_id", foodieProfileId),
      ]);
      // eslint-disable-next-line no-console
      console.table({
        "hearts.from_user_id": hearts.count ?? 0,
        "thank_you_notes.from_foodie_id": notes.count ?? 0,
        "meal_visit_proofs.foodie_profile_id": proofs.count ?? 0,
      });
    }
  }

  return foodieProfileId;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [foodieProfileId, setFoodieProfileId] = useState<string | null>(
    typeof window !== "undefined" ? window.localStorage.getItem(FOODIE_KEY) : null,
  );
  const reconciledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) void runReconcile(data.session.user);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) void runReconcile(s.user);
      if (!s) setFoodieProfileId(null);
    });

    async function runReconcile(user: User) {
      if (reconciledRef.current.has(user.id)) return;
      reconciledRef.current.add(user.id);
      try {
        const id = await reconcileIdentity(user);
        if (mounted && id) setFoodieProfileId(id);
      } catch (e) {
        // Surface the failure — do NOT swallow. Clear the dedupe so the next
        // auth event retries.
        reconciledRef.current.delete(user.id);
        const msg = (e as Error).message;
        // eslint-disable-next-line no-console
        console.error("reconcileIdentity failed:", msg);
        toast.error(
          "We couldn't link your earlier taps to this account. Contact support if your hearts are missing.",
        );
      }
    }

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    loading,
    session,
    user: session?.user ?? null,
    foodieProfileId,
    signOut: async () => {
      await supabase.auth.signOut();
      window.localStorage.removeItem(FOODIE_KEY);
      setFoodieProfileId(null);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
