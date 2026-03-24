export type FraudSensitivity = "LOW" | "MEDIUM" | "HIGH";

export type FraudSettings = {
  enabled: boolean;
  sensitivity: FraudSensitivity;
  fastCompletionMs: number;
  suspiciousCompletionMs: number;
  reviewThreshold: number;
  blockThreshold: number;
};

export type BehaviorMetrics = {
  pageLoadedAt?: string | null;
  decisionedAt?: string | null;
  pageLoadToDecisionMs?: number | null;
  mouseMoveCount?: number | null;
  cursorDistancePx?: number | null;
  maxCursorJumpPx?: number | null;
  scrollCount?: number | null;
  keyboardEventCount?: number | null;
  clickCount?: number | null;
  pointerDownCount?: number | null;
  hoverTargetChanges?: number | null;
};

export type FraudSignal = {
  code: string;
  points: number;
  detail: string;
};

export type FraudAssessment = {
  enabled: boolean;
  score: number;
  label: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendation: "APPROVE" | "REVIEW" | "DENY";
  signals: FraudSignal[];
  explanation: string;
  behaviorMetrics: BehaviorMetrics;
  evaluatedAt: string;
};

export type HistorySummary = {
  recentSupplierAttempts: number;
  repeatedAmountAttempts: number;
  deniedSupplierAttempts: number;
  averageAmount: number | null;
  commonCurrencies: string[];
};

const COMMON_PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
]);

export const DEFAULT_FRAUD_SETTINGS: FraudSettings = {
  enabled: false,
  sensitivity: "MEDIUM",
  fastCompletionMs: 300,
  suspiciousCompletionMs: 3000,
  reviewThreshold: 50,
  blockThreshold: 75,
};

export function normalizeFraudSettings(input: any): FraudSettings {
  const sensitivity =
    String(input?.sensitivity ?? DEFAULT_FRAUD_SETTINGS.sensitivity).toUpperCase();

  return {
    enabled: Boolean(input?.enabled ?? DEFAULT_FRAUD_SETTINGS.enabled),
    sensitivity:
      sensitivity === "LOW" || sensitivity === "HIGH" || sensitivity === "MEDIUM"
        ? sensitivity
        : DEFAULT_FRAUD_SETTINGS.sensitivity,
    fastCompletionMs: normalizePositiveNumber(
      input?.fastCompletionMs,
      DEFAULT_FRAUD_SETTINGS.fastCompletionMs
    ),
    suspiciousCompletionMs: normalizePositiveNumber(
      input?.suspiciousCompletionMs,
      DEFAULT_FRAUD_SETTINGS.suspiciousCompletionMs
    ),
    reviewThreshold: normalizePositiveNumber(
      input?.reviewThreshold,
      DEFAULT_FRAUD_SETTINGS.reviewThreshold
    ),
    blockThreshold: normalizePositiveNumber(
      input?.blockThreshold,
      DEFAULT_FRAUD_SETTINGS.blockThreshold
    ),
  };
}

export function normalizeBehaviorMetrics(input: any): BehaviorMetrics {
  return {
    pageLoadedAt: normalizeOptionalString(input?.pageLoadedAt),
    decisionedAt: normalizeOptionalString(input?.decisionedAt),
    pageLoadToDecisionMs: normalizeNullableNumber(input?.pageLoadToDecisionMs),
    mouseMoveCount: normalizeNullableNumber(input?.mouseMoveCount),
    cursorDistancePx: normalizeNullableNumber(input?.cursorDistancePx),
    maxCursorJumpPx: normalizeNullableNumber(input?.maxCursorJumpPx),
    scrollCount: normalizeNullableNumber(input?.scrollCount),
    keyboardEventCount: normalizeNullableNumber(input?.keyboardEventCount),
    clickCount: normalizeNullableNumber(input?.clickCount),
    pointerDownCount: normalizeNullableNumber(input?.pointerDownCount),
    hoverTargetChanges: normalizeNullableNumber(input?.hoverTargetChanges),
  };
}

