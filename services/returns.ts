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
      isOpen: true,
      message: 'Bukas ang Opisina (Lunes hanggang Biyernes, 8:00 AM - 5:00 PM)',
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, approval_status')
    .eq('id', user.id)
    .single();

  if (!profile || profile.approval_status !== 'approved') {
    throw new Error('Kailangan ng aprubadong account upang maisagawa ang aksyong ito.');
  }

  const { data: item } = await supabase
    .from('items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (!item) throw new Error('Item not found');

  // Handover Rules (Specification Section 14):
  if (item.requires_office_pickup) {
    if (profile.role !== 'admin') {
      throw new Error('Ang admin lamang sa Lost & Found Office ang may pahintulot na i-release ang gamit na ito.');
    }

    const officeStatus = await getOfficeStatus();
    if (!officeStatus.isOpen) {
      throw new Error(`Hindi maaaring mag-release habang sarado ang opisina. ${officeStatus.message}`);
    }
  } else {
    if (item.user_id !== user.id && profile.role !== 'admin') {
      throw new Error('Tanging ang nag-post o admin lamang ang maaaring magmarka na naisauli ang gamit.');
    }
  }

  // Find the approved claim to identify the claimant/owner
  const { data: approvedClaim } = await supabase
    .from('claims')
    .select('claimant_id')
    .eq('item_id', itemId)
    .eq('status', 'approved')
    .maybeSingle();

  const now = new Date();
  const autoConfirmDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { error } = await supabase
    .from('items')
    .update({
      status: 'released',
      released_at: now.toISOString(),
      auto_confirm_at: autoConfirmDate.toISOString(),
    })
    .eq('id', itemId);

  if (error) throw new Error(error.message);

  // Notify claimant / owner
  if (approvedClaim) {
    await supabase.from('notifications').insert({
      user_id: approvedClaim.claimant_id,
      type: 'confirm_receipt_reminder',
      body: `Nai-release na ang gamit ("${item.title}"). Mangyaring kumpirmahin ang pagkakatanggap sa loob ng 7 araw (+5 Aura points).`,
      item_id: itemId,
      read: false,
    });
  }
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('items')
    .update({ requires_office_pickup: true })
    .eq('id', itemId);

  if (error) throw new Error(error.message);

  // Log in admin audit log
  await supabase.from('admin_audit_log').insert({
    admin_id: user.id,
    action: 'item_surrendered_to_office',
    target_type: 'item',
    target_id: itemId,
    details: { surrendered_by: user.id },
  });
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
