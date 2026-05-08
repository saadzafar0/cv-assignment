import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_FOCAL_LENGTH,
  REAL_CAR_WIDTH_CM,
  STORAGE_KEYS,
} from './constants';

/**
 * Compute the camera focal length (in pixels) from a known object width and
 * its observed pixel width at a known distance. This is the inverse of the
 * pinhole-camera distance formula:
 *
 *     focalLength = (pixelWidth * knownDistance) / realWidth
 *
 * Defaults assume a car bumper at 200 cm.
 */
export function computeFocalLength(
  pixelWidth: number,
  knownDistanceCm: number = 200,
  realWidthCm: number = REAL_CAR_WIDTH_CM,
): number {
  if (pixelWidth <= 0 || realWidthCm <= 0) {
    throw new Error('computeFocalLength: pixelWidth and realWidthCm must be > 0');
  }
  return (pixelWidth * knownDistanceCm) / realWidthCm;
}

/**
 * Load the persisted focal length, falling back to DEFAULT_FOCAL_LENGTH if
 * the user hasn't run calibration yet (or storage is unavailable).
 */
export async function loadFocalLength(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.focalLength);
    if (raw == null) {
      return DEFAULT_FOCAL_LENGTH;
    }
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_FOCAL_LENGTH;
    }
    return parsed;
  } catch {
    return DEFAULT_FOCAL_LENGTH;
  }
}

/** Persist the calibrated focal length so it survives app restarts. */
export async function saveFocalLength(focalLength: number): Promise<void> {
  if (!Number.isFinite(focalLength) || focalLength <= 0) {
    throw new Error('saveFocalLength: must be a positive finite number');
  }
  await AsyncStorage.setItem(STORAGE_KEYS.focalLength, String(focalLength));
}

/** Convert a pixel-space bounding-box width into a real-world distance in cm. */
export function pixelsToDistanceCm(
  pixelWidth: number,
  focalLength: number,
  realWidthCm: number = REAL_CAR_WIDTH_CM,
): number {
  if (pixelWidth <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return (realWidthCm * focalLength) / pixelWidth;
}
