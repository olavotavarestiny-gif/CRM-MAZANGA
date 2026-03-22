type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  headers: Record<string, string>;
};

type LimiterType = 'login' | 'register' | 'api' | 'forgotPassword';

// Graceful no-op when Upstash env vars are not set (dev mode)
function noopResult(limit: number): RateLimitResult {
  return {
    success: true,
    limit,
    remaining: limit,
    reset: Date.now() + 60_000,
    headers: {},
  };
}

const LIMITS: Record<LimiterType, { requests: number; windowSeconds: number }> = {
  login:         { requests: 5,   windowSeconds: 60 },
  register:      { requests: 3,   windowSeconds: 3600 },
  api:           { requests: 100, windowSeconds: 60 },
  forgotPassword:{ requests: 3,   windowSeconds: 3600 },
};

let ratelimiters: Record<LimiterType, unknown> | null = null;

async function getLimiters() {
  if (ratelimiters) return ratelimiters;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  const { Ratelimit } = await import('@upstash/ratelimit');
  const { Redis } = await import('@upstash/redis');

  const redis = new Redis({ url, token });

  ratelimiters = {
    login:          new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 m') }),
    register:       new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h') }),
    api:            new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1 m') }),
    forgotPassword: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h') }),
  } as Record<LimiterType, unknown>;

  return ratelimiters;
}

export async function checkRateLimit(
  identifier: string,
  type: LimiterType
): Promise<RateLimitResult> {
  const cfg = LIMITS[type];

  try {
    const limiters = await getLimiters();
    if (!limiters) return noopResult(cfg.requests);

    const limiter = limiters[type] as {
      limit: (id: string) => Promise<{ success: boolean; limit: number; remaining: number; reset: number }>;
    };
    const result = await limiter.limit(identifier);

    const headers: Record<string, string> = {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(result.reset),
    };

    if (!result.success) {
      const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
      headers['Retry-After'] = String(retryAfter);
    }

    return { ...result, headers };
  } catch {
    // If Redis is down, fail open (don't block users)
    return noopResult(cfg.requests);
  }
}
