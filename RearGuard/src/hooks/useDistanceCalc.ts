import { useEffect, useRef, useState } from 'react';

import { pixelsToDistanceCm, realWidthForLabel } from '../utils/calibration';
import {
  DANGER_DISTANCE_CM,
  MISS_TOLERANCE,
  SAFE_DISTANCE_CM,
  SMOOTHING_ALPHA,
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
 * and a zone using an exponential moving average (EMA) to suppress jitter
 * without lagging behind movement.
 *
 * Pass `pixelWidth = null` whenever a frame yields no relevant detection.
 * The hook immediately clears the display on the first miss and resets the
 * EMA history after `MISS_TOLERANCE` consecutive misses.
 *
 * @param pixelWidth  Width of the nearest bounding box in frame pixels, or null.
 * @param focalLength Camera focal length in pixels (from FOV auto-compute).
 * @param label       COCO label of the nearest object (drives per-class width lookup).
 * @param tick        Monotonic frame counter — forces recalculation even when
 *                    pixelWidth is numerically identical across consecutive frames.
 */
export function useDistanceCalc(
  pixelWidth: number | null,
  focalLength: number,
  label: string | null,
  tick: number,
): DistanceResult {
  const emaRef = useRef<number | null>(null);
  const missCountRef = useRef(0);
  const [result, setResult] = useState<DistanceResult>({
    distanceCm: null,
    distanceM: null,
    zone: 'safe',
  });

  useEffect(() => {
    if (pixelWidth == null || pixelWidth <= 0) {
      // Immediately clear the displayed distance on the first miss so the
      // user never sees a stale number.
      missCountRef.current += 1;
      if (missCountRef.current >= MISS_TOLERANCE) {
        // After sustained absence, also reset EMA history so the next
        // detection starts fresh.
        emaRef.current = null;
      }
      setResult({ distanceCm: null, distanceM: null, zone: 'safe' });
      return;
    }

    missCountRef.current = 0;

    const realWidth = realWidthForLabel(label ?? '???');
    const sample = pixelsToDistanceCm(pixelWidth, focalLength, realWidth);
    if (!Number.isFinite(sample)) {
      return;
    }

    // Exponential moving average: 60% newest sample, 40% history.
    // Much more responsive than the old equal-weight rolling average
    // while still smoothing single-frame jitter.
    const prev = emaRef.current;
    const smoothed = prev != null
      ? SMOOTHING_ALPHA * sample + (1 - SMOOTHING_ALPHA) * prev
      : sample;
    emaRef.current = smoothed;

    const zone = classifyZone(smoothed);
    setResult({
      distanceCm: smoothed,
      distanceM: Math.round(smoothed) / 100,
      zone,
    });
    // `tick` ensures the effect runs on every new frame even when
    // pixelWidth, focalLength, or label haven't changed numerically.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixelWidth, focalLength, label, tick]);

  return result;
}
