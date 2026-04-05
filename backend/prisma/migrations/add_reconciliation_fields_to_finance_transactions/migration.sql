ALTER TABLE "Transaction"
ADD COLUMN "invoice_id" TEXT,
ADD COLUMN "cash_session_id" TEXT,
ADD COLUMN "reconciled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reconciled_at" TIMESTAMP(3);

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_invoice_id_fkey"
FOREIGN KEY ("invoice_id") REFERENCES "Factura"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_cash_session_id_fkey"
FOREIGN KEY ("cash_session_id") REFERENCES "CaixaSessao"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "Transaction_invoice_id_idx" ON "Transaction"("invoice_id");
CREATE INDEX "Transaction_cash_session_id_idx" ON "Transaction"("cash_session_id");
CREATE INDEX "Transaction_userId_invoice_id_idx" ON "Transaction"("userId", "invoice_id");
CREATE INDEX "Transaction_userId_cash_session_id_idx" ON "Transaction"("userId", "cash_session_id");
