# Stock Market Game Guide

Welcome to the Stock Market Game! In this multiplayer strategy game,
players buy shares, sell shares, take short positions, and use movement
cards to influence how stock prices change.

Your goal is to build the highest net worth through smart trading and
risk management. There is no fixed final winning condition: the game can
continue through multiple cycles, and the leaderboard shows everyone's
standing after each cycle.

## 1. The objective

Build your net worth by - 
- Buying shares in companies you think will increase in value. 
- Selling shares when you want to turn a holding into cash. 
- Shorting companies you think will lose value. 
- Covering (unshorting) short positions. 
- Using movement cards strategically during the open phase.
- `Net worth = Cash + current value of long shareholdings`
- Short positions are settled in cash during the open phase. They are not
long shareholdings.

## 2. Understanding the game

### Stocks and prices

- The game starts with `7 stocks`, each with a base price. 
- Prices rise or fall as movement cards are revealed during the open phase. 

### Movement cards

- Each movement card identifies a stock and a numeric price movement. 
- For example, a card might say Stock A moves by +5, while another says Stock A moves by -2.
- Each player starts with `10` private cards. 
- Your hand is private until the open phase.
- In Open phase, all movement cards are aggregated and their net movement is applied to a stock

### Share supply

- Each stock has a fixed total supply of shares. 
- All players' long shareholdings count toward this limit. 
- Buying shares reduces available supply. 
- Selling long shares returns those shares to available supply. 
- Short positions do `not` consume share supply.

## 3. How a game cycle works

A Game cycle consists of: 
1. Three action rounds -> players take turns trading. 
2. Open phase -> Stock prices change, short positions are settled and Leaderboard is displayed

### Part A: The3 action rounds

- During each action round, players take turns in the game's turn order.
- On your turn, choose one action: **Buy, Sell, Short, Unshort (Cover), or Pass**.
- You can trade the same stock more than once during the three action rounds. 
- Repeated trades are aggregated into your overall position.

#### Buy shares

- Buy when you believe a stock may rise. 
- fractional shares are not allowed. 
- The purchase cost is deducted from your cash immediately. 
- You cannot buy more than your cash can afford. 
- You cannot buy more than the stock's remaining market supply.

Example
- Stock A costs $20 per share. 
- You buy 100 shares. 
- Cost: $100 × 20 = $2,000. 
- Your cash decreases by $2,000. 
- Your long position increases by 100 shares. 
- Available market supply decreases by 100 shares.
- If you later buy another 50 shares, your total long position becomes 150 shares.

#### Sell shares

- Sell shares you already own to convert some or all of that holding into cash. 
- You can sell only shares you currently own. 
- Sale proceeds are added to your cash immediately. 
- Sold shares return to the available market supply.

Example
- You own 150 shares of Stock A, currently priced at 24 
- You sell 40
- Proceeds: 40 × 24 = 960 
- Your cash increases by 960 
- You now own 110 shares
- The 40 shares return to available supply.
- You cannot sell more shares than you own.

#### Short shares

- Shorting is a way to take a position on a stock you believe will fall. 
- Opening a short does not deduct or lock the short-sale value from your cash. 
- The value of the shares shorted in that action cannot exceed your available cash. 
- Short positions do not consume the stock's 200,000-share long supply.
- `Short value for the action = Shares shorted × Current stock price`

Example
- You have 5,000 cash and Stock B costs 25 per share. 
- You could short up to 200 shares in that action because 200 × 25 = 5,000.
- Your cash is not reduced when you open the short.
- Shorting the same stock again adds to your existing short position.

#### Unshort (cover) a short position

- Unshorting, also called **covering**, closes some or all of your existing short position. 
- You can cover only shares you have already shorted. 
- The cover cost is deducted from your cash immediately. 
- Your short position decreases by the number of shares covered.

Example
- You have shorted 200 shares of Stock B. 
- Its current price is 22. 
- You cover 50. 
- Cover cost: 50 × 22 = 1,100. 
- Your cash decreases by 1,100. 
- Your remaining short position is 150 shares.
- You cannot cover more shares than your current short position.

#### Pass

- Choose `Pass` if you do not want to trade on your turn. 
- Passing uses your turn without opening or changing a position.

### Part B: The open phase

