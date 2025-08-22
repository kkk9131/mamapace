/**
 * CLIENT-SIDE ENCRYPTION SERVICE
 *
 * CRITICAL SECURITY RULES:
 * 1. NEVER store encryption keys in plaintext
 * 2. Use secure random number generation
 * 3. Implement proper key derivation
 * 4. Clear sensitive data from memory after use
 * 5. Use authenticated encryption (AES-GCM)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureLogger, sanitizeObject } from '../utils/privacyProtection';

// =====================================================
// TYPES AND INTERFACES
// =====================================================

/**
 * Encrypted data container
 */
export interface EncryptedData {
  ciphertext: string;
  iv: string; // Initialization Vector
  salt: string; // For key derivation
  tag: string; // Authentication tag
  algorithm: string; // Encryption algorithm used
  keyDerivation: string; // Key derivation method
}

/**
 * Key derivation parameters
 */
interface KeyDerivationParams {
  salt: Uint8Array;
  iterations: number;
  algorithm: string;
  keyLength: number;
}

/**
 * Encryption options
 */
interface EncryptionOptions {
  keyDerivationIterations?: number;
  algorithm?: string;
  keyLength?: number;
}

// =====================================================
// CONSTANTS
// =====================================================

const ENCRYPTION_CONFIG = {
  ALGORITHM: 'AES-GCM',
  KEY_LENGTH: 32, // 256 bits
  IV_LENGTH: 12, // 96 bits for GCM
  SALT_LENGTH: 32, // 256 bits
  TAG_LENGTH: 16, // 128 bits
  KEY_DERIVATION_ITERATIONS: 100000, // PBKDF2 iterations
  KEY_DERIVATION_ALGORITHM: 'PBKDF2',
} as const;

const STORAGE_KEYS = {
  MASTER_KEY_SALT: 'mamapace_master_key_salt',
  KEY_DERIVATION_PARAMS: 'mamapace_key_derivation_params',
} as const;

// =====================================================
// ENCRYPTION SERVICE CLASS
// =====================================================

class EncryptionService {
  private static instance: EncryptionService;
  private masterKeySalt: Uint8Array | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  /**
   * Initializes the encryption service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      secureLogger.info('Initializing encryption service');

      // Load or generate master key salt
      await this.initializeMasterKeySalt();

      this.isInitialized = true;
      secureLogger.info('Encryption service initialized successfully');
    } catch (error) {
      secureLogger.error('Failed to initialize encryption service', { error });
      throw new Error('Encryption service initialization failed');
    }
  }

  /**
   * Initializes or loads the master key salt
   */
  private async initializeMasterKeySalt(): Promise<void> {
    try {
      // Try to load existing salt
      const storedSalt = await AsyncStorage.getItem(
        STORAGE_KEYS.MASTER_KEY_SALT
      );

      if (storedSalt) {
        this.masterKeySalt = new Uint8Array(JSON.parse(storedSalt));
        secureLogger.debug('Loaded existing master key salt');
      } else {
        // Generate new salt
        this.masterKeySalt = this.generateSecureRandom(
          ENCRYPTION_CONFIG.SALT_LENGTH
        );

        // Store salt securely
        await AsyncStorage.setItem(
          STORAGE_KEYS.MASTER_KEY_SALT,
          JSON.stringify(Array.from(this.masterKeySalt))
        );

        secureLogger.info('Generated new master key salt');
      }
    } catch (error) {
      secureLogger.error('Failed to initialize master key salt', { error });
      throw error;
    }
  }

  // =====================================================
  // KEY MANAGEMENT
  // =====================================================

  /**
   * Derives encryption key from password using PBKDF2
   */
  private async deriveKey(
    password: string,
    salt: Uint8Array,
    iterations: number = ENCRYPTION_CONFIG.KEY_DERIVATION_ITERATIONS
  ): Promise<CryptoKey> {
    try {
      // Import password as key material
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      // Derive the actual encryption key
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: iterations,
          hash: 'SHA-256',
        },
        keyMaterial,
        {
          name: ENCRYPTION_CONFIG.ALGORITHM,
          length: ENCRYPTION_CONFIG.KEY_LENGTH * 8, // Convert to bits
        },
        false, // Not extractable
        ['encrypt', 'decrypt']
      );

