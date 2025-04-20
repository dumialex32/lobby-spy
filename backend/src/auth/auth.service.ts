import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateJwt(user: User): Promise<string> {
    const payload = {
      sub: user.id,
      steamId: user.steamId,
      username: user.username,
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '1d',
      secret: this.configService.get<string>('JWT_SECRET'),
    });
  }

  async verifyToken(token: string): Promise<any> {
    return this.jwtService.verifyAsync(token, {
      secret: this.configService.get<string>('JWT_SECRET'),
    });
  }
}
