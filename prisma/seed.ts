import { PrismaClient, Role, UserStatus, ProcurementType, SalesOrderStatus, PurchaseOrderStatus, MOStatus, MovementType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randFloat(min: number, max: number) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}
function seqNum(n: number, pad = 6) {
  return String(n).padStart(pad, "0");
}

// ─── Static data pools ────────────────────────────────────────────────────────

const COMPANY_NAMES = [
  "Apex Manufacturing Co.",
  "BlueStar Enterprises",
  "Crest Industrial Works",
  "Delta Fabrications Ltd.",
  "Evergreen Supply Chain",
  "Falcon Precision Tools",
  "Greenfield Industries",
  "Horizon Auto Parts",
  "Ironclad Components",
  "Jetstream Logistics",
];

const ACCENT_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "SGD", "CAD", "AUD"];

const FIRST_NAMES = [
  "Arjun", "Priya", "Rahul", "Sneha", "Vikram", "Kavya", "Rohan", "Anita",
  "Suresh", "Meera", "Aditya", "Pooja", "Kiran", "Divya", "Rajesh", "Nisha",
  "Sanjay", "Lakshmi", "Mohan", "Geeta", "James", "Sarah", "Michael", "Emily",
  "David", "Jessica", "Daniel", "Ashley", "Matthew", "Amanda",
];

const LAST_NAMES = [
  "Sharma", "Patel", "Singh", "Kumar", "Gupta", "Mehta", "Joshi", "Nair",
  "Reddy", "Iyer", "Smith", "Johnson", "Williams", "Brown", "Jones",
  "Garcia", "Miller", "Davis", "Wilson", "Moore",
];

const PRODUCT_ADJECTIVES = ["Heavy-Duty", "Premium", "Industrial", "Standard", "Precision", "Compact", "Ultra", "Pro"];
const PRODUCT_NOUNS = [
  "Bearing", "Shaft", "Bracket", "Gear", "Valve", "Pump", "Motor", "Frame",
  "Panel", "Bolt", "Nut", "Washer", "Gasket", "Seal", "Filter", "Connector",
  "Housing", "Pulley", "Chain", "Sprocket", "Coupling", "Flange", "Bushing", "Pin",
];

const VENDOR_NAMES = [
  "Allied Materials Inc.", "Bharat Steel Suppliers", "Central Components Ltd.",
  "Diamond Hardware Co.", "Elite Raw Materials", "First Choice Vendors",
  "Global Parts Depot", "Heritage Supplies Pvt.", "Integrity Traders",
  "Jade Wholesale Co.", "Kovai Steel Works", "Landmark Distributors",
];

const CUSTOMER_NAMES = [
  "TechBuild Corp", "Northern Machines Ltd", "Pacific Assemblies", "StarForge Inc",
  "Rapid Constructs", "Alpha Tools Pvt", "Beta Engineering", "Gamma Systems",
  "Omega Fabricators", "Sigma Industries", "Zeta Components", "Delta Works",
];

const NON_ADMIN_ROLES: Role[] = [Role.MANAGER, Role.OPERATOR, Role.VIEWER];

function randomPerms() {
  return {
    canAccessProducts: Math.random() > 0.2,
    canAccessSales: Math.random() > 0.25,
    canAccessPurchases: Math.random() > 0.25,
    canAccessManufacturing: Math.random() > 0.3,
    canAccessBoM: Math.random() > 0.3,
    canAccessStockLedger: Math.random() > 0.3,
    canAccessAuditLogs: Math.random() > 0.4,
  };
}

