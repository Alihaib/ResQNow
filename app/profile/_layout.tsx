import { Stack } from "expo-router";
import { stackScreenDefaults } from "../../src/ui/tokens";

export default function ProfileLayout() {
  return <Stack screenOptions={stackScreenDefaults} />;
}
