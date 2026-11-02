# Stocks Game

### Local developement
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

### Project Structure
```
.
├── README.md
├── client
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── public
│   ├── src
│   │   ├── App.jsx
│   │   ├── components
│   │   │   ├── Card.jsx
│   │   │   ├── GameTable.jsx
│   │   │   ├── LandingPage.jsx
│   │   │   ├── Leaderboard.jsx
│   │   │   ├── Lobby.jsx
│   │   │   ├── PositionBoard.jsx
│   │   │   ├── StockCard.jsx
│   │   │   └── TradePanel.jsx
│   │   ├── main.jsx
│   │   ├── socket.js
│   │   ├── styles.css
│   │   └── utils.js
│   └── vite.config.js
├── docs
│   ├── rough.md
│   └── stock_market_game_rules.md
└── server
    ├── gameLogic.js
    ├── index.js
    ├── package-lock.json
    └── package.json
```

# Todo
UI
- change style.css with improved UI and theme
- trade confirmation dialogue
- show the active (turn) player highlighted in portfolio matrix (to track his change)
- OPEN PHASE SHOW : properly present the open phase with market movements and player stats
- Game events should be notified on UI

Backend
- Allow admin to config stock settings (or simply shuffle stocks profile)

Features
- CASH REDEEM - directy redeem cash in your turn
- CENTRAL BANK RATE CUT - players holding cash will get aggregated interest from all these cards
- GLOBAL RECESSION - treat this as -1 for all stocks
- TECHNOLOGY BOOM - treat this like +1 for all stocks
- DIVIDEND - this is stock specific card. That stock holders will get cash of 5% oh their holdings
- OPEN THE CLOSED COMPANY - this will restore the company price back to when it was last time (or base price). bringing back all movement cards from next cycle
- chairman logic and 1 movement card suspend
- other special cards (to start the closed company)



