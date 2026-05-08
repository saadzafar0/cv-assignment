import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Camera } from 'react-native-vision-camera';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CameraView } from '../components/CameraView';
import { DistanceDisplay } from '../components/DistanceDisplay';
import { AlertOverlay } from '../components/AlertOverlay';
import { useObjectDetection } from '../hooks/useObjectDetection';
import { useDistanceCalc } from '../hooks/useDistanceCalc';
import { useAlertSystem } from '../hooks/useAlertSystem';
import { loadFocalLength } from '../utils/calibration';
import { DEFAULT_FOCAL_LENGTH } from '../utils/constants';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;

/** Permission gating + main rear-collision UI. */
export function MainScreen({ navigation }: Props): React.ReactElement {
  const [permission, setPermission] = useState<'pending' | 'granted' | 'denied'>(
    'pending',
  );
  const [focalLength, setFocalLength] = useState<number>(DEFAULT_FOCAL_LENGTH);

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

  // Re-load the focal length whenever the screen regains focus, so updates
  // from the calibration wizard take effect immediately.
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      loadFocalLength().then((value) => {
        if (!cancelled) setFocalLength(value);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const detection = useObjectDetection();
  const { distanceM, zone } = useDistanceCalc(
    detection.nearest?.pixelWidth ?? null,
    focalLength,
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

  return (
    <View style={styles.container}>
      <CameraView
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

      <Pressable
        onPress={() =>
          Alert.alert(
            'Recalibrate?',
            'Calibration is most accurate with a real car parked exactly 2 m behind the phone. Continue?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Calibrate',
                onPress: () => navigation.navigate('Calibration'),
              },
            ],
          )
        }
        style={({ pressed }) => [styles.calibrateBtn, pressed && styles.btnPressed]}
      >
        <Text style={styles.calibrateBtnText}>CALIBRATE</Text>
      </Pressable>
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
  calibrateBtn: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  calibrateBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  btnPressed: {
    opacity: 0.6,
  },
});
