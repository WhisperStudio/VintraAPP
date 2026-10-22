import { memo, useEffect, useId } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Filter,
  FeGaussianBlur,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const random = (seed: number) => {
  const n = Math.sin(seed * 127.1) * 43758.5453;
  return n - Math.floor(n);
};
const stars = Array.from({ length: 72 }, (_, i) => ({
  x: random(i + 1) * 1000,
  y: random(i + 91) * 650,
  r: 0.45 + random(i + 34) * 1.1,
}));
// Thin filaments follow a continuous, folded lower edge. Oxygen green is brightest
// at the base; the much fainter violet emission fades upward into the night sky.
function curtain(seed: number) {
  return Array.from({ length: 110 }, (_, i) => {
    const x = i * 10 - 50;
    const base =
      330 + Math.sin(i * 0.047 + seed) * 95 + Math.sin(i * 0.13 + seed) * 24;
    const height = 115 + random(i + seed * 9) * 120;
    const bend = 34 * Math.sin(i * 0.047 + seed);
    return {
      d: `M ${x} ${base} C ${x + bend * 0.3} ${base - 45} ${x + bend} ${base - height * 0.7} ${x + bend + 22} ${base - height}`,
      opacity: 0.13 + random(i + seed) * 0.29,
      width: 5 + random(i + seed * 4) * 8,
    };
  });
}
const near = curtain(1);
const far = curtain(4);

function AuroraLayer({ distant = false }: { distant?: boolean }) {
  const id = useId().replace(/:/g, '');
  const phase = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const start = () => {
      if (!reduceMotion)
        phase.value = withRepeat(
          withTiming(1, {
            duration: distant ? 22000 : 17000,
            easing: Easing.inOut(Easing.sin),
          }),
          -1,
          true,
        );
    };
    start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else cancelAnimation(phase);
    });
    return () => {
      subscription.remove();
      cancelAnimation(phase);
    };
  }, [distant, phase, reduceMotion]);
  const drift = useAnimatedStyle(() => ({
    opacity: distant ? 0.36 : 0.65 + phase.value * 0.18,
    transform: [
      { translateX: phase.value * (distant ? -18 : 24) },
      { translateY: phase.value * 9 },
      { scaleY: 1 + phase.value * 0.07 },
    ],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, drift]}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 1000 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <Filter
            id={`${id}-soft`}
            x="-20%"
            y="-30%"
            width="140%"
            height="160%"
          >
            <FeGaussianBlur stdDeviation="3" />
          </Filter>
          <Filter
            id={`${id}-glow`}
            x="-20%"
            y="-50%"
            width="140%"
            height="200%"
          >
            <FeGaussianBlur stdDeviation="14" />
          </Filter>
          <LinearGradient id={`${id}-rays`} x1="0" y1="0" x2="0.15" y2="1">
            <Stop offset="0" stopColor="#9470df" stopOpacity="0" />
            <Stop offset="0.23" stopColor="#9373d8" stopOpacity="0.07" />
            <Stop offset="0.55" stopColor="#42dca9" stopOpacity="0.24" />
            <Stop offset="0.87" stopColor="#68f5ad" stopOpacity="0.72" />
            <Stop offset="1" stopColor="#a1ffb7" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id={`${id}-veil`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#397cc0" stopOpacity="0" />
            <Stop offset="0.5" stopColor="#2ad797" stopOpacity="0.025" />
            <Stop offset="0.9" stopColor="#65ffb0" stopOpacity="0.13" />
            <Stop offset="1" stopColor="#65ffb0" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path
          d={
            distant
              ? 'M -80 290 Q 160 100 400 260 T 1080 210 L 1080 80 Q 650 0 400 95 T -80 60 Z'
              : 'M -80 370 Q 180 520 460 310 T 1080 360 L 1080 95 Q 700 0 460 95 T -80 140 Z'
          }
          fill={`url(#${id}-veil)`}
          filter={`url(#${id}-glow)`}
        />
        <Path
          d={
            distant
              ? 'M -50 250 C 200 160 400 360 650 270 S 850 180 1100 240'
              : 'M -50 375 C 180 475 340 390 480 285 S 800 265 1100 360'
          }
          fill="none"
          stroke="#67edaf"
          strokeWidth={30}
          opacity={0.1}
          filter={`url(#${id}-glow)`}
        />
        <G filter={`url(#${id}-soft)`}>
          {(distant ? far : near).map((ray, index) => (
            <Path
              key={index}
              d={ray.d}
              fill="none"
              stroke={`url(#${id}-rays)`}
              strokeWidth={ray.width}
              opacity={ray.opacity}
              strokeLinecap="round"
            />
          ))}
        </G>
      </Svg>
    </Animated.View>
  );
}

export const AuroraSky = memo(function AuroraSky() {
  const id = useId().replace(/:/g, '');
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.root}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 1000 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <RadialGradient id={`${id}-sky`} cx="48%" cy="40%" rx="65%" ry="60%">
            <Stop offset="0" stopColor="#102b33" />
            <Stop offset="0.5" stopColor="#081723" />
            <Stop offset="1" stopColor="#030914" />
          </RadialGradient>
          <LinearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#030914" stopOpacity="0" />
            <Stop offset="1" stopColor="#030914" />
          </LinearGradient>
        </Defs>
        <Rect width="1000" height="900" fill={`url(#${id}-sky)`} />
        {stars.map((star, i) => (
          <Circle
            key={i}
            cx={star.x}
            cy={star.y}
            r={star.r}
            fill="#d9edff"
            opacity={0.15 + random(i + 9) * 0.45}
          />
        ))}
      </Svg>
      <AuroraLayer distant />
      <AuroraLayer />
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox="0 0 1000 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient
            id={`${id}-foreground-fade`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <Stop offset="0" stopColor="#030914" stopOpacity="0" />
            <Stop offset="1" stopColor="#030914" />
          </LinearGradient>
        </Defs>
        <Path
          d="M 0 800 L 95 735 L 165 770 L 270 680 L 350 740 L 460 705 L 590 780 L 690 720 L 820 775 L 920 695 L 1000 745 L 1000 900 L 0 900 Z"
          fill="#030914"
          opacity="0.7"
        />
        <Rect
          y="520"
          width="1000"
          height="380"
          fill={`url(#${id}-foreground-fade)`}
        />
      </Svg>
    </View>
  );
});
const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#030914',
    overflow: 'hidden',
  },
});
