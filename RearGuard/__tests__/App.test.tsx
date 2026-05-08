/**
 * The full App tree pulls in native modules (vision-camera, fast-tflite,
 * reanimated, …) that aren't available in the Jest jsdom env. We instead
 * unit-test the pure helpers that drive the distance/zone logic, since
 * those are the algorithmic core of RearGuard.
 *
 * @format
 */

import {
  computeFocalLength,
  pixelsToDistanceCm,
} from '../src/utils/calibration';
import {
  DEFAULT_FOCAL_LENGTH,
  REAL_CAR_WIDTH_CM,
} from '../src/utils/constants';

describe('calibration math', () => {
  test('computeFocalLength inverts the pinhole formula', () => {
    // A 170 cm bumper appearing 200 px wide at 200 cm should yield
    // focalLength = 200 * 200 / 170 ~= 235.29
    const focal = computeFocalLength(200, 200, 170);
    expect(focal).toBeCloseTo(235.294, 2);
  });

  test('pixelsToDistance round-trips with computeFocalLength', () => {
    // Calibrate at 200 cm with some pixel width, then assert we recover the distance.
    const knownDistanceCm = 200;
    const pixelWidth = 320;
    const focal = computeFocalLength(pixelWidth, knownDistanceCm, REAL_CAR_WIDTH_CM);
    const recovered = pixelsToDistanceCm(pixelWidth, focal, REAL_CAR_WIDTH_CM);
    expect(recovered).toBeCloseTo(knownDistanceCm, 4);
  });

  test('default focal length is sane (non-zero, finite)', () => {
    expect(DEFAULT_FOCAL_LENGTH).toBeGreaterThan(0);
    expect(Number.isFinite(DEFAULT_FOCAL_LENGTH)).toBe(true);
  });
});
