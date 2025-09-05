/**
 * FORM VALIDATION UTILITIES
 *
 * Provides comprehensive form validation with:
 * - Real-time validation feedback
 * - Japanese error messages
 * - Security-focused validation rules
 * - Maternal health ID protection
 * - Password strength assessment
 */

import {
  ValidationConstraints,
  UsernameValidation,
  PasswordValidation,
  MaternalHealthIdValidation,
} from '../types/auth';

import { secureLogger } from './privacyProtection';

// =====================================================
// VALIDATION ERROR MESSAGES (JAPANESE)
// =====================================================

export const ValidationMessages = {
  // Username validation
  username: {
    required: 'ユーザー名を入力してください',
    minLength: `ユーザー名は${ValidationConstraints.username.minLength}文字以上で入力してください`,
    maxLength: `ユーザー名は${ValidationConstraints.username.maxLength}文字以下で入力してください`,
    invalidFormat:
      'ユーザー名には英数字、アンダースコア、ハイフンのみ使用できます',
    unavailable: 'このユーザー名は既に使用されています',
    checking: 'ユーザー名の利用可能性を確認しています...',
  },

  // Maternal health ID validation
  maternalHealthId: {
    required: '母子手帳番号を入力してください',
    invalidLength: '母子手帳番号は10桁で入力してください',
    invalidFormat: '母子手帳番号は数字のみで入力してください',
    alreadyExists: 'この母子手帳番号は既に登録されています',
    validating: '母子手帳番号を検証しています...',
  },

  // Password validation
  password: {
    required: 'パスワードを入力してください',
    minLength: `パスワードは${ValidationConstraints.password.minLength}文字以上で入力してください`,
    requireUppercase: 'パスワードには大文字を含めてください',
    requireLowercase: 'パスワードには小文字を含めてください',
    requireNumbers: 'パスワードには数字を含めてください',
    requireSymbols: 'パスワードには記号を含めることを推奨します',
    weak: 'パスワードが弱すぎます',
    medium: 'パスワード強度：中程度',
    strong: 'パスワード強度：強',
  },

  // Display name validation
  displayName: {
    maxLength: `表示名は${ValidationConstraints.display_name.maxLength}文字以下で入力してください`,
    invalidCharacters: '表示名に無効な文字が含まれています',
  },

  // Bio validation
  bio: {
    maxLength: `自己紹介は${ValidationConstraints.bio.maxLength}文字以下で入力してください`,
  },

  // General validation
  general: {
    required: 'この項目は必須です',
    invalid: '入力内容が無効です',
    networkError: 'ネットワークエラーが発生しました',
    serverError: 'サーバーエラーが発生しました',
  },
} as const;

// =====================================================
// USERNAME VALIDATION
// =====================================================

/**
 * Validates username with real-time feedback
 */
export function validateUsername(
  username: string,
  checkAvailability = false
): UsernameValidation {
  const result: UsernameValidation = {
    isValid: true,
    error: undefined,
    checks: {
      length: false,
      characters: false,
      available: false,
    },
  };

  // Check if empty
  if (!username || !username.trim()) {
    result.isValid = false;
    result.error = ValidationMessages.username.required;
    return result;
  }

  const trimmed = username.trim();

  // Length validation
  result.checks.length =
    trimmed.length >= ValidationConstraints.username.minLength &&
    trimmed.length <= ValidationConstraints.username.maxLength;

  if (!result.checks.length) {
    result.isValid = false;
    result.error =
      trimmed.length < ValidationConstraints.username.minLength
        ? ValidationMessages.username.minLength
        : ValidationMessages.username.maxLength;
    return result;
  }

  // Character pattern validation
  result.checks.characters =
    ValidationConstraints.username.pattern.test(trimmed);

  if (!result.checks.characters) {
    result.isValid = false;
    result.error = ValidationMessages.username.invalidFormat;
    return result;
  }

  // Availability check (would be async in real implementation)
  result.checks.available = !checkAvailability; // Default to true if not checking

  secureLogger.debug('Username validation completed', {
    length: trimmed.length,
    validLength: result.checks.length,
    validCharacters: result.checks.characters,
    isValid: result.isValid,
  });

  return result;
}

