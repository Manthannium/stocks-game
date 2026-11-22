/**
 * ============================================================================
 * STOCKS GAME LOGIC
 * ============================================================================
 *
 * Pure game rules and state transitions. No sockets, HTTP, or storage.
 * Rule violations throw GameError.
 *
 * Game flow:
 * 1. Create game and add players.
 * 2. Host starts the game.
 * 3. Each player gets a hand of private movement cards.
 * 4. Players take one action in each action round.
 * 5. Open phase reveals cards and updates stock prices.
 * 6. Short positions are settled and cleared.
 * 7. Long positions remain.
 * 8. Host starts the next cycle.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * JSDoc type definitions for the game state.
 * Used by editors for autocompletion; no runtime effect.
 *
 * @typedef {Object} Card
 * @property {string} cardId
 * @property {string} stockId
 * @property {string} ticker
 * @property {string} stockName
 * @property {number} movement
 *
 * @typedef {Object} PricePoint
 * @property {number} cycle
 * @property {number} price
 * @property {number} movement
 * @property {number} [calculatedPrice]
 * @property {boolean} [isClosed]
 *
 * @typedef {Object} Stock
 * @property {string} id
 * @property {string} ticker
 * @property {string} name
 * @property {number} price
 * @property {number} totalShares
 * @property {boolean} isActive
 * @property {PricePoint[]} history
 *
 * @typedef {Object} Player
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {number|null} turnOrder
 * @property {Card[]} cards
 * @property {number} cash
 * @property {boolean} isOnline
 * @property {string} [reconnectToken] Secret; never include in views.
 *
 * @typedef {Object} Position
 * @property {number} longShares
 * @property {number} shortShares
 *
 * @typedef {Object.<string, Object.<string, Position>>} PositionBoard
 *   positionBoard[stockId][playerId]
 *
 * @typedef {Object} GameSettings
 * @property {number} purse
 * @property {number} additionalPurse
 * @property {number} totalSharesPerStock
 * @property {number} cardsInHand
 * @property {number} maxPlayers
 * @property {number} actionRounds
 * @property {number} logbookMaxEntries
 *
 * @typedef {Object} Game
 * @property {string} id
 * @property {string|null} hostId
 * @property {number} maxPlayers
 * @property {GameSettings} settings
 * @property {string} phase           One of PHASE.
 * @property {number} cycle
 * @property {Stock[]} stocks
 * @property {Player[]} players
 * @property {PositionBoard} positionBoard
 * @property {Card[]} deck
 * @property {number} currentPlayerIndex
 * @property {number} actionRound
 * @property {Object|null} lastOpen
 * @property {Object[]} leaderboard
 * @property {number} createdAt
 * @property {number} lastActivityAt
 * @property {Object[]} log
 * @property {number} logSeq
 *
 * @typedef {Object} Progression
 * @property {boolean} cycleComplete
 * @property {number} [actionRound]
 * @property {string} [currentPlayerId]
 * @property {Object} [openResult]
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Shared enums for the game domain.
 * Values are part of the client protocol, so do not rename them.
 */

const PHASE = Object.freeze({
    WAITING: "waiting",
    PLAYING: "playing",
    BETWEEN_CYCLES: "betweenCycles",
    FINISHED: "finished",
});

const ACTION = Object.freeze({
    BUY: "BUY",
    SELL: "SELL",
    SHORT: "SHORT",
    UNSHORT: "UNSHORT",
    PASS: "PASS",
});

const TRADE_ACTIONS = Object.freeze([
    ACTION.BUY,
    ACTION.SELL,
    ACTION.SHORT,
    ACTION.UNSHORT,
]);

const LOG_TYPE = Object.freeze({
    GAME_STARTED: "GAME_STARTED",
    TRADE: "TRADE",
    PASS: "PASS",
    MARKET_OPENED: "MARKET_OPENED",
    STOCK_CLOSED: "STOCK_CLOSED",
    CYCLE_RESULT: "CYCLE_RESULT",
    CYCLE_STARTED: "CYCLE_STARTED",
    PLAYER_LEFT: "PLAYER_LEFT",
    GAME_FINISHED: "GAME_FINISHED",
});

// ============================================================================
// ERRORS
// ============================================================================

/**
 * Expected, user-facing rule violation ("Not your turn", "Insufficient cash").
 *
 * The socket layer converts these into { success: false, error, code }.
 * Any other thrown Error is treated as an unexpected server fault.
 */
