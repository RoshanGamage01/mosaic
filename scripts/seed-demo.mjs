/**
 * Creates a sample business database so Mosaic has something real to discover
 * on a fresh install. Safe to re-run: it drops and rebuilds its own database.
 *
 *   node scripts/seed-demo.mjs [mongodb-uri] [database-name]
 */
import { MongoClient, ObjectId } from "mongodb";

const uri = process.argv[2] || process.env.MOSAIC_DEMO_URI || "mongodb://127.0.0.1:47017";
const dbName = process.argv[3] || process.env.MOSAIC_DEMO_DB || "northwind_trading";

/* Deterministic RNG so every install gets the same demo numbers. */
let seed = 20260907;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (list) => list[Math.floor(rand() * list.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rand() * total;
  for (const [value, weight] of pairs) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
};
const between = (min, max) => min + rand() * (max - min);
const intBetween = (min, max) => Math.floor(between(min, max + 1));
const round2 = (n) => Math.round(n * 100) / 100;

const FIRST_NAMES = "Ayesha,Marcus,Priya,Daniel,Sofia,Kwame,Lena,Hiroshi,Amara,Tomas,Nadia,Oliver,Ines,Rahul,Freya,Diego,Mei,Jonas,Zara,Elias,Rosa,Idris,Clara,Yusuf,Mira,Anton,Leila,Felix,Noor,Samuel".split(",");
const LAST_NAMES = "Fernando,Okafor,Silva,Novak,Haddad,Lindqvist,Moreau,Tanaka,Bianchi,Petrov,Alvarez,Osei,Nakamura,Kowalski,Duarte,Ibrahim,Larsen,Rossi,Mensah,Vargas,Schmidt,Rahman,Costa,Nguyen,Weber".split(",");
const COMPANIES = "Northwind Retail,Halcyon Foods,Brightline Group,Verdant Supply,Copperleaf Ltd,Marina Wholesale,Tidewater Co,Kestrel Partners,Larkspur Trading,Sable & Finch,Orchard Lane,Blue Harbour,Ridgeway Stores,Amberline,Foxglove Import".split(",");
const SEGMENTS = [["Enterprise", 12], ["Mid-market", 28], ["Small business", 40], ["Individual", 20]];
const COUNTRIES = [
  ["United States", 30, ["Austin", "Denver", "Seattle", "Chicago", "Boston"]],
  ["United Kingdom", 14, ["London", "Manchester", "Bristol", "Leeds"]],
  ["Germany", 11, ["Berlin", "Munich", "Hamburg", "Cologne"]],
  ["Sri Lanka", 10, ["Colombo", "Kandy", "Galle", "Negombo"]],
  ["Australia", 8, ["Sydney", "Melbourne", "Brisbane"]],
  ["Singapore", 7, ["Singapore"]],
  ["Canada", 7, ["Toronto", "Vancouver", "Montreal"]],
  ["India", 8, ["Bengaluru", "Mumbai", "Delhi", "Chennai"]],
  ["Japan", 5, ["Tokyo", "Osaka"]],
];
const CATEGORIES = {
  "Coffee & Tea": ["Espresso Beans", "Single Origin", "Loose Leaf", "Cold Brew"],
  "Kitchenware": ["Cookware", "Storage", "Utensils", "Glassware"],
  "Home Textiles": ["Bedding", "Towels", "Throws"],
  "Pantry": ["Preserves", "Spices", "Oils", "Baking"],
  "Electronics": ["Small Appliances", "Accessories"],
  "Cleaning": ["Detergents", "Tools"],
};
const PRODUCT_WORDS = "Harvest,Copper,Meadow,Aurora,Summit,Lantern,Willow,Nordic,Terra,Coastal,Ember,Juniper,Saffron,Marble,Linen,Sage,Amber,Cobalt".split(",");
const PRODUCT_NOUNS = "Blend,Roast,Kettle,Press,Set,Jar,Throw,Sheet,Grinder,Tin,Bowl,Pot,Cloth,Mug,Pack,Board".split(",");
const CHANNELS = [["Online store", 52], ["Marketplace", 18], ["Retail shop", 16], ["Phone order", 8], ["Wholesale", 6]];
const PAYMENTS = [["Card", 58], ["Bank transfer", 18], ["Digital wallet", 16], ["Cash on delivery", 8]];
const ORDER_STATUS = [["Completed", 68], ["Shipped", 12], ["Processing", 8], ["Cancelled", 7], ["Refunded", 5]];
const REPS = "Ayesha Fernando,Marcus Okafor,Priya Silva,Daniel Novak,Sofia Haddad,Kwame Mensah".split(",");
const TICKET_CATEGORIES = [["Delivery", 30], ["Billing", 22], ["Product quality", 18], ["Returns", 15], ["Account", 9], ["Other", 6]];
const PRIORITIES = [["Low", 34], ["Normal", 40], ["High", 19], ["Urgent", 7]];
const DEVICES = [["Mobile", 58], ["Desktop", 33], ["Tablet", 9]];
const BROWSERS = [["Chrome", 55], ["Safari", 24], ["Edge", 9], ["Firefox", 7], ["Other", 5]];
const TRAFFIC = [["Organic search", 34], ["Paid search", 18], ["Social", 16], ["Direct", 20], ["Email", 12]];
const TAGS = "vip,newsletter,wholesale,early-adopter,at-risk,referral,loyalty".split(",");

const now = new Date("2026-09-01T00:00:00.000Z");
const dayMs = 86_400_000;
const daysAgo = (days, spreadHours = 24) =>
  new Date(now.getTime() - days * dayMs + intBetween(0, spreadHours * 60) * 60_000);

/** Weekly seasonality plus a gentle upward trend, so charts look like a business. */
const demandFactor = (daysBack) => {
  const date = new Date(now.getTime() - daysBack * dayMs);
  const weekday = date.getUTCDay();
  const weekendDip = weekday === 0 || weekday === 6 ? 0.72 : 1;
  const growth = 1 + (730 - daysBack) / 1400;
  const december = date.getUTCMonth() === 11 ? 1.45 : 1;
  return weekendDip * growth * december;
};

async function main() {
  const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const db = client.db(dbName);
  console.log(`Seeding ${dbName} at ${uri.replace(/\/\/[^@]*@/, "//***@")}`);
  await db.dropDatabase();

  /* ---------------- customers ---------------- */
  const customers = [];
  for (let i = 0; i < 1400; i += 1) {
    const [country, , cities] = COUNTRIES[weightedIndex(COUNTRIES)];
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const segment = weighted(SEGMENTS);
    const signupDaysAgo = intBetween(5, 900);
    customers.push({
      _id: new ObjectId(),
      fullName: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      phone: `+${intBetween(1, 94)} ${intBetween(100, 999)} ${intBetween(1000, 9999)}`,
      companyName: segment === "Individual" ? null : pick(COMPANIES),
      segment,
      country,
      city: pick(cities),
      accountManager: pick(REPS),
      signupDate: daysAgo(signupDaysAgo),
      isActive: rand() > 0.14,
      creditLimit: round2(weighted([[500, 40], [2500, 30], [10000, 20], [50000, 10]]) * between(0.6, 1.6)),
      loyaltyPoints: intBetween(0, 8400),
      tags: Array.from(new Set([pick(TAGS), pick(TAGS)])).slice(0, rand() > 0.5 ? 2 : 1),
      preferences: {
        newsletter: rand() > 0.35,
        preferredChannel: weighted(CHANNELS),
        language: pick(["English", "English", "English", "German", "Sinhala", "Japanese"]),
      },
    });
  }
  await db.collection("customers").insertMany(customers);

  /* ---------------- products ---------------- */
  const products = [];
  const categoryNames = Object.keys(CATEGORIES);
  for (let i = 0; i < 260; i += 1) {
    const category = pick(categoryNames);
    const subcategory = pick(CATEGORIES[category]);
    const cost = round2(between(2, 90));
    const margin = between(1.35, 2.9);
    products.push({
      _id: new ObjectId(),
      sku: `${category.slice(0, 2).toUpperCase()}-${1000 + i}`,
      productName: `${pick(PRODUCT_WORDS)} ${pick(PRODUCT_NOUNS)}`,
      category,
      subcategory,
      unitPrice: round2(cost * margin),
      unitCost: cost,
      stockQuantity: intBetween(0, 480),
      reorderLevel: intBetween(10, 60),
      supplierName: pick(COMPANIES),
      isDiscontinued: rand() > 0.92,
      averageRating: round2(between(3.1, 5)),
      reviewCount: intBetween(0, 640),
      weightKg: round2(between(0.05, 6)),
      launchedOn: daysAgo(intBetween(30, 1500)),
    });
  }
  await db.collection("products").insertMany(products);
  const sellable = products.filter((p) => !p.isDiscontinued);

  /* ---------------- orders ---------------- */
  const orders = [];
  let orderNumber = 100_000;
  for (let daysBack = 730; daysBack >= 0; daysBack -= 1) {
    const ordersToday = Math.max(0, Math.round(between(2, 9) * demandFactor(daysBack)));
    for (let n = 0; n < ordersToday; n += 1) {
      const customer = pick(customers);
      const status = weighted(ORDER_STATUS);
      const lineCount = weighted([[1, 34], [2, 28], [3, 18], [4, 11], [5, 6], [7, 3]]);
      const items = [];
      let subtotal = 0;
      for (let l = 0; l < lineCount; l += 1) {
        const product = pick(sellable);
        const quantity = weighted([[1, 48], [2, 24], [3, 13], [5, 9], [10, 6]]);
        const lineTotal = round2(product.unitPrice * quantity);
        subtotal += lineTotal;
        items.push({
          productId: product._id,
          sku: product.sku,
          productName: product.productName,
          category: product.category,
          quantity,
          unitPrice: product.unitPrice,
          lineTotal,
        });
      }
      subtotal = round2(subtotal);
      const discount = rand() > 0.72 ? round2(subtotal * between(0.05, 0.2)) : 0;
      const shippingFee = subtotal > 200 ? 0 : round2(between(3.5, 14));
      const tax = round2((subtotal - discount) * 0.08);
      orderNumber += 1;
      const orderDate = daysAgo(daysBack);
      const shipped = status !== "Cancelled" && status !== "Processing";
      orders.push({
        _id: new ObjectId(),
        orderNumber: `SO-${orderNumber}`,
        customerId: customer._id,
        customerName: customer.fullName,
        orderDate,
        shippedDate: shipped ? new Date(orderDate.getTime() + intBetween(4, 120) * 3_600_000) : null,
        status,
        salesChannel: weighted(CHANNELS),
        paymentMethod: weighted(PAYMENTS),
        salesRep: customer.accountManager,
        currency: "USD",
        subtotal,
        discountAmount: discount,
        shippingFee,
        taxAmount: tax,
        totalAmount: round2(subtotal - discount + shippingFee + tax),
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        items,
        shippingAddress: {
          city: customer.city,
          country: customer.country,
          postalCode: `${intBetween(10000, 99999)}`,
        },
        isGift: rand() > 0.94,
        notes: rand() > 0.9 ? pick(["Leave with neighbour", "Fragile", "Call before delivery"]) : null,
      });
    }
  }
  await db.collection("orders").insertMany(orders);

  /* ---------------- support tickets ---------------- */
  const tickets = [];
  for (let i = 0; i < 2600; i += 1) {
    const customer = pick(customers);
    const openedAt = daysAgo(intBetween(0, 700));
    const resolved = rand() > 0.12;
    const resolutionHours = round2(between(0.5, 96));
    const priority = weighted(PRIORITIES);
    tickets.push({
      _id: new ObjectId(),
      ticketNumber: `TK-${20000 + i}`,
      customerId: customer._id,
      subject: pick([
        "Order arrived late",
        "Wrong item delivered",
        "Refund not received",
        "Cannot log in",
        "Damaged packaging",
        "Question about invoice",
        "Change delivery address",
        "Product not as described",
      ]),
      category: weighted(TICKET_CATEGORIES),
      priority,
      status: resolved ? pick(["Resolved", "Resolved", "Closed"]) : pick(["Open", "Waiting on customer"]),
      openedAt,
      resolvedAt: resolved ? new Date(openedAt.getTime() + resolutionHours * 3_600_000) : null,
      resolutionHours: resolved ? resolutionHours : null,
      firstResponseMinutes: intBetween(3, 900),
      assignedTo: pick(REPS),
      channel: pick(["Email", "Chat", "Phone", "Web form"]),
      satisfactionScore: resolved && rand() > 0.25 ? intBetween(1, 5) : null,
      reopened: rand() > 0.93,
    });
  }
  await db.collection("support_tickets").insertMany(tickets);

  /* ---------------- web sessions ---------------- */
  const sessions = [];
  for (let i = 0; i < 12000; i += 1) {
    const daysBack = intBetween(0, 180);
    const known = rand() > 0.55;
    const customer = known ? pick(customers) : null;
    const pageViews = weighted([[1, 34], [2, 22], [3, 16], [5, 14], [8, 9], [14, 5]]);
    sessions.push({
      _id: new ObjectId(),
      sessionId: `sess_${i.toString(36)}${Math.floor(rand() * 1e6).toString(36)}`,
      customerId: customer?._id ?? null,
      startedAt: daysAgo(daysBack),
      durationSeconds: intBetween(8, 2400),
      pageViews,
      deviceType: weighted(DEVICES),
      browser: weighted(BROWSERS),
      trafficSource: weighted(TRAFFIC),
      landingPage: pick(["/", "/shop", "/coffee", "/offers", "/blog/brewing-guide", "/contact"]),
      country: COUNTRIES[weightedIndex(COUNTRIES)][0],
      converted: pageViews > 3 && rand() > 0.78,
      bounced: pageViews === 1,
    });
  }
  await db.collection("web_sessions").insertMany(sessions);

  await Promise.all([
    db.collection("orders").createIndex({ orderDate: -1 }),
    db.collection("orders").createIndex({ customerId: 1 }),
    db.collection("orders").createIndex({ status: 1 }),
    db.collection("support_tickets").createIndex({ openedAt: -1 }),
    db.collection("web_sessions").createIndex({ startedAt: -1 }),
  ]);

  for (const name of ["customers", "products", "orders", "support_tickets", "web_sessions"]) {
    console.log(`  ${name}: ${await db.collection(name).countDocuments()} documents`);
  }
  await client.close();
  console.log("Demo data ready.");
}

function weightedIndex(rows) {
  const total = rows.reduce((sum, row) => sum + row[1], 0);
  let roll = rand() * total;
  for (let i = 0; i < rows.length; i += 1) {
    roll -= rows[i][1];
    if (roll <= 0) return i;
  }
  return rows.length - 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
