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
Game improvement
- cash redeem option
- chairman logic and 1 movement card suspend
- other special cards (to start the closed company)
- Allow admin to config stock settings (simple shuffle stocks profile)
- change style.css with improved UI and theme