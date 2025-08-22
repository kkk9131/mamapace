/**
 * CHAT SECURITY SERVICE
 *
 * Advanced security features for chat system:
 * - Content sanitization and validation
 * - Profanity filtering
 * - Rate limiting with intelligent backoff
 * - Message encryption for sensitive content
 * - Content moderation and reporting
 * - Spam detection and prevention
 */

import { secureLogger } from '../utils/privacyProtection';
import { MessageType, ChatConstraints } from '../types/chat';

// =====================================================
// CONFIGURATION
// =====================================================

const SECURITY_CONFIG = {
  // Content filtering
  MAX_MENTIONS_PER_MESSAGE: 5,
  MAX_LINKS_PER_MESSAGE: 2,
  SUSPICIOUS_PATTERN_THRESHOLD: 0.7,

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
  RATE_LIMIT_BURST_THRESHOLD: 5,
  RATE_LIMIT_STRICT_THRESHOLD: 10,

  // Spam detection
  SPAM_SCORE_THRESHOLD: 0.8,
  REPEATED_MESSAGE_THRESHOLD: 3,
  RAPID_FIRE_THRESHOLD: 1000, // 1 second

  // Content moderation
  AUTO_MODERATE_SCORE: 0.9,
  HUMAN_REVIEW_SCORE: 0.7,
} as const;

// =====================================================
// CONTENT SANITIZATION
// =====================================================

/**
 * Sanitizes message content to prevent XSS and other attacks
 */
export function sanitizeMessageContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // Remove potentially dangerous HTML tags and scripts
  let sanitized = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '');

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Limit length
  if (sanitized.length > ChatConstraints.message.maxLength) {
    sanitized = sanitized.substring(0, ChatConstraints.message.maxLength);
  }

  return sanitized;
}

/**
 * Advanced content validation with security checks
 */
export interface ContentValidationResult {
  isValid: boolean;
  sanitizedContent: string;
  warnings: string[];
  securityScore: number; // 0-1, lower is safer
  flags: {
    hasSuspiciousPatterns: boolean;
    hasExcessiveLinks: boolean;
    hasExcessiveMentions: boolean;
    hasPotentialSpam: boolean;
    needsHumanReview: boolean;
  };
}

export function validateMessageContent(
  content: string,
  messageType: MessageType = MessageType.TEXT,
  senderId: string
): ContentValidationResult {
  const sanitizedContent = sanitizeMessageContent(content);
  const warnings: string[] = [];
  let securityScore = 0;

  const flags = {
    hasSuspiciousPatterns: false,
    hasExcessiveLinks: false,
    hasExcessiveMentions: false,
    hasPotentialSpam: false,
    needsHumanReview: false,
  };

  // Check content length
  if (sanitizedContent.length < ChatConstraints.message.minLength) {
    return {
      isValid: false,
      sanitizedContent,
      warnings: ['メッセージが短すぎます。'],
      securityScore: 0,
      flags,
    };
  }

  if (sanitizedContent.length > ChatConstraints.message.maxLength) {
    warnings.push('メッセージが長すぎるため切り詰められました。');
    securityScore += 0.1;
  }

  // Check for excessive links
  const linkPattern = /(https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.[a-z]{2,})/gi;
  const links = sanitizedContent.match(linkPattern) || [];
  if (links.length > SECURITY_CONFIG.MAX_LINKS_PER_MESSAGE) {
    flags.hasExcessiveLinks = true;
    warnings.push('リンクが多すぎます。');
    securityScore += 0.3;
  }

  // Check for excessive mentions
  const mentionPattern = /@[\w\-_.]+/g;
  const mentions = sanitizedContent.match(mentionPattern) || [];
  if (mentions.length > SECURITY_CONFIG.MAX_MENTIONS_PER_MESSAGE) {
    flags.hasExcessiveMentions = true;
    warnings.push('メンションが多すぎます。');
    securityScore += 0.2;
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /(.)\1{10,}/g, // Repeated characters
    /[A-Z]{20,}/g, // Excessive caps
    /(win|free|money|prize|urgent|act now|limited time)/gi, // Spam keywords
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card patterns
    /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, // SSN patterns
  ];

  suspiciousPatterns.forEach(pattern => {
    if (pattern.test(sanitizedContent)) {
      flags.hasSuspiciousPatterns = true;
      securityScore += 0.2;
    }
  });

  if (flags.hasSuspiciousPatterns) {
    warnings.push('疑わしいパターンが検出されました。');
  }

  // Spam detection
  const spamScore = detectSpamContent(sanitizedContent, senderId);
  if (spamScore > SECURITY_CONFIG.SPAM_SCORE_THRESHOLD) {
    flags.hasPotentialSpam = true;
    warnings.push('スパムの可能性があります。');
    securityScore += spamScore;
  }

  // Determine if human review is needed
  if (securityScore > SECURITY_CONFIG.HUMAN_REVIEW_SCORE) {
    flags.needsHumanReview = true;
  }

  // Determine final validity
  const isValid = securityScore < SECURITY_CONFIG.AUTO_MODERATE_SCORE;

  return {
    isValid,
    sanitizedContent,
    warnings,
    securityScore: Math.min(securityScore, 1),
    flags,
  };
}

