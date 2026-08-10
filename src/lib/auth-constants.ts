export const SESSION_COOKIE_NAME = "finance_session";
export const SESSION_EXPIRATION_COOKIE_NAME = "finance_session_expired";

export const DASHBOARD_ROUTES = [
  "/overview",
  "/accounts",
  "/investments",
  "/net-worth",
  "/calendar",
  "/transactions",
  "/transactions/[transactionId]",
  "/bills",
  "/spending",
  "/settings",
] as const;
