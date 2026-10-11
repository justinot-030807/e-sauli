import { supabase } from '@/lib/supabase';
import type {
  Profile,
  Item,
  Dispute,
  Report,
  AdminAuditLog,
  JobLog,
  OfficeSettings,
  ApprovalStatus,
} from '@/types/database';

export interface AdminStats {
  totalUsers: number;
  pendingUsers: number;
  activeItems: number;
  officeItems: number;
  pendingClaims: number;
  openDisputes: number;
  totalReturns: number;
  unresolvedReports: number;
}

export interface ReportWithDetails extends Report {
  targetItem?: Item;
  reporterNickname?: string;
}

export interface DisputeWithDetails extends Dispute {
  itemTitle?: string;
  itemCategory?: string;
  raiserNickname?: string;
  raiserCollege?: string;
}

/**
 * Retrieves aggregate metrics for the Admin Dashboard.
 */
export async function fetchAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error) {
    console.error('Error fetching admin stats:', error);
    throw new Error(error.message || 'Nabigong kumuha ng admin metrics.');
  }

  const d = data as any;
  return {
    totalUsers: d.total_users || 0,
    pendingUsers: d.pending_users || 0,
    activeItems: d.active_items || 0,
    officeItems: d.office_items || 0,
    pendingClaims: d.pending_claims || 0,
    openDisputes: d.open_disputes || 0,
    totalReturns: d.total_returns || 0,
    unresolvedReports: d.unresolved_reports || 0,
  };
}

/**
 * Fetches user accounts with optional filtering (all, pending approval, suspended).
 */
export async function fetchAdminUsers(
  filter: 'all' | 'pending' | 'suspended' = 'all'
): Promise<Profile[]> {
  let query = supabase
    .from('profiles')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (filter === 'pending') {
    query = query.eq('approval_status', 'pending');
  } else if (filter === 'suspended') {
    query = query.eq('is_suspended', true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message || 'Failed to fetch users.');
  return data || [];
}

/**
 * Approves or rejects a student registration.
 */
export async function setUserApproval(
  targetUserId: string,
  newStatus: ApprovalStatus
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_user_approval', {
    p_target_user_id: targetUserId,
    p_new_status: newStatus,
  });
  if (error) throw new Error(error.message || 'Failed to update approval status.');
}

/**
 * Suspends or restores a student account.
 */
export async function setUserSuspended(
  targetUserId: string,
  isSuspended: boolean,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_user_suspended', {
    p_target_user_id: targetUserId,
    p_is_suspended: isSuspended,
    p_reason: reason,
  });
  if (error) throw new Error(error.message || 'Failed to update suspension status.');
}

/**
 * Moderates an item (hide, restore, soft-delete).
 */
export async function moderateItem(
  targetItemId: string,
  action: 'hide' | 'restore' | 'delete',
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc('admin_moderate_item', {
    p_target_item_id: targetItemId,
    p_action: action,
    p_reason: reason,
  });
  if (error) throw new Error(error.message || 'Failed to moderate item.');
}

/**
 * Fetches reports with associated item titles and reporter profiles.
 */
export async function fetchAdminReports(): Promise<ReportWithDetails[]> {
  const { data: reports, error: reportErr } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (reportErr || !reports) return [];

  // Enrich with item details if target_type is 'item'
  const itemIds = reports
    .filter((r) => r.target_type === 'item')
    .map((r) => r.target_id);

  let itemMap = new Map<string, Item>();
  if (itemIds.length > 0) {
    const { data: items } = await supabase
      .from('items')
      .select('*')
      .in('id', itemIds);
    if (items) {
      items.forEach((it) => itemMap.set(it.id, it));
    }
  }

  // Enrich with reporter nicknames
  const reporterIds = Array.from(new Set(reports.map((r) => r.reporter_id)));
  let reporterMap = new Map<string, string>();
  if (reporterIds.length > 0) {
    const { data: reporters } = await supabase
      .from('profiles')
      .select('id, nickname')
      .in('id', reporterIds);
    if (reporters) {
      reporters.forEach((rp) => reporterMap.set(rp.id, rp.nickname));
    }
  }

  return reports.map((r) => ({
    ...r,
    targetItem: itemMap.get(r.target_id),
    reporterNickname: reporterMap.get(r.reporter_id),
  }));
}