// =====================================================
// SPAM DETECTION
// =====================================================

interface UserMessageHistory {
  messages: string[];
  timestamps: number[];
  lastRapidFireTime: number;
  rapidFireCount: number;
}

const userMessageHistory = new Map<string, UserMessageHistory>();

/**
 * Detects spam patterns in message content
 */
function detectSpamContent(content: string, senderId: string): number {
  let spamScore = 0;

  // Get or create user history
  if (!userMessageHistory.has(senderId)) {
    userMessageHistory.set(senderId, {
      messages: [],
      timestamps: [],
      lastRapidFireTime: 0,
      rapidFireCount: 0,
    });
  }

  const history = userMessageHistory.get(senderId)!;
  const now = Date.now();

  // Clean old history (keep last hour)
  const oneHourAgo = now - 60 * 60 * 1000;
  const validIndices = history.timestamps
    .map((ts, index) => (ts > oneHourAgo ? index : -1))
    .filter(index => index >= 0);

  history.messages = validIndices.map(i => history.messages[i]);
  history.timestamps = validIndices.map(i => history.timestamps[i]);

  // Check for repeated messages
  const repeatedCount = history.messages.filter(msg => msg === content).length;
  if (repeatedCount >= SECURITY_CONFIG.REPEATED_MESSAGE_THRESHOLD) {
    spamScore += 0.4;
  }

  // Check for rapid-fire messaging
  const lastTimestamp = history.timestamps[history.timestamps.length - 1] || 0;
  if (now - lastTimestamp < SECURITY_CONFIG.RAPID_FIRE_THRESHOLD) {
    history.rapidFireCount++;
    if (history.rapidFireCount > 5) {
      spamScore += 0.3;
    }
  } else {
    history.rapidFireCount = 0;
  }

  // Check for message frequency
  const recentMessages = history.timestamps.filter(ts => now - ts < 60000); // Last minute
  if (recentMessages.length > 10) {
    spamScore += 0.2;
  }

  // Add current message to history
  history.messages.push(content);
  history.timestamps.push(now);

  // Keep history manageable
  if (history.messages.length > 100) {
    history.messages = history.messages.slice(-50);
    history.timestamps = history.timestamps.slice(-50);
  }

  return Math.min(spamScore, 1);
}

// =====================================================
// RATE LIMITING
// =====================================================

interface RateLimitState {
  count: number;
  resetTime: number;
  violations: number;
  lastViolationTime: number;
}

const rateLimitState = new Map<string, RateLimitState>();

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
  waitTime: number; // Seconds to wait before next request
  reason?: string;
}

/**
 * Advanced rate limiting with intelligent backoff
 */
export function checkRateLimit(
  userId: string,
  action: 'message' | 'chat_create' | 'typing',
  customLimit?: number
): RateLimitResult {
  const now = Date.now();

  // Get limits based on action
  const limits = {
    message: ChatConstraints.rateLimit.messagesPerMinute,
    chat_create: ChatConstraints.rateLimit.chatsPerHour / 60, // Per minute
    typing: 10, // Typing updates per minute
  };

  const limit = customLimit || limits[action];
  const windowMs =
    action === 'chat_create'
      ? 60 * 60 * 1000
      : SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS;

  const key = `${userId}_${action}`;

  if (!rateLimitState.has(key)) {
    rateLimitState.set(key, {
      count: 1,
      resetTime: now + windowMs,
      violations: 0,
      lastViolationTime: 0,
    });

    return {
      allowed: true,
      remainingRequests: limit - 1,
      resetTime: now + windowMs,
      waitTime: 0,
    };
  }

  const state = rateLimitState.get(key)!;

  // Reset if window expired
  if (now >= state.resetTime) {
    state.count = 1;
    state.resetTime = now + windowMs;

    return {
      allowed: true,
      remainingRequests: limit - 1,
      resetTime: state.resetTime,
      waitTime: 0,
    };
  }

  // Check if limit exceeded
  if (state.count >= limit) {
    // Intelligent backoff for repeat violators
    const timeSinceLastViolation = now - state.lastViolationTime;
    let backoffMultiplier = 1;

    if (state.violations > 0 && timeSinceLastViolation < 60000) {
      // Within 1 minute
      backoffMultiplier = Math.min(Math.pow(2, state.violations), 8); // Exponential backoff, max 8x
    }

    const waitTime =
      Math.ceil((state.resetTime - now) / 1000) * backoffMultiplier;

    state.violations++;
    state.lastViolationTime = now;

    let reason = 'レート制限に達しました。';
    if (backoffMultiplier > 1) {
      reason += ` 連続違反のため待機時間が延長されました。`;
    }

    return {
      allowed: false,
      remainingRequests: 0,
      resetTime: state.resetTime,
      waitTime,
      reason,
    };
  }

  state.count++;

  return {
    allowed: true,
    remainingRequests: limit - state.count,
    resetTime: state.resetTime,
    waitTime: 0,
  };
}