class GameError extends Error {
    /**
     * @param {string} code    Stable machine-readable code, e.g. "NOT_YOUR_TURN".
     * @param {string} message Human-readable message shown to the player.
     */
    constructor(code, message) {
        super(message);
        this.name = "GameError";
        this.code = code;
    }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Stock catalog and movement-card distribution.
 *
 * Each stock owns its card frequencies: frequency[i] is the number of
 * cards with movement MOVEMENTS[i] for that stock.
 * Every stock is available to pick in the lobby. Stocks marked
 * `selectedByDefault: false` start unselected; the rest form the default selection.
 */

const MOVEMENTS = Object.freeze(
    [-3, -2.5, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5, 3]
);

const STOCK_DEFINITIONS = Object.freeze([
    {
        id: "A", ticker: "AMZN", name: "Amazon", basePrice: 2,
        profile: "small, stable",
        frequency: [0, 0, 0, 0, 2, 8, 8, 2, 0, 0, 0, 0],
    },
    {
        id: "B", ticker: "MSFT", name: "Microsoft", basePrice: 2.5,
        profile: "small, volatile",
        frequency: [0, 0, 4, 3, 2, 1, 1, 2, 3, 4, 0, 0],
    },
    {
        id: "C", ticker: "GOOG", name: "Google", basePrice: 3,
        profile: "medium, evenly spread",
        frequency: [1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1],
    },
    {
        id: "D", ticker: "AAPL", name: "Apple", basePrice: 4,
        profile: "medium, highly volatile",
        frequency: [3, 2, 2, 1, 1, 1, 1, 1, 1, 2, 2, 3],
    },
    {
        id: "E", ticker: "META", name: "Meta", basePrice: 5,
        profile: "medium, no fractional movements",
        frequency: [3, 0, 3, 0, 4, 0, 0, 4, 0, 3, 0, 3],
    },
    {
        id: "F", ticker: "PANW", name: "Palo Alto", basePrice: 6,
        profile: "medium, small movements",
        frequency: [0, 0, 0, 0, 5, 5, 5, 5, 0, 0, 0, 0],
    },
    {
        id: "G", ticker: "NVDA", name: "Nvidia", basePrice: 8,
        profile: "large, stable",
        frequency: [1, 1, 1, 2, 2, 3, 3, 2, 2, 1, 1, 1],
    },
    {
        id: "H", ticker: "TSLA", name: "Tesla", basePrice: 8,
        profile: "large, volatile", selectedByDefault: false,
        frequency: [4, 0, 4, 0, 2, 0, 0, 2, 0, 4, 0, 4],
    },
    {
        id: "I", ticker: "RBRK", name: "Rubrik", basePrice: 6,
        profile: "medium, small movements", selectedByDefault: false,
        frequency: [0, 0, 0, 0, 5, 5, 5, 5, 0, 0, 0, 0],
    },
    {
        id: "J", ticker: "SHEL", name: "Shell", basePrice: 3,
        profile: "medium, evenly spread", selectedByDefault: false,
        frequency: [1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1],
    },
    {
        id: "K", ticker: "ORCL", name: "Oracle", basePrice: 5,
        profile: "medium, no fractional movements", selectedByDefault: false,
        frequency: [3, 0, 3, 0, 4, 0, 0, 4, 0, 3, 0, 3],
    },
    {
        id: "L", ticker: "ANT", name: "Anthropic", basePrice: 2.5,
        profile: "small, volatile", selectedByDefault: false,
        frequency: [0, 0, 4, 3, 2, 1, 1, 2, 3, 4, 0, 0],
    },
]);

function getDefaultStockDefinitions() {
    return STOCK_DEFINITIONS.filter(stock => stock.selectedByDefault !== false);
}

function getStockDefinition(stockId) {
    return STOCK_DEFINITIONS.find(stock => stock.id === stockId);
}

/**
 * Default game rules. Copied onto every game as `game.settings`.
 */
const DEFAULT_SETTINGS = Object.freeze({
    purse: 20000,

    // Additional cash given to every player at the beginning
    // of each subsequent cycle.
    additionalPurse: 10000,

    totalSharesPerStock: 50000,
    cardsInHand: 10,
    maxPlayers: 7,

    // Exact number of stocks the host must select before starting.
    stockCount: 7,

    actionRounds: 3,
    logbookMaxEntries: 100,
});

const PLAYER_COLORS = Object.freeze([
    "#f1e508",
    "#e63946",
    "#0cd244",
    "#6ac6e7",
    "#ea9957",
    "#245607",
    "#aa51f3",
]);

/**
 * Fail fast at startup if the static configuration is inconsistent.
 */
function validateConfiguration() {
    const ids = new Set();

    for (const stock of STOCK_DEFINITIONS) {
        if (ids.has(stock.id)) {
            throw new Error(`Duplicate stock id ${stock.id}`);
        }

        ids.add(stock.id);

        if (stock.frequency.length !== MOVEMENTS.length) {
            throw new Error(
                `Invalid movement frequencies for ${stock.ticker}`
            );
        }

        if (
            stock.frequency.some(
                frequency =>
                    !Number.isInteger(frequency) || frequency < 0
            )
        ) {
            throw new Error(
                `Invalid frequency for stock ${stock.ticker}`
            );
        }
    }

    if (getDefaultStockDefinitions().length !== DEFAULT_SETTINGS.stockCount) {
        throw new Error(
            `Default stock selection must contain exactly ${DEFAULT_SETTINGS.stockCount} stocks`
        );
    }

    if (PLAYER_COLORS.length < DEFAULT_SETTINGS.maxPlayers) {
        throw new Error("Not enough player colors for maxPlayers");
    }
}

validateConfiguration();

// ============================================================================
// GENERAL HELPERS
// ============================================================================

function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Fisher-Yates shuffle.
 * Returns a new array without modifying the original.
 */
function shuffle(items) {
    const shuffled = [...items];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [shuffled[i], shuffled[j]] = [
            shuffled[j],
            shuffled[i],
        ];
    }

    return shuffled;
}

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Read-only lookups over the game state.
 */


function getPlayer(game, playerId) {
    return game.players.find(player => player.id === playerId);
}

function getStock(game, stockId) {
    return game.stocks.find(stock => stock.id === stockId);
}

function getActiveStock(game, stockId) {
    return game.stocks.find(
        stock => stock.id === stockId && stock.isActive
    );
}

function getActiveStocks(game) {
    return game.stocks.filter(stock => stock.isActive);
}

function getCurrentPlayer(game) {
    return game.players[game.currentPlayerIndex];
}

function getPosition(game, stockId, playerId) {
    return game.positionBoard?.[stockId]?.[playerId] ?? null;
}

function getNetPosition(position) {
    return position.longShares - position.shortShares;
}

/**
 * Shares of a stock currently held long by all players.
 */
function getTotalLongShares(game, stockId) {
    return game.players.reduce(
        (total, player) =>
            total + (getPosition(game, stockId, player.id)?.longShares || 0),
        0
    );
}

/**
 * Value of a player's open short positions at current prices.
 */
function getShortExposure(game, playerId) {
    return game.stocks.reduce((total, stock) => {
        if (!stock.isActive) return total;

        const position = getPosition(game, stock.id, playerId);

        return total + (position?.shortShares || 0) * stock.price;
    }, 0);
}

// ============================================================================
// GAME CREATION
// ============================================================================

/**
 * Build a new player record.
 *
 * @returns {Player}
 */
function createPlayer({ id, name, color, cash, reconnectToken }) {
    return {
        id,
        name: name.trim(),
        color,
        turnOrder: null,
        cards: [],
        cash,
        isOnline: true,
        reconnectToken,
    };
}

/**
 * Fresh per-game stock state from a catalog definition.
 */
function createStock(definition, settings) {
    return {
        id: definition.id,
        ticker: definition.ticker,
        name: definition.name,
        price: definition.basePrice,
        totalShares: settings.totalSharesPerStock,
        isActive: true,
        history: [
            {
                cycle: 0,
                price: definition.basePrice,
                movement: 0,
            },
        ],
    };
}