export function buildFraudAssessment({
  settings,
  session,
  behaviorMetrics,
  historySummary,
}: {
  settings: FraudSettings;
  session: {
    amount?: unknown;
    currency?: unknown;
    supplier_name?: unknown;
    supplier_email?: unknown;
    rfx_id?: unknown;
    rfx_number?: unknown;
    account_id?: unknown;
    user_id?: unknown;
    metadata?: any;
  };
  behaviorMetrics?: BehaviorMetrics | null;
  historySummary: HistorySummary;
}): FraudAssessment {
  const normalizedBehavior = normalizeBehaviorMetrics(behaviorMetrics ?? {});

  if (!settings.enabled) {
    return {
      enabled: false,
      score: 0,
      label: "LOW",
      recommendation: "APPROVE",
      signals: [],
      explanation: "Fraud detection is disabled for this customer.",
      behaviorMetrics: normalizedBehavior,
      evaluatedAt: new Date().toISOString(),
    };
  }

  const rawSignals: FraudSignal[] = [];
  const amount = toFiniteNumber(session.amount);
  const currency = String(session.currency ?? "").trim().toUpperCase();
  const supplierName = String(session.supplier_name ?? "").trim();
  const supplierEmail = String(session.supplier_email ?? "").trim().toLowerCase();
  const identifiers = [
    session.rfx_id,
    session.rfx_number,
    session.account_id,
    session.user_id,
  ].filter((value) => value != null && String(value).trim() !== "");

  if (
    normalizedBehavior.pageLoadToDecisionMs != null &&
    normalizedBehavior.pageLoadToDecisionMs <= settings.fastCompletionMs
  ) {
    rawSignals.push({
      code: "completion_under_fast_threshold",
      points: 40,
      detail: `Transaction completed in ${Math.round(normalizedBehavior.pageLoadToDecisionMs)} ms.`,
    });
  } else if (
    normalizedBehavior.pageLoadToDecisionMs != null &&
    normalizedBehavior.pageLoadToDecisionMs <= settings.suspiciousCompletionMs
  ) {
    rawSignals.push({
      code: "completion_under_suspicious_threshold",
      points: 20,
      detail: `Transaction completed in ${Math.round(normalizedBehavior.pageLoadToDecisionMs)} ms.`,
    });
  }

  if (
    (normalizedBehavior.mouseMoveCount ?? 0) === 0 &&
    (normalizedBehavior.clickCount ?? 0) > 0
  ) {
    rawSignals.push({
      code: "no_mouse_movement_before_click",
      points: 20,
      detail: "Approval was attempted without any observed mouse movement.",
    });
  }

  const roboticCursorPattern =
    (normalizedBehavior.mouseMoveCount ?? 0) > 0 &&
    (normalizedBehavior.mouseMoveCount ?? 0) <= 2 &&
    (normalizedBehavior.cursorDistancePx ?? 0) < 30;
  if (roboticCursorPattern) {
    rawSignals.push({
      code: "robotic_cursor_pattern",
      points: 25,
      detail: "Cursor movement was minimal and looked mechanically direct.",
    });
  }

  const instantClickAfterPageLoad =
    normalizedBehavior.pageLoadToDecisionMs != null &&
    normalizedBehavior.pageLoadToDecisionMs < 1500 &&
    (normalizedBehavior.hoverTargetChanges ?? 0) === 0 &&
    (normalizedBehavior.scrollCount ?? 0) === 0 &&
    (normalizedBehavior.keyboardEventCount ?? 0) === 0;
  if (instantClickAfterPageLoad) {
    rawSignals.push({
      code: "instant_click_after_page_load",
      points: 15,
      detail: "The decision happened almost immediately with no visible exploration.",
    });
  }

  const lowInteractionEntropy =
    (normalizedBehavior.mouseMoveCount ?? 0) <= 1 &&
    (normalizedBehavior.scrollCount ?? 0) === 0 &&
    (normalizedBehavior.keyboardEventCount ?? 0) === 0;
  if (lowInteractionEntropy) {
    rawSignals.push({
      code: "low_interaction_entropy",
      points: 10,
      detail: "Very little human interaction was detected before the decision.",
    });
  }

  if (
    amount != null &&
    historySummary.averageAmount != null &&
    historySummary.averageAmount > 0 &&
    amount >= historySummary.averageAmount * 3
  ) {
    rawSignals.push({
      code: "amount_above_expected_threshold",
      points: 15,
      detail: `Amount ${amount} is much higher than the recent average of ${historySummary.averageAmount.toFixed(2)}.`,
    });
  }

  if (
    currency &&
    historySummary.commonCurrencies.length > 0 &&
    !historySummary.commonCurrencies.includes(currency)
  ) {
    rawSignals.push({
      code: "currency_unusual_for_customer",
      points: 10,
      detail: `${currency} is unusual compared with recent transactions for this customer.`,
    });
  }

  if (identifiers.length < 2) {
    rawSignals.push({
      code: "missing_identifiers",
      points: 10,
      detail: "Important reference identifiers are missing from this transaction.",
    });
  }

  const emailDomainSignal = getSupplierEmailDomainSignal(supplierName, supplierEmail);
  if (emailDomainSignal) {
    rawSignals.push(emailDomainSignal);
  }

  if (historySummary.recentSupplierAttempts >= 2) {
    rawSignals.push({
      code: "repeated_attempts_same_supplier_short_window",
      points: 20,
      detail: `The same supplier has ${historySummary.recentSupplierAttempts} recent attempts in a short window.`,
    });
  }

  if (historySummary.repeatedAmountAttempts >= 2) {
    rawSignals.push({
      code: "same_amount_repeated_multiple_times",
      points: 15,
      detail: "The supplier has repeated the same amount multiple times recently.",
    });
  }

  if (historySummary.deniedSupplierAttempts >= 1) {
    rawSignals.push({
      code: "prior_denied_attempts_same_supplier",
      points: 20,
      detail: `This supplier already has ${historySummary.deniedSupplierAttempts} denied attempt(s).`,
    });
  }

  const multiplier = getSensitivityMultiplier(settings.sensitivity);
  const adjustedSignals = rawSignals.map((signal) => ({
    ...signal,
    points: Math.max(1, Math.round(signal.points * multiplier)),
  }));
  const score = Math.min(
    100,
    adjustedSignals.reduce((sum, signal) => sum + signal.points, 0)
  );
  const label = getRiskLabel(score);
  const recommendation =
    score >= settings.blockThreshold
      ? "DENY"
      : score >= settings.reviewThreshold
        ? "REVIEW"
        : "APPROVE";

  return {
    enabled: true,
    score,
    label,
    recommendation,
    signals: adjustedSignals.sort((a, b) => b.points - a.points),
    explanation: buildFraudExplanation(label, recommendation, adjustedSignals),
    behaviorMetrics: normalizedBehavior,
    evaluatedAt: new Date().toISOString(),
  };
}

