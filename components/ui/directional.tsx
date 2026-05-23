/**
 * RTL-safe layout primitives — inherit direction from LanguageContext automatically.
 * Prefer these over raw View/Text with flexDirection:'row' or textAlign:'left'.
 */

import React from "react";
import {
  Text,
  View,
  type TextProps,
  type ViewProps,
} from "react-native";
import { useUiDirection } from "./layout";

export function UiRow({ style, children, ...rest }: ViewProps) {
  const { row } = useUiDirection();
  return (
    <View style={[row, style]} {...rest}>
      {children}
    </View>
  );
}

export function UiColumn({ style, children, ...rest }: ViewProps) {
  const { column } = useUiDirection();
  return (
    <View style={[column, style]} {...rest}>
      {children}
    </View>
  );
}

export function UiText({ style, children, ...rest }: TextProps) {
  const { text } = useUiDirection();
  return (
    <Text style={[text, style]} {...rest}>
      {children}
    </Text>
  );
}
