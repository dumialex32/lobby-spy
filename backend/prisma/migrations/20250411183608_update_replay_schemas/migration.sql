/*
  Warnings:

  - Added the required column `duration` to the `LobbyGame` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `gameWinner` on the `LobbyGame` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "LobbyGame" ADD COLUMN     "duration" INTEGER NOT NULL,
DROP COLUMN "gameWinner",
ADD COLUMN     "gameWinner" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "PlayerStats" ALTER COLUMN "gameTeam" SET DATA TYPE TEXT;
