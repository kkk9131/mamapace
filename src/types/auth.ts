/**
 * SECURE AUTHENTICATION TYPES
 *
 * CRITICAL SECURITY RULES:
 * 1. NEVER include maternal_health_id in client-side types
 * 2. NEVER log maternal_health_id values
 * 3. Use SecureString for sensitive data handling
 * 4. Always validate input data before processing
 */

// =====================================================
// SECURITY ANNOTATIONS
// =====================================================

/**
 * Marks a field as containing sensitive data that should never be logged
 * or exposed in error messages
 */
type SensitiveData = string & { readonly __sensitive: unique symbol };

/**
 * Marks a field as containing encrypted data
 */
type EncryptedData = string & { readonly __encrypted: unique symbol };

/**
 * Secure string wrapper for maternal health ID input
 * This type should only be used for initial input validation
 */
type SecureString = {
  readonly value: string;
  readonly isSecure: true;
  readonly toString: () => '[REDACTED]';
};

// =====================================================
// USER PROFILE TYPES
// =====================================================

/**
 * Public user profile data (safe for API responses)
 * This excludes all sensitive information
 */
export interface PublicUserProfile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_emoji: string | null;
  avatar_url?: string | null;
  created_at: string;
  profile_visibility: 'public' | 'friends' | 'private';
  is_active: boolean;
}

/**
 * User's own profile data (includes personal settings)
 * Still excludes sensitive maternal health information
 */
export interface MyUserProfile extends PublicUserProfile {
  updated_at: string;
  last_login_at: string | null;
}

/**
 * User profile data for internal use only
 * NEVER send this type to the client or log it
 */
interface InternalUserProfile extends MyUserProfile {
  encrypted_maternal_health_id: EncryptedData;
  password_hash: string;
  login_attempts: number;
  locked_until: string | null;
}

// =====================================================
// AUTHENTICATION REQUEST TYPES
// =====================================================

/**
 * Registration request payload
 * maternal_health_id will be encrypted before database storage
 */
export interface RegistrationRequest {
  username: string;
  maternal_health_id: SensitiveData; // Will be encrypted server-side
  password: SensitiveData; // Will be hashed server-side
  display_name?: string;
  bio?: string;
  avatar_emoji?: string;
}

/**
 * Login request payload
 * maternal_health_id will be encrypted for comparison
 */
export interface LoginRequest {
  username: string;
  maternal_health_id: SensitiveData; // Will be encrypted for comparison
  password: SensitiveData; // Will be compared against hash
  device_info?: DeviceInfo;
}

/**
 * Device information for session tracking
 */
export interface DeviceInfo {
  device_type: 'ios' | 'android' | 'web';
  device_model?: string;
  os_version?: string;
  app_version: string;
  device_id?: string; // Anonymous device identifier
}

// =====================================================
// AUTHENTICATION RESPONSE TYPES
// =====================================================

/**
 * Successful authentication response
 */
export interface AuthSuccessResponse {
  success: true;
  user: PublicUserProfile;
  session_token: string;
  refresh_token: string;
  expires_at: string;
}

/**
 * Failed authentication response
 */
export interface AuthErrorResponse {
  success: false;
  error: string;
  error_code?: AuthErrorCode;
}

/**
 * Authentication response union type
 */
export type AuthResponse = AuthSuccessResponse | AuthErrorResponse;

/**
 * Authentication error codes
 */
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  USERNAME_EXISTS = 'USERNAME_EXISTS',
  MATERNAL_ID_EXISTS = 'MATERNAL_ID_EXISTS',
  INVALID_FORMAT = 'INVALID_FORMAT',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
}

// =====================================================
// SESSION MANAGEMENT TYPES
// =====================================================

/**
 * Authentication session data
 */
export interface AuthSession {
  id: string;
  user_id: string;
  session_token: string;
  expires_at: string;
  created_at: string;
  last_used_at: string;
  device_info: DeviceInfo | null;
  ip_address: string | null;
  is_active: boolean;
}

/**
 * Current user context
 */
