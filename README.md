# 🏦 THE STOCKS GAME
- A free online real-time multiplayer stock market strategy game
- Built with `React`, `Node.js`, `Express`, and `Socket.IO`

---

### 👨🏻‍💻 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Frontend tooling | Vite |
| Backend | Node.js |
| HTTP server | Express |
| Real-time communication | Socket.IO |
| Language | JavaScript (ES Modules) |
| Styling | CSS |

---

### 📜 Setup
```sh
# start server
cd server
npm install
npm run dev
npm run start 

# start client
cd client
npm install
npm run dev
npm run start
```
---

### 📌 Server Health Endpoints
The backend exposes these basic HTTP endpoints for checking whether the server is running and responding

| Endpoint | Purpose |
|---|---|
| `/` | Server information and status |
| `/health` | Health check and runtime statistics |
| `/ping` | Simple connectivity check |

---

### 🛠️ Project Structure
```
.
├── README.md
├── client
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── public
│   │   └── logos
│   ├── src
│   │   ├── App.jsx
│   │   ├── components
│   │   │   ├── Card.jsx
│   │   │   ├── CollapsiblePanel.jsx
│   │   │   ├── GameTable.jsx
│   │   │   ├── LandingPage.jsx
│   │   │   ├── Leaderboard.jsx
│   │   │   ├── Lobby.jsx
│   │   │   ├── Logbook.jsx
│   │   │   ├── MarketOpenModal.jsx
│   │   │   ├── PositionBoard.jsx
│   │   │   ├── StockCard.jsx
│   │   │   └── TradePanel.jsx
│   │   ├── main.jsx
│   │   ├── socket.js
│   │   ├── styles.css
│   │   └── utils.js
│   └── vite.config.js
├── docs
│   └── game-rules.md
├── server
│   ├── gameLogic.js
│   ├── index.js
│   ├── package-lock.json
│   └── package.json
```

---

### ⚙️ Architecture

The game follows a client-server architecture. The backend maintains the authoritative game state, validates player actions, resolves market movements, and broadcasts updated state to connected players.

```text
                 ┌──────────────────────┐
                 │      React UI        │
                 │──────────────────────│
                 │  Market Dashboard    │
                 │  Portfolio           │
                 │  Trading Panel       │
                 │  Leaderboard         │
                 └──────────┬───────────┘
                            │
                            │ Socket.IO
                            │
                 ┌──────────▼───────────┐
                 │  Express + Node.js   │
                 │──────────────────────│
                 │   Game Room Manager  │
                 │   Player Management  │
                 │   Socket Handlers    │
                 └──────────┬───────────┘
                            │
                            │
                 ┌──────────▼───────────┐
                 │   Game Logic Engine  │
                 │──────────────────────│
                 │   Turn Management    │
                 │   Trade Validation   │
                 │   Card Distribution  │
                 │   Price Calculation  │
                 │   Short Settlement   │
                 │   Leaderboard        │
                 └──────────────────────┘
```
---

### 📚 Game Flow & Rules

A typical game session follows this high-level sequence:

1. **Create or join a room** — Players enter a multiplayer game using a room code.
2. **Start the game** — The host starts the session once enough players have joined.
3. **Receive private cards** — Each player gets a private hand of market movement cards.
4. **Take trading actions** — Players make their decisions in turn-based action rounds.
5. **Open the market** — Movement cards are revealed and stock prices are updated.
6. **Settle positions** — Short positions are settled and the leaderboard is recalculated.
7. **Continue trading** — Players move into the next cycle while retaining their long holdings.

For the complete rules, examples, trading mechanics, and settlement calculations, see:

**[Read the Complete Game Rules →](docs/game-rules.md)**

---

### 👷🏻‍♂️ TODO
Backend
- Allow admin to config stock settings (or simply shuffle stocks profile)

Features
- CASH REDEEM - directy redeem cash in your turn
- CENTRAL BANK RATE CUT - players holding cash will get aggregated interest from all these cards
- GLOBAL RECESSION - treat this as -1 for all stocks
- TECHNOLOGY BOOM - treat this like +1 for all stocks
- DIVIDEND - this is stock specific card. That stock holders will get cash of 5% oh their holdings
- RESTORE THE CLOSED COMPANY - this will restore the company price back to when it was last time (or base price). bringing back all movement cards from next cycle
- CHARIMAN : logic and 1 movement card suspend
- other special cards

Debt
- Please make styles.css smaller by removing overriden styles 

---


<p align="center">
  <strong>Made with ❤️ by Manthan Patel</strong>
</p>


