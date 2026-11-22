import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Crown,
  Play,
  Users,
  ArrowLeft
} from "lucide-react";

import { getPlayerId, getPlayerName, safeArray } from "../utils";
import GameRulesButton from "./GameRulesButton";
import PageBackdrop from "./PageBackdrop";
import StockPicker from "./StockPicker";

export default function Lobby({
  game,
  gameCode,
  playerId,
  isHost,
  busy,
  onStart,
  onSelectStocks,
  onBack
}) {
  const players = safeArray(game?.players);

  const [copied, setCopied] = useState(false);

  // ---- Stock selection ----------------------------------------------------
  // The server holds the selection (game.stocks). The host's clicks are
  // shown immediately (pendingIds) and cleared once the server confirms.

  const requiredStocks = game?.requiredStockCount || 7;
  const availableStocks = safeArray(game?.availableStocks);
  const serverStockIds = safeArray(game?.stocks).map((stock) => stock.id);
  const serverStockKey = serverStockIds.join(",");

  const [pendingIds, setPendingIds] = useState(null);
  const selectedStockIds = pendingIds ?? serverStockIds;
  const stocksReady = selectedStockIds.length === requiredStocks;

  useEffect(() => {
    if (pendingIds && pendingIds.join(",") === serverStockKey) {
      setPendingIds(null);
    }
  }, [serverStockKey, pendingIds]);

  function updateStockSelection(ids) {
    // Keep catalog order, matching what the server stores.
    const wanted = new Set(ids);
    const ordered = availableStocks
      .filter((stock) => wanted.has(stock.id))
      .map((stock) => stock.id);

    setPendingIds(ordered);
    onSelectStocks(ordered).catch(() => setPendingIds(null));
  }

  function toggleStock(stockId) {
    updateStockSelection(
      selectedStockIds.includes(stockId)
        ? selectedStockIds.filter((id) => id !== stockId)
        : [...selectedStockIds, stockId]
    );
  }

  function resetStocks() {
    updateStockSelection(
      availableStocks
        .filter((stock) => stock.selectedByDefault)
        .map((stock) => stock.id)
    );
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(gameCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
    {/* Outside .lobby-wrap: its entrance animation uses a transform. */}
    <PageBackdrop />

    <section className="lobby-wrap">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} /> Back to home
      </button>

      <div className="lobby-heading">
        {/* <div className="eyebrow">
          <span className="eyebrow-dot" />
          WAITING ROOM
        </div> */}

        <h1>
          Waiting Room
        </h1>

        <p className="muted">
          Share the game code and wait for everyone to join
        </p>

        <GameRulesButton className="rules-button-lobby" />
      </div>

      <div className="lobby-grid">
        <div className="panel invite-panel">
          <div className="panel-label">YOUR GAME CODE</div>

          <div className="room-code-large">
            {gameCode || "------"}
          </div>

          <button
            className={`secondary-button copy-button ${copied ? "copied" : ""}`}
            onClick={copyCode}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Copied!" : "Copy game code"}
          </button>
        </div>

        <div className="panel players-panel">
          <div className="panel-heading">
            <div>
              <div className="panel-label">PLAYERS IN ROOM</div>
              <h3>
                <Users size={18} /> {players.length}
                <span className="muted">
                  / {game?.maxPlayers || 7}
                </span>
              </h3>
            </div>

            <span className="waiting-tag">
              <i /> Waiting
            </span>
          </div>

          <div className="player-list">
            {players.map((player, index) => {
              const id = getPlayerId(player);

              return (
                <div
                  className="lobby-player"
                  key={id || index}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div
                    className="avatar"
                    style={{
                      background:
                        player.color ||
                        ["#7c6cf2", "#18a999", "#e5a84b", "#e06b8b"][
                          index % 4
                        ]
                    }}
                  >
                    {getPlayerName(player).slice(0, 1).toUpperCase()}
                  </div>

                  <div className="player-name">
                    {getPlayerName(player)}

                    {id === playerId && <small> (You)</small>}
                  </div>

                  {(player.isHost ||
                    id === game?.hostPlayerId ||
                    id === game?.hostId) && (
                    <span className="host-tag">
                      <Crown size={12} /> Host
                    </span>
                  )}

                  <span className="ready-dot" />
                </div>
              );
            })}
          </div>

          <div className="lobby-actions">
            {isHost ? (
              <button
                className="primary-button full-button"
                onClick={onStart}
                disabled={busy || players.length < 2 || !stocksReady}
              >
                {busy ? "Starting..." : "Start game"}
                <Play size={16} fill="currentColor" />
              </button>
            ) : (
              <p className="waiting-message">
                The host will start the game when everyone is ready.
              </p>
            )}

            {isHost && players.length < 2 && (
              <small className="hint">
                At least 2 players are required to start.
              </small>
            )}

            {isHost && !stocksReady && (
              <small className="hint">
                Select exactly {requiredStocks} stocks to start
                ({selectedStockIds.length} selected).
              </small>
            )}
          </div>
        </div>

        {availableStocks.length > 0 && (
          <StockPicker
            stocks={availableStocks}
            selectedIds={selectedStockIds}
            required={requiredStocks}
            editable={isHost}
            onToggle={toggleStock}
            onReset={resetStocks}
          />
        )}
      </div>
    </section>
    </>
  );
}