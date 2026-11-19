import { supabase } from '@/lib/supabase';

export interface JobExecutionResult {
  jobName: string;
  processedCount: number;
  success: boolean;
  message?: string;
  error?: string;
}

type MaintenanceJob = 'auto_confirm' | 'expiration' | 'reminders' | 'photo_cleanup';

async function runJob(job: MaintenanceJob): Promise<JobExecutionResult> {
  const { data, error } = await supabase.functions.invoke<{
    results: Partial<Record<MaintenanceJob, number | { error: string }>>;
  }>('scheduled-jobs', { body: { job } });
  const result = data?.results?.[job];
  if (error || typeof result !== 'number') {
    return {
      jobName: job,
      processedCount: 0,
      success: false,
      error: typeof result === 'object' ? result.error : 'Hindi naisagawa ang maintenance job. Suriin ang pahintulot at koneksyon.',
    };
  }
  return { jobName: job, processedCount: result, success: true, message: `Naiproseso ang ${result}.` };
}

export const runAutoConfirmJob = () => runJob('auto_confirm');
export const runItemExpirationJob = () => runJob('expiration');
export const runDay5ReminderJob = () => runJob('reminders');
export const runPhotoCleanupJob = () => runJob('photo_cleanup');
