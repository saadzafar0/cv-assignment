module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'react-native-worklets-core/plugin',
      {
        processNestedWorklets: true,
      },
    ],
    'react-native-reanimated/plugin',
  ],
};
