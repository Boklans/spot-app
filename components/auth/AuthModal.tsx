import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
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

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AuthModal({ visible, onClose }: AuthModalProps) {
  const { language } = useI18n();
  const isUk = language === 'uk';

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const signInWithPassword = useAuthStore((state) => state.signInWithPassword);
  const signUpWithPassword = useAuthStore((state) => state.signUpWithPassword);
  const resetPassword = useAuthStore((state) => state.resetPassword);

  const handleModeSwitch = (newMode: 'signin' | 'signup') => {
    hapticLight();
    setMode(newMode);
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

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
          setErrorMessage(
            res.error?.includes('Invalid login credentials')
              ? isUk
                ? 'Невірний email або пароль'
                : 'Invalid email or password'
              : res.error || (isUk ? 'Помилка входу' : 'Login failed')
          );
          setLoading(false);
          return;
        }

        // Successfully signed in -> Sync data
        hapticSuccess();
        await syncDown();
        setLoading(false);
        onClose();
        Alert.alert(
          isUk ? 'Успішний вхід!' : 'Welcome back!',
          isUk
            ? 'Ваш прогрес та історію тренувань синхронізовано з хмарою.'
            : 'Your workouts and progress are synced with the cloud.'
        );
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
        onClose();
        Alert.alert(
          isUk ? 'Акаунт створено!' : 'Account Created!',
          isUk
            ? 'Ваш прогрес надійно збережено в хмарі SPOT.'
            : 'Your progress is securely backed up in SPOT cloud.'
        );
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err?.message || (isUk ? 'Сталася помилка' : 'An error occurred'));
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
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          <SafeAreaView style={styles.sheetContainer}>
            {/* Top Bar */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>
                  {mode === 'signin'
                    ? isUk
                      ? 'Вхід у SPOT'
                      : 'Sign In to SPOT'
                    : isUk
                    ? 'Створити акаунт'
                    : 'Create SPOT Account'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {isUk
                    ? 'Зберігайте прогрес та тренування в хмарі'
                    : 'Sync your workouts and PRs across devices'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={12}
                onPress={onClose}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

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
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Error Box */}
              {errorMessage && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color="#F87171" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
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
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  keyboardWrap: {
    width: '100%',
  },
  sheetContainer: {
    backgroundColor: '#12161D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#242C38',
    maxHeight: '92%',
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
    paddingBottom: 28,
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
});
