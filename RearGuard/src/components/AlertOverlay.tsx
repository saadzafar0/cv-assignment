import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { ZONE_COLORS, type Zone } from '../utils/constants';

interface AlertOverlayProps {
  zone: Zone;
}

/**
 * A full-screen, pointer-event-transparent overlay that pulses a thick red
 * border whenever the zone is `danger`. Uses React Native's built-in Animated
 * API with `useNativeDriver: true`, which runs the opacity tween on the UI
 * thread (same effective performance as Reanimated for this case) without
 * needing a worklets babel plugin.
 */
export function AlertOverlay({ zone }: AlertOverlayProps): React.ReactElement {
  const opacity = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loopRef.current?.stop();

    if (zone === 'danger') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      loopRef.current = loop;
      loop.start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      loopRef.current?.stop();
    };
  }, [zone, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.overlay,
        { borderColor: ZONE_COLORS.danger, opacity },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    borderWidth: 12,
    borderRadius: 6,
  },
});
