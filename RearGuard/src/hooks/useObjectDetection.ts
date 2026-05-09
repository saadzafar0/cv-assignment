import { useState } from 'react';
import { useFrameProcessor } from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useRunOnJS } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import {
  COCO_LABELS,
  MODEL_INPUT_SIZE,
  PRIORITY_CLASS_IDS,
  SCORE_THRESHOLD,
} from '../utils/constants';

/** Bounding box in normalised frame coordinates (0..1). */
export interface NormalisedBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

export interface Detection {
  /** Bounding box in normalised frame coordinates (0..1, top-left origin). */
  box: NormalisedBox;
  /** Bounding-box width in **frame** pixels (not screen). */
  pixelWidth: number;
  /** Bounding-box height in frame pixels. */
  pixelHeight: number;
  /** COCO class id (0..90, 0 = background). */
  classId: number;
  /** Human-readable label, e.g. 'car'. */
  label: string;
  /** Detector confidence in [0, 1]. */
  score: number;
}

export interface DetectionsState {
  /** All filtered detections from the most recent frame. */
  detections: Detection[];
  /** Detection with the largest pixelWidth (treated as the nearest object). */
  nearest: Detection | null;
  /** Frame width/height in pixels — needed to scale boxes to screen coords. */
  frameWidth: number;
  frameHeight: number;
  /** Monotonic counter so React state updates even on identical detection lists. */
  tick: number;
}

const EMPTY_STATE: DetectionsState = {
  detections: [],
  nearest: null,
  frameWidth: 0,
  frameHeight: 0,
  tick: 0,
};

export type ModelStatus = 'loading' | 'loaded' | 'error';

export interface UseObjectDetectionResult extends DetectionsState {
  frameProcessor: ReturnType<typeof useFrameProcessor> | undefined;
  modelStatus: ModelStatus;
  modelError?: Error;
}

/**
 * Frame-processor hook that runs MobileNet-SSD COCO on every camera frame and
 * exposes the latest detections + the "nearest" object (= widest bounding
 * box among priority classes) to React state.
 *
 * The hook is intentionally agnostic of distance/zone logic — that is layered
 * on top by `useDistanceCalc`.
 */
export function useObjectDetection(): UseObjectDetectionResult {
  const model = useTensorflowModel(require('../assets/coco_ssd_mobilenet.tflite'));
  const { resize } = useResizePlugin();
  const [state, setState] = useState<DetectionsState>(EMPTY_STATE);

  // Bridge from the camera/worklet thread back to the JS thread. We bump
  // `tick` from the worklet so React always sees a new reference.
  const pushState = useRunOnJS(
    (detections: Detection[], nearest: Detection | null, frameWidth: number, frameHeight: number) => {
      setState((prev) => ({
        detections,
        nearest,
        frameWidth,
        frameHeight,
        tick: prev.tick + 1,
      }));
    },
    [],
  );

  const loadedModel = model.state === 'loaded' ? model.model : undefined;

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (loadedModel == null) {
        return;
      }

      const inputBuffer = resize(frame, {
        scale: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE },
        pixelFormat: 'rgb',
        dataType: 'uint8',
      });

      const outputs = loadedModel.runSync([inputBuffer]);
      // SSD MobileNet COCO outputs (in this order):
      //   0: locations [1, 10, 4]  -> ymin, xmin, ymax, xmax (normalised)
      //   1: classes   [1, 10]     -> int class ids
      //   2: scores    [1, 10]     -> float [0, 1]
      //   3: numDets   [1]
      const locations = outputs[0];
      const classes = outputs[1];
      const scores = outputs[2];
      const numDetections = Math.min(Number(outputs[3][0] ?? 0), 10);

      const detections: Detection[] = [];
      let nearest: Detection | null = null;
      let bestPixelWidth = 0;

      for (let i = 0; i < numDetections; i++) {
        const score = Number(scores[i]);
        const classId = Number(classes[i]) | 0;
        if (score < SCORE_THRESHOLD) continue;
        if (!PRIORITY_CLASS_IDS.includes(classId)) continue;

        const yMin = Number(locations[i * 4]);
        const xMin = Number(locations[i * 4 + 1]);
        const yMax = Number(locations[i * 4 + 2]);
        const xMax = Number(locations[i * 4 + 3]);

        const boxWidthNorm = Math.max(0, xMax - xMin);
        const boxHeightNorm = Math.max(0, yMax - yMin);
        const pixelWidth = boxWidthNorm * frame.width;
        const pixelHeight = boxHeightNorm * frame.height;

        const det: Detection = {
          box: { xMin, yMin, xMax, yMax },
          pixelWidth,
          pixelHeight,
          classId,
          label: COCO_LABELS[classId] ?? '???',
          score,
        };
        detections.push(det);

        if (pixelWidth > bestPixelWidth) {
          bestPixelWidth = pixelWidth;
          nearest = det;
        }
      }

      pushState(detections, nearest, frame.width, frame.height);
    },
    [loadedModel, resize, pushState],
  );

  return {
    frameProcessor: loadedModel != null ? frameProcessor : undefined,
    modelStatus: model.state,
    modelError: model.state === 'error' ? model.error : undefined,
    ...state,
  };
}
