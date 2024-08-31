/*
  Warnings:

  - You are about to drop the `_ProjectToUser` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `adminUserId` on the `Project` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "_ProjectToUser_B_index";

-- DropIndex
DROP INDEX "_ProjectToUser_AB_unique";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_ProjectToUser";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "role" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "desc" TEXT NOT NULL DEFAULT 'project desc'
);
INSERT INTO "new_Project" ("id") SELECT "id" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
