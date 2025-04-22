-- CreateEnum
CREATE TYPE "LobbyVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "Lobby" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "visible" "LobbyVisibility" NOT NULL DEFAULT 'PUBLIC';
