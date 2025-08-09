import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, Animated, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { createRegistrationRequest } from '../types/auth';
import { validateRegistrationForm, checkUsernameAvailability, createValidationDebouncer } from '../utils/formValidation';
import { secureLogger } from '../utils/privacyProtection';
import SecureInput from '../components/SecureInput';
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator';
import EmojiPicker from '../components/EmojiPicker';
import { appConfig } from '../config/appConfig';

export default function SignUpScreen({ onLogin }: { onLogin?: () => void }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const { register, isLoading, error, clearError } = useAuth();
  
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    maternalHealthId: '',
    password: '',
    displayName: '',
    bio: '',
    avatarEmoji: ''
  });
  
  // Validation state
  const [validation, setValidation] = useState({
    username: { isValid: true, error: '', checks: { length: false, characters: false, available: false } },
    maternalHealthId: { isValid: true, error: '', format: { length: false, digitsOnly: false } },
    password: { isValid: true, error: '', strength: 'weak' as const, checks: { length: false, uppercase: false, lowercase: false, numbers: false, symbols: false } },
    displayName: { isValid: true, error: '' },
    bio: { isValid: true, error: '' }
  });
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [usernameCheckInProgress, setUsernameCheckInProgress] = useState(false);
  
  // Refs and debouncing
  const usernameCheckDebouncer = useRef(createValidationDebouncer(800));
  
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [fade]);

  // =====================================================
  // VALIDATION HANDLERS
  // =====================================================

  /**
   * Real-time username validation with availability check
   */
  const validateUsernameWithAvailability = useCallback(async (username: string) => {
    if (!username.trim()) {
      setValidation(prev => ({
        ...prev,
        username: { isValid: false, error: 'ユーザー名を入力してください', checks: { length: false, characters: false, available: false } }
      }));
      return;
    }

    // First validate format
    const formatValidation = validateRegistrationForm({ username, maternalHealthId: '', password: '' });
    
    if (!formatValidation.username.isValid) {
      setValidation(prev => ({
        ...prev,
        username: formatValidation.username
      }));
      return;
    }

    // Skip availability check when using mock auth (no backend)
    if (appConfig.useMockAuth) {
      setValidation(prev => ({
        ...prev,
        username: {
          ...formatValidation.username,
          checks: {
            ...formatValidation.username.checks,
            available: true,
          },
          isValid: formatValidation.username.isValid,
          error: formatValidation.username.isValid ? undefined : formatValidation.username.error,
        },
      }));
      return;
    }

    // Then check availability (debounced, real backend scenario)
    setUsernameCheckInProgress(true);
    
    try {
      const isAvailable = await usernameCheckDebouncer.current(checkUsernameAvailability, username);
      
      setValidation(prev => ({
        ...prev,
        username: {
          ...formatValidation.username,
          checks: {
            ...formatValidation.username.checks,
            available: isAvailable
          },
          isValid: formatValidation.username.isValid && isAvailable,
          error: !isAvailable ? 'このユーザー名は既に使用されています' : undefined
        }
      }));
    } catch (error) {
      secureLogger.error('Username availability check failed', { error });
      setValidation(prev => ({
        ...prev,
        username: {
          ...formatValidation.username,
          checks: {
            ...formatValidation.username.checks,
            available: true // Assume available if check fails
          }
        }
      }));
    } finally {
      setUsernameCheckInProgress(false);
    }
  }, []);

  /**
   * Real-time form validation
   */
  const validateFormField = useCallback((field: string, value: string) => {
    const formValidation = validateRegistrationForm({
      username: field === 'username' ? value : formData.username,
      maternalHealthId: field === 'maternalHealthId' ? value : formData.maternalHealthId,
      password: field === 'password' ? value : formData.password,
      displayName: field === 'displayName' ? value : formData.displayName,
      bio: field === 'bio' ? value : formData.bio
    });

    setValidation(prev => ({
      ...prev,
      [field]: formValidation[field as keyof typeof formValidation] || { isValid: true }
    }));
  }, [formData]);

  // =====================================================
  // INPUT HANDLERS
  // =====================================================

  const handleInputChange = useCallback((field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear auth error when user starts typing
    if (error) {
      clearError();
    }
    
    // Validate field in real-time
    if (field === 'username') {
      validateUsernameWithAvailability(value);
    } else {
      validateFormField(field, value);
    }
  }, [error, clearError, validateUsernameWithAvailability, validateFormField]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setFormData(prev => ({ ...prev, avatarEmoji: emoji }));
    setShowEmojiPicker(false);
    secureLogger.debug('Avatar emoji selected');
  }, []);

  // =====================================================
  // FORM SUBMISSION
  // =====================================================

  const handleSignUp = async () => {
    try {
      clearError();
      
      // Final validation
      const formValidation = validateRegistrationForm(formData);
      setValidation({
        username: formValidation.username,
        maternalHealthId: formValidation.maternal_health_id,
        password: formValidation.password,
        displayName: formValidation.display_name,
        bio: formValidation.bio
      });
      
      if (!formValidation.isFormValid) {
        secureLogger.info('SignUp form validation failed');
        return;
      }

      setIsSubmitting(true);
      
      // Create registration request
      const registrationRequest = createRegistrationRequest({
        username: formData.username.trim(),
        maternal_health_id: formData.maternalHealthId.trim(),
        password: formData.password,
        display_name: formData.displayName.trim() || undefined,
        bio: formData.bio.trim() || undefined,
        avatar_emoji: formData.avatarEmoji || undefined
      });
      
      secureLogger.info('Registration attempt initiated');
      
      // Attempt registration
      const response = await register(registrationRequest);
      
      if (response.success) {
        secureLogger.info('Registration successful');
        // Navigation will be handled by the AuthContext and parent component
      } else {
        secureLogger.warn('Registration failed', { error: response.error });
        // Error will be displayed through the error state from useAuth
      }
      
    } catch (error) {
      secureLogger.error('Registration exception', { error });
      Alert.alert(
        'エラー',
        '登録中にエラーが発生しました。もう一度お試しください。',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // =====================================================
  // RENDER HELPERS
  // =====================================================

  const isFormValid = validation.username.isValid && 
                     validation.maternalHealthId.isValid && 
                     validation.password.isValid && 
                     validation.displayName.isValid && 
                     validation.bio.isValid;

  return (
    <Animated.View testID="signup-form" style={{
      flex: 1,
      backgroundColor: 'transparent',
      opacity: fade
    }}>
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: theme.spacing(2),
          paddingTop: 60
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: theme.spacing(2) }}>
          <Text style={{
            color: colors.pink,
            fontSize: 28,
            fontWeight: '800'
          }}>
            Mamapace
          </Text>
        </View>
        
        <View style={{ borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
          <View style={{ position: 'relative', padding: theme.spacing(1.75), backgroundColor: '#ffffff10' }}>
            <BlurView
              intensity={30}
              tint="dark"
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
              pointerEvents="none"
            />
            <View style={{ position: 'relative' }}>
            {/* Form Title */}
            <Text style={{
              color: colors.text,
              fontSize: 18,
              fontWeight: '700',
              marginBottom: theme.spacing(1.5),
              textAlign: 'center'
            }}>
              新規登録
            </Text>
            
            <View style={{ gap: theme.spacing(1.5) }}>
              {/* Username field */}
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                    ユーザー名 *
                  </Text>
                  {usernameCheckInProgress && (
                    <ActivityIndicator 
                      size="small" 
                      color={colors.pink} 
                      style={{ marginLeft: 8 }} 
                    />
                  )}
                  {validation.username.checks.available && validation.username.isValid && (
                    <Text style={{ color: colors.mint, fontSize: 12, marginLeft: 8 }}>✅ 利用可能</Text>
                  )}
                </View>
                <SecureInput
                  placeholder="ユーザー名を入力"
                  value={formData.username}
                  onChangeText={(text) => handleInputChange('username', text)}
                  validation={validation.username}
                  disabled={isLoading || isSubmitting}
                  maxLength={20}
                  // accessibility
                  autoCapitalize="none"
                  testID="username-input"
                />
              </View>

              {/* Maternal Health ID field */}
              <View>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
                  母子手帳番号 * 🔒
                </Text>
                <SecureInput
                  placeholder="10桁の母子手帳番号"
                  value={formData.maternalHealthId}
                  onChangeText={(text) => handleInputChange('maternalHealthId', text)}
                  validation={validation.maternalHealthId}
                  disabled={isLoading || isSubmitting}
                  isSensitive
                  keyboardType="numeric"
                  maxLength={10}
                  // accessibility
                  autoCapitalize="none"
                  testID="maternal-health-id-input"
                />
              </View>

              {/* Password field with strength indicator */}
              <View>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
                  パスワード *
                </Text>
                <SecureInput
                  placeholder="安全なパスワードを作成"
                  value={formData.password}
                  onChangeText={(text) => handleInputChange('password', text)}
                  validation={validation.password}
                  disabled={isLoading || isSubmitting}
                  secureTextEntry
                  // accessibility
                  autoCapitalize="none"
                  testID="password-input"
                />
                {formData.password.length > 0 && (
                  <View style={{ marginTop: theme.spacing(0.75) }}>
                    <PasswordStrengthIndicator 
                      validation={validation.password}
                      showDetails
                      showStrengthBar
                    />
                  </View>
                )}
              </View>

              {/* Display name field (optional) */}
              <View>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
                  表示名 (任意)
                </Text>
                <SecureInput
                  placeholder="表示名を入力"
                  value={formData.displayName}
                  onChangeText={(text) => handleInputChange('displayName', text)}
                  validation={validation.displayName}
                  disabled={isLoading || isSubmitting}
                  maxLength={30}
                />
              </View>

              {/* Bio field (optional) */}
              <View>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
                  自己紹介 (任意)
                </Text>
                <SecureInput
                  placeholder="簡単な自己紹介"
                  value={formData.bio}
                  onChangeText={(text) => handleInputChange('bio', text)}
                  validation={validation.bio}
                  disabled={isLoading || isSubmitting}
                  maxLength={500}
                />
              </View>

              {/* Avatar emoji selection */}
              <View>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
                  アバター (任意)
                </Text>
                <Pressable
                  onPress={() => setShowEmojiPicker(!showEmojiPicker)}
                  disabled={isLoading || isSubmitting}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.surface,
                      borderRadius: theme.radius.md,
                      paddingHorizontal: theme.spacing(1),
                      height: 44,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: [{ scale: pressed ? 0.98 : 1 }]
                    }
                  ]}
                >
                  {formData.avatarEmoji ? (
                    <>
                      <Text style={{ fontSize: 20, marginRight: 8 }}>{formData.avatarEmoji}</Text>
                      <Text style={{ color: colors.text, fontSize: 14 }}>変更する</Text>
                    </>
                  ) : (
                    <Text style={{ color: colors.subtext, fontSize: 14 }}>絵文字を選択</Text>
                  )}
                </Pressable>
              </View>

              {/* Emoji picker */}
              {showEmojiPicker && (
                <EmojiPicker
                  selectedEmoji={formData.avatarEmoji}
                  onEmojiSelect={handleEmojiSelect}
                  disabled={isLoading || isSubmitting}
                />
              )}
            </View>
            
            {/* Error message from auth context */}
            {error && (
              <View style={{
                backgroundColor: colors.danger + '10',
                borderRadius: theme.radius.sm,
                padding: theme.spacing(1),
                marginTop: theme.spacing(1),
                borderWidth: 1,
                borderColor: colors.danger + '30'
              }}>
                <Text style={{
                  color: colors.danger,
                  fontSize: 14,
                  textAlign: 'center'
                }}>
                  {error}
                </Text>
              </View>
            )}
            
            {/* Submit button */}
            <Pressable
              style={({ pressed }) => [{
                marginTop: theme.spacing(2),
                backgroundColor: (isLoading || isSubmitting || !isFormValid) ? colors.pink + '60' : colors.pink,
                borderRadius: theme.radius.md,
                paddingVertical: 14,
                alignItems: 'center',
                transform: [{ scale: pressed && isFormValid ? 0.97 : 1 }],
                ...theme.shadow.card,
                opacity: (isLoading || isSubmitting || !isFormValid) ? 0.7 : 1
              }]}
              onPress={handleSignUp}
              disabled={isLoading || isSubmitting || !isFormValid}
              testID="register-button"
            >
              {(isLoading || isSubmitting) ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator color="#23181D" size="small" style={{ marginRight: 8 }} />
                  <Text style={{
                    color: '#23181D',
                    fontWeight: '700',
                    fontSize: 16
                  }}>
                    登録中...
                  </Text>
                </View>
              ) : (
                <Text style={{
                  color: '#23181D',
                  fontWeight: '700',
                  fontSize: 16
                }}>
                  アカウント作成
                </Text>
              )}
            </Pressable>
            
            {/* Login link */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'center',
              marginTop: theme.spacing(1.5)
            }}>
              <Text style={{
                color: colors.subtext,
                fontSize: 12
              }}>
                アカウントをお持ちですか？{' '}
              </Text>
              <Pressable
                onPress={onLogin}
                disabled={isLoading || isSubmitting}
              >
                <Text style={{
                  color: (isLoading || isSubmitting) ? colors.subtext : colors.pink,
                  fontSize: 12,
                  fontWeight: '700'
                }}>
                  ログイン
                </Text>
              </Pressable>
            </View>
            
            {/* Security notice */}
            <View style={{
              marginTop: theme.spacing(1),
              padding: theme.spacing(1),
              backgroundColor: colors.mint + '15',
              borderRadius: theme.radius.sm,
              borderWidth: 1,
              borderColor: colors.mint + '30'
            }}>
              <Text style={{
                color: colors.mint,
                fontSize: 11,
                textAlign: 'center',
                lineHeight: 16
              }}>
                🛡️ 母子手帳番号は暗号化され、安全に保護されます。
                あなたの個人情報は厳重に管理いたします。
              </Text>
            </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
}
