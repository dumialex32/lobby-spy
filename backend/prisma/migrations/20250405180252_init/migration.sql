-- CreateTable
CREATE TABLE "LobbyGame" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "gameWinner" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LobbyGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerStats" (
    "id" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "heroName" TEXT NOT NULL,
    "gameTeam" INTEGER NOT NULL,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "networth" INTEGER NOT NULL,
    "lastHits" INTEGER NOT NULL,
    "denies" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "lobbyGameId" TEXT NOT NULL,

    CONSTRAINT "PlayerStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "totalGames" INTEGER NOT NULL,
    "totalKills" INTEGER NOT NULL,
    "totalDeaths" INTEGER NOT NULL,
    "totalAssists" INTEGER NOT NULL,
    "totalNetworth" INTEGER NOT NULL,
    "avgKills" DOUBLE PRECISION NOT NULL,
    "avgDeaths" DOUBLE PRECISION NOT NULL,
    "avgAssists" DOUBLE PRECISION NOT NULL,
    "avgNetworth" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LobbyGame_matchId_key" ON "LobbyGame"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_steamId_key" ON "Player"("steamId");

-- AddForeignKey
ALTER TABLE "PlayerStats" ADD CONSTRAINT "PlayerStats_lobbyGameId_fkey" FOREIGN KEY ("lobbyGameId") REFERENCES "LobbyGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
