# TODO

### Features
1. MARKET EVENTS (public)
    1. STOCK SPLIT
        - Given stock will split in 2:1
        - price will be halved, quantity will be doubled - total and player holdings
        - This will increase the risk as now the effective movements are doubled

    2. DIVIDEND on a stock
        - All shareholders of that stock will get cash of 5% oh their holdings
    
    3. CENTRAL BANK RATE CUT 
        - players holding cash will get aggregated interest of 10%

    4. LOTTERY
        - any random players get $10k cash

2. SPECIAL CARDS (private)
    1. GLOBAL RECESSION (insider news)
        - treat this as -1 for all stocks

    2. TECHNOLOGY BOOM  (insider news)
        - treat this like +1 for all stocks

3. RESTORE THE CLOSED COMPANY 
- This will happen in open market phase
- closed company will randomly be declared restored 
- this will restore the stock price back to when it was last time (or base price). bringing back all movement cards from next cycle onwards

4. IPO
- instead of restoring, forget the closed company, IPO brings new company 
- this needs to have logos of 5-10 companies in inventory
- In between any round, there is market announcement of IPO where players can click on apply button temporarily locking their cash
- IPO stock issue price = (average of active stocks) or (some fixed base price)
- IPO stock opening price = base price + (net movement of all stocks + random number)
- we will try to make IPO opening price positive
- In open maret phase, IPO is declared and alloted

---

### Backend

- Allow admin to config stock settings (or simply shuffle stocks profile) - though this is not urgent but this helps to keep game interesting

---

### Debt

- Make code clean and modular by separating the concerns and following software design principles

---

### Rough
- We will remove chariman logic as it makes stock rigid and saturates the game
- when a company is closed, then forget it, we will have IPO