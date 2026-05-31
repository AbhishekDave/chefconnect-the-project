import { useState } from "react";

type BaseProps = {
  count: number | null;
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
 * Hearts are give-once and permanent per diner per target.
 * - `count`: global total (row count). `null` renders an em-dash placeholder so we
 *   never show a misleading "0" while loading.
 * - `hearted`: this diner already gave a heart → button is filled and locked
 *   (non-interactive, no hover affordance). Tapping is a no-op.
 */
export function HeartButton(props: HeartButtonProps) {
  const { count, label, className = "" } = props;
  const interactive = props.interactive === true;
  const hearted = interactive && (props as InteractiveProps).hearted === true;
  const [pulse, setPulse] = useState(false);

  const countNode =
    count === null ? (
      <span className="tabular-nums text-sm text-muted-foreground">—</span>
    ) : (
      <span className="tabular-nums text-sm">{count}</span>
    );

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
        {countNode}
      </span>
    </>
  );

  const shell =
    "flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left";

  if (!interactive) {
    return (
      <div
        className={`${shell} border-border ${className}`}
        aria-label={label ? `${label}, ${count ?? 0} hearts` : `${count ?? 0} hearts`}
      >
        {inner}
      </div>
    );
  }

  const { onHeart, disabled } = props;
  const locked = hearted || disabled;
  return (
    <button
      type="button"
      onClick={async () => {
        if (locked) return;
        setPulse(true);
        setTimeout(() => setPulse(false), 220);
        await onHeart();
      }}
      disabled={locked}
      aria-disabled={locked}
      aria-label={
        label
          ? hearted
            ? `You hearted ${label}`
            : `Send a heart to ${label}`
          : "Send a heart"
      }
      className={`${shell} transition-colors ${
        hearted
          ? "cursor-default border-primary bg-primary/10"
          : "border-border hover:border-primary active:scale-[0.99] disabled:opacity-50"
      } ${className}`}
    >
      {inner}
    </button>
  );
}