/**
 * Build a fresh game in the waiting phase with the host as its only player.
 *
 * @param {string} gameId
 * @param {{ id: string, name: string, reconnectToken?: string }} hostPlayer
 * @param {Partial<GameSettings>} [overrides]
 * @returns {Game}
 */
function createGame(gameId, hostPlayer, overrides = {}) {
    const settings = { ...DEFAULT_SETTINGS, ...overrides };
    const createdAt = Date.now();

    // Start with the default selection; the host can change it in the lobby.
    const stocks = getDefaultStockDefinitions().map(
        definition => createStock(definition, settings)
    );

    const host = createPlayer({
        ...hostPlayer,
        color: PLAYER_COLORS[0],
        cash: settings.purse,
    });

    return {
        id: gameId,
        hostId: host.id,
        maxPlayers: settings.maxPlayers,
        settings,
        phase: PHASE.WAITING,
        cycle: 0,
        stocks,
        players: [host],
        positionBoard: {},
        deck: [],
        currentPlayerIndex: 0,
        actionRound: 0,
        lastOpen: null,
        leaderboard: [],
        createdAt,
        lastActivityAt: createdAt,
        log: [],
        logSeq: 0,
    };
}

// ============================================================================
// LOGBOOK
// ============================================================================

/**
 * Game logbook: structured entries rendered by the client's Logbook panel.
 * Every entry shape lives here so the client contract is in one place.
 */


function addLogEntry(game, entry) {
    if (!Array.isArray(game.log)) {
        game.log = [];
    }

    game.logSeq = (game.logSeq || 0) + 1;

    game.log.push({
        id: game.logSeq,
        timestamp: Date.now(),
        cycle: game.cycle,
        actionRound: game.actionRound,
        ...entry,
    });

    if (game.log.length > game.settings.logbookMaxEntries) {
        game.log.shift();
    }
}

function playerFields(player) {
    return {
        playerId: player.id,
        playerName: player.name,
        playerColor: player.color,
    };
}

function logGameStarted(game) {
    addLogEntry(game, {
        type: LOG_TYPE.GAME_STARTED,
        players: game.players.map(player => player.name),
    });
}

function logPass(game, player, { auto = false } = {}) {
    addLogEntry(game, {
        type: LOG_TYPE.PASS,
        ...playerFields(player),
        ...(auto ? { auto: true } : {}),
    });
}

function logTrade(game, player, action, { stock, shares, tradeValue }) {
    addLogEntry(game, {
        type: LOG_TYPE.TRADE,
        action,
        ...playerFields(player),
        stockId: stock.id,
        ticker: stock.ticker,
        stockName: stock.name,
        shares,
        price: stock.price,
        value: tradeValue,
    });
}

function logPlayerLeft(game, player, newHost) {
    addLogEntry(game, {
        type: LOG_TYPE.PLAYER_LEFT,
        ...playerFields(player),
        newHostName: newHost?.name || null,
    });
}

function logGameFinished(game, reason) {
    addLogEntry(game, {
        type: LOG_TYPE.GAME_FINISHED,
        reason,
    });
}

function logCycleStarted(game) {
    addLogEntry(game, {
        type: LOG_TYPE.CYCLE_STARTED,
        purse: game.settings.additionalPurse,
    });
}

/**
 * Market summary, closures, and each player's cycle result.
 */
function logMarketOpened(game, stockResults, playerResults) {
    addLogEntry(game, {
        type: LOG_TYPE.MARKET_OPENED,
        movements: stockResults.map(result => ({
            stockId: result.stockId,
            ticker: result.ticker,
            oldPrice: result.oldPrice,
            movement: result.movement,
            newPrice: result.newPrice,
            isClosed: result.isClosed,
        })),
    });

    for (const result of stockResults) {
        if (!result.isClosed) continue;

        addLogEntry(game, {
            type: LOG_TYPE.STOCK_CLOSED,
            stockId: result.stockId,
            ticker: result.ticker,
            oldPrice: result.oldPrice,
            calculatedPrice: result.calculatedPrice,
        });
    }

    const byChange = [...playerResults].sort((a, b) => b.change - a.change);

    for (const result of byChange) {
        addLogEntry(game, {
            type: LOG_TYPE.CYCLE_RESULT,
            playerId: result.playerId,
            playerName: result.playerName,
            playerColor: result.color,
            change: result.change,
            netWorth: result.netWorthAfter,
        });
    }
}

// ============================================================================
// DECK
// ============================================================================

/**
 * Movement-card deck: generation, dealing and returning cards.
 */



/**
 * Generate a fresh, unshuffled deck for the given stocks.
 *
 * Only active stocks are included.
 * Every card gets a unique ID within the generated deck.
 *
 * @returns {Card[]}
 */
function generateDeck(stocks) {
    const deck = [];
    let cardNumber = 1;

    for (const stock of stocks) {
        if (stock.isActive === false) continue;

        const definition = getStockDefinition(stock.id);

        if (!definition) continue;

        MOVEMENTS.forEach((movement, movementIndex) => {
            const frequency = definition.frequency[movementIndex];

            for (let i = 0; i < frequency; i++) {
                deck.push({
                    cardId: `${stock.id}_${cardNumber++}`,
                    stockId: stock.id,
                    ticker: stock.ticker,
                    stockName: stock.name,
                    movement,
                });
            }
        });
    }

    return deck;
}

function getRequiredCards(game) {
    return game.players.length * game.settings.cardsInHand;
}

/**
 * Throws if the deck cannot give every player a full hand.
 */
function assertEnoughCards(game, context = "") {
    const requiredCards = getRequiredCards(game);

    if (game.deck.length < requiredCards) {
        throw new GameError(
            "NOT_ENOUGH_CARDS",
            `Not enough cards${context}. ` +
            `Required: ${requiredCards}, ` +
            `available: ${game.deck.length}`
        );
    }
}

/**
 * Deal a full hand to every player from the top of the deck.
 */
function dealCards(game) {
    assertEnoughCards(game);

    for (const player of game.players) {
        player.cards = game.deck.splice(0, game.settings.cardsInHand);
    }
}

/**
 * Put cards back into the deck and reshuffle.
 * Cards for closed companies are discarded.
 */
function returnCardsToDeck(game, cards) {
    game.deck = shuffle(
        [...game.deck, ...cards].filter(
            card => getStock(game, card.stockId)?.isActive === true
        )
    );
}

