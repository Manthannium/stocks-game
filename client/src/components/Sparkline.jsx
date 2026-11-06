import { safeArray } from "../utils";

export default function Sparkline({ history, points = 12 }) {
  const prices = safeArray(history)
    .slice(-points)
    .map((item) => Number(item?.price || 0));

  if (prices.length < 2) return null;

  const width = 100;
  const height = 24;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const step = width / (prices.length - 1);

  const coords = prices
    .map((price, i) => {
      const x = (i * step).toFixed(1);
      const y = (height - 2 - ((price - min) / range) * (height - 4)).toFixed(1);
      return `${x},${y}`;
    })
    .join(" ");

  const trend = prices[prices.length - 1] >= prices[0] ? "up" : "down";

  return (
    <svg
      className={`sparkline ${trend}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* key re-mounts the line so the draw animation replays on new data */}
      <polyline key={coords} points={coords} pathLength="1" />
    </svg>
  );
}