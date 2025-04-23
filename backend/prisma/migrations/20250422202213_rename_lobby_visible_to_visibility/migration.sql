/*
  Warnings:

  - You are about to drop the column `visible` on the `Lobby` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Lobby" DROP COLUMN "visible",
ADD COLUMN     "visibility" "LobbyVisibility" NOT NULL DEFAULT 'PUBLIC';
