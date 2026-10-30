
/**
 * ============================================================================
 * STOCKS GAME SERVER
 * ============================================================================
 *
 * Express + Socket.IO server.
 *
 * Responsibilities:
 * - Create and manage game rooms.
 * - Join and reconnect players.
 * - Handle player actions.
 * - Broadcast player-specific game state.
 * - Manage game cycles.
 * - Clean up stale games.
 */

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

import * as GameLogic from "./gameLogic.js";

// ============================================================================
// EXPRESS SETUP
// ============================================================================

const app = express();

app.use(cors());
app.use(express.json());

// ============================================================================
// IN-MEMORY STATE
// ============================================================================

/**
 * Map:
 * gameCode -> game state
 */
const games = new Map();

/**
 * Map:
 * socketId -> {
 *     gameId,
 *     playerId
 * }
 */
const playerSockets = new Map();

// Server capacity limits.
const MAX_CONCURRENT_GAMES = 50;
const MAX_TOTAL_PLAYERS = 200;

let totalConnectedPlayers = 0;

// ============================================================================
// HTTP ENDPOINTS
// ============================================================================

app.get("/", (req, res) => {
    res.json({
        name: "Stocks Game Server",
        status: "running",
        version: "1.0.0",

        endpoints: {
            health: "/health",
            ping: "/ping",
            socket: "ws://[this-url]",
        },

        author: "Manthan Patel",
    });
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok",

        uptime: process.uptime(),

        activeGames: games.size,
        maxGames: MAX_CONCURRENT_GAMES,

        connectedPlayers: totalConnectedPlayers,
        maxPlayers: MAX_TOTAL_PLAYERS,

        timestamp: new Date().toISOString(),
    });
});

app.get("/ping", (req, res) => {
    res.send("pong");
});

// ============================================================================
// SOCKET.IO SETUP
// ============================================================================

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

// ============================================================================
// GAME CODE GENERATION
// ============================================================================

/**
 * Generates a unique 4-character game code.
 *
 * Ambiguous characters are excluded:
 * 0, O, 1, I
 */
function generateGameCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code;

    do {
        code = "";

        for (let i = 0; i < 4; i++) {
            code += chars.charAt(
                Math.floor(Math.random() * chars.length)
            );
        }
    } while (games.has(code));

    return code;
}

// ============================================================================
// BROADCAST HELPERS
// ============================================================================

function getSocketGameState(gameCode, playerId) {
    const game = games.get(gameCode);

    if (!game) return null;

    const gameView = GameLogic.getPlayerView(game, playerId);

    if (!gameView?.success) return null;

    return {
        game: gameView,
        gameCode,
        playerId,
    };
}

/**
 * Send each connected player their own game view.
 *
 * This is important because each player should only see
 * their own private cards during active play.
 */

function broadcastGameState(gameCode) {
    const game = games.get(gameCode);

    if (!game) return;

    for (const [socketId, info] of playerSockets.entries()) {
        if (info.gameId !== gameCode) continue;

        const payload = getSocketGameState(
            gameCode,
            info.playerId
        );

        if (payload) {
            io.to(socketId).emit("gameState", payload);
        }
    }
}

/**
 * Broadcast identical public information to the entire room.
 */
function broadcastToGame(gameCode, event, data) {
    if (!games.has(gameCode)) return;

    io.to(gameCode).emit(event, data);
}

/**
 * Get the player and game associated with a socket.
 */
function getSocketGame(socketId) {
    const playerInfo = playerSockets.get(socketId);

    if (!playerInfo) {
        return {
            success: false,
            error: "You are not in a game",
        };
    }

    const game = games.get(playerInfo.gameId);

    if (!game) {
        return {
            success: false,
            error: "Game not found",
        };
    }

    return {
        success: true,
        game,
        gameId: playerInfo.gameId,
        playerId: playerInfo.playerId,
    };
}

/**
 * Safe callback helper.
 */
