import { LobbyVisibility } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateLobbyVisibilityDto {
  @IsEnum(LobbyVisibility)
  visibility: LobbyVisibility;
}
