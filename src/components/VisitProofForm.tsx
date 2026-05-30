import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { getOrCreateAnonymousSessionToken } from "@/lib/anonymousSession";
import { uploadProofImage } from "@/lib/storage";

type Props = {
  tableId: string;
  restaurantId: string;
  foodieProfileId: string | null;
};

export function VisitProofForm({ tableId, restaurantId, foodieProfileId }: Props) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const token = getOrCreateAnonymousSessionToken();
      const image_url = await uploadProofImage(token, file);
      const { error } = await supabase.from("meal_visit_proofs").insert({
        restaurant_id: restaurantId,
        table_id: tableId,
        anonymous_session_token: token,
        image_url,
        foodie_profile_id: foodieProfileId,
      });
      if (error) throw error;
      setDone(true);
      toast.success("Proof saved.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        Thanks — your proof is in.
      </p>
    );
  }

  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        disabled={busy}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <span className="text-2xl" aria-hidden>📸</span>
      <span>{busy ? "Uploading…" : "Snap or upload a photo"}</span>
    </label>
  );
}
