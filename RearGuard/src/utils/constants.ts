/**
 * Tunable constants for the RearGuard rear-collision system.
 *
 * The pinhole-camera model used here assumes the rear bumper of an average
 * car is ~170 cm wide. If you're aiming the phone at trucks/SUVs, adjust
 * REAL_CAR_WIDTH_CM accordingly (or run the on-device calibration wizard,
 * which absorbs whatever real-world width you point it at into focalLength).
 */

/** Real-world width of an average car bumper in centimetres. */
export const REAL_CAR_WIDTH_CM = 170;

/**
 * Pre-calibrated focal-length estimate (in pixels) used until the user runs
 * the calibration wizard. Reasonable for a typical mid-range Android phone
 * holding 1280x720 at portrait.
 */
export const DEFAULT_FOCAL_LENGTH = 850;

/** Distance thresholds in centimetres (zone boundaries are inclusive of the safer zone). */
export const SAFE_DISTANCE_CM = 500;
export const DANGER_DISTANCE_CM = 200;

/** ML model input geometry (square). */
export const MODEL_INPUT_SIZE = 300;

/** Minimum confidence we accept from the SSD detector. */
export const SCORE_THRESHOLD = 0.5;

/** Camera frame processor target rate. */
export const FRAME_PROCESSOR_FPS = 15;

/** Camera target preview format. */
export const TARGET_RESOLUTION = { width: 1280, height: 720 } as const;

/** Rolling-average window for distance smoothing (in samples / frames). */
export const SMOOTHING_WINDOW = 3;

/** Beep cadence per zone (milliseconds between beeps). */
export const BEEP_INTERVAL_MS = {
  caution: 1000, // 1 Hz
  danger: 333, // ~3 Hz
} as const;

/** Vibration pulse length (ms) when in DANGER. */
export const VIBRATION_DURATION_MS = 200;

/** AsyncStorage keys used by the app. */
export const STORAGE_KEYS = {
  focalLength: '@RearGuard/focalLength',
} as const;

export type Zone = 'safe' | 'caution' | 'danger';

export const ZONE_COLORS: Record<Zone, string> = {
  safe: '#22c55e', // green-500
  caution: '#eab308', // yellow-500
  danger: '#ef4444', // red-500
};

/**
 * COCO labels in the order produced by the
 * `coco_ssd_mobilenet_v1_1.0_quant_2018_06_29` TFLite model.
 *
 * Index 0 is reserved/unused; the labels list intentionally spans 0..90 so
 * a class id from the SSD output can be used as a direct array index.
 */
export const COCO_LABELS: readonly string[] = [
  '???',
  'person',
  'bicycle',
  'car',
  'motorcycle',
  'airplane',
  'bus',
  'train',
  'truck',
  'boat',
  'traffic light',
  'fire hydrant',
  '???',
  'stop sign',
  'parking meter',
  'bench',
  'bird',
  'cat',
  'dog',
  'horse',
  'sheep',
  'cow',
  'elephant',
  'bear',
  'zebra',
  'giraffe',
  '???',
  'backpack',
  'umbrella',
  '???',
  '???',
  'handbag',
  'tie',
  'suitcase',
  'frisbee',
  'skis',
  'snowboard',
  'sports ball',
  'kite',
  'baseball bat',
  'baseball glove',
  'skateboard',
  'surfboard',
  'tennis racket',
  'bottle',
  '???',
  'wine glass',
  'cup',
  'fork',
  'knife',
  'spoon',
  'bowl',
  'banana',
  'apple',
  'sandwich',
  'orange',
  'broccoli',
  'carrot',
  'hot dog',
  'pizza',
  'donut',
  'cake',
  'chair',
  'couch',
  'potted plant',
  'bed',
  '???',
  'dining table',
  '???',
  '???',
  'toilet',
  '???',
  'tv',
  'laptop',
  'mouse',
  'remote',
  'keyboard',
  'cell phone',
  'microwave',
  'oven',
  'toaster',
  'sink',
  'refrigerator',
  '???',
  'book',
  'clock',
  'vase',
  'scissors',
  'teddy bear',
  'hair drier',
  'toothbrush',
];

/**
 * Subset of COCO classes we actively distance-track. Anything outside this
 * set is filtered out before zone calculation.
 */
export const PRIORITY_CLASSES: readonly string[] = ['person', 'car', 'bus', 'truck'];

/** Pre-computed numeric class ids matching PRIORITY_CLASSES against COCO_LABELS. */
export const PRIORITY_CLASS_IDS: ReadonlySet<number> = new Set(
  PRIORITY_CLASSES.map((label) => COCO_LABELS.indexOf(label)).filter((id) => id >= 0),
);
