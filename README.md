KOCEL Trader phase 4

## Recent Update

- Added a contract-module selector after login.
- The current production workspace is explicitly organized as **Matches & Differs** without changing its analysis, manual trading, bot, settings, or Deriv execution engines.
- Added an isolated **Rise & Fall — Coming Soon** module with a return path to Matches & Differs; it does not create predictions, trades, or a second live-data engine.
- Matches workspace bootstrapping now begins only when Matches & Differs is selected, preserving the existing shared session when returning from the module screen.
- Shared analysis state exposed to the Bot.
- Bot now consumes live analysis markets instead of creating a separate engine.
- Bot startup and market-count reporting improved.
- Manual trade ticks are auto-filled from AI prediction while remaining editable.
- Entry confirmation is hidden on the next live tick.
