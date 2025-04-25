import { LobbyVisibility } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateLobbyDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsEnum(LobbyVisibility)
  visibility: LobbyVisibility;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(50)
  description: string;
}
