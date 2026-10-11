import { supabase } from '@/lib/supabase';
import * as Crypto from 'expo-crypto';
import type { Claim, ClaimStatus, Item } from '@/types/database';

export interface SubmitClaimInput {
  itemId: string;
  proofText: string;
  secretAnswer?: string;
  cashAmount?: string;
}

export interface ClaimWithMeta extends Claim {
  item?: Item;
  claimantNickname?: string;
  claimantCollege?: string;
}

/**
 * Submits a claim for a found item.
 * Includes automated secret question and cash amount verification
 * with 3-attempt lockout enforcement via `verify_claim_secret`.
 */
export async function submitClaim(input: SubmitClaimInput): Promise<Claim> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Kailangang naka-sign in upang mag-claim.');

  if (!input.proofText.trim()) {
    throw new Error('Pakibigay ang iyong patunay o deskripsyon ng pagmamay-ari.');
  }

  // 1. Fetch item to verify validity
  const { data: item, error: itemError } = await supabase
    .from('items')
    .select('*')
    .eq('id', input.itemId)
    .single();

  if (itemError || !item) {
    throw new Error('Hindi matagpuan ang gamit.');
  }

  if (item.user_id === user.id) {
    throw new Error('Hindi mo maaaring i-claim ang sarili mong post.');
  }

  if (item.status !== 'open' && item.status !== 'claim_requested') {
    throw new Error('Hindi na bukas sa mga bagong claim ang gamit na ito.');
  }

  // 2. Perform verification if item has secret question or is Cash
  if (input.secretAnswer || input.cashAmount) {
    const rawAnswer = input.cashAmount
      ? input.cashAmount.trim()
      : input.secretAnswer!.trim().toLowerCase();

    const answerHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawAnswer
    );

    const { data: isMatch, error: rpcError } = await supabase.rpc('verify_claim_secret', {
      p_item_id: input.itemId,
      p_answer_hash: answerHash,
    });

    if (rpcError) {
      throw new Error(rpcError.message);
    }

    if (!isMatch) {
      throw new Error('Maling sagot o halaga. Pakitiyak ang impormasyon bago sumubok muli.');
    }
  }

  // 3. Insert claim into database
  const { data: newClaim, error: claimError } = await supabase
    .from('claims')
    .insert({
      item_id: input.itemId,
      claimant_id: user.id,
      proof_text: input.proofText.trim(),
      status: 'pending',
    })
    .select()
    .single();

  if (claimError || !newClaim) {
    throw new Error(claimError?.message || 'Hindi naisumite ang claim.');
  }

  // 4. Update item status to 'claim_requested' if it was 'open'
  if (item.status === 'open') {
    await supabase
      .from('items')
      .update({ status: 'claim_requested' })
      .eq('id', input.itemId);
  }

  // 5. Notify the finder (item poster)
  const itemTitle = item.title.length > 25 ? item.title.substring(0, 22) + '...' : item.title;
  await supabase.from('notifications').insert({
    user_id: item.user_id,
    type: 'claim_received',
    body: `May nagsumite ng bagong claim para sa iyong nahanap na gamit: "${itemTitle}".`,
    item_id: item.id,
    read: false,
  });

  return newClaim;
}

/**
 * Initiates contact when a user finds an item reported as LOST ("Nahanap Ko Ito").
 * Creates a claim record with proof and notifies the owner.
 */
export async function initiateLostItemContact(
  itemId: string,
  initialMessage: string
): Promise<Claim> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Kailangang naka-sign in upang makipag-ugnayan.');

  const { data: item } = await supabase
    .from('items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (!item) throw new Error('Hindi matagpuan ang gamit.');
  if (item.user_id === user.id) throw new Error('Iyo ang post na ito.');

  // Create claim contact record
  const { data: newClaim, error: claimError } = await supabase
    .from('claims')
    .insert({
      item_id: itemId,
      claimant_id: user.id,
      proof_text: initialMessage.trim() || 'Nahanap ko ang gamit mo.',
      status: 'pending',
    })
    .select()
    .single();

  if (claimError || !newClaim) {
    throw new Error(claimError?.message || 'Hindi masimulan ang pakikipag-ugnayan.');
  }

  // Insert initial chat message
  await supabase.from('messages').insert({
    claim_id: newClaim.id,
    sender_id: user.id,
    body: initialMessage.trim(),
  });

  // Notify the lost item owner
  const itemTitle = item.title.length > 25 ? item.title.substring(0, 22) + '...' : item.title;
  await supabase.from('notifications').insert({
    user_id: item.user_id,
    type: 'new_message',
    body: `May nakakita sa nawawala mong gamit ("${itemTitle}") at nagpadala ng mensahe!`,
    item_id: item.id,
    read: false,
  });

  return newClaim;
}

