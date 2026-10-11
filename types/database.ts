export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'student' | 'admin';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ItemType = 'lost' | 'found';
export type ItemStatus = 'open' | 'claim_requested' | 'verified' | 'released' | 'returned' | 'expired';
export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'auto_rejected';
export type DisputeStatus = 'open' | 'resolved';
export type ReportTargetType = 'item' | 'message' | 'user';
export type ReportReason = 'spam' | 'fake' | 'inappropriate' | 'scam';
export type JobStatus = 'running' | 'success' | 'failed';

export type Profile = {
  id: string;
  full_name: string;
  student_id: string;
  nickname: string;
  college: string;
  role: UserRole;
  approval_status: ApprovalStatus;
  consent_accepted_at: string | null;
  points: number;
  returns_count: number;
  is_suspended: boolean;
  created_at: string;
  deleted_at: string | null;
};

export type Item = {
  id: string;
  user_id: string;
  type: ItemType;
  title: string;
  description: string;
  category: string;
  location: string;
  date_happened: string;
  photo_path: string | null;
  status: ItemStatus;
  is_hidden: boolean;
  requires_office_pickup: boolean;
  released_at: string | null;
  auto_confirm_at: string | null;
  expires_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type ItemPrivate = {
  item_id: string;
  amount_hmac: string | null;
  private_details: string | null;
  updated_at: string;
};

export type Claim = {
  id: string;
  item_id: string;
  claimant_id: string;
  proof_text: string;
  status: ClaimStatus;
  created_at: string;
};

export type ClaimAttempt = {
  id: string;
  item_id: string;
  user_id: string;
  matched: boolean;
  created_at: string;
};

export type SecretQuestion = {
  id: string;
  item_id: string;
  question: string;
  answer_hmac: string;
};

export type Message = {
  id: string;
  claim_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  body: string;
  item_id: string | null;
  read: boolean;
  created_at: string;
};

export type Dispute = {
  id: string;
  item_id: string;
  raised_by: string;
  reason: string;
  status: DisputeStatus;
  admin_note: string | null;
  created_at: string;
};

export type Badge = {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  requirement: number;
};

export type UserBadge = {
  user_id: string;
  badge_id: string;
  earned_at: string;
};

export type PointsLog = {
  id: string;
  user_id: string;
  item_id: string | null;
  points: number;
  reason: string;
  event_key: string;
  created_at: string;
};

export type ThankYouNote = {
  id: string;
  item_id: string;
  from_user: string;
  to_user: string;
  note: string;
  created_at: string;
};

export type Report = {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  created_at: string;
};

export type OfficeSettings = {
  id: string;
  office_name: string;
  open_days: string[];
  open_time: string;
  close_time: string;
  location_note: string | null;
};

export type SystemSetting = {
  key: string;
  value: string;
  description: string | null;
};

export type AdminAuditLog = {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Json | null;
  created_at: string;
};

export type JobLog = {
  id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: JobStatus;
  error_message: string | null;
};

export type ClaimLockoutOverride = {
  id: string;
  item_id: string;
  user_id: string;
  admin_id: string;
  reason: string;
  created_at: string;
};

// Supabase client type helper
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'points' | 'returns_count' | 'created_at' | 'deleted_at'> & {
          points?: number;
          returns_count?: number;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Profile>;
        Relationships: [];
      };
      items: {
        Row: Item;
        Insert: Omit<Item, 'id' | 'status' | 'is_hidden' | 'requires_office_pickup' | 'released_at' | 'auto_confirm_at' | 'expires_at' | 'deleted_at' | 'created_at'> & {
          id?: string;
          status?: ItemStatus;
          is_hidden?: boolean;
          requires_office_pickup?: boolean;
          released_at?: string | null;
          auto_confirm_at?: string | null;
          expires_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Item>;
        Relationships: [];
      };
      item_private: {
        Row: ItemPrivate;
        Insert: Omit<ItemPrivate, 'updated_at'> & {
          updated_at?: string;
        };
        Update: Partial<ItemPrivate>;
        Relationships: [];
      };
      claims: {
        Row: Claim;
        Insert: Omit<Claim, 'id' | 'status' | 'created_at'> & {
          id?: string;
          status?: ClaimStatus;
          created_at?: string;
        };
        Update: Partial<Claim>;
        Relationships: [];
      };
      claim_attempts: {
        Row: ClaimAttempt;
        Insert: Omit<ClaimAttempt, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ClaimAttempt>;
        Relationships: [];
      };
      secret_questions: {
        Row: SecretQuestion;
        Insert: Omit<SecretQuestion, 'id'> & { id?: string };
        Update: Partial<SecretQuestion>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Message>;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'read' | 'created_at'> & {
          id?: string;
          read?: boolean;
          created_at?: string;
        };
        Update: Partial<Notification>;
        Relationships: [];
      };
      disputes: {
        Row: Dispute;
        Insert: Omit<Dispute, 'id' | 'status' | 'admin_note' | 'created_at'> & {
          id?: string;
          status?: DisputeStatus;
          admin_note?: string | null;
          created_at?: string;
        };
        Update: Partial<Dispute>;
        Relationships: [];
      };
      badges: {
        Row: Badge;
        Insert: Omit<Badge, 'id'> & { id?: string };
        Update: Partial<Badge>;
        Relationships: [];
      };
      user_badges: {
        Row: UserBadge;
        Insert: Omit<UserBadge, 'earned_at'> & { earned_at?: string };
        Update: Partial<UserBadge>;
        Relationships: [];
      };
      points_log: {
        Row: PointsLog;
        Insert: Omit<PointsLog, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<PointsLog>;
        Relationships: [];
      };
      thank_you_notes: {
        Row: ThankYouNote;
        Insert: Omit<ThankYouNote, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ThankYouNote>;
        Relationships: [];
      };
      reports: {
        Row: Report;
        Insert: Omit<Report, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Report>;
        Relationships: [];
      };
      office_settings: {
        Row: OfficeSettings;
        Insert: Omit<OfficeSettings, 'id'> & { id?: string };
        Update: Partial<OfficeSettings>;
        Relationships: [];
      };
      system_settings: {
        Row: SystemSetting;
        Insert: SystemSetting;
        Update: Partial<SystemSetting>;
        Relationships: [];
      };
      admin_audit_log: {
        Row: AdminAuditLog;
        Insert: Omit<AdminAuditLog, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<AdminAuditLog>;
        Relationships: [];
      };
      job_logs: {
        Row: JobLog;
        Insert: Omit<JobLog, 'id' | 'started_at'> & {
          id?: string;
          started_at?: string;
        };
        Update: Partial<JobLog>;
        Relationships: [];
      };
      claim_lockout_overrides: {
        Row: ClaimLockoutOverride;
        Insert: Omit<ClaimLockoutOverride, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ClaimLockoutOverride>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_public_profile: {
        Args: { target_user_id: string };
        Returns: {
          id: string;
          nickname: string;
          college: string;
          points: number;
          returns_count: number;
          created_at: string;
        }[];
      };
      get_item_questions: {
        Args: { p_item_id: string };
        Returns: {
          id: string;
          question: string;
        }[];
      };
      verify_claim_secret: {
        Args: { p_item_id: string; p_answer_hash: string };
        Returns: boolean;
      };
      delete_own_account: {
        Args: Record<string, never>;
        Returns: void;
      };
      confirm_item_return: {
        Args: { p_item_id: string; p_thank_you_note?: string | null };
        Returns: {
          success: boolean;
          base_points: number;
          speedy_bonus: number;
          thank_you_bonus: number;
          owner_bonus: number;
          total_points_finder: number;
          is_pair_limit_exceeded: boolean;
        };
      };
      auto_confirm_released_items: {
        Args: Record<string, never>;
        Returns: number;
      };
      expire_stale_items: {
        Args: Record<string, never>;
        Returns: number;
      };
      remind_unconfirmed_claims: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
  };
}
