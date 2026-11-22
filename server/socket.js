/**
 * ============================================================================
 * SOCKET.IO LAYER
 * ============================================================================
 *
 * Event names, acknowledgements, payload validation, broadcasting,
 * socket presence and every socket handler.
 *
 * Handlers stay thin: parse payload → call gameService → emit/ack.
 */

import { Server } from "socket.io";

import { ACTION, GameError } from "./game.js";
import {
    GAME_CODE_ALPHABET,
    GAME_CODE_LENGTH,
    createTurnTimer,
} from "./utils.js";

// ============================================================================
// EVENTS (protocol)
// ============================================================================

/**
 * Socket.IO protocol: every event name, with payload shapes.
 *
 * Acknowledgements always have the shape
 *   { success: true, ...data }  or  { success: false, error, code }
 */

/** Events sent by the client (all take a payload and an ack callback). */
const CLIENT_EVENTS = Object.freeze({
    /** { playerName } → ack { gameCode, playerId, reconnectToken, gameState } */
    CREATE_GAME: "createGame",

    /** { gameCode, playerName } → ack { gameCode, playerId, reconnectToken, gameState } */
    JOIN_GAME: "joinGame",

    /** { gameCode, playerId, reconnectToken } → ack { gameCode, playerId, gameState } */
    REJOIN_GAME: "rejoinGame",

    /** {} → ack { gameDeleted, gameFinished, message } */
    LEAVE_GAME: "leaveGame",

    /** { stockIds: string[] } (host only, lobby) → ack { stockIds, gameState } */
    SELECT_STOCKS: "selectStocks",

    /** {} (host only, exactly settings.stockCount stocks selected) → ack { cycle, actionRound, turnOrder, gameState } */
    START_GAME: "startGame",

    /** { action, stockId?, shares? } → ack { action, ..., progression, gameState } */
    TAKE_TURN: "takeTurn",

    /** {} → ack { action: "PASS", progression, gameState } */
    PASS_TURN: "passTurn",

    /** {} (host only) → ack { finished, ..., gameState } */
    NEXT_CYCLE: "nextCycle",
});

/** Events sent by the server. */
const SERVER_EVENTS = Object.freeze({
    /** Per-player: { game: PlayerView, gameCode, playerId } */
    GAME_STATE: "gameState",

    /** { cycle, actionRound, turnOrder } */
    GAME_STARTED: "gameStarted",

    /** { playerId, action, stockId?, shares?, auto?, cycle, actionRound } (round the action was taken in) */
    TURN_ACTION: "turnAction",

    /** { cycle, actionRound, currentPlayerId } */
    TURN_CHANGED: "turnChanged",

    /** { openResult } */
    OPEN_PHASE_COMPLETED: "openPhaseCompleted",

    /** { cycle, actionRound, currentPlayerId } */
    CYCLE_STARTED: "cycleStarted",

    /** { leaderboard, reason? } */
    GAME_FINISHED: "gameFinished",

    /** { player: { id, name, color } } */
    PLAYER_JOINED: "playerJoined",

    /** { playerId, playerName, newHostId, newHostName } */
    PLAYER_LEFT: "playerLeft",

    /** { playerId, playerName } */
    PLAYER_RECONNECTED: "playerReconnected",

    /** { playerId, playerName } */
    PLAYER_DISCONNECTED: "playerDisconnected",

    /** { message } — the game was removed after inactivity */
    GAME_EXPIRED: "gameExpired",

    /** { message, players, maxPlayers } — sent just before disconnecting */
    SERVER_FULL: "serverFull",
});

// ============================================================================
// ACKNOWLEDGEMENTS
// ============================================================================

/**
 * Acknowledgement helpers: one success/error contract for every handler.
 */


/**
 * Safe callback helper.
 */
function reply(callback, result) {
    if (typeof callback === "function") {
        callback(result);
    }
}

/**
 * Wrap a handler `(payload) => data`.
 *
 * - Returned data is acked as { success: true, ...data }.
 * - GameError is acked as { success: false, error, code }.
 * - Anything else is logged and acked as a generic internal error,
 *   so internal details never reach the client.
 */
function handle(logger, eventName, fn) {
    return async (payload, callback) => {
        // Client emitted with only an ack callback.
        if (typeof payload === "function") {
            callback = payload;
            payload = {};
        }

        const safePayload =
            payload && typeof payload === "object" ? payload : {};

        try {
            const data = await fn(safePayload);

            reply(callback, { success: true, ...data });
        } catch (error) {
            if (error instanceof GameError) {
                reply(callback, {
                    success: false,
                    error: error.message,
                    code: error.code,
                });
                return;
            }

            logger.error(`Unhandled error in "${eventName}":`, error);

            reply(callback, {
                success: false,
                error: "Internal server error",
                code: "INTERNAL_ERROR",
            });
        }
    };
}

