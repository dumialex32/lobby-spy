import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parseMatchInfo, parseMatchEnd } from './utils/parse-utils';
import { PrismaService } from 'src/prisma/prisma.service';
import { ParsedRawInfo, ParsedRawMatchend } from 'src/types/parsedRawDataTypes';
import { Player, Prisma } from '@prisma/client';
import {
  CurrentGamePlayerStats,
  ProcessReplayResponse,
} from 'src/types/replayTypes';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ReplayService {
  private readonly logger = new Logger(ReplayService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Processes a Dota 2 replay file, extracts match data, and saves it to the database
   * @param filePath Path to the .dem replay file
   * @returns Promise<void>
   * @throws ConflictException if replay already exists
   * @throws HttpException if processing fails
   */
  async processReplay(filePath: string): Promise<ProcessReplayResponse> {
    try {
      this.logger.log(`Processing replay file: ${filePath}`);

      // Parse replay data - these run sequentially to ensure proper error handling
      const [matchInfo, matchEnd] = await Promise.all([
        parseMatchInfo(filePath),
        parseMatchEnd(filePath),
      ]);

      // Validate data consistency before processing
      this.validateMatchData(matchInfo, matchEnd);

      // Check for existing replay using matchId
      if (await this.replayExists(matchInfo.matchId)) {
        throw new ConflictException(
          `Replay ${matchInfo.matchId} already exists`,
        );
      }

      // Process in a transaction to ensure atomicity
      await this.processMatchData(matchInfo, matchEnd);

      this.logger.log(`Successfully processed replay: ${matchInfo.matchId}`);

      return {
        message: 'Replay processed successfully.',
        matchId: String(matchInfo.matchId),
        playerCount: matchInfo.players.length,
        duration: matchInfo.duration,
        winner: matchInfo.winner,
      } as ProcessReplayResponse;
    } catch (err) {
      throw this.transformError(err);
    } finally {
      await this.cleanUpFile(filePath);
    }
  }

  /**
   * Validates consistency between match info and end data
   * @throws Error if data is inconsistent
   */
  private validateMatchData(
    matchInfo: ParsedRawInfo,
    matchEnd: ParsedRawMatchend[],
  ): void {
    // Check player count matches
    if (matchInfo.players.length !== matchEnd.length) {
      throw new Error(
        `Player count mismatch: ${matchInfo.players.length} in info vs ${matchEnd.length} in end data`,
      );
    }

    // Verify all players in matchEnd exist in matchInfo
    const missingPlayers = matchEnd.filter(
      (endPlayer) =>
        !matchInfo.players.some((p) => p.steamId === endPlayer.steamId),
    );
    if (missingPlayers.length > 0) {
      throw new Error(
        `Missing player info for steamIds: ${missingPlayers.map((p) => p.steamId).join(', ')}`,
      );
    }
  }

  /**
   * Processes and saves match data in a transaction
   */
  private async processMatchData(
    matchInfo: ParsedRawInfo,
    matchEnd: ParsedRawMatchend[],
  ): Promise<void> {
    await this.prisma.$transaction(async (prisma) => {
      // First create the game with all player stats
      const createdGame = await prisma.lobbyGame.create({
        data: {
          matchId: String(matchInfo.matchId),
          duration: matchInfo.duration,
          gameWinner: matchInfo.winner, // to do: get string directly from parser
          playerStats: {
            create: this.preparePlayerStatsData(matchInfo, matchEnd),
          },
        },
        include: { playerStats: true },
      });
      console.log(createdGame);

      // Then update player aggregates in bulk
      await this.updatePlayerAggregates(prisma, matchEnd);
    });
  }

  /**
   * Updates player aggregate statistics in bulk for better performance
   */
  private async updatePlayerAggregates(
    prisma: Prisma.TransactionClient,
    matchEnd: ParsedRawMatchend[],
  ): Promise<void> {
    // Get all steamIds first
    const steamIds = matchEnd.map((player) => String(player.steamId));

    // Fetch existing players in single query
    const existingPlayers = await prisma.player.findMany({
      where: { steamId: { in: steamIds } },
    });
    const playerMap = new Map(existingPlayers.map((p) => [p.steamId, p]));

    // Prepare all update operations
    const updateOperations = matchEnd.map((player) => {
      const steamId = String(player.steamId);
      const existingPlayer = playerMap.get(steamId);
      const currentStats = this.createCurrentGamePlayerData(player);

      return prisma.player.upsert({
        where: { steamId },
        update: this.getPlayerUpdateData(currentStats, existingPlayer),
        create: this.getPlayerCreateData(currentStats),
      });
    });

    // Execute all updates in parallel
    await Promise.all(updateOperations);
  }

  /**
   * Creates current game player data from parsed match end data
   */
  private createCurrentGamePlayerData(player: ParsedRawMatchend) {
    return {
      steamId: String(player.steamId),
      playerName: player.name,
      kills: player.kills,
      deaths: player.deaths,
      assists: player.assists,
      networth: player.gold,
      lastHits: player.lastHits,
      denies: player.denies,
    };
  }

  /**
   * Generates update data for existing players
   */
  private getPlayerUpdateData(
    currentStats: CurrentGamePlayerStats,
    existingPlayer?: Player,
  ): Prisma.PlayerUpdateInput {
    // If no existing player, treat as new player (shouldn't happen due to upsert)
    if (!existingPlayer) {
      return this.getPlayerCreateData(currentStats);
    }

    const totalGames = existingPlayer.totalGames + 1;

    return {
      playerName: currentStats.playerName,
      totalGames,
      totalKills: { increment: currentStats.kills },
      totalDeaths: { increment: currentStats.deaths },
      totalAssists: { increment: currentStats.assists },
      totalNetworth: { increment: currentStats.networth },
      avgKills: (existingPlayer.totalKills + currentStats.kills) / totalGames,
      avgDeaths:
        (existingPlayer.totalDeaths + currentStats.deaths) / totalGames,
      avgAssists:
        (existingPlayer.totalAssists + currentStats.assists) / totalGames,
      avgNetworth:
        (existingPlayer.totalNetworth + currentStats.networth) / totalGames,
    };
  }

  /**
   * Generates create data for new players
   */
  private getPlayerCreateData(
    currentStats: CurrentGamePlayerStats,
  ): Prisma.PlayerCreateInput {
    return {
      steamId: currentStats.steamId,
      playerName: currentStats.playerName,
      totalGames: 1,
      totalKills: currentStats.kills,
      totalDeaths: currentStats.deaths,
      totalAssists: currentStats.assists,
      totalNetworth: currentStats.networth,
      avgKills: currentStats.kills,
      avgDeaths: currentStats.deaths,
      avgAssists: currentStats.assists,
      avgNetworth: currentStats.networth,
    };
  }

  /**
   * Prepares player stats data for database insertion
   */
  private preparePlayerStatsData(
    matchInfo: ParsedRawInfo,
    matchEnd: ParsedRawMatchend[],
  ): Prisma.PlayerStatsCreateWithoutLobbyGameInput[] {
    return matchEnd.map((endData) => {
      const playerInfo = matchInfo.players.find(
        (player) => player.steamId === endData.steamId,
      );

      if (!playerInfo) {
        // This should never happen due to prior validation
        throw new Error(`No player with id ${endData.steamId} found`);
      }

      return {
        steamId: String(playerInfo.steamId),
        playerName: playerInfo.name,
        heroName: playerInfo.hero,
        gameTeam: endData.team === 'Radiant' ? 'Radiant' : 'Dire',
        kills: endData.kills,
        deaths: endData.deaths,
        assists: endData.assists,
        networth: endData.gold,
        lastHits: endData.lastHits,
        denies: endData.denies,
        level: endData.level,
      };
    });
  }

  /**
   * Handles errors during replay processing
   */
  private transformError(error: Error): HttpException {
    // Preserve ConflictException with its original message
    if (error instanceof ConflictException) {
      return error;
    }

    // Convert validation errors to BadRequestException
    if (
      error.message.includes('Player count mismatch') ||
      error.message.includes('Missing player info')
    ) {
      return new BadRequestException(error.message);
    }

    // For all other errors
    this.logger.error(`Replay processing error: ${error.message}`, error.stack);

    return new HttpException(
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Replay processing failed',
        details: this.configService.get('NODE_ENV')
          ? error.message
          : 'Please contact support',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /**
   * Checks if a replay already exists in the database
   */
  private async replayExists(matchId: number): Promise<boolean> {
    const game = await this.prisma.lobbyGame.findUnique({
      where: { matchId: String(matchId) },
    });
    return !!game;
  }

  /**
   * Cleans up the replay file after processing
   */
  private async cleanUpFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      this.logger.log(`Deleted replay file: ${filePath}`);
    } catch (err: any) {
      this.logger.error(`Failed to delete replay file: ${filePath}`, err.stack);
    }
  }

  /**
   * Extracts match ID from file path
   */
  private extractMatchId(filePath: string): string {
    return path.basename(filePath, '.dem');
  }
}
