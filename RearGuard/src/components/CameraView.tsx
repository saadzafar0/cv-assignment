import React, { useMemo } from 'react';
import {
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Camera, useCameraDevice, useCameraFormat } from 'react-native-vision-camera';
import type { ReadonlyFrameProcessor } from 'react-native-vision-camera';

import {
  FRAME_PROCESSOR_FPS,
  TARGET_RESOLUTION,
  ZONE_COLORS,
  type Zone,
} from '../utils/constants';
import type { Detection } from '../hooks/useObjectDetection';

/**
 * Layout-space rect for a single bounding box once it has been mapped from
 * the raw frame (where the model sees it) into the on-screen camera view.
 */
export interface ScreenBox {
  detection: Detection;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ContainFit {
  displayWidth: number;
  displayHeight: number;
  offsetX: number;
  offsetY: number;
}

function computeContainFit(
  frameWidth: number,
  frameHeight: number,
  viewWidth: number,
  viewHeight: number,
): ContainFit {
  if (frameWidth <= 0 || frameHeight <= 0 || viewWidth <= 0 || viewHeight <= 0) {
    return { displayWidth: 0, displayHeight: 0, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.min(viewWidth / frameWidth, viewHeight / frameHeight);
  const displayWidth = frameWidth * scale;
  const displayHeight = frameHeight * scale;
  return {
    displayWidth,
    displayHeight,
    offsetX: (viewWidth - displayWidth) / 2,
    offsetY: (viewHeight - displayHeight) / 2,
  };
}

/**
 * Map a normalised detection box (0..1 of the original camera frame) into the
 * on-screen rect, accounting for the `contain` letterboxing applied by the
 * Camera view.
 */
export function mapDetectionToScreen(
  detection: Detection,
  frameWidth: number,
  frameHeight: number,
  viewWidth: number,
  viewHeight: number,
): ScreenBox | null {
  const fit = computeContainFit(frameWidth, frameHeight, viewWidth, viewHeight);
  if (fit.displayWidth === 0) return null;
  const { box } = detection;
  const left = fit.offsetX + box.xMin * fit.displayWidth;
  const top = fit.offsetY + box.yMin * fit.displayHeight;
  const width = (box.xMax - box.xMin) * fit.displayWidth;
  const height = (box.yMax - box.yMin) * fit.displayHeight;
  return { detection, left, top, width, height };
}

interface CameraViewProps {
  /** Detections from the most recent frame; rendered as box overlays. */
  detections: Detection[];
  /** Raw frame dimensions reported by vision-camera. */
  frameWidth: number;
  frameHeight: number;
  /** Frame processor worklet. Pass `undefined` while the model is loading. */
  frameProcessor: ReadonlyFrameProcessor | undefined;
  /** Drives the bounding-box border colour. */
  zone: Zone;
  /** Reference to the detection currently used for distance calculation (highlighted). */
  nearest?: Detection | null;
  /** Optional tap handler called with the tapped detection (used in calibration). */
  onTapDetection?: (detection: Detection) => void;
  /** When true, the camera is paused — useful for confirmation step. */
  paused?: boolean;
}

/**
 * Live rear-camera feed plus the translucent bounding-box overlay. Owns no
 * detection logic itself; pure presentation.
 */
export function CameraView({
  detections,
  frameWidth,
  frameHeight,
  frameProcessor,
  zone,
  nearest,
  onTapDetection,
  paused,
}: CameraViewProps): React.ReactElement {
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [
    {
      videoResolution: {
        width: TARGET_RESOLUTION.width,
        height: TARGET_RESOLUTION.height,
      },
    },
    { fps: FRAME_PROCESSOR_FPS },
  ]);

  const [layout, setLayout] = React.useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const screenBoxes = useMemo(() => {
    if (layout.width === 0 || frameWidth === 0) return [] as ScreenBox[];
    const boxes: ScreenBox[] = [];
    for (let i = 0; i < detections.length; i++) {
      const sb = mapDetectionToScreen(
        detections[i],
        frameWidth,
        frameHeight,
        layout.width,
        layout.height,
      );
      if (sb != null) boxes.push(sb);
    }
    return boxes;
  }, [detections, frameWidth, frameHeight, layout]);

  const handleOverlayPress = (event: GestureResponderEvent) => {
    if (onTapDetection == null) return;
    const { locationX, locationY } = event.nativeEvent;
    // Hit-test in reverse render order so topmost box wins.
    for (let i = screenBoxes.length - 1; i >= 0; i--) {
      const b = screenBoxes[i];
      if (
        locationX >= b.left &&
        locationX <= b.left + b.width &&
        locationY >= b.top &&
        locationY <= b.top + b.height
      ) {
        onTapDetection(b.detection);
        return;
      }
    }
  };

  if (device == null) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.error}>No back-facing camera detected.</Text>
      </View>
    );
  }

  const borderColor = ZONE_COLORS[zone];

  return (
    <View
      style={styles.container}
      onLayout={(e) => setLayout(e.nativeEvent.layout)}
    >
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        isActive={!paused}
        fps={FRAME_PROCESSOR_FPS}
        resizeMode="contain"
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
      />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handleOverlayPress}
        // Don't intercept taps when no callback is wired up.
        pointerEvents={onTapDetection != null ? 'auto' : 'none'}
      >
        {screenBoxes.map((b, idx) => {
          const isNearest = nearest != null && b.detection === nearest;
          return (
            <View
              key={`${idx}-${b.detection.classId}-${b.detection.score.toFixed(2)}`}
              style={[
                styles.boundingBox,
                {
                  left: b.left,
                  top: b.top,
                  width: b.width,
                  height: b.height,
                  borderColor,
                  borderWidth: isNearest ? 3 : 2,
                  backgroundColor: `${borderColor}22`,
                },
              ]}
              pointerEvents="none"
            >
              <View style={[styles.label, { backgroundColor: borderColor }]}>
                <Text style={styles.labelText}>
                  {b.detection.label} {(b.detection.score * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
          );
        })}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: '#fff',
    fontSize: 16,
  },
  boundingBox: {
    position: 'absolute',
    borderRadius: 4,
  },
  label: {
    position: 'absolute',
    top: -22,
    left: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  labelText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
