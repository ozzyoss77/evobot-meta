import Redis from 'ioredis';

export class RedisClient {
  private static instance: RedisClient | null = null;
  private client: Redis;

  private constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    const redisDb = process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0;

    this.client = new Redis(redisUrl, {
      db: redisDb
    });
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  getClient(): Redis {
    return this.client;
  }
}

export const redisClient = RedisClient.getInstance();

