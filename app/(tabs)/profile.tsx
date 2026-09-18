import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { generateProgram, type GeneratedProgram, type WorkoutSplitType } from '@/lib/programGenerator';
import { defaultOnboarding, loadOnboarding, type OnboardingData } from '@/store/workoutStore';

const goalLabels: Record<OnboardingData['goal'], string> = {
  build_muscle: 'Build Muscle',
  get_stronger: 'Get Stronger',
  lose_fat: 'Lose Fat',
  recomposition: 'Recomposition',
};

const experienceLabels: Record<OnboardingData['experience'], string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

function renderSplit(splitType: WorkoutSplitType) {
  switch (splitType) {
    case 'upper_lower':
      return <Text style={styles.program}>Upper <Text style={styles.accent}>·</Text> Lower</Text>;
    case 'full_body':
      return <Text style={styles.program}>Full Body</Text>;
    case 'push_pull_legs':
      return <Text style={styles.program}>Push <Text style={styles.accent}>·</Text> Pull <Text style={styles.accent}>·</Text> Legs</Text>;
  }
}

const account = ['Subscription', 'Restore Purchase', 'Privacy', 'Support'];

export default function Profile() {
  const [onboarding, setOnboarding] = useState<OnboardingData>(defaultOnboarding);
  const [program, setProgram] = useState<GeneratedProgram>(() => generateProgram(defaultOnboarding));

  useEffect(() => {
    loadOnboarding().then((data) => {
      const next = data ?? defaultOnboarding;
      setOnboarding(next);
      setProgram(generateProgram(next));
    });
  }, []);

  const restMinutes = Math.floor((program.defaultRestSeconds ?? 150) / 60).toString().padStart(2, '0');
  const restSeconds = ((program.defaultRestSeconds ?? 150) % 60).toString().padStart(2, '0');
  const preferences = [
    ['Units', 'kg'],
    ['Rest Timer', `${restMinutes}:${restSeconds}`],
    ['Notifications', 'On'],
  ];

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{onboarding.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.name}>{onboarding.name.toUpperCase()}</Text>
          <Text style={styles.meta}>
            {experienceLabels[onboarding.experience] ?? 'Intermediate'}  •  {goalLabels[onboarding.goal] ?? 'Build Muscle'}
          </Text>
        </View>
      </View>
      <Card style={styles.training}>
        <Text style={styles.label}>TRAINING</Text>
        <View style={styles.trainingRow}>
          {renderSplit(program.splitType)}
          <Text style={styles.days}>{program.daysPerWeek} days / week</Text>
        </View>
      </Card>
      <Text style={styles.section}>PREFERENCES</Text>
      <Card>
        {preferences.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{value}  ›</Text>
          </View>
        ))}
      </Card>
      <Text style={styles.section}>ACCOUNT</Text>
      <Card>
        {account.map((label) => (
          <View key={label} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>›</Text>
          </View>
        ))}
      </Card>
      <Text style={styles.version}>SPOT 1.0.0</Text>
    </Screen>
  );
}
const styles = StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxl }, avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }, avatarText: { color: colors.background, fontSize: 24, fontWeight: '900' }, name: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: 1 }, meta: { color: colors.secondary, marginTop: 5 }, training: { marginBottom: spacing.xxl }, label: { color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, trainingRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: spacing.lg }, program: { color: colors.text, fontSize: 22, fontWeight: '800' }, accent: { color: colors.primary }, days: { color: colors.secondary, fontSize: 13 }, section: { color: colors.secondary, fontSize: 11, letterSpacing: 1.3, fontWeight: '800', marginBottom: spacing.md }, row: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }, rowLabel: { color: colors.text, fontSize: 15, fontWeight: '600' }, rowValue: { color: colors.secondary, fontSize: 14 }, version: { color: colors.muted, textAlign: 'center', fontSize: 11, marginTop: spacing.xxl } });
