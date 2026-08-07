/**
 * Service layer contracts. Phase 1 registers the architecture only —
 * trading/analysis behaviour is implemented in Phases 2-4.
 */
export type ModuleStatus = "ready" | "pending" | "disabled";

export type AppModule = {
  id: string;
  name: string;
  phase: 1 | 2 | 3 | 4;
  status: ModuleStatus;
  description: string;
};

export const MODULE_REGISTRY: AppModule[] = [
  {
    id: "auth",
    name: "Authentication Engine",
    phase: 1,
    status: "ready",
    description: "Deriv OAuth 2.0 + PKCE session handling",
  },
  {
    id: "oauth",
    name: "OAuth Manager",
    phase: 1,
    status: "ready",
    description: "Authorization, callback and token exchange",
  },
  {
    id: "connection",
    name: "Connection Manager",
    phase: 1,
    status: "ready",
    description: "Deriv WebSocket lifecycle",
  },
  {
    id: "ticks",
    name: "TickStreamManager",
    phase: 1,
    status: "ready",
    description: "Rolling tick buffer feed",
  },
  {
    id: "analysis",
    name: "Analysis Engine",
    phase: 2,
    status: "pending",
    description: "AI MATCHES digit analysis",
  },
  {
    id: "prediction",
    name: "Prediction Engine",
    phase: 2,
    status: "pending",
    description: "Digit probability modelling",
  },
  {
    id: "strategy",
    name: "Strategy Engine",
    phase: 2,
    status: "pending",
    description: "Signal and entry strategy rules",
  },
  {
    id: "manual",
    name: "Manual Trading Engine",
    phase: 3,
    status: "pending",
    description: "Manual MATCHES order entry",
  },
  {
    id: "bot",
    name: "Bot Engine",
    phase: 4,
    status: "pending",
    description: "Autonomous MATCHES bot",
  },
  {
    id: "execution",
    name: "Trade Execution Engine",
    phase: 3,
    status: "pending",
    description: "Contract buy/sell pipeline",
  },
  {
    id: "risk",
    name: "Risk Engine",
    phase: 4,
    status: "pending",
    description: "Stake, stop-loss and exposure control",
  },
  {
    id: "notifications",
    name: "Notification Engine",
    phase: 1,
    status: "ready",
    description: "Global notification centre",
  },
  {
    id: "settings",
    name: "Settings Engine",
    phase: 1,
    status: "ready",
    description: "Persisted user preferences",
  },
  {
    id: "performance",
    name: "Performance Monitor",
    phase: 1,
    status: "ready",
    description: "FPS, memory and diagnostics",
  },
  {
    id: "logging",
    name: "Logging Engine",
    phase: 1,
    status: "ready",
    description: "Structured client logging",
  },
];
