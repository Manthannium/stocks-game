import { money } from "../utils";

/**
 * Numbers shown in the rules.
 * Keep in sync with:
 *   server/game.js    DEFAULT_SETTINGS (purse, additionalPurse, cardsInHand, actionRounds, maxPlayers, stockCount, totalSharesPerStock)
 *   server/config.js  LIMITS.autoPassTimeoutMs
 */
export const RULE_NUMBERS = {
  startingCash: 20000,
  additionalPurse: 10000,
  cardsInHand: 10,
  actionRounds: 3,
  maxPlayers: 7,
  stockCount: 7,
  sharesPerStock: 50000,
  autoPassSeconds: 60
};

const n = RULE_NUMBERS;

/**
 * Section shapes (all fields optional except title):
 *   items:   string[]                         bullet list
 *   terms:   { term: string, text: string }[] two-column table
 *   formula: string                           highlighted one-liner
 */
export const GAME_RULES = {
  intro: `Trade ${n.stockCount} stocks over several cycles. Finish with the highest net worth.`,

  sections: [
    {
      title: "Goal",
      items: ["Top the leaderboard."],
      formula: "Net worth = Cash + value of the shares you own"
    },
    {
      title: "Setup",
      items: [
        `2–${n.maxPlayers} players. Everyone starts with ${money(n.startingCash)}.`,
        `In the lobby, the host picks the ${n.stockCount} companies to trade.`,
        `Each player gets ${n.cardsInHand} secret movement cards, e.g. NVDA +2 or AMZN −1.`,
        "Your cards hint where prices will go. Other players hold the rest."
      ]
    },
    {
      title: "Your turn",
      items: [
        `Each cycle has ${n.actionRounds} rounds. On your turn, take one action:`
      ],
      terms: [
        {
          term: "Buy",
          text: `Pay cash for shares. Limited by your cash and the ${n.sharesPerStock.toLocaleString("en-IN")} shares per stock.`
        },
        { term: "Sell", text: "Sell shares you own at the current price." },
        {
          term: "Short",
          text: "Bet a price will fall. You pay nothing now, but your total short value can't exceed your cash."
        },
        { term: "Cover", text: "Close some or all of a short before the market opens." },
        { term: "Pass", text: "Skip your turn." }
      ]
    },
    {
      title: "Market open",
      items: [
        `After round ${n.actionRounds}, every card is revealed.`,
        "Each stock moves by the sum of its cards.",
        "Shorts settle automatically: shares × (old price − new price).",
        "Shares you own carry over to the next cycle. Shorts don't."
      ],
      formula: "New price = Old price + sum of its cards"
    },
    {
      title: "Company closes",
      items: [
        "If a price reaches $0 or below, the company closes.",
        "Its shares become worthless and its cards leave the game.",
        "Shorts on it pay out in full (the new price counts as $0)."
      ]
    },
    {
      title: "Next cycle",
      items: [
        "The host starts the next cycle.",
        `Everyone gets +${money(n.additionalPurse)} and a new hand of ${n.cardsInHand} cards.`
      ]
    },
    {
      title: "Good to know",
      items: [
        "Disconnected? Reopen the game in the same browser to rejoin.",
        `If you're offline on your turn for ${n.autoPassSeconds} seconds, your turn is passed.`,
        "If the host leaves, the next player becomes host.",
        "The game ends when every company has closed or fewer than 2 players remain."
      ]
    }
  ],

  footer: "Tip: the logbook shows every trade. Watch what others do."
};
