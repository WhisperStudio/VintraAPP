import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function VintraMark({ light = false }: { light?: boolean }) {
  return (
    <View style={styles.logoMark}>
      <View style={[styles.logoBladeLeft, light && styles.logoBladeLight]} />
      <View style={[styles.logoBladeRight, light && styles.logoBladeSoft]} />
      <View style={[styles.logoDot, light && styles.logoDotLight]} />
    </View>
  );
}

function AnimatedBackdrop() {
  const drift = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.cubic) }), -1, true);
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [drift, pulse]);

  const bandOne = useAnimatedStyle(() => ({
    transform: [
      { translateX: -80 + drift.value * 140 },
      { translateY: -30 + drift.value * 40 },
      { rotateZ: '-18deg' },
      { scale: pulse.value },
    ],
  }));

  const bandTwo = useAnimatedStyle(() => ({
    transform: [
      { translateX: 90 - drift.value * 120 },
      { translateY: 70 - drift.value * 50 },
      { rotateZ: '24deg' },
      { scale: 1.04 },
    ],
  }));

  const beam = useAnimatedStyle(() => ({
    opacity: 0.26 + drift.value * 0.18,
    transform: [{ translateX: -260 + drift.value * 520 }, { rotateZ: '16deg' }],
  }));

  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <Animated.View style={[styles.lightBand, bandOne]} />
      <Animated.View style={[styles.blueBand, bandTwo]} />
      <Animated.View style={[styles.scanBeam, beam]} />
      <View style={styles.gridOverlay} />
    </View>
  );
}

function AppPreview() {
  const lift = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    lift.value = withRepeat(withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.quad) }), -1, true);
    glow.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [glow, lift]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -10 + lift.value * 20 }, { rotateZ: `${-2 + lift.value * 4}deg` }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + glow.value * 0.35,
    transform: [{ scale: 0.95 + glow.value * 0.08 }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(240).springify()} style={styles.previewStage}>
      <Animated.View style={[styles.previewGlow, glowStyle]} />
      <Animated.View style={[styles.device, floatStyle]}>
        <View style={styles.deviceTop}>
          <VintraMark light />
          <ThemedText style={styles.deviceTitle}>Vintra</ThemedText>
        </View>

        <View style={styles.heroTile}>
          <ThemedText style={styles.tileLabel}>App preview</ThemedText>
          <ThemedText style={styles.tileTitle}>Launching soon</ThemedText>
        </View>

        <View style={styles.timeline}>
          <View style={styles.timelineItem}>
            <View style={styles.timelineDot} />
            <View style={styles.timelineLineLong} />
          </View>
          <View style={styles.timelineItem}>
            <View style={styles.timelineDotBlue} />
            <View style={styles.timelineLineShort} />
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 760;

  return (
    <ThemedView style={styles.container}>
      <AnimatedBackdrop />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          compact && styles.contentCompact,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.five },
        ]}>
        <Animated.View entering={FadeInUp.delay(80).springify()} style={styles.nav}>
          <View style={styles.brand}>
            <VintraMark light />
            <ThemedText style={styles.brandName}>VINTRA</ThemedText>
          </View>
          <View style={styles.statusPill}>
            <View style={styles.liveDot} />
            <ThemedText style={styles.statusText}>Building</ThemedText>
          </View>
        </Animated.View>

        <View style={[styles.hero, compact && styles.heroCompact]}>
          <Animated.View entering={FadeInUp.delay(160).springify()} style={styles.copy}>
            <ThemedText style={styles.kicker}>Mobile app in development</ThemedText>
            <ThemedText style={[styles.title, compact && styles.titleCompact]}>
              A calmer way to work with Vintra.
            </ThemedText>
            <ThemedText style={styles.lead}>
              Project updates, AI support and launch tools are coming together in one focused app.
            </ThemedText>

            <View style={styles.actions}>
              <AnimatedPressable entering={FadeInDown.delay(360).springify()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <ThemedText style={styles.primaryText}>Get notified</ThemedText>
                <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_right' }} size={15} tintColor="#06111f" />
              </AnimatedPressable>
            </View>
          </Animated.View>

          <AppPreview />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06111f',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  lightBand: {
    position: 'absolute',
    top: 80,
    left: -120,
    width: 520,
    height: 190,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  blueBand: {
    position: 'absolute',
    right: -190,
    bottom: 80,
    width: 620,
    height: 220,
    borderRadius: 54,
    backgroundColor: 'rgba(36,108,255,0.28)',
  },
  scanBeam: {
    position: 'absolute',
    top: -80,
    left: '50%',
    width: 130,
    height: 900,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  contentCompact: {
    paddingHorizontal: Spacing.three,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoMark: {
    width: 38,
    height: 32,
  },
  logoBladeLeft: {
    position: 'absolute',
    left: 1,
    top: 1,
    width: 14,
    height: 31,
    borderRadius: 8,
    backgroundColor: '#0f6eff',
    transform: [{ rotateZ: '-29deg' }],
  },
  logoBladeRight: {
    position: 'absolute',
    left: 16,
    top: 0,
    width: 14,
    height: 31,
    borderRadius: 8,
    backgroundColor: '#10204e',
    transform: [{ rotateZ: '29deg' }],
  },
  logoDot: {
    position: 'absolute',
    right: 0,
    top: 3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#1f7bff',
  },
  logoBladeLight: {
    backgroundColor: '#ffffff',
  },
  logoBladeSoft: {
    backgroundColor: '#98bcff',
  },
  logoDotLight: {
    backgroundColor: '#ffffff',
  },
  brandName: {
    color: '#ffffff',
    fontSize: 17,
    lineHeight: 19,
    fontWeight: '900',
    letterSpacing: 4,
  },
  statusPill: {
    minHeight: 38,
    borderRadius: 19,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7df7c4',
  },
  statusText: {
    color: '#eaf1ff',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  hero: {
    flex: 1,
    minHeight: 560,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.five,
  },
  heroCompact: {
    minHeight: 0,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    maxWidth: 610,
  },
  kicker: {
    color: '#7da8ff',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: Spacing.three,
  },
  title: {
    color: '#ffffff',
    fontSize: 62,
    lineHeight: 65,
    fontWeight: '900',
  },
  titleCompact: {
    fontSize: 42,
    lineHeight: 45,
  },
  lead: {
    color: '#bdc9dc',
    fontSize: 18,
    lineHeight: 29,
    fontWeight: '700',
    marginTop: Spacing.three,
    maxWidth: 530,
  },
  actions: {
    flexDirection: 'row',
    marginTop: Spacing.five,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: '#ffffff',
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    shadowColor: '#79a7ff',
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
  },
  primaryText: {
    color: '#06111f',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.74,
  },
  previewStage: {
    flex: 1,
    minWidth: 300,
    minHeight: 430,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(36,108,255,0.38)',
  },
  device: {
    width: 286,
    borderRadius: 36,
    padding: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000000',
    shadowOpacity: 0.32,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 24 },
  },
  deviceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  deviceTitle: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  heroTile: {
    minHeight: 170,
    borderRadius: 26,
    padding: Spacing.three,
    justifyContent: 'flex-end',
    backgroundColor: '#ffffff',
  },
  tileLabel: {
    color: '#246cff',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  tileTitle: {
    color: '#07111f',
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '900',
    marginTop: 6,
  },
  timeline: {
    gap: 13,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timelineDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  timelineDotBlue: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#7da8ff',
  },
  timelineLineLong: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },
  timelineLineShort: {
    width: '56%',
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
});
