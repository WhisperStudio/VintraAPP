import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const BRAND = ['V', 'I', 'N', 'T', 'R', 'A'];

function Letter({ char, delay }: { char: string; delay: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 260 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 13, stiffness: 140 }));
  }, [delay, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.Text style={[styles.letter, style]}>{char}</Animated.Text>;
}

function SplashAnimation({ onDone }: { onDone: () => void }) {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.35);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.6);
  const taglineOpacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(1);
  const overlayTranslateY = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withDelay(180, withTiming(1, { duration: 380 }));
    logoScale.value = withDelay(180, withSpring(1, { damping: 9, stiffness: 70 }));

    glowOpacity.value = withDelay(350, withTiming(0.55, { duration: 500 }));
    glowScale.value = withDelay(350, withRepeat(
      withSequence(
        withTiming(1.28, { duration: 950, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.88, { duration: 950, easing: Easing.inOut(Easing.quad) }),
      ), -1, true,
    ));

    taglineOpacity.value = withDelay(1150, withTiming(1, { duration: 500 }));

    const hide = setTimeout(() => {
      overlayOpacity.value = withTiming(0, { duration: 480, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(onDone)();
      });
      overlayTranslateY.value = withTiming(-24, { duration: 480, easing: Easing.in(Easing.cubic) });
    }, 2550);

    return () => clearTimeout(hide);
  }, [glowOpacity, glowScale, logoOpacity, logoScale, onDone, overlayOpacity, overlayTranslateY, taglineOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    transform: [{ translateY: overlayTranslateY.value }],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <Animated.View style={[styles.glow, glowStyle]} />

      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <View style={styles.logoBackground}>
          <View style={styles.logoMark}>
            <View style={styles.logoBladeLeft} />
            <View style={styles.logoBladeRight} />
            <View style={styles.logoDot} />
          </View>
        </View>
      </Animated.View>

      <View style={styles.brandRow}>
        {BRAND.map((char, i) => (
          <Letter key={i} char={char} delay={650 + i * 65} />
        ))}
      </View>

      <Animated.Text style={[styles.tagline, taglineStyle]}>
        AI-drevet kundesupport
      </Animated.Text>
    </Animated.View>
  );
}

export function AnimatedSplashOverlay() {
  const [splashKey, setSplashKey] = useState(0);
  const [visible, setVisible] = useState(true);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        setVisible(true);
        setSplashKey((k) => k + 1);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <SplashAnimation key={splashKey} onDone={() => setVisible(false)} />
    </Modal>
  );
}

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <View style={styles.iconBackground}>
        <View style={styles.logoMark}>
          <View style={styles.logoBladeLeft} />
          <View style={styles.logoBladeRight} />
          <View style={styles.logoDot} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#06111f',
    zIndex: 2000,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(3,168,78,0.18)',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBackground: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#03a84e',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#03a84e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 28,
    elevation: 12,
  },
  logoMark: {
    width: 52,
    height: 44,
  },
  logoBladeLeft: {
    position: 'absolute',
    left: 3,
    top: 2,
    width: 18,
    height: 40,
    borderRadius: 9,
    backgroundColor: '#ffffff',
    transform: [{ rotateZ: '-29deg' }],
  },
  logoBladeRight: {
    position: 'absolute',
    left: 23,
    top: 2,
    width: 18,
    height: 40,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.7)',
    transform: [{ rotateZ: '29deg' }],
  },
  logoDot: {
    position: 'absolute',
    right: 0,
    top: 4,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  letter: {
    color: '#ffffff',
    fontSize: 42,
    lineHeight: 50,
    fontWeight: '900',
    letterSpacing: 6,
  },
  tagline: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 96,
    height: 96,
  },
  iconBackground: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#03a84e',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
