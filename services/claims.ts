import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import type { Claim, Item, ItemType } from '@/types/database';

export interface SubmitClaimInput {
  itemId: string;
  proofText: string;
  secretAnswer?: string;
}

export interface ClaimWithMeta extends Claim {
  item?: Item;
  claimantNickname?: string;
  claimantCollege?: string;
}

async function createClaim(itemId: string, proof: string, type: ItemType): Promise<Claim> {
  const { data, error } = await supabase.rpc('submit_item_claim', {
    p_item_id: itemId,
    p_proof: proof,
    p_type: type,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function submitClaim(input: SubmitClaimInput): Promise<Claim> {
  if (!input.proofText.trim()) throw new Error('Pakibigay ang patunay ng pagmamay-ari.');

  const answer = input.secretAnswer?.trim().toLowerCase();
  if (answer) {
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, answer);
    const { data, error } = await supabase.rpc('verify_claim_secret', {
      p_item_id: input.itemId, p_answer_hash: hash,
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Maling sagot. Pakitiyak ang impormasyon bago sumubok muli.');
  }

  return createClaim(input.itemId, input.proofText.trim(), 'found');
}

export function initiateLostItemContact(itemId: string, initialMessage: string): Promise<Claim> {
  return createClaim(itemId, initialMessage.trim() || 'Nahanap ko ang gamit mo.', 'lost');
}

export async function fetchClaimsForItem(itemId: string): Promise<ClaimWithMeta[]> {
  const { data, error } = await supabase.from('claims').select('*')
    .eq('item_id', itemId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchAdminPendingClaims(): Promise<ClaimWithMeta[]> {
  const { data: claims, error } = await supabase.from('claims').select('*')
    .eq('status', 'pending').order('created_at').limit(40);
  if (error) throw error;
  return includeItems(claims);
}

export async function fetchMyClaims(): Promise<ClaimWithMeta[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  const { data: claims, error } = await supabase.from('claims').select('*')
    .eq('claimant_id', session.user.id).order('created_at', { ascending: false });
  if (error) throw error;
  return includeItems(claims);
}

async function includeItems(claims: Claim[]): Promise<ClaimWithMeta[]> {
  if (!claims.length) return [];

  const { data: items, error: itemError } = await supabase.from('items').select('*')
    .in('id', [...new Set(claims.map((claim) => claim.item_id))]);
  if (itemError) throw itemError;
  const byId = new Map(items.map((item) => [item.id, item]));
  return claims.map((claim) => ({ ...claim, item: byId.get(claim.item_id) }));
}

export async function fetchClaimDetail(claimId: string): Promise<ClaimWithMeta & { item: Item }> {
  const { data: claim, error } = await supabase.from('claims').select('*').eq('id', claimId).single();
  if (error) throw new Error('Hindi matagpuan ang claim.');

  const { data: item, error: itemError } = await supabase.from('items').select('*').eq('id', claim.item_id).single();
  if (itemError) throw new Error('Hindi maikarga ang gamit na kaugnay ng claim.');
  return { ...claim, item };
}

async function resolveClaim(claimId: string, approve: boolean) {
  const { error } = await supabase.rpc('resolve_item_claim', { p_claim_id: claimId, p_approve: approve });
  if (error) throw new Error(error.message);
}

export function approveClaim(claimId: string): Promise<void> {
  return resolveClaim(claimId, true);
}

export function rejectClaim(claimId: string): Promise<void> {
  return resolveClaim(claimId, false);
}
