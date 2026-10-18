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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();

  const {
    isPro,
    isLoading,
    packages,
    purchase,
    restore,
  } = useSubscriptionStore();

  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [actionLoading, setActionLoading] = useState(false);

  const annualPackage = packages.find((p) => p.packageType === 'ANNUAL') || packages.find((p) => p.identifier.toLowerCase().includes('annual') || p.identifier.toLowerCase().includes('year')) || packages[0] || null;
  const monthlyPackage = packages.find((p) => p.packageType === 'MONTHLY') || packages.find((p) => p.identifier.toLowerCase().includes('monthly') || p.identifier.toLowerCase().includes('month')) || packages[1] || null;

  const targetPackage = selectedPlan === 'annual' ? annualPackage : (monthlyPackage || annualPackage);

  const handlePurchase = async () => {
    if (!targetPackage) {
      hapticLight();
      Alert.alert(
        isUk ? 'Налаштування підписки' : 'Subscription Setup',
        isUk
          ? 'Продукти підписки ($4.99/місяць або $49.99/рік з 14-денним тріалом) наразі верифікуються в Google Play Console. Як тільки Google активує профіль, підписка стане доступною.'
          : 'Subscription products ($4.99/month and $49.99/year with 14-day free trial) are currently being verified in Google Play Console.'
      );
      return;
    }

    setActionLoading(true);
    try {
      const result = await purchase(targetPackage);
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.safe}>
        {/* Top Header with Safe Inset */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close paywall"
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

          {/* Pricing Options: Annual with 14-day trial vs Monthly */}
          <View style={styles.planSelectionContainer}>
            {/* Annual Card */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select Annual Plan"
              onPress={() => {
                hapticLight();
                setSelectedPlan('annual');
              }}
              style={[
                styles.planCard,
                selectedPlan === 'annual' && styles.planCardSelected,
              ]}
            >
              <View style={styles.planBadgeRow}>
                <View style={styles.trialPill}>
                  <Text style={styles.trialPillText}>
                    {isUk ? '14 ДНІВ БЕЗКОШТОВНО' : '14 DAYS FREE TRIAL'}
                  </Text>
                </View>
                <View style={styles.savingsPill}>
                  <Text style={styles.savingsPillText}>
                    {isUk ? 'ЗНИЖКА 17%' : 'SAVE 17%'}
                  </Text>
                </View>
              </View>

              <View style={styles.planContentRow}>
                <View style={styles.planLeftCol}>
                  <Text style={styles.planTitle}>
                    {isUk ? 'Річний план' : 'Annual Plan'}
                  </Text>
                  <Text style={styles.planSubtitle}>
                    {isUk ? '$4.16 на місяць ($49.99 на рік)' : '$4.16 / mo ($49.99 billed yearly)'}
                  </Text>
                </View>
                <View style={styles.planPriceCol}>
                  <Text style={styles.planPriceNumber}>
                    {annualPackage?.product?.priceString || '$49.99'}
                  </Text>
                  <Text style={styles.planPricePeriod}>/ {isUk ? 'рік' : 'yr'}</Text>
                </View>
              </View>
            </Pressable>

            {/* Monthly Card */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select Monthly Plan"
              onPress={() => {
                hapticLight();
                setSelectedPlan('monthly');
              }}
              style={[
                styles.planCard,
                selectedPlan === 'monthly' && styles.planCardSelected,
              ]}
            >
              <View style={styles.planContentRow}>
                <View style={styles.planLeftCol}>
                  <Text style={styles.planTitle}>
                    {isUk ? 'Місячний план' : 'Monthly Plan'}
                  </Text>
                  <Text style={styles.planSubtitle}>
                    {isUk ? 'Гнучка помісячна оплата' : 'Flexible monthly billing'}
                  </Text>
                </View>
                <View style={styles.planPriceCol}>
                  <Text style={styles.planPriceNumber}>
                    {monthlyPackage?.product?.priceString || '$4.99'}
                  </Text>
                  <Text style={styles.planPricePeriod}>/ {isUk ? 'міс' : 'mo'}</Text>
                </View>
              </View>
            </Pressable>
          </View>

          {/* Call to action button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={selectedPlan === 'annual' ? 'Start 14-Day Free Trial' : 'Subscribe Monthly'}
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
                {selectedPlan === 'annual'
                  ? (isUk ? 'Спробувати 14 днів безкоштовно' : 'Start 14-Day Free Trial')
                  : (isUk ? 'Оформити за $4.99 / місяць' : 'Subscribe for $4.99 / month')}
              </Text>
            )}
          </Pressable>

          <Text style={styles.legalSubtext}>
            {selectedPlan === 'annual'
              ? (isUk
                  ? 'Перші 14 днів безкоштовно, далі $49.99 на рік. Скасувати можна будь-коли в налаштуваннях Google Play.'
                  : '14 days free trial, then $49.99/year. Cancel anytime in Google Play settings.')
              : (isUk
                  ? '$4.99 щомісяця. Скасувати можна будь-коли в налаштуваннях Google Play.'
                  : '$4.99 billed monthly. Cancel anytime in Google Play settings.')}
          </Text>

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

          {/* Explicit Free Dismiss Option */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with free version"
            hitSlop={12}
            onPress={onClose}
            style={styles.dismissBtn}
          >
            <Text style={styles.dismissBtnText}>
              {isUk ? 'Продовжити безкоштовно' : 'Continue with Free Version'}
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
  planSelectionContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  planCard: {
    width: '100%',
    backgroundColor: '#12161D',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(200, 255, 61, 0.06)',
  },
  planBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  savingsPill: {
    backgroundColor: '#7C5CFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  savingsPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  planContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planLeftCol: {
    flex: 1,
    paddingRight: 10,
  },
  planTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  planSubtitle: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '500',
  },
  planPriceCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  planPriceNumber: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  planPricePeriod: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '600',
  },
  trialPill: {
    backgroundColor: 'rgba(200, 255, 61, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.3)',
  },
  trialPillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  legalSubtext: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
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
  dismissBtn: {
    marginTop: 18,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  dismissBtnText: {
    color: '#8E9BAE',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
