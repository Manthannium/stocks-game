/**
 * ============================================================================
 * SERVER UTILITIES
 * ============================================================================
 *
 * Infrastructure around the game logic: logging, game storage, socket
 * sessions, game use cases, the auto-pass timer and idle-game cleanup.
 * Nothing here imports Socket.IO.
 */

import { randomUUID } from "node:crypto";

import * as Game from "./game.js";

const { GameError, PHASE, getCurrentPlayer } = Game;

// ============================================================================
// LOGGER
// ============================================================================

/**
 * Minimal leveled logger. Swap the implementation (e.g. pino)
 * without touching call sites.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

let threshold = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function write(level, method, args) {
    if (LEVELS[level] < threshold) return;

    console[method](`[${new Date().toISOString()}] ${level.toUpperCase()}`, ...args);
}

export const logger = {
    debug: (...args) => write("debug", "log", args),
    info: (...args) => write("info", "log", args),
    warn: (...args) => write("warn", "warn", args),
    error: (...args) => write("error", "error", args),

    setLevel(level) {
        threshold = LEVELS[level] ?? threshold;
    },
};

// ============================================================================
// GAME STORE
// ============================================================================

/**
 * In-memory game storage keyed by game code.
 * Replace this module to add persistence (e.g. Redis).
 */

// Ambiguous characters are excluded: 0, O, 1, I
export const GAME_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const GAME_CODE_LENGTH = 4;

export function createGameStore() {
    const games = new Map();

    return {
        get: gameId => games.get(gameId),
        has: gameId => games.has(gameId),
        set: (gameId, game) => games.set(gameId, game),
        delete: gameId => games.delete(gameId),
        entries: () => games.entries(),

        get size() {
            return games.size;
        },

        /**
         * Generate a game code that is not currently in use.
         */
        generateCode() {
            let code;

            do {
                code = "";

                for (let i = 0; i < GAME_CODE_LENGTH; i++) {
                    code += GAME_CODE_ALPHABET.charAt(
                        Math.floor(Math.random() * GAME_CODE_ALPHABET.length)
                    );
                }
            } while (games.has(code));

            return code;
        },
    };
}

// ============================================================================
// CONNECTION STATS
// ============================================================================

/**
 * Counts accepted socket connections (not unique players:
 * a player with two tabs counts twice).
 */
export function createConnectionStats() {
    let connectedSockets = 0;

    return {
        get connectedSockets() {
            return connectedSockets;
        },

        increment() {
            connectedSockets++;
        },

        decrement() {
            connectedSockets = Math.max(0, connectedSockets - 1);
        },
    };
}

// ============================================================================
// SESSION REGISTRY
// ============================================================================

/**
 * Tracks which socket belongs to which player in which game.
 *
 * A player may have several sockets (multiple tabs); a socket belongs
 * to at most one player in one game.
 */
export function createSessionRegistry() {
    /** socketId -> { gameId, playerId } */
    const bySocket = new Map();

    /** gameId -> Set<socketId> */
    const byGame = new Map();

    function unbind(socketId) {
        const info = bySocket.get(socketId);

        if (!info) return undefined;

        bySocket.delete(socketId);

        const sockets = byGame.get(info.gameId);
        sockets?.delete(socketId);

        if (sockets?.size === 0) {
            byGame.delete(info.gameId);
        }

        return info;
    }

    function socketsForGame(gameId) {
        return [...(byGame.get(gameId) ?? [])].map(socketId => ({
            socketId,
            playerId: bySocket.get(socketId).playerId,
        }));
    }

    return {
        get: socketId => bySocket.get(socketId),

        bind(socketId, gameId, playerId) {
            unbind(socketId);

            bySocket.set(socketId, { gameId, playerId });

            if (!byGame.has(gameId)) {
                byGame.set(gameId, new Set());
            }

            byGame.get(gameId).add(socketId);
        },

        unbind,

        socketsForGame,

        socketsForPlayer(gameId, playerId) {
            return socketsForGame(gameId)
                .filter(entry => entry.playerId === playerId)
                .map(entry => entry.socketId);
        },

        isPlayerConnected(gameId, playerId) {
            return socketsForGame(gameId).some(
                entry => entry.playerId === playerId
            );
        },

        /**
         * Forget every socket in a game.
         *
         * @returns {string[]} the removed socket IDs
         */
        removeGame(gameId) {
            const socketIds = [...(byGame.get(gameId) ?? [])];

            for (const socketId of socketIds) {
                bySocket.delete(socketId);
            }

            byGame.delete(gameId);

            return socketIds;
        },
    };
}

