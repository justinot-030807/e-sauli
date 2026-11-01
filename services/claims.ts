import { supabase } from '@/lib/supabase';
import * as Crypto from 'expo-crypto';
import type { Claim, ClaimStatus, Item } from '@/types/database';
import { getStoredLocalSession } from './auth';
import { LOCAL_ITEMS } from './items';

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

export const LOCAL_CLAIMS: ClaimWithMeta[] = [];

/**
 * Submits a claim for a found item.
 */
export async function submitClaim(input: SubmitClaimInput): Promise<Claim> {
  const { data: { user } } = await supabase.auth.getUser();
  const localSession = await getStoredLocalSession();
  const currentUser = user || localSession?.user;
  if (!currentUser) throw new Error('Kailangang naka-sign in upang mag-claim.');

  if (!input.proofText.trim()) {
    throw new Error('Pakibigay ang iyong patunay o deskripsyon ng pagmamay-ari.');
  }

  // 1. Fetch item
  let item = LOCAL_ITEMS.find((it) => it.id === input.itemId) || null;
  try {
    const { data: remoteItem } = await supabase
      .from('items')
      .select('*')
      .eq('id', input.itemId)
      .maybeSingle();
    if (remoteItem) item = remoteItem;
  } catch (e) {
    // ignore
  }

  if (!item) {
    throw new Error('Hindi matagpuan ang gamit.');
  }

  if (item.user_id === currentUser.id) {
    throw new Error('Hindi mo maaaring i-claim ang sarili mong post.');
  }

  // 2. Perform verification if secret question or Cash
  if (input.secretAnswer || input.cashAmount) {
    const rawAnswer = input.cashAmount
      ? input.cashAmount.trim()
      : input.secretAnswer!.trim().toLowerCase();

    const answerHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawAnswer
    );

    try {
      const { data: isMatch } = await supabase.rpc('verify_claim_secret', {
        p_item_id: input.itemId,
        p_answer_hash: answerHash,
      });
      if (isMatch === false) {
        throw new Error('Maling sagot o halaga. Pakitiyak ang impormasyon bago sumubok muli.');
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Maling')) throw err;
    }
  }

  // 3. Try insert into Supabase
  try {
    const { data: newClaim, error: claimError } = await supabase
      .from('claims')
      .insert({
        item_id: input.itemId,
        claimant_id: currentUser.id,
        proof_text: input.proofText.trim(),
        status: 'pending',
      })
      .select()
      .single();

    if (!claimError && newClaim) {
      LOCAL_CLAIMS.unshift({
        ...newClaim,
        item,
        claimantNickname: localSession?.profile?.nickname || 'MariaS',
        claimantCollege: localSession?.profile?.college || 'Campus Community',
      });
      return newClaim;
    }
  } catch (e) {
    // ignore
  }

  // 4. Local fallback
  const localClaim: ClaimWithMeta = {
    id: 'clm_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    item_id: input.itemId,
    claimant_id: currentUser.id,
    proof_text: input.proofText.trim(),
    status: 'pending',
    created_at: new Date().toISOString(),
    item,
    claimantNickname: localSession?.profile?.nickname || 'MariaS',
    claimantCollege: localSession?.profile?.college || 'Campus Community',
  };

  LOCAL_CLAIMS.unshift(localClaim);
  item.status = 'claim_requested';
  return localClaim;
}

