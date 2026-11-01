/**
 * ============================================================================
 * STOCKS GAME LOGIC ENGINE
 * ============================================================================
 *
 * All game rules and state transitions live in this module.
 *
 * Game flow:
 * 1. Create game and add players.
 * 2. Host starts the game.
 * 3. Each player gets 10 private movement cards.
 * 4. Players take one action in each of 3 action rounds.
 * 5. Open phase reveals cards and updates stock prices.
 * 6. Short positions are settled and cleared.
 * 7. Long positions remain.
 * 8. Host starts the next cycle.
 *
 * All authoritative game state is maintained on the server.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

export const STOCKS = [
    { id: "A", ticker: "AMZN",  name: "Amazon",     price: 1 },
    { id: "B", ticker: "MSFT",  name: "Microsoft",  price: 2 },
    { id: "C", ticker: "GOOG",  name: "Google",     price: 3 },
    { id: "D", ticker: "PANW",  name: "Palo Alto",  price: 4 },
    { id: "E", ticker: "AAPL",  name: "Apple",      price: 5 },
    { id: "F", ticker: "META",  name: "Meta",       price: 6 },
    { id: "G", ticker: "NVDA",  name: "Nvidia",     price: 8 },
];

const MOVEMENTS = [-3, -2.5, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5, 3
];

const FREQUENCY = [
    [0, 0, 0, 0, 2, 8, 8, 2, 0, 0, 0, 0],  // A - stable
    [0, 0, 4, 3, 2, 1, 1, 2, 3, 4, 0, 0],  // B - volatile
    [1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1],  // C - evenly spread
    [0, 0, 0, 0, 5, 5, 5, 5, 0, 0, 0, 0],  // D - small movements
    [3, 0, 3, 0, 4, 0, 0, 4, 0, 3, 0, 3],  // E - no fractional movements
    [3, 2, 2, 1, 1, 1, 1, 1, 1, 2, 2, 3],  // F - highly volatile
    [1, 1, 1, 2, 2, 3, 3, 2, 2, 1, 1, 1],  // G - stable
];

export const PURSE = 20000;

// Additional cash given to every player at the beginning
// of each subsequent cycle.
export const ADDITIONAL_PURSE = 10000;
export const TOTAL_SHARES_PER_STOCK = 50000;
export const CARDS_IN_HAND = 10;
export const MAX_PLAYERS = 7;
export const ACTION_ROUNDS = 3;

export const PLAYER_COLORS = [
    "#e63946",
    "#0f2dd4",
    "#f1e508",
    "#ea9957",
    "#0fd4e2",
    "#245607",
    "#8313de",
];

// ============================================================================
// CONFIGURATION VALIDATION
// ============================================================================

function validateConfiguration() {
    if (STOCKS.length !== FREQUENCY.length) {
        throw new Error("STOCKS and FREQUENCY lengths do not match");
    }

    STOCKS.forEach((stock, stockIndex) => {
        if (FREQUENCY[stockIndex].length !== MOVEMENTS.length) {
            throw new Error(
                `Invalid movement frequencies for ${stock.ticker}`
            );
        }

        if (
            FREQUENCY[stockIndex].some(
                frequency =>
                    !Number.isInteger(frequency) || frequency < 0
            )
        ) {
            throw new Error(
                `Invalid frequency for stock ${stock.ticker}`
            );
        }
    });
}

validateConfiguration();

// ============================================================================
// GENERAL HELPERS
// ============================================================================

function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getStock(game, stockId) {
    return game.stocks.find(stock => stock.id === stockId);
}

function getPlayer(game, playerId) {
    return game.players.find(player => player.id === playerId);
}

function getPosition(game, stockId, playerId) {
    return game.positionBoard?.[stockId]?.[playerId] ?? null;
}

function getNetPosition(position) {
    return position.longShares - position.shortShares;
}

// ============================================================================
// DECK GENERATION AND SHUFFLING
// ============================================================================

/**
 * Generate a fresh deck.
 *
 * Only active stocks are included.
 * Every card gets a unique ID within the generated deck.
 */