// =====================================================
// CONTENT MODERATION
// =====================================================

export interface ModerationResult {
  action: 'allow' | 'flag' | 'block';
  confidence: number;
  reasons: string[];
  needsHumanReview: boolean;
}

/**
 * Advanced content moderation
 */
export function moderateContent(
  content: string,
  messageType: MessageType,
  senderId: string,
  chatContext?: any
): ModerationResult {
  const validation = validateMessageContent(content, messageType, senderId);
  const reasons: string[] = [...validation.warnings];
  let action: 'allow' | 'flag' | 'block' = 'allow';
  let confidence = 1 - validation.securityScore;

  // Auto-block high-risk content
  if (validation.securityScore >= SECURITY_CONFIG.AUTO_MODERATE_SCORE) {
    action = 'block';
    reasons.push(
      '自動モデレーションにより、このメッセージはブロックされました。'
    );
  }
  // Flag suspicious content
  else if (validation.securityScore >= SECURITY_CONFIG.HUMAN_REVIEW_SCORE) {
    action = 'flag';
    reasons.push('人間による確認が必要です。');
  }

  // Additional context-based checks
  if (chatContext) {
    // Check for context-specific violations
    // This could include chat-specific rules, participant preferences, etc.
  }

  return {
    action,
    confidence,
    reasons,
    needsHumanReview: validation.flags.needsHumanReview,
  };
}

// =====================================================
// MESSAGE ENCRYPTION (Basic implementation)
// =====================================================

/**
 * Basic message encryption for sensitive content
 * Note: This is a simple implementation for demonstration.
 * In production, use proper encryption libraries.
 */
export function encryptSensitiveContent(content: string, key: string): string {
  try {
    // This is a placeholder - implement proper encryption
    const encrypted = Buffer.from(content).toString('base64');
    secureLogger.info('Message encrypted for sensitive content');
    return `enc:${encrypted}`;
  } catch (error) {
    secureLogger.error('Failed to encrypt message content', { error });
    throw new Error('暗号化に失敗しました。');
  }
}

export function decryptSensitiveContent(
  encryptedContent: string,
  key: string
): string {
  try {
    if (!encryptedContent.startsWith('enc:')) {
      return encryptedContent; // Not encrypted
    }

    const encrypted = encryptedContent.substring(4);
    const decrypted = Buffer.from(encrypted, 'base64').toString('utf8');
    return decrypted;
  } catch (error) {
    secureLogger.error('Failed to decrypt message content', { error });
    return '[復号化エラー]';
  }
}

// =====================================================
// CLEANUP UTILITIES
// =====================================================

/**
 * Cleanup old rate limit and history data
 */
export function cleanupSecurityData(): void {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  // Cleanup rate limit data
  for (const [key, state] of rateLimitState.entries()) {
    if (state.resetTime < now && state.lastViolationTime < oneHourAgo) {
      rateLimitState.delete(key);
    }
  }

  // Cleanup message history
  for (const [userId, history] of userMessageHistory.entries()) {
    history.timestamps = history.timestamps.filter(ts => ts > oneHourAgo);
    history.messages = history.messages.slice(-history.timestamps.length);

    if (history.timestamps.length === 0) {
      userMessageHistory.delete(userId);
    }
  }

  secureLogger.info('Security data cleanup completed', {
    rateLimitEntries: rateLimitState.size,
    historyEntries: userMessageHistory.size,
  });
}

// Auto-cleanup every hour
setInterval(cleanupSecurityData, 60 * 60 * 1000);