export async function initiateLostItemContact(
  itemId: string,
  initialMessage: string
): Promise<Claim> {
  const { data: { user } } = await supabase.auth.getUser();
  const localSession = await getStoredLocalSession();
  const currentUser = user || localSession?.user;
  if (!currentUser) throw new Error('Kailangang naka-sign in upang makipag-ugnayan.');

  let item = LOCAL_ITEMS.find((it) => it.id === itemId) || null;
  try {
    const { data: remoteItem } = await supabase
      .from('items')
      .select('*')
      .eq('id', itemId)
      .maybeSingle();
    if (remoteItem) item = remoteItem;
  } catch (e) {
    // ignore
  }

  if (!item) throw new Error('Hindi matagpuan ang gamit.');

  // Try Supabase
  try {
    const { data: newClaim, error: claimError } = await supabase
      .from('claims')
      .insert({
        item_id: itemId,
        claimant_id: currentUser.id,
        proof_text: initialMessage.trim() || 'Nahanap ko ang gamit mo.',
        status: 'pending',
      })
      .select()
      .single();

    if (!claimError && newClaim) {
      LOCAL_CLAIMS.unshift({
        ...newClaim,
        item,
        claimantNickname: localSession?.profile?.nickname || 'MariaS',
        claimantCollege: localSession?.profile?.college || 'Campus Community',
      });
      return newClaim;
    }
  } catch (e) {
    // ignore
  }

  // Local fallback
  const localClaim: ClaimWithMeta = {
    id: 'clm_' + Date.now().toString(36),
    item_id: itemId,
    claimant_id: currentUser.id,
    proof_text: initialMessage.trim() || 'Nahanap ko ang gamit mo.',
    status: 'pending',
    created_at: new Date().toISOString(),
    item,
    claimantNickname: localSession?.profile?.nickname || 'MariaS',
    claimantCollege: localSession?.profile?.college || 'Campus Community',
  };

  LOCAL_CLAIMS.unshift(localClaim);
  return localClaim;
}

export async function fetchClaimsForItem(itemId: string): Promise<ClaimWithMeta[]> {
  try {
    const { data: claims, error } = await supabase
      .from('claims')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false });

    if (!error && claims && claims.length > 0) {
      return claims.map((c) => ({
        ...c,
        claimantNickname: 'Estudyante',
        claimantCollege: 'Campus Community',
      }));
    }
  } catch (err) {
    // ignore
  }

  return LOCAL_CLAIMS.filter((c) => c.item_id === itemId);
}

export async function fetchMyClaims(): Promise<ClaimWithMeta[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const localSession = await getStoredLocalSession();
  const currentUserId = user?.id || localSession?.user?.id;
  if (!currentUserId) return [];

  try {
    const { data: claims, error } = await supabase
      .from('claims')
      .select('*')
      .eq('claimant_id', currentUserId)
      .order('created_at', { ascending: false });

    if (!error && claims && claims.length > 0) {
      return claims.map((c) => ({
        ...c,
        item: LOCAL_ITEMS.find((it) => it.id === c.item_id),
      }));
    }
  } catch (e) {
    // ignore
  }

  return LOCAL_CLAIMS.filter((c) => c.claimant_id === currentUserId);
}

export async function fetchClaimDetail(claimId: string): Promise<ClaimWithMeta & { item: Item }> {
  const local = LOCAL_CLAIMS.find((c) => c.id === claimId);
  if (local && local.item) {
    return local as ClaimWithMeta & { item: Item };
  }

  const { data: claim, error } = await supabase
    .from('claims')
    .select('*')
    .eq('id', claimId)
    .single();

  if (error || !claim) {
    throw new Error('Hindi matagpuan ang claim.');
  }

  const item = LOCAL_ITEMS.find((it) => it.id === claim.item_id) || {
    id: claim.item_id,
    user_id: '00000000-0000-0000-0000-000000000002',
    type: 'found',
    title: 'Gamit sa Campus',
    description: 'Deskripsyon ng gamit',
    category: 'Others',
    location: 'Campus',
    date_happened: new Date().toISOString().split('T')[0],
    photo_path: null,
    status: 'open',
    is_hidden: false,
    requires_office_pickup: false,
    released_at: null,
    auto_confirm_at: null,
    expires_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  } as Item;

  return {
    ...claim,
    item,
    claimantNickname: 'Estudyante',
    claimantCollege: 'Campus Community',
  };
}

export async function approveClaim(claimId: string): Promise<void> {
  const local = LOCAL_CLAIMS.find((c) => c.id === claimId);
  if (local) {
    local.status = 'approved';
    if (local.item) local.item.status = 'verified';
  }

  try {
    await supabase.from('claims').update({ status: 'approved' }).eq('id', claimId);
  } catch (e) {
    // ignore
  }
}

export async function rejectClaim(claimId: string): Promise<void> {
  const local = LOCAL_CLAIMS.find((c) => c.id === claimId);
  if (local) {
    local.status = 'rejected';
  }

  try {
    await supabase.from('claims').update({ status: 'rejected' }).eq('id', claimId);
  } catch (e) {
    // ignore
  }
}
