import { useEffect, useRef, useState } from "react";
import { socket, emitWithAck } from "./socket";
import LandingPage from "./components/LandingPage";
import Lobby from "./components/Lobby";
import GameTable from "./components/GameTable";

const SESSION_KEY = "stocks-game-session";

export default function App() {
  const [screen, setScreen] = useState("landing");

  const [game, setGame] = useState(null);
  const [gameCode, setGameCode] = useState("");
  const [playerId, setPlayerId] = useState("");

  const [connection, setConnection] = useState("connecting");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  // Socket listeners are registered once, so they read the latest
  // player ID through a ref to skip notices about the player themselves.
  const playerIdRef = useRef("");
  playerIdRef.current = playerId;

  const latestGameRef = useRef(null);
  latestGameRef.current = game;

  useEffect(() => {
    const onConnect = () => {
      setConnection("connected");

      // Automatically rejoin the previous game after a reload
      // or Socket.IO reconnection.
      const saved = localStorage.getItem(SESSION_KEY);

      if (!saved) return;

      try {
        const session = JSON.parse(saved);
        const savedGameCode = session.gameCode;
        const savedPlayerId = session.playerId;
        const savedToken = session.reconnectToken;

        if (!savedGameCode || !savedPlayerId || !savedToken) {
          localStorage.removeItem(SESSION_KEY);
          return;
        }

        socket.emit(
          "rejoinGame",
          {
            gameCode: savedGameCode,
            playerId: savedPlayerId,
            reconnectToken: savedToken,
          },
          (response) => {
            if (!response?.success) {
              const reason = response?.error || "Unknown error";
              console.error("Could not rejoin game:", reason);
              localStorage.removeItem(SESSION_KEY);
              setNotice(`Could not rejoin game: ${reason}`);
              return;
            }

            setGameCode(response.gameCode || savedGameCode);
            setPlayerId(response.playerId || savedPlayerId);

            // The callback returns the player's game state.
            if (response.gameState) {
              setGame(response.gameState);

              setScreen(
                response.gameState.phase === "waiting"
                  ? "lobby"
                  : "game"
              );
            }
          }
        );
      } catch (error) {
        console.error("Error restoring game session:", error);
        localStorage.removeItem(SESSION_KEY);
      }
    };

    const onDisconnect = () => {
      setConnection("disconnected");
    };

    const onGameState = (payload) => {
      const incomingGame = payload?.game || payload;

      if (!incomingGame) return;

      setGame(incomingGame);

      if (payload?.playerId) {
        setPlayerId(payload.playerId);
      }

      if (payload?.gameCode) {
        setGameCode(payload.gameCode);
      }

      setScreen(
        incomingGame.phase === "waiting" ? "lobby" : "game"
      );
    };

    const onGameStarted = (payload) => {
      if (payload?.game) setGame(payload.game);
      setScreen("game");
    };

    const onCycleStarted = (payload) => {
      if (payload?.game) setGame(payload.game);
      setScreen("game");
    };

    const onOpenPhaseCompleted = (payload) => {
      if (payload?.game) setGame(payload.game);
    };

    const onPlayerJoined = (payload) => {
      if (payload?.game) setGame(payload.game);
    };

    const onTurnChanged = (payload) => {
      if (payload?.game) setGame(payload.game);
    };

    const onGameFinished = (payload) => {
      if (payload?.game) setGame(payload.game);
      setNotice(
        payload?.reason
          ? `The game has finished: ${payload.reason}`
          : "The game has finished."
      );
    };

    const isMe = (id) => id && id === playerIdRef.current;

    const onPlayerLeft = (payload) => {
      if (isMe(payload?.playerId)) return;

      const hostNote =
        payload?.newHostName && isMe(payload?.newHostId)
          ? " You are now the host."
          : payload?.newHostName
          ? ` ${payload.newHostName} is now the host.`
          : "";

      setNotice(`${payload?.playerName || "A player"} left the game.${hostNote}`);
    };

    const onPlayerDisconnected = (payload) => {
      if (isMe(payload?.playerId)) return;
      setNotice(`${payload?.playerName || "A player"} disconnected.`);
    };

    const onPlayerReconnected = (payload) => {
      if (isMe(payload?.playerId)) return;
      setNotice(`${payload?.playerName || "A player"} reconnected.`);
    };

    // Trades already appear in the logbook; only surface automatic passes.
    const onTurnAction = (payload) => {
      if (!payload?.auto) return;

      const name =
        latestGameRef.current?.players?.find(
          (player) => player.id === payload.playerId
        )?.name || "An offline player";

      setNotice(
        isMe(payload.playerId)
          ? "Your turn was passed automatically while you were offline."
          : `${name} is offline. Their turn was passed automatically.`
      );
    };

    const onServerFull = (payload) => {
      setNotice(
        payload?.message ||
          "Server is at maximum capacity. Please try again later."
      );
    };

    const onGameExpired = (payload) => {
      localStorage.removeItem(SESSION_KEY);
      setGame(null);
      setGameCode("");
      setPlayerId("");
      setScreen("landing");
      setNotice(payload?.message || "This game has expired.");
    };

    // Register listeners
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    socket.on("gameState", onGameState);
    socket.on("gameStarted", onGameStarted);
    socket.on("cycleStarted", onCycleStarted);
    socket.on("openPhaseCompleted", onOpenPhaseCompleted);
    socket.on("playerJoined", onPlayerJoined);
    socket.on("turnChanged", onTurnChanged);
    socket.on("gameFinished", onGameFinished);
    socket.on("playerLeft", onPlayerLeft);
    socket.on("playerDisconnected", onPlayerDisconnected);
    socket.on("playerReconnected", onPlayerReconnected);
    socket.on("turnAction", onTurnAction);
    socket.on("serverFull", onServerFull);
    socket.on("gameExpired", onGameExpired);

    // Handle the case where the socket is already connected
    // when this component mounts.
    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);

      socket.off("gameState", onGameState);
      socket.off("gameStarted", onGameStarted);
      socket.off("cycleStarted", onCycleStarted);
      socket.off("openPhaseCompleted", onOpenPhaseCompleted);
      socket.off("playerJoined", onPlayerJoined);
      socket.off("turnChanged", onTurnChanged);
      socket.off("gameFinished", onGameFinished);
      socket.off("playerLeft", onPlayerLeft);
      socket.off("playerDisconnected", onPlayerDisconnected);
      socket.off("playerReconnected", onPlayerReconnected);
      socket.off("turnAction", onTurnAction);
      socket.off("serverFull", onServerFull);
      socket.off("gameExpired", onGameExpired);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(id);
  }, [notice]);

  // The reconnect token is a secret that proves this browser owns the seat.
  function saveSession(code, id, reconnectToken) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        gameCode: code,
        playerId: id,
        reconnectToken
      })
    );
  }

  async function createGame(playerName) {
    setBusy(true);
    setNotice("");

    try {
      const response = await emitWithAck("createGame", {
        playerName,
        name: playerName
      });

      const code =
        response.gameCode ||
        response.code ||
        response.game?.gameCode;

      const id =
        response.playerId ||
        response.player?.id ||
        response.id;

      if (!code || !id) {
        throw new Error(
          "Server response must contain gameCode and playerId."
        );
      }

      setGameCode(code);
      setPlayerId(id);

      const state = response.gameState || response.game;
      if (state) {
        setGame(state);
      }

      saveSession(code, id, response.reconnectToken);
      setScreen("lobby");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function joinGame(playerName, enteredCode) {
    setBusy(true);
    setNotice("");

    const code = enteredCode.trim().toUpperCase();

    try {
      const response = await emitWithAck("joinGame", {
        gameCode: code,
        code,
        playerName,
        name: playerName
      });

      const returnedCode =
        response.gameCode || response.code || code;

      const id =
        response.playerId ||
        response.player?.id ||
        response.id;

      if (!id) {
        throw new Error(
          "Server response must contain playerId."
        );
      }

      setGameCode(returnedCode);
      setPlayerId(id);

      const state = response.gameState || response.game;

      if (state) {
        setGame(state);
      }

      saveSession(returnedCode, id, response.reconnectToken);

      setScreen(
        state && state.phase !== "waiting" ? "game" : "lobby"
      );
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  // Host-only: replace the lobby's stock selection.
  // Throws so the lobby can roll back its optimistic selection.
  async function selectStocks(stockIds) {
    try {
      const response = await emitWithAck("selectStocks", { stockIds });

      if (response.gameState) {
        setGame(response.gameState);
      }
    } catch (error) {
      setNotice(error.message);
      throw error;
    }
  }

  async function startGame() {
    setBusy(true);
    setNotice("");

    try {
      const response = await emitWithAck("startGame", {
        gameCode,
        code: gameCode
      });

      const state = response.gameState || response.game;
      if (state) {
        setGame(state);
      }

      setScreen("game");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function takeTurn(action, stockId, shares) {
    setNotice("");

    try {
      await emitWithAck("takeTurn", {
        gameCode,
        code: gameCode,
        action,
        stockId,
        shares
      });
    } catch (error) {
      setNotice(error.message);
      throw error;
    }
  }

  async function startNextCycle() {
    setBusy(true);
    setNotice("");

    try {
      const response = await emitWithAck("nextCycle", {
        gameCode,
        code: gameCode
      });

      const state = response.gameState || response.game;
      if (state) {
        setGame(state);
      }

    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  function leaveGame() {
    setGame(null);
    setGameCode("");
    setPlayerId("");

    localStorage.removeItem(SESSION_KEY);

    setScreen("landing");
  }

  const handleLeaveGame = () => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently leave this game? Your cash, cards and stock positions will be removed."
    );

    if (!confirmed) return;

    socket.emit("leaveGame", {}, (response) => {
      if (!response?.success) {
        if (
          response?.code === "NOT_IN_GAME" ||
          response?.code === "GAME_NOT_FOUND"
        ) {
          leaveGame();
          return;
        }

        setNotice(
          response?.error || "Unable to leave the game."
        );
        return;
      }

      // Remove the saved reconnect session.
      localStorage.removeItem(SESSION_KEY);

      // Return to the landing screen.
      window.location.reload();
    });
  };

  const isHost =
    game?.hostPlayerId === playerId ||
    game?.hostId === playerId ||
    game?.host?.id === playerId;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-button" onClick={gameCode ? handleLeaveGame :leaveGame}>
          <span className="brand-mark">💲</span>
          <span>
            {/* market<span className="brand-accent">rush</span> */}
            stocks-07
          </span>
        </button>

        <div className="topbar-right">
          {gameCode && (
            <span className="room-chip">
              ROOM <b>{gameCode}</b>
            </span>
          )}

          <span className={`connection-pill ${connection}`}>
            <i />
            {connection === "connected"
              ? "Connected"
              : connection === "connecting"
              ? "Connecting"
              : "Disconnected"}
          </span>
        </div>
      </header>

      {notice && (
        <div className="toast" role="alert" aria-live="assertive" key={notice}>
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss">×</button>
          <span className="toast-progress" />
        </div>
      )}

      <main className="main-content" key={screen}>
        {screen === "landing" && (
          <LandingPage
            onCreate={createGame}
            onJoin={joinGame}
            busy={busy}
          />
        )}

        {screen === "lobby" && (
          <Lobby
            game={game}
            gameCode={gameCode}
            playerId={playerId}
            isHost={isHost}
            busy={busy}
            onStart={startGame}
            onSelectStocks={selectStocks}
            onBack={handleLeaveGame}
          />
        )}

        {screen === "game" && (
          <GameTable
            game={game}
            gameCode={gameCode}
            playerId={playerId}
            isHost={isHost}
            busy={busy}
            onAction={takeTurn}
            onNextCycle={startNextCycle}
            onBack={leaveGame}
            onLeave={handleLeaveGame}
          />
        )}
      </main>

      <footer className="footer-note">
        Made with ❤️ by Manthan Patel
      </footer>
    </div>
  );
}