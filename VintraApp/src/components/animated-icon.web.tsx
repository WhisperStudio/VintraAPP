import { StyleSheet, View } from 'react-native';
import Animated, { Keyframe, Easing } from 'react-native-reanimated';

import classes from './animated-icon.module.css';
const DURATION = 300;

export function AnimatedSplashOverlay() {
  return null;
}

const keyframe = new Keyframe({
  0: {
    transform: [{ scale: 0 }],
  },
  60: {
    transform: [{ scale: 1.2 }],
    easing: Easing.elastic(1.2),
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(1.2),
  },
});

const logoKeyframe = new Keyframe({
  0: {
    opacity: 0,
  },
  60: {
    transform: [{ scale: 1.2 }],
    opacity: 0,
    easing: Easing.elastic(1.2),
  },
  100: {
    transform: [{ scale: 1 }],
    opacity: 1,
    easing: Easing.elastic(1.2),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '-180deg' }, { scale: 0.8 }],
    opacity: 0,
  },
  [DURATION / 1000]: {
    transform: [{ rotateZ: '0deg' }, { scale: 1 }],
    opacity: 1,
    easing: Easing.elastic(0.7),
  },
  100: {
    transform: [{ rotateZ: '7200deg' }],
  },
});

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Animated.View entering={glowKeyframe.duration(60 * 1000 * 4)} style={styles.glow}>
        <View style={styles.glowShape} />
      </Animated.View>

      <Animated.View style={styles.background} entering={keyframe.duration(DURATION)}>
        <div className={classes.expoLogoBackground} />
      </Animated.View>

      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <View style={styles.logoMark}>
          <View style={styles.logoBladeLeft} />
          <View style={styles.logoBladeRight} />
          <View style={styles.logoDot} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    zIndex: 1000,
    position: 'absolute',
    top: 128 / 2 + 138,
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  glowShape: {
    width: 201,
    height: 201,
    borderRadius: 100,
    backgroundColor: 'rgba(36, 108, 255, 0.14)',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
  },
  background: {
    width: 128,
    height: 128,
    position: 'absolute',
  },
  logoMark: {
    width: 70,
    height: 58,
  },
  logoBladeLeft: {
    position: 'absolute',
    left: 4,
    top: 3,
    width: 24,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    transform: [{ rotateZ: '-29deg' }],
  },
  logoBladeRight: {
    position: 'absolute',
    left: 31,
    top: 2,
    width: 24,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#dbe8ff',
    transform: [{ rotateZ: '29deg' }],
  },
  logoDot: {
    position: 'absolute',
    right: 0,
    top: 5,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
});
