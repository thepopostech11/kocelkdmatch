/**
 * MatchTradeParameterBuilder — the single place where a MATCHES trade request
 * is validated and converted into the exact contract parameters the Deriv API
 * expects. No React handler and no engine may build these parameters inline.
 *
 *   Form → validation → builder → contract params → proposal → buy
 */
import { DURATION_RANGE } from "@/config/app";
import type { SymbolMeta } from "@/market/MarketEngine";

export class TradeValidationError extends Error {
  constructor(
    readonly parameter: string,
    readonly value: unknown,
    readonly reason: string,
  ) {
    super(reason);
    this.name = "TradeValidationError";
  }
}

export type MatchTradeInput = {
  symbol: string;
  digit: number;
  stake: number;
  ticks: number;
  currency: string;
  /** Available Continuous Indices reported by Deriv (never a hard-coded list). */
  availableSymbols?: SymbolMeta[];
  /** Account balance used for the pre-flight affordability gate. */
  balance?: number;
};

/** Exactly what goes on the wire — nothing else may be added downstream. */
export type MatchContractParameters = {
  amount: number;
  basis: "stake";
  contract_type: "DIGITMATCH";
  currency: string;
  duration: number;
  duration_unit: "t";
  underlying_symbol: string;
  barrier: string;
};

export type MatchTradeRequest = {
  params: MatchContractParameters;
  /** Human-readable mirror of the request, for the debug panel. */
  debug: {
    symbol: string;
    displayName: string;
    contractType: string;
    digit: number;
    stake: number;
    duration: number;
    durationUnit: string;
    currency: string;
  };
};

export function buildMatchTradeRequest(input: MatchTradeInput): MatchTradeRequest {
  const { symbol, digit, stake, ticks, currency } = input;

  /* -------------------------------------------------------------- symbol */
  if (!symbol || typeof symbol !== "string") {
    throw new TradeValidationError("symbol", symbol, "No market is selected.");
  }
  const available = input.availableSymbols ?? [];
  const meta = available.find((item) => item.symbol === symbol);
  if (available.length > 0) {
    if (!meta) {
      throw new TradeValidationError("symbol", symbol, "Symbol is not offered by Deriv right now.");
    }
    if (!meta.open) {
      throw new TradeValidationError("symbol", symbol, "Symbol is currently closed for trading.");
    }
  }

  /* --------------------------------------------------------------- digit */
  const digitValue = typeof digit === "string" ? Number(digit) : digit;
  if (!Number.isInteger(digitValue) || digitValue < 0 || digitValue > 9) {
    throw new TradeValidationError("digit", digit, "Target digit must be an integer between 0 and 9.");
  }

  /* --------------------------------------------------------------- stake */
  const stakeValue = typeof stake === "string" ? Number(stake) : stake;
  if (stakeValue == null || !Number.isFinite(stakeValue)) {
    throw new TradeValidationError("stake", stake, "Stake must be a number.");
  }
  if (stakeValue <= 0) {
    throw new TradeValidationError("stake", stake, "Stake must be greater than zero.");
  }
  if (input.balance != null && stakeValue > input.balance) {
    throw new TradeValidationError(
      "stake",
      stakeValue,
      `Insufficient balance. Available ${input.balance.toFixed(2)} ${currency || ""}`.trim(),
    );
  }

  /* ------------------------------------------------------------ currency */
  if (!currency || typeof currency !== "string") {
    throw new TradeValidationError("currency", currency, "Account currency is unavailable.");
  }

  /* ------------------------------------------------------------ duration */
  // Contract duration only — never the entry-trigger digit or an
  // observation window.
  const duration = typeof ticks === "string" ? Number(ticks) : ticks;
  if (!Number.isInteger(duration) || duration <= 0) {
    throw new TradeValidationError("duration", ticks, "Duration must be greater than 0 ticks.");
  }
  if (duration < DURATION_RANGE.min || duration > DURATION_RANGE.max) {
    throw new TradeValidationError(
      "duration",
      duration,
      `Duration must be between ${DURATION_RANGE.min} and ${DURATION_RANGE.max} ticks.`,
    );
  }

  const params: MatchContractParameters = {
    amount: Number(stakeValue.toFixed(2)),
    basis: "stake",
    contract_type: "DIGITMATCH",
    currency,
    duration,
    duration_unit: "t",
    underlying_symbol: symbol,
    barrier: String(digitValue),
  };

  return {
    params,
    debug: {
      symbol,
      displayName: meta?.displayName ?? symbol,
      contractType: "MATCHES (DIGITMATCH)",
      digit: digitValue,
      stake: params.amount,
      duration,
      durationUnit: "t",
      currency,
    },
  };
}
