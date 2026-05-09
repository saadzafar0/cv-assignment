/**
 * Tunable constants for the RearGuard rear-collision system.
 *
 * Distance is computed per-class using REAL_WIDTHS_CM so that a person, car,
 * and truck each use their actual real-world width in the pinhole formula.
 * The focal length is auto-derived from the camera's field-of-view at runtime;
 * DEFAULT_FOCAL_LENGTH is a last-resort fallback only.
 */

/**
 * Fallback focal-length estimate (in pixels) derived from a typical
 * horizontal field-of-view of ~80° at 1280px width:
 *   1280 / (2 * tan(40°)) ≈ 763.
 * Used only when format.fieldOfView is unavailable or zero.
 */
export const DEFAULT_FOCAL_LENGTH = 763;

/** Distance thresholds in centimetres (zone boundaries are inclusive of the safer zone). */
export const SAFE_DISTANCE_CM = 500;
export const DANGER_DISTANCE_CM = 200;

/** ML model input geometry (square). EfficientDet-Lite2 expects 448x448. */
export const MODEL_INPUT_SIZE = 448;

/** Maximum number of detections the model can output per frame. */
export const MAX_DETECTIONS = 25;

/** Minimum confidence we accept from the detector. */
export const SCORE_THRESHOLD = 0.30;

/** Camera frame processor target rate. */
export const FRAME_PROCESSOR_FPS = 15;

/** Camera target preview format. */
export const TARGET_RESOLUTION = { width: 1280, height: 720 } as const;

/**
 * Exponential moving average weight for the newest distance sample.
 * Higher = more responsive (less jitter suppression).
 * 0.6 means 60 % newest frame, 40 % history.
 */
export const SMOOTHING_ALPHA = 0.6;

/**
 * How many consecutive frames with no detection before we clear the
 * displayed distance and reset the EMA. Keeps the UI from showing stale
 * numbers when the object leaves the frame.
 */
export const MISS_TOLERANCE = 2;

/** Beep cadence per zone (milliseconds between beeps). */
export const BEEP_INTERVAL_MS = {
  caution: 1000, // 1 Hz
  danger: 333, // ~3 Hz
} as const;

/** Vibration pulse length (ms) when in DANGER. */
export const VIBRATION_DURATION_MS = 200;

export type Zone = 'safe' | 'caution' | 'danger';

export const ZONE_COLORS: Record<Zone, string> = {
  safe: '#22c55e', // green-500
  caution: '#eab308', // yellow-500
  danger: '#ef4444', // red-500
};

/**
 * COCO labels in the order produced by SSD / EfficientDet COCO TFLite models.
 *
 * Index 0 is reserved/unused; the labels list intentionally spans 0..90 so
 * a class id from the detector output can be used as a direct array index.
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
 * Approximate real-world widths (in cm) for every COCO class we can
 * reasonably estimate. Used in the pinhole distance formula so that each
 * class gets an accurate reading instead of the old one-size-fits-all car
 * width. Keys must match the strings in COCO_LABELS exactly.
 */
export const REAL_WIDTHS_CM: Record<string, number> = {
  // --- Vehicles & transport ---
  person:           45,
  bicycle:          60,
  car:             170,
  motorcycle:       80,
  airplane:        350,
  bus:             260,
  train:           300,
  truck:           250,
  boat:            250,
  // --- Street furniture ---
  'traffic light':  30,
  'fire hydrant':   30,
  'stop sign':      75,
  'parking meter':  20,
  bench:           120,
  // --- Animals ---
  bird:             15,
  cat:              30,
  dog:              35,
  horse:           160,
  sheep:            50,
  cow:             150,
  elephant:        350,
  bear:            120,
  zebra:           130,
  giraffe:         100,
  // --- Personal items ---
  backpack:         35,
  umbrella:         90,
  handbag:          30,
  tie:              10,
  suitcase:         45,
  frisbee:          25,
  skis:             10,
  snowboard:        25,
  'sports ball':    22,
  kite:             80,
  'baseball bat':    7,
  'baseball glove': 25,
  skateboard:       20,
  surfboard:        50,
  'tennis racket':  25,
  // --- Kitchen / dining ---
  bottle:            8,
  'wine glass':      8,
  cup:               8,
  fork:              3,
  knife:             3,
  spoon:             4,
  bowl:             18,
  banana:            4,
  apple:             8,
  sandwich:         15,
  orange:            8,
  broccoli:         15,
  carrot:            4,
  'hot dog':         5,
  pizza:            30,
  donut:            10,
  cake:             25,
  // --- Furniture ---
  chair:            45,
  couch:           180,
  'potted plant':   30,
  bed:             150,
  'dining table':  120,
  toilet:           40,
  // --- Electronics ---
  tv:               80,
  laptop:           35,
  mouse:             6,
  remote:            5,
  keyboard:         45,
  'cell phone':      7,
  // --- Appliances ---
  microwave:        50,
  oven:             60,
  toaster:          30,
  sink:             60,
  refrigerator:     70,
  // --- Other ---
  book:             15,
  clock:            25,
  vase:             15,
  scissors:          8,
  'teddy bear':     25,
  'hair drier':     10,
  toothbrush:        2,
};

/** Fallback width (cm) for classes not in REAL_WIDTHS_CM. */
export const DEFAULT_REAL_WIDTH_CM = 100;