// ============================================================================
// POSITION BOARD
// ============================================================================

/**
 * Position board structure:
 *
 * positionBoard[stockId][playerId] = {
 *     longShares: 0,
 *     shortShares: 0
 * }
 */


function createPositionBoard(stocks, players) {
    const board = {};

    for (const stock of stocks) {
        board[stock.id] = {};

        for (const player of players) {
            board[stock.id][player.id] = {
                longShares: 0,
                shortShares: 0,
            };
        }
    }

    return board;
}

function removePlayerPositions(game, playerId) {
    for (const stockId of Object.keys(game.positionBoard || {})) {
        delete game.positionBoard[stockId][playerId];
    }
}

/**
 * Zero every position in companies that have closed.
 */
function clearClosedStockPositions(game) {
    for (const stock of game.stocks) {
        if (stock.isActive) continue;

        for (const player of game.players) {
            const position = getPosition(game, stock.id, player.id);

            if (!position) continue;

            position.longShares = 0;
            position.shortShares = 0;
        }
    }
}

// ============================================================================
// LEADERBOARD AND NET WORTH
// ============================================================================

/**
 * Net worth and leaderboard.
 *
 * Net worth = cash + long holdings at current prices.
 * Short positions are settled in cash at every open phase,
 * so they do not count towards holdings.
 */


/**
 * Unrounded value of a player's long holdings in active stocks.
 */
function calculateHoldingsValue(game, playerId) {
    let holdingsValue = 0;

    for (const stock of game.stocks) {
        if (!stock.isActive) continue;

        const position = getPosition(game, stock.id, playerId);

        if (position) {
            holdingsValue += position.longShares * stock.price;
        }
    }

    return holdingsValue;
}

function getPlayerNetWorth(game, playerId) {
    const player = getPlayer(game, playerId);

    if (!player) return 0;

    return roundMoney(player.cash + calculateHoldingsValue(game, playerId));
}

function getLeaderboard(game) {
    return game.players
        .map(player => {
            const holdingsValue = calculateHoldingsValue(game, player.id);

            return {
                playerId: player.id,
                name: player.name,
                color: player.color,

                cash: roundMoney(player.cash),
                holdingsValue: roundMoney(holdingsValue),

                netWorth: roundMoney(player.cash + holdingsValue),
            };
        })
        .sort((a, b) => b.netWorth - a.netWorth)
        .map((entry, index) => ({
            ...entry,
            rank: index + 1,
        }));
}

// ============================================================================
// TRADING
// ============================================================================

/**
 * BUY: pay cash for whole shares, limited by the stock's unowned supply.
 */
function executeBuy(game, { player, stock, position, shares, tradeValue }) {
    if (player.cash < tradeValue) {
        throw new GameError(
            "INSUFFICIENT_CASH",
            "Insufficient cash to buy these shares."
        );
    }

    const availableShares =
        stock.totalShares - getTotalLongShares(game, stock.id);

    if (shares > availableShares) {
        throw new GameError(
            "SHARES_UNAVAILABLE",
            `Only ${availableShares.toLocaleString()} shares are available.`
        );
    }

    player.cash = roundMoney(player.cash - tradeValue);
    position.longShares += shares;
}

/**
 * SELL: sell some or all shares bought.
 */
function executeSell(_game, { player, position, shares, tradeValue }) {
    if (position.longShares < shares) {
        throw new GameError(
            "NOT_ENOUGH_SHARES",
            "You do not own enough shares to sell."
        );
    }

    position.longShares -= shares;
    player.cash = roundMoney(player.cash + tradeValue);
}

/**
 * SHORT: open a short position.
 *
 * Short selling does not deduct or lock cash, and short-sale proceeds
 * are not added to cash. The total short exposure across all stocks
 * cannot exceed the player's current cash.
 */
function executeShort(game, { player, position, shares, tradeValue }) {
    const existingShortExposure = getShortExposure(game, player.id);
    const totalShortExposure = existingShortExposure + tradeValue;

    if (totalShortExposure > player.cash) {
        const remaining = Math.max(
            0,
            roundMoney(player.cash - existingShortExposure)
        );

        throw new GameError(
            "SHORT_LIMIT_EXCEEDED",
            `Total short exposure cannot exceed available cash. ` +
            `You can short up to $${remaining.toLocaleString()} more. `
        );
    }

    position.shortShares += shares;
}

/**
 * UNSHORT: remove some or all shares shorted.
 *
 * No immediate cash adjustment. The remaining short position
 * is settled during the open phase.
 */
function executeUnshort(_game, { position, shares }) {
    if (position.shortShares < shares) {
        throw new GameError(
            "NOT_ENOUGH_SHORTED",
            "You do not have enough shorted shares to unshort."
        );
    }

    position.shortShares -= shares;
}

/**
 * One handler per trade action.
 * Each receives (game, tradeContext) and mutates cash/positions or throws.
 */
const TRADE_HANDLERS = Object.freeze({
    [ACTION.BUY]: executeBuy,
    [ACTION.SELL]: executeSell,
    [ACTION.SHORT]: executeShort,
    [ACTION.UNSHORT]: executeUnshort,
});

/**
 * Validate the trade target and build the context shared by all handlers.
 */
function buildTradeContext(game, player, stockId, shares) {
    if (!Number.isInteger(shares) || shares <= 0) {
        throw new GameError(
            "INVALID_SHARES",
            "Shares must be a positive whole number."
        );
    }

    const stock = getActiveStock(game, stockId);

    if (!stock) {
        throw new GameError(
            "STOCK_UNAVAILABLE",
            "Stock does not exist or is no longer active."
        );
    }

    const position = getPosition(game, stockId, player.id);

    if (!position) {
        throw new GameError(
            "POSITION_NOT_FOUND",
            "Position not found for this player and stock."
        );
    }

    return {
        player,
        stock,
        position,
        shares,
        tradeValue: roundMoney(shares * stock.price),
    };
}

// ============================================================================
// TURNS
// ============================================================================

/**
 * Turn validation, action dispatch and turn progression.
 */



/**
 * Throws unless the game is in play and it is this player's turn.
 *
 * @returns {Player} the current player
 */
