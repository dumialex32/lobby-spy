import { ConfigService } from '@nestjs/config';
import { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Rate limiter configuration
 * @param config - ConfigService instance
 * @returns ThrottlerModuleOptions configuration
 */
export const throttlerConfig = (
  config: ConfigService,
): ThrottlerModuleOptions => ({
  throttlers: [
    {
      name: 'strict',
      ttl: config.get<number>('THROTTLE_STRICT_TTL', 60000),
      limit: config.get<number>('THROTTLE_STRICT_LIMIT', 3),
      blockDuration: config.get<number>('THROTTLE_STRICT_BLOCK', 300000),
    },
    {
      name: 'auth',
      ttl: config.get<number>('THROTTLE_AUTH_TTL', 60000),
      limit: config.get<number>('THROTTLE_AUTH_LIMIT', 10),
    },
    {
      name: 'lobby',
      ttl: config.get<number>('THROTTLE_LOBBY_TTL', 60000),
      limit: config.get<number>('THROTTLE_LOBBY_LIMIT', 15),
    },
    {
      name: 'replay',
      ttl: config.get<number>('THROTTLE_REPLAY_TTL', 60000),
      limit: config.get<number>('THROTTLE_REPLAY_LIMIT', 20),
    },
    {
      name: 'default',
      ttl: config.get<number>('THROTTLE_DEFAULT_TTL', 60000),
      limit: config.get<number>('THROTTLE_DEFAULT_LIMIT', 30),
    },
  ],
});
