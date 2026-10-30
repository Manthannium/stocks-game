import { Crown, Medal } from "lucide-react";

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

  return (
    <div className="leaderboard-list">
      {players.map((player, index) => (
        <div
          className={`leader-row ${
            getPlayerId(player) === playerId ? "you-row" : ""
          }`}
          key={getPlayerId(player) || index}
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
            {money(player.calculatedNetWorth)}
          </b>
        </div>
      ))}
    </div>
  );
}