function assertPlayersTurn(game, playerId) {
    if (game.phase !== PHASE.PLAYING) {
        throw new GameError(
            "NOT_PLAYING",
            "Game is not currently in the playing phase."
        );
    }

    const currentPlayer = getCurrentPlayer(game);

    if (!currentPlayer || currentPlayer.id !== playerId) {
        throw new GameError("NOT_YOUR_TURN", "It is not your turn.");
    }

    return currentPlayer;
}

function normalizeAction(action) {
    const normalized = String(action).toUpperCase();

    if (normalized !== ACTION.PASS && !TRADE_ACTIONS.includes(normalized)) {
        throw new GameError(
            "INVALID_ACTION",
            "Invalid action. Use BUY, SELL, SHORT, UNSHORT, or PASS."
        );
    }

    return normalized;
}

/**
 * Execute one action for the current player, then advance the turn.
 *
 * Every player gets one action per action round.
 *
 * @param {Game} game
 * @param {string} playerId
 * @param {{ action: string, stockId?: string|null, shares?: number, auto?: boolean }} turn
 *   `auto` marks a PASS made by the server for an offline player.
 */
function takeTurn(game, playerId, { action, stockId = null, shares = 0, auto = false }) {
    const player = assertPlayersTurn(game, playerId);
    const normalizedAction = normalizeAction(action);

    // The round in which this action was taken, before the turn advances.
    const executedAt = {
        cycle: game.cycle,
        actionRound: game.actionRound,
    };

    if (normalizedAction === ACTION.PASS) {
        logPass(game, player, { auto });

        return {
            action: ACTION.PASS,
            ...(auto ? { auto: true } : {}),
            ...executedAt,
            progression: advanceTurn(game),
        };
    }

    const trade = buildTradeContext(game, player, stockId, shares);

    TRADE_HANDLERS[normalizedAction](game, trade);
    logTrade(game, player, normalizedAction, trade);

    return {
        action: normalizedAction,
        stockId,
        shares,
        tradeValue: trade.tradeValue,
        ...executedAt,
        progression: advanceTurn(game),
    };
}

function passTurn(game, playerId, { auto = false } = {}) {
    return takeTurn(game, playerId, { action: ACTION.PASS, auto });
}

/**
 * Move to the next player.
 *
 * After the last player:
 * - Start the next action round, if not all rounds have completed.
 * - Otherwise, resolve the open phase.
 *
 * @returns {Progression}
 */
function advanceTurn(game) {
    const isLastPlayer =
        game.currentPlayerIndex === game.players.length - 1;

    if (!isLastPlayer) {
        game.currentPlayerIndex++;

        return {
            cycleComplete: false,
            actionRound: game.actionRound,
            currentPlayerId: getCurrentPlayer(game).id,
        };
    }

    // All players have acted in this round.
    if (game.actionRound < game.settings.actionRounds) {
        game.actionRound++;
        game.currentPlayerIndex = 0;

        return {
            cycleComplete: false,
            actionRound: game.actionRound,
            currentPlayerId: getCurrentPlayer(game).id,
        };
    }

    // Final action round has completed.
    return {
        cycleComplete: true,
        openResult: resolveOpenPhase(game),
    };
}

/**
 * Fix the turn pointer after the player at `removedIndex` left mid-cycle.
 *
 * @returns {Progression|null} progression if the turn moved, otherwise null
 */
function adjustTurnAfterRemoval(game, removedIndex) {
    if (removedIndex < game.currentPlayerIndex) {
        // A player who already acted was removed.
        // The current player's index shifts left.
        game.currentPlayerIndex--;
        return null;
    }

    if (removedIndex > game.currentPlayerIndex) {
        return null;
    }

    // The player whose turn it was has left.
    if (game.currentPlayerIndex >= game.players.length) {
        // The departing player was last in the turn order.
        // Complete this round and advance normally.
        game.currentPlayerIndex = game.players.length - 1;
        return advanceTurn(game);
    }

    // The next player now occupies the same index.
    return {
        cycleComplete: false,
        actionRound: game.actionRound,
        currentPlayerId: getCurrentPlayer(game).id,
    };
}

// ============================================================================
// LIFECYCLE
// ============================================================================

/**
 * Game lifecycle: waiting → playing ⇄ betweenCycles → finished.
 */


/**
 * Replace the lobby's stock selection (waiting phase only).
 *
 * Any subset of the catalog is accepted so the host can swap stocks
 * freely; startGame() enforces the exact count.
 */
function selectStocks(game, stockIds) {
    if (game.phase !== PHASE.WAITING) {
        throw new GameError("ALREADY_STARTED", "Game has already started");
    }

    if (!Array.isArray(stockIds)) {
        throw new GameError("INVALID_STOCKS", "Stock selection must be a list");
    }

    const selected = new Set(stockIds);

    if (selected.size !== stockIds.length) {
        throw new GameError("INVALID_STOCKS", "Each stock can only be selected once");
    }

    const unknown = stockIds.find(stockId => !getStockDefinition(stockId));

    if (unknown !== undefined) {
        throw new GameError("INVALID_STOCKS", `Unknown stock: ${unknown}`);
    }

    // Keep catalog order so the board layout is stable.
    game.stocks = STOCK_DEFINITIONS
        .filter(definition => selected.has(definition.id))
        .map(definition => createStock(definition, game.settings));

    return {
        stockIds: game.stocks.map(stock => stock.id),
    };
}

/**
 * Shuffle turn order, assign colors, build the position board and deal.
 */
