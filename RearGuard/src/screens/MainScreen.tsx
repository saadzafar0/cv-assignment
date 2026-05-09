import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
} from 'react-native-vision-camera';

import { CameraView } from '../components/CameraView';
import { DistanceDisplay } from '../components/DistanceDisplay';
import { AlertOverlay } from '../components/AlertOverlay';
import { useObjectDetection } from '../hooks/useObjectDetection';
import { useDistanceCalc } from '../hooks/useDistanceCalc';
import { useAlertSystem } from '../hooks/useAlertSystem';
import {
  DEFAULT_FOCAL_LENGTH,
  FRAME_PROCESSOR_FPS,
  TARGET_RESOLUTION,
} from '../utils/constants';

/**
 * Compute the camera's focal length in pixels from the format's horizontal
 * field-of-view. `frameWidth` must be the **horizontal** pixel dimension
 * (i.e. `format.videoWidth`) because `fieldOfView` is the horizontal FOV.
 * Falls back to DEFAULT_FOCAL_LENGTH when FOV is unavailable.
 */
function focalLengthFromFOV(fovDegrees: number, frameWidth: number): number {
  if (fovDegrees <= 0 || frameWidth <= 0) {
    return DEFAULT_FOCAL_LENGTH;
  }
  const fovRad = (fovDegrees * Math.PI) / 180;
  return frameWidth / (2 * Math.tan(fovRad / 2));
}

/** Permission gating + main rear-collision UI. */
export function MainScreen(): React.ReactElement {
  const [permission, setPermission] = useState<'pending' | 'granted' | 'denied'>(
    'pending',
  );

  // Own the camera device + format here so we can read fieldOfView for the
  // auto-computed focal length AND pass device/format down to CameraView.
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

  // Auto-compute focal length from the camera's horizontal field-of-view.
  // fieldOfView is horizontal → pair with videoWidth, not videoHeight.
  const focalLength = useMemo(() => {
    if (format != null && format.fieldOfView > 0) {
      return focalLengthFromFOV(format.fieldOfView, format.videoWidth);
    }
    return DEFAULT_FOCAL_LENGTH;
  }, [format]);

  // Permission flow: ask once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = Camera.getCameraPermissionStatus();
      let next = current;
      if (current !== 'granted') {
        next = await Camera.requestCameraPermission();
      }
      if (cancelled) return;
      setPermission(next === 'granted' ? 'granted' : 'denied');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const detection = useObjectDetection();
  const { distanceM, zone } = useDistanceCalc(
    detection.nearest?.pixelWidth ?? null,
    focalLength,
    detection.nearest?.label ?? null,
    detection.tick,
  );
  useAlertSystem(zone);

  if (permission === 'pending') {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.statusText}>Requesting camera access…</Text>
      </View>
    );
  }

  if (permission === 'denied') {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.heading}>Camera permission required</Text>
        <Text style={styles.body}>
          RearGuard needs the rear camera to detect approaching obstacles.
          Open Settings to grant access, then return to the app.
        </Text>
        <Pressable
          onPress={() => Linking.openSettings()}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.primaryBtnText}>Open Settings</Text>
        </Pressable>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.heading}>No back-facing camera detected.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        device={device}
        format={format}
        detections={detection.detections}
        nearest={detection.nearest}
        frameWidth={detection.frameWidth}
        frameHeight={detection.frameHeight}
        frameProcessor={detection.frameProcessor}
        zone={zone}
      />

      <DistanceDisplay
        distanceM={distanceM}
        zone={zone}
        nearestLabel={detection.nearest?.label ?? null}
      />

      <AlertOverlay zone={zone} />

      {detection.modelStatus === 'loading' && (
        <View style={styles.modelStatus}>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={styles.modelStatusText}>Loading detection model…</Text>
        </View>
      )}
      {detection.modelStatus === 'error' && (
        <View style={styles.modelStatus}>
          <Text style={[styles.modelStatusText, { color: '#ef4444' }]}>
            Model failed to load: {detection.modelError?.message ?? 'unknown'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  heading: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 12,
  },
  primaryBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#0a0a0a',
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  modelStatus: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modelStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  btnPressed: {
    opacity: 0.6,
  },
});
