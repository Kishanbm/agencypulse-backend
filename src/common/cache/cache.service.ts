import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      host: config.get<string>('redis.host'),
      port: config.get<number>('redis.port'),
      password: config.get<string>('redis.password') || undefined,
      lazyConnect: true,
      // Don't buffer commands while disconnected — fail fast, fall through to DB
      enableOfflineQueue: false,
      // AI2 fix: prevent requests hanging when Redis is down
      maxRetriesPerRequest: 1,
    });

    this.redis.on('error', (err: Error) => {
      this.logger.error('Redis error', err.message);
    });
  }

  /**
   * Read-through cache pattern.
   * Returns cached value if present; otherwise calls fn(), stores the result, and returns it.
   * AI2 fix: empty arrays / null results are NOT cached — avoids caching "no data yet" state.
   */
  async getOrSet<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.redis.get(key);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch {
      // Redis unavailable — fall through to fn(), don't fail the request
    }

    const result = await fn();

    const isEmpty =
      result === null ||
      result === undefined ||
      (Array.isArray(result) && result.length === 0);

    if (!isEmpty) {
      try {
        await this.redis.set(key, JSON.stringify(result), 'EX', ttlSeconds);
      } catch {
        // Cache write failure is non-critical — result still returned to caller
      }
    }

    return result;
  }

  /**
   * Increment a version counter for a given key.
   * Used for invalidation: old cache keys embed the old version and become stale
   * automatically — no SCAN/DELETE needed (AI1+AI2 fix: versioned invalidation).
   */
  async incrementVersion(versionKey: string): Promise<number> {
    try {
      return await this.redis.incr(versionKey);
    } catch {
      return 0;
    }
  }

  /**
   * Read the current version counter. Returns '0' if the key does not exist.
   */
  async getVersion(versionKey: string): Promise<string> {
    try {
      return (await this.redis.get(versionKey)) ?? '0';
    } catch {
      return '0';
    }
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
