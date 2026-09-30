import React from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useI18n } from '@/lib/i18n';
import { hapticLight, hapticMedium } from '@/lib/haptics';

interface PrivacyPolicyModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PrivacyPolicyModal({ visible, onClose }: PrivacyPolicyModalProps) {
  const { language } = useI18n();
  const isUk = language === 'uk';

  const handleOpenWeb = () => {
    hapticMedium();
    // Default GitHub Pages URL or support site
    Linking.openURL('https://boklans.github.io/spot-app/privacy.html').catch(() => {
      Linking.openURL('mailto:vanzalabs@gmail.com?subject=SPOT%20Privacy%20Inquiry');
    });
  };

  const handleContactSupport = () => {
    hapticMedium();
    Linking.openURL('mailto:vanzalabs@gmail.com?subject=SPOT%20Support%20Request');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
            <Text style={styles.title}>
              {isUk ? 'Політика конфіденційності' : 'Privacy Policy'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            onPress={() => {
              hapticLight();
              onClose();
            }}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={24} color="#8E9BAE" />
          </Pressable>
        </View>

        {/* Scrollable Content */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>SPOT 1.0.0 • GDPR & Google Play Compliant</Text>
            </View>
          </View>

          <Text style={styles.paragraph}>
            {isUk
              ? 'Ваша конфіденційність та безпека даних є нашим найвищим пріоритетом. SPOT («ми», «наш сервіс») розроблено так, щоб ви мали 100% контроль над своїми тренувальними даними.'
              : 'Your privacy and data security are our top priorities. SPOT is engineered to ensure you have 100% ownership and control over your training records.'}
          </Text>

          {/* Section 1 */}
          <Text style={styles.sectionHeader}>
            {isUk ? '1. Які дані ми збираємо' : '1. Information We Collect'}
          </Text>
          <Text style={styles.paragraph}>
            {isUk
              ? '• Дані облікового запису: адреса електронної пошти для захищеної хмарної синхронізації (Supabase Auth).\n• Дані тренувань: історія підходів, повторень, робоча вага, таймери відпочинку, власні програми та вправи.\n• Параметри тіла (опціонально): зріст, динаміка ваги тіла та обрані одиниці (кг/фунти) для розрахунку прогресу.\n• Діагностичні логи: знеособлені технічні дані для виправлення помилок та стабільності.'
              : '• Account Information: Email address managed securely through Supabase Auth for cloud sync.\n• Workout Records: Logged sets, reps, weight values, rest intervals, custom routines, and templates.\n• Body Metrics (Optional): Body weight logs, height, and preferred units (kg/lbs) to calibrate volume.\n• Diagnostics: Anonymous technical logs to guarantee crash-free app performance.'}
          </Text>

          {/* Section 2 */}
          <Text style={styles.sectionHeader}>
            {isUk ? '2. Використання даних' : '2. How Data is Used'}
          </Text>
          <Text style={styles.paragraph}>
            {isUk
              ? 'Дані використовуються виключно для функціоналу додатка: генерації тренувальних планів, розрахунку прогресивного перевантаження (PRs), відстеження обсягу навантаження та надійного збереження історії тренувань.'
              : 'Data is strictly utilized to power core app features: adaptive program calibration, progressive overload tracking (PRs), volume analytics, and secure cross-device synchronization.'}
          </Text>

          {/* Section 3 */}
          <Text style={styles.sectionHeader}>
            {isUk ? '3. Жодного продажу або передачі даних' : '3. Zero Third-Party Selling'}
          </Text>
          <Text style={styles.paragraph}>
            {isUk
              ? 'Ми ніколи не продаємо, не здаємо в оренду та не передаємо ваші персональні чи тренувальні дані брокерам даних або стороннім рекламним компаніям. У додатку SPOT відсутня стороння реклама.'
              : 'We do not sell, rent, or trade your personal or fitness records to data brokers, advertisers, or third-party marketing platforms. SPOT contains zero third-party ads.'}
          </Text>

          {/* Section 4 */}
          <Text style={styles.sectionHeader}>
            {isUk ? '4. Видалення акаунта та ваших даних' : '4. Account & Data Deletion'}
          </Text>
          <Text style={styles.paragraph}>
            {isUk
              ? 'Згідно з правилами Google Play та GDPR, ви можете у будь-який момент видалити всі свої дані безпосередньо у додатку (Профіль → Небезпечна зона → Скинути дані / Видалити акаунт) або надіславши запит на vanzalabs@gmail.com.'
              : 'In full accordance with Google Play Developer Policies and GDPR, you have the right to permanently purge all your data inside the app (Profile → Danger Zone → Reset App Data / Delete Account) or by requesting deletion at vanzalabs@gmail.com.'}
          </Text>

          {/* Action buttons */}
          <View style={styles.btnRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Web Policy"
              onPress={handleOpenWeb}
              style={styles.webBtn}
            >
              <Ionicons name="open-outline" size={16} color="#0B0D0F" />
              <Text style={styles.webBtnText}>
                {isUk ? 'Відкрити веб-версію' : 'Open Web Version'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Contact Support"
              onPress={handleContactSupport}
              style={styles.supportBtn}
            >
              <Ionicons name="mail-outline" size={16} color={colors.primary} />
              <Text style={styles.supportBtnText}>
                {isUk ? 'Підтримка (Email)' : 'Contact Support'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0D0F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  badgeRow: {
    marginBottom: 16,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sectionHeader: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    flexWrap: 'wrap',
  },
  webBtn: {
    flex: 1,
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  webBtnText: {
    color: '#0B0D0F',
    fontSize: 14,
    fontWeight: '800',
  },
  supportBtn: {
    flex: 1,
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#15191F',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  supportBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
