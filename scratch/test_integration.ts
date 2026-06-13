import { db } from "../lib/db";
import { recordStockMovement } from "../lib/stock";
import { createManufacturingOrderFromSO } from "../lib/mto";
import { MovementType, ProcurementType, MOStatus, PurchaseOrderStatus } from "@prisma/client";

async function runTest() {
  console.log("=== STARTING ERP INTEGRATION TEST ===");

  // 1. Setup Company and Vendor
  console.log("\n1. Setting up test company and vendor...");
  const company = await db.company.create({
    data: {
      name: "Shiv Test Furniture Works",
      currency: "INR",
      accentColor: "#indigo",
    },
  });
  console.log(`Created Company: ${company.name} (ID: ${company.id})`);

  const vendor = await db.vendor.create({
    data: {
      name: "Wood Supply Co",
      email: "wood@supply.com",
      phone: "9876543210",
      companyId: company.id,
    },
  });
  console.log(`Created Vendor: ${vendor.name}`);

  // 2. Setup Products (BUY and MAKE)
  console.log("\n2. Setting up products...");
  // BUY product with stock = 100
  const buds = await db.product.create({
    data: {
      name: "buds",
      sku: "HYD-001",
      costPrice: 50.0,
      stockPrice: 100.0,
      stockQty: 100,
      procurementType: ProcurementType.BUY,
      companyId: company.id,
    },
  });
  console.log(`Created BUY product "buds" (Stock: ${buds.stockQty})`);

  // Component for MAKE product
  const woodLegs = await db.product.create({
    data: {
      name: "Wooden Legs",
      sku: "LEG-001",
      costPrice: 10.0,
      stockPrice: 20.0,
      stockQty: 50,
      procurementType: ProcurementType.BUY,
      companyId: company.id,
    },
  });
  console.log(`Created Component product "Wooden Legs" (Stock: ${woodLegs.stockQty})`);

  // MAKE product (Wooden Table)
  const table = await db.product.create({
    data: {
      name: "Wooden Table",
      sku: "TAB-001",
      costPrice: 100.0,
      stockPrice: 250.0,
      stockQty: 0,
      procurementType: ProcurementType.MAKE,
      companyId: company.id,
    },
  });
  console.log(`Created MAKE product "Wooden Table" (Stock: ${table.stockQty})`);

  // Create Bill of Materials
  const bom = await db.billOfMaterials.create({
    data: {
      productId: table.id,
      companyId: company.id,
      components: {
        create: {
          productId: woodLegs.id,
          quantity: 4,
        },
      },
    },
  });
  console.log("Created BoM for Wooden Table (Requires 4 Wooden Legs)");

  // 3. Create Sales Order
  console.log("\n3. Creating Sales Order...");
  const so = await db.salesOrder.create({
    data: {
      orderNumber: "SO-TEST-001",
      customerName: "Rahul Sharma",
      status: "DRAFT",
      totalAmount: 101 * 100.0 + 5 * 250.0, // 101 buds + 5 Tables
      companyId: company.id,
      items: {
        create: [
          {
            productId: buds.id,
            quantity: 101, // 101 requested (stock is 100 -> shortage of 1)
            unitPrice: 100.0,
          },
          {
            productId: table.id,
            quantity: 5, // 5 tables requested (stock is 0 -> trigger MO)
            unitPrice: 250.0,
          },
        ],
      },
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });
  console.log(`Created DRAFT Sales Order: ${so.orderNumber}`);

  // 4. Confirm Sales Order (Simulate API logic)
  console.log("\n4. Confirming Sales Order...");
  const confirmedItems = [];
  const linkedPoIds = [];
  const linkedMoIds = [];

  for (const line of so.items) {
    const product = line.product;
    const availableQty = product.stockQty - product.reservedQty;

    if (product.procurementType === ProcurementType.BUY) {
      if (availableQty >= line.quantity) {
        // Sufficient stock
        await recordStockMovement(
          product.id,
          line.quantity,
          MovementType.RESERVE,
          "SALES_ORDER",
          so.id,
          company.id
        );
      } else {
        // BUY product with insufficient stock -> trigger PO
        const orderQty = line.quantity - availableQty;
        const poNumber = `PO-MTO-${line.id}`;
        
        const po = await db.purchaseOrder.create({
          data: {
            poNumber,
            vendorId: vendor.id,
            status: PurchaseOrderStatus.DRAFT,
            totalAmount: orderQty * product.costPrice,
            companyId: company.id,
            items: {
              create: {
                productId: product.id,
                quantity: orderQty,
                unitPrice: product.costPrice,
                receivedQty: 0,
              },
            },
          },
        });
        linkedPoIds.push(po.id);
        console.log(`[MTO] Created DRAFT Purchase Order: ${poNumber} for ${orderQty} units of buds.`);
      }
    } else {
      // MAKE product -> trigger MO
      const moId = await createManufacturingOrderFromSO(line.id);
      linkedMoIds.push(moId);
      console.log(`[MTO] Triggered Manufacturing Order for ${line.quantity} units of Wooden Table.`);
    }
  }

  await db.salesOrder.update({
    where: { id: so.id },
    data: { status: "CONFIRMED" },
  });
  console.log("Sales Order status set to CONFIRMED.");

  // 5. Receive PO (Simulate Purchase replenishment)
  console.log("\n5. Receiving Purchase Order...");
  for (const poId of linkedPoIds) {
    const po = await db.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });
    if (po) {
      await db.$transaction(async (tx) => {
        for (const item of po.items) {
          await recordStockMovement(
            item.productId,
            item.quantity,
            MovementType.IN,
            "PURCHASE_ORDER",
            po.id,
            company.id,
            tx
          );
        }
        await tx.purchaseOrder.update({
          where: { id: poId },
          data: { status: PurchaseOrderStatus.RECEIVED },
        });
      });
      console.log(`Purchase Order ${po.poNumber} received. Stock replenished.`);
    }
  }

  // 6. Complete MO (Simulate Manufacturing replenishment)
  console.log("\n6. Executing and Completing Manufacturing Order...");
  for (const moId of linkedMoIds) {
    const mo = await db.manufacturingOrder.findUnique({
      where: { id: moId },
    });
    if (mo) {
      // Start MO
      await db.manufacturingOrder.update({
        where: { id: moId },
        data: { status: MOStatus.STARTED },
      });
      console.log(`Manufacturing Order ${mo.moNumber} set to STARTED.`);

      // Setup MO component snapshots
      await db.mOComponent.create({
        data: {
          moId: mo.id,
          productId: woodLegs.id,
          quantity: 20, // 5 tables * 4 legs
        },
      });

      // Complete MO (Consume components and produce tables)
      const moComponents = await db.mOComponent.findMany({
        where: { moId: mo.id },
        include: { product: true },
      });

      await db.$transaction(async (tx) => {
        // Consume components (OUT)
        for (const comp of moComponents) {
          await recordStockMovement(
            comp.productId,
            comp.quantity,
            MovementType.OUT,
            "MANUFACTURING_ORDER",
            mo.id,
            company.id,
            tx
          );
        }

        // Add finished goods (IN)
        await recordStockMovement(
          mo.productId,
          mo.quantity,
          MovementType.IN,
          "MANUFACTURING_ORDER",
          mo.id,
          company.id,
          tx
        );

        await tx.manufacturingOrder.update({
          where: { id: moId },
          data: { status: MOStatus.COMPLETED },
        });
      });
      console.log(`Manufacturing Order ${mo.moNumber} completed successfully.`);
    }
  }

  // 7. Deliver Sales Order
  console.log("\n7. Delivering Sales Order...");
  // Fetch fresh SO items with their current stock to check delivery viability
  const freshSO = await db.salesOrder.findUnique({
    where: { id: so.id },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (freshSO) {
    await db.$transaction(async (tx) => {
      for (const line of freshSO.items) {
        // Query exact amount reserved
        const reserveMovements = await tx.inventoryMovement.findMany({
          where: {
            productId: line.productId,
            referenceType: "SALES_ORDER",
            referenceId: freshSO.id,
            movementType: MovementType.RESERVE,
            companyId: company.id,
          },
        });
        const totalReserved = reserveMovements.reduce((sum, m) => sum + m.quantity, 0);

        const releaseMovements = await tx.inventoryMovement.findMany({
          where: {
            productId: line.productId,
            referenceType: "SALES_ORDER",
            referenceId: freshSO.id,
            movementType: MovementType.RELEASE,
            companyId: company.id,
          },
        });
        const totalReleased = releaseMovements.reduce((sum, m) => sum + m.quantity, 0);

        const actualQtyToRelease = totalReserved - totalReleased;

        if (actualQtyToRelease > 0) {
          await recordStockMovement(
            line.productId,
            actualQtyToRelease,
            MovementType.RELEASE,
            "SALES_ORDER",
            freshSO.id,
            company.id,
            tx
          );
        }

        // Physically decrement stock
        await recordStockMovement(
          line.productId,
          line.quantity,
          MovementType.OUT,
          "SALES_ORDER",
          freshSO.id,
          company.id,
          tx
        );
      }

      await tx.salesOrder.update({
        where: { id: freshSO.id },
        data: { status: "DELIVERED" },
      });
    });
    console.log("Sales Order marked as DELIVERED successfully.");
  }

  // 8. Validate final stock counts
  console.log("\n8. Validating final stock balances in database...");
  const finalBuds = await db.product.findUnique({ where: { id: buds.id } });
  const finalLegs = await db.product.findUnique({ where: { id: woodLegs.id } });
  const finalTable = await db.product.findUnique({ where: { id: table.id } });

  console.log(`Final "buds" stock: ${finalBuds?.stockQty} (Expected: 100 - 101 + 1 = 0)`);
  console.log(`Final "Wooden Legs" stock: ${finalLegs?.stockQty} (Expected: 50 - 20 = 30)`);
  console.log(`Final "Wooden Table" stock: ${finalTable?.stockQty} (Expected: 0 + 5 - 5 = 0)`);

  const success =
    finalBuds?.stockQty === 0 &&
    finalLegs?.stockQty === 30 &&
    finalTable?.stockQty === 0;

  if (success) {
    console.log("\n*** INTEGRATION TEST PASSED SUCCESSFULLY! ***");
  } else {
    console.log("\n*** INTEGRATION TEST FAILED! ***");
  }

  // Clean up
  console.log("\nCleaning up test data...");
  await db.salesOrderItem.deleteMany({ where: { salesOrderId: so.id } });
  await db.salesOrder.deleteMany({ where: { companyId: company.id } });
  await db.mOComponent.deleteMany({ where: { product: { companyId: company.id } } });
  await db.manufacturingOrder.deleteMany({ where: { companyId: company.id } });
  await db.purchaseOrderItem.deleteMany({ where: { product: { companyId: company.id } } });
  await db.purchaseOrder.deleteMany({ where: { companyId: company.id } });
  await db.boMComponent.deleteMany({ where: { product: { companyId: company.id } } });
  await db.billOfMaterials.deleteMany({ where: { companyId: company.id } });
  await db.inventoryMovement.deleteMany({ where: { companyId: company.id } });
  await db.product.deleteMany({ where: { companyId: company.id } });
  await db.vendor.deleteMany({ where: { companyId: company.id } });
  await db.company.delete({ where: { id: company.id } });
  console.log("Cleanup complete!");
}

runTest().catch((e) => {
  console.error("Test execution failed:", e);
});
