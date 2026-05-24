import { Linking } from "react-native";

/** Open a URL without throwing — returns whether the handler ran. */
export async function safeOpenURL(url: string): Promise<boolean> {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
