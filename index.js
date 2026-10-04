const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");

const partnerAuthMiddleware = require("./middleware/partnerAuthMiddleware");
const loadPartnerContext = require("./middleware/loadPartnerContext");
const requireVerifiedPartner = require("./middleware/requireVerifiedPartner");
const adminAuthMiddleware = require("./middleware/adminAuthMiddleware");
const customerAuthMiddleware = require("./middleware/customerAuthMiddleware");
const loadCustomerContext = require("./middleware/loadCustomerContext");
const { handleRazorpayWebhook } = require("./controller/razorpayWebhookController");

const partnerAuthRoutes = require("./router/partnerAuthRoutes");
const customerPublicRoutes = require("./router/customerPublicRoutes");
const customerRoutes = require("./router/customerRoutes");
const partnerCustomerRoutes = require("./router/partnerCustomerRoutes");
const partnerUserRoutes = require("./router/partnerUserRoutes");
const partnerProfileRoutes = require("./router/partnerProfileRoutes");
const partnerDocumentRoutes = require("./router/partnerDocumentRoutes");
const partnerBankRoutes = require("./router/partnerBankRoutes");
const partnerCommissionRoutes = require("./router/partnerCommissionRoutes");
const partnerSettlementRoutes = require("./router/partnerSettlementRoutes");
const partnerNotificationRoutes = require("./router/partnerNotificationRoutes");
const partnerDashboardRoutes = require("./router/partnerDashboardRoutes");

const adminAuthRoutes = require("./router/adminAuthRoutes");
const adminPartnerRoutes = require("./router/adminPartnerRoutes");
const adminDocumentRoutes = require("./router/adminDocumentRoutes");
const adminBankRoutes = require("./router/adminBankRoutes");
const adminConfigRoutes = require("./router/adminConfigRoutes");
const adminCommissionRoutes = require("./router/adminCommissionRoutes");
const adminSettlementRoutes = require("./router/adminSettlementRoutes");
const adminCustomerRoutes = require("./router/adminCustomerRoutes");
const adminStatsRoutes = require("./router/adminStatsRoutes");

const app = express();

/* ==========================================
   MIDDLEWARE
========================================== */

app.use(helmet());

// CLIENT_URL and CLIENT_URLS are merged (either may hold a comma-separated
// list), and each entry is normalised — a pasted trailing slash or wrapping
// quotes would otherwise never match the browser's Origin header.
const allowedOrigins = [process.env.CLIENT_URLS, process.env.CLIENT_URL]
  .filter(Boolean)
  .join(",")
  .split(",")
  .map((origin) => origin.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, ""))
  .filter(Boolean);

if (allowedOrigins.length === 0) allowedOrigins.push("http://localhost:5173");

console.log("CORS allowed origins:", allowedOrigins.join(", "));

// Vite picks a random port when its default is busy (5173 -> 5174 -> ...),
// so outside production also allow any localhost/LAN-IP origin regardless
// of port instead of requiring .env to be updated every time that happens.
const isLocalDevOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):\d+$/.test(origin);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== "production" && isLocalDevOrigin(origin)) return callback(null, true);
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  })
);

// Razorpay webhook: must be mounted with a raw body parser BEFORE the
// global express.json() below — signature verification needs the exact
// raw bytes Razorpay sent, which express.json() would otherwise consume.
app.post("/api/webhooks/razorpay", express.raw({ type: "application/json" }), handleRazorpayWebhook);

app.use(express.json());

/* ==========================================
   HEALTH CHECK
========================================== */

app.get("/", (req, res) => {
  res.json({ success: true, message: "SPOTX Partner Panel API running" });
});

/* ==========================================
   PARTNER ROUTES
   /auth is public; everything else requires a
   valid JWT + a fresh PartnerUser/Partner context.
========================================== */

app.use("/api/partner/auth", partnerAuthRoutes);
app.use("/api/public/customers", customerPublicRoutes);

app.use("/api/customer", customerAuthMiddleware, loadCustomerContext, customerRoutes);

const partnerGuard = [partnerAuthMiddleware, loadPartnerContext];
// Everything a partner needs in order to GET verified stays open; anything
// that presumes verified status (referring, selling, getting paid, adding
// teammates) is locked until then.
const verifiedGuard = [...partnerGuard, requireVerifiedPartner];

app.use("/api/partner/team", verifiedGuard, partnerUserRoutes);
app.use("/api/partner/customers", verifiedGuard, partnerCustomerRoutes);
app.use("/api/partner/profile", partnerGuard, partnerProfileRoutes);
app.use("/api/partner/documents", partnerGuard, partnerDocumentRoutes);
app.use("/api/partner/bank", partnerGuard, partnerBankRoutes);
app.use("/api/partner/commissions", verifiedGuard, partnerCommissionRoutes);
app.use("/api/partner/settlements", verifiedGuard, partnerSettlementRoutes);
app.use("/api/partner/notifications", partnerGuard, partnerNotificationRoutes);
app.use("/api/partner/dashboard", partnerGuard, partnerDashboardRoutes);

/* ==========================================
   ADMIN ROUTES
   /auth is public; everything else requires a
   valid admin JWT (fully separate secret/model).
========================================== */

app.use("/api/admin/auth", adminAuthRoutes);

app.use("/api/admin/partners", adminAuthMiddleware, adminPartnerRoutes);
app.use("/api/admin/documents", adminAuthMiddleware, adminDocumentRoutes);
app.use("/api/admin/bank", adminAuthMiddleware, adminBankRoutes);
app.use("/api/admin/config", adminAuthMiddleware, adminConfigRoutes);
app.use("/api/admin/commissions", adminAuthMiddleware, adminCommissionRoutes);
app.use("/api/admin/settlements", adminAuthMiddleware, adminSettlementRoutes);
app.use("/api/admin/customers", adminAuthMiddleware, adminCustomerRoutes);
app.use("/api/admin/stats", adminAuthMiddleware, adminStatsRoutes);

/* ==========================================
   404 + ERROR HANDLER
========================================== */

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Something went wrong.",
    error: process.env.NODE_ENV === "development" ? error.stack : undefined
  });
});

/* ==========================================
   START
========================================== */

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
