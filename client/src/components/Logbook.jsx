import { useEffect, useLayoutEffect, useRef, useState } from "react";

import CollapsiblePanel from "./CollapsiblePanel";
import { money, safeArray, signedMoney } from "../utils";

const TRADE_VERBS = {
  BUY: "bought",
  SELL: "sold",
  SHORT: "shorted",
  UNSHORT: "covered"
};

const formatShares = (value) =>
  Number(value || 0).toLocaleString("en-IN");

const formatTime = (timestamp) =>
  timestamp
    ? new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })
    : "";

function PlayerName({ entry, players }) {
  // Prefer the player's current color; fall back to the color at log time
  // (players who left are no longer in the list).
  const color =
    players.find((player) => player.id === entry.playerId)?.color ||
    entry.playerColor ||
    "#c5bbff";

  return (
    <b className="log-player" style={{ color }}>
      {entry.playerName || "Player"}
    </b>
  );
}

/**
 * Turns a structured server log entry into { tone, isTurn, body }.
 * tone   -> CSS modifier (log-buy, log-short, ...)
 * isTurn -> show "CYCLE x · ROUND y" instead of just the cycle
 */
function describeEntry(entry, players) {
  const name = <PlayerName entry={entry} players={players} />;

  switch (entry.type) {
    case "TRADE": {
      const verb =
        TRADE_VERBS[entry.action] ||
        String(entry.action || "").toLowerCase();

      const noun = Number(entry.shares) === 1 ? "share" : "shares";

      return {
        tone: String(entry.action || "").toLowerCase(),
        isTurn: true,
        body: (
          <>
            {name} {verb} {formatShares(entry.shares)}{" "}
            {entry.action === "UNSHORT" ? `shorted ${noun}` : noun} of{" "}
            <span className="log-ticker">{entry.ticker}</span> at{" "}
            {money(entry.price)}{" "}
            <span className="log-amount">({money(entry.value)})</span>
          </>
        )
      };
    }

    case "PASS":
      return {
        tone: "pass",
        isTurn: true,
        body: <>{name} passed their turn</>
      };

    case "GAME_STARTED":
      return {
        tone: "system",
        body: (
          <>
            Game started · turn order:{" "}
            {safeArray(entry.players).join(" → ")}
          </>
        )
      };

    case "CYCLE_STARTED":
      return {
        tone: "system",
        body: (
          <>
            Cycle {entry.cycle} started · every player received{" "}
            {money(entry.purse)} and a new hand
          </>
        )
      };

    case "MARKET_OPENED":
      return {
        tone: "market",
        body: (
          <>
            Market opened for cycle {entry.cycle}
            <span className="log-move-chips">
              {safeArray(entry.movements).map((move) => {
                const tone = move.isClosed
                  ? "closed"
                  : move.movement > 0
                  ? "positive"
                  : move.movement < 0
                  ? "negative"
                  : "neutral";

                return (
                  <span
                    key={move.stockId}
                    className={`log-move-chip ${tone}`}
                  >
                    {move.ticker}{" "}
                    {move.isClosed
                      ? "CLOSED"
                      : `${move.movement > 0 ? "+" : ""}${Number(
                          move.movement
                        ).toFixed(1)}`}
                  </span>
                );
              })}
            </span>
          </>
        )
      };

    case "STOCK_CLOSED":
      return {
        tone: "closed",
        body: (
          <>
            <span className="log-ticker">{entry.ticker}</span> closed:
            its price fell to $0. Long holdings in it are now worthless.
          </>
        )
      };

    case "CYCLE_RESULT": {
      const change = Number(entry.change || 0);

      return {
        tone: change > 0 ? "gain" : change < 0 ? "loss" : "pass",
        body: (
          <>
            {name}{" "}
            {change > 0 ? "gained" : change < 0 ? "lost" : "broke even"}
            {change !== 0 && (
              <>
                {" "}
                <span
                  className={
                    change > 0 ? "positive-text" : "negative-text"
                  }
                >
                  {signedMoney(change)}
                </span>
              </>
            )}{" "}
            this cycle · net worth {money(entry.netWorth)}
          </>
        )
      };
    }

    case "PLAYER_LEFT":
      return {
        tone: "closed",
        body: (
          <>
            {name} left the game
            {entry.newHostName
              ? ` · ${entry.newHostName} is now the host`
              : ""}
          </>
        )
      };

    case "GAME_FINISHED":
      return {
        tone: "system",
        body: (
          <>Game finished{entry.reason ? ` · ${entry.reason}` : ""}</>
        )
      };

    default:
      return {
        tone: "system",
        body: entry.message || entry.type
      };
  }
}

export default function Logbook({ entries, players }) {
  const log = safeArray(entries);
  const playerList = safeArray(players);

  const lastId = log.length ? log[log.length - 1].id : 0;

  const [expanded, setExpanded] = useState(true);
  const [seenId, setSeenId] = useState(lastId);

  const listRef = useRef(null);

  // True while the user is at (or near) the bottom of the list.
  const stickToBottom = useRef(true);

  // While expanded, everything is "seen".
  useEffect(() => {
    if (expanded) setSeenId(lastId);
  }, [expanded, lastId]);

  // Auto-scroll to the newest entry.
  useLayoutEffect(() => {
    const list = listRef.current;

    if (!expanded || !list || !stickToBottom.current) return;

    list.scrollTop = list.scrollHeight;
  }, [expanded, lastId]);

  function handleScroll() {
    const list = listRef.current;

    if (!list) return;

    stickToBottom.current =
      list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  }

  function toggle() {
    // Re-opening always jumps to the newest entry.
    if (!expanded) stickToBottom.current = true;

    setExpanded(!expanded);
  }

  const unread = expanded
    ? 0
    : log.filter((entry) => entry.id > seenId).length;

  return (
    <CollapsiblePanel
      className="logbook-panel"
      title="LOGBOOK"
      expanded={expanded}
      onToggle={toggle}
      headerRight={
        unread > 0 ? (
          <span className="log-unread">{unread} new</span>
        ) : (
          <span className="log-count">{log.length}</span>
        )
      }
    >
      {log.length === 0 ? (
        <div className="logbook-empty">
          No actions yet. Every trade will be recorded here.
        </div>
      ) : (
        <div
          className="logbook-list"
          ref={listRef}
          onScroll={handleScroll}
        >
          {log.map((entry) => {
            const { tone, isTurn, body } = describeEntry(
              entry,
              playerList
            );

            return (
              <div
                key={entry.id}
                className={`log-entry log-${tone}`}
              >
                <div className="log-meta">
                  <span>
                    {isTurn
                      ? `CYCLE ${entry.cycle} · ROUND ${entry.actionRound}`
                      : `CYCLE ${entry.cycle}`}
                  </span>

                  <span>{formatTime(entry.timestamp)}</span>
                </div>

                <div className="log-text">{body}</div>
              </div>
            );
          })}
        </div>
      )}
    </CollapsiblePanel>
  );
}