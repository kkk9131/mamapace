/**
 * SERVER-SIDE VALIDATION INTEGRATION SERVICE
 *
 * CRITICAL SECURITY RULES:
 * 1. All validation must happen server-side for security
 * 2. Client-side validation is only for UX improvement
 * 3. Never trust client-side validation results
 * 4. Sanitize all inputs before server transmission
 * 5. Implement comprehensive error handling
 */

import {
  ValidationConstraints,
  MaternalHealthIdValidation,
  UsernameValidation,
  PasswordValidation,
  RegistrationFormValidation,
  LoginFormValidation,
  sanitizeForLogging,
} from '../types/auth';
import {
  secureLogger,
  sanitizeObject,
  validatePrivacyCompliance,
} from '../utils/privacyProtection';

import { supabaseClient } from './supabaseClient';

// =====================================================
// TYPES AND INTERFACES
// =====================================================

/**
 * Server validation request
 */
interface ServerValidationRequest {
  field:
    | 'username'
    | 'maternal_health_id'
    | 'password'
    | 'display_name'
    | 'bio';
  value: string;
  context?: {
    userId?: string;
    action?: 'registration' | 'update' | 'login';
  };
}

/**
 * Server validation response
 */
interface ServerValidationResponse {
  isValid: boolean;
  error?: string;
  suggestions?: string[];
  serverChecks?: {
    format?: boolean;
    uniqueness?: boolean;
    security?: boolean;
    policy?: boolean;
  };
}

/**
 * Batch validation request
 */
interface BatchValidationRequest {
  fields: Record<string, string>;
  action: 'registration' | 'login' | 'update';
  context?: Record<string, any>;
}

/**
 * Validation cache entry
 */
interface ValidationCacheEntry {
  result: ServerValidationResponse;
  timestamp: number;
  expiryMs: number;
}

/**
 * Validation statistics
 */
interface ValidationStats {
  totalValidations: number;
  serverValidations: number;
  cacheHits: number;
  failures: number;
  averageResponseTime: number;
}

// =====================================================
// CONSTANTS
// =====================================================

const VALIDATION_CONFIG = {
  CACHE_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes
  SERVER_TIMEOUT_MS: 10000, // 10 seconds
  MAX_CACHE_SIZE: 100,
  RETRY_ATTEMPTS: 2,
  RETRY_DELAY_MS: 1000,
} as const;

const JAPANESE_ERROR_MESSAGES = {
  username: {
    invalid_format:
      'ユーザー名は3-20文字の英数字、アンダースコア、ハイフンのみ使用できます',
    too_short: 'ユーザー名は3文字以上で入力してください',
    too_long: 'ユーザー名は20文字以下で入力してください',
    not_available: 'このユーザー名は既に使用されています',
    contains_profanity: 'ユーザー名に不適切な内容が含まれています',
    reserved_word: 'このユーザー名は予約語のため使用できません',
  },
  maternal_health_id: {
    invalid_format: '母子手帳番号は10桁の数字で入力してください',
    not_digits: '母子手帳番号は数字のみで入力してください',
    already_registered: 'この母子手帳番号は既に登録されています',
    invalid_checksum: '母子手帳番号の形式が正しくありません',
  },
  password: {
    too_short: 'パスワードは8文字以上で入力してください',
    too_long: 'パスワードは128文字以下で入力してください',
    missing_uppercase: 'パスワードに大文字を含めてください',
    missing_lowercase: 'パスワードに小文字を含めてください',
    missing_numbers: 'パスワードに数字を含めてください',
    missing_symbols: 'パスワードに記号を含めてください',
    common_password:
      'このパスワードは一般的すぎます。より複雑なパスワードを設定してください',
    contains_personal_info:
      'パスワードにユーザー名や個人情報を含めないでください',
  },
  display_name: {
    too_long: '表示名は30文字以下で入力してください',
    contains_profanity: '表示名に不適切な内容が含まれています',
    invalid_characters: '表示名に使用できない文字が含まれています',
  },
  bio: {
    too_long: '自己紹介は500文字以下で入力してください',
    contains_profanity: '自己紹介に不適切な内容が含まれています',
    contains_contact_info: '自己紹介に連絡先情報を含めることはできません',
  },
} as const;

