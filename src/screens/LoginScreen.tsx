import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, Animated, Alert, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { createLoginRequest } from '../types/auth';
import { validateLoginForm } from '../utils/formValidation';
import { secureLogger } from '../utils/privacyProtection';
import SecureInput from '../components/SecureInput';

export default function LoginScreen({ onSignup }: { onSignup?: () => void }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const { login, isLoading, error, clearError } = useAuth();
  
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    maternalHealthId: '',
    password: ''
  });
  
  // Validation state
  const [validation, setValidation] = useState({
    username: { isValid: true, error: '' },
    maternalHealthId: { isValid: true, error: '', format: { length: false, digitsOnly: false } },
    password: { isValid: true, error: '' }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [fade]);

  // =====================================================
  // VALIDATION FUNCTIONS
  // =====================================================

  /**
   * Real-time form validation
   */
  const validateFormField = useCallback((field: string, value: string) => {
    const formValidation = validateLoginForm({
      username: field === 'username' ? value : formData.username,
      maternalHealthId: field === 'maternalHealthId' ? value : formData.maternalHealthId,
      password: field === 'password' ? value : formData.password
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
    validateFormField(field, value);
  }, [error, clearError, validateFormField]);

  // =====================================================
  // FORM SUBMISSION
  // =====================================================

  const handleLogin = async () => {
    try {
      // Clear previous errors
      clearError();
      
      // Check for rate limiting
      if (loginAttempts >= 5) {
        Alert.alert(
          'セキュリティ警告',
          'ログイン試行回数が上限に達しました。30分後に再試行してください。',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Final form validation
      const formValidation = validateLoginForm(formData);
      setValidation({
        username: formValidation.username,
        maternalHealthId: formValidation.maternal_health_id,
        password: formValidation.password
      });
      
      if (!formValidation.isFormValid) {
        secureLogger.info('Login form validation failed');
        return;
      }

      setIsSubmitting(true);
      
      // Create login request
      const loginRequest = createLoginRequest({
        username: formData.username.trim(),
        maternal_health_id: formData.maternalHealthId.trim(),
        password: formData.password
      });
      
      secureLogger.info('Login attempt initiated');
      
      // Attempt login
      const response = await login(loginRequest);
      
      if (response.success) {
        secureLogger.info('Login successful');
        setLoginAttempts(0); // Reset attempts on success
        // Navigation will be handled by the AuthContext and parent component
      } else {
        setLoginAttempts(prev => prev + 1);
        secureLogger.warn('Login failed', { error: response.error, attempts: loginAttempts + 1 });
        
        // Show specific error messages
        if (response.error?.includes('locked') || response.error?.includes('ロック')) {
          Alert.alert(
            'アカウントロック',
            'セキュリティのためアカウントが一時的にロックされました。30分後に再試行してください。',
            [{ text: 'OK' }]
          );
        } else if (loginAttempts >= 3) {
          Alert.alert(
            'ログイン失敗',
            `ログインに${loginAttempts + 1}回失敗しました。${5 - (loginAttempts + 1)}回失敗するとアカウントがロックされます。`,
            [{ text: 'OK' }]
          );
        }
        // Error will also be displayed through the error state from useAuth
      }
      
    } catch (error) {
      setLoginAttempts(prev => prev + 1);
      secureLogger.error('Login exception', { error, attempts: loginAttempts + 1 });
      Alert.alert(
        'エラー',
        'ログイン中にエラーが発生しました。もう一度お試しください。',
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
                     validation.password.isValid;

  const isLockedOut = loginAttempts >= 5;

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <Animated.View testID="login-form" style={{
      flex: 1,
      backgroundColor: 'transparent',
      padding: theme.spacing(2),
      paddingTop: 60,
      opacity: fade
    }}>
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
            ログイン
          </Text>
          
          {/* Security indicator */}
          {loginAttempts > 0 && (
            <View style={{
              backgroundColor: loginAttempts >= 3 ? colors.danger + '15' : colors.pink + '15',
              borderRadius: theme.radius.sm,
              padding: theme.spacing(0.75),
              marginBottom: theme.spacing(1),
              borderWidth: 1,
              borderColor: loginAttempts >= 3 ? colors.danger + '30' : colors.pink + '30'
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Text style={{ fontSize: 12, marginRight: 6 }}>
                  {loginAttempts >= 3 ? '⚠️' : 'ℹ️'}
                </Text>
                <Text style={{
                  color: loginAttempts >= 3 ? colors.danger : colors.pink,
                  fontSize: 12,
                  fontWeight: '600',
                  textAlign: 'center'
                }}>
                  ログイン失敗: {loginAttempts}回 (最大5回)
                </Text>
              </View>
            </View>
          )}
          
          <View style={{ gap: theme.spacing(1.5) }}>
            {/* Username field */}
            <View>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
                ユーザー名
              </Text>
              <SecureInput
                placeholder="ユーザー名を入力"
                value={formData.username}
                onChangeText={(text) => handleInputChange('username', text)}
                validation={validation.username}
                disabled={isLoading || isSubmitting || isLockedOut}
                maxLength={20}
                // accessibility
                autoCapitalize="none"
                testID="username-input"
              />
            </View>
            
            {/* Maternal Health ID field */}
            <View>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
                母子手帳番号 🔒
              </Text>
              <SecureInput
                placeholder="10桁の母子手帳番号"
                value={formData.maternalHealthId}
                onChangeText={(text) => handleInputChange('maternalHealthId', text)}
                validation={validation.maternalHealthId}
                disabled={isLoading || isSubmitting || isLockedOut}
                isSensitive
                keyboardType="numeric"
                maxLength={10}
                // accessibility
                autoCapitalize="none"
                testID="maternal-health-id-input"
              />
            </View>
            
            {/* Password field */}
            <View>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
                パスワード
              </Text>
              <SecureInput
                placeholder="パスワードを入力"
                value={formData.password}
                onChangeText={(text) => handleInputChange('password', text)}
                validation={validation.password}
                disabled={isLoading || isSubmitting || isLockedOut}
                secureTextEntry
                // accessibility
                autoCapitalize="none"
                testID="password-input"
              />
            </View>
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
              backgroundColor: (isLoading || isSubmitting || !isFormValid || isLockedOut) ? colors.pink + '60' : colors.pink,
              borderRadius: theme.radius.md,
              paddingVertical: 14,
              alignItems: 'center',
              transform: [{ scale: pressed && isFormValid && !isLockedOut ? 0.97 : 1 }],
              ...theme.shadow.card,
              opacity: (isLoading || isSubmitting || !isFormValid || isLockedOut) ? 0.7 : 1
            }]}
            onPress={handleLogin}
            disabled={isLoading || isSubmitting || !isFormValid || isLockedOut}
            testID="login-button"
          >
            {(isLoading || isSubmitting) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator color="#23181D" size="small" style={{ marginRight: 8 }} />
                <Text style={{
                  color: '#23181D',
                  fontWeight: '700',
                  fontSize: 16
                }}>
                  ログイン中...
                </Text>
              </View>
            ) : isLockedOut ? (
              <Text style={{
                color: '#23181D',
                fontWeight: '700',
                fontSize: 16
              }}>
                アカウントロック中
              </Text>
            ) : (
              <Text style={{
                color: '#23181D',
                fontWeight: '700',
                fontSize: 16
              }}>
                ログイン
              </Text>
            )}
          </Pressable>
          
          {/* Sign up link */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'center',
            marginTop: theme.spacing(1.5)
          }}>
            <Text style={{
              color: colors.subtext,
              fontSize: 12
            }}>
              はじめてですか？{' '}
            </Text>
            <Pressable
              onPress={onSignup}
              disabled={isLoading || isSubmitting}
            >
              <Text style={{
                color: (isLoading || isSubmitting) ? colors.subtext : colors.pink,
                fontSize: 12,
                fontWeight: '700'
              }}>
                新規登録
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
              🛡️ ログイン情報は暗号化され、安全に保護されています。
              5回失敗するとアカウントが30分間ロックされます。
            </Text>
          </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}