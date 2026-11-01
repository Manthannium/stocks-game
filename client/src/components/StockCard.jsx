import {
  ArrowDownRight,
  ArrowUpRight,
  Minus
} from "lucide-react";

import {
  getStockLogo,
  money
} from "../utils";

// Keep this helper local if you prefer:
function getHistoryChange(stock) {
  const history = Array.isArray(stock?.history)
    ? stock.history
    : [];

  if (history.length < 2) return 0;

  return (
    Number(stock.price || 0) -
    Number(history[history.length - 2]?.price || 0)
  );
}

export default function StockCard({
  stock,
  selected,
  onClick
}) {
  	const change = getHistoryChange(stock);
  	const previousPrice = Number(stock?.price || 0) - change;
  	const percentage = previousPrice > 0 ? (change / previousPrice) * 100 : 0;
  	const isUp = change > 0;
  	const isDown = change < 0;

  	return (
		<button
		className={`stock-card ${
			selected ? "stock-selected" : ""
		} ${!stock.isActive ? "stock-closed" : ""}`}
		onClick={onClick}
		disabled={!stock.isActive}
		>
			<div className="stock-card-head">
				<img
				src={getStockLogo(stock)}
				alt=""
				className="stock-logo"
				/>

				<span
				className={`change-pill ${
					isUp ? "positive" : isDown ? "negative" : "neutral"
				}`}
				>
				{isUp ? (
					<ArrowUpRight size={13} />
				) : isDown ? (
					<ArrowDownRight size={13} />
				) : (
					<Minus size={12} />
				)}

				{stock?.history?.length > 1
					? `${Math.abs(percentage).toFixed(2)}%`
					: "—"}
				</span>
			</div>

			<div className="stock-title-row">
				<div className="stock-name">
					{stock.name || stock.ticker}
				</div>

				<div className="stock-ticker">
					{stock.ticker || stock.id}
				</div>
			</div>

			<div className="stock-title-row">
				<div className="stock-price">
					{money(stock.price)}
				</div>

				<div
					className={`stock-move ${
					isUp
						? "positive-text"
						: isDown
						? "negative-text"
						: ""
					}`}
				>
					{stock?.history?.length > 1
					? `${change > 0 ? "+" : ""}${money(change)}`
					: "--"}
				</div>
			</div>

			{/* Total shares available or Closed status */}
			{stock.isActive ? (
				<div className="stock-supply">
					<span className="stock-supply-label">Available</span>

					<span className="stock-supply-value">
						{Number(stock.sharesAvailable ?? 0).toLocaleString("en-IN")}
					</span>
				</div>
			) : (
				<span className="closed-stamp">CLOSED</span>
			)}
    	</button>
  );
}