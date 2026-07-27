export function TeamBadge({ letters, color, size = 34, image }: { letters: string; color: string; size?: number; image?: string }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        aria-hidden
        src={image}
        alt=""
        className="shrink-0 rounded object-cover"
        style={{ width: size, height: size, border: `1px solid ${color}` }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="shrink-0 rounded font-semibold italic"
      style={{
        width: size,
        height: size,
        background: color,
        color: "#F4EEE2",
        fontFamily: "var(--font-playfair), Georgia, serif",
        fontSize: Math.round(size * 0.42),
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
      }}
    >
      {letters}
    </span>
  );
}