// ============================================================================
// GAME SERVICE (use cases)
// ============================================================================

/**
 * Game use cases. Orchestrates the store and the pure game domain.
 *
 * Knows nothing about sockets: methods take plain values, throw GameError
 * on failure, and return facts that the transport layer turns into events.
 */



/**
 * @param {{
 *   gameStore: ReturnType<typeof createGameStore>,
 *   limits: typeof import("./config.js").LIMITS,
 *   generateId?: () => string,
 *   now?: () => number,
 * }} deps
 */
export function createGameService({
    gameStore,
    limits,
    generateId = randomUUID,
    now = Date.now,
}) {
    function requireGame(gameId) {
        const game = gameStore.get(gameId);

        if (!game) {
            throw new GameError("GAME_NOT_FOUND", "Game not found");
        }

        return game;
    }

    function requireHost(game, playerId, message) {
        if (game.hostId !== playerId) {
            throw new GameError("NOT_HOST", message);
        }
    }

    function touch(game) {
        game.lastActivityAt = now();
    }

    function newCredentials() {
        return {
            playerId: generateId(),
            reconnectToken: generateId(),
        };
    }

    return {
        createGame({ playerName }) {
            if (gameStore.size >= limits.maxConcurrentGames) {
                throw new GameError(
                    "SERVER_GAMES_FULL",
                    "Server has reached maximum number of games. " +
                    "Please try again later."
                );
            }

            const gameCode = gameStore.generateCode();
            const { playerId, reconnectToken } = newCredentials();

            const game = Game.createGame(gameCode, {
                id: playerId,
                name: playerName,
                reconnectToken,
            });

            gameStore.set(gameCode, game);

            return { game, gameCode, playerId, reconnectToken };
        },

        joinGame({ gameCode, playerName }) {
            const game = requireGame(gameCode);
            const { playerId, reconnectToken } = newCredentials();

            const player = Game.addPlayer(game, {
                id: playerId,
                name: playerName,
                reconnectToken,
            });

            touch(game);

            return { game, gameCode, player, playerId, reconnectToken };
        },

        /**
         * Restore an existing seat. Requires the secret reconnect token
         * issued at create/join, since player IDs are public.
         */
        rejoinGame({ gameCode, playerId, reconnectToken }) {
            const game = gameStore.get(gameCode);

            if (!game) {
                throw new GameError(
                    "GAME_NOT_FOUND",
                    "Game not found. The game may have expired."
                );
            }

            const player = Game.getPlayer(game, playerId);

            if (!player || player.reconnectToken !== reconnectToken) {
                throw new GameError(
                    "INVALID_SESSION",
                    "Player not found in this game."
                );
            }

            Game.setPlayerOnline(game, playerId, true);
            touch(game);

            return { game, player };
        },

        /**
         * Host picks which stocks the game will use (lobby only).
         */
        selectStocks({ gameId, playerId, stockIds }) {
            const game = requireGame(gameId);

            requireHost(game, playerId, "Only the host can choose the stocks");

            return { game, result: Game.selectStocks(game, stockIds) };
        },

        startGame({ gameId, playerId }) {
            const game = requireGame(gameId);

            requireHost(game, playerId, "Only the host can start the game");

            return { game, result: Game.startGame(game) };
        },

        takeTurn({ gameId, playerId, action, stockId, shares }) {
            const game = requireGame(gameId);

            return {
                game,
                result: Game.takeTurn(game, playerId, { action, stockId, shares }),
            };
        },

        passTurn({ gameId, playerId }) {
            const game = requireGame(gameId);

            return { game, result: Game.passTurn(game, playerId) };
        },

        /**
         * Pass the turn for a player who is still offline.
         * Does not count as activity, so abandoned games still expire.
         *
         * @returns {{ game, result } | null} null if the turn is no longer theirs
         */
        autoPass({ gameId, playerId }) {
            const game = gameStore.get(gameId);

            if (!game || game.phase !== PHASE.PLAYING) return null;

            const current = Game.getCurrentPlayer(game);

            if (!current || current.id !== playerId || current.isOnline) {
                return null;
            }

            return {
                game,
                result: Game.passTurn(game, playerId, { auto: true }),
            };
        },

        nextCycle({ gameId, playerId }) {
            const game = requireGame(gameId);

            requireHost(game, playerId, "Only the host can start the next cycle");

            return { game, result: Game.startNextCycle(game) };
        },

        /**
         * Permanently remove a player. Deletes the game if nobody remains.
         */
        leaveGame({ gameId, playerId }) {
            const game = requireGame(gameId);
            const removal = Game.removePlayer(game, playerId);

            if (removal.gameEmpty) {
                gameStore.delete(gameId);
            }

            return { game, removal };
        },

        /**
         * @returns {object|null} the player, or null if game/player no longer exist
         */
        setPresence({ gameId, playerId, isOnline }) {
            const game = gameStore.get(gameId);

            if (!game) return null;

            return Game.setPlayerOnline(game, playerId, isOnline);
        },

        recordActivity(gameId) {
            const game = gameStore.get(gameId);

            if (game) touch(game);
        },

        /**
         * @returns {object|null} the player's view, or null if unavailable
         */
        getView(gameId, playerId) {
            const game = gameStore.get(gameId);

            if (!game || !Game.getPlayer(game, playerId)) return null;

            return Game.getPlayerView(game, playerId);
        },

        getGame: gameId => gameStore.get(gameId),
    };
}

