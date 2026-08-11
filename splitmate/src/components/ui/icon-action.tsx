import Link, { type LinkProps } from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentType,
  SVGProps,
} from "react";

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

interface IconActionBaseProps {
  icon: Icon;
  label: string;
  className?: string;
  dangerous?: boolean;
}

type IconButtonProps = IconActionBaseProps &
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "aria-label" | "children" | "className" | "type"
  >;

type IconLinkProps = IconActionBaseProps &
  LinkProps & {
    href: string;
  };

function actionClassName(dangerous: boolean, className: string) {
  return `group relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-soft transition-colors ${
    dangerous ? "hover:text-accent" : "hover:text-ink"
  } focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`;
}

function Tooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-[70] mt-2 w-max max-w-48 -translate-x-1/2 rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-surface opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {label}
    </span>
  );
}

export function IconButton({
  icon: Icon,
  label,
  className = "",
  dangerous = false,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={actionClassName(dangerous, className)}
      {...props}
    >
      <Icon aria-hidden="true" size={20} strokeWidth={2} />
      <Tooltip label={label} />
    </button>
  );
}

export function IconLink({
  icon: Icon,
  label,
  className = "",
  dangerous = false,
  ...props
}: IconLinkProps) {
  return (
    <Link
      aria-label={label}
      className={actionClassName(dangerous, className)}
      {...props}
    >
      <Icon aria-hidden="true" size={20} strokeWidth={2} />
      <Tooltip label={label} />
    </Link>
  );
}