/**
 * Fetches all claims submitted for an item (for the finder to review).
 */
export async function fetchClaimsForItem(itemId: string): Promise<ClaimWithMeta[]> {
  const { data: claims, error } = await supabase
    .from('claims')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false });

  if (error || !claims) {
    console.error('Error fetching claims for item:', error);
    return [];
  }

  // Fetch claimant public profiles
  const results: ClaimWithMeta[] = await Promise.all(
    claims.map(async (claim) => {
      let claimantNickname = 'Estudyante';
      let claimantCollege = 'MarSU';

      try {
        const { data: profileData } = await supabase.rpc('get_public_profile', {
          target_user_id: claim.claimant_id,
        });
        if (profileData && profileData.length > 0) {
          claimantNickname = profileData[0].nickname;
          claimantCollege = profileData[0].college;
        }
      } catch (err) {
        console.warn('Could not fetch claimant profile:', err);
      }

      return {
        ...claim,
        claimantNickname,
        claimantCollege,
      };
    })
  );

  return results;
}

/**
 * Fetches claims submitted by the current logged-in user.
 */
export async function fetchMyClaims(): Promise<ClaimWithMeta[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: claims, error } = await supabase
    .from('claims')
    .select('*')
    .eq('claimant_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !claims) {
    console.error('Error fetching my claims:', error);
    return [];
  }

  const itemsMap = new Map<string, Item>();
  const itemIds = [...new Set(claims.map((c) => c.item_id))];

  if (itemIds.length > 0) {
    const { data: items } = await supabase
      .from('items')
      .select('*')
      .in('id', itemIds);

    if (items) {
      items.forEach((it) => itemsMap.set(it.id, it));
    }
  }

  return claims.map((c) => ({
    ...c,
    item: itemsMap.get(c.item_id),
  }));
}

/**
 * Fetches detail for a specific claim.
 */
export async function fetchClaimDetail(claimId: string): Promise<ClaimWithMeta & { item: Item }> {
  const { data: claim, error } = await supabase
    .from('claims')
    .select('*')
    .eq('id', claimId)
    .single();

  if (error || !claim) {
    throw new Error('Hindi matagpuan ang claim.');
  }

  const { data: item, error: itemError } = await supabase
    .from('items')
    .select('*')
    .eq('id', claim.item_id)
    .single();

  if (itemError || !item) {
    throw new Error('Hindi matagpuan ang kaugnay na gamit.');
  }

  let claimantNickname = 'Estudyante';
  let claimantCollege = 'MarSU';

  try {
    const { data: profileData } = await supabase.rpc('get_public_profile', {
      target_user_id: claim.claimant_id,
    });
    if (profileData && profileData.length > 0) {
      claimantNickname = profileData[0].nickname;
      claimantCollege = profileData[0].college;
    }
  } catch (err) {
    console.warn('Could not fetch claimant profile:', err);
  }

  return {
    ...claim,
    item,
    claimantNickname,
    claimantCollege,
  };
}

/**
 * Approves a claim.
 * PostgreSQL trigger `handle_claim_approval_trigger` automatically:
 * - Updates item status to 'verified'
 * - Auto-rejects other pending claims
 * - Emits notifications to approved and rejected claimants
 */
export async function approveClaim(claimId: string): Promise<void> {
  const { error } = await supabase
    .from('claims')
    .update({ status: 'approved' })
    .eq('id', claimId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Rejects a claim.
 */
export async function rejectClaim(claimId: string): Promise<void> {
  const { data: claim } = await supabase
    .from('claims')
    .select('item_id, claimant_id')
    .eq('id', claimId)
    .single();

  const { error } = await supabase
    .from('claims')
    .update({ status: 'rejected' })
    .eq('id', claimId);

  if (error) {
    throw new Error(error.message);
  }

  if (claim) {
    await supabase.from('notifications').insert({
      user_id: claim.claimant_id,
      type: 'claim_rejected',
      body: 'Hindi naaprubahan ang iyong isinumiteng claim para sa gamit.',
      item_id: claim.item_id,
      read: false,
    });
  }
}