/**
 * Async username availability check (mock implementation)
 */
export async function checkUsernameAvailability(
  username: string
): Promise<boolean> {
  // Mock API call delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Mock some taken usernames for demo
  const takenUsernames = ['admin', 'user', 'test', 'mama', 'papa'];
  const isAvailable = !takenUsernames.includes(username.toLowerCase());

  secureLogger.debug('Username availability checked', {
    usernameLength: username.length,
    available: isAvailable,
  });

  return isAvailable;
}

// =====================================================
// MATERNAL HEALTH ID VALIDATION
// =====================================================

/**
 * Validates maternal health ID with security focus
 */
export function validateMaternalHealthId(
  id: string
): MaternalHealthIdValidation {
  const result: MaternalHealthIdValidation = {
    isValid: true,
    error: undefined,
    format: {
      length: false,
      digitsOnly: false,
    },
  };

  // Check if empty
  if (!id || !id.trim()) {
    result.isValid = false;
    result.error = ValidationMessages.maternalHealthId.required;
    return result;
  }

  const trimmed = id.trim();

  // Length validation
  result.format.length =
    trimmed.length === ValidationConstraints.maternal_health_id.length;

  if (!result.format.length) {
    result.isValid = false;
    result.error = ValidationMessages.maternalHealthId.invalidLength;
    return result;
  }

  // Digits only validation
  result.format.digitsOnly =
    ValidationConstraints.maternal_health_id.pattern.test(trimmed);

  if (!result.format.digitsOnly) {
    result.isValid = false;
    result.error = ValidationMessages.maternalHealthId.invalidFormat;
    return result;
  }

  // Log validation without sensitive data
  secureLogger.debug('Maternal health ID validation completed', {
    hasValidLength: result.format.length,
    hasValidFormat: result.format.digitsOnly,
    isValid: result.isValid,
  });

  return result;
}

// =====================================================
// PASSWORD VALIDATION
// =====================================================

/**
 * Validates password with strength assessment
 */
export function validatePassword(password: string): PasswordValidation {
  const result: PasswordValidation = {
    isValid: true,
    error: undefined,
    strength: 'weak',
    checks: {
      length: false,
      uppercase: false,
      lowercase: false,
      numbers: false,
      symbols: false,
    },
  };

  // Check if empty
  if (!password) {
    result.isValid = false;
    result.error = ValidationMessages.password.required;
    return result;
  }

  // Length validation
  result.checks.length =
    password.length >= ValidationConstraints.password.minLength;

  if (!result.checks.length) {
    result.isValid = false;
    result.error = ValidationMessages.password.minLength;
    return result;
  }

  // Character type checks
  result.checks.uppercase = /[A-Z]/.test(password);
  result.checks.lowercase = /[a-z]/.test(password);
  result.checks.numbers = /\d/.test(password);
  result.checks.symbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
    password
  );

  // Calculate strength based on checks
  const passedChecks = Object.values(result.checks).filter(Boolean).length;

  if (passedChecks >= 4) {
    result.strength = 'strong';
  } else if (passedChecks >= 3) {
    result.strength = 'medium';
  } else {
    result.strength = 'weak';
  }

  // Validate required checks based on constraints
  if (
    ValidationConstraints.password.requireUppercase &&
    !result.checks.uppercase
  ) {
    result.isValid = false;
    result.error = ValidationMessages.password.requireUppercase;
    return result;
  }

  if (
    ValidationConstraints.password.requireLowercase &&
    !result.checks.lowercase
  ) {
    result.isValid = false;
    result.error = ValidationMessages.password.requireLowercase;
    return result;
  }

  if (ValidationConstraints.password.requireNumbers && !result.checks.numbers) {
    result.isValid = false;
    result.error = ValidationMessages.password.requireNumbers;
    return result;
  }

  // For weak passwords, suggest improvement
  if (result.strength === 'weak') {
    result.isValid = false;
    result.error = ValidationMessages.password.weak;
  }

  secureLogger.debug('Password validation completed', {
    length: password.length,
    strength: result.strength,
    passedChecks,
    isValid: result.isValid,
  });

  return result;
}

// =====================================================
// DISPLAY NAME VALIDATION
// =====================================================

