import { useState } from 'react';
import { runAtTargetFps, useFrameProcessor } from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useRunOnJS } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import {
  COCO_LABELS,
  MAX_DETECTIONS,
  MODEL_INPUT_SIZE,
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
 * Frame-processor hook that runs EfficientDet-Lite0 COCO on every camera
 * frame and exposes the latest detections + the "nearest" object (= widest
 * bounding box across ALL detected classes) to React state.
 *
 * The hook is intentionally agnostic of distance/zone logic — that is layered
 * on top by `useDistanceCalc`.
 */
export function useObjectDetection(): UseObjectDetectionResult {
  const model = useTensorflowModel(require('../assets/efficientdet_lite0.tflite'));
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

      // Throttle inference to 5 FPS — the camera still renders at full FPS,
      // but the heavy 448×448 model only runs 5 times per second.
      runAtTargetFps(5, () => {
        'worklet';
        try {
          // The 7.4MB Kaggle EfficientDet-Lite2 model is quantized and expects uint8 input.
          const inputBuffer = resize(frame, {
            scale: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE },
            pixelFormat: 'rgb',
            dataType: 'uint8',
          });

          const outputs = loadedModel.runSync([inputBuffer]);

          // Guard: must have the standard 4-tensor post-processed output.
          if (outputs == null || outputs.length < 4) {
            pushState([], null, frame.width, frame.height);
            return;
          }

          // TF Object Detection API standard output order:
          //   0: locations  [1, N, 4] -> ymin, xmin, ymax, xmax (normalised)
          //   1: classes    [1, N]    -> float class ids
          //   2: scores     [1, N]    -> float [0, 1]
          //   3: numDets    [1]
          const locations = outputs[0];
          const classes = outputs[1];
          const scores = outputs[2];
          const numDetsRaw = outputs[3];

          const numDetections = Math.min(
            Math.max(0, Math.round(Number(numDetsRaw[0] ?? 0))),
            MAX_DETECTIONS,
          );

          const detections: Detection[] = [];
          let nearest: Detection | null = null;
          let bestPixelWidth = 0;

          for (let i = 0; i < numDetections; i++) {
            const score = Number(scores[i] ?? 0);
            if (score < SCORE_THRESHOLD) continue;

            const classId = Math.round(Number(classes[i] ?? -1));
            // Accept ALL valid class IDs — no filtering.
            if (classId < 0 || classId >= COCO_LABELS.length) continue;

            const label = COCO_LABELS[classId] ?? `class_${classId}`;

            const yMin = Number(locations[i * 4] ?? 0);
            const xMin = Number(locations[i * 4 + 1] ?? 0);
            const yMax = Number(locations[i * 4 + 2] ?? 0);
            const xMax = Number(locations[i * 4 + 3] ?? 0);

            const boxWidthNorm = Math.max(0, xMax - xMin);
            const boxHeightNorm = Math.max(0, yMax - yMin);
            const pixelWidth = boxWidthNorm * frame.width;
            const pixelHeight = boxHeightNorm * frame.height;

            const det: Detection = {
              box: { xMin, yMin, xMax, yMax },
              pixelWidth,
              pixelHeight,
              classId,
              label,
              score,
            };
            detections.push(det);

            if (pixelWidth > bestPixelWidth) {
              bestPixelWidth = pixelWidth;
              nearest = det;
            }
          }

          pushState(detections, nearest, frame.width, frame.height);
        } catch (e) {
          console.warn('[TFLite] frame error:', String(e));
          pushState([], null, frame.width, frame.height);
        }
      });
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
