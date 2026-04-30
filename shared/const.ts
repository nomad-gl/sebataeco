export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
/** HIGH-02: Session cookie lifetime — 8 hours (sliding window renewed on each request) */
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
