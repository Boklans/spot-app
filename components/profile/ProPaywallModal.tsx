import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import { hapticError, hapticLight, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useSubscriptionStore } from '@/store/subscriptionStore';

interface ProPaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenPrivacy?: () => void;
}

export function ProPaywallModal({
  visible,
  onClose,
  onOpenPrivacy,
}: ProPaywallModalProps) {
  const { language } = useI18n();
  const isUk = language === 'uk';

  const {
    isPro,
    isLoading,
    packages,
    purchase,
    restore,
  } = useSubscriptionStore();

  const [selectedPkgIndex, setSelectedPkgIndex] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  const selectedPackage = packages[selectedPkgIndex] ?? packages[0] ?? null;

  const handlePurchase = async () => {
    if (!selectedPackage) {
      // If running without live products yet, show friendly feedback
      hapticLight();
      Alert.alert(
        isUk ? 'Налаштування підписки' : 'Subscription Setup',
        isUk
          ? 'Продукти ще проходять активацію в Google Play Console. Як тільки Google верифікує профіль, підписка стане доступною.'
          : 'Products are currently being activated in Google Play Console. Once verified by Google, purchases will be live.'
      );
      return;
    }

    setActionLoading(true);
    try {
      const result = await purchase(selectedPackage);
      if (result.success) {
        hapticSuccess();
        Alert.alert(
          isUk ? 'Вітаємо в SPOT PRO! 🎉' : 'Welcome to SPOT PRO! 🎉',
          isUk
            ? 'Усі преміум-можливості успішно розблоковано.'
            : 'All premium features are now unlocked.'
        );
        onClose();
      } else if (!result.userCancelled && result.error) {
        hapticError();
        Alert.alert(
          isUk ? 'Помилка покупки' : 'Purchase Error',
          result.error
        );
      }
    } catch (err: any) {
      hapticError();
      Alert.alert(
        isUk ? 'Помилка' : 'Error',
        err?.message || (isUk ? 'Не вдалося здійснити покупку' : 'Failed to complete purchase')
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    setActionLoading(true);
    try {
      const result = await restore();
      if (result.success && result.isPro) {
        hapticSuccess();
        Alert.alert(
          isUk ? 'Успішно відновлено!' : 'Purchases Restored!',
          isUk
            ? 'Ваш SPOT PRO статус активний.'
            : 'Your SPOT PRO status is active.'
        );
        onClose();
      } else if (result.success && !result.isPro) {
        hapticLight();
        Alert.alert(
          isUk ? 'Підписок не знайдено' : 'No Subscriptions Found',
          isUk
            ? 'Активних підписок SPOT PRO для цього акаунта не виявлено.'
            : 'No active SPOT PRO subscriptions found for this store account.'
        );
      } else {
        hapticError();
        Alert.alert(
          isUk ? 'Помилка відновлення' : 'Restore Failed',
          result.error || (isUk ? 'Спробуйте пізніше' : 'Please try again later')
        );
      }
    } catch (err: any) {
      hapticError();
      Alert.alert(
        isUk ? 'Помилка' : 'Error',
        err?.message || (isUk ? 'Не вдалося відновити покупки' : 'Failed to restore purchases')
      );
    } finally {
      setActionLoading(false);
    }
  };

  const features = isUk
    ? [
        { title: 'Безлімітні власні програми', desc: 'Створюйте будь-яку кількість тренувальних сплітів' },
        { title: 'Глибока аналітика прогресу', desc: 'Оцінка 1RM, обʼєм навантаження та динаміка сили' },
        { title: 'Розумні рекомендації ваги', desc: 'Адаптивна прогресія для кожного робочого підходу' },
        { title: 'Хмарна синхронізація', desc: 'Безпечне збереження історії на всіх ваших пристроях' },
        { title: 'Пріоритетна підтримка', desc: 'Прямий звʼязок з розробниками VanzaLabs' },
      ]
    : [
        { title: 'Unlimited Custom Programs', desc: 'Create and organize unlimited training splits' },
        { title: 'Deep Strength Analytics', desc: '1RM estimates, weekly volume & strength trends' },
        { title: 'Smart Weight Suggestions', desc: 'Adaptive progression for every working set' },
        { title: 'Cloud Sync & Backup', desc: 'Secure history across all your devices' },
        { title: 'Priority Support', desc: 'Direct line to VanzaLabs engineers' },
      ];

  const priceLabel = selectedPackage?.product?.priceString
    ? `${selectedPackage.product.priceString} / ${isUk ? 'рік' : 'year'}`
    : '$49.99 / year';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        {/* Top Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close paywall"
            hitSlop={12}
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
            <View style={styles.brainWrap}>
              <MaterialCommunityIcons name="lightning-bolt" size={32} color={colors.primary} />
            </View>
            <Text style={styles.kicker}>SPOT PRO</Text>
            <Text style={styles.heroTitle}>
              {isUk ? 'ТРЕНУЙТЕСЯ РОЗУМНІШЕ' : 'TRAIN SMARTER'}
            </Text>
            <Text style={styles.heroSub}>
              {isUk
                ? 'Максимізуйте свій ріст завдяки аналітиці та безлімітним програмам'
                : 'Maximize your muscle growth with advanced analytics & unlimited routines'}
            </Text>
          </View>

          {/* Features list */}
          <View style={styles.featureList}>
            <Text style={styles.sectionHeader}>
              {isUk ? 'ЩО ВКЛЮЧАЄ ПІДПИСКА:' : "WHAT'S INCLUDED:"}
            </Text>

            {features.map((feat, idx) => (
              <View key={idx} style={styles.featureRow}>
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={14} color={colors.primary} />
                </View>
                <View style={styles.featureTextWrap}>
                  <Text style={styles.featureTitle}>{feat.title}</Text>
                  <Text style={styles.featureDesc}>{feat.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Pricing Options */}
          {packages.length > 1 ? (
            <View style={styles.packagesContainer}>
              {packages.map((pkg, idx) => {
                const isSelected = selectedPkgIndex === idx;
                return (
                  <Pressable
                    key={pkg.identifier}
                    onPress={() => {
                      hapticLight();
                      setSelectedPkgIndex(idx);
                    }}
                    style={[
                      styles.packageCard,
                      isSelected && styles.packageCardSelected,
                    ]}
                  >
                    <Text style={[styles.packageTitle, isSelected && styles.packageTitleSelected]}>
                      {pkg.packageType === 'ANNUAL'
                        ? (isUk ? 'Річна підписка' : 'Annual')
                        : pkg.packageType === 'MONTHLY'
                        ? (isUk ? 'Місячна підписка' : 'Monthly')
                        : pkg.product.title}
                    </Text>
                    <Text style={styles.packagePrice}>
                      {pkg.product.priceString}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.pricingCard}>
              <View style={styles.trialPill}>
                <Text style={styles.trialPillText}>
                  {isUk ? '7 ДНІВ БЕЗКОШТОВНО' : '7 DAYS FREE TRIAL'}
                </Text>
              </View>
              <Text style={styles.pricingMain}>{priceLabel}</Text>
              <Text style={styles.pricingSub}>
                {isUk ? 'Скасувати можна в будь-який момент' : 'Cancel anytime in store settings'}
              </Text>
            </View>
          )}

          {/* Call to action button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start SPOT PRO"
            disabled={actionLoading || isLoading}
            onPress={handlePurchase}
            style={({ pressed }) => [
              styles.ctaBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
              (actionLoading || isLoading) && { opacity: 0.6 },
            ]}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#0B0D0F" />
            ) : (
              <Text style={styles.ctaBtnText}>
                {isUk ? 'Спробувати безкоштовно' : 'Start 7-Day Free Trial'}
              </Text>
            )}
          </Pressable>

          {/* Restore & Policy Links */}
          <View style={styles.footerLinks}>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              disabled={actionLoading}
              onPress={handleRestore}
            >
              <Text style={styles.footerLinkText}>
                {isUk ? 'Відновити покупки' : 'Restore Purchases'}
              </Text>
            </Pressable>

            <Text style={styles.footerDot}>•</Text>

            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                onClose();
                onOpenPrivacy?.();
              }}
            >
              <Text style={styles.footerLinkText}>
                {isUk ? 'Конфіденційність' : 'Privacy Policy'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
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
    paddingTop: 8,
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
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.2)',
    marginTop: 10,
    marginBottom: 20,
  },
  brainWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
  },
  kicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 4,
    textAlign: 'center',
  },
  heroSub: {
    color: '#8E9BAE',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  featureList: {
    width: '100%',
    backgroundColor: '#12161D',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 20,
    gap: 14,
  },
  sectionHeader: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(200, 255, 61, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  featureDesc: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
    lineHeight: 16,
  },
  packagesContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  packageCard: {
    flex: 1,
    backgroundColor: '#12161D',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  packageCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(200, 255, 61, 0.05)',
  },
  packageTitle: {
    color: '#8E9BAE',
    fontSize: 13,
    fontWeight: '700',
  },
  packageTitleSelected: {
    color: '#FFFFFF',
  },
  packagePrice: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  pricingCard: {
    width: '100%',
    backgroundColor: '#12161D',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  trialPill: {
    backgroundColor: 'rgba(200, 255, 61, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.3)',
    marginBottom: 8,
  },
  trialPillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  pricingMain: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  pricingSub: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  ctaBtn: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 16,
  },
  ctaBtnText: {
    color: '#0B0D0F',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  footerLinkText: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footerDot: {
    color: '#4B5565',
    fontSize: 12,
  },
});
