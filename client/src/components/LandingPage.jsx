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
		 			{/* <span className="eyebrow-dot" /> */}
		  			{/* MULTIPLAYER MARKET STRATEGY */}
				</div>

				<h1>
		  			🏛️ Stocks 
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
			  <b>Stock Market Simulation</b>
			  <small>Buy, sell, short or cover</small>
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
			  <Scale size={18} />
			</span>
			<span>
			  <b>Risk & Reward</b>
			  <small>Analyze, trade & make fortune</small>
			</span>
		  </div>
		</div>

		<div className="hero-ticker">
		  <span className="ticker-up">▲ PANW +2.4%</span>
		  <span className="ticker-down">▼ NVDA -0.8%</span>
		  <span className="ticker-up">▲ NOW +1.2%</span>
		  <span className="ticker-down">▼ MSFT -0.6%</span>
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
		  Create a new game or join an existing game.
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
				placeholder="Enter game code"
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
			  ? "Create new game"
			  : "Join the game"}

			<ArrowRight size={17} />
		  </button>
		</form>

		{/* <div className="entry-foot">
		  ◇ No account required · Just invite your friends
		</div> */}
	  </div>
	</section>
  );
}