// =====================================================
// VALIDATION SERVICE CLASS
// =====================================================

class ValidationService {
  private static instance: ValidationService;
  private validationCache = new Map<string, ValidationCacheEntry>();
  private stats: ValidationStats = {
    totalValidations: 0,
    serverValidations: 0,
    cacheHits: 0,
    failures: 0,
    averageResponseTime: 0,
  };
  private responseTimes: number[] = [];

  private constructor() {}

  static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  // =====================================================
  // CLIENT-SIDE VALIDATION (UX ONLY)
  // =====================================================

  /**
   * Client-side maternal health ID validation (UX only)
   * NEVER trust this for security - server validation is required
   */
  validateMaternalHealthIdClient(id: string): MaternalHealthIdValidation {
    const result: MaternalHealthIdValidation = {
      isValid: false,
      format: {
        length: id.length === ValidationConstraints.maternal_health_id.length,
        digitsOnly: ValidationConstraints.maternal_health_id.pattern.test(id),
      },
    };

    if (!result.format.length) {
      result.error = JAPANESE_ERROR_MESSAGES.maternal_health_id.invalid_format;
    } else if (!result.format.digitsOnly) {
      result.error = JAPANESE_ERROR_MESSAGES.maternal_health_id.not_digits;
    } else {
      result.isValid = true;
    }

    secureLogger.debug('Client-side maternal health ID validation', {
      isValid: result.isValid,
      hasError: !!result.error,
    });

    return result;
  }

  /**
   * Client-side username validation (UX only)
   */
  validateUsernameClient(username: string): Omit<
    UsernameValidation,
    'checks'
  > & {
    checks: Omit<UsernameValidation['checks'], 'available'>;
  } {
    const checks = {
      length:
        username.length >= ValidationConstraints.username.minLength &&
        username.length <= ValidationConstraints.username.maxLength,
      characters: ValidationConstraints.username.pattern.test(username),
    };

    let error: string | undefined;
    let isValid = false;

    if (!checks.length) {
      if (username.length < ValidationConstraints.username.minLength) {
        error = JAPANESE_ERROR_MESSAGES.username.too_short;
      } else {
        error = JAPANESE_ERROR_MESSAGES.username.too_long;
      }
    } else if (!checks.characters) {
      error = JAPANESE_ERROR_MESSAGES.username.invalid_format;
    } else {
      isValid = true; // Client-side checks passed, but server validation still needed
    }

    return {
      isValid,
      error,
      checks,
    };
  }

  /**
   * Client-side password validation (UX only)
   */
  validatePasswordClient(password: string): PasswordValidation {
    const checks = {
      length: password.length >= ValidationConstraints.password.minLength,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /\d/.test(password),
      symbols: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };

    // Calculate strength
    const passedChecks = Object.values(checks).filter(Boolean).length;
    let strength: 'weak' | 'medium' | 'strong' = 'weak';

    if (passedChecks >= 4) {
      strength = 'strong';
    } else if (passedChecks >= 2) {
      strength = 'medium';
    }

    let error: string | undefined;
    let isValid = false;

    if (!checks.length) {
      error = JAPANESE_ERROR_MESSAGES.password.too_short;
    } else if (password.length > ValidationConstraints.password.maxLength) {
      error = JAPANESE_ERROR_MESSAGES.password.too_long;
    } else if (strength === 'weak') {
      // Provide specific guidance
      if (!checks.uppercase) {
        error = JAPANESE_ERROR_MESSAGES.password.missing_uppercase;
      } else if (!checks.lowercase) {
        error = JAPANESE_ERROR_MESSAGES.password.missing_lowercase;
      } else if (!checks.numbers) {
        error = JAPANESE_ERROR_MESSAGES.password.missing_numbers;
      }
    } else {
      isValid = true;
    }

    return {
      isValid,
      error,
      strength,
      checks,
    };
  }

  // =====================================================
  // SERVER-SIDE VALIDATION
  // =====================================================