function startGame(game) {
    if (game.phase !== PHASE.WAITING) {
        throw new GameError("ALREADY_STARTED", "Game has already started");
    }

    if (game.players.length < 2) {
        throw new GameError("NOT_ENOUGH_PLAYERS", "Need at least 2 players");
    }

    if (game.stocks.length !== game.settings.stockCount) {
        throw new GameError(
            "INVALID_STOCK_SELECTION",
            `Select exactly ${game.settings.stockCount} stocks to start ` +
            `(${game.stocks.length} selected)`
        );
    }

    const freshDeck = generateDeck(game.stocks);

    if (freshDeck.length < getRequiredCards(game)) {
        throw new GameError(
            "NOT_ENOUGH_CARDS",
            "Not enough cards for all players"
        );
    }

    // Randomize player order and colors.
    game.players = shuffle(game.players);

    const totalColors = PLAYER_COLORS.length;
    const colorOffset = Math.floor(Math.random() * totalColors);

    game.players.forEach((player, index) => {
        player.turnOrder = index + 1;
        player.color = PLAYER_COLORS[(index + colorOffset) % totalColors];
    });

    game.positionBoard = createPositionBoard(game.stocks, game.players);

    game.deck = shuffle(freshDeck);
    dealCards(game);

    game.cycle = 1;
    game.phase = PHASE.PLAYING;

    game.currentPlayerIndex = 0;
    game.actionRound = 1;

    game.lastOpen = null;
    game.leaderboard = [];

    game.log = [];
    logGameStarted(game);

    return {
        cycle: game.cycle,
        actionRound: game.actionRound,

        turnOrder: game.players.map(player => ({
            id: player.id,
            name: player.name,
            color: player.color,
            turnOrder: player.turnOrder,
        })),
    };
}

/**
 * Start another cycle.
 *
 * - Long holdings remain.
 * - Short positions have already been settled and cleared.
 * - Every player receives the additional purse.
 * - Active-stock cards are dealt again.
 * - If every company has closed, the game finishes instead.
 */
function startNextCycle(game) {
    if (game.phase !== PHASE.BETWEEN_CYCLES) {
        throw new GameError(
            "CYCLE_NOT_FINISHED",
            "The current cycle has not finished"
        );
    }

    if (getActiveStocks(game).length === 0) {
        finishGame(game, "All companies have closed");

        return {
            finished: true,
            reason: "All companies have closed",
            leaderboard: game.leaderboard,
        };
    }

    assertEnoughCards(game, " for next cycle");

    for (const player of game.players) {
        player.cash = roundMoney(player.cash + game.settings.additionalPurse);
    }

    dealCards(game);

    game.cycle++;
    game.phase = PHASE.PLAYING;

    game.currentPlayerIndex = 0;
    game.actionRound = 1;

    game.lastOpen = null;

    logCycleStarted(game);

    return {
        finished: false,
        cycle: game.cycle,
        actionRound: game.actionRound,
        currentPlayerId: getCurrentPlayer(game).id,
    };
}

/**
 * Called after the open phase. Revealed cards stay in hands until
 * the next deal, so everyone can inspect them between cycles.
 */
function enterBetweenCycles(game) {
    game.phase = PHASE.BETWEEN_CYCLES;
    game.currentPlayerIndex = 0;
    game.actionRound = 0;
}

function finishGame(game, reason) {
    game.phase = PHASE.FINISHED;
    game.currentPlayerIndex = 0;
    game.actionRound = 0;
    game.leaderboard = getLeaderboard(game);

    logGameFinished(game, reason);
}

function isInProgress(game) {
    return game.phase !== PHASE.WAITING && game.phase !== PHASE.FINISHED;
}

// ============================================================================
// PLAYER MANAGEMENT
// ============================================================================

/**
 * Joining, leaving and presence.
 */


/**
 * First color not used by a current player.
 * Avoids duplicates when someone leaves the lobby and another joins.
 */
function nextFreeColor(game) {
    const used = new Set(game.players.map(player => player.color));

    return PLAYER_COLORS.find(color => !used.has(color)) ?? PLAYER_COLORS[0];
}

/**
 * @param {Game} game
 * @param {{ id: string, name: string, reconnectToken?: string }} player
 */
function addPlayer(game, player) {
    if (game.phase !== PHASE.WAITING) {
        throw new GameError("ALREADY_STARTED", "Game has already started");
    }

    if (game.players.length >= game.maxPlayers) {
        throw new GameError("GAME_FULL", "Game is full");
    }

    if (!player.name?.trim()) {
        throw new GameError("NAME_REQUIRED", "Player name is required");
    }

    const created = createPlayer({
        ...player,
        color: nextFreeColor(game),
        cash: game.settings.purse,
    });

    game.players.push(created);

    return created;
}

function setPlayerOnline(game, playerId, isOnline) {
    const player = getPlayer(game, playerId);

    if (player) {
        player.isOnline = isOnline;
    }

    return player ?? null;
}

/**
 * Splice the player out of the turn order.
 * During active play their cards go back into the deck.
 * Between cycles the cards are already back in the deck after
 * the open phase, so they are not added again.
 */
function detachPlayer(game, removedIndex) {
    const [removedPlayer] = game.players.splice(removedIndex, 1);

    if (game.phase === PHASE.PLAYING) {
        returnCardsToDeck(game, removedPlayer.cards || []);
    }

    removedPlayer.cards = [];

    return removedPlayer;
}

/**
 * @returns {Player|null} the new host, if the host changed
 */
function reassignHostIfNeeded(game, departedPlayerId) {
    if (game.hostId !== departedPlayerId) return null;

    const newHost = game.players[0] ?? null;
    game.hostId = newHost?.id || null;

    return newHost;
}

function reindexTurnOrder(game) {
    game.players.forEach((player, index) => {
        player.turnOrder = index + 1;
    });
}

/**
 * Permanently remove a player and their assets.
 */
function removePlayer(game, playerId) {
    const removedIndex = game.players.findIndex(
        player => player.id === playerId
    );

    if (removedIndex === -1) {
        throw new GameError("PLAYER_NOT_FOUND", "Player not found");
    }

    const removedPlayer = detachPlayer(game, removedIndex);

    removePlayerPositions(game, playerId);

    game.leaderboard = game.leaderboard.filter(
        entry => entry.playerId !== playerId
    );

    const newHost = reassignHostIfNeeded(game, playerId);

    if (game.phase !== PHASE.WAITING) {
        logPlayerLeft(game, removedPlayer, newHost);
    }

    reindexTurnOrder(game);

    let progression = null;

    if (isInProgress(game) && game.players.length < 2) {
        finishGame(game, "Not enough players remaining");
    } else if (game.phase === PHASE.PLAYING) {
        progression = adjustTurnAfterRemoval(game, removedIndex);
    } else {
        game.currentPlayerIndex = 0;
    }

    return {
        playerId,
        playerName: removedPlayer.name,
        hostId: game.hostId,
        hostChanged: Boolean(newHost),
        newHostName: newHost?.name ?? null,
        playerCount: game.players.length,
        gameEmpty: game.players.length === 0,
        gameFinished: game.phase === PHASE.FINISHED,
        progression,
    };
}

