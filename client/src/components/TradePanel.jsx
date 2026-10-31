import { useMemo, useState } from "react";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Minus,
  Plus,
  TrendingDown,
  TrendingUp
} from "lucide-react";

import { money } from "../utils";

const ACTIONS = [
  { id: "BUY", label: "Buy", icon: TrendingUp },
  { id: "SELL", label: "Sell", icon: ArrowUpFromLine },
  { id: "SHORT", label: "Short", icon: TrendingDown },
  { id: "UNSHORT", label: "Cover", icon: ArrowDownToLine }
];

export default function TradePanel({
  stock,
  position,
  cash,
  isMyTurn,
  onAction,
  busy
}) {
  const [action, setAction] = useState("BUY");
  const [shares, setShares] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const maxShares = useMemo(() => {
    if (!stock || !position) return 0;

    if (action === "BUY" || action === "SHORT") {
      return stock.price > 0
        ? Math.max(0, Math.floor(Number(cash || 0) / stock.price))
        : 0;
    }

    if (action === "SELL") {
      return Number(position.longShares || 0);
    }

    if (action === "UNSHORT") {
      return Number(position.shortShares || 0);
    }

    return 0;
  }, [action, stock, position, cash]);

  const estimate = Number(stock?.price || 0) * shares;

  function selectAction(newAction) {
    setAction(newAction);
    setShares(1);
  }

  async function submit() {
    if (!isMyTurn) return;
    if (!stock?.isActive) return;
    if (shares < 1 || shares > maxShares) return;

    setSubmitting(true);

    try {
      await onAction(action, stock.id, shares);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel trade-panel">
      <div className="panel-heading">
        <div>
          <div className="panel-label">PLACE YOUR MOVE</div>
          {/* <h3>Trade ticket</h3> */}
        </div>

        <span className="price-mini">
          {money(stock?.price || 0)}
          <small> / share</small>
        </span>
      </div>

      <div className="action-grid">
        {ACTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`action-option ${id.toLowerCase()} ${
              action === id ? "active" : ""
            }`}
            onClick={() => selectAction(id)}
            disabled={!isMyTurn || !stock?.isActive}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <div className="quantity-row">
        <div>
          <label>QUANTITY</label>
          {/* <small>Whole shares only</small> */}
        </div>

        <div className="quantity-control">
          <button
            onClick={() =>
              setShares((value) => Math.max(1, value - 1))
            }
            disabled={!isMyTurn}
          >
            <Minus size={14} />
          </button>

          <input
            type="number"
            min="1"
            max={maxShares || 1}
            value={shares}
            onChange={(event) => {
              const value = Math.floor(
                Number(event.target.value) || 1
              );

              setShares(Math.max(1, value));
            }}
            disabled={!isMyTurn}
          />

          <button
            onClick={() =>
              setShares((value) =>
                Math.min(Math.max(1, maxShares), value + 1)
              )
            }
            disabled={!isMyTurn || shares >= maxShares}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="max-row">
        <span>Available for this action</span>

        <button
          onClick={() => setShares(Math.max(1, maxShares))}
          disabled={!isMyTurn || maxShares < 1}
        >
          MAX: {maxShares}
        </button>
      </div>

      <div className="trade-estimate">
        <span>
          {action === "BUY"
            ? "Estimated cost"
            : action === "SELL"
            ? "Estimated proceeds"
            : "Position value"}
        </span>

        <b>{money(estimate)}</b>
      </div>

      {action === "SHORT" && (
        <p className="trade-note">
          Short exposure cannot exceed your available cash.
          Short-sale proceeds are not added to your cash balance.
        </p>
      )}

      {action === "UNSHORT" && (
        <p className="trade-note">
          Covering reduces your short position. The remaining
          short position is settled during the market open.
        </p>
      )}

      <button
        className={`primary-button full-button trade-submit ${action.toLowerCase()}`}
        onClick={submit}
        disabled={
          !isMyTurn ||
          !stock?.isActive ||
          submitting ||
          busy ||
          maxShares < 1 ||
          shares > maxShares
        }
      >
        {submitting
          ? "Submitting..."
          : `${action === "UNSHORT" ? "Cover" : action} ${shares} share${
              shares === 1 ? "" : "s"
            }`}
      </button>

      {!isMyTurn && (
        <p className="turn-warning">It's not your turn yet.</p>
      )}

      {isMyTurn && maxShares === 0 && (
        <p className="turn-warning">
          No shares or buying power available for this action.
        </p>
      )}
    </div>
  );
}