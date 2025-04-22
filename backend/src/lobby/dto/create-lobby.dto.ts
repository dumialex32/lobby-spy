import { IsString, MinLength } from 'class-validator';

export class CreateLobbyDto {
  @IsString()
  @MinLength(3)
  name: string;
}