// ─── Main Seed ────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Starting seed...\n");

  const passwordHash = await bcrypt.hash("Admin@123", 10);

  for (let ci = 0; ci < COMPANY_NAMES.length; ci++) {
    const companyName = COMPANY_NAMES[ci];
    const companySlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
    console.log(`\n── Seeding: ${companyName} ──`);

    // ── 1. Company ─────────────────────────────────────────────────────────
    const company = await prisma.company.create({
      data: {
        name: companyName,
        accentColor: ACCENT_COLORS[ci],
        currency: pick(CURRENCIES),
        allowNegativeStock: Math.random() > 0.6,
        autoCreateMO: Math.random() > 0.3,
        email: `admin@${companySlug}.com`,
        phone: `+91${rand(7000000000, 9999999999)}`,
        address: `${rand(1, 999)} Industrial Area, Sector ${rand(1, 50)}`,
      },
    });

    // ── 2. Admin user ──────────────────────────────────────────────────────
    await prisma.user.create({
      data: {
        name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        email: `admin.c${ci + 1}@${companySlug}.com`,
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        companyId: company.id,
        canAccessProducts: true,
        canAccessSales: true,
        canAccessPurchases: true,
        canAccessManufacturing: true,
        canAccessBoM: true,
        canAccessStockLedger: true,
        canAccessAuditLogs: true,
      },
    });

    // ── 3. 20–24 staff users with varied permissions ───────────────────────
    const userCount = rand(20, 24);
    for (let ui = 0; ui < userCount; ui++) {
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      await prisma.user.create({
        data: {
          name: `${firstName} ${lastName}`,
          email: `user.${ci}${ui}.${firstName.toLowerCase()}@${companySlug}.com`,
          passwordHash,
          role: pick(NON_ADMIN_ROLES),
          status: Math.random() > 0.15 ? UserStatus.ACTIVE : UserStatus.INACTIVE,
          companyId: company.id,
          ...randomPerms(),
        },
      });
    }
    console.log(`  ✓ ${userCount + 1} users`);

    // ── 4. Vendors ─────────────────────────────────────────────────────────
    const vendorCount = rand(12, 16);
    const vendors = [];
    for (let vi = 0; vi < vendorCount; vi++) {
      const v = await prisma.vendor.create({
        data: {
          name: `${pick(VENDOR_NAMES)} ${seqNum(vi + 1, 2)}`,
          email: `vendor${vi + 1}@supply${ci}${vi}.com`,
          phone: `+91${rand(7000000000, 9999999999)}`,
          companyId: company.id,
        },
      });
      vendors.push(v);
    }
    console.log(`  ✓ ${vendorCount} vendors`);

    // ── 5. Products (150–200) ──────────────────────────────────────────────
    const productCount = rand(150, 200);
    const products = [];
    for (let pi = 0; pi < productCount; pi++) {
      const isMake = pi < Math.floor(productCount * 0.35);
      const costPrice = randFloat(10, 2000);
      const stockPrice = parseFloat((costPrice * randFloat(1.15, 2.2)).toFixed(2));
      const p = await prisma.product.create({
        data: {
          sku: `${companyName.substring(0, 3).toUpperCase()}${ci}-${String(pi + 1).padStart(4, "0")}`,
          name: `${pick(PRODUCT_ADJECTIVES)} ${pick(PRODUCT_NOUNS)} ${pi + 1}`,
          description: `Industrial component. Series ${rand(1, 99)}.`,
          costPrice,
          stockPrice,
          stockQty: rand(0, 500),
          reservedQty: 0,
          reorderPoint: rand(5, 50),
          procurementType: isMake ? ProcurementType.MAKE : ProcurementType.BUY,
          companyId: company.id,
        },
      });
      products.push(p);
    }
    const buyProducts = products.filter((p) => p.procurementType === ProcurementType.BUY);
    const makeProducts = products.filter((p) => p.procurementType === ProcurementType.MAKE);
    console.log(`  ✓ ${productCount} products (${makeProducts.length} MAKE, ${buyProducts.length} BUY)`);

    // ── 6. Bills of Materials ──────────────────────────────────────────────
    const boms = [];
    for (let bi = 0; bi < makeProducts.length; bi++) {
      const mp = makeProducts[bi];
      const compCount = rand(2, 5);
      const compProds = [...buyProducts].sort(() => Math.random() - 0.5).slice(0, Math.min(compCount, buyProducts.length));
      const bom = await prisma.billOfMaterials.create({
        data: {
          productId: mp.id,
          quantity: rand(1, 10),
          reference: `BOM-${ci}${seqNum(bi + 1, 4)}`,
          companyId: company.id,
          components: {
            create: compProds.map((cp) => ({ productId: cp.id, quantity: rand(1, 20) })),
          },
          workOrders: {
            create: Array.from({ length: rand(1, 3) }, (_, wi) => ({
              operation: pick(["Cutting", "Welding", "Assembly", "Painting", "Grinding", "Drilling", "Inspection"]),
              workCenter: `WC-${String.fromCharCode(65 + wi)}`,
              expectedDuration: rand(15, 240),
            })),
          },
        },
      });
      boms.push({ bom, product: mp });
    }
    console.log(`  ✓ ${boms.length} bills of materials`);

    // ── 7. Purchase Orders (150–200) ───────────────────────────────────────
    const poCount = rand(150, 200);
    const poStatuses = [
      PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.SENT,
      PurchaseOrderStatus.PARTIALLY_RECEIVED, PurchaseOrderStatus.RECEIVED,
      PurchaseOrderStatus.CANCELLED,
    ];
    const purchaseOrders = [];
    for (let poi = 0; poi < poCount; poi++) {
      const vendor = pick(vendors);
      const status = pick(poStatuses);
      const lineProds = [...buyProducts].sort(() => Math.random() - 0.5).slice(0, rand(1, 5));
      let total = 0;
      const items = lineProds.map((lp) => {
        const qty = rand(10, 200);
        const unitPrice = lp.costPrice;
        total += qty * unitPrice;
        return {
          productId: lp.id, quantity: qty, unitPrice,
          receivedQty: status === PurchaseOrderStatus.RECEIVED ? qty
            : status === PurchaseOrderStatus.PARTIALLY_RECEIVED ? rand(1, qty - 1) : 0,
        };
      });
      const po = await prisma.purchaseOrder.create({
        data: {
          poNumber: `PO-${companyName.substring(0, 3).toUpperCase()}${ci}-${seqNum(poi + 1)}`,
          vendorId: vendor.id,
          status,
          totalAmount: parseFloat(total.toFixed(2)),
          companyId: company.id,
          items: { create: items },
        },
      });
      purchaseOrders.push(po);
    }
    console.log(`  ✓ ${poCount} purchase orders`);

    // ── 8. Sales Orders (150–200) ──────────────────────────────────────────
    const soCount = rand(150, 200);
    const soStatuses = [
      SalesOrderStatus.DRAFT, SalesOrderStatus.CONFIRMED,
      SalesOrderStatus.DELIVERED, SalesOrderStatus.CANCELLED,
    ];
    const salesOrders = [];
    for (let soi = 0; soi < soCount; soi++) {
      const status = pick(soStatuses);
      const lineProds = [...products].sort(() => Math.random() - 0.5).slice(0, rand(1, 5));
      let total = 0;
      const items = lineProds.map((lp) => {
        const qty = rand(1, 50);
        total += qty * lp.stockPrice;
        return { productId: lp.id, quantity: qty, unitPrice: lp.stockPrice };
      });
      const so = await prisma.salesOrder.create({
        data: {
          orderNumber: `SO-${companyName.substring(0, 3).toUpperCase()}${ci}-${seqNum(soi + 1)}`,
          customerName: pick(CUSTOMER_NAMES),
          customerAddress: `${rand(1, 500)} Commerce St, Zone ${rand(1, 30)}`,
          status,
          totalAmount: parseFloat(total.toFixed(2)),
          companyId: company.id,
          items: { create: items },
        },
      });
      salesOrders.push(so);
    }
    console.log(`  ✓ ${soCount} sales orders`);

    // ── 9. Manufacturing Orders (150–200) ──────────────────────────────────
    const moCount = rand(150, 200);
    const moStatuses = [MOStatus.DRAFT, MOStatus.STARTED, MOStatus.COMPLETED, MOStatus.CLOSED];
    let createdMoCount = 0;
    for (let moi = 0; moi < moCount; moi++) {
      if (boms.length === 0) break;
      const { bom, product: moProduct } = pick(boms);
      const qty = rand(1, 50);
      const bomComponents = await prisma.boMComponent.findMany({ where: { bomId: bom.id } });
      const bomWorkOrders = await prisma.boMWorkOrder.findMany({ where: { bomId: bom.id } });
      await prisma.manufacturingOrder.create({
        data: {
          moNumber: `MO-${companyName.substring(0, 3).toUpperCase()}${ci}-${seqNum(moi + 1)}`,
          productId: moProduct.id,
          quantity: qty,
          status: pick(moStatuses),
          bomId: bom.id,
          bomReference: bom.reference,
          companyId: company.id,
          components: {
            create: bomComponents.map((bc) => ({
              productId: bc.productId,
              quantity: Math.max(1, Math.round(bc.quantity * (qty / (bom.quantity || 1)))),
            })),
          },
          workOrders: {
            create: bomWorkOrders.map((bw) => ({
              operation: bw.operation,
              workCenter: bw.workCenter,
              expectedDuration: bw.expectedDuration,
            })),
          },
        },
      });
      createdMoCount++;
    }
    console.log(`  ✓ ${createdMoCount} manufacturing orders`);

    // ── 10. Inventory Movements ────────────────────────────────────────────
    let movementCount = 0;

    for (const po of purchaseOrders.filter((p) => p.status === PurchaseOrderStatus.RECEIVED)) {
      const items = await prisma.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id } });
      for (const item of items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) continue;
        const newStock = product.stockQty + item.quantity;
        await prisma.product.update({ where: { id: item.productId }, data: { stockQty: newStock } });
        await prisma.inventoryMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            movementType: MovementType.IN,
            referenceType: "PURCHASE_ORDER",
            referenceId: po.id,
            balanceAfter: newStock,
            companyId: company.id,
          },
        });
        movementCount++;
      }
    }

    for (const so of salesOrders.filter((s) => s.status === SalesOrderStatus.DELIVERED)) {
      const items = await prisma.salesOrderItem.findMany({ where: { salesOrderId: so.id } });
      for (const item of items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) continue;
        const newStock = Math.max(0, product.stockQty - item.quantity);
        await prisma.product.update({ where: { id: item.productId }, data: { stockQty: newStock } });
        await prisma.inventoryMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            movementType: MovementType.OUT,
            referenceType: "SALES_ORDER",
            referenceId: so.id,
            balanceAfter: newStock,
            companyId: company.id,
          },
        });
        movementCount++;
      }
    }
    console.log(`  ✓ ${movementCount} inventory movements`);

    // ── 11. Audit Logs ─────────────────────────────────────────────────────
    const auditEntries = [
      { entity: "Product", action: "CREATE" },
      { entity: "SalesOrder", action: "STATUS_CHANGE" },
      { entity: "PurchaseOrder", action: "CREATE" },
      { entity: "ManufacturingOrder", action: "STATUS_STARTED" },
      { entity: "BillOfMaterials", action: "UPDATE" },
      { entity: "User", action: "INVITE" },
    ];
    const auditCount = rand(50, 80);
    for (let ai = 0; ai < auditCount; ai++) {
      const entry = pick(auditEntries);
      await prisma.auditLog.create({
        data: {
          entity: entry.entity,
          entityId: crypto.randomUUID(),
          action: entry.action,
          oldValue: JSON.stringify({ status: "DRAFT" }),
          newValue: JSON.stringify({ status: "CONFIRMED" }),
          companyId: company.id,
        },
      });
    }
    console.log(`  ✓ ${auditCount} audit log entries`);
  }

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
