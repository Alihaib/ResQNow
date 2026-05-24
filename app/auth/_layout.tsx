import { Stack } from "expo-router";
import { stackScreenDefaults } from "../../src/ui/tokens";

export default function AuthLayout() {
  return <Stack screenOptions={stackScreenDefaults} />;
}
