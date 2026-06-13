-- Add accentColor to Company
ALTER TABLE "Company" ADD COLUMN "accentColor" TEXT DEFAULT '#6366f1';

-- Add reorderPoint to Product (default 0)
ALTER TABLE "Product" ADD COLUMN "reorderPoint" INTEGER NOT NULL DEFAULT 0;

-- Drop old global unique constraint on SKU (if it exists)
DROP INDEX IF EXISTS "Product_sku_key";

-- Add per-company SKU uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS "Product_sku_companyId_key" ON "Product"("sku", "companyId");
