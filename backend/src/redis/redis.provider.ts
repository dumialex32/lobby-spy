import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Cluster } from 'ioredis';

@Injectable()
export class RedisProvider implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisProvider.name);
  private readonly client: Redis | Cluster;
  private readonly isCluster: boolean;

  constructor(private readonly configService: ConfigService) {
    const redisConfig = {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD', ''),
      db: this.configService.get<number>('REDIS_DB', 0),
      connectTimeout: 5000,
      commandTimeout: 3000,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times > 5) {
          this.logger.error('Max Redis reconnection attempts reached');
          return null;
        }
        const delay = Math.min(times * 100, 5000);
        this.logger.warn(`Redis reconnecting in ${delay}ms`);
        return delay;
      },
    };

    // Support for Redis Cluster if configured
    this.isCluster = this.configService.get<boolean>('REDIS_CLUSTER', false);
    if (this.isCluster) {
      this.client = new Cluster(
        [{ host: redisConfig.host, port: redisConfig.port }],
        {
          ...redisConfig,
          scaleReads: 'slave',
        },
      );
    } else {
      this.client = new Redis(redisConfig);
    }

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.client.on('connect', () =>
      this.logger.log('Redis connection established'),
    );
    this.client.on('ready', () =>
      this.logger.log('Redis ready to accept commands'),
    );
    this.client.on('error', (err) => this.logger.error('Redis error', err));
    this.client.on('close', () => this.logger.warn('Redis connection closed'));
    this.client.on('reconnecting', () =>
      this.logger.log('Redis reconnecting...'),
    );
    this.client.on('end', () => this.logger.warn('Redis connection ended'));
  }

  getClient(): Redis | Cluster {
    return this.client;
  }

  async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch (error) {
      this.logger.error('Redis ping failed', error);
      throw new Error('Redis unavailable');
    }
  }

  async onApplicationShutdown() {
    try {
      await this.client.quit();
      this.logger.log('Redis connection gracefully closed');
    } catch (error) {
      this.logger.error('Error closing Redis connection', error);
    }
  }
}
