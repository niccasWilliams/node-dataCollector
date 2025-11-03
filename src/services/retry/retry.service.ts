import { logger } from "../../utils/logger";

/**
 * Retry Strategy Options
 */
export type RetryStrategy = "exponential" | "linear" | "fixed";

/**
 * Retry Configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;

  /** Base delay in milliseconds (default: 1000) */
  baseDelay?: number;

  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;

  /** Retry strategy (default: "exponential") */
  strategy?: RetryStrategy;

  /** Enable jitter to avoid thundering herd (default: true) */
  jitter?: boolean;

  /** Timeout for each attempt in milliseconds (default: none) */
  timeout?: number;

  /** Function to determine if error should trigger retry */
  shouldRetry?: (error: Error) => boolean;

  /** Callback on each retry attempt */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

/**
 * Retry Result
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_CONFIG: Required<Omit<RetryConfig, "onRetry">> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  strategy: "exponential",
  jitter: true,
  timeout: 0,
  shouldRetry: () => true,
};

/**
 * Retry Service
 * Provides retry logic with exponential backoff, jitter, and configurable strategies
 */
export class RetryService {
  private config: Required<Omit<RetryConfig, "onRetry">> & Pick<RetryConfig, "onRetry">;

  constructor(config: RetryConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    customConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = customConfig ? { ...this.config, ...customConfig } : this.config;
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        // Execute with optional timeout
        const result = config.timeout
          ? await this.executeWithTimeout(fn, config.timeout)
          : await fn();

        const duration = Date.now() - startTime;
        logger.debug(`Operation succeeded on attempt ${attempt + 1}/${config.maxRetries + 1} (${duration}ms)`);

        return result;
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry this error
        if (!config.shouldRetry(lastError)) {
          logger.debug(`Error not retryable: ${lastError.message}`);
          throw lastError;
        }

        // If this was the last attempt, throw the error
        if (attempt === config.maxRetries) {
          const duration = Date.now() - startTime;
          logger.error(
            `Operation failed after ${attempt + 1} attempts (${duration}ms): ${lastError.message}`
          );
          throw lastError;
        }

        // Calculate delay before next retry
        const delay = this.calculateDelay(attempt, config);
        logger.warn(
          `Attempt ${attempt + 1}/${config.maxRetries + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`
        );

        // Call retry callback if provided
        if (config.onRetry) {
          config.onRetry(attempt + 1, lastError, delay);
        }

        // Wait before next retry
        await this.sleep(delay);
      }
    }

    throw lastError; // Should never reach here, but TypeScript needs it
  }

  /**
   * Execute with detailed result including metadata
   */
  async executeWithResult<T>(
    fn: () => Promise<T>,
    customConfig?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    const config = customConfig ? { ...this.config, ...customConfig } : this.config;
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const result = config.timeout
          ? await this.executeWithTimeout(fn, config.timeout)
          : await fn();

        return {
          success: true,
          result,
          attempts: attempt + 1,
          totalDuration: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error as Error;

        if (!config.shouldRetry(lastError) || attempt === config.maxRetries) {
          return {
            success: false,
            error: lastError,
            attempts: attempt + 1,
            totalDuration: Date.now() - startTime,
          };
        }

        const delay = this.calculateDelay(attempt, config);
        if (config.onRetry) {
          config.onRetry(attempt + 1, lastError, delay);
        }
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError!,
      attempts: config.maxRetries + 1,
      totalDuration: Date.now() - startTime,
    };
  }

  /**
   * Calculate delay based on retry strategy
   */
  private calculateDelay(
    attempt: number,
    config: Required<Omit<RetryConfig, "onRetry">>
  ): number {
    let delay: number;

    switch (config.strategy) {
      case "exponential":
        // Exponential: baseDelay * 2^attempt
        delay = config.baseDelay * Math.pow(2, attempt);
        break;

      case "linear":
        // Linear: baseDelay * (attempt + 1)
        delay = config.baseDelay * (attempt + 1);
        break;

      case "fixed":
        // Fixed: always baseDelay
        delay = config.baseDelay;
        break;

      default:
        delay = config.baseDelay;
    }

    // Apply max delay cap
    delay = Math.min(delay, config.maxDelay);

    // Apply jitter if enabled (±25% randomization)
    if (config.jitter) {
      const jitterFactor = 0.25; // ±25%
      const jitterAmount = delay * jitterFactor;
      delay = delay + (Math.random() * 2 - 1) * jitterAmount;
    }

    return Math.max(0, Math.floor(delay));
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a retry wrapper for a specific function
   */
  wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    config?: Partial<RetryConfig>
  ): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      return this.execute(() => fn(...args), config);
    };
  }
}

/**
 * Default retry service instance
 */
export const defaultRetryService = new RetryService();

/**
 * Convenience function to retry an operation
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config?: RetryConfig
): Promise<T> {
  const retryService = new RetryService(config);
  return retryService.execute(fn);
}

/**
 * Common retry configurations
 */
export const RetryPresets = {
  /** Aggressive retry - 5 attempts, fast exponential backoff */
  aggressive: {
    maxRetries: 5,
    baseDelay: 500,
    maxDelay: 10000,
    strategy: "exponential" as RetryStrategy,
  },

  /** Standard retry - 3 attempts, moderate exponential backoff */
  standard: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    strategy: "exponential" as RetryStrategy,
  },

  /** Conservative retry - 2 attempts, slower exponential backoff */
  conservative: {
    maxRetries: 2,
    baseDelay: 2000,
    maxDelay: 60000,
    strategy: "exponential" as RetryStrategy,
  },

  /** Network retry - optimized for network requests */
  network: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 15000,
    strategy: "exponential" as RetryStrategy,
    timeout: 30000,
    shouldRetry: (error: Error) => {
      // Retry on network errors, timeouts, 5xx errors
      const retryableErrors = [
        "ECONNRESET",
        "ETIMEDOUT",
        "ENOTFOUND",
        "ECONNREFUSED",
        "timeout",
      ];
      return retryableErrors.some((msg) =>
        error.message.toLowerCase().includes(msg.toLowerCase())
      );
    },
  },

  /** Database retry - optimized for database operations */
  database: {
    maxRetries: 3,
    baseDelay: 500,
    maxDelay: 5000,
    strategy: "exponential" as RetryStrategy,
    shouldRetry: (error: Error) => {
      // Retry on connection errors, deadlocks, etc.
      const retryableErrors = [
        "ECONNREFUSED",
        "ECONNRESET",
        "deadlock",
        "connection",
        "timeout",
      ];
      return retryableErrors.some((msg) =>
        error.message.toLowerCase().includes(msg.toLowerCase())
      );
    },
  },

  /** Scraping retry - optimized for web scraping with humanized delays */
  scraping: {
    maxRetries: 4,
    baseDelay: 2000,
    maxDelay: 30000,
    strategy: "exponential" as RetryStrategy,
    jitter: true,
    timeout: 60000, // 1 minute timeout per attempt
    shouldRetry: (error: Error) => {
      // Don't retry on 404 or authentication errors
      const nonRetryableErrors = ["404", "401", "403"];
      if (
        nonRetryableErrors.some((msg) =>
          error.message.toLowerCase().includes(msg.toLowerCase())
        )
      ) {
        return false;
      }
      return true;
    },
  },
};
