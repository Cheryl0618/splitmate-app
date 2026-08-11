export function Logo({
  size,
  className = "",
}: {
  size: number;
  className?: string;
}) {
  const compact = size < 28;
  const strokeWidth = compact ? 8 : 7;
  const barHeight = compact ? 7 : 6.5;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
    >
      <circle
        cx="28"
        cy="27"
        r="19"
        fill="none"
        stroke="#E8735A"
        strokeWidth={strokeWidth}
      />
      <g transform="rotate(-10 44 49)">
        <rect
          x="30"
          y="41"
          width="28"
          height={barHeight}
          rx="3.25"
          fill="#E8735A"
        />
        <rect
          x="30"
          y="51"
          width="28"
          height={barHeight}
          rx="3.25"
          fill="#F3AC9B"
        />
      </g>
    </svg>
  );
}