// ============================================================================
// PAYLOAD VALIDATION
// ============================================================================

/**
 * Payload parsing at the transport edge.
 * Returns clean values or throws GameError("INVALID_INPUT").
 * Game rules (valid action, positive shares, ...) stay in the domain.
 */


const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const GAME_CODE_PATTERN = new RegExp(
    `^[${GAME_CODE_ALPHABET}]{${GAME_CODE_LENGTH}}$`
);

function invalid(message) {
    return new GameError("INVALID_INPUT", message);
}

function parsePlayerName(value, maxLength) {
    const name = typeof value === "string" ? value.trim() : "";

    if (!name) {
        throw invalid("Player name is required");
    }

    if (name.length > maxLength) {
        throw invalid(`Player name must be at most ${maxLength} characters`);
    }

    if (CONTROL_CHARS.test(name)) {
        throw invalid("Player name contains invalid characters");
    }

    return name;
}

function parseGameCode(value) {
    const code = typeof value === "string" ? value.trim().toUpperCase() : "";

    if (!code) {
        throw invalid("Game code is required");
    }

    if (!GAME_CODE_PATTERN.test(code)) {
        throw new GameError("GAME_NOT_FOUND", "Game not found");
    }

    return code;
}

function parseRequiredString(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw invalid(`${label} is required`);
    }

    return value.trim();
}

/**
 * { action, stockId, shares } for takeTurn.
 * Numeric strings for shares are accepted ("10" → 10).
 */
function parseStockIds(value) {
    if (
        !Array.isArray(value) ||
        value.length > 100 ||
        value.some(stockId => typeof stockId !== "string")
    ) {
        throw invalid("Stock selection must be a list of stock IDs");
    }

    return value;
}

function parseTurnPayload(payload) {
    if (typeof payload.action !== "string" || !payload.action) {
        throw invalid("Action is required");
    }

    const stockId =
        typeof payload.stockId === "string" ? payload.stockId : null;

    let shares = payload.shares ?? 0;

    if (typeof shares === "string" && shares.trim() !== "") {
        shares = Number(shares);
    }

    if (typeof shares !== "number") {
        throw invalid("Shares must be a number");
    }

    return { action: payload.action, stockId, shares };
}

// ============================================================================
// BROADCASTER
// ============================================================================

/**
 * Every outgoing server event goes through here.
 */


function createBroadcaster({ io, sessions, gameService }) {
    function toGame(gameId, event, data) {
        io.to(gameId).emit(event, data);
    }

    function viewFor(gameId, playerId) {
        return gameService.getView(gameId, playerId);
    }

    return {
        toGame,
        viewFor,

        /**
         * Send each connected player their own game view.
         * Each player must only see their own private cards during play.
         */
        gameState(gameId) {
            for (const { socketId, playerId } of sessions.socketsForGame(gameId)) {
                const view = viewFor(gameId, playerId);

                if (view) {
                    io.to(socketId).emit(SERVER_EVENTS.GAME_STATE, {
                        game: view,
                        gameCode: gameId,
                        playerId,
                    });
                }
            }
        },

        /**
         * Announce an executed action, tagged with the round it was taken in.
         */
        turnAction(gameId, playerId, result) {
            toGame(gameId, SERVER_EVENTS.TURN_ACTION, {
                playerId,
                action: result.action,
                ...(result.action !== ACTION.PASS
                    ? { stockId: result.stockId, shares: result.shares }
                    : {}),
                ...(result.auto ? { auto: true } : {}),
                cycle: result.cycle,
                actionRound: result.actionRound,
            });
        },

        /**
         * Announce what happened after a turn advanced:
         * either the market opened or the turn moved to the next player.
         */
        progression(gameId, game, progression) {
            if (!progression) return;

            if (progression.cycleComplete) {
                toGame(gameId, SERVER_EVENTS.OPEN_PHASE_COMPLETED, {
                    openResult: progression.openResult,
                });
            } else {
                toGame(gameId, SERVER_EVENTS.TURN_CHANGED, {
                    cycle: game.cycle,
                    actionRound: game.actionRound,
                    currentPlayerId: progression.currentPlayerId,
                });
            }
        },
    };
}

// ============================================================================
// PRESENCE (socket ↔ player binding)
// ============================================================================

/**
 * Socket ↔ player binding, shared by lobby and connection handlers.
 */


/**
 * Session for this socket, or throw if it has not joined a game.
 */