// ============================================================================
// AUTO-PASS TURN TIMER
// ============================================================================

/**
 * Auto-pass timer: when the current player is offline, schedule a
 * pass after `timeoutMs` so one disconnected player cannot stall a game.
 *
 * Call sync(gameId) after any change to turn or presence.
 */


/**
 * @param {{
 *   gameStore: { get(gameId: string): object|undefined },
 *   timeoutMs: number,
 *   onTimeout: (gameId: string, playerId: string) => void,
 * }} deps
 */
export function createTurnTimer({ gameStore, timeoutMs, onTimeout }) {
    /** gameId -> { key, handle } */
    const timers = new Map();

    function clear(gameId) {
        const timer = timers.get(gameId);

        if (timer) {
            clearTimeout(timer.handle);
            timers.delete(gameId);
        }
    }

    /**
     * Identifies "this offline player's turn in this round".
     * Null when no timer should be running.
     */
    function timerKey(game) {
        if (game?.phase !== PHASE.PLAYING) return null;

        const current = getCurrentPlayer(game);

        if (!current || current.isOnline) return null;

        return `${current.id}:${game.cycle}:${game.actionRound}`;
    }

    function sync(gameId) {
        const game = gameStore.get(gameId);
        const key = timerKey(game);

        if (timers.get(gameId)?.key === key) return;

        clear(gameId);

        if (!key) return;

        const playerId = getCurrentPlayer(game).id;

        const handle = setTimeout(() => {
            timers.delete(gameId);
            onTimeout(gameId, playerId);
        }, timeoutMs);

        handle.unref?.();
        timers.set(gameId, { key, handle });
    }

    function stopAll() {
        for (const gameId of [...timers.keys()]) {
            clear(gameId);
        }
    }

    return { sync, clear, stopAll };
}

// ============================================================================
// IDLE GAME CLEANUP
// ============================================================================

/**
 * Periodically remove games with no player activity.
 * Activity = any socket event sent by a player in the game.
 */

/**
 * @param {{
 *   gameStore: ReturnType<typeof createGameStore>,
 *   limits: { gameIdleTimeoutMs: number, cleanupIntervalMs: number },
 *   onExpire: (gameId: string) => void,  called before the game is deleted
 *   logger?: { info: Function },
 *   now?: () => number,
 * }} deps
 * @returns {{ runOnce: () => number, stop: () => void }}
 */
export function startIdleGameCleanup({
    gameStore,
    limits,
    onExpire,
    logger,
    now = Date.now,
}) {
    function runOnce() {
        const idleCutoff = now() - limits.gameIdleTimeoutMs;
        let cleanedCount = 0;

        for (const [gameId, game] of [...gameStore.entries()]) {
            const lastActivity = game.lastActivityAt || game.createdAt || 0;

            if (lastActivity >= idleCutoff) continue;

            onExpire(gameId);
            gameStore.delete(gameId);
            cleanedCount++;
        }

        if (cleanedCount > 0) {
            logger?.info(
                `Cleaned up ${cleanedCount} stale games. ` +
                `Active games: ${gameStore.size}`
            );
        }

        return cleanedCount;
    }

    const interval = setInterval(runOnce, limits.cleanupIntervalMs);
    interval.unref?.();

    return {
        runOnce,
        stop: () => clearInterval(interval),
    };
}
