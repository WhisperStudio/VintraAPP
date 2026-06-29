import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Modal, StyleSheet, View } from 'react-native';
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

import { AuroraSky } from './aurora-sky';

const BRAND = ['V', 'I', 'N', 'T', 'R', 'A'];

function Letter({ char, delay }: { char: string; delay: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 320 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 13, stiffness: 140 }));
  }, [delay, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.Text style={[styles.letter, style]}>{char}</Animated.Text>;
}

function LoaderDots() {
  return (
    <View style={styles.loaderRow}>
      {[0, 1, 2].map((i) => (
        <LoaderDot key={i} delay={i * 220} />
      ))}
    </View>
  );
}

function LoaderDot({ delay }: { delay: number }) {
  const v = useSharedValue(0.3);

  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 460, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.3, { duration: 460, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );
  }, [delay, v]);

  const style = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.7 + v.value * 0.4 }] }));

  return <Animated.View style={[styles.loaderDot, style]} />;
}

function SplashAnimation({ onDone }: { onDone: () => void }) {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.45);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.7);
  const overlayOpacity = useSharedValue(1);
  const overlayTranslateY = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withDelay(220, withTiming(1, { duration: 460 }));
    logoScale.value = withDelay(220, withSpring(1, { damping: 10, stiffness: 70 }));

    glowOpacity.value = withDelay(380, withTiming(0.5, { duration: 600 }));
    glowScale.value = withDelay(
      380,
      withRepeat(
        withSequence(
          withTiming(1.25, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.9, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );

    const hide = setTimeout(() => {
      overlayOpacity.value = withTiming(0, { duration: 560, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(onDone)();
      });
      overlayTranslateY.value = withTiming(-28, { duration: 560, easing: Easing.in(Easing.cubic) });
    }, 3000);

    return () => clearTimeout(hide);
  }, [glowOpacity, glowScale, logoOpacity, logoScale, onDone, overlayOpacity, overlayTranslateY]);

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

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <AuroraSky />

      <Animated.View style={[styles.glow, glowStyle]} />

      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <View style={styles.logoBackground}>
          <Image source={require('@/images/logo.png')} style={styles.logoImage} contentFit="contain" />
        </View>
      </Animated.View>

      <View style={styles.brandRow}>
        {BRAND.map((char, i) => (
          <Letter key={i} char={char} delay={760 + i * 70} />
        ))}
      </View>

      <LoaderDots />
    </Animated.View>
  );
}

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <SplashAnimation onDone={() => setVisible(false)} />
    </Modal>
  );
}

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <View style={styles.iconBackground}>
        <Image source={require('@/images/logo.png')} style={styles.logoImage} contentFit="contain" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#040a17',
    zIndex: 2000,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(45,212,191,0.16)',
  },
  loaderRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  loaderDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#6ee7c7',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBackground: {
    width: 170,
    height: 132,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 164,
    height: 126,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  letter: {
    color: '#f4fbff',
    fontSize: 42,
    lineHeight: 50,
    fontWeight: '900',
    letterSpacing: 8,
    textShadowColor: 'rgba(110,231,199,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
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
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
