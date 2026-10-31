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

- robust reconnection logic
- refresh -> make you out of game / leave game
- when host joins it shows 0/7 players
- inconsistent showing of turns
- improve company logos
- sort the hand cards (company and movement)