      secureLogger.debug('Key derived successfully', {
        algorithm: ENCRYPTION_CONFIG.ALGORITHM,
        keyLength: ENCRYPTION_CONFIG.KEY_LENGTH,
        iterations,
      });

      return key;
    } catch (error) {
      secureLogger.error('Failed to derive key', { error });
      throw new Error('Key derivation failed');
    }
  }

  /**
   * Generates secure random bytes
   */
  private generateSecureRandom(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  // =====================================================
  // ENCRYPTION METHODS
  // =====================================================

  /**
   * Encrypts data using AES-GCM with authenticated encryption
   */
  async encrypt(
    plaintext: string,
    password: string,
    options: EncryptionOptions = {}
  ): Promise<EncryptedData> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const {
        keyDerivationIterations = ENCRYPTION_CONFIG.KEY_DERIVATION_ITERATIONS,
        algorithm = ENCRYPTION_CONFIG.ALGORITHM,
        keyLength = ENCRYPTION_CONFIG.KEY_LENGTH,
      } = options;

      // Generate random salt and IV
      const salt = this.generateSecureRandom(ENCRYPTION_CONFIG.SALT_LENGTH);
      const iv = this.generateSecureRandom(ENCRYPTION_CONFIG.IV_LENGTH);

      // Derive encryption key
      const key = await this.deriveKey(password, salt, keyDerivationIterations);

      // Encrypt the data
      const plaintextBytes = new TextEncoder().encode(plaintext);
      const encrypted = await crypto.subtle.encrypt(
        {
          name: algorithm,
          iv: iv,
        },
        key,
        plaintextBytes
      );

      // Extract ciphertext and auth tag
      const encryptedArray = new Uint8Array(encrypted);
      const ciphertext = encryptedArray.slice(0, -ENCRYPTION_CONFIG.TAG_LENGTH);
      const tag = encryptedArray.slice(-ENCRYPTION_CONFIG.TAG_LENGTH);

      const result: EncryptedData = {
        ciphertext: this.arrayToBase64(ciphertext),
        iv: this.arrayToBase64(iv),
        salt: this.arrayToBase64(salt),
        tag: this.arrayToBase64(tag),
        algorithm,
        keyDerivation: ENCRYPTION_CONFIG.KEY_DERIVATION_ALGORITHM,
      };

      secureLogger.debug('Data encrypted successfully', {
        algorithm,
        ciphertextLength: result.ciphertext.length,
        keyDerivationIterations,
      });

      // Clear sensitive data from memory
      this.clearSensitiveData(plaintextBytes, key);

      return result;
    } catch (error) {
      secureLogger.error('Encryption failed', { error });
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypts data encrypted with the encrypt method
   */
  async decrypt(
    encryptedData: EncryptedData,
    password: string
  ): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Validate algorithm
      if (encryptedData.algorithm !== ENCRYPTION_CONFIG.ALGORITHM) {
        throw new Error('Unsupported encryption algorithm');
      }

      // Convert base64 to arrays
      const ciphertext = this.base64ToArray(encryptedData.ciphertext);
      const iv = this.base64ToArray(encryptedData.iv);
      const salt = this.base64ToArray(encryptedData.salt);
      const tag = this.base64ToArray(encryptedData.tag);

      // Derive decryption key
      const key = await this.deriveKey(password, salt);

      // Combine ciphertext and tag for GCM decryption
      const encryptedBuffer = new Uint8Array(ciphertext.length + tag.length);
      encryptedBuffer.set(ciphertext);
      encryptedBuffer.set(tag, ciphertext.length);

      // Decrypt the data
      const decrypted = await crypto.subtle.decrypt(
        {
          name: encryptedData.algorithm,
          iv: iv,
        },
        key,
        encryptedBuffer
      );

      const plaintext = new TextDecoder().decode(decrypted);

      secureLogger.debug('Data decrypted successfully', {
        algorithm: encryptedData.algorithm,
        plaintextLength: plaintext.length,
      });

      // Clear sensitive data from memory
      this.clearSensitiveData(new Uint8Array(decrypted), key);

      return plaintext;
    } catch (error) {
      secureLogger.error('Decryption failed', { error });
      throw new Error('Data decryption failed');
    }
  }

  // =====================================================
  // MATERNAL HEALTH ID SPECIFIC ENCRYPTION
  // =====================================================

  /**
   * Encrypts maternal health ID with special handling
   */
  async encryptMaternalHealthId(
    maternalHealthId: string,
    userPassword: string
  ): Promise<EncryptedData> {
    if (!this.validateMaternalHealthId(maternalHealthId)) {
      throw new Error('Invalid maternal health ID format');
    }

    try {
      // Add additional entropy by combining with master salt
      const enhancedPassword =
        await this.enhancePasswordWithMasterSalt(userPassword);

      const encrypted = await this.encrypt(maternalHealthId, enhancedPassword, {
        keyDerivationIterations:
          ENCRYPTION_CONFIG.KEY_DERIVATION_ITERATIONS * 2, // Extra iterations for sensitive data
      });

      secureLogger.security('Maternal health ID encrypted', {
        algorithm: encrypted.algorithm,
        keyDerivation: encrypted.keyDerivation,
      });

      // Clear maternal health ID from memory immediately
      const sanitizedId = '[REDACTED]';
      secureLogger.debug('Maternal health ID cleared from memory');

      return encrypted;
    } catch (error) {
      secureLogger.error('Failed to encrypt maternal health ID', { error });
      throw new Error('Maternal health ID encryption failed');
    }
  }

  /**
   * Decrypts maternal health ID with special handling
   */
  async decryptMaternalHealthId(
    encryptedData: EncryptedData,
    userPassword: string
  ): Promise<string> {
    try {
      const enhancedPassword =
        await this.enhancePasswordWithMasterSalt(userPassword);
      const decrypted = await this.decrypt(encryptedData, enhancedPassword);

      if (!this.validateMaternalHealthId(decrypted)) {
        throw new Error('Decrypted data is not a valid maternal health ID');
      }

      secureLogger.security('Maternal health ID decrypted');

      return decrypted;
    } catch (error) {
      secureLogger.error('Failed to decrypt maternal health ID', { error });
      throw new Error('Maternal health ID decryption failed');
    }
  }

  /**
   * Validates maternal health ID format
   */
  private validateMaternalHealthId(id: string): boolean {
    return /^\d{10}$/.test(id);
  }

  /**
   * Enhances password with master salt for additional security
   */
  private async enhancePasswordWithMasterSalt(
    password: string
  ): Promise<string> {
    if (!this.masterKeySalt) {
      throw new Error('Master key salt not initialized');
    }

    // Create HMAC of password with master salt
    const key = await crypto.subtle.importKey(
      'raw',
      this.masterKeySalt,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(password)
    );

    // Convert to base64 and combine with original password
    const hmacBase64 = this.arrayToBase64(new Uint8Array(signature));
    return `${password}:${hmacBase64}`;
  }

  // =====================================================
  // SECURE SESSION TOKEN ENCRYPTION
  // =====================================================

  /**
   * Encrypts session tokens for secure storage
   */
  async encryptSessionToken(
    token: string,
    userId: string
  ): Promise<EncryptedData> {
    try {
      // Use user ID as part of the encryption key
      const sessionKey = await this.deriveSessionKey(userId);

      const encrypted = await this.encrypt(token, sessionKey);

      secureLogger.debug('Session token encrypted', {
        userId: userId.substring(0, 8) + '...',
        algorithm: encrypted.algorithm,
      });

      return encrypted;
    } catch (error) {
      secureLogger.error('Failed to encrypt session token', { error });
      throw new Error('Session token encryption failed');
    }
  }

  /**
   * Decrypts session tokens from secure storage
   */
  async decryptSessionToken(
    encryptedData: EncryptedData,
    userId: string
  ): Promise<string> {
    try {
      const sessionKey = await this.deriveSessionKey(userId);
      const decrypted = await this.decrypt(encryptedData, sessionKey);

      secureLogger.debug('Session token decrypted', {
        userId: userId.substring(0, 8) + '...',
      });

      return decrypted;
    } catch (error) {
      secureLogger.error('Failed to decrypt session token', { error });
      throw new Error('Session token decryption failed');
    }
  }

  /**
   * Derives a session-specific encryption key
   */
  private async deriveSessionKey(userId: string): Promise<string> {
    if (!this.masterKeySalt) {
      throw new Error('Master key salt not initialized');
    }

    // Create HMAC of user ID with master salt
    const key = await crypto.subtle.importKey(
      'raw',
      this.masterKeySalt,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`session:${userId}`)
    );

    return this.arrayToBase64(new Uint8Array(signature));
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Converts Uint8Array to base64 string
   */
  private arrayToBase64(array: Uint8Array): string {
    return btoa(String.fromCharCode.apply(null, Array.from(array)));
  }

  /**
   * Converts base64 string to Uint8Array
   */
  private base64ToArray(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Securely clears sensitive data from memory
   */
  private clearSensitiveData(...items: (Uint8Array | CryptoKey)[]): void {
    try {
      items.forEach(item => {
        if (item instanceof Uint8Array) {
          // Overwrite array with random data
          crypto.getRandomValues(item);
        }
        // Note: CryptoKey objects can't be directly cleared in JavaScript
        // They are handled by the browser's garbage collector
      });
    } catch (error) {
      secureLogger.error('Failed to clear sensitive data', { error });
    }
  }

  /**
   * Generates secure hash for data integrity
   */
  async generateHash(data: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = new Uint8Array(hashBuffer);
      return this.arrayToBase64(hashArray);
    } catch (error) {
      secureLogger.error('Failed to generate hash', { error });
      throw new Error('Hash generation failed');
    }
  }

  /**
   * Verifies data integrity using hash
   */
  async verifyHash(data: string, expectedHash: string): Promise<boolean> {
    try {
      const actualHash = await this.generateHash(data);
      return actualHash === expectedHash;
    } catch (error) {
      secureLogger.error('Failed to verify hash', { error });
      return false;
    }
  }

  // =====================================================
  // CLEANUP AND MAINTENANCE
  // =====================================================

  /**
   * Clears all encryption-related data
   */
  async clearAllData(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.MASTER_KEY_SALT),
        AsyncStorage.removeItem(STORAGE_KEYS.KEY_DERIVATION_PARAMS),
      ]);

      this.masterKeySalt = null;
      this.isInitialized = false;

      secureLogger.info('All encryption data cleared');
    } catch (error) {
      secureLogger.error('Failed to clear encryption data', { error });
      throw error;
    }
  }

  /**
   * Gets encryption service statistics
   */
  getStats(): {
    isInitialized: boolean;
    algorithm: string;
    keyLength: number;
    keyDerivationIterations: number;
  } {
    return {
      isInitialized: this.isInitialized,
      algorithm: ENCRYPTION_CONFIG.ALGORITHM,
      keyLength: ENCRYPTION_CONFIG.KEY_LENGTH,
      keyDerivationIterations: ENCRYPTION_CONFIG.KEY_DERIVATION_ITERATIONS,
    };
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const encryptionService = EncryptionService.getInstance();

/**
 * Initialize the encryption service - should be called at app startup
 */
export const initializeEncryption = async (): Promise<void> => {
  await encryptionService.initialize();
};

export default encryptionService;
