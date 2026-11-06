export const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(Number(value || 0));

// "+$1,234.00" / "-$1,234.00" / "$0.00"
export const signedMoney = (value) => {
  const number = Number(value || 0);
  const sign = number > 0 ? "+" : number < 0 ? "-" : "";

  return `${sign}${money(Math.abs(number))}`;
};

export const safeArray = (value) =>
  Array.isArray(value) ? value : [];

export const getPlayerId = (player) =>
  player?.id ?? player?.playerId ?? player?._id;

export const getPlayerName = (player) =>
  player?.name || player?.username || "Player";

export function getStockLogo(stock) {
  const key = `${stock?.ticker || ""} ${stock?.name || ""}`.toLowerCase();
  return `/logos/${stock?.ticker || "default"}.png`;
}

export function getCurrentPlayer(game, playerId) {
  return safeArray(game?.players).find(
    (player) => getPlayerId(player) === playerId
  );
}

export function getPlayerNetWorth(player, game) {
  const playerId = getPlayerId(player);

  let holdingsValue = 0;

  for (const stock of safeArray(game?.stocks)) {
    const position = game?.positionBoard?.[stock.id]?.[playerId];

    holdingsValue +=
      Number(position?.longShares || 0) *
      Number(stock.price || 0);
  }

  return Number(player?.cash || 0) + holdingsValue;
}

export function getStockChange(stock) {
  const history = safeArray(stock?.history);

  if (history.length < 2) return 0;

  const previousPrice = Number(
    history[history.length - 2]?.price || 0
  );

  return Number(stock.price || 0) - previousPrice;
}