- After all three action rounds, players reveal their movement cards and stock prices are updated.
- All movement card values for a particular stock are added together.

Example

| Card | Movement |
| --- | ---: |
| Card 1 | +5 |
| Card 2 | -2 |
| Card 3 | +3 |
| **Net movement** | **+6** |

- Stock A's net movement is +6.
- `New price = Old price + Net movement`
- For example, if Stock A's old price is 20 and its net movement is +6, its new price is 26. 
- If the net movement is -4, its new price is 16.

- After prices move, the game settles each player's short positions using the old and new prices.
  - `Short settlement = Short shares × (Old price − New price)`
  - If the price falls, the result is positive and cash is added.
  - If the price rises, the result is negative and cash is deducted.
  - The short position is cleared after settlement.

Example - price falls
- You shorted 100 shares. 
- The old price was 20 and the new price is 15. 
- Settlement = 100 × (20 − 15) = **+500**.
- Your cash increases by 500.

Example - price rises
- You shorted 100 shares. 
- The old price was 20 and the new price is 24. 
- Settlement = 100 × (20 − 24) = **-400**.
- Your cash decreases by 400.
- The settlement is based on the price change during that open phase, not the full value of the short position.

#### Calculate net worth and update the leaderboard

- After short settlement, the game calculates each player's net worth.
- `Net worth = Cash + total current value of long shareholdings`
- The leaderboard ranks players by net worth after every cycle.

**Example:**

| Item | Value |
| --- | ---: |
| Cash | 3,000 |
| 100 shares of Stock A at 20 | 2,000 |
| 50 shares of Stock B at 10 | 500 |
| **Net worth**  | **5,500** |


## 4. What happens when a stock reaches zero?
- This is interesting
- If a stock's calculated price reaches **zero or below**, that company closes. 
- Its effective value becomes zero. 
- Players' long holdings in it become worthless. 
- It can no longer be bought, sold, or shorted. 
- All movement cards for that stock are permanently removed from the game and deck. 
- The stock is removed from active play.
- If a player has a short position in a stock that closes during the open phase, the effective new price for settlement is **zero**.

Example
- You shorted 100 shares of Stock C. 
- Its old price was 5 and it closes, so its effective new price is 0. 
- Settlement = 100 × (5 − 0) = **+500**. 
- Your cash increases by 500 and the short position is cleared.
- Long holdings in that company have no remaining value.

## 5. Starting the next cycle

If the game continues after the leaderboard is updated: 
1. Revealed cards for active stocks are shuffled back into the deck. 
2. Cards for closed stocks are not returned; they have been permanently removed. 
3. Cards are dealt for the next cycle, provided the deck has enough cards for all players. (after company closes cards are reduced so)
4. Players receive the configured additional purse. 
5. Existing long shareholdings carry forward.

The additional purse gives players more cash to trade with, while their
existing long holdings remain in their portfolios. The game can continue
through further cycles; there is no fixed number of cycles or automatic
final-winner condition.

## 6. Beginner strategy tips

These are general suggestions, not guaranteed ways to win.

### Watch prices and movement cards

The current price tells you what a stock costs to trade. Movement cards
determine how its price changes during the open phase. Consider both
before choosing a position.

### Keep enough cash available

Cash is needed to buy shares and cover short positions. Opening a short
does not lock cash, but a short can still lead to a cash deduction if
the stock rises.

### Know the difference between selling and unshorting

-   **Sell** closes a long position and adds sale proceeds to cash.
-   **Unshort** closes a short position and deducts the cover cost from
    cash.

### Check remaining share supply

A stock may have a positive price but very little supply left. Check
available shares before planning a large purchase. Selling shares
returns them to the market supply.

### Remember when shorts settle

Any short position you have not covered during the action rounds is
settled automatically after prices change in the open phase.

### Be careful with companies near zero

A stock that reaches zero or below closes permanently. Its long shares
become worthless, and it can no longer be traded.

### Think beyond one cycle

Long holdings carry forward and players receive an additional purse at
the start of a new cycle. Consider how today's trades may affect your
portfolio in later cycles.

## Final reminder

- Every cycle gives you another opportunity to trade, adjust your
portfolio, and respond to changing prices. 
- Learn how buying, selling, shorting, and covering affect your cash and positions.
- Keep an eye on the cards, available share supply, and the risk of a stock closing.
