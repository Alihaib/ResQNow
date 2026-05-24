/**
 * Standard nested screen: blurred header + scrollable calm content.
 */

import React from "react";
import { ScrollView, View, type ViewStyle } from "react-native";
import ScreenHeader from "./ScreenHeader";
import { subScreenStyles } from "./subScreenStyles";

export type SubScreenShellProps = {
  title: string;
  eyebrow?: string;
  fallbackRoute?: string;
  onBack?: () => void;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
};

export default function SubScreenShell({
  title,
  eyebrow,
  fallbackRoute = "/(tabs)",
  onBack,
  trailing,
  children,
  contentStyle,
}: SubScreenShellProps) {
  return (
    <View style={subScreenStyles.screen}>
      <ScreenHeader
        title={title}
        eyebrow={eyebrow}
        fallbackRoute={fallbackRoute}
        onBack={onBack}
        trailing={trailing}
      />
      <ScrollView
        style={subScreenStyles.screen}
        contentContainerStyle={[subScreenStyles.scroll, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}