function requireSession(ctx, socket) {
    const info = ctx.sessions.get(socket.id);

    if (!info) {
        throw new GameError("NOT_IN_GAME", "You are not in a game");
    }

    return info;
}

/**
 * Detach a socket from its game. If that was the player's last socket,
 * mark them offline and tell the room.
 */
function releaseSocket(ctx, socket) {
    const info = ctx.sessions.unbind(socket.id);

    if (!info) return;

    const { gameId, playerId } = info;

    socket.leave(gameId);

    // A player may have multiple tabs connected.
    if (ctx.sessions.isPlayerConnected(gameId, playerId)) return;

    const player = ctx.gameService.setPresence({
        gameId,
        playerId,
        isOnline: false,
    });

    if (!player) return;

    ctx.broadcaster.toGame(gameId, SERVER_EVENTS.PLAYER_DISCONNECTED, {
        playerId,
        playerName: player.name,
    });

    ctx.publishState(gameId);
}

/**
 * Bind a socket to a player and join the game room.
 * A socket belongs to one game at a time, so any previous binding is released.
 */
function bindSocket(ctx, socket, gameId, playerId) {
    const current = ctx.sessions.get(socket.id);

    if (current && (current.gameId !== gameId || current.playerId !== playerId)) {
        releaseSocket(ctx, socket);
    }

    ctx.sessions.bind(socket.id, gameId, playerId);
    socket.join(gameId);
}

/**
 * Detach every socket of a player (other tabs, stale connections),
 * optionally keeping one.
 */
function evictPlayerSockets(ctx, gameId, playerId, { except } = {}) {
    for (const socketId of ctx.sessions.socketsForPlayer(gameId, playerId)) {
        if (socketId === except) continue;

        ctx.sessions.unbind(socketId);
        ctx.io.sockets.sockets.get(socketId)?.leave(gameId);
    }
}

// ============================================================================
// MIDDLEWARE: CAPACITY
// ============================================================================

/**
 * Turn away a new connection when the server is full.
 *
 * @returns {boolean} true if the socket was rejected
 */
function rejectIfServerFull(ctx, socket) {
    const { connectionStats, limits } = ctx;

    if (connectionStats.connectedSockets < limits.maxConnectedSockets) {
        return false;
    }

    socket.emit(SERVER_EVENTS.SERVER_FULL, {
        message: "Server is at maximum capacity. Please try again later.",
        players: connectionStats.connectedSockets,
        maxPlayers: limits.maxConnectedSockets,
    });

    socket.disconnect(true);

    return true;
}

// ============================================================================
// MIDDLEWARE: ACTIVITY
// ============================================================================

/**
 * Record activity on the socket's game for every incoming event.
 * Idle games are removed by the cleanup job.
 */
function trackActivity(ctx, socket) {
    socket.use((_packet, next) => {
        const info = ctx.sessions.get(socket.id);

        if (info) {
            ctx.gameService.recordActivity(info.gameId);
        }

        next();
    });
}

// ============================================================================
// HANDLERS: LOBBY
// ============================================================================

/**
 * createGame, joinGame, rejoinGame, leaveGame
 */


