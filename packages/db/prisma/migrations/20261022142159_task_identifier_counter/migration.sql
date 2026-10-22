-- CreateTable
CREATE TABLE "task_identifier_counter" (
    "organizationId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "task_identifier_counter_pkey" PRIMARY KEY ("organizationId","prefix")
);

-- AddForeignKey
ALTER TABLE "task_identifier_counter" ADD CONSTRAINT "task_identifier_counter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed each counter with the highest number already used for its prefix.
INSERT INTO "task_identifier_counter" ("organizationId", "prefix", "value")
SELECT "organizationId",
       substring("identifier" from '^(.*)-\d+$'),
       max(substring("identifier" from '-(\d+)$')::int)
FROM "task"
WHERE "identifier" ~ '-\d+$'
GROUP BY 1, 2;
