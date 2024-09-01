-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "desc" TEXT NOT NULL DEFAULT 'project desc',
    "total" INTEGER NOT NULL DEFAULT 0,
    "projectIconSetJSON" TEXT NOT NULL
);
INSERT INTO "new_Project" ("desc", "id", "name", "prefix", "projectIconSetJSON") SELECT "desc", "id", "name", "prefix", "projectIconSetJSON" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_prefix_key" ON "Project"("prefix");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
