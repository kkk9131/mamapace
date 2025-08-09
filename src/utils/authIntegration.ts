/**
 * AUTHENTICATION INTEGRATION UTILITIES
 * 
 * Utilities to connect the authentication service layer with UI components
 * Provides hooks, validators, and helpers for seamless integration
 * 
 * SECURITY FEATURES:
 * - Automatic session management
 * - Real-time validation feedback
 * - Secure error handling
 * - Privacy protection
 */

import { useState, useEffect, useCallback } from 'react';
import {
  RegistrationRequest,
  LoginRequest,
  AuthResponse,
  MaternalHealthIdValidation,
  UsernameValidation,
  PasswordValidation,
  RegistrationFormValidation,
  LoginFormValidation,
  createRegistrationRequest,
  createLoginRequest,
  sanitizeForLogging
} from '../types/auth';
import { authService } from '../services/authService';
import { validationService } from '../services/validationService';
import { secureLogger } from '../utils/privacyProtection';

// =====================================================
// TYPES AND INTERFACES
// =====================================================

/**
 * Form field validation state
 */
interface FieldValidationState<T> {
  value: string;
  validation: T | null;
  isValidating: boolean;
  hasBeenTouched: boolean;
}

/**
 * Registration form state
 */
interface RegistrationFormState {
  username: FieldValidationState<UsernameValidation>;
  maternalHealthId: FieldValidationState<MaternalHealthIdValidation>;
  password: FieldValidationState<PasswordValidation>;
  displayName: FieldValidationState<{ isValid: boolean; error?: string }>;
  bio: FieldValidationState<{ isValid: boolean; error?: string }>;
  avatarEmoji: string;
  isSubmitting: boolean;
  submitError: string | null;
}

/**
 * Login form state
 */
interface LoginFormState {
  username: FieldValidationState<{ isValid: boolean; error?: string }>;
  maternalHealthId: FieldValidationState<MaternalHealthIdValidation>;
  password: FieldValidationState<{ isValid: boolean; error?: string }>;
  isSubmitting: boolean;
  submitError: string | null;
}

/**
 * Validation hook options
 */
interface ValidationOptions {
  debounceMs?: number;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  showValidationOnTouch?: boolean;
}

// =====================================================
// REGISTRATION FORM HOOK
// =====================================================

/**
 * Hook for managing registration form state and validation
 */