/**
 * Fetches open and resolved disputes.
 */
export async function fetchAdminDisputes(): Promise<DisputeWithDetails[]> {
  const { data: disputes, error } = await supabase
    .from('disputes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !disputes) return [];

  const itemIds = disputes.map((d) => d.item_id);
  const raiserIds = disputes.map((d) => d.raised_by);

  const [itemsRes, raisersRes] = await Promise.all([
    supabase.from('items').select('id, title, category').in('id', itemIds),
    supabase.from('profiles').select('id, nickname, college').in('id', raiserIds),
  ]);

  const itemMap = new Map(itemsRes.data?.map((i) => [i.id, i]));
  const raiserMap = new Map(raisersRes.data?.map((r) => [r.id, r]));

  return disputes.map((d) => {
    const it = itemMap.get(d.item_id);
    const raiser = raiserMap.get(d.raised_by);
    return {
      ...d,
      itemTitle: it?.title,
      itemCategory: it?.category,
      raiserNickname: raiser?.nickname,
      raiserCollege: raiser?.college,
    };
  });
}

/**
 * Resolves a dispute with notes.
 */
export async function resolveDispute(
  disputeId: string,
  resolutionNote: string
): Promise<void> {
  const { error } = await supabase.rpc('admin_resolve_dispute', {
    p_dispute_id: disputeId,
    p_resolution_note: resolutionNote,
  });
  if (error) throw new Error(error.message || 'Failed to resolve dispute.');
}

/**
 * Controlled Point Reversal (Section 23).
 * Inserts negative points_log entry, records reason, and writes audit log.
 */
export async function reverseUserPoints(
  targetUserId: string,
  targetItemId: string,
  pointsToDeduct: number,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc('admin_reverse_points', {
    p_target_user_id: targetUserId,
    p_target_item_id: targetItemId,
    p_points_to_deduct: pointsToDeduct,
    p_reason: reason,
  });
  if (error) throw new Error(error.message || 'Failed to reverse points.');
}

/**
 * Overrides a 3-attempt lockout on claim verification (Section 22).
 */
export async function overrideClaimLockout(
  itemId: string,
  userId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc('admin_override_lockout', {
    p_item_id: itemId,
    p_user_id: userId,
    p_reason: reason,
  });
  if (error) throw new Error(error.message || 'Failed to override lockout.');
}

/**
 * Fetches admin audit trail records (immutable).
 */
export async function fetchAdminAuditLogs(limit: number = 50): Promise<AdminAuditLog[]> {
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message || 'Failed to fetch audit logs.');
  return data || [];
}

/**
 * Fetches background job logs.
 */
export async function fetchJobLogs(limit: number = 50): Promise<JobLog[]> {
  const { data, error } = await supabase
    .from('job_logs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message || 'Failed to fetch job logs.');
  return data || [];
}

/**
 * Fetches office settings and allows admin updates.
 */
export async function fetchOfficeSettings(): Promise<OfficeSettings | null> {
  const { data, error } = await supabase
    .from('office_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message || 'Failed to fetch office settings.');
  return data;
}

export async function updateOfficeSettings(
  settings: Partial<OfficeSettings> & { id: string }
): Promise<void> {
  const { error } = await supabase
    .from('office_settings')
    .update({
      office_name: settings.office_name,
      open_days: settings.open_days,
      open_time: settings.open_time,
      close_time: settings.close_time,
      location_note: settings.location_note,
    })
    .eq('id', settings.id);

  if (error) throw new Error(error.message || 'Failed to update office settings.');
}
