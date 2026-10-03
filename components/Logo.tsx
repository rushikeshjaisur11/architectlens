// The architectlens mark: a lens ring with a small graph inside. Same artwork as app/icon.svg.
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden role="img">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#7c8cff" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#logo-g)" />
      <circle cx="29" cy="29" r="14" fill="none" stroke="#fff" strokeWidth="4" />
      <line x1="39.5" y1="39.5" x2="52" y2="52" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <path d="M23 29 L35 23 M23 29 L35 35" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="23" cy="29" r="3.2" fill="#f0b04a" />
      <circle cx="35" cy="23" r="3" fill="#fff" />
      <circle cx="35" cy="35" r="3" fill="#fff" />
    </svg>
  );
}
