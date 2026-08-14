Manual acceptance tests

1) Module selector
- Open app root (`/app`).
- Verify two tiles: "MATCHES & DIFFERS" navigates to the Analysis app, "RISE & FALL" opens a Coming Soon page.

2) Manual Trade
- Open Manual Trade page.
- Confirm the long `DigitTape` is replaced by a single large live digit circle.
- Confirm `LiveAccountStatus` card is removed.

3) Prediction + Validation
- Click `PREDICT` in the `PredictionPanel` when buffer >= 20 ticks.
- Observe progressive 7-layer verdicts appear (Digit Frequency, Gap, Repeat, Momentum, Multi-Window, Transition, Distribution).
- If all layers show PASSED, prediction is re-run and `TradeTicket` should auto-seed target digit and ticks (unless you manually select a digit or change ticks first).
- If any layer FAILS, the `TradeTicket` should not auto-change seeded values.

4) TradeTicket
- Ensure clicking a digit marks it as overridden (touched) and prevents auto-seed updates.
- Place a manual trade flow with a valid proposal (requires Deriv authorization) to confirm pricing and buy flow remains unchanged.

5) Bot UI
- Open Bot page.
- Confirm the minimum confidence filter is hidden behind an "Advanced filters" toggle and the Live Analysis and Shared Analysis panels are collapsible but present.
- Confirm the header shows the bot state mapped from `BotEngine.status`.

6) Settings
- Open Settings.
- Under the "Trading" tab, detailed trading/strategy/bot/manual panels should be hidden and replaced with a short notice.
- All underlying store values remain unchanged (check by inspecting store usage via devtools or running flows that rely on them).

Notes
- No network or engine changes were made; the `MarketEngine` remains the single source of truth.
- If any UI build errors occur, run the dev server and check the console for missing imports.

Commands

```bash
# Start dev server
pnpm install
pnpm dev
```
