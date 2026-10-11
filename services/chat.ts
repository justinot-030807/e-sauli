import { supabase } from '@/lib/supabase';
import type { Message } from '@/types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface MessageWithSender extends Message {
  isMine: boolean;
  senderNickname?: string;
}

/**
 * Fetches all chat messages for a specific claim thread.
 */
export async function fetchClaimMessages(claimId: string): Promise<MessageWithSender[]> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('claim_id', claimId)
    .order('created_at', { ascending: true });

  if (error || !messages) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return messages.map((m) => ({
    ...m,
    isMine: m.sender_id === user?.id,
  }));
}

/**
 * Sends a message in a claim thread and emits an in-app notification to the recipient.
 */
export async function sendClaimMessage(
  claimId: string,
  recipientId: string,
  body: string,
  itemId: string
): Promise<Message> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  if (!body.trim()) throw new Error('Cannot send empty message');

  const { data: newMessage, error } = await supabase
    .from('messages')
    .insert({
      claim_id: claimId,
      sender_id: user.id,
      body: body.trim(),
    })
    .select()
    .single();

  if (error || !newMessage) {
    throw new Error(error?.message || 'Failed to send message');
  }

  // Notify recipient
  await supabase.from('notifications').insert({
    user_id: recipientId,
    type: 'new_message',
    body: `Bagong mensahe: "${body.length > 30 ? body.substring(0, 27) + '...' : body}"`,
    item_id: itemId,
    read: false,
  });

  return newMessage;
}

/**
 * Subscribes to realtime incoming messages for a claim thread using Supabase Realtime.
 */
export function subscribeToClaimMessages(
  claimId: string,
  onMessageReceived: (message: Message) => void
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`claim_messages_${claimId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `claim_id=eq.${claimId}`,
      },
      (payload) => {
        if (payload.new) {
          onMessageReceived(payload.new as Message);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
