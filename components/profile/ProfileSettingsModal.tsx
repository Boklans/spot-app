import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { cardElevation, useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { hapticLight } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import type { UserProfile } from '@/store/userProfileStore';

export type ProfilePickerType = 'goal' | 'experience' | 'workoutsPerWeek' | 'split';

interface ProfileSettingsModalProps {
  visible: boolean;
  profile: UserProfile;
  isAuthenticated: boolean;
  currentSplitLabel: string;
  translateGoal: (goal: string) => string;
  translateExperience: (exp: string) => string;
  translateSplit: (split: string) => string;
  onClose: () => void;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onToggleNotifications: (enabled: boolean) => void;
  onOpenRestPicker: () => void;
  onOpenReminderTimePicker?: () => void;
  onOpenPicker: (picker: ProfilePickerType) => void;
  onOpenPrivacy: () => void;
  onContactSupport: () => void;
  onRestartOnboarding: () => void;
  onResetAll: () => void;
}

export function ProfileSettingsModal({
  visible,
  profile,
  isAuthenticated,
  currentSplitLabel,
  translateGoal,
  translateExperience,
  translateSplit,
  onClose,
  onUpdateProfile,
  onToggleNotifications,
  onOpenRestPicker,
  onOpenReminderTimePicker,
  onOpenPicker,
  onOpenPrivacy,
  onContactSupport,
  onRestartOnboarding,
  onResetAll,
}: ProfileSettingsModalProps) {
  const { t, language } = useI18n();
  const isUk = language === 'uk';
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const restLabel = `${Math.floor(profile.defaultRestSeconds / 60)}:${(
    profile.defaultRestSeconds % 60
  )
    .toString()
    .padStart(2, '0')}`;

  return (
    <BottomSheet visible={visible} onClose={onClose} backgroundColor={colors.background} maxHeight="88%">
      <View style={styles.header}>
            <Text style={styles.title}>
              {isUk ? 'Налаштування застосунку' : 'App Preferences'}
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.sectionTitle}>{t('preferences')}</Text>
            <View style={styles.card}>
              {/* Weight Unit */}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  hapticLight();
                  onUpdateProfile({ weightUnit: profile.weightUnit === 'kg' ? 'lbs' : 'kg' });
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name="barbell-outline" size={20} color={colors.secondary} />
                  <View>
                    <Text style={styles.rowTitle}>{t('weightUnit')}</Text>
                    <Text style={styles.rowSubtitle}>
                      {profile.weightUnit === 'kg'
                        ? isUk
                          ? 'Кілограми (кг)'
                          : 'Kilograms (kg)'
                        : isUk
                          ? 'Фунти (lbs)'
                          : 'Pounds (lbs)'}
                    </Text>
                  </View>
                </View>
                <View style={styles.segmentWrap}>
                  {(['kg', 'lbs'] as const).map((u) => (
                    <Pressable
                      key={u}
                      onPress={() => {
                        hapticLight();
                        onUpdateProfile({ weightUnit: u });
                      }}
                      style={[styles.segmentBtn, profile.weightUnit === u && styles.segmentBtnActive]}
                    >
                      <Text
                        style={[
                          styles.segmentBtnText,
                          profile.weightUnit === u && styles.segmentBtnTextActive,
                        ]}
                      >
                        {u.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Pressable>

              {/* Height Unit */}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  hapticLight();
                  onUpdateProfile({ heightUnit: profile.heightUnit === 'cm' ? 'ft' : 'cm' });
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name="resize-outline" size={20} color={colors.secondary} />
                  <View>
                    <Text style={styles.rowTitle}>{t('heightUnit')}</Text>
                    <Text style={styles.rowSubtitle}>
                      {profile.heightUnit === 'cm'
                        ? isUk
                          ? 'Сантиметри (см)'
                          : 'Centimeters (cm)'
                        : isUk
                          ? 'Фути та дюйми (ft)'
                          : 'Feet & Inches (ft)'}
                    </Text>
                  </View>
                </View>
                <View style={styles.segmentWrap}>
                  {(['cm', 'ft'] as const).map((u) => (
                    <Pressable
                      key={u}
                      onPress={() => {
                        hapticLight();
                        onUpdateProfile({ heightUnit: u });
                      }}
                      style={[styles.segmentBtn, profile.heightUnit === u && styles.segmentBtnActive]}
                    >
                      <Text
                        style={[
                          styles.segmentBtnText,
                          profile.heightUnit === u && styles.segmentBtnTextActive,
                        ]}
                      >
                        {u.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Pressable>

              {/* Rest Timer */}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  hapticLight();
                  onOpenRestPicker();
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name="timer-outline" size={20} color={colors.secondary} />
                  <View>
                    <Text style={styles.rowTitle}>{t('restTimerSetting')}</Text>
                    <Text style={styles.rowSubtitle}>
                      {restLabel} {t('min')}
                    </Text>
                  </View>
                </View>
                <View style={styles.valueRow}>
                  <Text style={styles.valuePill}>{restLabel}</Text>
                  <Ionicons name="chevron-forward" size={17} color={colors.muted} />
                </View>
              </Pressable>

              {/* Theme */}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  hapticLight();
                  onUpdateProfile({ theme: profile.theme === 'light' ? 'dark' : 'light' });
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowLeft}>
                  <Ionicons
                    name={profile.theme === 'light' ? 'sunny-outline' : 'moon-outline'}
                    size={20}
                    color={colors.secondary}
                  />
                  <View>
                    <Text style={styles.rowTitle}>{t('theme')}</Text>
                    <Text style={styles.rowSubtitle}>
                      {profile.theme === 'light' ? t('themeLight') : t('themeDark')}
                    </Text>
                  </View>
                </View>
                <View style={styles.segmentWrap}>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      onUpdateProfile({ theme: 'dark' });
                    }}
                    style={[
                      styles.segmentBtn,
                      (profile.theme ?? 'dark') === 'dark' && styles.segmentBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        (profile.theme ?? 'dark') === 'dark' && styles.segmentBtnTextActive,
                      ]}
                    >
                      {t('themeDark')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      onUpdateProfile({ theme: 'light' });
                    }}
                    style={[styles.segmentBtn, profile.theme === 'light' && styles.segmentBtnActive]}
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        profile.theme === 'light' && styles.segmentBtnTextActive,
                      ]}
                    >
                      {t('themeLight')}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>

              {/* Language */}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  hapticLight();
                  onUpdateProfile({ language: profile.language === 'uk' ? 'en' : 'uk' });
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name="globe-outline" size={20} color={colors.secondary} />
                  <View>
                    <Text style={styles.rowTitle}>{t('language')}</Text>
                    <Text style={styles.rowSubtitle}>
                      {profile.language === 'uk' ? 'Українська' : 'English'}
                    </Text>
                  </View>
                </View>
                <View style={styles.segmentWrap}>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      onUpdateProfile({ language: 'uk' });
                    }}
                    style={[styles.segmentBtn, profile.language === 'uk' && styles.segmentBtnActive]}
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        profile.language === 'uk' && styles.segmentBtnTextActive,
                      ]}
                    >
                      УКР
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      onUpdateProfile({ language: 'en' });
                    }}
                    style={[styles.segmentBtn, profile.language === 'en' && styles.segmentBtnActive]}
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        profile.language === 'en' && styles.segmentBtnTextActive,
                      ]}
                    >
                      EN
                    </Text>
                  </Pressable>
                </View>
              </Pressable>

              {/* Notifications */}
              <Pressable
                accessibilityRole="button"
                onPress={() => onToggleNotifications(!profile.notifications)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name="notifications-outline" size={20} color={colors.secondary} />
                  <View>
                    <Text style={styles.rowTitle}>{t('notifications')}</Text>
                    <Text style={styles.rowSubtitle}>
                      {profile.notifications
                        ? isUk
                          ? 'Розумні нагадування'
                          : 'Smart workout reminders'
                        : isUk
                          ? 'Вимкнено'
                          : 'Disabled'}
                    </Text>
                  </View>
                </View>
                <Switch
                  trackColor={{ false: colors.elevated, true: colors.accentLine }}
                  thumbColor="#FFFFFF"
                  {...({ activeThumbColor: colors.onPrimary } as any)}
                  ios_backgroundColor={colors.elevated}
                  onValueChange={onToggleNotifications}
                  value={profile.notifications}
                />
              </Pressable>

              {/* Reminder Time (indented row when notifications are enabled — P2-05) */}
              {profile.notifications && onOpenReminderTimePicker && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    hapticLight();
                    onOpenReminderTimePicker();
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    { paddingLeft: 42 },
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View style={styles.rowLeft}>
                    <Ionicons name="time-outline" size={18} color={colors.secondary} />
                    <Text style={styles.rowTitle}>
                      {isUk ? 'Час нагадувань' : 'Reminder Time'}
                    </Text>
                  </View>
                  <View style={styles.valueRow}>
                    <Text style={styles.valuePill}>{profile.notificationTime || '09:00'}</Text>
                    <Ionicons name="chevron-forward" size={17} color={colors.muted} />
                  </View>
                </Pressable>
              )}

              {/* Sound Effects */}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  hapticLight();
                  onUpdateProfile({ soundEnabled: !profile.soundEnabled });
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name="volume-high-outline" size={20} color={colors.secondary} />
                  <Text style={styles.rowTitle}>{t('soundEffects')}</Text>
                </View>
                <Switch
                  trackColor={{ false: colors.elevated, true: colors.accentLine }}
                  thumbColor="#FFFFFF"
                  {...({ activeThumbColor: colors.onPrimary } as any)}
                  ios_backgroundColor={colors.elevated}
                  onValueChange={(val) => {
                    hapticLight();
                    onUpdateProfile({ soundEnabled: val });
                  }}
                  value={profile.soundEnabled}
                />
              </Pressable>

              {/* Haptic Feedback Toggle (P3-01) */}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onUpdateProfile({ hapticsEnabled: profile.hapticsEnabled === false });
                }}
                style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name="phone-portrait-outline" size={20} color={colors.secondary} />
                  <Text style={styles.rowTitle}>
                    {isUk ? 'Вібровідгук (Haptics)' : 'Haptic Feedback'}
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: colors.elevated, true: colors.accentLine }}
                  thumbColor="#FFFFFF"
                  {...({ activeThumbColor: colors.onPrimary } as any)}
                  ios_backgroundColor={colors.elevated}
                  onValueChange={(val) => {
                    onUpdateProfile({ hapticsEnabled: val });
                    if (val) void hapticLight();
                  }}
                  value={profile.hapticsEnabled !== false}
                />
              </Pressable>
            </View>

            {/* Goal & Program Preferences */}
            <Text style={styles.sectionTitle}>
              {isUk ? 'Ціль та параметри програми' : 'Goal & Program Preferences'}
            </Text>
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button"
                onPress={() => onOpenPicker('goal')}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View>
                  <Text style={styles.rowTitle}>{isUk ? 'Основна ціль' : 'Primary Goal'}</Text>
                  <Text style={styles.rowSubtitle}>{translateGoal(profile.goal)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={colors.muted} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => onOpenPicker('experience')}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View>
                  <Text style={styles.rowTitle}>
                    {isUk ? 'Рівень досвіду' : 'Experience Level'}
                  </Text>
                  <Text style={styles.rowSubtitle}>{translateExperience(profile.experience)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={colors.muted} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => onOpenPicker('workoutsPerWeek')}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View>
                  <Text style={styles.rowTitle}>
                    {isUk ? 'Тренувань на тиждень' : 'Workouts Per Week'}
                  </Text>
                  <Text style={styles.rowSubtitle}>
                    {profile.workoutsPerWeek} {isUk ? 'днів / тиждень' : 'days / week'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={colors.muted} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => onOpenPicker('split')}
                style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
              >
                <View>
                  <Text style={styles.rowTitle}>
                    {isUk ? 'Структура спліту' : 'Training Split'}
                  </Text>
                  <Text style={styles.rowSubtitle}>{translateSplit(currentSplitLabel)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={colors.muted} />
              </Pressable>
            </View>

            {/* Account & Privacy */}
            <Text style={styles.sectionTitle}>{t('account')}</Text>
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  hapticLight();
                  onClose();
                  onOpenPrivacy();
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Text style={styles.rowTitle}>{t('privacy')}</Text>
                <Ionicons name="chevron-forward" size={17} color={colors.muted} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={onContactSupport}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Text style={styles.rowTitle}>{t('support')}</Text>
                <Ionicons name="chevron-forward" size={17} color={colors.muted} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  onRestartOnboarding();
                }}
                style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
              >
                <View>
                  <Text style={[styles.rowTitle, { color: colors.primaryText }]}>
                    {t('restartOnboarding')}
                  </Text>
                  <Text style={styles.rowSubtitle}>{t('restartSubtitle')}</Text>
                </View>
                <Ionicons name="refresh" size={18} color={colors.primaryText} />
              </Pressable>
            </View>

            {/* Danger Zone */}
            <Text style={[styles.sectionTitle, styles.dangerTitle]}>{t('dangerZone')}</Text>
            <View style={[styles.card, styles.dangerCard]}>
              <Pressable
                accessibilityRole="button"
                onPress={onResetAll}
                style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.dangerText}>
                    {isAuthenticated ? t('deleteAccountAndData') : t('resetAppData')}
                  </Text>
                  <Text style={styles.dangerSubText}>
                    {isAuthenticated ? t('deleteAccountSubtitle') : t('resetSubtitle')}
                  </Text>
                </View>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          </ScrollView>
    </BottomSheet>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.78)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      maxHeight: '88%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    title: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      padding: 20,
      paddingBottom: 32,
    },
    sectionTitle: {
      fontFamily: fonts.bold,
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
      marginBottom: 10,
      marginTop: 8,
    },
    dangerTitle: {
      color: colors.danger,
      marginTop: 18,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.md + 2,
      marginBottom: 16,
      overflow: 'hidden',
      ...cardElevation(colors),
    },
    dangerCard: {
      backgroundColor: 'rgba(248, 113, 113, 0.06)',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      minHeight: 58,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowPressed: {
      backgroundColor: colors.elevated,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      paddingRight: 12,
    },
    rowTitle: {
      fontFamily: fonts.semiBold,
      color: colors.text,
      fontSize: 14.5,
      fontWeight: '600',
    },
    rowSubtitle: {
      fontFamily: fonts.regular,
      color: colors.secondary,
      fontSize: 12,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    segmentWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.elevated,
      borderRadius: radii.xs + 2,
      padding: 3,
      width: 108,
    },
    segmentBtn: {
      flex: 1,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 7,
    },
    segmentBtnActive: {
      backgroundColor: colors.activeChipBg,
    },
    segmentBtnText: {
      fontFamily: fonts.bold,
      color: colors.secondary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.3,
      includeFontPadding: false,
    },
    segmentBtnTextActive: {
      color: colors.activeChipText,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    valuePill: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      backgroundColor: colors.elevated,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 7,
      fontVariant: ['tabular-nums'],
    },
    dangerText: {
      fontFamily: fonts.bold,
      color: colors.danger,
      fontSize: 14.5,
      fontWeight: '700',
    },
    dangerSubText: {
      fontFamily: fonts.regular,
      color: colors.secondary,
      fontSize: 12,
      marginTop: 2,
    },
  });