export function generateDeck(stocks = STOCKS) {
    const deck = [];
    let cardNumber = 1;

    for (const stock of stocks) {
        if (stock.isActive === false) continue;

        const stockIndex = STOCKS.findIndex(
            configuredStock => configuredStock.id === stock.id
        );

        if (stockIndex === -1) continue;

        MOVEMENTS.forEach((movement, movementIndex) => {
            const frequency = FREQUENCY[stockIndex][movementIndex];

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

/**
 * Fisher-Yates shuffle.
 * Returns a new array without modifying the original.
 */
export function shuffleDeck(deck) {
    const shuffled = [...deck];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [shuffled[i], shuffled[j]] = [
            shuffled[j],
            shuffled[i],
        ];
    }

    return shuffled;
}

/**
 * Deal 10 cards to every player.
 *
 * The function returns an error if there are insufficient cards.
 */
function dealCards(game) {
    const requiredCards = game.players.length * CARDS_IN_HAND;

    if (game.deck.length < requiredCards) {
        return {
            success: false,
            error:
                `Not enough cards. Required: ${requiredCards}, ` +
                `available: ${game.deck.length}`,
        };
    }

    for (const player of game.players) {
        player.cards = game.deck.splice(0, CARDS_IN_HAND);
    }

    return { success: true };
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
export function createPositionBoard(stocks, players) {
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

// ============================================================================
// GAME CREATION
// ============================================================================

export function createGame(gameId, hostPlayer) {
    // Create a fresh stock object for every game.
    const stocks = STOCKS.map(stock => ({
        ...stock,
        totalShares: TOTAL_SHARES_PER_STOCK,
        isActive: true,
        history: [
            {
                cycle: 0,
                price: stock.price,
                movement: 0,
            },
        ],
    }));

    const players = [
        {
            id: hostPlayer.id,
            name: hostPlayer.name.trim(),
            color: PLAYER_COLORS[0],
            turnOrder: null,
            cards: [],
            cash: PURSE,
            isOnline: true,
        },
    ];

    return {
        id: gameId,
        hostId: hostPlayer.id,
        maxPlayers: MAX_PLAYERS,
        phase: "waiting",  // waiting, playing, betweenCycles, finished
        cycle: 0,
        stocks,
        players,
        positionBoard: {},
        deck: [],
        currentPlayerIndex: 0,
        actionRound: 0,
        lastOpen: null,
        leaderboard: [],
        createdAt: Date.now(),
    };
}

// ============================================================================
// PLAYER MANAGEMENT
// ============================================================================

export function addPlayer(game, player) {
    if (game.phase !== "waiting") {
        return {
            success: false,
            error: "Game has already started",
        };
    }

    if (game.players.length >= game.maxPlayers) {
        return {
            success: false,
            error: "Game is full",
        };
    }

    if (!player.name?.trim()) {
        return {
            success: false,
            error: "Player name is required",
        };
    }

    game.players.push({
        id: player.id,
        name: player.name.trim(),
        color: PLAYER_COLORS[game.players.length],
        turnOrder: null,
        cards: [],
        cash: PURSE,
        isOnline: true,
    });

    return {
        success: true,
    };
}

export function removePlayer(game, playerId) {
    const removedIndex = game.players.findIndex(
        player => player.id === playerId
    );

    if (removedIndex === -1) {
        return {
            success: false,
            error: "Player not found",
        };
    }

    const [removedPlayer] = game.players.splice(removedIndex, 1);

    // During active play, return the departing player's cards
    // for active companies to the deck.
    // Cards are already in the deck after the open phase,
    // so do not add them again between cycles.
    if (game.phase === "playing") {
        const returnedCards = (removedPlayer.cards || []).filter(card => {
            const stock = getStock(game, card.stockId);
            return stock?.isActive === true;
        });

        game.deck = shuffleDeck([
            ...game.deck,
            ...returnedCards,
        ]);
    }

    // Remove the departing player's cards.
    removedPlayer.cards = [];

    // Release all their positions from every stock.
    for (const stockId of Object.keys(game.positionBoard || {})) {
        delete game.positionBoard[stockId][playerId];
    }

    // Remove them from any existing leaderboard.
    game.leaderboard = game.leaderboard.filter(
        entry => entry.playerId !== playerId
    );

    // Transfer host responsibility if necessary.
    if (game.hostId === playerId) {
        game.hostId = game.players[0]?.id || null;
    }

    // Recalculate the visible turn-order numbers.
    game.players.forEach((player, index) => {
        player.turnOrder = index + 1;
    });

    let progression = null;

    // If the game is active and fewer than two players remain,
    // finish the game.
    if (
        game.phase !== "waiting" &&
        game.phase !== "finished" &&
        game.players.length < 2
    ) {
        game.phase = "finished";
        game.currentPlayerIndex = 0;
        game.actionRound = 0;
        game.leaderboard = getLeaderboard(game);
    }

    // Adjust turn progression if the game is still active.
    else if (game.phase === "playing") {

        if (removedIndex < game.currentPlayerIndex) {
            // A player who already acted was removed.
            // The current player's index shifts left.
            game.currentPlayerIndex--;
        }

        else if (removedIndex === game.currentPlayerIndex) {
            // The player whose turn it was has left.

            if (game.currentPlayerIndex >= game.players.length) {
                // The departing player was last in the turn order.
                // Complete this round and advance normally.
                game.currentPlayerIndex = game.players.length - 1;
                progression = advanceTurn(game);
            }

            else {
                // The next player now occupies the same index.
                progression = {
                    cycleComplete: false,
                    actionRound: game.actionRound,
                    currentPlayerId:
                        game.players[game.currentPlayerIndex].id,
                };
            }
        }
    }

    else {
        game.currentPlayerIndex = 0;
    }

    return {
        success: true,
        playerId,
        playerName: removedPlayer.name,
        hostId: game.hostId,
        playerCount: game.players.length,
        gameEmpty: game.players.length === 0,
        gameFinished: game.phase === "finished",
        progression,
    };
}


// ============================================================================
// START GAME
// ============================================================================

export function startGame(game) {
    if (game.phase !== "waiting") {
        return {
            success: false,
            error: "Game has already started",
        };
    }

    if (game.players.length < 2) {
        return {
            success: false,
            error: "Need at least 2 players",
        };
    }

    const requiredCards = game.players.length * CARDS_IN_HAND;
    const freshDeck = generateDeck(game.stocks);

    if (freshDeck.length < requiredCards) {
        return {
            success: false,
            error: "Not enough cards for all players",
        };
    }

    // Randomize player order.
    game.players = shuffleDeck(game.players);

    game.players.forEach((player, index) => {
        player.turnOrder = index + 1;
        player.color = PLAYER_COLORS[index];
    });

    // Initialize the position board.
    game.positionBoard = createPositionBoard(
        game.stocks,
        game.players
    );

    // Shuffle and deal.
    game.deck = shuffleDeck(freshDeck);

    const dealResult = dealCards(game);

    if (!dealResult.success) {
        return dealResult;
    }

    game.cycle = 1;
    game.phase = "playing";

    game.currentPlayerIndex = 0;
    game.actionRound = 1;

    game.lastOpen = null;
    game.leaderboard = [];

    return {
        success: true,
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

// ============================================================================
// TURN VALIDATION
// ============================================================================

function validateTurn(game, playerId) {
    if (game.phase !== "playing") {
        return {
            success: false,
            error: "Game is not accepting actions",
        };
    }

    const currentPlayer =
        game.players[game.currentPlayerIndex];

    if (!currentPlayer || currentPlayer.id !== playerId) {
        return {
            success: false,
            error: "Not your turn",
        };
    }

    return {
        success: true,
        player: currentPlayer,
    };
}

// ============================================================================
// TRADE EXECUTION
// ============================================================================

/**
 * Execute one action for the current player.
 *
 * Supported actions:
 * BUY   - Buy whole shares.
 * SELL  - Sell some or all shares bought
 * SHORT - Short whole shares.
 * UNSHORT - remove some or all shares shorted
 * PASS  - Do nothing.
 *
 * Every player gets one action per action round.
 *
 * Short selling does not deduct or lock cash.
 * The short value of each individual short action cannot
 * exceed the player's current cash.
 */
export function takeTurn(game, playerId, action, stockId = null, shares = 0) {
  if (game.phase !== "playing") {
    throw new Error("Game is not currently in the playing phase.");
  }

  const currentPlayer = game.players[game.currentPlayerIndex];

  if (!currentPlayer || currentPlayer.id !== playerId) {
    throw new Error("It is not your turn.");
  }

  const normalizedAction = String(action).toUpperCase();

  // PASS does not require a stock or share quantity.
  if (normalizedAction === "PASS") {
    const progression = advanceTurn(game);

    return {
        success: true,
        action: "PASS",
        progression,
    };
  }

  if (!["BUY", "SELL", "SHORT", "UNSHORT"].includes(normalizedAction)) {
    throw new Error("Invalid action. Use BUY, SELL, SHORT, UNSHORT, or PASS.");
  }

  if (!Number.isInteger(shares) || shares <= 0) {
    throw new Error("Shares must be a positive whole number.");
  }

  const stock = game.stocks.find(
    (item) => item.id === stockId && item.isActive
  );

  if (!stock) {
    throw new Error("Stock does not exist or is no longer active.");
  }

  const position = game.positionBoard?.[stockId]?.[playerId];

  if (!position) {
    throw new Error("Position not found for this player and stock.");
  }

  const tradeValue = shares * stock.price;

  switch (normalizedAction) {
    case "BUY": {
        if (currentPlayer.cash < tradeValue) {
            throw new Error("Insufficient cash to buy these shares.");
        }

        // Calculate shares currently owned by all players.
        const totalOwnedShares = game.players.reduce(
            (total, player) => {
                const playerPosition = getPosition(
                    game,
                    stockId,
                    player.id
                );

                return total + (playerPosition?.longShares || 0);
            },
            0
        );
        const availableShares = stock.totalShares - totalOwnedShares;

        if(shares > availableShares) {
            throw new Error(
                `Only ${availableShares.toLocaleString()} shares are available.`
            );
        }

        currentPlayer.cash -= tradeValue;
        position.longShares += shares;
        break;
    }

    case "SELL": {
        if (position.longShares < shares) {
            throw new Error("You do not own enough shares to sell.");
        }

        position.longShares -= shares;
        currentPlayer.cash += tradeValue;
        break;
    }

    case "SHORT": {
        if (tradeValue > currentPlayer.cash) {
            throw new Error("Short position value cannot exceed available cash.");
        }

        position.shortShares += shares;
        // Short-sale proceeds are not added to cash under your game rules.
        break;
    }

    case "UNSHORT": {
        if (position.shortShares < shares) {
            throw new Error("You do not have enough shorted shares to unshort.");
        }

        position.shortShares -= shares;
        // No immediate cash adjustment. The remaining short position is settled during the open phase.
        break;
    }
  }

  const progression = advanceTurn(game);

    return {
        success: true,
        action: normalizedAction,
        stockId,
        shares,
        tradeValue,
        progression,
    };
}

export function passTurn(game, playerId) {
    return takeTurn(
        game,
        playerId,
        "PASS"
    );
}

// ============================================================================
// TURN PROGRESSION
// ============================================================================

/**
 * Move to the next player.
 *
 * After the last player:
 * - Start the next action round, if fewer than 3 have completed.
 * - Otherwise, resolve the open phase.
 */
function advanceTurn(game) {
    const isLastPlayer =
        game.currentPlayerIndex === game.players.length - 1;

    if (!isLastPlayer) {
        game.currentPlayerIndex++;

        return {
            cycleComplete: false,
            actionRound: game.actionRound,
            currentPlayerId:
                game.players[game.currentPlayerIndex].id,
        };
    }

    // All players have acted in this round.
    if (game.actionRound < ACTION_ROUNDS) {
        game.actionRound++;
        game.currentPlayerIndex = 0;

        return {
            cycleComplete: false,
            actionRound: game.actionRound,
            currentPlayerId: game.players[0].id,
        };
    }

    // Third action round has completed.
    const openResult = resolveOpenPhase(game);

    return {
        cycleComplete: true,
        openResult,
    };
}

// ============================================================================
// LEADERBOARD AND NET WORTH
// ============================================================================

export function getPlayerNetWorth(game, playerId) {
    const player = getPlayer(game, playerId);

    if (!player) return 0;

    let holdingsValue = 0;

    for (const stock of game.stocks) {
        if (!stock.isActive) continue;

        const position = getPosition(
            game,
            stock.id,
            playerId
        );

        if (position) {
            holdingsValue +=
                position.longShares * stock.price;
        }
    }

    return roundMoney(player.cash + holdingsValue);
}

export function getLeaderboard(game) {
    return game.players
        .map(player => {
            let holdingsValue = 0;

            for (const stock of game.stocks) {
                if (!stock.isActive) continue;

                const position = getPosition(
                    game,
                    stock.id,
                    player.id
                );

                if (position) {
                    holdingsValue +=
                        position.longShares * stock.price;
                }
            }

            return {
                playerId: player.id,
                name: player.name,
                color: player.color,

                cash: roundMoney(player.cash),
                holdingsValue: roundMoney(holdingsValue),

                netWorth: roundMoney(
                    player.cash + holdingsValue
                ),
            };
        })
        .sort((a, b) => b.netWorth - a.netWorth)
        .map((entry, index) => ({
            ...entry,
            rank: index + 1,
        }));
}

// ============================================================================
// OPEN PHASE
// ============================================================================

/**
 * Resolve the market after all players have completed 3 actions.
 *
 * Steps:
 * 1. Reveal all cards.
 * 2. Aggregate movement by stock.
 * 3. Update prices.
 * 4. Close companies whose prices reach zero or below.
 * 5. Settle all short positions.
 * 6. Clear short positions.
 * 7. Clear positions in closed companies.
 * 8. Calculate leaderboard.
 * 9. Return active-stock cards to the deck.
 * 10. Move game to betweenCycles.
 */
export function resolveOpenPhase(game) {
    if (game.phase !== "playing") {
        return {
            success: false,
            error: "Cannot open market right now",
        };
    }

    // Reveal all players' cards.
    const revealedHands = game.players.map(player => ({
        playerId: player.id,
        playerName: player.name,

        cards: player.cards.map(card => ({
            ...card,
        })),
    }));

    // Store the old prices before applying any movement.
    const oldPrices = {};

    const movementTotals = {};

    for (const stock of game.stocks) {
        if (!stock.isActive) continue;

        oldPrices[stock.id] = stock.price;
        movementTotals[stock.id] = 0;
    }

    // Aggregate movement cards.
    for (const player of game.players) {
        for (const card of player.cards) {
            if (
                movementTotals[card.stockId] === undefined
            ) {
                continue;
            }

            movementTotals[card.stockId] += card.movement;
        }
    }

    // Apply movements and close companies when required.
    const stockResults = [];

    for (const stock of game.stocks) {
        if (!stock.isActive) continue;

        const oldPrice = oldPrices[stock.id];
        const movement = movementTotals[stock.id] || 0;

        const calculatedPrice = roundMoney(
            oldPrice + movement
        );

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

        stockResults.push({
            stockId: stock.id,
            ticker: stock.ticker,

            oldPrice,
            movement,
            calculatedPrice,
            newPrice,

            isClosed,
        });
    }

    // Settle shorts using the old price and effective new price.
    const shortSettlements = [];

    for (const player of game.players) {
        for (const stock of game.stocks) {
            const position = getPosition(
                game,
                stock.id,
                player.id
            );

            if (!position || position.shortShares === 0) {
                continue;
            }

            const shortShares = position.shortShares;
            const oldPrice = oldPrices[stock.id];

            // If a company closes, its effective final price is zero.
            const effectiveNewPrice = stock.isActive
                ? stock.price
                : 0;

            const cashAdjustment = roundMoney(
                shortShares *
                (oldPrice - effectiveNewPrice)
            );

            player.cash = roundMoney(
                player.cash + cashAdjustment
            );

            shortSettlements.push({
                playerId: player.id,
                playerName: player.name,

                stockId: stock.id,
                ticker: stock.ticker,

                shortShares,

                oldPrice,
                newPrice: effectiveNewPrice,

                cashAdjustment,
            });

            // Short positions do not carry over.
            position.shortShares = 0;
        }
    }

    // Remove all positions in companies that have closed.
    for (const stock of game.stocks) {
        if (stock.isActive) continue;

        for (const player of game.players) {
            const position = getPosition(
                game,
                stock.id,
                player.id
            );

            if (!position) continue;

            position.longShares = 0;
            position.shortShares = 0;
        }
    }

    // Calculate leaderboard after all settlements.
    game.leaderboard = getLeaderboard(game);

    // Return cards belonging to active companies to the deck.
    const returnedCards = game.players.flatMap(
        player => player.cards
    );

    game.deck = shuffleDeck([
        ...game.deck,
        ...returnedCards,
    ].filter(card => {
        const stock = getStock(game, card.stockId);

        return stock?.isActive === true;
    }));

    // Save open phase results.
    game.lastOpen = {
        cycle: game.cycle,

        revealedHands,
        stockResults,
        shortSettlements,

        closedStocks: stockResults
            .filter(result => result.isClosed)
            .map(result => result.stockId),

        leaderboard: game.leaderboard,
    };

    // Cards have been revealed. They will be replaced at next cycle.
    game.phase = "betweenCycles";

    game.currentPlayerIndex = 0;
    game.actionRound = 0;

    return {
        success: true,
        ...game.lastOpen,
    };
}

// ============================================================================
// NEXT CYCLE
// ============================================================================

/**
 * Start another cycle.
 *
 * - Long holdings remain.
 * - Short positions have already been settled and cleared.
 * - Every player receives ADDITIONAL_PURSE.
 * - Active-stock cards are shuffled and dealt again.
 */
export function startNextCycle(game) {
    if (game.phase !== "betweenCycles") {
        return {
            success: false,
            error: "The current cycle has not finished",
        };
    }

    const activeStocks = game.stocks.filter(
        stock => stock.isActive
    );

    if (activeStocks.length === 0) {
        game.phase = "finished";

        return {
            success: true,
            finished: true,
            error: "All companies have closed",
            leaderboard: game.leaderboard,
        };
    }

    const requiredCards =
        game.players.length * CARDS_IN_HAND;

    if (game.deck.length < requiredCards) {
        return {
            success: false,
            error:
                `Not enough cards for next cycle. ` +
                `Required: ${requiredCards}, ` +
                `available: ${game.deck.length}`,
        };
    }

    // Give every player the additional purse.
    for (const player of game.players) {
        player.cash = roundMoney(
            player.cash + ADDITIONAL_PURSE
        );
    }

    // Deal new cards.
    const dealResult = dealCards(game);

    if (!dealResult.success) {
        return dealResult;
    }

    game.cycle++;

    game.phase = "playing";

    game.currentPlayerIndex = 0;
    game.actionRound = 1;

    game.lastOpen = null;

    return {
        success: true,

        cycle: game.cycle,
        actionRound: game.actionRound,

        currentPlayerId: game.players[0].id,
    };
}

// ============================================================================
// PLAYER VIEW
// ============================================================================

/**
 * Returns a player-specific game state.
 *
 * During active play:
 * - A player can see their own cards.
 * - Other players' cards are hidden.
 *
 * Between cycles and after game completion:
 * - All cards from the previous open phase are public in lastOpen.
 */
export function getPlayerView(game, playerId) {
    const requestingPlayer = getPlayer(game, playerId);

    if (!requestingPlayer) {
        return {
            success: false,
            error: "Player not found",
        };
    }

    const isBetweenCycles =
        game.phase === "betweenCycles" ||
        game.phase === "finished";

    // Build public player information.
    // Never expose other players' private cards during active play.
    const players = game.players.map(player => {
        const playerView = {
            id: player.id,
            name: player.name,
            color: player.color,
            turnOrder: player.turnOrder,
            cash: roundMoney(player.cash),
            cardsCount: player.cards.length,
            isOnline: Boolean(player.isOnline),
        };

        // Cards are public only after the open phase.
        if (isBetweenCycles) {
            playerView.cards = player.cards.map(card => ({
                ...card,
            }));
        }

        return playerView;
    });

    // Clone stock information.
    const stocks = game.stocks.map(stock => {
        const totalOwnedShares = game.players.reduce(
            (total, player) => {
                const position = getPosition(
                    game,
                    stock.id,
                    player.id
                );

                return total + (position?.longShares || 0);
            },
            0
        );

        return {
            ...stock,
            sharesOwned: totalOwnedShares,
            sharesAvailable: Math.max(
                0,
                stock.totalShares - totalOwnedShares
            ),
            history: stock.history.map(entry => ({
                ...entry,
            })),
        };
    });

    // Build the position board.
    const positionBoard = {};

    for (const stock of game.stocks) {
        positionBoard[stock.id] = {};

        for (const player of game.players) {
            const position = getPosition(
                game,
                stock.id,
                player.id
            );

            const safePosition = position || {
                longShares: 0,
                shortShares: 0,
            };

            positionBoard[stock.id][player.id] = {
                longShares: safePosition.longShares,
                shortShares: safePosition.shortShares,
                netPosition: getNetPosition(safePosition),
            };
        }
    }

    const lastOpen = game.lastOpen
        ? structuredClone(game.lastOpen)
        : null;

    return {
        success: true,

        gameId: game.id,
        hostId: game.hostId,

        phase: game.phase,
        cycle: game.cycle,

        players,
        stocks,
        positionBoard,

        currentPlayerId:
            game.phase === "playing"
                ? game.players[game.currentPlayerIndex]?.id ?? null
                : null,

        currentPlayerIndex: game.currentPlayerIndex,

        actionRound: game.actionRound,
        totalActionRounds: ACTION_ROUNDS,

        myPlayerId: playerId,

        // The requesting player receives their own private hand.
        hand: requestingPlayer.cards.map(card => ({
            ...card,
        })),

        lastOpen,

        leaderboard: game.leaderboard.map(entry => ({
            ...entry,
        })),

        deckCount: game.deck.length,
    };
}
