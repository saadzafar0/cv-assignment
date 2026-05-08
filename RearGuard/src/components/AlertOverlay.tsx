import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ZONE_COLORS, type Zone } from '../utils/constants';

interface AlertOverlayProps {
  zone: Zone;
}

/**
 * A full-screen, pointer-event-transparent overlay that pulses a thick red
 * border whenever the zone is `danger`. Driven entirely on the UI thread by
 * Reanimated, so it stays smooth even while the JS thread is busy decoding
 * detections.
 */
export function AlertOverlay({ zone }: AlertOverlayProps): React.ReactElement | null {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (zone === 'danger') {
      opacity.value = withRepeat(
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(opacity);
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [zone, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (zone !== 'danger') {
    // Still render so cleanup runs cleanly; opacity is 0.
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.overlay,
        { borderColor: ZONE_COLORS.danger },
        animatedStyle,
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
