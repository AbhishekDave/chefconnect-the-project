import { Link } from "@tanstack/react-router";

/**
 * Contextual back navigation. Prefers real browser history; falls back to a
 * provided parent route. Uses window.history.back() directly because
 * TanStack's router.history.back() occasionally requires two presses when
 * the current route normalized its search params on mount (zod defaults,
 * preview SHA params, etc.) which leaves a replace+push pair on the stack.
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
  const canGoBack =
    typeof window !== "undefined" && window.history.length > 1;

  if (canGoBack) {
    return (
      <button
        type="button"
        onClick={() => window.history.back()}
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
