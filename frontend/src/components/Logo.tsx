// Inline (not a fetched asset) so it never hits the GitHub Pages base-path pitfall
// that bit index.html's favicon link — see App.tsx/vite.config.ts base handling.
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#111" />
      <circle cx="16" cy="12" r="5" fill="#fff" />
      <path d="M7 25.5C7 19.1 11 15 16 15C21 15 25 19.1 25 25.5Z" fill="#fff" />
      <circle cx="23" cy="23" r="6" fill="#fff" stroke="#111" strokeWidth="1.2" />
      <path
        d="M20.3 23l1.8 1.8 3.6-4"
        fill="none"
        stroke="#111"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
