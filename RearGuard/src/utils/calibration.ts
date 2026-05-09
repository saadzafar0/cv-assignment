import { DEFAULT_REAL_WIDTH_CM, REAL_WIDTHS_CM } from './constants';

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
  realWidthCm: number = 170,
): number {
  if (pixelWidth <= 0 || realWidthCm <= 0) {
    throw new Error('computeFocalLength: pixelWidth and realWidthCm must be > 0');
  }
  return (pixelWidth * knownDistanceCm) / realWidthCm;
}

/** Convert a pixel-space bounding-box width into a real-world distance in cm. */
export function pixelsToDistanceCm(
  pixelWidth: number,
  focalLength: number,
  realWidthCm: number = 170,
): number {
  if (pixelWidth <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return (realWidthCm * focalLength) / pixelWidth;
}

/**
 * Look up the real-world width (in cm) for a COCO label.
 * Falls back to DEFAULT_REAL_WIDTH_CM for unknown / '???' classes.
 */
export function realWidthForLabel(label: string): number {
  return REAL_WIDTHS_CM[label] ?? DEFAULT_REAL_WIDTH_CM;
}
