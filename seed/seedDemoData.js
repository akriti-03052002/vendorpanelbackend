/**
 * Seeds the database with realistic demo data for local/dev use:
 * commission rules and 3 vendor partners (with partner users, bank
 * accounts, customers, screens, commissions, settlements and activity
 * logs).
 *
 * Run: node seed/seedDemoData.js
 * (wipes previously-seeded demo documents before re-inserting, so it's
 * safe to run more than once)
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const {
  Partner,
  PartnerUser,
  PartnerBankAccount,
  CommissionRule,
  PartnerCommission,
  PartnerSettlement,
  PartnerActivity,
  Customer,
  Screen
} = require("../models/Index");

const DEMO_PASSWORD = "Demo@12345";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB. Wiping previous demo data...");

  const demoPartnerCodes = ["VP-DEMO-001", "VP-DEMO-002", "VP-DEMO-003"];
  const existingPartners = await Partner.find({ partnerCode: { $in: demoPartnerCodes } }).select("_id");
  const existingPartnerIds = existingPartners.map((p) => p._id);

  if (existingPartnerIds.length) {
    const existingCustomers = await Customer.find({ partnerId: { $in: existingPartnerIds } }).select("_id");
    const existingCustomerIds = existingCustomers.map((c) => c._id);

    await Screen.deleteMany({ customerId: { $in: existingCustomerIds } });
    await Customer.deleteMany({ partnerId: { $in: existingPartnerIds } });
    await PartnerCommission.deleteMany({ partnerId: { $in: existingPartnerIds } });
    await PartnerSettlement.deleteMany({ partnerId: { $in: existingPartnerIds } });
    await PartnerActivity.deleteMany({ partnerId: { $in: existingPartnerIds } });
    await PartnerBankAccount.deleteMany({ partnerId: { $in: existingPartnerIds } });
    await PartnerUser.deleteMany({ partnerId: { $in: existingPartnerIds } });
    await Partner.deleteMany({ _id: { $in: existingPartnerIds } });
  }
  await CommissionRule.deleteMany({ name: { $in: ["Standard Vendor Commission", "Premium Screen Bonus"] } });

  console.log("Creating commission rules...");
  const baseRule = await CommissionRule.create({
    isAddOn: false,
    name: "Standard Vendor Commission",
    commissionType: "percentage",
    rate: 15,
    calculationBase: "net_revenue",
    recurring: { enabled: true, durationType: "months", duration: 12 },
    minimumSettlementAmount: 1000,
    status: "active"
  });

  const addOnRule = await CommissionRule.create({
    isAddOn: true,
    name: "Premium Screen Bonus",
    commissionType: "fixed_per_screen",
    perScreenAmount: 200,
    calculationBase: "screen_count",
    recurring: { enabled: false, durationType: "none", duration: 0 },
    minimumSettlementAmount: 0,
    status: "active"
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const partnerDefs = [
    {
      code: "VP-DEMO-001",
      businessName: "BrightSign Media Solutions",
      legalName: "BrightSign Media Solutions Pvt. Ltd.",
      entityType: "private_limited",
      industry: "Digital Signage Reseller",
      contactName: "Rohan Mehta",
      email: "rohan.mehta@brightsignmedia.demo",
      phone: "+91-9820011223",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      status: "active",
      verification: "verified",
      referralCode: "BRIGHT2026",
      bank: { holder: "BrightSign Media Solutions Pvt Ltd", bank: "HDFC Bank", last4: "4521", type: "current" }
    },
    {
      code: "VP-DEMO-002",
      businessName: "Urban Retail Displays",
      legalName: "Urban Retail Displays LLP",
      entityType: "llp",
      industry: "Retail Technology",
      contactName: "Priya Sharma",
      email: "priya.sharma@urbanretaildisplays.demo",
      phone: "+91-9845123456",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      status: "active",
      verification: "verified",
      referralCode: "URBAN2026",
      bank: { holder: "Urban Retail Displays LLP", bank: "ICICI Bank", last4: "7788", type: "current" }
    },
    {
      code: "VP-DEMO-003",
      businessName: "Metro Screens Network",
      legalName: "Metro Screens Network",
      entityType: "proprietorship",
      industry: "Advertising & OOH",
      contactName: "Arjun Kapoor",
      email: "arjun.kapoor@metroscreens.demo",
      phone: "+91-9911223344",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
      status: "pending_verification",
      verification: "pending",
      referralCode: "METRO2026",
      bank: null
    }
  ];

  const customerPool = [
    { companyName: "Cafe Bloom", city: "Mumbai", state: "Maharashtra", screens: 4, plan: "basic" },
    { companyName: "FitZone Gyms", city: "Pune", state: "Maharashtra", screens: 8, plan: "premium" },
    { companyName: "Sunrise Supermarket", city: "Bengaluru", state: "Karnataka", screens: 12, plan: "premium" },
    { companyName: "Cloud Nine Salon", city: "Bengaluru", state: "Karnataka", screens: 3, plan: "basic" },
    { companyName: "QuickBite Restaurants", city: "Delhi", state: "Delhi", screens: 6, plan: "basic" }
  ];

  let customerIdx = 0;

  for (const def of partnerDefs) {
    console.log(`Creating partner ${def.businessName}...`);

    const partner = await Partner.create({
      partnerCode: def.code,
      partnerType: "vendor",
      legalEntity: {
        businessName: def.businessName,
        legalName: def.legalName,
        entityType: def.entityType,
        website: `${CLIENT_URL}/${def.businessName.toLowerCase().replace(/\s+/g, "")}`,
        industry: def.industry
      },
      primaryContact: {
        name: def.contactName,
        email: def.email,
        phone: def.phone,
        designation: "Founder"
      },
      address: {
        country: "India",
        state: def.state,
        city: def.city,
        addressLine1: "123 Business Park",
        addressLine2: "Suite 4B",
        pincode: def.pincode
      },
      referral: {
        referralCode: def.referralCode,
        referralLink: `${CLIENT_URL}/partner/register?ref=${def.referralCode}`
      },
      verification: { overallStatus: def.verification },
      status: def.status
    });

    await PartnerUser.create([
      {
        partnerId: partner._id,
        name: def.contactName,
        email: def.email,
        phone: def.phone,
        role: "owner",
        permissions: ["*"],
        auth: { provider: "email", passwordHash },
        status: "active"
      },
      {
        partnerId: partner._id,
        name: `${def.contactName.split(" ")[0]} Finance`,
        email: def.email.replace("@", "+finance@"),
        role: "finance",
        permissions: ["settlements.view", "commissions.view"],
        auth: { provider: "email", passwordHash },
        status: "active"
      }
    ]);

    if (def.bank) {
      await PartnerBankAccount.create({
        partnerId: partner._id,
        accountHolderName: def.bank.holder,
        bankName: def.bank.bank,
        accountNumberEncrypted: `encrypted-${def.bank.last4}`,
        accountNumberLast4: def.bank.last4,
        ifscEncrypted: `encrypted-ifsc-${def.bank.last4}`,
        ifscMasked: `${def.bank.bank.slice(0, 4).toUpperCase()}0XXXXXX`,
        accountType: def.bank.type,
        verification: { status: "verified" },
        commissionEligibility: "eligible"
      });
    }

    // Two customers per partner, drawn from the shared pool
    const partnerCustomers = [customerPool[customerIdx % customerPool.length], customerPool[(customerIdx + 1) % customerPool.length]];
    customerIdx += 2;

    let totalRevenue = 0;
    let totalCommission = 0;
    const commissionIdsForSettlement = [];

    for (const c of partnerCustomers) {
      const customer = await Customer.create({
        companyName: c.companyName,
        contactName: `${c.companyName} Manager`,
        email: `contact@${c.companyName.toLowerCase().replace(/\s+/g, "")}.${def.code.toLowerCase()}.demo`,
        phone: "+91-9000000000",
        address: { country: "India", state: c.state, city: c.city, addressLine1: "45 Market Road", pincode: "560001" },
        partnerId: partner._id,
        registrationSource: "referral_code",
        trial: { startedAt: daysAgo(90), endsAt: daysAgo(60) },
        subscription: {
          status: "active",
          screenCount: c.screens,
          plan: c.plan,
          durationMonths: 12,
          currentPeriodStart: daysAgo(60),
          currentPeriodEnd: daysFromNow(305)
        },
        status: "active"
      });

      const screens = [];
      for (let i = 1; i <= c.screens; i++) {
        screens.push({
          customerId: customer._id,
          name: `${c.companyName} - Screen ${i}`,
          location: `${c.city} Outlet ${i}`,
          registeredAt: daysAgo(60),
          activatedAt: daysAgo(58)
        });
      }
      await Screen.insertMany(screens);

      const revenue = c.screens * (c.plan === "premium" ? 999 : 499) * 12;
      const grossCommission = Math.round(revenue * (baseRule.rate / 100));
      totalRevenue += revenue;
      totalCommission += grossCommission;

      const commission = await PartnerCommission.create({
        partnerId: partner._id,
        customerId: customer._id,
        commissionRuleId: baseRule._id,
        transaction: {
          invoiceNumber: `INV-${def.code}-${customer._id.toString().slice(-5)}`,
          revenue,
          screenCount: c.screens,
          currency: "INR"
        },
        calculation: {
          commissionType: baseRule.commissionType,
          rate: baseRule.rate,
          grossCommission,
          deductions: 0,
          netCommission: grossCommission
        },
        recurring: { isRecurring: true, cycleNumber: 1 },
        settlement: { eligibleAt: daysAgo(30), status: "settled" }
      });
      commissionIdsForSettlement.push(commission._id);

      await PartnerActivity.create({
        partnerId: partner._id,
        performedBy: { type: "system", userId: null },
        activityType: "commission_created",
        entity: { type: "PartnerCommission", entityId: commission._id },
        description: `Commission of INR ${grossCommission} generated for ${c.companyName}`
      });
    }

    if (def.bank && commissionIdsForSettlement.length) {
      const tdsAmount = Math.round(totalCommission * 0.1);
      const settlement = await PartnerSettlement.create({
        settlementNumber: `STL-${def.code}-2026-08`,
        partnerId: partner._id,
        commissionIds: commissionIdsForSettlement,
        period: { from: daysAgo(60), to: daysAgo(30) },
        settlementType: "monthly",
        amount: {
          gross: totalCommission,
          deductions: tdsAmount,
          net: totalCommission - tdsAmount,
          currency: "INR"
        },
        tax: { tdsRate: 10, tdsAmount },
        payment: {
          method: "bank_transfer",
          transactionId: `TXN-DEMO-${def.code}`,
          paidAt: daysAgo(28)
        },
        status: "paid",
        approvedAt: daysAgo(29)
      });

      await PartnerActivity.create({
        partnerId: partner._id,
        performedBy: { type: "spotx_user", userId: null },
        activityType: "settlement_paid",
        entity: { type: "PartnerSettlement", entityId: settlement._id },
        description: `Settlement ${settlement.settlementNumber} paid`
      });
    }

    await Partner.findByIdAndUpdate(partner._id, {
      $set: {
        "stats.referredScreens": partnerCustomers.reduce((s, c) => s + c.screens, 0),
        "stats.activeScreens": partnerCustomers.reduce((s, c) => s + c.screens, 0),
        "stats.totalRevenue": totalRevenue,
        "stats.totalCommission": totalCommission,
        "stats.paidCommission": def.bank ? totalCommission : 0,
        "stats.pendingCommission": def.bank ? 0 : totalCommission
      }
    });
  }

  console.log("\nDemo data seeded successfully.");
  console.log(`Partner login password for all seeded partner users: ${DEMO_PASSWORD}`);
  console.log("Seeded partner logins:");
  partnerDefs.forEach((d) => console.log(`  - ${d.email} (${d.businessName})`));

  process.exit(0);
};

run().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