function registerLobbyHandlers(ctx, socket) {
    const { gameService, broadcaster, logger, limits } = ctx;
    const on = (event, fn) => socket.on(event, handle(logger, event, fn));

    on(CLIENT_EVENTS.CREATE_GAME, payload => {
        const playerName = parsePlayerName(
            payload.playerName,
            limits.maxPlayerNameLength
        );

        const { gameCode, playerId, reconnectToken } =
            gameService.createGame({ playerName });

        bindSocket(ctx, socket, gameCode, playerId);
        ctx.publishState(gameCode);

        logger.info(`Game ${gameCode} created by ${playerName}`);

        return {
            gameCode,
            playerId,
            reconnectToken,
            gameState: broadcaster.viewFor(gameCode, playerId),
        };
    });

    on(CLIENT_EVENTS.JOIN_GAME, payload => {
        const gameCode = parseGameCode(payload.gameCode);
        const playerName = parsePlayerName(
            payload.playerName,
            limits.maxPlayerNameLength
        );

        const { player, playerId, reconnectToken } =
            gameService.joinGame({ gameCode, playerName });

        bindSocket(ctx, socket, gameCode, playerId);

        broadcaster.toGame(gameCode, SERVER_EVENTS.PLAYER_JOINED, {
            player: {
                id: player.id,
                name: player.name,
                color: player.color,
            },
        });

        ctx.publishState(gameCode);

        logger.info(`${playerName} joined game ${gameCode}`);

        return {
            gameCode,
            playerId,
            reconnectToken,
            gameState: broadcaster.viewFor(gameCode, playerId),
        };
    });

    on(CLIENT_EVENTS.REJOIN_GAME, payload => {
        const gameCode = parseGameCode(payload.gameCode);
        const playerId = parseRequiredString(payload.playerId, "Player ID");
        const reconnectToken = parseRequiredString(
            payload.reconnectToken,
            "Reconnect token"
        );

        const { player } = gameService.rejoinGame({
            gameCode,
            playerId,
            reconnectToken,
        });

        // Drop stale connections for this player (e.g. an old tab).
        evictPlayerSockets(ctx, gameCode, playerId, { except: socket.id });
        bindSocket(ctx, socket, gameCode, playerId);

        broadcaster.toGame(gameCode, SERVER_EVENTS.PLAYER_RECONNECTED, {
            playerId,
            playerName: player.name,
        });

        ctx.publishState(gameCode);

        logger.info(`${player.name} reconnected to game ${gameCode}`);

        return {
            gameCode,
            playerId,
            gameState: broadcaster.viewFor(gameCode, playerId),
        };
    });

    on(CLIENT_EVENTS.LEAVE_GAME, () => {
        const { gameId, playerId } = requireSession(ctx, socket);
        const { game, removal } = gameService.leaveGame({ gameId, playerId });

        // Also handles a player leaving with multiple tabs open.
        evictPlayerSockets(ctx, gameId, playerId);

        if (removal.gameEmpty) {
            ctx.discardGame(gameId);

            logger.info(`Game ${gameId} deleted because all players left`);

            return {
                gameDeleted: true,
                gameFinished: false,
                message: "You have left the game.",
            };
        }

        broadcaster.toGame(gameId, SERVER_EVENTS.PLAYER_LEFT, {
            playerId,
            playerName: removal.playerName,
            newHostId: removal.hostId,
            newHostName: removal.newHostName,
        });

        // The game ends when fewer than two players remain.
        if (removal.gameFinished) {
            broadcaster.toGame(gameId, SERVER_EVENTS.GAME_FINISHED, {
                leaderboard: game.leaderboard,
                reason: "Not enough players remain.",
            });
        }

        // The departing player may have been the current player.
        broadcaster.progression(gameId, game, removal.progression);

        ctx.publishState(gameId);

        logger.info(`${removal.playerName} permanently left game ${gameId}`);

        return {
            gameDeleted: false,
            gameFinished: removal.gameFinished,
            message: "You have permanently left the game.",
        };
    });
}

// ============================================================================
// HANDLERS: GAME
// ============================================================================

/**
 * selectStocks, startGame, takeTurn, passTurn, nextCycle
 */


function registerGameHandlers(ctx, socket) {
    const { gameService, broadcaster, logger } = ctx;
    const on = (event, fn) => socket.on(event, handle(logger, event, fn));

    /**
     * Broadcast a completed turn and return the ack payload.
     */
    function publishTurn(gameId, playerId, game, result) {
        broadcaster.turnAction(gameId, playerId, result);
        broadcaster.progression(gameId, game, result.progression);
        ctx.publishState(gameId);

        return {
            ...result,
            gameState: broadcaster.viewFor(gameId, playerId),
        };
    }

    on(CLIENT_EVENTS.SELECT_STOCKS, payload => {
        const { gameId, playerId } = requireSession(ctx, socket);
        const stockIds = parseStockIds(payload.stockIds);
        const { result } = gameService.selectStocks({ gameId, playerId, stockIds });

        // Guests see the host's selection through their next gameState.
        ctx.publishState(gameId);

        return {
            ...result,
            gameState: broadcaster.viewFor(gameId, playerId),
        };
    });

    on(CLIENT_EVENTS.START_GAME, () => {
        const { gameId, playerId } = requireSession(ctx, socket);
        const { result } = gameService.startGame({ gameId, playerId });

        broadcaster.toGame(gameId, SERVER_EVENTS.GAME_STARTED, {
            cycle: result.cycle,
            actionRound: result.actionRound,
            turnOrder: result.turnOrder,
        });

        ctx.publishState(gameId);

        logger.info(`Game ${gameId} started`);

        return {
            ...result,
            gameState: broadcaster.viewFor(gameId, playerId),
        };
    });

    on(CLIENT_EVENTS.TAKE_TURN, payload => {
        const { gameId, playerId } = requireSession(ctx, socket);
        const turn = parseTurnPayload(payload);
        const { game, result } = gameService.takeTurn({
            gameId,
            playerId,
            ...turn,
        });

        return publishTurn(gameId, playerId, game, result);
    });

    on(CLIENT_EVENTS.PASS_TURN, () => {
        const { gameId, playerId } = requireSession(ctx, socket);
        const { game, result } = gameService.passTurn({ gameId, playerId });

        return publishTurn(gameId, playerId, game, result);
    });

    on(CLIENT_EVENTS.NEXT_CYCLE, () => {
        const { gameId, playerId } = requireSession(ctx, socket);
        const { game, result } = gameService.nextCycle({ gameId, playerId });

        if (result.finished) {
            broadcaster.toGame(gameId, SERVER_EVENTS.GAME_FINISHED, {
                leaderboard: game.leaderboard,
                reason: result.reason,
            });

            logger.info(`Game ${gameId} finished: ${result.reason}`);
        } else {
            broadcaster.toGame(gameId, SERVER_EVENTS.CYCLE_STARTED, {
                cycle: result.cycle,
                actionRound: result.actionRound,
                currentPlayerId: result.currentPlayerId,
            });

            logger.info(`Game ${gameId} started cycle ${result.cycle}`);
        }

        ctx.publishState(gameId);

        return {
            ...result,
            gameState: broadcaster.viewFor(gameId, playerId),
        };
    });
}

