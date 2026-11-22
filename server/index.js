/**
 * ============================================================================
 * STOCKS GAME SERVER
 * ============================================================================
 *
 * Express + Socket.IO entry point.
 *
 * Responsibilities:
 * - Create the Express app and HTTP endpoints.
 * - Create the HTTP server and attach Socket.IO.
 * - Wire the game store, sessions and game service together.
 * - Start the idle-game cleanup job.
 * - Start listening and shut down gracefully.
 *
 * Files:
 *   config.js  environment settings and server limits
 *   game.js    pure game rules
 *   utils.js   logger, game store, sessions, game service, timers
 *   socket.js  Socket.IO events and handlers
 */

import { readFileSync } from "node:fs";
import { createServer } from "node:http";

import cors from "cors";
import express from "express";

import { LIMITS, env, parseCorsOrigin } from "./config.js";
import { registerSocketServer } from "./socket.js";
import {
    createConnectionStats,
    createGameService,
    createGameStore,
    createSessionRegistry,
    logger,
    startIdleGameCleanup,
} from "./utils.js";

const { version } = JSON.parse(
    readFileSync(new URL("./package.json", import.meta.url), "utf8")
);

const corsOrigin = parseCorsOrigin(env.CORS_ORIGIN);

// ============================================================================
// SHARED STATE
// ============================================================================

const gameStore = createGameStore();
const sessions = createSessionRegistry();
const connectionStats = createConnectionStats();
const gameService = createGameService({ gameStore, limits: LIMITS });

// ============================================================================
// EXPRESS SETUP
// ============================================================================

const app = express();

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// ============================================================================
// HTTP ENDPOINTS
// ============================================================================

app.get("/", (_req, res) => {
    res.json({
        name: "Stocks Game Server",
        status: "running",
        version,

        endpoints: {
            health: "/health",
            ping: "/ping",
            socket: "ws://[this-url]",
        },

        author: "Manthan Patel",
    });
});

app.get("/health", (_req, res) => {
    res.json({
        status: "ok",

        uptime: process.uptime(),

        activeGames: gameStore.size,
        maxGames: LIMITS.maxConcurrentGames,

        connectedPlayers: connectionStats.connectedSockets,
        maxPlayers: LIMITS.maxConnectedSockets,

        timestamp: new Date().toISOString(),
    });
});

app.get("/ping", (_req, res) => {
    res.send("pong");
});

// ============================================================================
// HTTP + SOCKET.IO SERVER
// ============================================================================

const httpServer = createServer(app);

const socketServer = registerSocketServer(httpServer, {
    gameService,
    gameStore,
    sessions,
    connectionStats,
    limits: LIMITS,
    corsOrigin,
    logger,
});

// ============================================================================
// AUTOMATIC CLEANUP
// ============================================================================

const cleanup = startIdleGameCleanup({
    gameStore,
    limits: LIMITS,
    logger,
    onExpire: socketServer.expireGame,
});

// ============================================================================
// SERVER STARTUP AND SHUTDOWN
// ============================================================================

httpServer.listen(env.PORT, env.HOST, () => {
    logger.info(`Stocks server running on port ${env.PORT}`);
});

function shutdown(signal) {
    logger.info(`${signal} received, shutting down`);

    cleanup.stop();
    socketServer.close();
    httpServer.close(() => process.exit(0));

    // Force exit if connections do not close in time.
    setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
