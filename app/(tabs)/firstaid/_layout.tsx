import { Stack } from "expo-router";
import { stackScreenDefaults } from "../../../src/ui/tokens";

export default function FirstAidLayout() {
  return <Stack screenOptions={{ ...stackScreenDefaults, animation: "slide_from_right" }} />;
}
