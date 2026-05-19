import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';

const items = ['Project overview', 'AI support', 'Launch timeline'];

function MovingBackground() {
  const move = useSharedValue(0);

  useEffect(() => {
    move.value = withRepeat(withTiming(1, { duration: 7600, easing: Easing.inOut(Easing.cubic) }), -1, true);
  }, [move]);

  const topBand = useAnimatedStyle(() => ({
    transform: [{ translateX: -120 + move.value * 160 }, { rotateZ: '-12deg' }],
  }));

  const bottomBand = useAnimatedStyle(() => ({
    transform: [{ translateX: 100 - move.value * 150 }, { rotateZ: '17deg' }],
  }));

  return (
    <View pointerEvents="none" style={styles.background}>
      <Animated.View style={[styles.topBand, topBand]} />
      <Animated.View style={[styles.bottomBand, bottomBand]} />
    </View>
  );
}

export default function RoadmapScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 720;

  return (
    <ThemedView style={styles.container}>
      <MovingBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + BottomTabInset + Spacing.five },
        ]}>
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.center}>
          <View style={styles.iconBox}>
            <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={28} tintColor="#ffffff" />
          </View>
          <ThemedText style={[styles.title, compact && styles.titleCompact]}>What we are building</ThemedText>
          <ThemedText style={styles.lead}>
            A lightweight client app for better updates, faster support and smoother launches.
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).springify()} style={styles.panel}>
          {items.map((item, index) => (
            <View key={item} style={styles.row}>
              <ThemedText style={styles.step}>0{index + 1}</ThemedText>
              <ThemedText style={styles.rowText}>{item}</ThemedText>
            </View>
          ))}
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06111f',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  topBand: {
    position: 'absolute',
    top: 110,
    left: -170,
    width: 620,
    height: 170,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  bottomBand: {
    position: 'absolute',
    right: -220,
    bottom: 80,
    width: 680,
    height: 210,
    borderRadius: 52,
    backgroundColor: 'rgba(36,108,255,0.25)',
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
  },
  center: {
    alignItems: 'center',
  },
  iconBox: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  title: {
    color: '#ffffff',
    fontSize: 52,
    lineHeight: 57,
    fontWeight: '900',
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 38,
    lineHeight: 42,
  },
  lead: {
    color: '#bdc9dc',
    fontSize: 18,
    lineHeight: 29,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 560,
    marginTop: Spacing.three,
  },
  panel: {
    borderRadius: 28,
    padding: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  row: {
    minHeight: 68,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginBottom: Spacing.two,
  },
  step: {
    color: '#7da8ff',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  rowText: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
});