// ============================================================================
// OPEN PHASE
// ============================================================================

/**
 * Open phase: resolve the market after every player has used
 * all their action rounds.
 *
 * Each step is a small function so new market mechanics
 * (events, special cards, IPOs) can be inserted as extra steps.
 */


/**
 * @returns {Object} the open result, also stored as game.lastOpen
 */
function resolveOpenPhase(game) {
    if (game.phase !== PHASE.PLAYING) {
        throw new GameError("NOT_PLAYING", "Cannot open market right now");
    }

    const revealedHands = revealHands(game);
    const snapshot = takeFinancialSnapshot(game);
    const rankBefore = rankPlayers(game, snapshot);

    const movements = aggregateMovements(game);
    const stockResults = applyPriceMovements(game, movements);
    const shortSettlements = settleShorts(game, snapshot.prices);

    clearClosedStockPositions(game);

    game.leaderboard = getLeaderboard(game);

    const playerResults = buildPlayerResults(
        game,
        snapshot,
        rankBefore,
        stockResults
    );

    returnCardsToDeck(game, game.players.flatMap(player => player.cards));

    game.lastOpen = {
        cycle: game.cycle,

        revealedHands,
        stockResults,
        shortSettlements,
        playerResults,

        closedStocks: stockResults
            .filter(result => result.isClosed)
            .map(result => result.stockId),

        leaderboard: game.leaderboard,
    };

    logMarketOpened(game, stockResults, playerResults);

    enterBetweenCycles(game);

    return { ...game.lastOpen };
}

/**
 * Capture prices and every player's finances before the market moves.
 *
 * @returns {{
 *   prices: Object.<string, number>,
 *   players: Object.<string, { cash: number, holdingsValue: number, netWorth: number,
 *     positions: { stockId: string, longShares: number, shortShares: number }[] }>
 * }}
 */
function takeFinancialSnapshot(game) {
    const prices = {};

    for (const stock of game.stocks) {
        if (stock.isActive) prices[stock.id] = stock.price;
    }

    const players = {};

    for (const player of game.players) {
        const holdingsValue = calculateHoldingsValue(game, player.id);
        const positions = [];

        for (const stockId of Object.keys(prices)) {
            const position = getPosition(game, stockId, player.id);
            const longShares = position?.longShares || 0;
            const shortShares = position?.shortShares || 0;

            if (longShares > 0 || shortShares > 0) {
                positions.push({ stockId, longShares, shortShares });
            }
        }

        players[player.id] = {
            cash: roundMoney(player.cash),
            holdingsValue: roundMoney(holdingsValue),
            netWorth: roundMoney(player.cash + holdingsValue),
            positions,
        };
    }

    return { prices, players };
}

/**
 * Rank players by snapshot net worth (1 = richest).
 *
 * @returns {Object.<string, number>} playerId -> rank
 */
function rankPlayers(game, snapshot) {
    const ranks = {};

    [...game.players]
        .sort(
            (a, b) =>
                snapshot.players[b.id].netWorth -
                snapshot.players[a.id].netWorth
        )
        .forEach((player, index) => {
            ranks[player.id] = index + 1;
        });

    return ranks;
}

/**
 * Copy of every player's hand, revealed at the open phase.
 */
function revealHands(game) {
    return game.players.map(player => ({
        playerId: player.id,
        playerName: player.name,
        cards: player.cards.map(card => ({ ...card })),
    }));
}

/**
 * Sum the movement cards in every hand, per active stock.
 *
 * @returns {Object.<string, number>} stockId -> net movement
 */
function aggregateMovements(game) {
    const totals = {};

    for (const stock of game.stocks) {
        if (stock.isActive) totals[stock.id] = 0;
    }

    for (const player of game.players) {
        for (const card of player.cards) {
            if (totals[card.stockId] === undefined) continue;

            totals[card.stockId] += card.movement;
        }
    }

    return totals;
}

/**
 * Apply net movements to prices, record history, and close
 * companies whose price reaches zero or below.
 *
 * @returns {Object[]} one result per stock that was active
 */
function applyPriceMovements(game, movements) {
    const results = [];

    for (const stock of game.stocks) {
        if (!stock.isActive) continue;

        const oldPrice = stock.price;
        const movement = movements[stock.id] || 0;
        const calculatedPrice = roundMoney(oldPrice + movement);
        const isClosed = calculatedPrice <= 0;

        // Closed companies have an effective price of zero.
        const newPrice = isClosed ? 0 : calculatedPrice;

        stock.price = newPrice;

        if (isClosed) {
            stock.isActive = false;
        }

        stock.history.push({
            cycle: game.cycle,
            price: newPrice,
            movement,
            calculatedPrice,
            isClosed,
        });

        results.push({
            stockId: stock.id,
            ticker: stock.ticker,

            oldPrice,
            movement,
            calculatedPrice,
            newPrice,

            isClosed,
        });
    }

    return results;
}

/**
 * Settle every short position in cash and clear it.
 *
 * Profit per share = old price - new price.
 * If a company closed, its effective new price is zero.
 * Short positions do not carry over to the next cycle.
 *
 * @param {Object.<string, number>} oldPrices prices before the market moved
 */
function settleShorts(game, oldPrices) {
    const settlements = [];

    for (const player of game.players) {
        for (const stock of game.stocks) {
            const position = getPosition(game, stock.id, player.id);

            if (!position || position.shortShares === 0) continue;

            const shortShares = position.shortShares;
            const oldPrice = oldPrices[stock.id];
            const newPrice = stock.isActive ? stock.price : 0;

            const cashAdjustment = roundMoney(
                shortShares * (oldPrice - newPrice)
            );

            player.cash = roundMoney(player.cash + cashAdjustment);

            settlements.push({
                playerId: player.id,
                playerName: player.name,

                stockId: stock.id,
                ticker: stock.ticker,

                shortShares,

                oldPrice,
                newPrice,

                cashAdjustment,
            });

            position.shortShares = 0;
        }
    }

    return settlements;
}

