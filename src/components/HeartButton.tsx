import { useState } from "react";

type BaseProps = {
  count: number;
  label?: string;
  className?: string;
};

type InteractiveProps = BaseProps & {
  interactive: true;
  onHeart: () => void | Promise<void>;
  disabled?: boolean;
  hearted?: boolean;
};

type DisplayProps = BaseProps & {
  interactive?: false;
};

export type HeartButtonProps = InteractiveProps | DisplayProps;

/**
 * Hearts come only from verified-present diners at a table.
 * Public pages render a display-only chip; the table page renders an interactive button.
 * When `hearted` is true, the button reflects an existing heart from this diner
 * (tap again to un-heart). Server-side uniqueness is a Phase 2 DB constraint:
 *   unique(target_type, target_id, coalesce(from_user_id::text, anonymous_session_token)).
 */
export function HeartButton(props: HeartButtonProps) {
  const { count, label, className = "" } = props;
  const interactive = props.interactive === true;
  const hearted = interactive && (props as InteractiveProps).hearted === true;
  const [pulse, setPulse] = useState(false);

  const inner = (
    <>
      {label && <span className="text-card-foreground">{label}</span>}
      <span className={`flex items-center gap-1.5 ${hearted ? "text-primary" : "text-primary/80"}`}>
        <span
          aria-hidden
          className={`inline-block transition-transform ${pulse ? "scale-125" : "scale-100"}`}
        >
          {hearted ? "♥" : "♡"}
        </span>
        <span className="tabular-nums text-sm">{count}</span>
      </span>
    </>
  );

  const shell =
    "flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left";

  if (!interactive) {
    return (
      <div
        className={`${shell} border-border ${className}`}
        aria-label={label ? `${label}, ${count} hearts` : `${count} hearts`}
      >
        {inner}
      </div>
    );
  }

  const { onHeart, disabled } = props;
  return (
    <button
      type="button"
      onClick={async () => {
        setPulse(true);
        setTimeout(() => setPulse(false), 220);
        await onHeart();
      }}
      disabled={disabled}
      aria-pressed={hearted}
      aria-label={label ? `${hearted ? "Remove heart from" : "Send a heart to"} ${label}` : "Send a heart"}
      className={`${shell} transition-colors active:scale-[0.99] disabled:opacity-50 ${
        hearted ? "border-primary bg-primary/5" : "border-border hover:border-primary"
      } ${className}`}
    >
      {inner}
    </button>
  );
}
