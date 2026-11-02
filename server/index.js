
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

const GAME_IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

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

/**
 * Broadcast what happened after a turn advanced
 * either the market opened or turn moved to the next player.
 */
function broadcastProgression(gameCode, game, progression) {
    if(!progression) return;

    if (progression.cycleComplete) {
        broadcastToGame(gameCode, "openPhaseCompleted", {
            openResult: progression.openResult,
        });
    } else {
        broadcastToGame(gameCode, "turnChanged", {
            cycle: game.cycle,
            actionRound: game.actionRound,
            currentPlayerId: progression.currentPlayerId,
        });
    }
}


// ============================================================================
// AUTOMATIC CLEANUP
// ============================================================================

/**
 * Remove games with no activity for GAME_IDLE_TIMEOUT_MS (1 hour)
 * Activity = any socket event sent by player in game
 */
setInterval(() => {
    const idleCutoff = Date.now() - GAME_IDLE_TIMEOUT_MS;

    let cleanedCount = 0;

    for (const [gameCode, game] of games.entries()) {
        const lastActivity = game.lastActivityAt || game.createdAt || 0;
        if (lastActivity < idleCutoff) {
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
}, CLEANUP_INTERVAL_MS);

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
    // ACTIVITY TRACKING
    // ========================================================================

    socket.use((_packet, next) => {
        const info = playerSockets.get(socket.id);

        if (info) {
            const game = games.get(info.gameId);

            if (game) {
                game.lastActivityAt = Date.now();
            }
        }

        next();
    });

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
        game.lastActivityAt = game.createdAt;

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

        // push th standard per-player game state as well
        broadcastGameState(gameCode);
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

        game.lastActivityAt = Date.now();

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

        const cycle = game.cycle;
        const actionRound = game.actionRound;

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

            broadcastProgression(gameId, game, result.progression);

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

        const cycle = game.cycle;
        const actionRound = game.actionRound;

        try {
            const result = GameLogic.passTurn(
                game,
                playerId
            );

            broadcastToGame(gameId, "turnAction", {
                playerId,
                action: "PASS",
                cycle: game.cycle,
                actionRound: game.actionRound,
            });

            broadcastProgression(gameId, game, result.progression);

            broadcastGameState(gameId);

            return reply(callback, {
                ...result,
                gameState: GameLogic.getPlayerView(
                    game,
                    playerId
                ),
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
        const code = String(payload.gameCode || "")
            .trim()
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
                error: "Game not found. The game may have expired.",
            });
        }

        // Find the existing player. Do not create a new player.
        const player = game.players.find(
            item => item.id === playerId
        );

        if (!player) {
            return reply(callback, {
                success: false,
                error: "Player not found in this game.",
            });
        }

        // Remove any previous socket mapping for this player.
        // This handles cases where the old connection is still present.
        for (const [oldSocketId, info] of playerSockets.entries()) {
            if (
                info.gameId === code &&
                info.playerId === playerId
            ) {
                playerSockets.delete(oldSocketId);

                const oldSocket = io.sockets.sockets.get(oldSocketId);

                if (oldSocket) {
                    oldSocket.leave(code);
                }
            }
        }

        // Associate the new socket with the existing player.
        playerSockets.set(socket.id, {
            gameId: code,
            playerId,
        });
        player.isOnline = true;
        game.lastActivityAt = Date.now();

        // Add the new socket to the existing game room.
        socket.join(code);

        // Get this player's private game view.
        const state = getSocketGameState(code, playerId);

        if (!state) {
            playerSockets.delete(socket.id);

            return reply(callback, {
                success: false,
                error: "Could not restore game state.",
            });
        }

        // Send the state directly to the reconnecting player.
        socket.emit("gameState", state);

        // Return the restored state through the acknowledgement callback.
        reply(callback, {
            success: true,
            gameCode: code,
            playerId,
            gameState: state.game,
        });

        // Notify the other players.
        broadcastToGame(code, "playerReconnected", {
            playerId,
            playerName: player.name,
        });

        // Refresh every player's view.
        broadcastGameState(code);

        console.log(
            `${player.name} reconnected to game ${code}`
        );
    });

    // ========================================================================
    // LEAVE GAME
    // ========================================================================

    socket.on("leaveGame", (_payload = {}, callback) => {
        const context = getSocketGame(socket.id);

        if (!context.success) {
            return reply(callback, context);
        }

        const { game, gameId, playerId } = context;

        // Permanently remove the player and their game assets.
        const result = GameLogic.removePlayer(game, playerId);

        if (!result.success) {
            return reply(callback, result);
        }

        // Remove every socket belonging to this player.
        // This also handles a player leaving from multiple tabs.
        for (const [socketId, info] of playerSockets.entries()) {
            if (
                info.gameId === gameId &&
                info.playerId === playerId
            ) {
                playerSockets.delete(socketId);

                const playerSocket = io.sockets.sockets.get(socketId);

                if (playerSocket) {
                    playerSocket.leave(gameId);
                }
            }
        }

        // If nobody remains, delete the game completely.
        if (result.gameEmpty) {
            games.delete(gameId);
            io.in(gameId).socketsLeave(gameId);

            console.log(`Game ${gameId} deleted because all players left`);

            return reply(callback, {
                success: true,
                gameDeleted: true,
                message: "You have left the game.",
            });
        }

        // Notify remaining players.
        broadcastToGame(gameId, "playerLeft", {
            playerId,
            playerName: result.playerName,
            newHostId: result.hostId,
        });

        // The game may have ended because fewer than two players remain.
        if (result.gameFinished) {
            broadcastToGame(gameId, "gameFinished", {
                leaderboard: game.leaderboard,
                reason: "Not enough players remain.",
            });
        }

        // The departing player may have been the last player in a round.
        // In that case, GameLogic.removePlayer() advances the game.
        if (result.progression?.cycleComplete) {
            broadcastToGame(gameId, "openPhaseCompleted", {
                openResult: result.progression.openResult,
            });
        } else if (result.progression) {
            broadcastToGame(gameId, "turnChanged", {
                cycle: game.cycle,
                actionRound: game.actionRound,
                currentPlayerId: result.progression.currentPlayerId,
            });
        }

        // Send each remaining player their updated private game view.
        broadcastGameState(gameId);

        console.log(
            `${result.playerName} permanently left game ${gameId}`
        );

        return reply(callback, {
            success: true,
            gameDeleted: false,
            gameFinished: result.gameFinished,
            message: "You have permanently left the game.",
        });
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

        // Remove this socket before checking for other connections.
        playerSockets.delete(socket.id);

        if (playerInfo) {
            const { gameId, playerId } = playerInfo;
            const game = games.get(gameId);

            if (game) {
                const player = game.players.find(
                    item => item.id === playerId
                );

                // A player may have multiple tabs connected.
                const stillConnected = [...playerSockets.values()].some(
                    info =>
                        info.gameId === gameId &&
                        info.playerId === playerId
                );

                if (player && !stillConnected) {
                    player.isOnline = false;

                    broadcastToGame(gameId, "playerDisconnected", {
                        playerId,
                        playerName: player.name,
                    });

                    broadcastGameState(gameId);
                }
            }
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
