/**
 * PRIVACY PROTECTION UTILITIES
 * 
 * CRITICAL SECURITY RULES:
 * 1. NEVER expose maternal_health_id in any form
 * 2. Sanitize all data before logging or error reporting
 * 3. Implement data masking for UI display
 * 4. Audit all data access attempts
 * 5. Secure data transmission and storage
 */

// =====================================================
// SENSITIVE FIELD DEFINITIONS
// =====================================================

/**
 * List of sensitive fields that should never be logged or exposed
 */
export const SENSITIVE_FIELDS = [
  'maternal_health_id',
  'encrypted_maternal_health_id',
  'password',
  'password_hash',
  'session_token',
  'refresh_token',
  'access_token',
  'api_key',
  'secret',
  'private_key',
  'encryption_key'
] as const;

/**
 * List of fields that should be masked in UI (shown as asterisks)
 */
export const MASKED_FIELDS = [
  'maternal_health_id',
  'password',
  'pin',
  'ssn',
  'credit_card'
] as const;

/**
 * Redaction marker for sensitive data
 */
export const REDACTION_MARKER = '[REDACTED]';

/**
 * Masking character for UI display
 */
export const MASK_CHARACTER = '●';

// =====================================================
// DATA SANITIZATION
// =====================================================

/**
 * Sanitizes an object by removing or redacting sensitive fields
 * This is used before logging, error reporting, or debugging
 */
export function sanitizeObject(
  obj: any, 
  options: {
    redact?: boolean; // If true, replace with [REDACTED], if false, remove field
    deep?: boolean;   // If true, recursively sanitize nested objects
    preserveArrays?: boolean; // If true, sanitize arrays as well
  } = {}
): any {
  const { redact = true, deep = true, preserveArrays = true } = options;

  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitive types
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    if (!preserveArrays) {
      return obj;
    }
    return obj.map(item => deep ? sanitizeObject(item, options) : item);
  }

  // Handle objects
  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    
    // Check if this is a sensitive field
    const isSensitive = SENSITIVE_FIELDS.some(sensitiveField => 
      keyLower.includes(sensitiveField) || 
      sensitiveField.includes(keyLower)
    );

    if (isSensitive) {
      if (redact) {
        sanitized[key] = REDACTION_MARKER;
      }
      // If not redacting, we simply omit the field (don't set it)
    } else if (deep && typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, options);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitizes a string by removing potential sensitive data patterns
 */
export function sanitizeString(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let sanitized = text;

  // Pattern for 10-digit maternal health IDs
  sanitized = sanitized.replace(/\b\d{10}\b/g, '[MATERNAL_ID_REDACTED]');

  // Pattern for passwords in URLs or logs
  sanitized = sanitized.replace(/password[=:]\s*[^\s&]+/gi, 'password=[REDACTED]');

  // Pattern for tokens
  sanitized = sanitized.replace(/token[=:]\s*[^\s&]+/gi, 'token=[REDACTED]');

  // Pattern for API keys
  sanitized = sanitized.replace(/api[_-]?key[=:]\s*[^\s&]+/gi, 'api_key=[REDACTED]');

  return sanitized;
}

// =====================================================
// UI DATA MASKING
// =====================================================

/**
 * Masks sensitive data for UI display
 * Used for showing partial information without exposing full values
 */
export function maskForDisplay(
  value: string,
  options: {
    showFirst?: number;   // Number of characters to show at the beginning
    showLast?: number;    // Number of characters to show at the end
    maskChar?: string;    // Character to use for masking
    totalLength?: number; // Fixed length for the masked string
  } = {}
): string {
  if (!value || typeof value !== 'string') {
    return '';
  }

  const {
    showFirst = 0,
    showLast = 0,
    maskChar = MASK_CHARACTER,
    totalLength
  } = options;

  const valueLength = value.length;

  // If total length is specified, use fixed-length masking
  if (totalLength) {
    const visibleChars = Math.min(showFirst + showLast, valueLength);
    const maskLength = Math.max(0, totalLength - visibleChars);
    
    const firstPart = value.substring(0, showFirst);
    const lastPart = showLast > 0 ? value.substring(valueLength - showLast) : '';
    const mask = maskChar.repeat(maskLength);
    
    return firstPart + mask + lastPart;
  }

  // Dynamic masking based on actual value length
  if (showFirst + showLast >= valueLength) {
    // If we're showing too many characters, just mask the middle
    const maskLength = Math.max(1, valueLength - Math.floor((showFirst + showLast) / 2));
    return maskChar.repeat(maskLength);
  }

  const firstPart = value.substring(0, showFirst);
  const lastPart = showLast > 0 ? value.substring(valueLength - showLast) : '';
  const maskLength = valueLength - showFirst - showLast;
  const mask = maskChar.repeat(maskLength);

  return firstPart + mask + lastPart;
}

