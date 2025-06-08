import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { createMockUser } from 'src/common/utils/test-utils/mockUser';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest
              .fn()
              .mockResolvedValueOnce('mock-access-token')
              .mockResolvedValueOnce('mock-refresh-token'),
            verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-id' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              switch (key) {
                case 'JWT_ACCESS_SECRET':
                  return 'access-secret';
                case 'JWT_REFRESH_SECRET':
                  return 'refresh-secret';
                case 'JWT_ACCESS_EXPIRES_IN':
                  return '15m';
                case 'JWT_REFRESH_EXPIRES_IN':
                  return '7d';
                default:
                  return null;
              }
            }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findBySteamId: jest.fn().mockResolvedValue(
              createMockUser({
                id: 'user-id',
                steamId: 'steam-id',
                username: 'testuser',
              }),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    usersService = module.get<UsersService>(UsersService);
  });

  describe('generateJwt', () => {
    it('should generate both access and refresh tokens', async () => {
      const mockUser = createMockUser({
        id: 'user-id',
        steamId: 'steam-id',
        username: 'testuser',
      });

      const result = await service.generateJwt(mockUser);

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(configService.get).toHaveBeenCalledWith('JWT_ACCESS_SECRET');
      expect(configService.get).toHaveBeenCalledWith('JWT_REFRESH_SECRET');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify token using configured secret', async () => {
      const testToken = 'test-token-123';
      const result = await service.verifyAccessToken(testToken);

      expect(result).toEqual({ sub: 'user-id' });
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(testToken, {
        secret: 'access-secret',
      });
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify token using refresh secret', async () => {
      const testToken = 'refresh-token-123';
      const result = await service.verifyRefreshToken(testToken);

      expect(result).toEqual({ sub: 'user-id' });
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(testToken, {
        secret: 'refresh-secret',
      });
    });
  });

  describe('refreshTokens', () => {
    it('should generate new access token', async () => {
      const mockUser = createMockUser({
        id: 'user-id',
        steamId: 'steam-id',
      });

      jest.spyOn(service, 'verifyRefreshToken').mockResolvedValue({
        sub: 'user-id',
        steamId: 'steam-id',
        username: 'testuser',
      });

      const result = await service.refreshTokens('refresh-token');

      expect(result).toEqual({
        accessToken: 'mock-access-token',
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: 'user-id',
          steamId: 'steam-id',
          username: 'testuser',
        },
        {
          expiresIn: '15m',
          secret: 'access-secret',
        },
      );
      expect(usersService.findBySteamId).toHaveBeenCalledWith('steam-id');
    });
  });
});
