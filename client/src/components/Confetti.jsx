import { useMemo } from "react";

const COLORS = ["#35d48a", "#ae9bff", "#f3bd58", "#55d9ee", "#fb647c", "#ffffff"];

export default function Confetti({ count = 80 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        fall: 2.4 + Math.random() * 1.8,
        drift: (Math.random() - 0.5) * 200,
        color: COLORS[i % COLORS.length]
      })),
    [count]
  );

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            "--delay": `${p.delay}s`,
            "--fall": `${p.fall}s`,
            "--drift": `${p.drift}px`
          }}
        />
      ))}
    </div>
  );
}