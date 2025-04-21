/*
  Warnings:

  - Added the required column `lobbyId` to the `LobbyGame` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MEMBER', 'ADMIN', 'OWNER');

-- AlterTable
ALTER TABLE "LobbyGame" ADD COLUMN     "lobbyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lobbyId" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'MEMBER';

-- CreateTable
CREATE TABLE "Lobby" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lobby_ownerId_key" ON "Lobby"("ownerId");

-- AddForeignKey
ALTER TABLE "Lobby" ADD CONSTRAINT "Lobby_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyGame" ADD CONSTRAINT "LobbyGame_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