export function useRegistrationForm(options: ValidationOptions = {}) {
  const {
    debounceMs = 500,
    validateOnChange = true,
    validateOnBlur = true,
    showValidationOnTouch = false
  } = options;

  // Initial state
  const [state, setState] = useState<RegistrationFormState>({
    username: {
      value: '',
      validation: null,
      isValidating: false,
      hasBeenTouched: false
    },
    maternalHealthId: {
      value: '',
      validation: null,
      isValidating: false,
      hasBeenTouched: false
    },
    password: {
      value: '',
      validation: null,
      isValidating: false,
      hasBeenTouched: false
    },
    displayName: {
      value: '',
      validation: null,
      isValidating: false,
      hasBeenTouched: false
    },
    bio: {
      value: '',
      validation: null,
      isValidating: false,
      hasBeenTouched: false
    },
    avatarEmoji: '👶',
    isSubmitting: false,
    submitError: null
  });

  // Debounced validation
  const [validationTimeouts, setValidationTimeouts] = useState<Record<string, NodeJS.Timeout>>({});

  // Clear validation timeout
  const clearValidationTimeout = useCallback((field: string) => {
    if (validationTimeouts[field]) {
      clearTimeout(validationTimeouts[field]);
      setValidationTimeouts(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, [validationTimeouts]);

  // Validate field
  const validateField = useCallback(async (field: keyof RegistrationFormState, value: string) => {
    if (!['username', 'maternalHealthId', 'password', 'displayName', 'bio'].includes(field)) {
      return;
    }

    setState(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        isValidating: true
      }
    }));

    try {
      let validation;
      
      switch (field) {
        case 'username':
          validation = await authService.validateUsername(value, { action: 'registration' });
          break;
        case 'maternalHealthId':
          validation = await authService.validateMaternalHealthId(value, { action: 'registration' });
          break;
        case 'password':
          validation = await authService.validatePassword(value, { 
            username: state.username.value,
            action: 'registration' 
          });
          break;
        case 'displayName':
          validation = { isValid: !value || value.length <= 30 };
          if (!validation.isValid) {
            validation.error = '表示名は30文字以下で入力してください';
          }
          break;
        case 'bio':
          validation = { isValid: !value || value.length <= 500 };
          if (!validation.isValid) {
            validation.error = '自己紹介は500文字以下で入力してください';
          }
          break;
        default:
          return;
      }

      setState(prev => ({
        ...prev,
        [field]: {
          ...prev[field],
          validation,
          isValidating: false
        }
      }));

    } catch (error) {
      secureLogger.error('Field validation error', { field, error });
      setState(prev => ({
        ...prev,
        [field]: {
          ...prev[field],
          validation: {
            isValid: false,
            error: 'バリデーションエラーが発生しました'
          },
          isValidating: false
        }
      }));
    }
  }, [state.username.value]);

  // Handle field change
  const handleFieldChange = useCallback((field: keyof RegistrationFormState, value: string) => {
    setState(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        value,
        hasBeenTouched: true
      },
      submitError: null // Clear submit error when user starts typing
    }));

    // Clear existing timeout
    clearValidationTimeout(field as string);

    // Set up debounced validation
    if (validateOnChange && value) {
      const timeout = setTimeout(() => {
        validateField(field, value);
      }, debounceMs);

      setValidationTimeouts(prev => ({
        ...prev,
        [field]: timeout
      }));
    }
  }, [validateOnChange, debounceMs, clearValidationTimeout, validateField]);

  // Handle field blur
  const handleFieldBlur = useCallback((field: keyof RegistrationFormState) => {
    const fieldState = state[field] as FieldValidationState<any>;
    
    setState(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        hasBeenTouched: true
      }
    }));

    if (validateOnBlur && fieldState.value) {
      // Clear any pending validation
      clearValidationTimeout(field as string);
      // Validate immediately
      validateField(field, fieldState.value);
    }
  }, [state, validateOnBlur, clearValidationTimeout, validateField]);

  // Handle avatar emoji change
  const handleAvatarChange = useCallback((emoji: string) => {
    setState(prev => ({
      ...prev,
      avatarEmoji: emoji
    }));
  }, []);

  // Check if form is valid
  const isFormValid = useCallback(() => {
    return (
      state.username.validation?.isValid === true &&
      state.maternalHealthId.validation?.isValid === true &&
      state.password.validation?.isValid === true &&
      (state.displayName.validation?.isValid !== false) &&
      (state.bio.validation?.isValid !== false)
    );
  }, [state]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    setState(prev => ({ ...prev, isSubmitting: true, submitError: null }));

    try {
      // Final validation
      const registrationData = createRegistrationRequest({
        username: state.username.value,
        maternal_health_id: state.maternalHealthId.value,
        password: state.password.value,
        display_name: state.displayName.value || undefined,
        bio: state.bio.value || undefined,
        avatar_emoji: state.avatarEmoji
      });

      secureLogger.info('Registration form submission', sanitizeForLogging({
        username: state.username.value,
        hasDisplayName: !!state.displayName.value,
        hasBio: !!state.bio.value,
        avatarEmoji: state.avatarEmoji
      }));

      const response = await authService.register(registrationData);
      
      setState(prev => ({ ...prev, isSubmitting: false }));
      
      if (!response.success) {
        setState(prev => ({ ...prev, submitError: response.error }));
      }

      return response;

    } catch (error) {
      secureLogger.error('Registration submission error', { error });
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        submitError: '登録中にエラーが発生しました。もう一度お試しください。'
      }));

      return {
        success: false,
        error: '登録中にエラーが発生しました。'
      } as AuthResponse;
    }
  }, [state]);

  // Get field error (only show if field has been touched or we're showing validation on touch)
  const getFieldError = useCallback((field: keyof RegistrationFormState) => {
    const fieldState = state[field] as FieldValidationState<any>;
    
    if (!fieldState.hasBeenTouched && !showValidationOnTouch) {
      return null;
    }

    return fieldState.validation?.error || null;
  }, [state, showValidationOnTouch]);

  // Get field validation status
  const getFieldStatus = useCallback((field: keyof RegistrationFormState) => {
    const fieldState = state[field] as FieldValidationState<any>;
    
    return {
      isValidating: fieldState.isValidating,
      isValid: fieldState.validation?.isValid === true,
      hasError: fieldState.validation?.isValid === false,
      hasBeenTouched: fieldState.hasBeenTouched
    };
  }, [state]);

  return {
    // State
    values: {
      username: state.username.value,
      maternalHealthId: state.maternalHealthId.value,
      password: state.password.value,
      displayName: state.displayName.value,
      bio: state.bio.value,
      avatarEmoji: state.avatarEmoji
    },
    
    // Status
    isSubmitting: state.isSubmitting,
    submitError: state.submitError,
    isFormValid: isFormValid(),
    
    // Handlers
    handleFieldChange,
    handleFieldBlur,
    handleAvatarChange,
    handleSubmit,
    
    // Validation
    getFieldError,
    getFieldStatus,
    
    // Individual field validations (for custom UI logic)
    validations: {
      username: state.username.validation,
      maternalHealthId: state.maternalHealthId.validation,
      password: state.password.validation,
      displayName: state.displayName.validation,
      bio: state.bio.validation
    }
  };
}

