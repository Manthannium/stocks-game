import { useState } from "react";

import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Coins,
  Hand,
  RefreshCw,
  Trophy,
  Wallet,
  Eye,
  Building
} from "lucide-react";

import StockCard from "./StockCard";
import PositionBoard from "./PositionBoard";
import Card from "./Card";
import TradePanel from "./TradePanel";
import Leaderboard from "./Leaderboard";

import {
  getStockLogo,
  getCurrentPlayer,
  getPlayerId,
  getPlayerName,
  money,
  safeArray
} from "../utils";

export default function GameTable({
  game,
  gameCode,
  playerId,
  isHost,
  busy,
  onAction,
  onNextCycle,
  onBack,
  onLeave
}) {
  const stocks = safeArray(game?.stocks);
  const players = safeArray(game?.players);

  const me =
    getCurrentPlayer(game, playerId) ||
    game?.you ||
    {};

  const [selectedStockId, setSelectedStockId] = useState(
    stocks.find((stock) => stock.isActive)?.id ||
    stocks[0]?.id
  );

  const selectedStock =
    stocks.find((stock) => stock.id === selectedStockId) ||
    stocks.find((stock) => stock.isActive) ||
    stocks[0];

  const board = game?.positionBoard || {};

  const myPosition = selectedStock
    ? board?.[selectedStock.id]?.[playerId] || {}
    : {};

  const currentPlayer =
    players[Number(game?.currentPlayerIndex || 0)];

  const isMyTurn =
    game?.phase === "playing" &&
    getPlayerId(currentPlayer) === playerId;

  const isOpen =
    game?.phase === "betweenCycles" ||
    game?.phase === "finished";

  const hand = safeArray(
    game?.hand ||
    game?.myHand ||
    me?.hand
  );

  const activeStocks = stocks.filter(
    (stock) => stock.isActive
  );

  const totalLongValue = stocks.reduce(
    (sum, stock) => {
      const position =
        board?.[stock.id]?.[playerId] || {};

      return (
        sum +
        Number(position.longShares || 0) *
          Number(stock.price || 0)
      );
    },
    0
  );

  const myNetWorth =
    Number(me?.cash || 0) + totalLongValue;

  const cycle =
    game?.cycleNumber || game?.cycle || 1;

  const actionRound = game?.actionRound || 1;

  const history = safeArray(selectedStock?.history).slice(-12);

  const currentTurnName = currentPlayer
    ? getPlayerName(currentPlayer)
    : "Waiting";

  const sortedHand = [...(game?.hand || [])].sort((a, b) => {
    // First sort by stock ticket
    const stockA = String(a.stockId);
    const stockB = String(b.stockId);

    const stockComparison = stockA.localeCompare(stockB, undefined, {
      numeric: true,
    });

    if (stockComparison !== 0) {
      return stockComparison;
    }

    // Then sort by movement (ascending)
    return Number(a.movement) - Number(b.movement);
  });

  return (
    <section className="game-wrap">

      <div className="game-columns">

        {/* Market Stock cards */}

        <div className="market-column">
          <div className="stock-grid">
            {stocks.map((stock) => (
              <StockCard
                key={stock.id}
                stock={stock}
                selected={selectedStock?.id === stock.id}
                onClick={() => setSelectedStockId(stock.id)}
              />
            ))}
          </div>

          {/* Position board */}

          <div className="panel position-panel">
            <div className="panel-heading">
              <div>
                <div className="panel-label">
                  PORTFOLIO
                </div>
              </div>

              <span className="legend">
                <i className="legend-long" /> Long
                <i className="legend-short" /> Short
              </span>
            </div>

            <PositionBoard
              game={game}
              currentPlayerId={playerId}
            />
          </div>

          {/* Private cards */}

          <div className="panel hand-panel">
            <div className="panel-heading">
              <div>
                <div className="panel-label">
                  YOUR HAND
                </div>
              </div>
            </div>

            {hand.length > 0 ? (
              <div className="hand-cards">
                {sortedHand.map((card, index) => (
                  <Card
                    key={card.id || `${card.stockId}-${index}`}
                    card={card}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-hand">
                Your cards will appear here when the game is dealt.
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}

        <aside className="side-column">
          {/* {selectedStock && (
            <div className="selected-stock-panel">
              <div className="selected-stock-title">
                <img src={getStockLogo(selectedStock)} alt="" />

                <div>
                  <b>{selectedStock.name}</b>
                  <small>{selectedStock.ticker || selectedStock.id}</small>
                </div>

                <span className="selected-price">
                  {money(selectedStock.price)}
                </span>
              </div>

              <div className="mini-chart">
                {history.length > 1 ? (
                  history.map((point, index) => {
                    const prices = history.map((item) =>
                      Number(item.price || 0)
                    );

                    const min = Math.min(...prices);
                    const max = Math.max(...prices);

                    const height =
                      max === min
                        ? 50
                        : 12 +
                          ((Number(point.price) - min) /
                            (max - min)) *
                            76;

                    return (
                      <div
                        className="chart-bar-wrap"
                        key={index}
                      >
                        <div
                          className="chart-bar"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                    );
                  })
                ) : (
                  <div className="chart-empty">
                    Price history will appear after the first market open.
                  </div>
                )}
              </div>
            </div>
          )} */}

          {/* Turn order or Leaderboard (when market opens) */}

          {isOpen ? (
            <div className="panel open-panel">
              <div className="open-title">
                <div className="open-icon">
                  <Trophy size={18} />
                </div>

                <div>
                  <div className="panel-label">
                    LEADERBOARD (AFTER {cycle} CYCLES)
                  </div>
                </div>
              </div>

              <Leaderboard
                game={game}
                playerId={playerId}
              />

              {game?.phase !== "finished" && isHost && (
                <button
                  className="primary-button full-button"
                  onClick={onNextCycle}
                  disabled={busy}
                >
                  <RefreshCw size={15} />

                  {busy ? "Starting..." : "Start next cycle"}

                  <ArrowRight size={15} />
                </button>
              )}

              {game?.phase !== "finished" && !isHost && (
                <p className="waiting-message">
                  Waiting for the host to start the next cycle.
                </p>
              )}

              {game?.phase === "finished" && (
                <p className="waiting-message">
                  Game finished.
                </p>
              )}
            </div>
          ) : (
            <div className="panel turn-order-panel">
              <div className="panel-heading">
                <div>
                  <div className="panel-label">
                    TURN ORDER
                  </div>
                </div>

                <span className="turn-round">
                  {`CYCLE ${cycle}`}
                </span>

                <span className="turn-round">
                  {isOpen ? "OPEN" : `ROUND ${actionRound} / 3`}
                </span>
              </div>

              <div className="turn-order-list">
                {players.map((player, index) => {
                  const playerIsCurrent =
                    getPlayerId(player) ===
                    getPlayerId(currentPlayer);

                  return (
                    <div
                      className={`turn-order-item ${
                        playerIsCurrent && !isOpen
                          ? "active-turn"
                          : ""
                      }`}
                      key={getPlayerId(player) || index}
                    >
                      <span className="turn-number">
                        {index + 1}
                      </span>

                      <span className="turn-player">
                        {getPlayerName(player)}

                        {getPlayerId(player) === playerId && (
                          <small>(YOU)</small>
                        )}

                        {player.isOnline && (
                          <span
                            className="online-dot"
                            title="Online"
                          />
                        )}
                      </span>

                      {playerIsCurrent && !isOpen && (
                        <span className="now-tag">TURN</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* <button
                className="leave-game-button"
                onClick={onLeave}
                disabled={busy}
              >
                Leave Game
              </button> */}

              {isMyTurn && (
                <button
                  className="pass-button"
                  onClick={() => onAction("PASS")}
                >
                  <Hand size={15} />
                  <b>Pass turn</b>
                </button>
              )}
            </div>
          )}

          {/* Trade ticket */}

          <TradePanel
            stock={selectedStock}
            position={myPosition}
            cash={me?.cash || 0}
            isMyTurn={isMyTurn}
            onAction={onAction}
            busy={busy}
          />

          {/* Player financial summary */}

          <div className="stat-strip">
            <div className="stat-card">
              <span>
                <Wallet size={15} /> CASH BALANCE
              </span>

              <tt>{money(me?.cash || 0)}</tt>
            </div>

            <div className="stat-card">
              <span>
                <Coins size={15} /> LONG POSITIONS
              </span>

              <tt>{money(totalLongValue)}</tt>
            </div>

            <div className="stat-card">
              <span>
                <Trophy size={15} /> NET WORTH
              </span>

              <tt>{money(myNetWorth)}</tt>
            </div>
          </div>

          
        </aside>
      </div>
    </section>
  );
}