/**
 * Validates display name
 */
export function validateDisplayName(displayName: string): {
  isValid: boolean;
  error?: string;
} {
  // Display name is optional
  if (!displayName || !displayName.trim()) {
    return { isValid: true };
  }

  const trimmed = displayName.trim();

  // Length validation
  if (trimmed.length > ValidationConstraints.display_name.maxLength) {
    return {
      isValid: false,
      error: ValidationMessages.displayName.maxLength,
    };
  }

  // Check for potentially dangerous characters
  if (/[<>\"'&]/.test(trimmed)) {
    return {
      isValid: false,
      error: ValidationMessages.displayName.invalidCharacters,
    };
  }

  return { isValid: true };
}

// =====================================================
// BIO VALIDATION
// =====================================================

/**
 * Validates user bio
 */
export function validateBio(bio: string): { isValid: boolean; error?: string } {
  // Bio is optional
  if (!bio || !bio.trim()) {
    return { isValid: true };
  }

  const trimmed = bio.trim();

  // Length validation
  if (trimmed.length > ValidationConstraints.bio.maxLength) {
    return {
      isValid: false,
      error: ValidationMessages.bio.maxLength,
    };
  }

  return { isValid: true };
}

// =====================================================
// FORM-LEVEL VALIDATION
// =====================================================

/**
 * Validates entire registration form
 */
export function validateRegistrationForm(formData: {
  username: string;
  maternalHealthId: string;
  password: string;
  displayName?: string;
  bio?: string;
}) {
  const usernameValidation = validateUsername(formData.username);
  const maternalHealthIdValidation = validateMaternalHealthId(
    formData.maternalHealthId
  );
  const passwordValidation = validatePassword(formData.password);
  const displayNameValidation = validateDisplayName(formData.displayName || '');
  const bioValidation = validateBio(formData.bio || '');

  const isFormValid =
    usernameValidation.isValid &&
    maternalHealthIdValidation.isValid &&
    passwordValidation.isValid &&
    displayNameValidation.isValid &&
    bioValidation.isValid;

  return {
    username: usernameValidation,
    maternal_health_id: maternalHealthIdValidation,
    password: passwordValidation,
    display_name: displayNameValidation,
    bio: bioValidation,
    isFormValid,
  };
}

/**
 * Validates login form
 */
export function validateLoginForm(formData: {
  username: string;
  maternalHealthId: string;
  password: string;
}) {
  const usernameValidation = validateUsername(formData.username);
  const maternalHealthIdValidation = validateMaternalHealthId(
    formData.maternalHealthId
  );
  const passwordValidation = {
    isValid: !!formData.password.trim(),
    error: !formData.password.trim()
      ? ValidationMessages.password.required
      : undefined,
  };

  const isFormValid =
    usernameValidation.isValid &&
    maternalHealthIdValidation.isValid &&
    passwordValidation.isValid;

  return {
    username: usernameValidation,
    maternal_health_id: maternalHealthIdValidation,
    password: passwordValidation,
    isFormValid,
  };
}

// =====================================================
// REAL-TIME VALIDATION HELPERS
// =====================================================

/**
 * Debounces validation calls to prevent excessive API calls
 */
export function createValidationDebouncer(delay = 300) {
  let timeoutId: NodeJS.Timeout;

  return function <T extends any[], R>(
    fn: (...args: T) => R,
    ...args: T
  ): Promise<R> {
    return new Promise(resolve => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        resolve(fn(...args));
      }, delay);
    });
  };
}

/**
 * Gets validation status color for UI feedback
 */
export function getValidationStatusColor(
  validation: { isValid: boolean; error?: string },
  theme: any
): string {
  if (!validation.error && validation.isValid) {
    return theme.colors.mint; // Success
  } else if (validation.error) {
    return theme.colors.danger; // Error
  } else {
    return theme.colors.subtext; // Neutral
  }
}

/**
 * Gets validation icon for UI feedback
 */
export function getValidationIcon(validation: {
  isValid: boolean;
  error?: string;
}): string {
  if (!validation.error && validation.isValid) {
    return '✅'; // Success
  } else if (validation.error) {
    return '❌'; // Error
  } else {
    return '⏳'; // Pending
  }
}
