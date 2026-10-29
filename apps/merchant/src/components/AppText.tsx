/**
 * App-wide typography: Plus Jakarta Sans. React Native cannot map fontWeight to a custom
 * font family automatically, so these wrappers pick the right weight file from the style.
 */
import React from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

const FAMILIES = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

function fontOverride(style: StyleProp<TextStyle>): TextStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return {};
  const w = String(flat.fontWeight ?? '400');
  const family =
    w === '500' ? FAMILIES.medium
    : w === '600' ? FAMILIES.semibold
    : w === '700' || w === 'bold' ? FAMILIES.bold
    : w === '800' || w === '900' ? FAMILIES.extrabold
    : FAMILIES.regular;
  return { fontFamily: family, fontWeight: 'normal' };
}

export const Text = React.forwardRef<RNText, TextProps>(function Text(props, ref) {
  return <RNText ref={ref} {...props} style={[props.style, fontOverride(props.style)]} />;
});

export const TextInput = React.forwardRef<RNTextInput, TextInputProps>(function TextInput(props, ref) {
  return <RNTextInput ref={ref} {...props} style={[props.style, fontOverride(props.style)]} />;
});
