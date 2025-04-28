import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReplayService } from './replay.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from 'src/auth/auth-request.interface';
import { CanUploadReplayGuard } from 'src/lobby/guards/upload-replay.guard';

/**
 * Replay File Management Controller
 *
 * Handles replay file uploads and processing with:
 * - Secure file upload handling
 * - Lobby membership verification
 * - File validation and storage
 */
@Controller('replay')
export class ReplayController {
  constructor(private readonly replayService: ReplayService) {}

  /**
   * Upload and process a replay file
   * @param file - Uploaded replay file (.dem format)
   * @param req - Authenticated request with user/lobby context
   * @returns Processing result
   *
   * @protected Requires:
   * - JWT authentication
   * - Lobby membership/ownership (CanUploadReplayGuard)
   *
   * @file_handling
   * - Stores temporarily in ./temp directory
   * - Validates .dem file extension
   * - Limits file size to 100MB
   * - Generates unique filenames
   */
  @Post('upload')
  @UseGuards(JwtAuthGuard, CanUploadReplayGuard)
  @UseInterceptors(
    FileInterceptor('replay', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = './temp';
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
          }
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const extension = extname(file.originalname || '');
          const safeFilename = `${Date.now()}${extension}`;
          cb(null, safeFilename);
        },
      }),
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
      fileFilter: (
        _req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        const fileName = file.originalname;
        if (!fileName || !fileName.endsWith('.dem')) {
          return cb(new Error('Only .dem files are allowed!'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadReplay(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    // Verify user is in a lobby (either as owner or member)
    const lobbyId = req.user.lobby?.id || req.user.memberLobby?.id;
    if (!lobbyId) throw new BadRequestException('User not in any lobby');

    // Validate file was properly uploaded
    if (!file?.path) {
      throw new BadRequestException('No valid replay file uploaded.');
    }

    // Process the replay file
    return await this.replayService.processReplay(file.path, lobbyId);
  }
}
