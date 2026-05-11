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
import { db } from "../src/firebase/config";

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
};

export default function EmergencyChat({
  emergencyId,
  currentUserId,
  currentUserRole,
  isActive = true,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const q = query(
      collection(db, "emergencies", emergencyId, "messages"),
      orderBy("timestamp", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            senderId: data.senderId as string,
            senderRole: data.senderRole as "doctor" | "ambulance",
            text: data.text as string,
            timestamp: data.timestamp as string,
          };
        })
      );
    });
    return () => unsub();
  }, [emergencyId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        nestedScrollEnabled
      >
        {messages.length === 0 ? (
          <Text style={styles.emptyText}>No messages yet. Start the conversation.</Text>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <View key={msg.id} style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}>
                {!isMe && (
                  <Text style={styles.senderLabel}>
                    {ROLE_LABEL[msg.senderRole] ?? msg.senderRole}
                  </Text>
                )}
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
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

      {isActive ? (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor="#ADB5BD"
            multiline
            maxLength={500}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            <Text style={styles.sendBtnText}>{sending ? "…" : "Send"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.closedNote}>Chat is read-only — case closed.</Text>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  messageList: {
    maxHeight: 280,
  },
  messageListContent: {
    paddingVertical: 4,
    gap: 6,
  },
  emptyText: {
    fontSize: 13,
    color: "#6C757D",
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 20,
    fontStyle: "italic",
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
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  bubbleMe: {
    backgroundColor: "#D62828",
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: "#F1F3F5",
    borderBottomLeftRadius: 4,
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
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 10,
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
  sendBtn: {
    backgroundColor: "#D62828",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
  },
  sendBtnDisabled: {
    backgroundColor: "#ADB5BD",
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
});
