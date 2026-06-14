-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "BillOfMaterials" ADD COLUMN     "reference" TEXT;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "address" TEXT,
ADD COLUMN     "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoCreateMO" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "ManufacturingOrder" ADD COLUMN     "bomId" TEXT,
ADD COLUMN     "bomReference" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canAccessAuditLogs" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canAccessBoM" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canAccessManufacturing" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canAccessProducts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canAccessPurchases" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canAccessSales" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canAccessStockLedger" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "MOComponent" (
    "id" TEXT NOT NULL,
    "moId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MOComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MOWorkOrder" (
    "id" TEXT NOT NULL,
    "moId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "workCenter" TEXT NOT NULL,
    "expectedDuration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MOWorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoMWorkOrder" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "workCenter" TEXT NOT NULL,
    "expectedDuration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoMWorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- AddForeignKey
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BillOfMaterials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MOComponent" ADD CONSTRAINT "MOComponent_moId_fkey" FOREIGN KEY ("moId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MOComponent" ADD CONSTRAINT "MOComponent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MOWorkOrder" ADD CONSTRAINT "MOWorkOrder_moId_fkey" FOREIGN KEY ("moId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoMWorkOrder" ADD CONSTRAINT "BoMWorkOrder_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BillOfMaterials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
