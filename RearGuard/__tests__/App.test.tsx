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
  realWidthForLabel,
} from '../src/utils/calibration';
import {
  DEFAULT_FOCAL_LENGTH,
  DEFAULT_REAL_WIDTH_CM,
  REAL_WIDTHS_CM,
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
    const realWidth = 170;
    const focal = computeFocalLength(pixelWidth, knownDistanceCm, realWidth);
    const recovered = pixelsToDistanceCm(pixelWidth, focal, realWidth);
    expect(recovered).toBeCloseTo(knownDistanceCm, 4);
  });

  test('default focal length is sane (non-zero, finite)', () => {
    expect(DEFAULT_FOCAL_LENGTH).toBeGreaterThan(0);
    expect(Number.isFinite(DEFAULT_FOCAL_LENGTH)).toBe(true);
  });

  test('default focal length is 763 (derived from ~80° horizontal FOV at 1280px width)', () => {
    expect(DEFAULT_FOCAL_LENGTH).toBe(763);
  });
});

describe('per-class width lookup', () => {
  test('known classes return their specific width', () => {
    expect(realWidthForLabel('car')).toBe(170);
    expect(realWidthForLabel('person')).toBe(45);
    expect(realWidthForLabel('truck')).toBe(250);
    expect(realWidthForLabel('bus')).toBe(260);
    expect(realWidthForLabel('laptop')).toBe(35);
  });

  test('unknown / ??? classes return the default fallback width', () => {
    expect(realWidthForLabel('???')).toBe(DEFAULT_REAL_WIDTH_CM);
    expect(realWidthForLabel('nonexistent_class')).toBe(DEFAULT_REAL_WIDTH_CM);
  });

  test('REAL_WIDTHS_CM has entries for all main COCO classes', () => {
    const mainClasses = ['person', 'car', 'bus', 'truck', 'bicycle', 'motorcycle', 'dog', 'cat'];
    for (const cls of mainClasses) {
      expect(REAL_WIDTHS_CM[cls]).toBeDefined();
      expect(REAL_WIDTHS_CM[cls]).toBeGreaterThan(0);
    }
  });

  test('per-class width changes distance calculation', () => {
    const focalLength = DEFAULT_FOCAL_LENGTH; // 763
    const pixelWidth = 200;
    // Car at 170 cm real width vs person at 45 cm real width
    const carDistance = pixelsToDistanceCm(pixelWidth, focalLength, realWidthForLabel('car'));
    const personDistance = pixelsToDistanceCm(pixelWidth, focalLength, realWidthForLabel('person'));
    // Person should read much closer than car at same pixel width
    expect(personDistance).toBeLessThan(carDistance);
    // Specifically: person = (45 * 763) / 200 = 171.675 cm
    expect(personDistance).toBeCloseTo(171.675, 0);
    // Car = (170 * 763) / 200 = 648.55 cm
    expect(carDistance).toBeCloseTo(648.55, 0);
  });
});
