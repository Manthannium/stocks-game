import { useState } from "react";
import {
	ArrowRight,
  	BadgeAlert,
  	ChartNoAxesCombined,
  	Scale,
  	Users,
  	Zap,
		ZapOff
} from "lucide-react";

import GameRulesButton from "./GameRulesButton";
import PageBackdrop from "./PageBackdrop";

const TICKER = [
  { t: "PANW", v: 2.4 }, 
  { t: "NVDA", v: -0.8 }, 
  { t: "META", v: 1.2 },
  { t: "MSFT", v: -0.6 }, 
  { t: "AAPL", v: 0.9 }, 
  { t: "GOOG", v: 1.7 },
  { t: "AMZN", v: -1.1 }
];

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
		<>
		{/* Outside .landing-grid: its entrance animation uses a transform. */}
		<PageBackdrop />

		<section className="landing-grid">
	  		<div className="hero-copy">
				<div className="eyebrow">
		 			{/* <span className="eyebrow-dot" /> */}
		  			{/* MULTIPLAYER MARKET STRATEGY */}
				</div>

				<h1 className="hero-title">
		  			🏛️ Stocks-O7 🏛️
		  		<br />
		  		{/* <span>Stocks</span> */}
				</h1>

				<p className="hero-subtitle">
					{/* Build positions, read the room, and make your move
					before the market opens. Every round changes the game. */}
				</p>

		<div className="hero-features">
		  <div>
			<span className="feature-icon">
			  <ChartNoAxesCombined size={18} />
			</span>
			<span>
			  <b>Stock Market Simulation Game</b>
			  <small>Buy, Sell, Short or Cover</small>
			</span>
		  </div>

		  <div>
			<span className="feature-icon">
			  <Users size={18} />
			</span>
			<span>
			  <b>Up to 7 players</b>
			  <small>Online Real-time Multiplayer Competitive Game</small>
			</span>
		  </div>

		  <div>
			<span className="feature-icon">
			  <Scale size={18} />
			</span>
			<span>
			  <b>Risk & Reward</b>
			  <small>Analyze, Trade & Make Strategies</small>
			</span>
		  </div>
		</div>

		<div className="ticker-marquee" aria-hidden="true">
		  <div className="ticker-track">
		    {[...TICKER, ...TICKER].map((item, i) => (
		      <span key={i} className={item.v >= 0 ? "ticker-up" : "ticker-down"}>
		        {item.v >= 0 ? "▲" : "▼"} {item.t} {item.v > 0 ? "+" : ""}{item.v}%
		      </span>
		    ))}
		  </div>
		</div>

	  </div>

	  <div className="entry-card">
		{/* <div className="entry-card-top">
		  <div className="entry-symbol">
			<ChartNoAxesCombined size={22} />
		  </div>

		  <span className="live-label">
			<i /> LIVE GAME
		  </span>
		</div> */}
		<h2 className="entry-title">Play Now!</h2>
		<p className="muted entry-subtitle">
		  Start a new game or join friends with a game code.
		</p>

		<GameRulesButton variant="highlight" className="rules-button-landing" />

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
			placeholder="e.g. Manthan"
			maxLength={22}
			required
		  />

		  {mode === "join" && (
			<>
			  <label>GAME CODE</label>

			  <input
				value={code}
				onChange={(e) => setCode(e.target.value.toUpperCase())}
				placeholder="Enter Game Code"
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
			  ? "Create New Game"
			  : "Join The Game"}

			<ArrowRight size={17} />
		  </button>
		</form>

		{/* <div className="entry-foot">
		  ◇ No account required · Just invite your friends
		</div> */}
	  </div>
	</section>
		</>
  );
}