export function summarizeHistory(
  rows: Array<{
    amount?: unknown;
    currency?: unknown;
    status?: unknown;
    supplier_name?: unknown;
    supplier_email?: unknown;
    created_at?: unknown;
  }>,
  session: {
    amount?: unknown;
    supplier_name?: unknown;
    supplier_email?: unknown;
  }
): HistorySummary {
  const sessionAmount = toFiniteNumber(session.amount);
  const supplierName = String(session.supplier_name ?? "").trim().toLowerCase();
  const supplierEmail = String(session.supplier_email ?? "").trim().toLowerCase();
  const nowMs = Date.now();

  const amounts = rows
    .map((row) => toFiniteNumber(row.amount))
    .filter((value): value is number => value != null);
  const averageAmount = amounts.length
    ? amounts.reduce((sum, value) => sum + value, 0) / amounts.length
    : null;

  const currencyCounts = new Map<string, number>();
  let recentSupplierAttempts = 0;
  let repeatedAmountAttempts = 0;
  let deniedSupplierAttempts = 0;

  for (const row of rows) {
    const currency = String(row.currency ?? "").trim().toUpperCase();
    if (currency) {
      currencyCounts.set(currency, (currencyCounts.get(currency) ?? 0) + 1);
    }

    const sameSupplier = isSameSupplier(
      {
        supplier_name: row.supplier_name,
        supplier_email: row.supplier_email,
      },
      { supplier_name: supplierName, supplier_email: supplierEmail }
    );
    if (!sameSupplier) continue;

    const createdMs = new Date(String(row.created_at ?? "")).getTime();
    const ageMs = Number.isFinite(createdMs) ? nowMs - createdMs : Number.POSITIVE_INFINITY;
    if (ageMs <= 15 * 60 * 1000) {
      recentSupplierAttempts += 1;
    }

    const rowAmount = toFiniteNumber(row.amount);
    if (sessionAmount != null && rowAmount != null && rowAmount === sessionAmount) {
      repeatedAmountAttempts += 1;
    }

    if (String(row.status ?? "").toUpperCase() === "DENIED") {
      deniedSupplierAttempts += 1;
    }
  }

  const commonCurrencies = Array.from(currencyCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([currency]) => currency);

  return {
    recentSupplierAttempts,
    repeatedAmountAttempts,
    deniedSupplierAttempts,
    averageAmount: averageAmount != null ? Number(averageAmount.toFixed(2)) : null,
    commonCurrencies,
  };
}

