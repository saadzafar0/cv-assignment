import { useEffect, useRef, useState } from 'react';

import { pixelsToDistanceCm } from '../utils/calibration';
import {
  DANGER_DISTANCE_CM,
  REAL_CAR_WIDTH_CM,
  SAFE_DISTANCE_CM,
  SMOOTHING_WINDOW,
  type Zone,
} from '../utils/constants';

export interface DistanceResult {
  /** Smoothed distance in centimetres, or null if no detection is currently held. */
  distanceCm: number | null;
  /** Smoothed distance rounded to one decimal in metres, for display. */
  distanceM: number | null;
  /** The current alert zone derived from `distanceCm`. */
  zone: Zone;
}

function classifyZone(distanceCm: number | null): Zone {
  if (distanceCm == null) return 'safe';
  if (distanceCm < DANGER_DISTANCE_CM) return 'danger';
  if (distanceCm <= SAFE_DISTANCE_CM) return 'caution';
  return 'safe';
}

/**
 * Convert the nearest-object pixel width into a smoothed real-world distance
 * and a zone, using a rolling average over the last `SMOOTHING_WINDOW`
 * non-null samples to suppress jitter from the detector.
 *
 * Pass `pixelWidth = null` whenever a frame yields no relevant detection;
 * the hook will treat sustained absence as "Safe" and reset the buffer.
 */
export function useDistanceCalc(
  pixelWidth: number | null,
  focalLength: number,
  realWidthCm: number = REAL_CAR_WIDTH_CM,
): DistanceResult {
  const bufferRef = useRef<number[]>([]);
  const missCountRef = useRef(0);
  const [result, setResult] = useState<DistanceResult>({
    distanceCm: null,
    distanceM: null,
    zone: 'safe',
  });

  useEffect(() => {
    if (pixelWidth == null || pixelWidth <= 0) {
      // After a few consecutive misses, drop the smoothing buffer so we
      // don't display a stale distance.
      missCountRef.current += 1;
      if (missCountRef.current >= SMOOTHING_WINDOW) {
        bufferRef.current = [];
        setResult({ distanceCm: null, distanceM: null, zone: 'safe' });
      }
      return;
    }

    missCountRef.current = 0;
    const sample = pixelsToDistanceCm(pixelWidth, focalLength, realWidthCm);
    if (!Number.isFinite(sample)) {
      return;
    }

    const buffer = bufferRef.current;
    buffer.push(sample);
    if (buffer.length > SMOOTHING_WINDOW) {
      buffer.shift();
    }

    const sum = buffer.reduce((acc, v) => acc + v, 0);
    const smoothed = sum / buffer.length;
    const zone = classifyZone(smoothed);
    setResult({
      distanceCm: smoothed,
      distanceM: Math.round(smoothed) / 100,
      zone,
    });
  }, [pixelWidth, focalLength, realWidthCm]);

  return result;
}
