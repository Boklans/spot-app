import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';

interface BetaAccessModalProps {
  visible: boolean;
  onClose: () => void;
}

export function BetaAccessModal({ visible, onClose }: BetaAccessModalProps) {
  const { language } = useI18n();
  const isUk = language === 'uk';
  const insets = useSafeAreaInsets();

  const handleOpenTelegram = async () => {
    hapticMedium();
    const url = 'https://t.me/vanzalabs';
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
    } catch {}
  };

  const handleOpenPlayStore = async () => {
    hapticMedium();
    const url = 'https://play.google.com/store/apps/details?id=com.vanzalabs.spot';
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
    } catch {}
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.safe}>
        {/* Top Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            onPress={onClose}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* Hero Card */}
          <View style={styles.heroCard}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="rocket-launch" size={32} color={colors.primary} />
            </View>
            <View style={styles.betaBadge}>
              <Text style={styles.betaBadgeText}>
                {isUk ? 'РАННІЙ ДОСТУП' : 'EARLY BETA ACCESS'}
              </Text>
            </View>
            <Text style={styles.heroTitle}>
              {isUk ? 'Ви серед перших атлетів SPOT!' : 'You are an Early SPOT Pioneer!'}
            </Text>
            <Text style={styles.heroSub}>
              {isUk
                ? 'На етапі бета-тестування всі функції додатку (розумна прогресія ваги, таймери, аналітика та тренувальні програми) доступні для вас на 100% безкоштовно.'
                : 'During the beta testing phase, all app capabilities (smart progressive overload, workout analytics, routines, and rest timers) are 100% free with zero limits.'}
            </Text>
          </View>

          {/* Benefits List */}
          <View style={styles.perksCard}>
            <Text style={styles.perksHeader}>
              {isUk ? 'ВАШІ БЕТА-ПРИВІЛЕЇ:' : 'YOUR BETA PRIVILEGES:'}
            </Text>

            {[
              {
                title: isUk ? 'Повний безлімітний функціонал' : 'Full Unlimited Access',
                desc: isUk ? 'Жодних прихованих блокувань або платних барʼєрів' : 'No paywalls or locked features during beta',
              },
              {
                title: isUk ? 'Прямий контакт з розробниками' : 'Direct Line to Developers',
                desc: isUk ? 'Ваші побажання та зауваження втілюються в оновленнях' : 'Your feedback directly drives weekly updates',
              },
              {
                title: isUk ? 'Ранні нові фічі' : 'Early Feature Previews',
                desc: isUk ? 'Першими тестуйте нові інструменти для залу' : 'Test brand new gym tools before public release',
              },
            ].map((item, idx) => (
              <View key={idx} style={styles.perkRow}>
                <View style={styles.checkWrap}>
                  <Ionicons name="checkmark" size={15} color={colors.primary} />
                </View>
                <View style={styles.perkTextWrap}>
                  <Text style={styles.perkTitle}>{item.title}</Text>
                  <Text style={styles.perkDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Action: Feedback Telegram */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Telegram community"
            onPress={handleOpenTelegram}
            style={({ pressed }) => [styles.telegramBtn, pressed && { opacity: 0.85 }]}
          >
            <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.telegramBtnText}>
              {isUk ? 'Написати відгук у Telegram' : 'Send Feedback in Telegram'}
            </Text>
          </Pressable>

          {/* Action: Google Play Rate */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rate in Google Play"
            onPress={handleOpenPlayStore}
            style={({ pressed }) => [styles.playStoreBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="star" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.playStoreBtnText}>
              {isUk ? 'Оцінити в Google Play' : 'Rate on Google Play'}
            </Text>
          </Pressable>

          {/* Dismiss button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue workout"
            hitSlop={12}
            onPress={onClose}
            style={styles.continueBtn}
          >
            <Text style={styles.continueBtnText}>
              {isUk ? 'Продовжити тренування' : 'Back to App'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0D0F',
  },
  header: {
    paddingHorizontal: 20,
    alignItems: 'flex-end',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#161B22',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  heroCard: {
    width: '100%',
    backgroundColor: '#12161D',
    borderRadius: 24,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
    marginTop: 10,
    marginBottom: 20,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.3)',
  },
  betaBadge: {
    backgroundColor: '#7C5CFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  betaBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: -0.3,
  },
  heroSub: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 10,
  },
  perksCard: {
    width: '100%',
    backgroundColor: '#12161D',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 20,
    gap: 14,
  },
  perksHeader: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(200, 255, 61, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  perkTextWrap: {
    flex: 1,
  },
  perkTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  perkDesc: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
    lineHeight: 16,
  },
  telegramBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2AABEE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#2AABEE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  telegramBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  playStoreBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1A212B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.3)',
    marginBottom: 16,
  },
  playStoreBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  continueBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  continueBtnText: {
    color: '#8E9BAE',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