function normalizePositiveNumber(value: unknown, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function normalizeNullableNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toFiniteNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getSensitivityMultiplier(sensitivity: FraudSensitivity) {
  if (sensitivity === "LOW") return 0.85;
  if (sensitivity === "HIGH") return 1.15;
  return 1;
}

function getRiskLabel(score: number): FraudAssessment["label"] {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

function getSupplierEmailDomainSignal(
  supplierName: string,
  supplierEmail: string
): FraudSignal | null {
  const emailDomain = supplierEmail.includes("@") ? supplierEmail.split("@")[1] : "";
  if (!emailDomain) return null;

  if (COMMON_PUBLIC_EMAIL_DOMAINS.has(emailDomain)) {
    return {
      code: "supplier_email_domain_mismatch",
      points: 15,
      detail: `Supplier email uses a public domain (${emailDomain}).`,
    };
  }

  if (!supplierName) return null;

  const supplierTokens = supplierName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4);
  const normalizedDomain = emailDomain.replace(/\.[a-z]+$/i, "");
  const hasMatchingToken = supplierTokens.some((token) => normalizedDomain.includes(token));

  return hasMatchingToken
    ? null
    : {
        code: "supplier_email_domain_mismatch",
        points: 15,
        detail: `Supplier name and email domain (${emailDomain}) do not look aligned.`,
      };
}

function isSameSupplier(
  left: { supplier_name?: unknown; supplier_email?: unknown },
  right: { supplier_name?: unknown; supplier_email?: unknown }
) {
  const leftEmail = String(left.supplier_email ?? "").trim().toLowerCase();
  const rightEmail = String(right.supplier_email ?? "").trim().toLowerCase();
  if (leftEmail && rightEmail) return leftEmail === rightEmail;

  const leftName = String(left.supplier_name ?? "").trim().toLowerCase();
  const rightName = String(right.supplier_name ?? "").trim().toLowerCase();
  return Boolean(leftName) && Boolean(rightName) && leftName === rightName;
}

function buildFraudExplanation(
  label: FraudAssessment["label"],
  recommendation: FraudAssessment["recommendation"],
  signals: FraudSignal[]
) {
  if (signals.length === 0) {
    return "Low risk. No suspicious transaction or behavioral signals were detected.";
  }

  const topSignals = signals
    .slice(0, 3)
    .map((signal) => signal.detail.replace(/\.$/, "").toLowerCase());

  return `${label} risk with a ${recommendation.toLowerCase()} recommendation because ${topSignals.join(
    ", "
  )}.`;
}
