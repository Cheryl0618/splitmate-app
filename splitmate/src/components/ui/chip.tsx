import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";

interface ChipBaseProps {
  children: ReactNode;
  className?: string;
  pressed?: boolean;
  variant?: "default" | "clear";
}

type ChipButtonProps = ChipBaseProps &
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "aria-pressed" | "children" | "className" | "type"
  > & {
    as?: "button";
  };

type ChipLabelProps = ChipBaseProps &
  Omit<HTMLAttributes<HTMLSpanElement>, "children" | "className"> & {
    as: "span";
  };

export type ChipProps = ChipButtonProps | ChipLabelProps;

const baseClassName =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm leading-5 transition-[background-color,border-color] duration-150";

export function Chip(props: ChipProps) {
  const {
    as = "button",
    children,
    className = "",
    pressed = false,
    variant = "default",
    ...rest
  } = props;
  const visualClassName =
    variant === "clear"
      ? "border-transparent bg-transparent font-normal text-ink-soft hover:bg-transparent"
      : pressed
        ? "border-transparent bg-accent font-medium text-surface hover:bg-accent-hover"
        : `border-line bg-surface font-normal text-ink ${
            as === "button" ? "hover:border-ink" : ""
          }`;
  const classes = `${baseClassName} ${visualClassName} ${
    as === "button"
      ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      : ""
  } ${className}`;

  if (as === "span") {
    return (
      <span className={classes} {...(rest as HTMLAttributes<HTMLSpanElement>)}>
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      aria-pressed={variant === "default" ? pressed : undefined}
      {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
}
