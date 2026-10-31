-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "discountId" INTEGER;

-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN "discountId" INTEGER;
