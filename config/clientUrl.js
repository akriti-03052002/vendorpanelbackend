/* ============================================================
   FRONTEND URL
   Every link the backend hands out (referral links, password-reset and
   invite emails) is built from CLIENT_URL, so pointing the backend at a
   differently-hosted frontend is only ever an env change. Read on each
   call rather than once at startup so nothing caches a stale value.
============================================================ */

const DEFAULT_CLIENT_URL = "http://localhost:5173";

// Tolerates the same paste mistakes as the CORS list in index.js (wrapping
// quotes, a trailing slash) and takes the first entry if a comma-separated
// list was put here instead of in CLIENT_URLS.
const getClientUrl = () => {
  const first = (process.env.CLIENT_URL || "").split(",")[0].trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");

  return first || DEFAULT_CLIENT_URL;
};

// A vendor's code is for the customers they bring in; every other partner
// type's code refers new partners.
const buildReferralLink = (referralCode, partnerType) => {
  const page = partnerType === "vendor" ? "/customer/register" : "/partner/register";

  return `${getClientUrl()}${page}?ref=${encodeURIComponent(referralCode)}`;
};

module.exports = { getClientUrl, buildReferralLink };
