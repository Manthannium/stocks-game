import { useEffect, useMemo, useState } from "react";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Ban,
  ChevronDown,
  Crown,
  Landmark,
  Medal,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Trophy,
  X
} from "lucide-react";

import {
  getStockLogo,
  money,
  safeArray,
  signedMoney
} from "../utils";

import Confetti from "./Confetti";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatShares = (value) =>
  Number(value || 0).toLocaleString("en-IN");

const toneOf = (value) =>
  value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

const signedPercent = (value) =>
  `${value > 0 ? "+" : ""}${Number(value || 0).toFixed(2)}%`;

function percentChange(oldPrice, newPrice) {
  const before = Number(oldPrice || 0);

  return before > 0
    ? ((Number(newPrice || 0) - before) / before) * 100
    : 0;
}

function stockStatus(result) {
  if (result.isClosed) {
    return { key: "closed", label: "CLOSED", Icon: Ban };
  }

  if (result.movement > 0) {
    return { key: "up", label: "UP", Icon: ArrowUpRight };
  }

  if (result.movement < 0) {
    return { key: "down", label: "DOWN", Icon: ArrowDownRight };
  }

  return { key: "flat", label: "UNCHANGED", Icon: Minus };
}

function Delta({ value, percent = null }) {
  return (
    <span className={`mo-delta ${toneOf(value)}`}>
      {signedMoney(value)}
      {percent != null && <small> ({signedPercent(percent)})</small>}
    </span>
  );
}

function RankChange({ before, after }) {
  const diff = Number(before || 0) - Number(after || 0);

  if (!before || !after || diff === 0) {
    return <span className="mo-rank-change flat">–</span>;
  }

  return (
    <span className={`mo-rank-change ${diff > 0 ? "up" : "down"}`}>
      {diff > 0 ? "▲" : "▼"}
      {Math.abs(diff)}
    </span>
  );
}

