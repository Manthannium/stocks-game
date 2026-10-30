import { getStockLogo } from "../utils";

export default function Card({ card, index }) {
  const ticker =
    card?.ticker ||
    card?.stock?.ticker ||
    card?.stockId ||
    "—";

  const movement = Number(
    card?.movement ??
    card?.value ??
    card?.change ??
    0
  );

  const positive = movement > 0;

  return (
    <div
      className={`hand-card ${
        positive ? "card-positive" : "card-negative"
      }`}
    >
      <div className="hand-card-top">
        <img
          src={getStockLogo({
            ticker,
            name: card?.stock?.name
          })}
          alt=""
        />

        <span>{ticker}</span>
      </div>

      <div className="card-movement">
        {movement > 0 ? "+" : ""}
        {movement.toFixed(1)}
      </div>

      <div className="card-caption">PRICE MOVE</div>

      <div className="card-bottom">
        <span>
          {positive
            ? "BULLISH"
            : movement < 0
            ? "BEARISH"
            : "FLAT"}
        </span>

        <span>
          #{String(index + 1).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}