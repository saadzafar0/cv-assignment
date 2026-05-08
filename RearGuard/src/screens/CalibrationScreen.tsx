import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CameraView } from '../components/CameraView';
import { useObjectDetection, type Detection } from '../hooks/useObjectDetection';
import { computeFocalLength, saveFocalLength } from '../utils/calibration';
import { REAL_CAR_WIDTH_CM } from '../utils/constants';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Calibration'>;

type Step =
  | 'instructions'
  | 'aim'
  | 'tap'
  | 'confirm'
  | 'saving'
  | 'done'
  | 'error';

const KNOWN_DISTANCE_CM = 200;

/**
 * Five-step calibration wizard:
 *   1. Instructions: "Place a car exactly 2 meters away"
 *   2. Aim: live camera, show detected boxes
 *   3. Tap: user taps the correct car bounding box
 *   4. Confirm: review pixelWidth + computed focal length
 *   5. Save: persist to AsyncStorage and return to Main
 */
export function CalibrationScreen({ navigation }: Props): React.ReactElement {
  const [step, setStep] = useState<Step>('instructions');
  const [tapped, setTapped] = useState<Detection | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const detection = useObjectDetection();

  // Step 3: tap handler — capture the tapped detection and move to confirm.
  const handleTap = (det: Detection) => {
    if (step !== 'tap') return;
    setTapped(det);
    setStep('confirm');
  };

  const handleSave = async () => {
    if (tapped == null) return;
    setStep('saving');
    try {
      const focalLength = computeFocalLength(
        tapped.pixelWidth,
        KNOWN_DISTANCE_CM,
        REAL_CAR_WIDTH_CM,
      );
      await saveFocalLength(focalLength);
      setStep('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStep('error');
    }
  };

  const focalPreview =
    tapped != null
      ? computeFocalLength(tapped.pixelWidth, KNOWN_DISTANCE_CM, REAL_CAR_WIDTH_CM)
      : null;

  return (
    <View style={styles.container}>
      <CameraView
        detections={detection.detections}
        nearest={detection.nearest}
        frameWidth={detection.frameWidth}
        frameHeight={detection.frameHeight}
        frameProcessor={detection.frameProcessor}
        zone="caution"
        onTapDetection={step === 'tap' ? handleTap : undefined}
      />

      <View style={styles.headerBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Text style={styles.backBtnText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>CALIBRATE</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.bottomCard}>
        {step === 'instructions' && (
          <View>
            <Text style={styles.stepLabel}>STEP 1 OF 4</Text>
            <Text style={styles.heading}>Place a car exactly 2 meters away</Text>
            <Text style={styles.body}>
              Park a real vehicle directly behind the phone with its rear bumper
              centred and the bumper exactly 200 cm from the camera lens.
              Measure with a tape — the more accurate this distance, the more
              accurate every future reading.
            </Text>
            <PrimaryButton label="I'M READY" onPress={() => setStep('aim')} />
          </View>
        )}

        {step === 'aim' && (
          <View>
            <Text style={styles.stepLabel}>STEP 2 OF 4</Text>
            <Text style={styles.heading}>Aim the camera at the bumper</Text>
            <Text style={styles.body}>
              Frame the entire car bumper in view. We'll show coloured boxes on
              every car/truck/bus we detect — wait until you see one over your
              calibration vehicle.
            </Text>
            <Text style={styles.statusInline}>
              {detection.detections.length > 0
                ? `${detection.detections.length} object(s) detected`
                : 'Waiting for detection…'}
            </Text>
            <PrimaryButton
              label="NEXT"
              onPress={() => setStep('tap')}
              disabled={detection.detections.length === 0}
            />
          </View>
        )}

        {step === 'tap' && (
          <View>
            <Text style={styles.stepLabel}>STEP 3 OF 4</Text>
            <Text style={styles.heading}>Tap the calibration vehicle</Text>
            <Text style={styles.body}>
              Tap the bounding box drawn over the car parked at 2 m. We'll
              record its pixel width to derive the lens focal length.
            </Text>
          </View>
        )}

        {step === 'confirm' && tapped != null && (
          <View>
            <Text style={styles.stepLabel}>STEP 4 OF 4</Text>
            <Text style={styles.heading}>Confirm calibration</Text>
            <View style={styles.metricRow}>
              <Metric label="OBJECT" value={tapped.label.toUpperCase()} />
              <Metric label="PIXEL WIDTH" value={`${tapped.pixelWidth.toFixed(0)} px`} />
              <Metric
                label="FOCAL LENGTH"
                value={focalPreview != null ? `${focalPreview.toFixed(0)} px` : '—'}
              />
            </View>
            <View style={styles.row}>
              <SecondaryButton label="REDO" onPress={() => setStep('tap')} />
              <PrimaryButton label="SAVE" onPress={handleSave} />
            </View>
          </View>
        )}

        {step === 'saving' && (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.body}>Saving calibration…</Text>
          </View>
        )}

        {step === 'done' && (
          <View>
            <Text style={[styles.heading, { color: '#22c55e' }]}>
              Calibration saved
            </Text>
            <Text style={styles.body}>
              RearGuard will now use your custom focal length for every
              distance measurement.
            </Text>
            <PrimaryButton label="DONE" onPress={() => navigation.goBack()} />
          </View>
        )}

        {step === 'error' && (
          <View>
            <Text style={[styles.heading, { color: '#ef4444' }]}>
              Couldn't save calibration
            </Text>
            <Text style={styles.body}>{errorMessage ?? 'Unknown error'}</Text>
            <PrimaryButton label="TRY AGAIN" onPress={() => setStep('tap')} />
          </View>
        )}
      </View>
    </View>
  );
}

interface BtnProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

function PrimaryButton({ label, onPress, disabled }: BtnProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryBtn,
        disabled && styles.btnDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: BtnProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
    >
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    width: 60,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 4,
  },
  bottomCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 32,
    padding: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 16,
  },
  stepLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 6,
  },
  heading: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  body: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  statusInline: {
    color: '#a3a3a3',
    fontSize: 12,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  primaryBtn: {
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  primaryBtnText: {
    color: '#0a0a0a',
    fontWeight: '800',
    letterSpacing: 2,
    fontSize: 14,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#475569',
    flex: 1,
  },
  secondaryBtnText: {
    color: '#cbd5e1',
    fontWeight: '700',
    letterSpacing: 2,
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  metricValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  center: {
    alignItems: 'center',
    paddingVertical: 16,
  },
});
