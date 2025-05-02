/**
 * Configuration interface for health checks
 * @interface {HealthCheckConfig}
 */
export interface HealthCheckConfig {
  /** Base API URL for ping checks */
  apiEndpoint: string;

  /** Memory threshold in bytes for heap checks */
  memoryThreshold: number;

  /** Redis connection timeout in milliseconds */
  redisTimeout: number;

  /** Number of failures before circuit breaker trips */
  circuitBreakerThreshold: number;

  /** Cooldown period after circuit break (ms) */
  cooldownPeriod?: number;

  /** Interval for detailed health checks (ms) */
  detailedCheckInterval?: number;

  /** Timeout for basic health checks (ms) */
  basicCheckTimeout?: number;
}

/**
 * Default health check configuration values
 * @constant {DEFAULT_HEALTH_CONFIG}
 */
export const DEFAULT_HEALTH_CONFIG: Partial<HealthCheckConfig> = {
  cooldownPeriod: 30000,
  detailedCheckInterval: 60000,
  basicCheckTimeout: 5000,
};
