import { supabase } from '@/lib/supabase';
import type { Dispute, OfficeSettings } from '@/types/database';

export interface ConfirmReturnResult {
  basePoints: number;
  speedyBonus: number;
  thankYouBonus: number;
  ownerBonus: number;
  totalPointsFinder: number;
  isPairLimitExceeded: boolean;
}

export interface OfficeStatusResult {
  isOpen: boolean;
  message: string;
  settings: OfficeSettings | null;
}

/**
 * Calculates whether the Lost & Found office is open based on office_settings in Asia/Manila time.
 */
export async function getOfficeStatus(): Promise<OfficeStatusResult> {
  const { data: settings, error } = await supabase
    .from('office_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error || !settings) {
    return {
      isOpen: false,
      message: 'Hindi makumpirma ang oras ng opisina.',
      settings: null,
    };
  }

  // Current time in Asia/Manila (UTC+8)
  const now = new Date();
  const manilaTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Manila' });
  const manilaDate = new Date(manilaTimeStr);

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = daysOfWeek[manilaDate.getDay()];

  const isDayOpen = settings.open_days.includes(currentDayName);

  // Parse open and close times (format "HH:mm")
  const [openHour, openMinute] = settings.open_time.split(':').map(Number);
  const [closeHour, closeMinute] = settings.close_time.split(':').map(Number);

  const currentMinutes = manilaDate.getHours() * 60 + manilaDate.getMinutes();
  const openMinutes = openHour * 60 + openMinute;
  const closeMinutes = closeHour * 60 + closeMinute;

  const isTimeOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  const isOpen = isDayOpen && isTimeOpen;

  let message = '';
  if (isOpen) {
    message = `Bukas ang Opisina hanggang ${settings.close_time.substring(0, 5)}`;
  } else {
    message = `Sarado ang Opisina. Mga oras ng operasyon: ${settings.open_days[0]} - ${settings.open_days[settings.open_days.length - 1]} (${settings.open_time.substring(0, 5)} - ${settings.close_time.substring(0, 5)})`;
  }

  return {
    isOpen,
    message,
    settings,
  };
}

/**
 * Step 1: Mark item as released / handed over.
 * For sensitive items (Cash/Wallet/ID), only admins can release during office open hours.
 * For regular items, the finder can mark released.
 * Sets status = 'released', released_at = now(), auto_confirm_at = now() + 7 days.
 */
export async function markItemAsReturned(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('release_item', { p_item_id: itemId });
  if (error) throw new Error(error.message);
}

/**
 * Step 2: Owner confirms receipt of the item.
 * Executes server-side RPC `confirm_item_return` to validate permissions,
 * enforce anti-farming limits, award points to finder & owner, unlock badges,
 * and record optional thank-you note.
 */
export async function confirmReturn(
  itemId: string,
  thankYouNoteText?: string
): Promise<ConfirmReturnResult> {
  const { data, error } = await supabase.rpc('confirm_item_return', {
    p_item_id: itemId,
    p_thank_you_note: thankYouNoteText?.trim() || null,
  });

  if (error) {
    throw new Error(error.message || 'Nabigo ang kumpirmasyon ng pagbabalik.');
  }

  const res = data as {
    success: boolean;
    base_points: number;
    speedy_bonus: number;
    thank_you_bonus: number;
    owner_bonus: number;
    total_points_finder: number;
    is_pair_limit_exceeded: boolean;
  };

  return {
    basePoints: res.base_points,
    speedyBonus: res.speedy_bonus,
    thankYouBonus: res.thank_you_bonus,
    ownerBonus: res.owner_bonus,
    totalPointsFinder: res.total_points_finder,
    isPairLimitExceeded: res.is_pair_limit_exceeded,
  };
}

/**
 * Surrenders item to the Lost & Found Office (for custody transfer).
 * Flags `requires_office_pickup = true` and logs to admin audit trail.
 */
export async function surrenderToOffice(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('surrender_item', { p_item_id: itemId });
  if (error) throw new Error(error.message);
}

/**
 * Raises a dispute if the owner claims item was not returned or was fraudulent.
 * Freezes auto-confirmation, records dispute in `disputes` table, and alerts administrators.
 */
export async function raiseDispute(itemId: string, reason: string): Promise<Dispute> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  if (!reason.trim()) throw new Error('Pakibigay ang dahilan ng dispute.');

  // Insert dispute record (Trigger `on_dispute_created` automatically freezes item auto_confirm_at and notifies admins)
  const { data: dispute, error } = await supabase
    .from('disputes')
    .insert({
      item_id: itemId,
      raised_by: user.id,
      reason: reason.trim(),
      status: 'open',
    })
    .select()
    .single();

  if (error || !dispute) {
    throw new Error(error?.message || 'Nabigo ang pagsumite ng dispute.');
  }

  return dispute;
}
