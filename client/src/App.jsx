import { useEffect, useState } from "react";

import { socket, emitWithAck } from "./socket";

import LandingPage from "./components/LandingPage";
import Lobby from "./components/Lobby";
import GameTable from "./components/GameTable";

const SESSION_KEY = "market-rush-session";

export default function App() {
  const [screen, setScreen] = useState("landing");

  const [game, setGame] = useState(null);
  const [gameCode, setGameCode] = useState("");
  const [playerId, setPlayerId] = useState("");

  const [connection, setConnection] = useState("connecting");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const onConnect = () => setConnection("connected");
    const onDisconnect = () => setConnection("disconnected");

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

      setNotice(
        "Market opened. Prices and player positions have been updated."
      );
    };

    const onPlayerJoined = (payload) => {
      if (payload?.game) setGame(payload.game);
    };

    const onTurnChanged = (payload) => {
      if (payload?.game) setGame(payload.game);
    };

    const onGameFinished = (payload) => {
      if (payload?.game) setGame(payload.game);
      setNotice("The game has finished.");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    socket.on("gameState", onGameState);
    socket.on("gameStarted", onGameStarted);
    socket.on("cycleStarted", onCycleStarted);
    socket.on("openPhaseCompleted", onOpenPhaseCompleted);
    socket.on("playerJoined", onPlayerJoined);
    socket.on("turnChanged", onTurnChanged);
    socket.on("gameFinished", onGameFinished);

    // Restore the locally saved session details.
    const saved = localStorage.getItem(SESSION_KEY);

    if (saved) {
      try {
        const session = JSON.parse(saved);

        setGameCode(session.gameCode || "");
        setPlayerId(session.playerId || "");
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
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
    };
  }, []);

  function saveSession(code, id) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        gameCode: code,
        playerId: id
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

      if (response.game) {
        setGame(response.game);
      }

      saveSession(code, id);
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

      if (response.game) {
        setGame(response.game);
      }

      saveSession(returnedCode, id);

      setScreen(
        response.game?.phase === "playing" ? "game" : "lobby"
      );
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
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

      if (response.game) setGame(response.game);

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

      if (response.game) setGame(response.game);
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

  const isHost =
    game?.hostPlayerId === playerId ||
    game?.hostId === playerId ||
    game?.host?.id === playerId;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-button" onClick={leaveGame}>
          <span className="brand-mark">M</span>
          <span>
            market<span className="brand-accent">rush</span>
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
        <div className="toast">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}

      <main className="main-content">
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
            onBack={leaveGame}
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
          />
        )}
      </main>

      <footer className="footer-note">
        A strategy game of risk, timing, and market moves.
      </footer>
    </div>
  );
}