function buildPositionResult(item, result) {
    return {
        stockId: item.stockId,
        ticker: result?.ticker ?? null,
        longShares: item.longShares,
        shortShares: item.shortShares,
        oldPrice: result?.oldPrice ?? null,
        newPrice: result?.newPrice ?? null,
        isClosed: result?.isClosed ?? null,
        longPnL: result
            ? roundMoney(item.longShares * (result.newPrice - result.oldPrice))
            : null,
        shortPnL: result
            ? roundMoney(item.shortShares * (result.oldPrice - result.newPrice))
            : null,
    };
}

/**
 * Per-player before/after report for the open phase.
 * Must run after the leaderboard has been recalculated.
 */
function buildPlayerResults(game, snapshot, rankBefore, stockResults) {
    const stockResultById = Object.fromEntries(
        stockResults.map(result => [result.stockId, result])
    );

    return game.players.map(player => {
        const before = snapshot.players[player.id];
        const after = game.leaderboard.find(
            entry => entry.playerId === player.id
        );

        const positions = before.positions.map(item =>
            buildPositionResult(item, stockResultById[item.stockId])
        );

        const shortPnL = roundMoney(
            positions.reduce((total, pos) => total + (pos.shortPnL || 0), 0)
        );
        const longPnL = roundMoney(after.holdingsValue - before.holdingsValue);
        const closedLoss = roundMoney(
            positions
                .filter(pos => pos.isClosed)
                .reduce((total, pos) => total + pos.longShares * pos.oldPrice, 0)
        );
        const change = roundMoney(after.netWorth - before.netWorth);

        return {
            playerId: player.id,
            playerName: player.name,
            color: player.color,

            cashBefore: before.cash,
            cashAfter: after.cash,

            holdingsBefore: before.holdingsValue,
            holdingsAfter: after.holdingsValue,

            rankBefore: rankBefore[player.id],
            rankAfter: after.rank,

            netWorthBefore: before.netWorth,
            netWorthAfter: after.netWorth,

            change,
            changePercent: before.netWorth > 0
                ? roundMoney((change / before.netWorth) * 100)
                : 0,
            shortPnL,
            longPnL,
            closedLoss,
            positions,
        };
    });
}

// ============================================================================
// PLAYER VIEW
// ============================================================================

/**
 * Player-specific game view. This is the visibility boundary:
 * only fields listed here are sent to clients.
 *
 * During active play:
 * - A player can see their own cards.
 * - Other players' cards are hidden.
 *
 * Between cycles and after game completion:
 * - All hands are public (and also in lastOpen).
 */


const cloneCards = cards => cards.map(card => ({ ...card }));

function areHandsPublic(game) {
    return (
        game.phase === PHASE.BETWEEN_CYCLES ||
        game.phase === PHASE.FINISHED
    );
}

function buildPublicPlayers(game) {
    const handsPublic = areHandsPublic(game);

    return game.players.map(player => {
        const view = {
            id: player.id,
            name: player.name,
            color: player.color,
            turnOrder: player.turnOrder,
            cash: roundMoney(player.cash),
            cardsCount: player.cards.length,
            isOnline: Boolean(player.isOnline),
        };

        if (handsPublic) {
            view.cards = cloneCards(player.cards);
        }

        return view;
    });
}

function buildStockViews(game) {
    return game.stocks.map(stock => {
        const sharesOwned = getTotalLongShares(game, stock.id);

        return {
            id: stock.id,
            ticker: stock.ticker,
            name: stock.name,
            price: stock.price,
            totalShares: stock.totalShares,
            isActive: stock.isActive,
            history: stock.history.map(entry => ({ ...entry })),
            sharesOwned,
            sharesAvailable: Math.max(0, stock.totalShares - sharesOwned),
        };
    });
}

function buildPositionBoardView(game) {
    const board = {};

    for (const stock of game.stocks) {
        board[stock.id] = {};

        for (const player of game.players) {
            const position = getPosition(game, stock.id, player.id) || {
                longShares: 0,
                shortShares: 0,
            };

            board[stock.id][player.id] = {
                longShares: position.longShares,
                shortShares: position.shortShares,
                netPosition: getNetPosition(position),
            };
        }
    }

    return board;
}

function buildAvailableStocks() {
    return STOCK_DEFINITIONS.map(definition => ({
        id: definition.id,
        ticker: definition.ticker,
        name: definition.name,
        basePrice: definition.basePrice,
        profile: definition.profile,
        selectedByDefault: definition.selectedByDefault !== false,
    }));
}

function getPlayerView(game, playerId) {
    const requestingPlayer = getPlayer(game, playerId);

    if (!requestingPlayer) {
        throw new GameError("PLAYER_NOT_FOUND", "Player not found");
    }

    return {
        gameId: game.id,
        hostId: game.hostId,
        maxPlayers: game.maxPlayers,
        requiredStockCount: game.settings.stockCount,

        // Full catalog for the lobby's stock picker.
        availableStocks:
            game.phase === PHASE.WAITING ? buildAvailableStocks() : undefined,

        phase: game.phase,
        cycle: game.cycle,

        players: buildPublicPlayers(game),
        stocks: buildStockViews(game),
        positionBoard: buildPositionBoardView(game),

        currentPlayerId:
            game.phase === PHASE.PLAYING
                ? getCurrentPlayer(game)?.id ?? null
                : null,

        currentPlayerIndex: game.currentPlayerIndex,

        actionRound: game.actionRound,
        totalActionRounds: game.settings.actionRounds,

        myPlayerId: playerId,

        // The requesting player receives their own private hand.
        hand: cloneCards(requestingPlayer.cards),

        lastOpen: game.lastOpen ? structuredClone(game.lastOpen) : null,

        log: structuredClone(
            (game.log || []).slice(-game.settings.logbookMaxEntries)
        ),

        leaderboard: game.leaderboard.map(entry => ({ ...entry })),

        deckCount: game.deck.length,
    };
}

// ============================================================================
// PUBLIC API
// ============================================================================

export {
    ACTION,
    LOG_TYPE,
    PHASE,
    TRADE_ACTIONS,
    GameError,
    STOCK_DEFINITIONS,
    DEFAULT_SETTINGS,
    createGame,
    getPlayer,
    getCurrentPlayer,
    addPlayer,
    removePlayer,
    setPlayerOnline,
    selectStocks,
    startGame,
    startNextCycle,
    takeTurn,
    passTurn,
    resolveOpenPhase,
    getLeaderboard,
    getPlayerNetWorth,
    getPlayerView,
};
