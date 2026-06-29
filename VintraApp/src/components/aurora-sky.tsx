import { useMemo, useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

function rand(seed: number) {
  const x = Math.sin(seed * 99.731) * 43758.5453;
  return x - Math.floor(x);
}

// Vertical color gradient slices: green base -> teal mid -> blue-violet top.
// Each slice is a thin horizontal band; stacked they form one ray.
const SLICES = 18;
const SLICE_COLORS = Array.from({ length: SLICES }, (_, i) => {
  const t = i / (SLICES - 1);
  if (t < 0.25) return `rgba(80,255,150,${0.15 + t * 0.8})`;
  if (t < 0.5) return `rgba(60,240,180,${0.35 + (0.5 - t) * 0.5})`;
  if (t < 0.75) return `rgba(70,200,255,${0.25 + (0.75 - t) * 0.3})`;
  return `rgba(140,130,255,${0.08 + (1 - t) * 0.15})`;
});
const SLICE_OPACITY = Array.from({ length: SLICES }, (_, i) => {
  const t = i / (SLICES - 1);
  return Math.pow(1 - t, 0.6) * 0.9 + 0.1;
});

type RaySpec = {
  leftPct: number;
  width: number;
  height: number;
  peak: number;
  delay: number;
  baseOffset: number;
  wavePhase: number;
  waveAmp: number;
};

function buildRays(count: number, arcAmp: number, seedBase: number): RaySpec[] {
  const rays: RaySpec[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const r1 = rand(seedBase + i * 1.7);
    const r2 = rand(seedBase + i * 3.3);
    const r3 = rand(seedBase + i * 5.1);
    const r4 = rand(seedBase + i * 7.9);
    rays.push({
      leftPct: t * 100,
      width: 14 + r1 * 26,
      height: 120 + r2 * 200,
      peak: 0.35 + r4 * 0.5,
      delay: Math.floor(r1 * 3000),
      baseOffset: Math.sin(Math.PI * t) * arcAmp + (r2 - 0.5) * 16,
      wavePhase: r3 * Math.PI * 2,
      waveAmp: 8 + r4 * 22,
    });
  }
  return rays;
}

function Ray({ spec }: { spec: RaySpec }) {
  const shimmer = useSharedValue(0.4);
  const grow = useSharedValue(0.9);
  const sway = useSharedValue(0);

  useEffect(() => {
    const up = 1600 + Math.round(rand(spec.leftPct + 1) * 2000);
    const down = 1800 + Math.round(rand(spec.leftPct + 2) * 2200);
    shimmer.value = withDelay(
      spec.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: up, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.35, { duration: down, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    grow.value = withDelay(
      spec.delay,
      withRepeat(
        withSequence(
          withTiming(1.12, { duration: up + 500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.88, { duration: down + 300, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    sway.value = withDelay(
      spec.delay,
      withRepeat(
        withTiming(1, { duration: 5000 + Math.round(rand(spec.leftPct + 3) * 4000), easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [grow, shimmer, sway, spec.delay, spec.leftPct]);

  const animatedStyle = useAnimatedStyle(() => {
    const wave = Math.sin(spec.wavePhase + sway.value * Math.PI * 2) * spec.waveAmp;
    return {
      opacity: shimmer.value * spec.peak,
      transform: [
        { translateX: wave },
        { scaleY: grow.value },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ray,
        {
          left: `${spec.leftPct}%`,
          width: spec.width,
          height: spec.height,
          bottom: spec.baseOffset,
          marginLeft: -spec.width / 2,
        },
        animatedStyle,
      ]}>
      {SLICE_COLORS.map((color, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            backgroundColor: color,
            opacity: SLICE_OPACITY[i],
          }}
        />
      ))}
    </Animated.View>
  );
}

function AuroraBand({
  topPct,
  height,
  rays,
  drift,
  skew,
  duration,
  delay,
}: {
  topPct: number;
  height: number;
  rays: RaySpec[];
  drift: number;
  skew: number;
  duration: number;
  delay: number;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [delay, duration, t]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: -drift + t.value * drift * 2 },
      { skewX: `${-skew + t.value * skew * 2}deg` },
    ],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.band, { top: `${topPct}%`, height }, style]}>
      {rays.map((spec, i) => (
        <Ray key={i} spec={spec} />
      ))}
    </Animated.View>
  );
}

// Diffuse glow blobs that sit at the base of the aurora — the bright horizon.
function BaseGlow({ leftPct, width, color, delay, duration }: { leftPct: number; width: number; color: string; delay: number; duration: number }) {
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: duration + 800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true,
    ));
  }, [delay, duration, pulse]);

  const style = useAnimatedStyle(() => ({ opacity: pulse.value * 0.6 }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.baseGlow,
        { left: `${leftPct}%`, width, height: width * 0.5, marginLeft: -width / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

const STAR_SEEDS = [
  { top: '4%', left: '12%', size: 2, delay: 0 },
  { top: '8%', left: '76%', size: 2, delay: 500 },
  { top: '12%', left: '38%', size: 1.5, delay: 1000 },
  { top: '5%', left: '58%', size: 2, delay: 1500 },
  { top: '16%', left: '88%', size: 1.5, delay: 800 },
  { top: '10%', left: '24%', size: 2.5, delay: 1900 },
  { top: '18%', left: '6%', size: 1.5, delay: 1200 },
  { top: '3%', left: '46%', size: 2, delay: 2300 },
  { top: '14%', left: '66%', size: 2, delay: 350 },
  { top: '20%', left: '92%', size: 1.5, delay: 700 },
  { top: '7%', left: '34%', size: 1.5, delay: 1600 },
  { top: '11%', left: '4%', size: 2, delay: 1100 },
] as const;

function Star({ top, left, size, delay }: { top: string; left: string; size: number; delay: number }) {
  const twinkle = useSharedValue(0.2);
  useEffect(() => {
    twinkle.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.15, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      ),
      -1, true,
    ));
  }, [delay, twinkle]);
  const style = useAnimatedStyle(() => ({ opacity: twinkle.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.star, { top: top as any, left: left as any, width: size, height: size, borderRadius: size }, style]}
    />
  );
}

export function AuroraSky() {
  const frontRays = useMemo(() => buildRays(22, 36, 11), []);
  const backRays = useMemo(() => buildRays(16, 28, 47), []);

  return (
    <View pointerEvents="none" style={styles.root}>
      <View style={styles.skyDeep} />
      <View style={styles.skyMid} />

      {STAR_SEEDS.map((s, i) => (
        <Star key={i} top={s.top} left={s.left} size={s.size} delay={s.delay} />
      ))}

      {/* Diffuse base glow near horizon */}
      <View style={styles.horizonBand}>
        <BaseGlow leftPct={20} width={240} color="rgba(50,255,140,0.12)" delay={0} duration={4000} />
        <BaseGlow leftPct={50} width={300} color="rgba(60,240,180,0.1)" delay={800} duration={5000} />
        <BaseGlow leftPct={78} width={260} color="rgba(80,220,255,0.08)" delay={1600} duration={4500} />
      </View>

      {/* Back curtain — dimmer, cooler colors */}
      <View style={styles.screenBlend}>
        <AuroraBand topPct={12} height={280} rays={backRays} drift={22} skew={4} duration={10000} delay={600} />
      </View>

      {/* Front curtain — brighter, green-dominant */}
      <View style={styles.screenBlend}>
        <AuroraBand topPct={8} height={340} rays={frontRays} drift={30} skew={6} duration={8000} delay={0} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#020610',
  },
  skyDeep: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#030a18',
  },
  skyMid: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
    backgroundColor: 'rgba(6,16,32,0.5)',
  },
  horizonBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '28%',
    height: 200,
  },
  baseGlow: {
    position: 'absolute',
    bottom: 0,
    borderRadius: 999,
    ...Platform.select({
      ios: { shadowColor: '#3eff8b', shadowOpacity: 1, shadowRadius: 60 },
      default: {},
    }),
  },
  screenBlend: {
    ...StyleSheet.absoluteFillObject,
    ...Platform.select({
      web: { mixBlendMode: 'screen' as any },
      default: {},
    }),
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  ray: {
    position: 'absolute',
    transformOrigin: 'bottom',
    borderRadius: 16,
    overflow: 'hidden',
    // Soft blur on iOS to diffuse hard edges into glowing light
    ...Platform.select({
      ios: { shadowColor: '#50ff96', shadowOpacity: 0.8, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
      default: {},
    }),
  },
  star: {
    position: 'absolute',
    backgroundColor: '#eaf4ff',
  },
});
