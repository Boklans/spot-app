import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { syncDown, syncUp } from '@/lib/cloudSync';
import { hapticImpact, hapticLight, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/store/authStore';
import { useUserProfileStore } from '@/store/userProfileStore';

import { supabase } from '@/lib/supabase';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  onSuccess?: () => void;
}

export function AuthModal({ visible, onClose, initialMode = 'signin', onSuccess }: AuthModalProps) {
  const { language } = useI18n();
  const isUk = language === 'uk';

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<'signin' | 'signup' | null>(null);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSuccessMsg, setResendSuccessMsg] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setMode(initialMode);
      setErrorMessage(null);
      setSuccessState(null);
      setEmailNotConfirmed(false);
      setResendSuccessMsg(null);
      setInfoMessage(null);
    }
  }, [visible, initialMode]);

  const signInWithPassword = useAuthStore((state) => state.signInWithPassword);
  const signUpWithPassword = useAuthStore((state) => state.signUpWithPassword);
  const resetPassword = useAuthStore((state) => state.resetPassword);

  const handleModeSwitch = (newMode: 'signin' | 'signup') => {
    hapticLight();
    setMode(newMode);
    setErrorMessage(null);
    setEmailNotConfirmed(false);
    setResendSuccessMsg(null);
    setInfoMessage(null);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    setResendSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage(isUk ? 'Введіть коректну адресу пошти' : 'Please enter a valid email address');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage(isUk ? 'Пароль має містити щонайменше 6 символів' : 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    hapticImpact();

    try {
      if (mode === 'signin') {
        const res = await signInWithPassword(cleanEmail, password);
        if (!res.success) {
          if (res.error?.includes('Email not confirmed')) {
            setEmailNotConfirmed(true);
            setErrorMessage(
              isUk
                ? 'Електронна пошта ще не підтверджена. Перевірте поштову скриньку (також папку Спам) або надішліть новий лист для підтвердження.'
                : 'Email address is not confirmed yet. Please check your inbox (including Spam) or resend the confirmation link.'
            );
          } else if (res.error?.includes('Invalid login credentials')) {
            setEmailNotConfirmed(false);
            setErrorMessage(
              isUk
                ? 'Невірний email або пароль'
                : 'Invalid email or password'
            );
          } else {
            setEmailNotConfirmed(false);
            setErrorMessage(res.error || (isUk ? 'Помилка входу' : 'Login failed'));
          }
          setLoading(false);
          return;
        }

        // Successfully signed in -> Sync data
        hapticSuccess();
        await syncDown();
        setLoading(false);
        setSuccessState('signin');
      } else {
        // Sign Up
        const userName = name.trim() || useUserProfileStore.getState().profile.name || 'Athlete';
        const res = await signUpWithPassword(cleanEmail, password, userName, language);

        if (!res.success) {
          setErrorMessage(
            res.error?.includes('User already registered')
              ? isUk
                ? 'Користувач із такою поштою вже зареєстрований'
                : 'User with this email already exists'
              : res.error || (isUk ? 'Помилка реєстрації' : 'Registration failed')
          );
          setLoading(false);
          return;
        }

        hapticSuccess();
        // Upload initial local data to newly registered cloud account
        await syncUp();
        setLoading(false);
        setSuccessState('signup');
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err?.message || (isUk ? 'Сталася помилка' : 'An error occurred'));
    }
  };

  const handleResendConfirmation = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage(isUk ? 'Введіть коректну адресу пошти' : 'Please enter a valid email address');
      return;
    }

    setResendingEmail(true);
    setResendSuccessMsg(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setResendSuccessMsg(
          isUk
            ? 'Лист для підтвердження надіслано! Перевірте папку Вхідні або Спам.'
            : 'Confirmation email sent! Please check your inbox or spam folder.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || (isUk ? 'Помилка відправки листа' : 'Failed to resend confirmation email'));
    } finally {
      setResendingEmail(false);
    }
  };

  const handleFinishSuccess = () => {
    setSuccessState(null);
    setErrorMessage(null);
    setEmailNotConfirmed(false);
    setResendSuccessMsg(null);
    onClose();
    onSuccess?.();
  };

  const handleClose = () => {
    if (successState) {
      handleFinishSuccess();
    } else {
      setErrorMessage(null);
      setEmailNotConfirmed(false);
      setResendSuccessMsg(null);
      onClose();
    }
  };

  const handleForgotPassword = () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      Alert.alert(
        isUk ? 'Вкажіть пошту' : 'Enter your email',
        isUk
          ? 'Будь ласка, введіть вашу пошту в поле вище, щоб ми надіслали інструкції для скидання пароля.'
          : 'Please enter your email above to receive password reset instructions.'
      );
      return;
    }

    Alert.alert(
      isUk ? 'Скидання пароля' : 'Reset Password',
      isUk
        ? `Надіслати посилання для відновлення пароля на ${cleanEmail}?`
        : `Send a password reset link to ${cleanEmail}?`,
      [
        { text: isUk ? 'Скасувати' : 'Cancel', style: 'cancel' },
        {
          text: isUk ? 'Надіслати' : 'Send',
          onPress: async () => {
            const res = await resetPassword(cleanEmail);
            if (res.success) {
              Alert.alert(
                isUk ? 'Лист надіслано' : 'Email Sent',
                isUk
                  ? 'Перевірте вашу поштову скриньку для зміни пароля.'
                  : 'Check your inbox for password reset instructions.'
              );
            } else {
              Alert.alert(isUk ? 'Помилка' : 'Error', res.error || 'Failed to send reset email');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close modal"
        />
        <View style={styles.sheetContainer}>
          {/* Top Bar */}
          <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>
                  {successState
                    ? (successState === 'signup'
                        ? (isUk ? 'Хмарний акаунт' : 'Cloud Account')
                        : (isUk ? 'Авторизація' : 'Authorization'))
                    : (mode === 'signin'
                        ? (isUk ? 'Вхід у SPOT' : 'Sign In to SPOT')
                        : (isUk ? 'Створити акаунт' : 'Create SPOT Account'))}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {successState
                    ? (isUk ? 'Синхронізація активна' : 'Sync is active')
                    : (isUk
                        ? 'Зберігайте прогрес та тренування в хмарі'
                        : 'Sync your workouts and PRs across devices')}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={12}
                onPress={handleClose}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            {successState ? (
              /* Custom SPOT Success View */
              <View style={styles.successContainer}>
                <View style={styles.successGlowWrap}>
                  <View style={styles.successIconCircle}>
                    <Ionicons
                      name={successState === 'signup' ? 'cloud-done' : 'checkmark-sharp'}
                      size={44}
                      color="#0B0D0F"
                    />
                  </View>
                </View>

                <Text style={styles.successTitle}>
                  {successState === 'signup'
                    ? (isUk ? 'Акаунт створено!' : 'Account Created!')
                    : (isUk ? 'З поверненням!' : 'Welcome back!')}
                </Text>

                <Text style={styles.successDesc}>
                  {successState === 'signup'
                    ? (isUk
                        ? 'Ваш прогрес та персональні рекорди надійно збережено в хмарі SPOT.'
                        : 'Your workouts and progress are safely backed up in SPOT cloud.')
                    : (isUk
                        ? 'Ваші тренувальні дані успішно завантажено та синхронізовано.'
                        : 'Your workouts and profile have been successfully loaded.')}
                </Text>

                <View style={styles.accountBadge}>
                  <Ionicons name="cloud" size={16} color={colors.primary} />
                  <Text style={styles.accountBadgeEmail} numberOfLines={1}>
                    {email.trim().toLowerCase()}
                  </Text>
                  <View style={styles.onlinePill}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlinePillText}>{isUk ? 'Онлайн' : 'Online'}</Text>
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={handleFinishSuccess}
                  style={({ pressed }) => [
                    styles.submitBtn,
                    styles.successBtn,
                    pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] },
                  ]}
                >
                  <Text style={styles.submitBtnText}>
                    {isUk ? 'ПРОДОВЖИТИ' : 'CONTINUE'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* Mode Switcher Tabs */}
                <View style={styles.tabContainer}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleModeSwitch('signin')}
                    style={[styles.tabBtn, mode === 'signin' && styles.tabBtnActive]}
                  >
                    <Text style={[styles.tabBtnText, mode === 'signin' && styles.tabBtnTextActive]}>
                      {isUk ? 'Вхід' : 'Sign In'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleModeSwitch('signup')}
                    style={[styles.tabBtn, mode === 'signup' && styles.tabBtnActive]}
                  >
                    <Text style={[styles.tabBtnText, mode === 'signup' && styles.tabBtnTextActive]}>
                      {isUk ? 'Реєстрація' : 'Sign Up'}
                    </Text>
                  </Pressable>
                </View>

                <ScrollView
                  style={styles.scrollView}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  bounces={false}
                >
                  {/* Resend Success Banner */}
                  {resendSuccessMsg && (
                    <View style={styles.infoBox}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                      <Text style={styles.infoText}>{resendSuccessMsg}</Text>
                    </View>
                  )}

                  {/* Error Box */}
                  {errorMessage && (
                    <View style={styles.errorBox}>
                      <Ionicons name="alert-circle" size={18} color="#F87171" style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.errorText}>{errorMessage}</Text>
                        {emailNotConfirmed && (
                          <Pressable
                            accessibilityRole="button"
                            onPress={handleResendConfirmation}
                            disabled={resendingEmail}
                            style={styles.resendBtn}
                          >
                            {resendingEmail ? (
                              <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                              <>
                                <Ionicons name="mail-unread-outline" size={15} color={colors.primary} />
                                <Text style={styles.resendBtnText}>
                                  {isUk ? 'Надіслати лист для активації ще раз' : 'Resend confirmation email'}
                                </Text>
                              </>
                            )}
                          </Pressable>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Name Field (Only in Sign Up) */}
                  {mode === 'signup' && (
                    <View style={styles.fieldWrap}>
                      <Text style={styles.fieldLabel}>{isUk ? "ІМ'Я" : 'YOUR NAME'}</Text>
                      <View style={styles.inputBox}>
                        <Ionicons name="person-outline" size={20} color="#8E9BAE" style={styles.inputIcon} />
                        <TextInput
                          style={styles.textInput}
                          placeholder={isUk ? 'Ваше ім’я' : 'Your name'}
                          placeholderTextColor="#64748B"
                          value={name}
                          onChangeText={setName}
                          autoCapitalize="words"
                        />
                      </View>
                    </View>
                  )}

                  {/* Email Field */}
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>{isUk ? 'ЕЛЕКТРОННА ПОШТА' : 'EMAIL ADDRESS'}</Text>
                    <View style={styles.inputBox}>
                      <Ionicons name="mail-outline" size={20} color="#8E9BAE" style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="athlete@example.com"
                        placeholderTextColor="#64748B"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>

                  {/* Password Field */}
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>{isUk ? 'ПАРОЛЬ' : 'PASSWORD'}</Text>
                    <View style={styles.inputBox}>
                      <Ionicons name="lock-closed-outline" size={20} color="#8E9BAE" style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="••••••••"
                        placeholderTextColor="#64748B"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Toggle password visibility"
                        onPress={() => setShowPassword(!showPassword)}
                        hitSlop={10}
                        style={styles.eyeBtn}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color="#8E9BAE"
                        />
                      </Pressable>
                    </View>
                  </View>

                  {/* Forgot Password Link */}
                  {mode === 'signin' && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleForgotPassword}
                      style={styles.forgotBtn}
                    >
                      <Text style={styles.forgotText}>
                        {isUk ? 'Забули пароль?' : 'Forgot password?'}
                      </Text>
                    </Pressable>
                  )}

                  {/* Submit CTA Button */}
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleSubmit}
                    disabled={loading}
                    style={({ pressed }) => [
                      styles.submitBtn,
                      pressed && { opacity: 0.85 },
                      loading && { opacity: 0.7 },
                    ]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#0B0D0F" size="small" />
                    ) : (
                      <Text style={styles.submitBtnText}>
                        {mode === 'signin'
                          ? isUk
                            ? 'УВІЙТИ'
                            : 'SIGN IN'
                          : isUk
                          ? 'СТВОРИТИ АКАУНТ'
                          : 'CREATE ACCOUNT'}
                      </Text>
                    )}
                  </Pressable>

                  {/* Offline note */}
                  <Text style={styles.offlineNote}>
                    {isUk
                      ? '🔒 Ваші дані зберігаються офлайн та автоматично синхронізуються за наявності зв’язку.'
                      : '🔒 Your data is stored locally and syncs automatically when online.'}
                  </Text>
                </ScrollView>
              </>
            )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    backgroundColor: '#12161D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#242C38',
    maxHeight: '85%',
    width: '100%',
    overflow: 'hidden',
  },
  scrollView: {
    flexShrink: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A212B',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E9BAE',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C232E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0E1115',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1E2633',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: '#1E2633',
  },
  tabBtnText: {
    color: '#8E9BAE',
    fontSize: 14,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: colors.primary,
    fontWeight: '900',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  fieldWrap: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E9BAE',
    letterSpacing: 1,
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#242C38',
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  eyeBtn: {
    padding: 6,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -6,
    marginBottom: 20,
    paddingVertical: 4,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  submitBtnText: {
    color: '#0B0D0F',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  offlineNote: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  // Resend confirmation & info styles
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
  },
  resendBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  infoText: {
    color: '#E0E7FF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  // Custom SPOT Success View styles
  successContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 36,
  },
  successGlowWrap: {
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  successIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 8,
  },
  successDesc: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#242C38',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 12,
    maxWidth: '92%',
  },
  accountBadgeEmail: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 5,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  onlinePillText: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '700',
  },
  successBtn: {
    width: '100%',
    marginTop: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
});