export interface AuthContext {
  user: PublicUserProfile | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// =====================================================
// VALIDATION TYPES
// =====================================================

/**
 * Maternal health ID validation result
 */
export interface MaternalHealthIdValidation {
  isValid: boolean;
  error?: string;
  format?: {
    length: boolean;
    digitsOnly: boolean;
  };
}

/**
 * Username validation result
 */
export interface UsernameValidation {
  isValid: boolean;
  error?: string;
  checks: {
    length: boolean;
    characters: boolean;
    available: boolean;
  };
}

/**
 * Password validation result
 */
export interface PasswordValidation {
  isValid: boolean;
  error?: string;
  strength: 'weak' | 'medium' | 'strong';
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
  };
}

// =====================================================
// FORM VALIDATION TYPES
// =====================================================

/**
 * Registration form validation state
 */
export interface RegistrationFormValidation {
  username: UsernameValidation;
  maternal_health_id: MaternalHealthIdValidation;
  password: PasswordValidation;
  display_name: { isValid: boolean; error?: string };
  bio: { isValid: boolean; error?: string };
  isFormValid: boolean;
}

/**
 * Login form validation state
 */
export interface LoginFormValidation {
  username: { isValid: boolean; error?: string };
  maternal_health_id: MaternalHealthIdValidation;
  password: { isValid: boolean; error?: string };
  isFormValid: boolean;
}

// =====================================================
// SECURITY AUDIT TYPES
// =====================================================

/**
 * Security audit log entry
 */
export interface SecurityAuditLog {
  id: string;
  user_id: string | null;
  action_type: SecurityActionType;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  failure_reason: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

/**
 * Security action types for audit logging
 */
export enum SecurityActionType {
  LOGIN_ATTEMPT = 'login_attempt',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  REGISTRATION = 'user_registration',
  PASSWORD_CHANGE = 'password_change',
  ACCOUNT_LOCK = 'account_lock',
  ACCOUNT_UNLOCK = 'account_unlock',
  SESSION_REFRESH = 'session_refresh',
  SESSION_INVALIDATE = 'session_invalidate',
  SECURITY_VIOLATION = 'security_violation',
}

// =====================================================
// UTILITY TYPES
// =====================================================

/**
 * Creates a secure string wrapper for maternal health ID
 */
export function createSecureMaternalHealthId(value: string): SecureString {
  return {
    value,
    isSecure: true,
    toString: () => '[REDACTED]',
  };
}

/**
 * Type guard to check if a value is a SecureString
 */
export function isSecureString(value: any): value is SecureString {
  return value && typeof value === 'object' && value.isSecure === true;
}

/**
 * Validation constraints
 */
export const ValidationConstraints = {
  username: {
    minLength: 3,
    maxLength: 20,
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  maternal_health_id: {
    length: 10,
    pattern: /^\d{10}$/,
  },
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
  },
  display_name: {
    minLength: 1,
    maxLength: 30,
  },
  bio: {
    maxLength: 500,
  },
} as const;

// =====================================================
// SENSITIVE DATA HANDLING
// =====================================================

/**
 * Sanitizes objects by removing sensitive fields before logging
 * This prevents accidental exposure of maternal health IDs
 */
export function sanitizeForLogging(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = { ...obj };

  // Remove sensitive fields
  const sensitiveFields = [
    'maternal_health_id',
    'encrypted_maternal_health_id',
    'password',
    'password_hash',
    'session_token',
    'refresh_token',
  ];

  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Type-safe way to create registration request
 */
export function createRegistrationRequest(data: {
  username: string;
  maternal_health_id: string;
  password: string;
  display_name?: string;
  bio?: string;
  avatar_emoji?: string;
}): RegistrationRequest {
  return {
    username: data.username,
    maternal_health_id: data.maternal_health_id as SensitiveData,
    password: data.password as SensitiveData,
    display_name: data.display_name,
    bio: data.bio,
    avatar_emoji: data.avatar_emoji,
  };
}

/**
 * Type-safe way to create login request
 */
export function createLoginRequest(data: {
  username: string;
  maternal_health_id: string;
  password: string;
  device_info?: DeviceInfo;
}): LoginRequest {
  return {
    username: data.username,
    maternal_health_id: data.maternal_health_id as SensitiveData,
    password: data.password as SensitiveData,
    device_info: data.device_info,
  };
}

// =====================================================
// EXPORT STATEMENT
// =====================================================

export type {
  SensitiveData,
  EncryptedData,
  SecureString,
  InternalUserProfile, // Only for internal use, never export to client
};