// ============================================================================
// HANDLERS: CONNECTION
// ============================================================================

/**
 * disconnect
 */


function registerConnectionHandlers(ctx, socket) {
    socket.on("disconnect", reason => {
        ctx.connectionStats.decrement();

        releaseSocket(ctx, socket);

        ctx.logger.info(
            `Player disconnected: ${socket.id} (${reason}) ` +
            `(Total: ${ctx.connectionStats.connectedSockets}/` +
            `${ctx.limits.maxConnectedSockets})`
        );
    });
}

// ============================================================================
// SOCKET SERVER
// ============================================================================

/**
 * Socket.IO server: builds the handler context and wires every handler.
 */



/**
 * @returns {{ io: Server, expireGame: (gameId: string) => void, close: () => void }}
 */
export function registerSocketServer(httpServer, {
    gameService,
    gameStore,
    sessions,
    connectionStats,
    limits,
    corsOrigin,
    logger,
}) {
    const io = new Server(httpServer, {
        cors: {
            origin: corsOrigin,
            methods: ["GET", "POST"],
        },
    });

    const broadcaster = createBroadcaster({ io, sessions, gameService });

    const turnTimer = createTurnTimer({
        gameStore,
        timeoutMs: limits.autoPassTimeoutMs,
        onTimeout: handleTurnTimeout,
    });

    const ctx = {
        io,
        gameService,
        sessions,
        connectionStats,
        broadcaster,
        limits,
        logger,

        /**
         * Push every player's view and re-evaluate the auto-pass timer.
         * Call after any change to game state or presence.
         */
        publishState(gameId) {
            broadcaster.gameState(gameId);
            turnTimer.sync(gameId);
        },

        /**
         * Drop all transport state for a game that no longer exists.
         */
        discardGame(gameId) {
            turnTimer.clear(gameId);
            sessions.removeGame(gameId);
            io.in(gameId).socketsLeave(gameId);
        },
    };

    function handleTurnTimeout(gameId, playerId) {
        try {
            const outcome = gameService.autoPass({ gameId, playerId });

            if (!outcome) {
                turnTimer.sync(gameId);
                return;
            }

            broadcaster.turnAction(gameId, playerId, outcome.result);
            broadcaster.progression(gameId, outcome.game, outcome.result.progression);
            ctx.publishState(gameId);

            logger.info(`Auto-passed offline player ${playerId} in game ${gameId}`);
        } catch (error) {
            logger.error(`Auto-pass failed in game ${gameId}:`, error);
        }
    }

    io.on("connection", socket => {
        if (rejectIfServerFull(ctx, socket)) return;

        connectionStats.increment();

        logger.info(
            `Player connected: ${socket.id} ` +
            `(${connectionStats.connectedSockets}/${limits.maxConnectedSockets})`
        );

        trackActivity(ctx, socket);

        registerLobbyHandlers(ctx, socket);
        registerGameHandlers(ctx, socket);
        registerConnectionHandlers(ctx, socket);
    });

    return {
        io,

        /**
         * Notify the room and drop transport state for an idle game.
         * The cleanup job deletes the game from the store afterwards.
         */
        expireGame(gameId) {
            broadcaster.toGame(gameId, SERVER_EVENTS.GAME_EXPIRED, {
                message: "This game was closed after a period of inactivity.",
            });

            ctx.discardGame(gameId);
        },

        close() {
            turnTimer.stopAll();
            io.close();
        },
    };
}
