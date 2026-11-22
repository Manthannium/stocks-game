/**
 * ============================================================================
 * SERVER CONFIGURATION
 * ============================================================================
 *
 * Environment settings and server limits.
 * Game rules (stocks, purse, cards) live in game.js.
 */

function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

// ============================================================================
// ENVIRONMENT
// ============================================================================

export const env = Object.freeze({
    PORT: toNumber(process.env.PORT, 3000),
    HOST: process.env.HOST || "0.0.0.0",

    // Comma-separated list of allowed origins, or "*".
    CORS_ORIGIN: process.env.CORS_ORIGIN || "*",

    NODE_ENV: process.env.NODE_ENV || "development",
});

export function parseCorsOrigin(value) {
    if (!value || value === "*") return "*";

    return value.split(",").map(origin => origin.trim()).filter(Boolean);
}

// ============================================================================
// LIMITS
// ============================================================================

export const LIMITS = Object.freeze({
    maxConcurrentGames: 50,
    maxConnectedSockets: 200,

    gameIdleTimeoutMs: 60 * 60 * 1000,   // 1 hour
    cleanupIntervalMs: 10 * 60 * 1000,   // 10 minutes

    // Pass the current player's turn if they stay offline this long.
    autoPassTimeoutMs: toNumber(process.env.AUTO_PASS_TIMEOUT_MS, 60 * 1000),

    maxPlayerNameLength: 22,
});
