import { Check, RotateCcw } from "lucide-react";

import { getStockLogo, money } from "../utils";

const capitalize = (text) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : "";

/**
 * Lobby stock selection.
 *
 * The host toggles stocks (editable); everyone else sees the host's
 * current choice read-only. Exactly `required` stocks must be selected
 * before the game can start.
 */
export default function StockPicker({
  stocks,
  selectedIds,
  required,
  editable,
  onToggle,
  onReset
}) {
  const selected = new Set(selectedIds);
  const count = selectedIds.length;
  const difference = required - count;

  const status =
    difference === 0
      ? { tone: "ready", text: "Ready to start" }
      : difference > 0
      ? { tone: "pending", text: `Select ${difference} more` }
      : { tone: "over", text: `Remove ${-difference}` };

  return (
    <div className="panel stock-picker-panel">
      <div className="stock-picker-heading">
        <div>
          <div className="panel-label">STOCKS IN THIS GAME</div>
          <h3>
            {editable
              ? `Choose exactly ${required} companies`
              : "The host is choosing the companies"}
          </h3>
        </div>

        <div className="stock-picker-meta">
          <span className={`stock-count stock-count-${status.tone}`}>
            <b>
              {count} / {required}
            </b>
            {status.text}
          </span>

          {editable && (
            <button
              type="button"
              className="secondary-button stock-reset"
              onClick={onReset}
            >
              <RotateCcw size={13} /> Default
            </button>
          )}
        </div>
      </div>

      <div className="stock-picker-grid" role="group" aria-label="Stocks">
        {stocks.map((stock) => {
          const isSelected = selected.has(stock.id);
          const Tag = editable ? "button" : "div";

          return (
            <Tag
              key={stock.id}
              {...(editable
                ? {
                    type: "button",
                    onClick: () => onToggle(stock.id),
                    "aria-pressed": isSelected
                  }
                : {})}
              className={`stock-option ${isSelected ? "selected" : ""} ${
                editable ? "editable" : ""
              }`}
            >
              <img
                className="stock-option-logo"
                src={getStockLogo(stock)}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.visibility = "hidden";
                }}
              />

              <span className="stock-option-text">
                <span className="stock-option-title">
                  {/* <b>{stock.ticker}</b> */}
                  {/* <span>{money(stock.basePrice)}</span> */}
                </span>
                {/* <span className="stock-option-name">{stock.name}</span> */}
                {/* <small>{capitalize(stock.profile)}</small> */}
              </span>

              {/* <span className="stock-option-check" aria-hidden="true">
                {isSelected && <Check size={13} strokeWidth={3} />}
              </span> */}
            </Tag>
          );
        })}
      </div>
    </div>
  );
}
