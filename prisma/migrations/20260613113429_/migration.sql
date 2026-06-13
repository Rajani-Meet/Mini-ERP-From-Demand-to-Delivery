/*
  Warnings:

  - The values [CLOSED] on the enum `PurchaseOrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [CLOSED] on the enum `SalesOrderStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PurchaseOrderStatus_new" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
ALTER TABLE "PurchaseOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "status" TYPE "PurchaseOrderStatus_new" USING ("status"::text::"PurchaseOrderStatus_new");
ALTER TYPE "PurchaseOrderStatus" RENAME TO "PurchaseOrderStatus_old";
ALTER TYPE "PurchaseOrderStatus_new" RENAME TO "PurchaseOrderStatus";
DROP TYPE "PurchaseOrderStatus_old";
ALTER TABLE "PurchaseOrder" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "SalesOrderStatus_new" AS ENUM ('DRAFT', 'CONFIRMED', 'DELIVERED', 'CANCELLED');
ALTER TABLE "SalesOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SalesOrder" ALTER COLUMN "status" TYPE "SalesOrderStatus_new" USING ("status"::text::"SalesOrderStatus_new");
ALTER TYPE "SalesOrderStatus" RENAME TO "SalesOrderStatus_old";
ALTER TYPE "SalesOrderStatus_new" RENAME TO "SalesOrderStatus";
DROP TYPE "SalesOrderStatus_old";
ALTER TABLE "SalesOrder" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "PurchaseOrderItem" ADD COLUMN     "receivedQty" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "customerAddress" TEXT;