// =====================================================
// LOGIN FORM HOOK
// =====================================================

/**
 * Hook for managing login form state and validation
 */
export function useLoginForm(options: ValidationOptions = {}) {
  const {
    debounceMs = 300,
    validateOnChange = false, // Less aggressive for login
    validateOnBlur = true
  } = options;

  // Initial state
  const [state, setState] = useState<LoginFormState>({
    username: {
      value: '',
      validation: null,
      isValidating: false,
      hasBeenTouched: false
    },
    maternalHealthId: {
      value: '',
      validation: null,
      isValidating: false,
      hasBeenTouched: false
    },
    password: {
      value: '',
      validation: null,
      isValidating: false,
      hasBeenTouched: false
    },
    isSubmitting: false,
    submitError: null
  });

  // Validate field (lighter validation for login)
  const validateField = useCallback(async (field: keyof LoginFormState, value: string) => {
    setState(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        isValidating: true
      }
    }));

    try {
      let validation;
      
      switch (field) {
        case 'username':
          validation = {
            isValid: value.length > 0,
            error: value.length === 0 ? 'ユーザー名を入力してください' : undefined
          };
          break;
        case 'maternalHealthId':
          validation = authService.validateMaternalHealthIdClient(value);
          break;
        case 'password':
          validation = {
            isValid: value.length > 0,
            error: value.length === 0 ? 'パスワードを入力してください' : undefined
          };
          break;
        default:
          return;
      }

      setState(prev => ({
        ...prev,
        [field]: {
          ...prev[field],
          validation,
          isValidating: false
        }
      }));

    } catch (error) {
      secureLogger.error('Login field validation error', { field, error });
      setState(prev => ({
        ...prev,
        [field]: {
          ...prev[field],
          validation: {
            isValid: false,
            error: 'バリデーションエラーが発生しました'
          },
          isValidating: false
        }
      }));
    }
  }, []);

  // Handle field change
  const handleFieldChange = useCallback((field: keyof LoginFormState, value: string) => {
    setState(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        value,
        hasBeenTouched: true
      },
      submitError: null
    }));

    if (validateOnChange) {
      // Immediate validation for login
      validateField(field, value);
    }
  }, [validateOnChange, validateField]);

  // Handle field blur
  const handleFieldBlur = useCallback((field: keyof LoginFormState) => {
    const fieldState = state[field] as FieldValidationState<any>;
    
    setState(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        hasBeenTouched: true
      }
    }));

    if (validateOnBlur && fieldState.value) {
      validateField(field, fieldState.value);
    }
  }, [state, validateOnBlur, validateField]);

  // Check if form is valid
  const isFormValid = useCallback(() => {
    return (
      state.username.value.length > 0 &&
      state.maternalHealthId.value.length === 10 &&
      /^\d{10}$/.test(state.maternalHealthId.value) &&
      state.password.value.length > 0
    );
  }, [state]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    setState(prev => ({ ...prev, isSubmitting: true, submitError: null }));

    try {
      const loginData = createLoginRequest({
        username: state.username.value,
        maternal_health_id: state.maternalHealthId.value,
        password: state.password.value
      });

      secureLogger.info('Login form submission', sanitizeForLogging({
        username: state.username.value
      }));

      const response = await authService.login(loginData);
      
      setState(prev => ({ ...prev, isSubmitting: false }));
      
      if (!response.success) {
        setState(prev => ({ ...prev, submitError: response.error }));
      }

      return response;

    } catch (error) {
      secureLogger.error('Login submission error', { error });
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        submitError: 'ログイン中にエラーが発生しました。もう一度お試しください。'
      }));

      return {
        success: false,
        error: 'ログイン中にエラーが発生しました。'
      } as AuthResponse;
    }
  }, [state]);

  // Get field error
  const getFieldError = useCallback((field: keyof LoginFormState) => {
    const fieldState = state[field] as FieldValidationState<any>;
    
    if (!fieldState.hasBeenTouched) {
      return null;
    }

    return fieldState.validation?.error || null;
  }, [state]);

  return {
    // State
    values: {
      username: state.username.value,
      maternalHealthId: state.maternalHealthId.value,
      password: state.password.value
    },
    
    // Status
    isSubmitting: state.isSubmitting,
    submitError: state.submitError,
    isFormValid: isFormValid(),
    
    // Handlers
    handleFieldChange,
    handleFieldBlur,
    handleSubmit,
    
    // Validation
    getFieldError,
    
    // Individual field validations
    validations: {
      username: state.username.validation,
      maternalHealthId: state.maternalHealthId.validation,
      password: state.password.validation
    }
  };
}