function reply(callback, result) {
    if (typeof callback === "function") {
        callback(result);
    }
}

// ============================================================================
// AUTOMATIC CLEANUP
// ============================================================================

/**
 * Remove games older than 3 hours.
 *
 * This cleanup is based on creation time, not last activity.
 */
setInterval(() => {
    const threeHoursAgo =
        Date.now() - (3 * 60 * 60 * 1000);

    let cleanedCount = 0;

    for (const [gameCode, game] of games.entries()) {
        if (
            game.createdAt &&
            game.createdAt < threeHoursAgo
        ) {
            games.delete(gameCode);

            // Remove socket mappings associated with this game.
            for (const [socketId, info] of playerSockets.entries()) {
                if (info.gameId === gameCode) {
                    playerSockets.delete(socketId);
                }
            }

            // Remove sockets from the room.
            io.in(gameCode).socketsLeave(gameCode);

            cleanedCount++;
        }
    }

    if (cleanedCount > 0) {
        console.log(
            `Cleaned up ${cleanedCount} stale games. ` +
            `Active games: ${games.size}`
        );
    }
}, 30 * 60 * 1000);

// ============================================================================
// SOCKET CONNECTION
// ============================================================================

io.on("connection", socket => {
    // ------------------------------------------------------------------------
    // CONNECTION CAPACITY
    // ------------------------------------------------------------------------

    if (totalConnectedPlayers >= MAX_TOTAL_PLAYERS) {
        socket.emit("serverFull", {
            message:
                "Server is at maximum capacity. Please try again later.",

            players: totalConnectedPlayers,
            maxPlayers: MAX_TOTAL_PLAYERS,
        });

        socket.disconnect(true);
        return;
    }

    totalConnectedPlayers++;

    console.log(
        `Player connected: ${socket.id} ` +
        `(${totalConnectedPlayers}/${MAX_TOTAL_PLAYERS})`
    );

    // ========================================================================
    // CREATE GAME
    // ========================================================================

    socket.on("createGame", (payload = {}, callback) => {
        const playerName = payload.playerName?.trim();

        if (!playerName) {
            return reply(callback, {
                success: false,
                error: "Player name is required",
            });
        }

        if (games.size >= MAX_CONCURRENT_GAMES) {
            return reply(callback, {
                success: false,
                error:
                    "Server has reached maximum number of games. " +
                    "Please try again later.",
            });
        }

        const gameCode = generateGameCode();
        const playerId = uuidv4();

        const game = GameLogic.createGame(
            gameCode,
            {
                id: playerId,
                name: playerName,
            }
        );

        game.hostId = playerId;
        game.createdAt = Date.now();

        games.set(gameCode, game);

        playerSockets.set(socket.id, {
            gameId: gameCode,
            playerId,
        });

        socket.join(gameCode);

        console.log(
            `Game ${gameCode} created by ${playerName}`
        );

        reply(callback, {
            success: true,

            gameCode,
            playerId,

            gameState: GameLogic.getPlayerView(
                game,
                playerId
            ),
        });
    });

    // ========================================================================
    // JOIN GAME
    // ========================================================================

    socket.on("joinGame", (payload = {}, callback) => {
        const code = payload.gameCode
            ?.trim()
            .toUpperCase();

        const playerName = payload.playerName?.trim();

        if (!code) {
            return reply(callback, {
                success: false,
                error: "Game code is required",
            });
        }

        if (!playerName) {
            return reply(callback, {
                success: false,
                error: "Player name is required",
            });
        }

        const game = games.get(code);

        if (!game) {
            return reply(callback, {
                success: false,
                error: "Game not found",
            });
        }

        const playerId = uuidv4();

        const result = GameLogic.addPlayer(
            game,
            {
                id: playerId,
                name: playerName,
            }
        );

        if (!result.success) {
            return reply(callback, result);
        }

        playerSockets.set(socket.id, {
            gameId: code,
            playerId,
        });

        socket.join(code);

        const player = game.players.find(
            item => item.id === playerId
        );

        reply(callback, {
            success: true,

            gameCode: code,
            playerId,

            gameState: GameLogic.getPlayerView(
                game,
                playerId
            ),
        });

        broadcastToGame(code, "playerJoined", {
            player: {
                id: player.id,
                name: player.name,
                color: player.color,
            },
        });

        broadcastGameState(code);

        console.log(
            `${playerName} joined game ${code}`
        );
    });

    // ========================================================================
    // START GAME
    // ========================================================================

    socket.on("startGame", (_payload = {}, callback) => {
        const context = getSocketGame(socket.id);

        if (!context.success) {
            return reply(callback, context);
        }

        const {
            game,
            gameId,
            playerId,
        } = context;

        if (game.hostId !== playerId) {
            return reply(callback, {
                success: false,
                error: "Only the host can start the game",
            });
        }

        const result = GameLogic.startGame(game);

        if (!result.success) {
            return reply(callback, result);
        }

        broadcastToGame(gameId, "gameStarted", {
            cycle: game.cycle,
            actionRound: game.actionRound,
            turnOrder: result.turnOrder,
        });

        broadcastGameState(gameId);

        reply(callback, {
            ...result,

            gameState: GameLogic.getPlayerView(
                game,
                playerId
            ),
        });

        console.log(
            `Game ${gameId} started`
        );
    });

    socket.on("gameState", (payload) => {
        setGame(payload.game);
        setGameCode(payload.gameCode);
        setPlayerId(payload.playerId);
    });

    // ========================================================================
    // TAKE TURN
    // ========================================================================

    socket.on("takeTurn", (payload = {}, callback) => {
        const context = getSocketGame(socket.id);

        if (!context.success) {
            return reply(callback, context);
        }

        const {
            game,
            gameId,
            playerId,
        } = context;

        const {
            action,
            stockId = null,
            shares = 0,
        } = payload;

        try {
            const result = GameLogic.takeTurn(
                game,
                playerId,
                action,
                stockId,
                shares
            );

            broadcastToGame(gameId, "turnAction", {
                playerId,
                action: String(action).toUpperCase(),
                stockId,
                shares,
                cycle: game.cycle,
                actionRound: game.actionRound,
            });

            if (result.progression?.cycleComplete) {
                broadcastToGame(gameId, "openPhaseCompleted", {
                    openResult: result.progression.openResult,
                });
            } else if (result.progression) {
                broadcastToGame(gameId, "turnChanged", {
                    cycle: game.cycle,
                    actionRound: game.actionRound,
                    currentPlayerId:
                        result.progression.currentPlayerId,
                });
            }

            broadcastGameState(gameId);

            return reply(callback, {
                ...result,
                success: true,
                gameState: getSocketGameState(gameId, playerId),
            });

        } catch (error) {
            socket.emit("errorMessage", error.message);

            return reply(callback, {
                success: false,
                error: error.message,
            });
        }
    });

    // ========================================================================
    // PASS TURN
    // ========================================================================

    socket.on("passTurn", (_payload = {}, callback) => {
        const context = getSocketGame(socket.id);

        if (!context.success) {
            return reply(callback, context);
        }

        const {
            game,
            gameId,
            playerId,
        } = context;

        const result = GameLogic.passTurn(
            game,
            playerId
        );

        if (!result.success) {
            return reply(callback, result);
        }

        broadcastToGame(gameId, "turnAction", {
            playerId,
            action: "PASS",

            cycle: game.cycle,
            actionRound: game.actionRound,
        });

        if (result.progression.cycleComplete) {
            broadcastToGame(
                gameId,
                "openPhaseCompleted",
                {
                    openResult: result.progression.openResult,
                }
            );
        } else {
            broadcastToGame(gameId, "turnChanged", {
                cycle: game.cycle,

                actionRound: game.actionRound,

                currentPlayerId:
                    result.progression.currentPlayerId,
            });
        }

        broadcastGameState(gameId);

        reply(callback, {
            ...result,

            gameState: GameLogic.getPlayerView(
                game,
                playerId
            ),
        });
    });

    // ========================================================================
    // START NEXT CYCLE
    // ========================================================================

    socket.on("nextCycle", (_payload = {}, callback) => {
        const context = getSocketGame(socket.id);

        if (!context.success) {
            return reply(callback, context);
        }

        const {
            game,
            gameId,
            playerId,
        } = context;

        if (game.hostId !== playerId) {
            return reply(callback, {
                success: false,
                error: "Only the host can start the next cycle",
            });
        }

        const result = GameLogic.startNextCycle(game);

        if (!result.success) {
            return reply(callback, result);
        }

        if (result.finished) {
            broadcastToGame(gameId, "gameFinished", {
                leaderboard: game.leaderboard,
            });

            broadcastGameState(gameId);

            return reply(callback, {
                ...result,

                gameState: GameLogic.getPlayerView(
                    game,
                    playerId
                ),
            });
        }

        broadcastToGame(gameId, "cycleStarted", {
            cycle: game.cycle,

            actionRound: game.actionRound,

            currentPlayerId:
                game.players[game.currentPlayerIndex].id,
        });

        broadcastGameState(gameId);

        reply(callback, {
            ...result,

            gameState: GameLogic.getPlayerView(
                game,
                playerId
            ),
        });

        console.log(
            `Game ${gameId} started cycle ${game.cycle}`
        );
    });

    // ========================================================================
    // REJOIN GAME
    // ========================================================================

    socket.on("rejoinGame", (payload = {}, callback) => {
        const code = payload.gameCode
            ?.trim()
            .toUpperCase();

        const playerId = payload.playerId;

        if (!code || !playerId) {
            return reply(callback, {
                success: false,
                error: "Game code and player ID are required",
            });
        }

        const game = games.get(code);

        if (!game) {
            return reply(callback, {
                success: false,
                error: "Game not found",
            });
        }

        const player = game.players.find(
            item => item.id === playerId
        );

        if (!player) {
            return reply(callback, {
                success: false,
                error: "Player not found in game",
            });
        }

        // Remove any previous socket mapping for this player.
        for (const [oldSocketId, info] of playerSockets.entries()) {
            if (
                info.gameId === code &&
                info.playerId === playerId
            ) {
                playerSockets.delete(oldSocketId);
            }
        }

        playerSockets.set(socket.id, {
            gameId: code,
            playerId,
        });

        socket.join(code);

        reply(callback, {
            success: true,

            gameCode: code,
            playerId,

            gameState: GameLogic.getPlayerView(
                game,
                playerId
            ),
        });

        broadcastToGame(code, "playerReconnected", {
            playerId,
            playerName: player.name,
        });

        broadcastGameState(code);

        console.log(
            `${player.name} rejoined game ${code}`
        );
    });

    // ========================================================================
    // DISCONNECT
    // ========================================================================

    socket.on("disconnect", reason => {
        totalConnectedPlayers = Math.max(
            0,
            totalConnectedPlayers - 1
        );

        const playerInfo = playerSockets.get(socket.id);

        if (playerInfo) {
            const {
                gameId,
                playerId,
            } = playerInfo;

            const game = games.get(gameId);

            if (game) {
                const player = game.players.find(
                    item => item.id === playerId
                );

                if (player) {
                    broadcastToGame(
                        gameId,
                        "playerDisconnected",
                        {
                            playerId,
                            playerName: player.name,
                        }
                    );
                }
            }

            playerSockets.delete(socket.id);
        }

        console.log(
            `Player disconnected: ${socket.id} ` +
            `(${reason}) ` +
            `(Total: ${totalConnectedPlayers}/${MAX_TOTAL_PLAYERS})`
        );
    });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(
        `Stocks server running on port ${PORT}`
    );
});
