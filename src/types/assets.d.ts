// Image imports resolve to a React Native image source (Metro asset id).
declare module '*.png' {
  const source: import('react-native').ImageSourcePropType;
  export default source;
}