// =====================================================
// VALIDATION HOOKS
// =====================================================

/**
 * Hook for real-time field validation with debouncing
 */
export function useFieldValidation<T>(
  validateFn: (value: string) => Promise<T> | T,
  debounceMs: number = 500
) {
  const [validation, setValidation] = useState<T | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(async (value: string) => {
    if (!value) {
      setValidation(null);
      setError(null);
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const result = await validateFn(value);
      setValidation(result);
    } catch (err) {
      setError('バリデーションエラーが発生しました');
      secureLogger.error('Field validation error', { error: err });
    } finally {
      setIsValidating(false);
    }
  }, [validateFn]);

  // Debounced validation
  const debouncedValidate = useCallback(
    debounce(validate, debounceMs),
    [validate, debounceMs]
  );

  return {
    validation,
    isValidating,
    error,
    validate: debouncedValidate
  };
}

// =====================================================
// SESSION HOOKS
// =====================================================

/**
 * Hook for monitoring session status
 */
export function useSessionStatus() {
  const [isSessionValid, setIsSessionValid] = useState<boolean | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const checkSessionStatus = useCallback(async () => {
    setIsCheckingSession(true);
    
    try {
      const user = authService.getCurrentUser();
      const isAuthenticated = authService.isAuthenticated();
      const shouldRefresh = await authService.needsRefresh();
      
      setIsSessionValid(isAuthenticated);
      setNeedsRefresh(shouldRefresh);
      
    } catch (error) {
      secureLogger.error('Session status check error', { error });
      setIsSessionValid(false);
    } finally {
      setIsCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    checkSessionStatus();
    
    // Check session status every 5 minutes
    const interval = setInterval(checkSessionStatus, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [checkSessionStatus]);

  return {
    isSessionValid,
    needsRefresh,
    isCheckingSession,
    refreshSession: checkSessionStatus
  };
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Debounce function for validation
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), waitMs);
  };
}

/**
 * Format validation error for display
 */
export function formatValidationError(error: string | undefined): string | null {
  if (!error) return null;
  
  // Ensure error messages are user-friendly
  return error;
}

/**
 * Check if password meets strength requirements (client-side only)
 */
export function getPasswordStrengthInfo(password: string) {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /\d/.test(password),
    symbols: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  
  if (passedChecks >= 4) {
    strength = 'strong';
  } else if (passedChecks >= 2) {
    strength = 'medium';
  }

  return {
    checks,
    strength,
    score: passedChecks
  };
}

/**
 * Safely format maternal health ID for display (always masked)
 */
export function formatMaternalHealthIdForDisplay(): string {
  return '●●●●●●●●●●';
}

// =====================================================
// ERROR BOUNDARY UTILITIES
// =====================================================

/**
 * Creates safe error message for authentication errors
 */
export function createSafeAuthError(error: any): string {
  // Never expose technical details to users
  const safeMessages = {
    'Network error': 'インターネット接続を確認してください',
    'Timeout': '通信がタイムアウトしました。もう一度お試しください',
    'Server error': 'サーバーエラーが発生しました。しばらく待ってからお試しください',
    'Validation error': '入力内容を確認してください'
  };

  if (typeof error === 'string' && safeMessages[error as keyof typeof safeMessages]) {
    return safeMessages[error as keyof typeof safeMessages];
  }

  // Default safe message
  return 'エラーが発生しました。もう一度お試しください';
}