function Avatar({ name, color }) {
  return (
    <span
      className="avatar small-avatar"
      style={{ background: color || "#6558d3" }}
    >
      {String(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MarketOpenModal({
  game,
  playerId,
  isHost,
  busy,
  onNextCycle
}) {
  const lastOpen = game?.lastOpen || null;
  const phase = game?.phase;
  const isFinished = phase === "finished";

  // Only used for the final (finished) dialog, which can be closed.
  const [dismissedCycle, setDismissedCycle] = useState(null);

  const visible =
    Boolean(lastOpen) &&
    (phase === "betweenCycles" ||
      (isFinished && dismissedCycle !== lastOpen?.cycle));

  // Freeze the page behind the dialog.
  useEffect(() => {
    if (!visible) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [visible]);

  const data = useMemo(() => {
    if (!lastOpen) return null;

    const players = safeArray(game?.players);

    const playerById = Object.fromEntries(
      players.map((player) => [player.id, player])
    );

    const revealedHands = safeArray(lastOpen.revealedHands);

    // Stock rows (with revealed-card statistics).
    const stocks = safeArray(lastOpen.stockResults).map((result) => {
      const info = safeArray(game?.stocks).find(
        (stock) => stock.id === result.stockId
      );

      let count = 0;
      let up = 0;
      let down = 0;

      for (const hand of revealedHands) {
        for (const card of safeArray(hand.cards)) {
          if (card.stockId !== result.stockId) continue;

          count++;

          if (card.movement > 0) up += card.movement;
          else down += card.movement;
        }
      }

      return {
        ...result,
        name: info?.name || result.ticker,
        percent: percentChange(result.oldPrice, result.newPrice),
        status: stockStatus(result),
        cards: { count, up, down }
      };
    });

    // Player rows (only players still in the game).
    const results = safeArray(lastOpen.playerResults)
      .filter((result) => playerById[result.playerId])
      .map((result) => ({
        ...result,
        name: playerById[result.playerId].name,
        color: playerById[result.playerId].color || result.color
      }));

    const byChange = [...results].sort((a, b) => b.change - a.change);

    const byNetWorth = [...results].sort(
      (a, b) => b.netWorthAfter - a.netWorthAfter
    );

    const openStocks = stocks.filter((stock) => !stock.isClosed);

    const topGainer = openStocks.length
      ? openStocks.reduce((best, stock) =>
          stock.percent > best.percent ? stock : best
        )
      : null;

    const topLoser = stocks.length
      ? stocks.reduce((worst, stock) =>
          stock.percent < worst.percent ? stock : worst
        )
      : null;

    const hands = revealedHands
      .filter((hand) => playerById[hand.playerId])
      .map((hand) => ({
        ...hand,
        color: playerById[hand.playerId].color,
        cards: [...safeArray(hand.cards)].sort(
          (a, b) =>
            String(a.stockId).localeCompare(String(b.stockId)) ||
            a.movement - b.movement
        )
      }));

    return {
      stocks,
      byChange,
      byNetWorth,
      hands,
      topGainer: topGainer && topGainer.percent > 0 ? topGainer : null,
      topLoser: topLoser && topLoser.percent < 0 ? topLoser : null,
      bestTrader: byChange[0] && byChange[0].change > 0 ? byChange[0] : null,
      closed: stocks.filter((stock) => stock.isClosed),
      activeCount: openStocks.length,
      me: results.find((result) => result.playerId === playerId) || null
    };
  }, [game, lastOpen, playerId]);

  if (!visible || !data) return null;

  const {
    stocks,
    byChange,
    byNetWorth,
    hands,
    topGainer,
    topLoser,
    bestTrader,
    closed,
    activeCount,
    me
  } = data;

  return (
    <div className="mo-overlay" role="dialog" aria-modal="true">
      <div className="mo-dialog">
        {/* ---------------------------------------------------------------- */}
        {/* Header                                                           */}
        {/* ---------------------------------------------------------------- */}

        <div className="mo-header">
          <div className="open-icon">
            <Landmark size={18} />
          </div>

          <div className="mo-header-text">
            <div className="panel-label">
              {isFinished ? "FINAL RESULTS" : "MARKET OPENED"}
            </div>
            <h2>Cycle {lastOpen.cycle} results</h2>
          </div>

          <div className="mo-header-chips">
            <span className="turn-round">CYCLE {lastOpen.cycle}</span>
            <span className="turn-round">{activeCount} ACTIVE</span>
            {closed.length > 0 && (
              <span className="turn-round mo-chip-closed">
                {closed.length} CLOSED
              </span>
            )}
          </div>
        </div>

        <div className="mo-body">
          {/* -------------------------------------------------------------- */}
          {/* Highlights                                                     */}
          {/* -------------------------------------------------------------- */}

          <div className="mo-highlights">
            <div className="mo-tile">
              <span>
                <TrendingUp size={13} /> TOP GAINER
              </span>
              <b>{topGainer ? topGainer.ticker : "—"}</b>
              <small className="positive-text">
                {topGainer ? signedPercent(topGainer.percent) : "No stock rose"}
              </small>
            </div>

            <div className="mo-tile">
              <span>
                <TrendingDown size={13} /> TOP LOSER
              </span>
              <b>{topLoser ? topLoser.ticker : "—"}</b>
              <small className="negative-text">
                {topLoser ? signedPercent(topLoser.percent) : "No stock fell"}
              </small>
            </div>

            <div className="mo-tile">
              <span>
                <Trophy size={13} /> BEST TRADER
              </span>
              <b>{bestTrader ? bestTrader.name : "—"}</b>
              <small className="positive-text">
                {bestTrader ? signedMoney(bestTrader.change) : "Nobody gained"}
              </small>
            </div>

            <div className="mo-tile">
              <span>
                <Ban size={13} /> CLOSED
              </span>
              <b>
                {closed.length
                  ? closed.map((stock) => stock.ticker).join(", ")
                  : "None"}
              </b>
              <small>
                {closed.length
                  ? "Holdings wiped out"
                  : "All companies survived"}
              </small>
            </div>
          </div>

          {/* -------------------------------------------------------------- */}
          {/* Market movements                                               */}
          {/* -------------------------------------------------------------- */}

          <section>
            <div className="panel-label mo-section-title">
              MARKET MOVEMENTS
            </div>

            <div className="table-scroll mo-table-wrap">
              <table className="mo-table">
                <thead>
                  <tr>
                    <th>STOCK</th>
                    <th>OLD</th>
                    <th>MOVE</th>
                    <th>NEW</th>
                    <th>CHANGE</th>
                    <th>STATUS</th>
                    <th>CARDS (+ / −)</th>
                  </tr>
                </thead>

                <tbody>
                  {stocks.map((stock) => {
                    const { Icon } = stock.status;

                    return (
                      <tr
                        key={stock.stockId}
                        className={stock.isClosed ? "mo-row-closed" : ""}
                      >
                        <td>
                          <div className="mo-stock-cell">
                            <img src={getStockLogo(stock)} alt="" />
                            <span>
                              <b>{stock.ticker}</b>
                              <small>{stock.name}</small>
                            </span>
                          </div>
                        </td>

                        <td>{money(stock.oldPrice)}</td>

                        <td className={`${toneOf(stock.movement)}-text`}>
                          {stock.movement > 0 ? "+" : ""}
                          {Number(stock.movement).toFixed(1)}
                        </td>

                        <td>
                          {stock.isClosed ? (
                            <span className="negative-text">$0.00</span>
                          ) : (
                            money(stock.newPrice)
                          )}
                        </td>

                        <td className={`${toneOf(stock.percent)}-text`}>
                          {signedPercent(stock.percent)}
                        </td>

                        <td>
                          <span className={`mo-status ${stock.status.key}`}>
                            <Icon size={11} />
                            {stock.status.label}
                          </span>
                        </td>

                        <td>
                          {stock.cards.count}{" "}
                          <small className="mo-muted">
                            (<span className="positive-text">
                              +{stock.cards.up.toFixed(1)}
                            </span>{" "}
                            /{" "}
                            <span className="negative-text">
                              {stock.cards.down.toFixed(1)}
                            </span>
                            )
                          </small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* -------------------------------------------------------------- */}
          {/* Player performance                                             */}
          {/* -------------------------------------------------------------- */}

          <section>
            <div className="panel-label mo-section-title">
              PLAYER PERFORMANCE
            </div>

            <div className="table-scroll mo-table-wrap">
              <table className="mo-table">
                <thead>
                  <tr>
                    <th>PLAYER</th>
                    <th>NET WORTH BEFORE</th>
                    <th>HOLDINGS Δ</th>
                    <th>SHORTS P&amp;L</th>
                    <th>CHANGE</th>
                    <th>NET WORTH NOW</th>
                  </tr>
                </thead>

                <tbody>
                  {byChange.map((result) => (
                    <tr
                      key={result.playerId}
                      className={
                        result.playerId === playerId ? "mo-row-you" : ""
                      }
                    >
                      <td>
                        <div className="mo-player-cell">
                          <Avatar name={result.name} color={result.color} />
                          <span>
                            {result.name}
                            {result.playerId === playerId && (
                              <small> YOU</small>
                            )}
                          </span>
                        </div>
                      </td>

                      <td>{money(result.netWorthBefore)}</td>

                      <td>
                        <Delta value={result.longPnL} />
                      </td>

                      <td>
                        <Delta value={result.shortPnL} />
                      </td>

                      <td>
                        <Delta
                          value={result.change}
                          percent={result.changePercent}
                        />
                      </td>

                      <td>
                        <b>{money(result.netWorthAfter)}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* -------------------------------------------------------------- */}
          {/* Revealed hands                                                 */}
          {/* -------------------------------------------------------------- */}

          {hands.length > 0 && (
            <details className="mo-hands">
              <summary>
                <span className="panel-label">REVEALED HANDS</span>
                <ChevronDown size={15} className="mo-hands-chevron" />
              </summary>

              <div className="mo-hands-list">
                {hands.map((hand) => (
                  <div className="mo-hand-row" key={hand.playerId}>
                    <span className="mo-hand-player">
                      <Avatar name={hand.playerName} color={hand.color} />
                      {hand.playerName}
                    </span>

                    <span className="mo-hand-cards">
                      {hand.cards.map((card, index) => (
                        <span
                          key={card.cardId || index}
                          className={`mo-card-chip ${toneOf(card.movement)}`}
                        >
                          {card.ticker} {card.movement > 0 ? "+" : ""}
                          {Number(card.movement).toFixed(1)}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* -------------------------------------------------------------- */}
          {/* Leaderboard + Your result                                      */}
          {/* -------------------------------------------------------------- */}

          <div className="mo-bottom">
            <div className="mo-card">
              <div className="panel-label mo-section-title">
                LEADERBOARD (AFTER {lastOpen.cycle}{" "}
                {lastOpen.cycle === 1 ? "CYCLE" : "CYCLES"})
              </div>

              <div className="leaderboard-list">
                {byNetWorth.map((result, index) => (
                  <div
                    key={result.playerId}
                    className={`leader-row ${
                      result.playerId === playerId ? "you-row" : ""
                    }`}
                  >
                    <div className={`rank-medal rank-${index + 1}`}>
                      {index === 0 ? (
                        <Crown size={15} />
                      ) : index < 3 ? (
                        <Medal size={15} />
                      ) : (
                        index + 1
                      )}
                    </div>

                    <RankChange
                      before={result.rankBefore}
                      after={result.rankAfter}
                    />

                    <Avatar name={result.name} color={result.color} />

                    <div className="leader-name">
                      {result.name}
                      {result.playerId === playerId && <small>YOU</small>}
                    </div>

                    <b className="leader-worth">
                      {money(result.netWorthAfter)}
                    </b>
                  </div>
                ))}
              </div>
            </div>

            {me && (
              <div className="mo-card mo-you">
                <div className="panel-label mo-section-title">
                  YOUR RESULT
                </div>

                <div className="mo-you-headline">
                  <Delta value={me.change} percent={me.changePercent} />
                </div>

                <p className="mo-you-caption">
                  {me.change > 0
                    ? "Nice trading! Your portfolio grew this cycle."
                    : me.change < 0
                    ? "Tough cycle. The market moved against you."
                    : "You broke even this cycle."}{" "}
                  Rank #{me.rankAfter}
                  {me.rankBefore !== me.rankAfter &&
                    ` (was #${me.rankBefore})`}
                  .
                </p>

                <div className="mo-you-rows">
                  <div className="mo-you-row">
                    <span>Cash</span>
                    <span>
                      {money(me.cashBefore)} → <b>{money(me.cashAfter)}</b>
                    </span>
                    <Delta value={me.cashAfter - me.cashBefore} />
                  </div>

                  <div className="mo-you-row">
                    <span>Holdings</span>
                    <span>
                      {money(me.holdingsBefore)} →{" "}
                      <b>{money(me.holdingsAfter)}</b>
                    </span>
                    <Delta value={me.holdingsAfter - me.holdingsBefore} />
                  </div>

                  <div className="mo-you-row mo-you-total">
                    <span>Net worth</span>
                    <span>
                      {money(me.netWorthBefore)} →{" "}
                      <b>{money(me.netWorthAfter)}</b>
                    </span>
                    <Delta value={me.change} />
                  </div>
                </div>

                <div className="panel-label mo-section-title mo-breakdown-title">
                  POSITION BREAKDOWN
                </div>

                {safeArray(me.positions).length > 0 ? (
                  <ul className="mo-breakdown">
                    {me.positions.map((position) => (
                      <li key={position.stockId}>
                        <span className="mo-breakdown-stock">
                          {position.ticker}
                          {position.isClosed && <em>CLOSED</em>}
                        </span>

                        <span className="mo-breakdown-detail">
                          {position.longShares > 0 && (
                            <span>
                              Long {formatShares(position.longShares)} ·{" "}
                              <Delta value={position.longPnL} />
                            </span>
                          )}

                          {position.shortShares > 0 && (
                            <span>
                              Short {formatShares(position.shortShares)} ·{" "}
                              <Delta value={position.shortPnL} />
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mo-muted mo-empty">
                    You held no positions when the market opened.
                  </p>
                )}

                {me.closedLoss > 0 && (
                  <p className="trade-note mo-warning">
                    {money(me.closedLoss)} of your holdings were wiped out
                    by companies that closed.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Footer                                                           */}
        {/* ---------------------------------------------------------------- */}

        <div className="mo-footer">
          <div className="mo-footer-info">
            {isFinished ? (
              "The game has finished. These are the final standings."
            ) : isHost ? (
              "Next cycle: everyone receives the additional purse and a fresh hand. Long holdings carry forward."
            ) : (
              <span className="mo-waiting">
                <i /> Waiting for the host to start the next cycle…
              </span>
            )}
          </div>

          {isFinished ? (
            <button
              className="secondary-button"
              onClick={() => setDismissedCycle(lastOpen.cycle)}
            >
              <X size={14} /> Close
            </button>
          ) : (
            isHost && (
              <button
                className="primary-button"
                onClick={onNextCycle}
                disabled={busy}
              >
                <RefreshCw size={15} />
                {busy ? "Starting..." : "Start next cycle"}
                <ArrowRight size={15} />
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}