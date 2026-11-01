import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';
import {
  fetchClaimMessages,
  sendClaimMessage,
  subscribeToClaimMessages,
  type MessageWithSender,
} from '@/services/chat';
import { fetchClaimDetail } from '@/services/claims';
import { supabase } from '@/lib/supabase';
import { LoadingView, ErrorView } from '@/components/StateViews';

export default function ClaimChatScreen() {
  const theme = useTheme();
  const { claimId } = useLocalSearchParams<{ claimId: string }>();

  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [inputText, setInputText] = useState('');
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [itemTitle, setItemTitle] = useState('Chat');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  const loadData = useCallback(async () => {
    if (!claimId) return;
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Load claim to find recipient and item
      const claim = await fetchClaimDetail(claimId);
      setItemId(claim.item_id);
      setItemTitle(claim.item.title);

      const recipient = user?.id === claim.claimant_id ? claim.item.user_id : claim.claimant_id;
      setRecipientId(recipient);

      // Load initial message history
      const initialMessages = await fetchClaimMessages(claimId);
      setMessages(initialMessages);
    } catch (err: any) {
      console.error('Error loading chat:', err);
      setError(err?.message || 'Hindi maikarga ang pag-uusap.');
    } finally {
      setIsLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription for incoming messages
  useEffect(() => {
    if (!claimId) return;

    const unsubscribe = subscribeToClaimMessages(claimId, (newMsg) => {
      setMessages((prev) => {
        // Prevent duplicate messages if already present
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [
          ...prev,
          {
            ...newMsg,
            isMine: newMsg.sender_id === currentUserId,
          },
        ];
      });
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => {
      unsubscribe();
    };
  }, [claimId, currentUserId]);

  const handleSend = async () => {
    if (!claimId || !recipientId || !itemId || !inputText.trim() || isSending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);

    try {
      const sent = await sendClaimMessage(claimId, recipientId, textToSend, itemId);
      setMessages((prev) => [
        ...prev,
        {
          ...sent,
          isMine: true,
        },
      ]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err: any) {
      console.error('Send message error:', err);
      setError(err?.message || 'Hindi naipadala ang mensahe.');
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Pag-uusap', headerShown: true }} />
        <LoadingView message="Kinakarga ang mga mensahe..." />
      </View>
    );
  }

  if (error && messages.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Pag-uusap', headerShown: true }} />
        <ErrorView message={error} onRetry={loadData} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: `Chat: ${itemTitle}`,
          headerShown: true,
          headerStyle: { backgroundColor: theme.headerBackground },
          headerTintColor: theme.headerText,
        }}
      />

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMine = item.isMine;
          return (
            <View
              style={[
                styles.bubbleWrapper,
                isMine ? styles.myBubbleWrapper : styles.theirBubbleWrapper,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  isMine
                    ? [styles.myBubble, { backgroundColor: theme.primary }]
                    : [styles.theirBubble, { backgroundColor: theme.card, borderColor: theme.border }],
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    { color: isMine ? '#ffffff' : theme.text },
                  ]}
                >
                  {item.body}
                </Text>
                <Text
                  style={[
                    styles.timeText,
                    { color: isMine ? '#ffffff90' : theme.textSecondary },
                  ]}
                >
                  {new Date(item.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Simulan ang pag-uusap upang mapagkasunduan ang pagbabalik o turnover ng gamit.
            </Text>
          </View>
        }
      />

      {/* Input Row */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <TextInput
          style={[styles.textInput, { color: theme.text, backgroundColor: theme.inputBackground }]}
          placeholder="Sumulat ng mensahe..."
          placeholderTextColor={theme.placeholder}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: theme.primary },
            (!inputText.trim() || isSending) && { opacity: 0.5 },
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || isSending}
          activeOpacity={0.8}
        >
          {isSending ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Ionicons name="send" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesList: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  bubbleWrapper: {
    marginBottom: Spacing.sm,
    maxWidth: '80%',
  },
  myBubbleWrapper: {
    alignSelf: 'flex-end',
  },
  theirBubbleWrapper: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  myBubble: {
    borderBottomRightRadius: 4,
    borderWidth: 0,
  },
  theirBubble: {
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  timeText: {
    fontSize: 9,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  emptyChat: {
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: FontSize.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 2,
  },
});
