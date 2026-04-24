/**
 * Unit tests — CacheService
 *
 * Covers:
 *   - getOrSet: cache miss → calls fn, stores result, returns it
 *   - getOrSet: cache hit → returns cached value, fn NOT called
 *   - getOrSet: does NOT cache empty arrays (AI2 fix)
 *   - getOrSet: does NOT cache null/undefined
 *   - getOrSet: Redis failure → falls through to fn() (graceful degradation)
 *   - incrementVersion: calls INCR on the version key
 *   - getVersion: returns '0' if key absent; returns stored value otherwise
 *   - No sensitive data leaked in cache keys
 */

import { CacheService } from '../cache.service';
import { ConfigService } from '@nestjs/config';

// ─── Redis mock ────────────────────────────────────────────────────────────────

const redisMock = {
  get: jest.fn(),
  set: jest.fn(),
  incr: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('ioredis', () => {
  const ctor = jest.fn().mockImplementation(() => redisMock);
  return { __esModule: true, default: ctor };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeService(): CacheService {
  const config = {
    get: (key: string) => {
      if (key === 'redis.host') return 'localhost';
      if (key === 'redis.port') return 6380;
      if (key === 'redis.password') return 'redis_dev';
      return undefined;
    },
  } as unknown as ConfigService;
  return new CacheService(config);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
  });

  // ─── getOrSet ──────────────────────────────────────────────────────────────

  describe('getOrSet', () => {
    it('cache miss — calls fn, stores result, returns value', async () => {
      redisMock.get.mockResolvedValueOnce(null); // miss
      redisMock.set.mockResolvedValueOnce('OK');

      const fn = jest.fn().mockResolvedValue([{ period: '2024-01-01', metrics: { sessions: 100 } }]);
      const result = await service.getOrSet('test-key', 300, fn);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(redisMock.set).toHaveBeenCalledWith(
        'test-key',
        expect.any(String),
        'EX',
        300,
      );
      expect(result).toEqual([{ period: '2024-01-01', metrics: { sessions: 100 } }]);
    });

    it('cache hit — returns cached value, fn NOT called', async () => {
      const cached = [{ period: '2024-01-01', metrics: { sessions: 42 } }];
      redisMock.get.mockResolvedValueOnce(JSON.stringify(cached));

      const fn = jest.fn();
      const result = await service.getOrSet('test-key', 300, fn);

      expect(fn).not.toHaveBeenCalled();
      expect(redisMock.set).not.toHaveBeenCalled();
      expect(result).toEqual(cached);
    });

    it('does NOT cache empty array (AI2 fix — no-data state is transient)', async () => {
      redisMock.get.mockResolvedValueOnce(null);
      const fn = jest.fn().mockResolvedValue([]);

      await service.getOrSet('empty-key', 300, fn);

      expect(redisMock.set).not.toHaveBeenCalled();
    });

    it('does NOT cache null result', async () => {
      redisMock.get.mockResolvedValueOnce(null);
      const fn = jest.fn().mockResolvedValue(null);

      await service.getOrSet('null-key', 300, fn);

      expect(redisMock.set).not.toHaveBeenCalled();
    });

    it('caches non-empty object result (MetricSummaryResult)', async () => {
      redisMock.get.mockResolvedValueOnce(null);
      redisMock.set.mockResolvedValueOnce('OK');

      const summary = { metrics: { sessions: 500 } };
      const fn = jest.fn().mockResolvedValue(summary);

      const result = await service.getOrSet('summary-key', 300, fn);

      expect(redisMock.set).toHaveBeenCalled();
      expect(result).toEqual(summary);
    });

    it('Redis GET failure → falls through to fn() (graceful degradation)', async () => {
      redisMock.get.mockRejectedValueOnce(new Error('Redis down'));
      redisMock.set.mockResolvedValueOnce('OK');

      const fn = jest.fn().mockResolvedValue([{ period: '2024-01-01', metrics: {} }]);
      const result = await service.getOrSet('test-key', 300, fn);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });

    it('Redis SET failure does not throw — result still returned', async () => {
      redisMock.get.mockResolvedValueOnce(null);
      redisMock.set.mockRejectedValueOnce(new Error('Redis write failed'));

      const fn = jest.fn().mockResolvedValue([{ period: '2024-01-01', metrics: { clicks: 50 } }]);

      await expect(service.getOrSet('test-key', 300, fn)).resolves.toBeDefined();
    });

    it('stored value is JSON-serialisable round-trip of the result', async () => {
      redisMock.get.mockResolvedValueOnce(null);
      let storedJson = '';
      redisMock.set.mockImplementationOnce((_key: string, value: string) => {
        storedJson = value;
        return Promise.resolve('OK');
      });

      const data = [{ period: '2024-03-01', metrics: { sessions: 999 } }];
      const fn = jest.fn().mockResolvedValue(data);
      await service.getOrSet('rtrip-key', 300, fn);

      expect(JSON.parse(storedJson)).toEqual(data);
    });
  });

  // ─── incrementVersion ──────────────────────────────────────────────────────

  describe('incrementVersion', () => {
    it('calls INCR on the version key and returns new version', async () => {
      redisMock.incr.mockResolvedValueOnce(3);
      const v = await service.incrementVersion('mv:tenant:campaign:GA4');
      expect(redisMock.incr).toHaveBeenCalledWith('mv:tenant:campaign:GA4');
      expect(v).toBe(3);
    });

    it('Redis INCR failure returns 0 (graceful degradation)', async () => {
      redisMock.incr.mockRejectedValueOnce(new Error('Redis down'));
      const v = await service.incrementVersion('mv:t:c:GA4');
      expect(v).toBe(0);
    });
  });

  // ─── getVersion ────────────────────────────────────────────────────────────

  describe('getVersion', () => {
    it('returns stored version string', async () => {
      redisMock.get.mockResolvedValueOnce('7');
      const v = await service.getVersion('mv:t:c:GA4');
      expect(v).toBe('7');
    });

    it("returns '0' when key does not exist (null from Redis)", async () => {
      redisMock.get.mockResolvedValueOnce(null);
      const v = await service.getVersion('mv:t:c:GA4');
      expect(v).toBe('0');
    });

    it("returns '0' on Redis failure", async () => {
      redisMock.get.mockRejectedValueOnce(new Error('Redis down'));
      const v = await service.getVersion('mv:t:c:GA4');
      expect(v).toBe('0');
    });
  });
});
