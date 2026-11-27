import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { Band } from '../ledger/contracts';
import { pokeFeedback } from '../feedback/haptic';
import { fonts, useTheme } from '../theme';

const W = 260, H = 230, LINE = 5;
const native = Platform.OS !== 'web';

// Reduced motion turns off the loops and the squash; lines and haptics stay.
function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduce(value); }, () => { if (live) setReduce(true); }); // unknown setting: stay calm
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { live = false; subscription.remove(); };
  }, []);
  return reduce;
}

const box = (left: number, top: number, width: number, height: number, extra: ViewStyle = {}): ViewStyle => ({ position: 'absolute', left, top, width, height, ...extra });
const centered = (cx: number, cy: number, size: number, extra: ViewStyle = {}) => box(cx - size / 2, cy - size / 2, size, size, { borderRadius: size / 2, ...extra });

export function WalletCritter({ band, size = 240, onPoke }: { band: Band; size?: number; onPoke: () => void }) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const sway = useRef({ y: new Animated.Value(0), x: new Animated.Value(0), r: new Animated.Value(0) }).current;
  const squash = useRef({ x: new Animated.Value(1), y: new Animated.Value(1) }).current;
  const pokeAnimation = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => () => pokeAnimation.current?.stop(), []);

  useEffect(() => {
    const { y, x, r } = sway;
    y.setValue(0); x.setValue(0); r.setValue(band === 'exceeded' ? -1 : 0);
    if (reduce) return;
    const move = (value: Animated.Value, to: number, duration: number) => Animated.timing(value, { toValue: to, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: native });
    const loop = Animated.loop(band === 'calm'
      ? Animated.sequence([move(y, -8, 1300), move(y, 0, 1300)])
      : band === 'caution'
        ? Animated.sequence([-3, 3, -2, 2, 0].map(to => move(x, to, 90)))
        : Animated.sequence([move(r, 1, 1400), move(r, -1, 1400)]));
    loop.start();
    return () => loop.stop();
  }, [band, reduce, sway]);

  function poke() {
    pokeFeedback();
    onPoke();
    if (reduce) return;
    const step = (x: number, y: number, duration: number) => Animated.parallel([
      Animated.timing(squash.x, { toValue: x, duration, useNativeDriver: native }),
      Animated.timing(squash.y, { toValue: y, duration, useNativeDriver: native }),
    ]);
    pokeAnimation.current?.stop();
    pokeAnimation.current = Animated.sequence([step(1.18, 0.78, 105), step(0.9, 1.12, 105), step(1, 1, 140)]);
    pokeAnimation.current.start();
  }

  const k = size / W;
  const c = theme.critterLine;
  const line = { borderColor: c, borderWidth: LINE };
  const eye = (cx: number, cy: number, d: number, pupil: number) => <View key={cx} style={centered(cx, cy, d, { backgroundColor: '#FFFFFF', borderColor: c, borderWidth: 4, alignItems: 'center', justifyContent: 'center' })}>
    <View style={{ width: pupil, height: pupil, borderRadius: pupil / 2, backgroundColor: c }} />
  </View>;
  const bill = (left: number, top: number, deg: number, mark = false) => <View key={left} style={box(left, top, 56, 70, { backgroundColor: theme.bill, borderColor: c, borderWidth: 4, borderRadius: 8, transform: [{ rotate: `${deg}deg` }], alignItems: 'center', justifyContent: 'center' })}>
    {mark && <Text style={{ color: c, fontSize: 24, fontFamily: fonts.display, fontWeight: '400' }}>₩</Text>}
  </View>;
  const body = (left: number, top: number, width: number, height: number, radius: number) => <View style={box(left, top, width, height, { backgroundColor: theme.wallet, borderRadius: radius, ...line })} />;
  // U-shaped mouth piece: open on top (smile) or on the bottom (flipped), 5px stroke like the body.
  const arc = (left: number, top: number, width: number, height: number, flip = false) => <View key={left} style={box(left, top, width, height, flip
    ? { borderTopWidth: LINE, borderLeftWidth: LINE, borderRightWidth: LINE, borderTopLeftRadius: height, borderTopRightRadius: height, borderColor: c }
    : { borderBottomWidth: LINE, borderLeftWidth: LINE, borderRightWidth: LINE, borderBottomLeftRadius: height, borderBottomRightRadius: height, borderColor: c })} />;
  const drop = (left: number, top: number) => <View key={left} style={box(left, top, 12, 12, { backgroundColor: theme.tear, borderColor: c, borderWidth: 2, borderRadius: 6, borderTopLeftRadius: 0, transform: [{ rotate: '45deg' }] })} />;

  let art;
  if (band === 'calm') {
    art = <>
      {bill(66, 14, -12, true)}{bill(134, 18, 9)}
      {body(28, 56, 204, 150, 34)}
      <View style={box(33, 104, 194, 5, { backgroundColor: c })} />
      {eye(96, 140, 44, 18)}{eye(164, 140, 44, 18)}
      <View style={box(58, 164, 24, 14, { backgroundColor: theme.blush, borderRadius: 7 })} />
      <View style={box(178, 164, 24, 14, { backgroundColor: theme.blush, borderRadius: 7 })} />
      {arc(110, 166, 40, 20)}
    </>;
  } else if (band === 'caution') {
    art = <>
      {bill(102, 40, 6, true)}
      {body(40, 88, 180, 116, 32)}
      {eye(100, 134, 40, 10)}{eye(160, 134, 40, 10)}
      {[0, 1, 2].map(i => arc(104 + i * 18, i % 2 ? 170 : 172, 18, 9, i % 2 === 1))}
      {drop(44, 70)}{drop(208, 74)}{drop(222, 108)}
    </>;
  } else {
    const lens = (left: number) => <View key={left} style={box(left, 148, 56, 24, { backgroundColor: c, borderRadius: 10 })} />;
    art = <>
      {body(22, 132, 216, 70, 24)}
      {lens(52)}{lens(152)}<View style={box(108, 152, 44, 5, { backgroundColor: c })} />
      <View style={box(76, 172, 6, 34, { backgroundColor: theme.tear })} /><View style={box(178, 172, 6, 34, { backgroundColor: theme.tear })} />
      <View style={box(121, 178, 18, 14, { backgroundColor: c, borderRadius: 9 })} />
      {Array.from({ length: 9 }, (_, i) => <View key={i} style={centered(62 + i * 17, 206 + 14 * (1 - ((i - 4) / 4) ** 2), 8, { backgroundColor: theme.gold })} />)}
      <View style={box(106, 82, 12, 10, { backgroundColor: '#C9C6D3', borderRadius: 6, transform: [{ rotate: '-25deg' }] })} />
      <View style={box(142, 82, 12, 10, { backgroundColor: '#C9C6D3', borderRadius: 6, transform: [{ rotate: '25deg' }] })} />
      <View style={box(118, 86, 24, 14, { backgroundColor: '#8E8A9C', borderRadius: 7 })} />
    </>;
  }

  return <Pressable accessibilityRole="button" accessibilityLabel="지갑이 찌르기" accessibilityHint="지갑이가 한마디 해요" onPress={poke}
    style={{ width: size, height: size * H / W, alignSelf: 'center' }}>
    <Animated.View style={{ width: size, height: size * H / W, transform: [
      { translateY: Animated.multiply(sway.y, k) }, { translateX: Animated.multiply(sway.x, k) },
      { rotate: sway.r.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] }) },
      { scaleX: squash.x }, { scaleY: squash.y },
    ] }}>
      <View style={{ width: W, height: H, transform: [{ scale: k }], transformOrigin: 'top left' }}>{art}</View>
    </Animated.View>
  </Pressable>;
}
