import { supabase } from '@/lib/supabase';

export interface JobExecutionResult {
  jobName: string;
  processedCount: number;
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Job 1: Auto-Confirm Released Items (Section 15, 34; JOB-02)
 * Auto-confirms items that have been in 'released' status for 7 days without an open dispute.
 * Awards +50 points to finder, +0 confirmation bonus to owner, unlocks badges,
 * updates status to 'returned', and logs to job_logs.
 */
export async function runAutoConfirmJob(): Promise<JobExecutionResult> {
  try {
    const { data, error } = await supabase.rpc('auto_confirm_released_items');

    if (error) {
      console.error('Auto-confirm job error:', error);
      return {
        jobName: 'auto_confirm',
        processedCount: 0,
        success: false,
        error: error.message,
      };
    }

    const count = typeof data === 'number' ? data : 0;
    return {
      jobName: 'auto_confirm',
      processedCount: count,
      success: true,
      message: `Naiproseso ang ${count} na na-release na item para sa auto-confirmation.`,
    };
  } catch (err: any) {
    return {
      jobName: 'auto_confirm',
      processedCount: 0,
      success: false,
      error: err.message || 'Unknown error',
    };
  }
}

/**
 * Job 2: Item Expiration Job (Section 16, 34; JOB-01)
 * Flags items older than 30 days (expires_at <= now()) that are still 'open' or 'claim_requested'.
 * Found items are flagged as moved to the Lost & Found office (requires_office_pickup = true).
 * Lost items are archived. Both are logged to job_logs.
 */
export async function runItemExpirationJob(): Promise<JobExecutionResult> {
  try {
    const { data, error } = await supabase.rpc('expire_stale_items');

    if (error) {
      console.error('Item expiration job error:', error);
      return {
        jobName: 'item_expiration',
        processedCount: 0,
        success: false,
        error: error.message,
      };
    }

    const count = typeof data === 'number' ? data : 0;
    return {
      jobName: 'item_expiration',
      processedCount: count,
      success: true,
      message: `Nag-expire ang ${count} na lumang item.`,
    };
  } catch (err: any) {
    return {
      jobName: 'item_expiration',
      processedCount: 0,
      success: false,
      error: err.message || 'Unknown error',
    };
  }
}

/**
 * Job 3: Day 5 Reminder Job (Section 15, 34)
 * Sends a notification to the owner for items unconfirmed after 5 days,
 * warning them that 2 days remain before auto-confirmation.
 */
export async function runDay5ReminderJob(): Promise<JobExecutionResult> {
  try {
    const { data, error } = await supabase.rpc('remind_unconfirmed_claims');

    if (error) {
      console.error('Day 5 reminder job error:', error);
      return {
        jobName: 'day5_reminder',
        processedCount: 0,
        success: false,
        error: error.message,
      };
    }

    const count = typeof data === 'number' ? data : 0;
    return {
      jobName: 'day5_reminder',
      processedCount: count,
      success: true,
      message: `Nagpadala ng ${count} na paalala sa Day 5.`,
    };
  } catch (err: any) {
    return {
      jobName: 'day5_reminder',
      processedCount: 0,
      success: false,
      error: err.message || 'Unknown error',
    };
  }
}

/**
 * Job 4: Storage Photo Cleanup Job (Section 34; JOB-03)
 * Deletes photos from Supabase Storage for returned or expired items older than 60 days.
 * Calls the Supabase Storage API (`remove`) to delete physical files, clears `photo_path`,
 * and logs to `job_logs`.
 */
export async function runPhotoCleanupJob(): Promise<JobExecutionResult> {
  const startTime = new Date().toISOString();
  try {
    // 60 days cutoff
    const cutoffDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    // Query items eligible for photo deletion
    const { data: eligibleItems, error: queryError } = await supabase
      .from('items')
      .select('id, photo_path, status, released_at, created_at')
      .in('status', ['returned', 'expired'])
      .not('photo_path', 'is', null)
      .or(`released_at.lte.${cutoffDate},and(status.eq.expired,created_at.lte.${cutoffDate})`);

    if (queryError) {
      throw new Error(`Failed to query eligible items: ${queryError.message}`);
    }

    if (!eligibleItems || eligibleItems.length === 0) {
      await supabase.from('job_logs').insert({
        job_name: 'photo_cleanup',
        started_at: startTime,
        completed_at: new Date().toISOString(),
        status: 'success',
        error_message: '0 items found for photo cleanup.',
      });

      return {
        jobName: 'photo_cleanup',
        processedCount: 0,
        success: true,
        message: 'Walang lumang litrato na kailangang burahin.',
      };
    }

    const photoPaths = eligibleItems
      .map((item) => item.photo_path)
      .filter((p): p is string => Boolean(p));

    if (photoPaths.length > 0) {
      // Remove from storage bucket
      const { error: storageError } = await supabase.storage
        .from('item-photos')
        .remove(photoPaths);

      if (storageError) {
        console.warn('Storage deletion warning:', storageError.message);
      }

      // Clear photo_path on items
      const itemIds = eligibleItems.map((item) => item.id);
      await supabase
        .from('items')
        .update({ photo_path: null })
        .in('id', itemIds);
    }

    await supabase.from('job_logs').insert({
      job_name: 'photo_cleanup',
      started_at: startTime,
      completed_at: new Date().toISOString(),
      status: 'success',
      error_message: `Cleaned ${photoPaths.length} photos.`,
    });

    return {
      jobName: 'photo_cleanup',
      processedCount: photoPaths.length,
      success: true,
      message: `Matagumpay na nabura ang ${photoPaths.length} na lumang litrato mula sa storage (>60 araw).`,
    };
  } catch (err: any) {
    await supabase.from('job_logs').insert({
      job_name: 'photo_cleanup',
      started_at: startTime,
      completed_at: new Date().toISOString(),
      status: 'failed',
      error_message: err.message,
    });

    return {
      jobName: 'photo_cleanup',
      processedCount: 0,
      success: false,
      error: err.message || 'Unknown error',
    };
  }
}