/**
 * Masks maternal health ID for display (never shows actual digits)
 */
export function maskMaternalHealthId(): string {
  // Always return a fixed mask - never show actual digits
  return MASK_CHARACTER.repeat(10);
}

/**
 * Masks username for display (shows first 2 and last 1 characters)
 */
export function maskUsername(username: string): string {
  if (!username || username.length <= 3) {
    return MASK_CHARACTER.repeat(3);
  }
  
  return maskForDisplay(username, {
    showFirst: 2,
    showLast: 1,
    maskChar: MASK_CHARACTER
  });
}

// =====================================================
// SECURE LOGGING
// =====================================================

/**
 * Secure logger that automatically sanitizes data
 */
export class SecureLogger {
  private static instance: SecureLogger;
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';

  private constructor() {}

  static getInstance(): SecureLogger {
    if (!SecureLogger.instance) {
      SecureLogger.instance = new SecureLogger();
    }
    return SecureLogger.instance;
  }

  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level;
  }

  /**
   * Sets log level from environment variables with sensible defaults.
   * - EXPO_PUBLIC_LOG_LEVEL or LOG_LEVEL can override
   * - Default: production => 'warn', development => 'debug'
   */
  configureFromEnv(): void {
    try {
      const env: any = (global as any)?.process?.env || {};
      const explicit = (env.EXPO_PUBLIC_LOG_LEVEL || env.LOG_LEVEL || '').toString().toLowerCase();
      const nodeEnv = (env.NODE_ENV || (__DEV__ ? 'development' : 'production')).toString().toLowerCase();

      const isValid = (v: string) => ['debug','info','warn','error'].includes(v);
      if (explicit && isValid(explicit)) {
        this.setLogLevel(explicit as any);
        return;
      }

      this.setLogLevel(nodeEnv === 'production' ? 'warn' : 'debug');
    } catch {
      // Fallback to info if env access fails
      this.setLogLevel('info');
    }
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private sanitizeAndLog(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: any
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const sanitizedMessage = sanitizeString(message);
    const sanitizedData = data ? sanitizeObject(data) : undefined;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: sanitizedMessage,
      ...(sanitizedData && { data: sanitizedData })
    };

    switch (level) {
      case 'debug':
        console.debug('[SECURE]', logEntry);
        break;
      case 'info':
        console.info('[SECURE]', logEntry);
        break;
      case 'warn':
        console.warn('[SECURE]', logEntry);
        break;
      case 'error':
        console.error('[SECURE]', logEntry);
        break;
    }
  }

  debug(message: string, data?: any): void {
    this.sanitizeAndLog('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.sanitizeAndLog('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.sanitizeAndLog('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.sanitizeAndLog('error', message, data);
  }

  /**
   * Logs security events with additional context
   */
  security(event: string, context?: any): void {
    this.sanitizeAndLog('warn', `[SECURITY] ${event}`, context);
  }

  /**
   * Logs privacy violations or attempts
   */
  privacy(event: string, context?: any): void {
    this.sanitizeAndLog('error', `[PRIVACY] ${event}`, context);
  }
}

// Create singleton instance
export const secureLogger = SecureLogger.getInstance();
// Configure log level from environment on module load
secureLogger.configureFromEnv();

// =====================================================
// DATA ACCESS AUDITING
// =====================================================

/**
 * Audit log entry for data access
 */
export interface DataAccessAudit {
  timestamp: string;
  userId: string | null;
  action: string;
  resource: string;
  success: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Data access auditor
 */
export class DataAccessAuditor {
  private static instance: DataAccessAuditor;
  private auditLogs: DataAccessAudit[] = [];

  private constructor() {}

  static getInstance(): DataAccessAuditor {
    if (!DataAccessAuditor.instance) {
      DataAccessAuditor.instance = new DataAccessAuditor();
    }
    return DataAccessAuditor.instance;
  }

  /**
   * Records a data access attempt
   */
  audit(
    action: string,
    resource: string,
    success: boolean,
    userId?: string | null,
    reason?: string,
    metadata?: Record<string, any>
  ): void {
    const auditEntry: DataAccessAudit = {
      timestamp: new Date().toISOString(),
      userId: userId || null,
      action,
      resource,
      success,
      reason,
      metadata: metadata ? sanitizeObject(metadata) : undefined
    };

    this.auditLogs.push(auditEntry);
    
    // Keep only the last 1000 audit entries in memory
    if (this.auditLogs.length > 1000) {
      this.auditLogs = this.auditLogs.slice(-1000);
    }

    // Log the audit entry
    secureLogger.info(`Data access: ${action} on ${resource}`, auditEntry);

    // In a real application, you would also send this to a secure audit service
    this.sendToAuditService(auditEntry);
  }

  /**
   * Gets recent audit logs (sanitized)
   */
  getAuditLogs(limit = 100): DataAccessAudit[] {
    return this.auditLogs.slice(-limit);
  }

  /**
   * Sends audit entry to external audit service
   */
  private async sendToAuditService(auditEntry: DataAccessAudit): Promise<void> {
    try {
      // In a real implementation, send to audit service
      // For now, just log that we would send it
      secureLogger.debug('Audit entry would be sent to audit service', {
        action: auditEntry.action,
        resource: auditEntry.resource,
        success: auditEntry.success
      });
    } catch (error) {
      secureLogger.error('Failed to send audit entry to service', { error });
    }
  }
}

// Create singleton instance
export const dataAccessAuditor = DataAccessAuditor.getInstance();

// =====================================================
// PRIVACY VALIDATION
// =====================================================

/**
 * Validates that an object doesn't contain sensitive data before transmission
 */
export function validatePrivacyCompliance(obj: any): {
  isCompliant: boolean;
  violations: string[];
  sanitized: any;
} {
  const violations: string[] = [];
  
  function checkForSensitiveData(data: any, path = ''): void {
    if (data === null || data === undefined) {
      return;
    }

    if (typeof data === 'object') {
      if (Array.isArray(data)) {
        data.forEach((item, index) => {
          checkForSensitiveData(item, `${path}[${index}]`);
        });
      } else {
        Object.entries(data).forEach(([key, value]) => {
          const fullPath = path ? `${path}.${key}` : key;
          const keyLower = key.toLowerCase();
          
          // Check if key name indicates sensitive data
          const isSensitiveKey = SENSITIVE_FIELDS.some(sensitiveField =>
            keyLower.includes(sensitiveField) || sensitiveField.includes(keyLower)
          );
          
          if (isSensitiveKey) {
            violations.push(`Sensitive field detected: ${fullPath}`);
          }
          
          // Check string values for sensitive patterns
          if (typeof value === 'string') {
            // Check for 10-digit patterns (potential maternal health IDs)
            if (/\b\d{10}\b/.test(value)) {
              violations.push(`Potential maternal health ID in: ${fullPath}`);
            }
            
            // Check for password patterns
            if (/password[=:]/i.test(value)) {
              violations.push(`Password detected in: ${fullPath}`);
            }
            
            // Check for token patterns
            if (/token[=:]/i.test(value)) {
              violations.push(`Token detected in: ${fullPath}`);
            }
          }
          
          checkForSensitiveData(value, fullPath);
        });
      }
    }
  }

  checkForSensitiveData(obj);
  
  return {
    isCompliant: violations.length === 0,
    violations,
    sanitized: sanitizeObject(obj)
  };
}

// =====================================================
// ERROR HANDLING WITH PRIVACY PROTECTION
// =====================================================

/**
 * Creates safe error messages that don't expose sensitive information
 */
export function createSafeError(
  originalError: Error | string,
  userMessage: string,
  context?: any
): Error {
  const sanitizedContext = context ? sanitizeObject(context) : undefined;
  
  // Log the full error details securely
  secureLogger.error('Application error occurred', {
    originalError: typeof originalError === 'string' ? originalError : originalError.message,
    context: sanitizedContext
  });

  // Return user-friendly error without sensitive details
  const safeError = new Error(userMessage);
  
  // In development, include more details
  if (__DEV__) {
    (safeError as any).originalError = typeof originalError === 'string' ? 
      originalError : originalError.message;
    (safeError as any).context = sanitizedContext;
  }

  return safeError;
}

// =====================================================
// EXPORT UTILITIES
// =====================================================

export default {
  sanitizeObject,
  sanitizeString,
  maskForDisplay,
  maskMaternalHealthId,
  maskUsername,
  secureLogger,
  dataAccessAuditor,
  validatePrivacyCompliance,
  createSafeError,
  SENSITIVE_FIELDS,
  MASKED_FIELDS,
  REDACTION_MARKER,
  MASK_CHARACTER
};