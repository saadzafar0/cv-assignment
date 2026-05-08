import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ZONE_COLORS, type Zone } from '../utils/constants';

interface DistanceDisplayProps {
  /** Smoothed distance in metres, or null when no object is locked. */
  distanceM: number | null;
  /** Current alert zone (drives the top zone bar colour + label). */
  zone: Zone;
  /** Optional label of the nearest object (e.g. 'car'). */
  nearestLabel?: string | null;
}

const ZONE_LABEL: Record<Zone, string> = {
  safe: 'SAFE',
  caution: 'CAUTION',
  danger: 'DANGER',
};

/**
 * Top zone bar + centred large distance read-out. Pure presentational —
 * receives the smoothed distance + zone from `useDistanceCalc`.
 */
export function DistanceDisplay({
  distanceM,
  zone,
  nearestLabel,
}: DistanceDisplayProps): React.ReactElement {
  const color = ZONE_COLORS[zone];
  const formatted = distanceM != null ? `${distanceM.toFixed(1)} m` : '— m';

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={[styles.zoneBar, { backgroundColor: color }]}>
        <Text style={styles.zoneText}>{ZONE_LABEL[zone]}</Text>
      </View>

      <View style={styles.center}>
        <Text style={[styles.distance, { color }]}>{formatted}</Text>
        <Text style={styles.caption}>NEAREST OBJECT</Text>
        {nearestLabel != null && (
          <Text style={styles.subCaption}>{nearestLabel.toUpperCase()}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  zoneBar: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  zoneText: {
    color: '#0a0a0a',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  distance: {
    fontSize: 96,
    fontWeight: '900',
    letterSpacing: -2,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  caption: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 4,
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowRadius: 4,
  },
  subCaption: {
    color: '#cccccc',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 6,
  },
});
