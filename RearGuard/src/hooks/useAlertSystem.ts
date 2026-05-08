import { useEffect, useRef } from 'react';
import { Vibration } from 'react-native';
import Sound from 'react-native-sound';

import {
  BEEP_INTERVAL_MS,
  VIBRATION_DURATION_MS,
  type Zone,
} from '../utils/constants';

// Allow the beep to play even when the device is in silent mode — this is a
// safety alert, not music. Must be set once before constructing Sound instances.
Sound.setCategory('Playback', false);

/**
 * Drives the audible + haptic alert behaviour from the current `zone`:
 *   - safe:    silent, no vibration
 *   - caution: 1 Hz beep
 *   - danger:  ~3 Hz beep + 200 ms vibration on each beep
 *
 * Sound asset is the procedurally-generated `beep.wav` placed in
 * android/app/src/main/res/raw/ by `npm run setup:assets`.
 */
export function useAlertSystem(zone: Zone): void {
  const soundRef = useRef<Sound | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load the bundled beep once for the lifetime of the hook.
  useEffect(() => {
    const sound = new Sound('beep.wav', Sound.MAIN_BUNDLE, (err) => {
      if (err) {
        console.warn('[useAlertSystem] failed to load beep.wav', err);
        soundRef.current = null;
        return;
      }
      soundRef.current = sound;
    });

    return () => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      try {
        sound.stop(() => sound.release());
      } catch {
        sound.release();
      }
      soundRef.current = null;
      Vibration.cancel();
    };
  }, []);

  useEffect(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (zone === 'safe') {
      Vibration.cancel();
      return;
    }

    const intervalMs =
      zone === 'danger' ? BEEP_INTERVAL_MS.danger : BEEP_INTERVAL_MS.caution;

    const tick = () => {
      const sound = soundRef.current;
      if (sound != null) {
        // Reset to the start of the clip so successive beeps don't overlap.
        sound.stop(() => sound.play());
      }
      if (zone === 'danger') {
        Vibration.vibrate(VIBRATION_DURATION_MS);
      }
    };

    // Fire immediately on zone entry, then on the cadence.
    tick();
    intervalRef.current = setInterval(tick, intervalMs);

    return () => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      Vibration.cancel();
    };
  }, [zone]);
}
