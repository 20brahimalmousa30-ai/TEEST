export function TeamBadge({ letters, color, size = 34 }: { letters: string; color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded font-semibold italic"
      style={{
        width: size,
        height: size,
        background: color,
        color: "#F4EEE2",
        fontFamily: "var(--font-playfair), Georgia, serif",
        fontSize: Math.round(size * 0.42),
      }}
    >
      {letters}
    </span>
  );
}
