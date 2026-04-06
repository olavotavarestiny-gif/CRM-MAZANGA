ALTER TABLE "ConfiguracaoFaturacao"
ADD COLUMN "telefoneEmpresa" TEXT NOT NULL DEFAULT '',
ADD COLUMN "emailEmpresa" TEXT NOT NULL DEFAULT '',
ADD COLUMN "websiteEmpresa" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Factura"
ADD COLUMN "baseCurrency" TEXT NOT NULL DEFAULT 'AOA',
ADD COLUMN "displayCurrency" TEXT NOT NULL DEFAULT 'AOA',
ADD COLUMN "exchangeRateDate" TIMESTAMP(3),
ADD COLUMN "displayMode" TEXT NOT NULL DEFAULT 'DOCUMENT_ONLY';

UPDATE "Factura"
SET
  "baseCurrency" = 'AOA',
  "displayCurrency" = COALESCE(NULLIF("currencyCode", ''), 'AOA'),
  "displayMode" = CASE
    WHEN COALESCE(NULLIF("currencyCode", ''), 'AOA') <> 'AOA' THEN 'DOCUMENT_PLUS_INTERNAL'
    ELSE 'DOCUMENT_ONLY'
  END,
  "exchangeRateDate" = CASE
    WHEN COALESCE(NULLIF("currencyCode", ''), 'AOA') <> 'AOA' AND "exchangeRate" IS NOT NULL THEN COALESCE("createdAt", NOW())
    ELSE NULL
  END;

ALTER TABLE "FacturaRecorrente"
ADD COLUMN "baseCurrency" TEXT NOT NULL DEFAULT 'AOA',
ADD COLUMN "displayCurrency" TEXT NOT NULL DEFAULT 'AOA',
ADD COLUMN "exchangeRateDate" TIMESTAMP(3),
ADD COLUMN "displayMode" TEXT NOT NULL DEFAULT 'DOCUMENT_ONLY';

UPDATE "FacturaRecorrente"
SET
  "baseCurrency" = 'AOA',
  "displayCurrency" = COALESCE(NULLIF("currencyCode", ''), 'AOA'),
  "displayMode" = 'DOCUMENT_ONLY',
  "exchangeRateDate" = CASE
    WHEN COALESCE(NULLIF("currencyCode", ''), 'AOA') <> 'AOA' AND "exchangeRate" IS NOT NULL THEN COALESCE("updatedAt", "createdAt", NOW())
    ELSE NULL
  END;
