import {
  getPlayerId,
  getPlayerName,
  money,
  safeArray
} from "../utils";

export default function PositionBoard({
  game,
  currentPlayerId
}) {
  const players = safeArray(game?.players);
  const stocks = safeArray(game?.stocks);
  const board = game?.positionBoard || {};

  return (
    <div className="table-scroll">
      <table className="position-table">
        <thead>
          <tr>
            <th>STOCK</th>

            {players.map((player, index) => (
              <th key={getPlayerId(player) || index}>
                {getPlayerName(player)}
                {getPlayerId(player) === currentPlayerId
                  ? " (YOU)"
                  : ""}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {stocks.map((stock) => (
            <tr key={stock.id}>
              <td>
                <div className="table-stock">
                  <span>{stock.ticker || stock.id}</span>
                  <small>{money(stock.price)}</small>
                </div>
              </td>

              {players.map((player, index) => {
                const position =
                  board?.[stock.id]?.[getPlayerId(player)] || {};

                const longShares = Number(
                  position.longShares || 0
                );

                const shortShares = Number(
                  position.shortShares || 0
                );

                return (
                  <td key={getPlayerId(player) || index}>
                    <div className="position-cell">
                      <span className="long-position">
                        L {longShares}
                      </span>

                      <span className="short-position">
                        S {shortShares}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}