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
  onBack
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

  return (
    <section className="game-wrap">
      <div className="game-topline">
        <button className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Leave Game
        </button>

        <div className="game-status">
          <span className="round-chip">
            CYCLE {cycle}
          </span>

          <span className={`phase-chip ${isOpen ? "open" : ""}`}>
            <i />

            {isOpen
              ? "MARKET OPEN"
              : `ROUND ${actionRound} / 3`}
          </span>

          <div className="turn-banner">

            <div>
              <b>
                {isOpen
                  ? "CYCLE COMPLETE"
                  : isMyTurn
                  ? "Your turn"
                  : `${currentTurnName}'s turn`}
              </b>
            </div>

            {isMyTurn && (
              <span className="your-turn-pulse" />
            )}
          </div>

        </div>
      </div>

      <div className="game-heading">
        {/* <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            LIVE EXCHANGE · ROOM {gameCode}
          </div>

          <h1>
            Market <span>floor.</span>
          </h1>
        </div> */}

        {/* <div className="turn-banner">
          <div className="turn-icon">
            <Clock3 size={18} />
          </div>

          <div>
            <small>
              {isOpen
                ? "CYCLE COMPLETE"
                : isMyTurn
                ? "YOUR TURN"
                : "CURRENTLY TRADING"}
            </small>

            <b>
              {isOpen
                ? "Market has opened"
                : isMyTurn
                ? "Make your move"
                : `${currentTurnName} is trading`}
            </b>
          </div>

          {isMyTurn && (
            <span className="your-turn-pulse" />
          )}
        </div> */}
      </div>

      {/* Player financial summary */}

      <div className="stat-strip">
        <div className="stat-card">
          <span>
            <Wallet size={15} /> CASH BALANCE
          </span>

          <b>{money(me?.cash || 0)}</b>
        </div>

        <div className="stat-card">
          <span>
            <Coins size={15} /> LONG POSITIONS
          </span>

          <b>{money(totalLongValue)}</b>
        </div>

        <div className="stat-card">
          <span>
            <Trophy size={15} /> NET WORTH
          </span>

          <b>{money(myNetWorth)}</b>
        </div>

        {/* <div className="stat-card">
          <span>◎ PLAYERS</span>

          <b>
            {players.length}
            <small> / {game?.maxPlayers || 7}</small>
          </b>
        </div> */}
      </div>

      <div className="game-columns">
        <div className="market-column">
          {/* Market watch */}

          <div className="section-heading">
            <div>
              {/* <span className="section-kicker">
                THE EXCHANGE
              </span> */}

              <h2>
                Market watch
                <small>{activeStocks.length} stocks active</small>
              </h2>
            </div>

            {/* <span className="market-live">
              <i /> LIVE PRICES
            </span> */}
          </div>

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
                  PORTFOLIO OVERVIEW
                </div>

                {/* <h3>Position board</h3> */}
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

                {/* <h3>
                  <Hand size={17} />
                  Movement cards
                  <small>{hand.length} cards</small>
                </h3> */}
              </div>
            </div>

            {hand.length > 0 ? (
              <div className="hand-cards">
                {hand.map((card, index) => (
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

          {/* Turn order */}

          <div className="panel turn-order-panel">
            <div className="panel-heading">
              <div>
                <div className="panel-label">
                  TURN ORDER
                </div>

                {/* <h3>Turn order</h3> */}
              </div>

              <span className="turn-round">
                {isOpen ? "OPEN" : `ROUND ${actionRound}`}
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
                        <small> YOU</small>
                      )}
                    </span>

                    {playerIsCurrent && !isOpen && (
                      <span className="now-tag">NOW</span>
                    )}
                  </div>
                );
              })}
            </div>

            {isMyTurn && (
              <button
                className="pass-button"
                onClick={() => onAction("PASS")}
              >
                <Hand size={15} />
                Pass this turn
              </button>
            )}
          </div>

          {/* Trade ticket */}

          <TradePanel
            stock={selectedStock}
            position={myPosition}
            cash={me?.cash || 0}
            isMyTurn={isMyTurn}
            onAction={onAction}
            busy={busy}
          />

          {/* Leaderboard appears after open phase */}

          {isOpen && (
            <div className="panel open-panel">
              <div className="open-title">
                <div className="open-icon">
                  <Trophy size={18} />
                </div>

                <div>
                  <div className="panel-label">
                    OPEN PHASE COMPLETE
                  </div>

                  <h3>Leaderboard</h3>
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
          )}

          
        </aside>
      </div>
    </section>
  );
}