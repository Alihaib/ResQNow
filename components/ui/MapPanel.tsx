/**

 * Consistent map container — rounded frame, hairline border, calm overlay.

 * Children should be a MapView (or placeholder); layout only.

 */



import type { ReactNode } from "react";

import { StyleSheet, View, ViewStyle } from "react-native";

import { tokens } from "../../src/ui/tokens";



export type MapPanelProps = {

  children: ReactNode;

  /** Fixed height for embedded maps (default 160 — secondary to status/ETA) */

  height?: number;

  style?: ViewStyle;

  /** Subtle veil so the map supports the flow without dominating */

  calm?: boolean;

};



export default function MapPanel({

  children,

  height = 160,

  style,

  calm = true,

}: MapPanelProps) {

  return (

    <View style={[styles.frame, { height }, style]}>

      <View style={styles.inner}>{children}</View>

      {calm ? <View style={styles.veil} pointerEvents="none" /> : null}

    </View>

  );

}



const styles = StyleSheet.create({

  frame: {

    borderRadius: tokens.radius.lg,

    borderWidth: tokens.hairline,

    borderColor: tokens.color.border,

    backgroundColor: tokens.color.bgSubtle,

    overflow: "hidden",

  },

  inner: {

    flex: 1,

    borderRadius: tokens.radius.lg,

    overflow: "hidden",

  },

  veil: {

    ...StyleSheet.absoluteFillObject,

    backgroundColor: "rgba(246, 248, 251, 0.22)",

  },

});


