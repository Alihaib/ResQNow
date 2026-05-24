import { Stack } from "expo-router";
import { stackScreenDefaults } from "../../src/ui/tokens";

export default function DoctorLayout() {
  return <Stack screenOptions={stackScreenDefaults} />;
}
