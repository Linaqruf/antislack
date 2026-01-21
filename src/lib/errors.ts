/**
 * AntiSlack Error Handling Module
 * Provides centralized error handling utilities for the extension
 */

export class AntiSlackError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'AntiSlackError';
  }
}

// Error codes
export const ErrorCodes = {
  STORAGE_READ_FAILED: 'STORAGE_READ_FAILED',
  STORAGE_WRITE_FAILED: 'STORAGE_WRITE_FAILED',
  RULES_UPDATE_FAILED: 'RULES_UPDATE_FAILED',
  IMPORT_PARSE_FAILED: 'IMPORT_PARSE_FAILED',
  IMPORT_INVALID_DATA: 'IMPORT_INVALID_DATA',
  BYPASS_SESSION_FAILED: 'BYPASS_SESSION_FAILED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * Handle storage-related errors with graceful fallback
 */
export function handleStorageError(error: unknown, operation: string): void {
  const message = error instanceof Error ? error.message : 'Unknown storage error';
  console.error(`[AntiSlack] Storage error during ${operation}:`, message);

  // Log to extension error tracking if available
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    console.error(`[AntiSlack] Extension ID: ${chrome.runtime.id}`);
  }
}

/**
 * Handle declarativeNetRequest rule errors
 */
export function handleRuleError(error: unknown, action: string): void {
  const message = error instanceof Error ? error.message : 'Unknown rule error';
  console.error(`[AntiSlack] Rule error during ${action}:`, message);

  // Check for common rule errors
  if (message.includes('MAX_NUMBER_OF_DYNAMIC_RULES')) {
    console.error('[AntiSlack] Maximum dynamic rules limit reached. Consider removing some blocked sites.');
  }
}

/**
 * Safely execute an async operation with error handling
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  fallback: T,
  errorContext: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    handleStorageError(error, errorContext);
    return fallback;
  }
}

/**
 * Safely parse JSON with error handling
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    console.error('[AntiSlack] Failed to parse JSON data');
    return defaultValue;
  }
}

/**
 * Validate import data structure
 */
export function validateImportData(
  data: unknown,
  requiredFields: string[]
): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid data format' };
  }

  for (const field of requiredFields) {
    if (!(field in data)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  return { valid: true };
}

/**
 * Create a toast-compatible error message
 */
export function formatUserError(error: unknown): string {
  if (error instanceof AntiSlackError) {
    return error.message;
  }

  if (error instanceof Error) {
    // Simplify technical errors for users
    if (error.message.includes('storage')) {
      return 'Failed to save data. Please try again.';
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'Network error. Please check your connection.';
    }
    return error.message;
  }

  return 'An unexpected error occurred.';
}

/**
 * Log error with context for debugging
 */
export function logError(
  context: string,
  error: unknown,
  additionalInfo?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[AntiSlack ${timestamp}] ${context}:`, {
    message: errorMessage,
    stack: errorStack,
    ...additionalInfo,
  });
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 100
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
