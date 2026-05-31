import { Link, useRouter } from "@tanstack/react-router";

/**
 * Contextual back navigation. Prefers real browser history; falls back to a
 * provided parent route. Used in place of the hardcoded "← Home" links so
 * table → restaurant → chef navigation doesn't jump straight to /.
 */
export function BackLink({
  fallbackTo,
  fallbackParams,
  label = "← Back",
}: {
  fallbackTo: string;
  fallbackParams?: Record<string, string>;
  label?: string;
}) {
  const router = useRouter();
  const canGoBack =
    typeof window !== "undefined" && window.history.length > 1;

  if (canGoBack) {
    return (
      <button
        type="button"
        onClick={() => router.history.back()}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {label}
      </button>
    );
  }

  return (
    <Link
      to={fallbackTo}
      params={fallbackParams as never}
      className="text-xs text-muted-foreground hover:text-foreground"
    >
      {label}
    </Link>
  );
}
