/**

 * Large scannable ETA — minutes or custom text with calm supporting label.

 */



import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { textStyles, tokens } from "../../src/ui/tokens";
import { useUiDirection } from "./layout";



export type ETAHighlightProps = {

  label: string;

  /** e.g. "4" or "—" */

  value: string;

  unit?: string;

  style?: ViewStyle;

};



export default function ETAHighlight({

  label,

  value,

  unit,

  style,

}: ETAHighlightProps) {
  const { row } = useUiDirection();

  return (

    <View style={[styles.wrap, style]} accessibilityRole="text">

      <Text style={styles.label} numberOfLines={1}>

        {label}

      </Text>

      <View style={[styles.valueRow, row]}>

        <Text style={styles.value} numberOfLines={1}>

          {value}

        </Text>

        {unit ? (

          <Text style={styles.unit} numberOfLines={1}>

            {unit}

          </Text>

        ) : null}

      </View>

    </View>

  );

}



const styles = StyleSheet.create({

  wrap: {

    backgroundColor: tokens.color.bgSurface,

    borderRadius: tokens.radius.xl,

    borderWidth: tokens.hairline,

    borderColor: tokens.color.border,

    paddingVertical: tokens.space.xl,

    paddingHorizontal: tokens.space.lg,

    alignItems: "center",

    gap: tokens.space.sm,

  },

  label: {

    fontSize: tokens.font.overline,

    fontWeight: tokens.fontWeight.semibold,

    color: tokens.color.textMuted,

    letterSpacing: 0.6,

    textTransform: "uppercase",

  },

  valueRow: {

    alignItems: "baseline",

    gap: tokens.space.sm,

  },

  value: {

    ...textStyles.eta,

  },

  unit: {

    fontSize: tokens.font.h3,

    fontWeight: tokens.fontWeight.medium,

    color: tokens.color.textSecondary,

  },

});


