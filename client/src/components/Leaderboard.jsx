import { useLayoutEffect, useRef } from "react";
import { Crown, Medal } from "lucide-react";
import AnimatedMoney from "./AnimatedMoney";

import {
  getPlayerId,
  getPlayerName,
  getPlayerNetWorth,
  money,
  safeArray
} from "../utils";

export default function Leaderboard({ game, playerId }) {
  const players = safeArray(game?.players)
    .map((player) => ({
      ...player,
      calculatedNetWorth: getPlayerNetWorth(player, game)
    }))
    .sort(
      (a, b) =>
        b.calculatedNetWorth - a.calculatedNetWorth
    );

  const rowRefs = useRef(new Map());
  const lastTops = useRef(new Map());
  const orderKey = players.map(getPlayerId).join("|");

  useLayoutEffect(() => {
    rowRefs.current.forEach((el, id) => {
      const newTop = el.offsetTop;
      const oldTop = lastTops.current.get(id);

      if (oldTop != null && oldTop !== newTop && el.animate) {
        el.animate(
          [
            { transform: `translateY(${oldTop - newTop}px)` },
            { transform: "translateY(0)" }
          ],
          { duration: 500, easing: "cubic-bezier(.2,.8,.2,1)" }
        );
      }

      lastTops.current.set(id, newTop);
    });
  }, [orderKey]);

  return (
    <div className="leaderboard-list">
      {players.map((player, index) => (
        <div
          className={`leader-row ${
            getPlayerId(player) === playerId ? "you-row" : ""
          }`}
          key={getPlayerId(player) || index}
          ref={(el) => {
            const id = getPlayerId(player);
            if (el) rowRefs.current.set(id, el);
            else rowRefs.current.delete(id);
          }}
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

          <div
            className="avatar small-avatar"
            style={{ background: player.color || "#6558d3" }}
          >
            {getPlayerName(player).slice(0, 1).toUpperCase()}
          </div>

          <div className="leader-name">
            {getPlayerName(player)}

            {getPlayerId(player) === playerId && (
              <small>YOU</small>
            )}
          </div>

          <b className="leader-worth">
            <AnimatedMoney value={player.calculatedNetWorth} flash={false} />
          </b>
        </div>
      ))}
    </div>
  );
}