export const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(Number(value || 0));

export const safeArray = (value) =>
  Array.isArray(value) ? value : [];

export const getPlayerId = (player) =>
  player?.id ?? player?.playerId ?? player?._id;

export const getPlayerName = (player) =>
  player?.name || player?.username || "Player";

export function getStockLogo(stock) {
  const key = `${stock?.ticker || ""} ${stock?.name || ""}`.toLowerCase();

  if (key.includes("meta") || key.includes("facebook")) {
    return "/logos/meta.svg";
  }

  if (
    key.includes("google") ||
    key.includes("alphabet") ||
    key.includes("goog")
  ) {
    return "/logos/google.svg";
  }

  if (key.includes("nvidia") || key.includes("nvda")) {
    return "/logos/nvidia.svg";
  }

  if (key.includes("microsoft") || key.includes("msft")) {
    return "/logos/microsoft.svg";
  }

  if (key.includes("amazon") || key.includes("amzn")) {
    return "/logos/amazon.svg";
  }

  if (key.includes("apple") || key.includes("aapl")) {
    return "/logos/apple.svg";
  }

  if (key.includes("tesla") || key.includes("tsla")) {
    return "/logos/tesla.svg";
  }

  return "/logos/default.svg";
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