import { useState } from "react";
import {
  ArrowRight,
  ChartNoAxesCombined,
  Users,
  Zap
} from "lucide-react";

export default function LandingPage({ onCreate, onJoin, busy }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState("create");

  function submit(event) {
    event.preventDefault();

    if (!name.trim()) return;

    if (mode === "create") {
      onCreate(name.trim());
    } else if (code.trim()) {
      onJoin(name.trim(), code.trim());
    }
  }

  return (
    <section className="landing-grid">
      <div className="hero-copy">
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          MULTIPLAYER MARKET STRATEGY
        </div>

        <h1>
          Beat the market.
          <br />
          <span>Outplay your friends.</span>
        </h1>

        <p className="hero-subtitle">
          Build positions, read the room, and make your move
          before the market opens. Every round changes the game.
        </p>

        <div className="hero-features">
          <div>
            <span className="feature-icon">
              <ChartNoAxesCombined size={18} />
            </span>
            <span>
              <b>Live market</b>
              <small>Watch prices move together</small>
            </span>
          </div>

          <div>
            <span className="feature-icon">
              <Users size={18} />
            </span>
            <span>
              <b>Up to 7 players</b>
              <small>Compete in real time</small>
            </span>
          </div>

          <div>
            <span className="feature-icon">
              <Zap size={18} />
            </span>
            <span>
              <b>Risk & reward</b>
              <small>Buy, sell, short, or cover</small>
            </span>
          </div>
        </div>

        <div className="hero-ticker">
          <span className="ticker-up">▲ NVDA +2.4%</span>
          <span className="ticker-down">▼ AMZN -0.8%</span>
          <span className="ticker-up">▲ META +1.2%</span>
          <span className="ticker-up">▲ MSFT +0.6%</span>
        </div>
      </div>

      <div className="entry-card">
        <div className="entry-card-top">
          <div className="entry-symbol">
            <ChartNoAxesCombined size={22} />
          </div>

          <span className="live-label">
            <i /> LIVE GAME
          </span>
        </div>

        <h2>Enter the exchange</h2>
        <p className="muted">
          Create a new table or join an existing room.
        </p>

        <div className="segmented">
          <button
            className={mode === "create" ? "selected" : ""}
            onClick={() => setMode("create")}
          >
            Create game
          </button>

          <button
            className={mode === "join" ? "selected" : ""}
            onClick={() => setMode("join")}
          >
            Join game
          </button>
        </div>

        <form onSubmit={submit} className="entry-form">
          <label>YOUR DISPLAY NAME</label>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Market Maverick"
            maxLength={22}
            required
          />

          {mode === "join" && (
            <>
              <label>ROOM CODE</label>

              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter room code"
                maxLength={10}
                required
              />
            </>
          )}

          <button
            className="primary-button full-button"
            disabled={
              busy ||
              !name.trim() ||
              (mode === "join" && !code.trim())
            }
          >
            {busy
              ? "Connecting..."
              : mode === "create"
              ? "Create a game"
              : "Join the game"}

            <ArrowRight size={17} />
          </button>
        </form>

        <div className="entry-foot">
          ◇ No account required · Just invite your friends
        </div>
      </div>
    </section>
  );
}