import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReplayService } from './replay.service';
import { diskStorage } from 'multer'; // Only import diskStorage
import { extname } from 'path';
import * as fs from 'fs';
import { Request } from 'express'; // Use express for request typing

@Controller('replay')
export class ReplayController {
  constructor(private readonly replayService: ReplayService) {}

  @Post('upload')
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
      limits: { fileSize: 100 * 1024 * 1024 },
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
  async uploadReplay(@UploadedFile() file: Express.Multer.File) {
    if (!file?.path) {
      throw new BadRequestException('No valid replay file uploaded.');
    }

    return await this.replayService.processReplay(file.path);
  }
}
