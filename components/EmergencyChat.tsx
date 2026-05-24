import { addDoc, collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../src/context/LanguageContext";
import { db } from "../src/firebase/config";
import { isFirestoreNetworkError } from "../src/utils/firestoreErrors";
import { tokens } from "../src/ui/tokens";
import { getChatBubbleRadius } from "../src/utils/rtl";
import { useUiDirection } from "./ui/layout";
import { GlassSurface, VoiceWaveform } from "./ai-emergency";
import { AI_RADIUS, aiEmergencyTheme } from "./ai-emergency/theme";

type ChatMessage = {
  id: string;
  senderId: string;
  senderRole: "doctor" | "ambulance" | "user";
  text: string;
  timestamp: string;
};

const ROLE_LABEL: Record<string, string> = {
  doctor: "Doctor",
  ambulance: "Ambulance",
  user: "Patient",
};

type Props = {
  emergencyId: string;
  currentUserId: string;
  currentUserRole: "doctor" | "ambulance" | "user";
  isActive?: boolean;
  /** Premium glass chat styling for the AI emergency command screen */
  variant?: "default" | "premium";
};

export default function EmergencyChat({
  emergencyId,
  currentUserId,
  currentUserRole,
  isActive = true,
  variant = "default",
}: Props) {
  const { lang } = useLanguage();
  const { row, textAlign, text: dirText } = useUiDirection();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [chatUnavailable, setChatUnavailable] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const premium = variant === "premium";

  useEffect(() => {
    if (!emergencyId) return;

    setChatUnavailable(false);
    const q = query(
      collection(db, "emergencies", emergencyId, "messages"),
      orderBy("timestamp", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setChatUnavailable(false);
        setMessages(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              senderId: data.senderId as string,
              senderRole: data.senderRole as "doctor" | "ambulance" | "user",
              text: data.text as string,
              timestamp: data.timestamp as string,
            };
          }),
        );
      },
      (err) => {
        console.warn("[EmergencyChat] listener error:", err);
        setChatUnavailable(true);
        if (!isFirestoreNetworkError(err)) {
          console.error("[EmergencyChat] non-network listener error:", err);
        }
      },
    );
    return () => unsub();
  }, [emergencyId]);

  useEffect(() => {
    if (messages.length > 0) {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
    };
  }, [messages.length]);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await addDoc(collection(db, "emergencies", emergencyId, "messages"), {
        senderId: currentUserId,
        senderRole: currentUserRole,
        text,
        timestamp: new Date().toISOString(),
      });
      setInputText("");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      return "";
    }
  };

  const messageList = (
    <ScrollView
      ref={scrollRef}
      style={[styles.messageList, premium && styles.messageListPremium]}
      contentContainerStyle={[
        styles.messageListContent,
        premium && styles.messageListContentPremium,
      ]}
      nestedScrollEnabled
    >
      {chatUnavailable ? (
        <View style={premium ? styles.emptyPremium : undefined}>
          <Text style={premium ? styles.emptyPremiumText : styles.emptyText}>
            Messages unavailable — reconnecting
          </Text>
          {premium ? <VoiceWaveform active={false} compact /> : null}
        </View>
      ) : messages.length === 0 ? (
        <View style={premium ? styles.emptyPremium : undefined}>
          {premium ? (
            <>
              <View style={styles.aiAvatarSmall}>
                <Ionicons name="sparkles" size={16} color={aiEmergencyTheme.primary} />
              </View>
              <Text style={styles.emptyPremiumText}>
                Connect with your response team. Messages appear here in real time.
              </Text>
              <VoiceWaveform active={false} compact />
            </>
          ) : (
            <Text style={styles.emptyText}>No messages yet. Start the conversation.</Text>
          )}
        </View>
      ) : (
        messages.map((msg) => {
          const isMe = msg.senderId === currentUserId;
          if (premium) {
            return (
              <View
                key={msg.id}
                style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}
              >
                {!isMe ? (
                  <View style={[styles.aiMsgHeader, row]}>
                    <View style={styles.aiAvatarSmall}>
                      <Ionicons
                        name={
                          msg.senderRole === "ambulance"
                            ? "medkit"
                            : msg.senderRole === "doctor"
                              ? "fitness"
                              : "person"
                        }
                        size={14}
                        color={aiEmergencyTheme.primary}
                      />
                    </View>
                    <Text style={styles.senderLabelPremium}>
                      {ROLE_LABEL[msg.senderRole] ?? msg.senderRole}
                    </Text>
                  </View>
                ) : null}
              <View
                style={[
                  styles.bubblePremium,
                  isMe ? styles.bubbleMePremium : styles.bubbleOtherPremium,
                  getChatBubbleRadius(lang, isMe, 20, 6),
                ]}
              >
                  <Text
                    style={[
                      styles.bubbleTextPremium,
                      isMe && styles.bubbleTextMePremium,
                    ]}
                  >
                    {msg.text}
                  </Text>
                  <Text
                    style={[
                      styles.bubbleTimePremium,
                      isMe && styles.bubbleTimeMePremium,
                    ]}
                  >
                    {formatTime(msg.timestamp)}
                  </Text>
                </View>
              </View>
            );
          }

          return (
            <View key={msg.id} style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}>
              {!isMe && (
                <Text style={styles.senderLabel}>
                  {ROLE_LABEL[msg.senderRole] ?? msg.senderRole}
                </Text>
              )}
              <View
                style={[
                  styles.bubble,
                  isMe ? styles.bubbleMe : styles.bubbleOther,
                  getChatBubbleRadius(lang, isMe),
                ]}
              >
                <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{msg.text}</Text>
                <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
                  {formatTime(msg.timestamp)}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );

  const inputBlock = isActive ? (
    <View style={[styles.inputRow, row, premium && styles.inputRowPremium]}>
      {premium ? (
        <GlassSurface radius={AI_RADIUS.card} style={styles.inputGlass}>
          <TextInput
            style={[styles.inputPremium, { textAlign }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message your response team…"
            placeholderTextColor={tokens.color.textFaint}
            multiline
            maxLength={500}
            returnKeyType="default"
          />
        </GlassSurface>
      ) : (
        <TextInput
          style={[styles.input, { textAlign }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor="#ADB5BD"
          multiline
          maxLength={500}
          returnKeyType="default"
        />
      )}
      <TouchableOpacity
        style={[
          styles.sendBtn,
          premium && styles.sendBtnPremium,
          (!inputText.trim() || sending) && styles.sendBtnDisabled,
          premium && (!inputText.trim() || sending) && styles.sendBtnDisabledPremium,
        ]}
        onPress={sendMessage}
        disabled={!inputText.trim() || sending}
        activeOpacity={0.85}
      >
        {premium ? (
          <Ionicons name="send" size={20} color={tokens.color.textOnPrimary} />
        ) : (
          <Text style={styles.sendBtnText}>{sending ? "…" : "Send"}</Text>
        )}
      </TouchableOpacity>
    </View>
  ) : (
    <Text style={[styles.closedNote, premium && styles.closedNotePremium]}>
      Chat is read-only — case closed.
    </Text>
  );

  if (premium) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <GlassSurface radius={AI_RADIUS.sheet} style={styles.premiumShell}>
          <View style={styles.premiumHeader}>
            <Text style={styles.premiumTitle}>Live communication</Text>
            <View style={[styles.listeningRow, row]}>
              <VoiceWaveform active={sending} compact />
              <Text style={styles.listeningLabel}>
                {sending ? "Sending…" : "Team channel active"}
              </Text>
            </View>
          </View>
          {messageList}
          {inputBlock}
        </GlassSurface>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {messageList}
      {inputBlock}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  messageList: {
    maxHeight: 280,
  },
  messageListPremium: {
    maxHeight: 320,
  },
  messageListContent: {
    paddingVertical: 4,
    gap: 6,
  },
  messageListContentPremium: {
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    gap: tokens.space.md,
  },
  emptyText: {
    fontSize: 13,
    color: "#6C757D",
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 20,
    fontStyle: "italic",
  },
  emptyPremium: {
    alignItems: "center",
    paddingVertical: tokens.space.xl,
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
  },
  emptyPremiumText: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  row: {
    marginVertical: 2,
  },
  rowLeft: {
    alignItems: "flex-start",
  },
  rowRight: {
    alignItems: "flex-end",
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6C757D",
    marginBottom: 3,
    marginStart: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  aiMsgHeader: {
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    marginStart: 2,
  },
  aiAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.2)",
  },
  senderLabelPremium: {
    fontSize: tokens.font.overline,
    fontWeight: tokens.fontWeight.bold,
    color: tokens.color.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  bubbleMe: {
    backgroundColor: "#D62828",
  },
  bubbleOther: {
    backgroundColor: "#F1F3F5",
  },
  bubblePremium: {
    maxWidth: "88%",
    borderRadius: 20,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm + 2,
  },
  bubbleMePremium: {
    backgroundColor: aiEmergencyTheme.primary,
    shadowColor: aiEmergencyTheme.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  bubbleOtherPremium: {
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    borderWidth: 1,
    borderColor: aiEmergencyTheme.glassBorder,
  },
  bubbleText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#212529",
    lineHeight: 20,
  },
  bubbleTextMe: {
    color: "#FFFFFF",
  },
  bubbleTextPremium: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    lineHeight: 22,
  },
  bubbleTextMePremium: {
    color: tokens.color.textOnPrimary,
  },
  bubbleTime: {
    fontSize: 11,
    fontWeight: "600",
    color: "#868E96",
    marginTop: 4,
    textAlign: "right",
  },
  bubbleTimeMe: {
    color: "rgba(255,255,255,0.7)",
  },
  bubbleTimePremium: {
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textFaint,
    marginTop: 4,
    textAlign: "right",
  },
  bubbleTimeMePremium: {
    color: "rgba(255,255,255,0.75)",
  },
  premiumShell: {
    overflow: "hidden",
  },
  premiumHeader: {
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.lg,
    paddingBottom: tokens.space.sm,
    gap: tokens.space.xs,
  },
  premiumTitle: {
    fontSize: tokens.font.h3,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
  },
  listeningRow: {
    alignItems: "center",
    gap: tokens.space.sm,
  },
  listeningLabel: {
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.semibold,
    color: aiEmergencyTheme.primary,
  },
  inputRow: {
    alignItems: "flex-end",
    gap: 8,
    marginTop: 10,
  },
  inputRowPremium: {
    paddingHorizontal: tokens.space.lg,
    paddingBottom: tokens.space.lg,
    marginTop: tokens.space.sm,
    gap: tokens.space.sm,
  },
  inputGlass: {
    flex: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#E9ECEF",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 14,
    color: "#003049",
    fontWeight: "600",
    backgroundColor: "#FFFFFF",
    maxHeight: 100,
  },
  inputPremium: {
    flex: 1,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.md,
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textPrimary,
    fontWeight: tokens.fontWeight.medium,
    maxHeight: 100,
    minHeight: 44,
  },
  sendBtn: {
    backgroundColor: "#D62828",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
  },
  sendBtnPremium: {
    backgroundColor: aiEmergencyTheme.primary,
    borderRadius: 16,
    width: 48,
    height: 48,
    minWidth: 48,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  sendBtnDisabled: {
    backgroundColor: "#ADB5BD",
  },
  sendBtnDisabledPremium: {
    backgroundColor: tokens.color.textFaint,
  },
  sendBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  closedNote: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6C757D",
    textAlign: "center",
    marginTop: 10,
    fontStyle: "italic",
  },
  closedNotePremium: {
    padding: tokens.space.lg,
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
  },
});
