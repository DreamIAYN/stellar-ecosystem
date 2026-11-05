export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <defs>
        <linearGradient id="brand-g" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#69e6ff" /><stop offset=".55" stopColor="#9b8cff" /><stop offset="1" stopColor="#ff7ac8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="rgba(255,255,255,.04)" />
      <circle cx="32" cy="32" r="17" stroke="url(#brand-g)" strokeWidth="3.2" />
      <ellipse cx="32" cy="32" rx="25" ry="9" stroke="url(#brand-g)" strokeWidth="1.6" opacity=".65" transform="rotate(-28 32 32)" />
      <circle cx="50" cy="20" r="2.6" fill="#f4fbff" />
    </svg>
  )
}
