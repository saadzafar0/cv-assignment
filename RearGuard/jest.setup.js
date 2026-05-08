/**
 * Jest mocks for native modules that don't run in the jsdom test env.
 *
 *   - AsyncStorage uses a JS-only stub from the official package.
 *   - Reanimated/Vision-Camera/Sound modules are not imported by the
 *     calibration-math test, so we don't need stubs for them yet. Add here
 *     if/when component tests get reintroduced.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
