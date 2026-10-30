import { useState } from "react";
import {
  Copy,
  Crown,
  Play,
  Users,
  ArrowLeft
} from "lucide-react";

import { getPlayerId, getPlayerName, safeArray } from "../utils";

export default function Lobby({
  game,
  gameCode,
  playerId,
  isHost,
  busy,
  onStart,
  onBack
}) {
  const players = safeArray(game?.players);

  const [copied, setCopied] = useState(false);

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
    <section className="lobby-wrap">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} /> Back to home
      </button>

      <div className="lobby-heading">
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          WAITING ROOM
        </div>

        <h1>
          Gather your <span>trading crew.</span>
        </h1>

        <p className="muted">
          Share the room code and wait for everyone to join.
        </p>
      </div>

      <div className="lobby-grid">
        <div className="panel invite-panel">
          <div className="panel-label">YOUR ROOM CODE</div>

          <div className="room-code-large">
            {gameCode || "------"}
          </div>

          <button
            className="secondary-button copy-button"
            onClick={copyCode}
          >
            <Copy size={15} />
            {copied ? "Copied!" : "Copy invite code"}
          </button>

          <div className="invite-divider" />

          <div className="invite-tip">
            <span>✦</span>
            <p>
              Send this code to your friends. They can join
              from the home screen.
            </p>
          </div>
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
                <div className="lobby-player" key={id || index}>
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
                disabled={busy || players.length < 2}
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
          </div>
        </div>
      </div>
    </section>
  );
}