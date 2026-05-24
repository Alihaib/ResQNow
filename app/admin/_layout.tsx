import { Stack } from "expo-router";
import { stackScreenDefaults } from "../../src/ui/tokens";

export default function AdminLayout() {
  return <Stack screenOptions={stackScreenDefaults} />;
}
