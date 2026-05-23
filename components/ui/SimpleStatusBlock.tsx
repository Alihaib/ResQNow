/**

 * Hero status line for mission screens — title, optional subtitle, chip row.

 */



import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { textStyles, tokens } from "../../src/ui/tokens";

import StatusChip, { type StatusChipProps } from "./StatusChip";



export type SimpleStatusBlockProps = {

  title: string;

  subtitle?: string;

  chip?: StatusChipProps;

  style?: ViewStyle;

};



export default function SimpleStatusBlock({

  title,

  subtitle,

  chip,

  style,

}: SimpleStatusBlockProps) {

  return (

    <View style={[styles.block, style]} accessibilityRole="header">

      {chip ? <StatusChip {...chip} size="md" /> : null}

      <Text style={styles.title} numberOfLines={2}>

        {title}

      </Text>

      {subtitle ? (

        <Text style={styles.subtitle} numberOfLines={3}>

          {subtitle}

        </Text>

      ) : null}

    </View>

  );

}



const styles = StyleSheet.create({

  block: {

    gap: tokens.space.md,

    paddingVertical: tokens.space.md,

    marginBottom: tokens.space.sm,

  },

  title: {

    ...textStyles.h2,

    lineHeight: 26,

  },

  subtitle: {

    fontSize: tokens.font.bodyLg,

    fontWeight: tokens.fontWeight.medium,

    color: tokens.color.textSecondary,

    lineHeight: 22,

  },

});