  /**
   * Validates maternal health ID on server (AUTHORITATIVE)
   */
  async validateMaternalHealthIdServer(
    id: string,
    context?: { action?: 'registration' | 'login' }
  ): Promise<MaternalHealthIdValidation> {
    const startTime = Date.now();
    this.stats.totalValidations++;

    try {
      // First do client-side validation for quick feedback
      const clientResult = this.validateMaternalHealthIdClient(id);
      if (!clientResult.isValid) {
        return clientResult;
      }

      // Check cache
      const cacheKey = `maternal_health_id:${await this.hashValue(id)}:${context?.action || 'default'}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return this.mapServerResponseToMaternalHealthId(cached);
      }

      // Server validation
      const serverResult = await this.validateOnServer({
        field: 'maternal_health_id',
        value: id,
        context,
      });

      // Cache result
      this.setCache(cacheKey, serverResult);

      const result = this.mapServerResponseToMaternalHealthId(serverResult);

      this.updateStats(startTime, true);
      secureLogger.debug('Server maternal health ID validation completed', {
        isValid: result.isValid,
        hasError: !!result.error,
      });

      return result;
    } catch (error) {
      this.updateStats(startTime, false);
      secureLogger.error('Server maternal health ID validation failed', {
        error,
      });

      // Return client-side result as fallback with warning
      const clientResult = this.validateMaternalHealthIdClient(id);
      return {
        ...clientResult,
        error:
          clientResult.error ||
          'サーバーでの検証に失敗しました。もう一度お試しください。',
      };
    }
  }

  /**
   * Validates username on server (AUTHORITATIVE)
   */
  async validateUsernameServer(
    username: string,
    context?: { userId?: string; action?: 'registration' | 'update' }
  ): Promise<UsernameValidation> {
    const startTime = Date.now();
    this.stats.totalValidations++;

    // Client-side validation first
    const clientResult = this.validateUsernameClient(username);

    try {
      if (!clientResult.isValid) {
        return {
          ...clientResult,
          checks: {
            ...clientResult.checks,
            available: false, // Assume not available if format is invalid
          },
        };
      }

      // Check cache
      const cacheKey = `username:${username}:${context?.action || 'default'}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return this.mapServerResponseToUsername(cached, clientResult.checks);
      }

      // Server validation
      const serverResult = await this.validateOnServer({
        field: 'username',
        value: username,
        context,
      });

      // Cache result (shorter cache time for username availability)
      this.setCache(cacheKey, serverResult, 60000); // 1 minute cache

      const result = this.mapServerResponseToUsername(
        serverResult,
        clientResult.checks
      );

      this.updateStats(startTime, true);
      secureLogger.debug('Server username validation completed', {
        username,
        isValid: result.isValid,
        isAvailable: result.checks.available,
      });

      return result;
    } catch (error) {
      this.updateStats(startTime, false);
      secureLogger.error('Server username validation failed', { error });

      return {
        ...clientResult,
        checks: {
          ...clientResult.checks,
          available: false,
        },
        error: 'サーバーでの検証に失敗しました。もう一度お試しください。',
      };
    }
  }

  /**
   * Validates password on server (AUTHORITATIVE)
   */
  async validatePasswordServer(
    password: string,
    context?: { username?: string; action?: 'registration' | 'update' }
  ): Promise<PasswordValidation> {
    const startTime = Date.now();
    this.stats.totalValidations++;

    // Client-side validation first
    const clientResult = this.validatePasswordClient(password);

    try {
      if (!clientResult.isValid) {
        return clientResult;
      }

      // For password validation, we don't cache due to security concerns
      // Server validation for advanced checks (common passwords, personal info)
      const serverResult = await this.validateOnServer({
        field: 'password',
        value: password,
        context,
      });

      const result = this.mapServerResponseToPassword(
        serverResult,
        clientResult
      );

      this.updateStats(startTime, true);
      secureLogger.debug('Server password validation completed', {
        isValid: result.isValid,
        strength: result.strength,
      });

      return result;
    } catch (error) {
      this.updateStats(startTime, false);
      secureLogger.error('Server password validation failed', { error });

      // Return client-side result as fallback
      return {
        ...clientResult,
        error:
          clientResult.error ||
          'サーバーでの検証に失敗しました。もう一度お試しください。',
      };
    }
  }

  // =====================================================
  // BATCH VALIDATION
  // =====================================================

  /**
   * Validates registration form with server-side checks
   */
  async validateRegistrationForm(data: {
    username: string;
    maternal_health_id: string;
    password: string;
    display_name?: string;
    bio?: string;
  }): Promise<RegistrationFormValidation> {
    const startTime = Date.now();

    try {
      secureLogger.info('Validating registration form');

      // Validate privacy compliance first
      const privacyCheck = validatePrivacyCompliance(sanitizeObject(data));
      if (!privacyCheck.isCompliant) {
        secureLogger.security('Privacy compliance violation in registration', {
          violations: privacyCheck.violations,
        });
      }

      // Run all validations in parallel
      const [username, maternalHealthId, password, displayName, bio] =
        await Promise.all([
          this.validateUsernameServer(data.username, {
            action: 'registration',
          }),
          this.validateMaternalHealthIdServer(data.maternal_health_id, {
            action: 'registration',
          }),
          this.validatePasswordServer(data.password, {
            username: data.username,
            action: 'registration',
          }),
          data.display_name
            ? this.validateDisplayName(data.display_name)
            : Promise.resolve({ isValid: true }),
          data.bio
            ? this.validateBio(data.bio)
            : Promise.resolve({ isValid: true }),
        ]);

      const result: RegistrationFormValidation = {
        username,
        maternal_health_id: maternalHealthId,
        password,
        display_name: displayName,
        bio,
        isFormValid:
          username.isValid &&
          maternalHealthId.isValid &&
          password.isValid &&
          displayName.isValid &&
          bio.isValid,
      };

      this.updateStats(startTime, true);
      secureLogger.info('Registration form validation completed', {
        isFormValid: result.isFormValid,
        validFields: Object.entries(result).filter(
          ([key, value]) =>
            key !== 'isFormValid' && typeof value === 'object' && value.isValid
        ).length,
      });

      return result;
    } catch (error) {
      this.updateStats(startTime, false);
      secureLogger.error('Registration form validation failed', { error });
      throw new Error('フォームの検証に失敗しました');
    }
  }

  /**
   * Validates login form with server-side checks
   */
  async validateLoginForm(data: {
    username: string;
    maternal_health_id: string;
    password: string;
  }): Promise<LoginFormValidation> {
    const startTime = Date.now();

    try {
      secureLogger.info('Validating login form');

      // For login, we do lighter validation (mainly format checks)
      const [username, maternalHealthId, password] = await Promise.all([
        Promise.resolve({
          isValid: data.username.length > 0,
          error:
            data.username.length === 0
              ? 'ユーザー名を入力してください'
              : undefined,
        }),
        this.validateMaternalHealthIdClient(data.maternal_health_id),
        Promise.resolve({
          isValid: data.password.length > 0,
          error:
            data.password.length === 0
              ? 'パスワードを入力してください'
              : undefined,
        }),
      ]);

      const result: LoginFormValidation = {
        username,
        maternal_health_id: maternalHealthId,
        password,
        isFormValid:
          username.isValid && maternalHealthId.isValid && password.isValid,
      };

      this.updateStats(startTime, true);
      secureLogger.info('Login form validation completed', {
        isFormValid: result.isFormValid,
      });

      return result;
    } catch (error) {
      this.updateStats(startTime, false);
      secureLogger.error('Login form validation failed', { error });
      throw new Error('フォームの検証に失敗しました');
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Validates display name
   */
  private async validateDisplayName(
    displayName: string
  ): Promise<{ isValid: boolean; error?: string }> {
    if (!displayName) {
      return { isValid: true };
    }

    if (displayName.length > ValidationConstraints.display_name.maxLength) {
      return {
        isValid: false,
        error: JAPANESE_ERROR_MESSAGES.display_name.too_long,
      };
    }

    // Additional server-side checks could be added here
    return { isValid: true };
  }

  /**
   * Validates bio
   */
  private async validateBio(
    bio: string
  ): Promise<{ isValid: boolean; error?: string }> {
    if (!bio) {
      return { isValid: true };
    }

    if (bio.length > ValidationConstraints.bio.maxLength) {
      return {
        isValid: false,
        error: JAPANESE_ERROR_MESSAGES.bio.too_long,
      };
    }

    // Additional server-side checks could be added here
    return { isValid: true };
  }

  /**
   * Performs actual server validation via Supabase RPC
   */
  private async validateOnServer(
    request: ServerValidationRequest
  ): Promise<ServerValidationResponse> {
    const client = supabaseClient.getClient();

    try {
      this.stats.serverValidations++;

      const { data, error } = await client.rpc('validate_field', {
        field_name: request.field,
        field_value: request.value,
        validation_context: request.context || {},
      });

      if (error) {
        throw error;
      }

      return data as ServerValidationResponse;
    } catch (error) {
      secureLogger.error('Server validation RPC failed', {
        field: request.field,
        error,
      });

      // Return fallback validation result
      return {
        isValid: false,
        error: 'サーバー検証エラーが発生しました',
      };
    }
  }

  /**
   * Maps server response to maternal health ID validation
   */
  private mapServerResponseToMaternalHealthId(
    response: ServerValidationResponse
  ): MaternalHealthIdValidation {
    return {
      isValid: response.isValid,
      error: response.error,
      format: {
        length: response.serverChecks?.format !== false,
        digitsOnly: response.serverChecks?.format !== false,
      },
    };
  }

  /**
   * Maps server response to username validation
   */
  private mapServerResponseToUsername(
    response: ServerValidationResponse,
    clientChecks: { length: boolean; characters: boolean }
  ): UsernameValidation {
    return {
      isValid: response.isValid,
      error: response.error,
      checks: {
        ...clientChecks,
        available: response.serverChecks?.uniqueness !== false,
      },
    };
  }

  /**
   * Maps server response to password validation
   */
  private mapServerResponseToPassword(
    response: ServerValidationResponse,
    clientResult: PasswordValidation
  ): PasswordValidation {
    return {
      ...clientResult,
      isValid: response.isValid && clientResult.isValid,
      error: response.error || clientResult.error,
    };
  }

  // =====================================================
  // CACHE MANAGEMENT
  // =====================================================

  /**
   * Gets validation result from cache
   */
  private getFromCache(key: string): ServerValidationResponse | null {
    const entry = this.validationCache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.timestamp + entry.expiryMs) {
      this.validationCache.delete(key);
      return null;
    }

    return entry.result;
  }

  /**
   * Sets validation result in cache
   */
  private setCache(
    key: string,
    result: ServerValidationResponse,
    expiryMs: number = VALIDATION_CONFIG.CACHE_EXPIRY_MS
  ): void {
    // Implement LRU cache behavior
    if (this.validationCache.size >= VALIDATION_CONFIG.MAX_CACHE_SIZE) {
      const firstKey = this.validationCache.keys().next().value;
      this.validationCache.delete(firstKey);
    }

    this.validationCache.set(key, {
      result,
      timestamp: Date.now(),
      expiryMs,
    });
  }

  /**
   * Hashes value for cache key (without exposing sensitive data)
   */
  private async hashValue(value: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 16);
  }

  /**
   * Updates performance statistics
   */
  private updateStats(startTime: number, success: boolean): void {
    const responseTime = Date.now() - startTime;
    this.responseTimes.push(responseTime);

    // Keep only last 100 response times
    if (this.responseTimes.length > 100) {
      this.responseTimes = this.responseTimes.slice(-100);
    }

    this.stats.averageResponseTime =
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;

    if (!success) {
      this.stats.failures++;
    }
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Clears validation cache
   */
  clearCache(): void {
    this.validationCache.clear();
    secureLogger.debug('Validation cache cleared');
  }

  /**
   * Gets validation statistics
   */
  getStats(): ValidationStats {
    return { ...this.stats };
  }

  /**
   * Gets cache statistics
   */
  getCacheStats() {
    return {
      size: this.validationCache.size,
      maxSize: VALIDATION_CONFIG.MAX_CACHE_SIZE,
      hitRate:
        this.stats.totalValidations > 0
          ? (this.stats.cacheHits / this.stats.totalValidations) * 100
          : 0,
    };
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const validationService = ValidationService.getInstance();
export default validationService;
