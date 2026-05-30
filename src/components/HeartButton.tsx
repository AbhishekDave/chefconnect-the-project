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
};

type DisplayProps = BaseProps & {
  interactive?: false;
};

export type HeartButtonProps = InteractiveProps | DisplayProps;

/**
 * Hearts come only from verified-present diners at a table.
 * Public pages render a display-only chip; the table page renders an interactive button.
 */
export function HeartButton(props: HeartButtonProps) {
  const { count, label, className = "" } = props;
  const interactive = props.interactive === true;
  const [pulse, setPulse] = useState(false);

  const inner = (
    <>
      {label && <span className="text-card-foreground">{label}</span>}
      <span className="flex items-center gap-1.5 text-primary">
        <span
          aria-hidden
          className={`inline-block transition-transform ${pulse ? "scale-125" : "scale-100"}`}
        >
          ♥
        </span>
        <span className="tabular-nums text-sm">{count}</span>
      </span>
    </>
  );

  const shell =
    "flex w-full items-center justify-between rounded-lg border border-border bg-card p-4 text-left";

  if (!interactive) {
    return (
      <div
        className={`${shell} ${className}`}
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
      aria-label={label ? `Send a heart to ${label}` : "Send a heart"}
      className={`${shell} transition-colors hover:border-primary active:scale-[0.99] disabled:opacity-50 ${className}`}
    >
      {inner}
    </button>
  );
}
