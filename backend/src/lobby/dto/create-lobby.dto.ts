import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum LobbyVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

export class CreateLobbyDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsEnum(LobbyVisibility)
  @IsOptional()
  visibility?: LobbyVisibility;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(50)
  description?: string;
}
