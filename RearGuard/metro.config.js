const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * Adds `tflite` so the MobileNet-SSD COCO model bundled in src/assets is
 * resolved through `require(..)` and copied into the Android APK at build
 * time. Without this Metro would treat .tflite imports as JS sources.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    assetExts: [...(defaultConfig.resolver.assetExts ?? []), 'tflite'],
  },
};

module.exports = mergeConfig(defaultConfig, config);
