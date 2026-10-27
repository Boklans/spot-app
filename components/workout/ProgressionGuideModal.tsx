import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { hapticLight, hapticMedium } from '@/lib/haptics';

interface ProgressionGuideModalProps {
  visible: boolean;
  onClose: () => void;
  language: string;
}

export function ProgressionGuideModal({
  visible,
  onClose,
  language,
}: ProgressionGuideModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isUk = language === 'uk';
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.kickerBadge}>
                <Ionicons name="trending-up" size={12} color={colors.primaryText} />
                <Text style={styles.kickerText}>
                  {isUk ? 'АДАПТИВНИЙ АЛГОРИТМ SPOT' : 'SPOT ADAPTIVE ENGINE'}
                </Text>
              </View>
              <Text style={styles.title}>
                {isUk ? 'Як працює прогресія?' : 'How Progression Works'}
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
              <Ionicons name="close" size={22} color={colors.secondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            {/* Card 0: How starting weight is determined */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primaryMuted }]}>
                  <Ionicons name="speedometer-outline" size={18} color={colors.primaryText} />
                </View>
                <Text style={styles.cardTitle}>
                  {isUk ? '0. Як визначається стартова вага?' : '0. How Is Starting Weight Set?'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isUk
                  ? 'SPOT розраховує стартову вагу на основі вашого профілю або останнього тренування:'
                  : 'SPOT calculates starting weight from your profile or previous session:'}
              </Text>
              <View style={styles.bulletList}>
                <View style={styles.bulletItem}>
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.bulletText}>
                    {isUk
                      ? 'З онбордингу: якщо ви вказували вагу в жимі, присіданні чи тязі — SPOT розраховує робочі ваги під кожну вправу на базі 1RM.'
                      : 'From onboarding: if you entered baseline lifts, SPOT calculates target working weights via 1RM formulas.'}
                  </Text>
                </View>
                <View style={styles.bulletItem}>
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.bulletText}>
                    {isUk
                      ? 'Калібрувальна вага: для нових вправ система ставить безпечний базовий мінімум під вашу стать, вагу тіла та досвід.'
                      : 'Calibration weight: for new exercises, SPOT sets a safe baseline for your gender, bodyweight, and experience.'}
                  </Text>
                </View>
                <View style={styles.bulletItem}>
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.bulletText}>
                    {isUk
                      ? 'Ручна зміна: якщо вага не підходить — просто натисніть на неї в таблиці та змініть. Алгоритм одразу підхопить вашу фактичну вагу!'
                      : 'Manual adjust: if the weight feels off, tap it in the table to edit. The algorithm instantly adopts your actual weight.'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Card 1: Double Progression */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <Ionicons name="repeat" size={18} color={colors.primaryText} />
                </View>
                <Text style={styles.cardTitle}>
                  {isUk
                    ? '1. Спочатку повторення, потім вага'
                    : '1. Reps First, Weight Second'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isUk
                  ? 'Замість того щоб щоразу ризикувати технікою й додавати вагу, SPOT використовує метод Подвійної Прогресії (наприклад, у діапазоні 8–12 повторень):'
                  : 'Instead of adding weight every session at the expense of form, SPOT uses Double Progression (e.g. within an 8–12 rep range):'}
              </Text>
              <View style={styles.stepPillList}>
                <View style={styles.stepRow}>
                  <Text style={styles.stepBadge}>КРОК 1</Text>
                  <Text style={styles.stepRowText}>
                    {isUk
                      ? 'Виконали 40 кг × 8/8/8 → наступного разу ціль 40 кг × 9 у всіх підходах.'
                      : 'Hit 40 kg × 8/8/8 → next session target is 40 kg × 9 across all sets.'}
                  </Text>
                </View>
                <View style={styles.stepRow}>
                  <Text style={[styles.stepBadge, { backgroundColor: colors.primary, color: '#0B0D0F' }]}>
                    КРОК 2
                  </Text>
                  <Text style={styles.stepRowText}>
                    {isUk
                      ? 'Коли виконаєте 12/12/12 у всіх підходах — SPOT підвищить вагу до 42.5 кг і поверне ціль до 8 повторень.'
                      : 'Once you hit 12/12/12 on all sets — SPOT increases weight to 42.5 kg and resets target reps to 8.'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Card 2: What if I miss reps? */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.14)' }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#38BDF8" />
                </View>
                <Text style={styles.cardTitle}>
                  {isUk
                    ? '2. Що робити, якщо не витягнув ціль?'
                    : '2. What If I Miss Target Reps?'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isUk
                  ? 'Завжди вказуйте фактичну кількість чистих повторень (натисніть «−» або саме число):'
                  : 'Always log your actual clean reps (tap "−" or the number itself):'}
              </Text>
              <View style={styles.bulletList}>
                <View style={styles.bulletItem}>
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.bulletText}>
                    {isUk
                      ? 'Не вистачило 1–2 повторень в останньому підході (напр. 8/8/7 або 10/9/9): це нормальна втома. Алгоритм збереже поточну вагу, щоб ви спокійно закріпили її наступного разу.'
                      : 'Missed 1–2 reps on the final set (e.g. 8/8/7 or 10/9/9): normal fatigue. SPOT keeps your current weight to consolidate next time.'}
                  </Text>
                </View>
                <View style={styles.bulletItem}>
                  <View style={[styles.dot, { backgroundColor: '#38BDF8' }]} />
                  <Text style={styles.bulletText}>
                    {isUk
                      ? 'Пропустили підхід через брак часу: система не вважає це відмовою і не штрафує зниженням ваги, але попросить виконати всі підходи перед підвищенням.'
                      : 'Skipped a set due to time: SPOT will not penalize you with a deload, but will wait until all sets are completed before increasing weight.'}
                  </Text>
                </View>
                <View style={styles.bulletItem}>
                  <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.bulletText}>
                    {isUk
                      ? 'Вага заважка у всіх підходах (напр. 6/5/5): алгоритм автоматично знизить вагу на 1 крок на наступне тренування для відновлення чистої техніки.'
                      : 'Weight too heavy across all sets (e.g. 6/5/5): SPOT automatically reduces weight by 1 step next session so you can rebuild clean form.'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Card 3: Dumbbells & Gravitron */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(168, 85, 247, 0.14)' }]}>
                  <MaterialCommunityIcons name="dumbbell" size={18} color="#C084FC" />
                </View>
                <Text style={styles.cardTitle}>
                  {isUk
                    ? '3. Як рахувати гантелі та гравітрон?'
                    : '3. Dumbbells & Assisted Machines'}
                </Text>
              </View>
              <View style={styles.bulletList}>
                <View style={styles.bulletItem}>
                  <View style={[styles.dot, { backgroundColor: '#C084FC' }]} />
                  <Text style={styles.bulletText}>
                    {isUk
                      ? 'Гантелі: завжди вказується вага ОДНІЄЇ гантелі (якщо берете дві гантелі по 14 кг — записуйте 14 кг).'
                      : 'Dumbbells: always enter the weight of ONE single dumbbell (if using two 14 kg dumbbells, log 14 kg).'}
                  </Text>
                </View>
                <View style={styles.bulletItem}>
                  <View style={[styles.dot, { backgroundColor: '#C084FC' }]} />
                  <Text style={styles.bulletText}>
                    {isUk
                      ? 'Гравітрон (Assisted Pull-up / Dip): записується вага ПРОТИВАГИ. Чим менша противага — тим важче виконувати вправу (прогресія зменшує противагу).'
                      : 'Assisted Machines (Gravitron): enter the COUNTERWEIGHT. Less counterweight = harder exercise (progression reduces assistance weight).'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Card 4: RIR & Intensity */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.14)' }]}>
                  <Ionicons name="flame-outline" size={18} color="#F87171" />
                </View>
                <Text style={styles.cardTitle}>
                  {isUk ? '4. Що таке RIR (Запас сил)?' : '4. What Is RIR (Reps In Reserve)?'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isUk
                  ? 'RIR показує, скільки повторень ви могли б зробити до повної відмови. Ви можете вказати його при редагуванні підходу:'
                  : 'RIR tracks how many reps you had left in the tank before failure. Log it anytime when editing a set:'}
              </Text>
              <View style={styles.bulletList}>
                <View style={styles.bulletItem}>
                  <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.bulletText}>
                    {isUk
                      ? '0 RIR (Відмова): останнє повторення на межі сил, жодного більше зробити не вдалося б.'
                      : '0 RIR (Failure): true muscular failure, 0 clean reps left in the tank.'}
                  </Text>
                </View>
                <View style={styles.bulletItem}>
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.bulletText}>
                    {isUk
                      ? '1–2 RIR (Оптимально): золотий стандарт для гіпертрофії — максимальний стимул росту мʼязів без перевантаження ЦНС.'
                      : '1–2 RIR (Hypertrophy Sweet Spot): maximum muscle growth stimulus with manageable recovery cost.'}
                  </Text>
                </View>
                <View style={styles.bulletItem}>
                  <View style={[styles.dot, { backgroundColor: '#38BDF8' }]} />
                  <Text style={styles.bulletText}>
                    {isUk
                      ? '3+ RIR: розминочний підхід або легкий сет на закріплення техніки.'
                      : '3+ RIR: warm-up set or light technique-building set.'}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                hapticMedium();
                onClose();
              }}
              style={({ pressed }) => [
                styles.gotItBtn,
                pressed && { opacity: 0.88 },
              ]}
            >
              <Ionicons name="checkmark-circle" size={18} color="#0B0D0F" style={{ marginRight: 6 }} />
              <Text style={styles.gotItText}>
                {isUk ? 'Зрозуміло, продовжуємо' : 'Got It, Continue'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  kickerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  kickerText: {
    color: colors.primaryText,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 18,
    paddingBottom: 32,
    gap: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  cardBody: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  stepPillList: {
    gap: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.elevated,
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  stepBadge: {
    backgroundColor: colors.surface,
    color: colors.primaryText,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 1,
  },
  stepRowText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    flex: 1,
  },
  bulletList: {
    gap: 10,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  bulletText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 18 : 22,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  gotItBtn: {
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gotItText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
});

