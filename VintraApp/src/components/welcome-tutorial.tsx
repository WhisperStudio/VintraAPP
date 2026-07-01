import { SymbolView } from 'expo-symbols';
import { useEffect, useState, type ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AuroraSky } from './aurora-sky';

import { useTranslation, type TranslationKey } from '@/lib/i18n';

type SymbolName = NonNullable<ComponentProps<typeof SymbolView>['name']>;

type Step = {
  icon: SymbolName;
  accent: string;
  eyebrowKey?: TranslationKey;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
};

const STEPS: Step[] = [
  {
    icon: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
    accent: '#6ee7c7',
    eyebrowKey: 'onboard_welcome_eyebrow',
    titleKey: 'onboard_welcome_title',
    bodyKey: 'onboard_welcome_body',
  },
  {
    icon: { ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' },
    accent: '#5eead4',
    titleKey: 'onboard_inbox_title',
    bodyKey: 'onboard_inbox_body',
  },
  {
    icon: { ios: 'chart.bar.xaxis', android: 'bar_chart', web: 'bar_chart' },
    accent: '#7dd3fc',
    titleKey: 'onboard_analytics_title',
    bodyKey: 'onboard_analytics_body',
  },
  {
    icon: { ios: 'slider.horizontal.3', android: 'tune', web: 'tune' },
    accent: '#a5b4fc',
    titleKey: 'onboard_settings_title',
    bodyKey: 'onboard_settings_body',
  },
  {
    icon: { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' },
    accent: '#6ee7c7',
    titleKey: 'onboard_ready_title',
    bodyKey: 'onboard_ready_body',
  },
];

function PulseRing({ accent, delay }: { accent: string; delay: number }) {
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 0 }),
        withTiming(1.6, { duration: 2600, easing: Easing.out(Easing.quad) }),
      ),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 0 }),
        withTiming(0, { duration: 2600, easing: Easing.out(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[styles.pulseRing, { borderColor: accent }, style]} />;
}

function ProgressDot({ active, accent }: { active: boolean; accent: string }) {
  const w = useSharedValue(active ? 26 : 8);
  const o = useSharedValue(active ? 1 : 0.35);

  useEffect(() => {
    w.value = withTiming(active ? 26 : 8, { duration: 380, easing: Easing.out(Easing.cubic) });
    o.value = withTiming(active ? 1 : 0.35, { duration: 380 });
  }, [active, o, w]);

  const style = useAnimatedStyle(() => ({
    width: w.value,
    opacity: o.value,
  }));

  return <Animated.View style={[styles.dot, { backgroundColor: accent }, style]} />;
}

export function WelcomeTutorial({
  visible,
  displayName,
  onDone,
}: {
  visible: boolean;
  displayName: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const current = STEPS[step];
  const accent = current.accent;

  const iconScale = useSharedValue(1);

  useEffect(() => {
    iconScale.value = withSequence(
      withTiming(0.82, { duration: 0 }),
      withTiming(1, { duration: 620, easing: Easing.out(Easing.back(1.6)) }),
    );
  }, [step, iconScale]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));

  const handleNext = () => {
    if (isLast) {
      onDone();
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const title = t(current.titleKey).replace('{name}', displayName);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <AuroraSky />
        <View style={styles.scrim} />

        <View style={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
          {/* Skip */}
          <View style={styles.topRow}>
            {!isLast ? (
              <Pressable onPress={onDone} hitSlop={12} style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}>
                <Text style={styles.skipText}>{t('onboard_skip')}</Text>
              </Pressable>
            ) : (
              <View style={styles.skipBtn} />
            )}
          </View>

          {/* Center card */}
          <View style={styles.center}>
            <View style={styles.iconWrap}>
              <PulseRing accent={accent} delay={0} />
              <Animated.View style={[styles.iconCircle, { borderColor: `${accent}55`, shadowColor: accent }, iconStyle]}>
                <View style={[styles.iconInner, { backgroundColor: `${accent}22` }]}>
                  <SymbolView name={current.icon} size={44} tintColor={accent} />
                </View>
              </Animated.View>
            </View>

            <Animated.View
              key={step}
              entering={FadeInDown.duration(480).easing(Easing.out(Easing.cubic))}
              exiting={FadeOut.duration(160)}
              style={styles.textBlock}>
              {current.eyebrowKey ? (
                <Text style={[styles.eyebrow, { color: accent }]}>{t(current.eyebrowKey).toUpperCase()}</Text>
              ) : (
                <Text style={[styles.eyebrow, { color: accent }]}>
                  {t('onboard_step')} {step + 1} {t('onboard_of')} {STEPS.length}
                </Text>
              )}
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.body}>{t(current.bodyKey)}</Text>
            </Animated.View>
          </View>

          {/* Footer */}
          <Animated.View entering={FadeIn.duration(400)} style={styles.footer}>
            <View style={styles.dots}>
              {STEPS.map((s, i) => (
                <ProgressDot key={i} active={i === step} accent={i === step ? s.accent : '#ffffff'} />
              ))}
            </View>

            <View style={styles.buttonRow}>
              {!isFirst ? (
                <Pressable onPress={handleBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
                  <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={18} tintColor="#cfe8e0" />
                  <Text style={styles.backText}>{t('onboard_back')}</Text>
                </Pressable>
              ) : (
                <View style={styles.backSpacer} />
              )}

              <Pressable
                onPress={handleNext}
                style={({ pressed }) => [styles.nextBtn, { shadowColor: accent }, pressed && styles.nextPressed]}>
                <Text style={styles.nextText}>{isLast ? t('onboard_start') : t('onboard_next')}</Text>
                <SymbolView
                  name={isLast
                    ? { ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }
                    : { ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                  size={18}
                  tintColor="#04121c"
                />
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#020610',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,16,0.35)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 26,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    minHeight: 32,
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  skipText: {
    color: '#cfe1ee',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 34,
  },
  iconWrap: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.5,
  },
  iconCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 26,
    elevation: 12,
  },
  iconInner: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.4,
    marginBottom: 12,
  },
  title: {
    color: '#f4fbff',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginBottom: 14,
    textShadowColor: 'rgba(110,231,199,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  body: {
    color: '#b9cdda',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 340,
  },
  footer: {
    gap: 24,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 10,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  backText: {
    color: '#cfe8e0',
    fontSize: 15,
    fontWeight: '700',
  },
  backSpacer: {
    width: 64,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    backgroundColor: '#6ee7c7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 10,
  },
  nextPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  nextText: {
    color: '#04121c',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pressed: {
    opacity: 0.7,
  },
});
