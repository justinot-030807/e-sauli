import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  fetchAdminStats,
  fetchAdminUsers,
  fetchAdminReports,
  fetchAdminDisputes,
  fetchAdminAuditLogs,
  fetchJobLogs,
  fetchOfficeSettings,
  updateOfficeSettings,
  setUserApproval,
  setUserSuspended,
  moderateItem,
  resolveDispute,
  reverseUserPoints,
  overrideClaimLockout,
  AdminStats,
  ReportWithDetails,
  DisputeWithDetails,
} from '@/services/admin';
import {
  runAutoConfirmJob,
  runItemExpirationJob,
  runDay5ReminderJob,
  runPhotoCleanupJob,
} from '@/services/jobs';
import { markItemAsReturned } from '@/services/returns';
import type { Profile, AdminAuditLog, JobLog, OfficeSettings, ApprovalStatus } from '@/types/database';
import { LoadingView, ErrorView } from '@/components/StateViews';

type AdminTab = 'claims' | 'users' | 'reports' | 'disputes' | 'office' | 'audit' | 'jobs';

export default function AdminDashboardScreen() {
  const { profile } = useAuthContext();

  const [activeTab, setActiveTab] = useState<AdminTab>('claims');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab Data States
  const [users, setUsers] = useState<Profile[]>([]);
  const [userFilter, setUserFilter] = useState<'all' | 'pending' | 'suspended'>('pending');
  const [reports, setReports] = useState<ReportWithDetails[]>([]);
  const [disputes, setDisputes] = useState<DisputeWithDetails[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [jobLogs, setJobLogs] = useState<JobLog[]>([]);
  const [officeSettings, setOfficeSettings] = useState<OfficeSettings | null>(null);

  // Modals
  const [showPointModal, setShowPointModal] = useState(false);
  const [selectedUserForPoints, setSelectedUserForPoints] = useState<Profile | null>(null);
  const [pointsToDeduct, setPointsToDeduct] = useState('');
  const [pointDeductReason, setPointDeductReason] = useState('');
  const [targetItemIdForPoints, setTargetItemIdForPoints] = useState('');

  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<DisputeWithDetails | null>(null);
  const [disputeResolutionNote, setDisputeResolutionNote] = useState('');

  const [showLockoutModal, setShowLockoutModal] = useState(false);
  const [lockoutItemId, setLockoutItemId] = useState('');
  const [lockoutUserId, setLockoutUserId] = useState('');
  const [lockoutReason, setLockoutReason] = useState('Personal identification verified in Lost & Found office.');

  const [actionLoading, setActionLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      const s = await fetchAdminStats();
      setStats(s);

      // Load specific tab data based on selection
      if (activeTab === 'users') {
        const u = await fetchAdminUsers(userFilter);
        setUsers(u);
      } else if (activeTab === 'reports') {
        const r = await fetchAdminReports();
        setReports(r);
      } else if (activeTab === 'disputes') {
        const d = await fetchAdminDisputes();
        setDisputes(d);
      } else if (activeTab === 'audit') {
        const a = await fetchAdminAuditLogs(40);
        setAuditLogs(a);
      } else if (activeTab === 'jobs') {
        const j = await fetchJobLogs(40);
        setJobLogs(j);
      } else if (activeTab === 'office') {
        const off = await fetchOfficeSettings();
        setOfficeSettings(off);
      }
    } catch (err: any) {
      console.error('Error loading admin dashboard:', err);
      setError(err?.message || 'Nabigong karga ang admin dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, userFilter]);

  useEffect(() => {
    setLoading(true);
    loadDashboard();
  }, [loadDashboard]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  // Auth Guard
  if (profile && profile.role !== 'admin') {
    return (
      <View style={styles.unauthorizedContainer}>
        <Stack.Screen options={{ title: 'Access Denied', headerShown: true }} />
        
        <Text style={styles.unauthorizedTitle}>Walang Pahintulot</Text>
        <Text style={styles.unauthorizedText}>
          Ang screen na ito ay para lamang sa mga administrator ng Lost & Found Office.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Bumalik</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // User Actions
  const handleApproval = async (targetUser: Profile, newStatus: ApprovalStatus) => {
    try {
      setActionLoading(true);
      await setUserApproval(targetUser.id, newStatus);
      Alert.alert('Tagumpay', `Naitakda ang status ng user kay ${newStatus.toUpperCase()}.`);
      loadDashboard();
    } catch (err: any) {
      Alert.alert('May Error', err?.message || 'Nabigo ang aksyon.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspension = (targetUser: Profile) => {
    const nextState = !targetUser.is_suspended;
    Alert.alert(
      nextState ? 'Isuspinde ang User' : 'Ibalik ang Access',
      `Sigurado ka bang nais mong ${nextState ? 'isuspinde' : 'ibalik'} ang account ni ${targetUser.nickname}?`,
      [
        { text: 'Kanselahin', style: 'cancel' },
        {
          text: 'Ituloy',
          style: nextState ? 'destructive' : 'default',
          onPress: async () => {
            try {
              setActionLoading(true);
              await setUserSuspended(
                targetUser.id,
                nextState,
                nextState ? 'Pansamantalang sinuspinde ng administrator dahil sa ulat o paglabag.' : 'Pagsusuri nakumpleto.'
              );
              Alert.alert('Tagumpay', `Na-update ang suspension status ng user.`);
              loadDashboard();
            } catch (err: any) {
              Alert.alert('May Error', err?.message || 'Nabigo ang aksyon.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Item Moderation
  const handleModerateItem = async (itemId: string, action: 'hide' | 'restore' | 'delete') => {
    try {
      setActionLoading(true);
      await moderateItem(itemId, action, 'Inaksyunan ng administrator sa Reports review.');
      Alert.alert('Tagumpay', `Naisagawa ang aksyong "${action}" sa item.`);
      loadDashboard();
    } catch (err: any) {
      Alert.alert('May Error', err?.message || 'Nabigo ang moderation action.');
    } finally {
      setActionLoading(false);
    }
  };

  // Resolve Dispute
  const handleResolveDispute = async () => {
    if (!selectedDispute || !disputeResolutionNote.trim()) {
      Alert.alert('Puna', 'Pakisulat ang resolusyon ng dispute.');
      return;
    }
    try {
      setActionLoading(true);
      await resolveDispute(selectedDispute.id, disputeResolutionNote.trim());
      setShowDisputeModal(false);
      setDisputeResolutionNote('');
      Alert.alert('Dispute Naresolba', 'Matagumpay na minarkahan ang dispute bilang resolved.');
      loadDashboard();
    } catch (err: any) {
      Alert.alert('May Error', err?.message || 'Nabigong lutasin ang dispute.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reverse Points
  const handleReversePoints = async () => {
    if (!selectedUserForPoints || !pointsToDeduct || !pointDeductReason.trim()) {
      Alert.alert('Kulang na Datos', 'Punan ang lahat ng kinakailangang field.');
      return;
    }
    const pts = parseInt(pointsToDeduct, 10);
    if (isNaN(pts) || pts <= 0) {
      Alert.alert('Maling Input', 'Dapat positibong numero ang ibabawas na puntos.');
      return;
    }
    try {
      setActionLoading(true);
      await reverseUserPoints(
        selectedUserForPoints.id,
        targetItemIdForPoints.trim() || '00000000-0000-0000-0000-000000000000',
        pts,
        pointDeductReason.trim()
      );
      setShowPointModal(false);
      setPointsToDeduct('');
      setPointDeductReason('');
      setTargetItemIdForPoints('');
      Alert.alert('Points Reversed', `Matagumpay na naibawas ang ${pts} Aura points at naitala sa audit log.`);
      loadDashboard();
    } catch (err: any) {
      Alert.alert('May Error', err?.message || 'Nabigong bawasan ang puntos.');
    } finally {
      setActionLoading(false);
    }
  };

  // Override Lockout
  const handleOverrideLockout = async () => {
    if (!lockoutItemId.trim() || !lockoutUserId.trim()) {
      Alert.alert('Kulang na Datos', 'Punan ang Item ID at User ID.');
      return;
    }
    try {
      setActionLoading(true);
      await overrideClaimLockout(lockoutItemId.trim(), lockoutUserId.trim(), lockoutReason.trim());
      setShowLockoutModal(false);
      setLockoutItemId('');
      setLockoutUserId('');
      Alert.alert('Lockout Overridden', 'Matagumpay na naalis ang verification lockout para sa user.');
      loadDashboard();
    } catch (err: any) {
      Alert.alert('May Error', err?.message || 'Nabigong alisin ang lockout.');
    } finally {
      setActionLoading(false);
    }
  };

  // Run Scheduled Jobs Manually
  const handleTriggerJob = async (jobName: 'auto_confirm' | 'expiration' | 'day5' | 'cleanup') => {
    try {
      setActionLoading(true);
      let res;
      if (jobName === 'auto_confirm') res = await runAutoConfirmJob();
      else if (jobName === 'expiration') res = await runItemExpirationJob();
      else if (jobName === 'day5') res = await runDay5ReminderJob();
      else res = await runPhotoCleanupJob();

      Alert.alert('Job Run Result', res.message || (res.success ? 'Success' : res.error || 'Failed'));
      loadDashboard();
    } catch (err: any) {
      Alert.alert('Job Error', err?.message || 'Failed to trigger job.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7B1123']} />}
    >
      <Stack.Screen
        options={{
          title: 'E-Sauli Admin',
          headerStyle: { backgroundColor: '#7B1123' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '800' },
        }}
      />

      {/* Admin Title Header */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.adminTitle}>E-Sauli Admin</Text>
          <Text style={styles.adminSubtitle}>Campus Lost & Found Management Panel</Text>
        </View>
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>ADMIN</Text>
        </View>
      </View>

      {/* 3 Metric Cards (Mockup Screen 7) */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, { backgroundColor: '#FFFFFF', borderColor: '#E6DCCF' }]}>
          <Text style={[styles.metricValue, { color: '#7B1123' }]}>{stats?.officeItems || 0}</Text>
          <Text style={styles.metricLabel}>Naka-imbak</Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: '#FFF6DC', borderColor: '#F0DDA0' }]}>
          <Text style={[styles.metricValue, { color: '#5A4000' }]}>{stats?.pendingClaims || 0}</Text>
          <Text style={[styles.metricLabel, { color: '#4A3600' }]}>May claim</Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: '#E3F1E7', borderColor: '#BFDDC8' }]}>
          <Text style={[styles.metricValue, { color: '#1E5B32' }]}>{stats?.totalReturns || 0}</Text>
          <Text style={[styles.metricLabel, { color: '#1E5B32' }]}>Naibalik</Text>
        </View>
      </View>

      {/* Navigation Sub-Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScroll}
        style={styles.tabsWrapper}
      >
        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'claims' && styles.tabChipActive]}
          onPress={() => setActiveTab('claims')}
        >
          <Text style={[styles.tabChipText, activeTab === 'claims' && styles.tabChipTextActive]}>
            Mga Claim & Items
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'users' && styles.tabChipActive]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabChipText, activeTab === 'users' && styles.tabChipTextActive]}>
            Mga User ({stats?.pendingUsers ? `${stats.pendingUsers} Bago` : 'Lahat'})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'reports' && styles.tabChipActive]}
          onPress={() => setActiveTab('reports')}
        >
          <Text style={[styles.tabChipText, activeTab === 'reports' && styles.tabChipTextActive]}>
            Mga Report ({stats?.unresolvedReports || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'disputes' && styles.tabChipActive]}
          onPress={() => setActiveTab('disputes')}
        >
          <Text style={[styles.tabChipText, activeTab === 'disputes' && styles.tabChipTextActive]}>
            Disputes ({stats?.openDisputes || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'office' && styles.tabChipActive]}
          onPress={() => setActiveTab('office')}
        >
          <Text style={[styles.tabChipText, activeTab === 'office' && styles.tabChipTextActive]}>
            Oras ng Opisina
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'audit' && styles.tabChipActive]}
          onPress={() => setActiveTab('audit')}
        >
          <Text style={[styles.tabChipText, activeTab === 'audit' && styles.tabChipTextActive]}>
            Audit Trail
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'jobs' && styles.tabChipActive]}
          onPress={() => setActiveTab('jobs')}
        >
          <Text style={[styles.tabChipText, activeTab === 'jobs' && styles.tabChipTextActive]}>
            Job Logs
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ================= TAB 1: CLAIMS & ITEMS ================= */}
      {activeTab === 'claims' && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionHeaderTitle}>Custody & Claim Review</Text>
            <TouchableOpacity
              style={styles.actionShortcutBtn}
              onPress={() => setShowLockoutModal(true)}
            >
              <Text style={styles.actionShortcutText}>Lockout Override</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardInfoTitle}>Mga Item na Kukunin sa Opisina</Text>
            <Text style={styles.cardInfoText}>
              Ang mga item sa kategoryang Cash, Wallet, at ID/Cards ay kailangan i-release nang personal sa opisina habang bukas.
            </Text>
            <TouchableOpacity
              style={styles.manageButton}
              onPress={() => router.push('/(tabs)')}
            >
              <Text style={styles.manageButtonText}>Mag-browse sa Feed para sa Office Items</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ================= TAB 2: USERS MANAGEMENT ================= */}
      {activeTab === 'users' && (
        <View style={styles.sectionContainer}>
          <View style={styles.filterRow}>
            {(['pending', 'all', 'suspended'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.subFilterChip, userFilter === f && styles.subFilterChipActive]}
                onPress={() => setUserFilter(f)}
              >
                <Text style={[styles.subFilterText, userFilter === f && styles.subFilterTextActive]}>
                  {f === 'pending' ? 'Pending Approval' : f === 'suspended' ? 'Suspended' : 'Lahat ng Mag-aaral'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {users.length === 0 ? (
            <Text style={styles.emptyText}>Walang user sa kategoryang ito.</Text>
          ) : (
            users.map((u) => (
              <View key={u.id} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{u.nickname.substring(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{u.full_name} ({u.nickname})</Text>
                    <Text style={styles.userMeta}>ID: {u.student_id} • {u.college}</Text>
                    <Text style={styles.userSubMeta}>
                      Status: {u.approval_status.toUpperCase()} • Puntos: {u.points}
                    </Text>
                  </View>
                </View>

                <View style={styles.userActionRow}>
                  {u.approval_status === 'pending' && (
                    <>
                      <TouchableOpacity
                        style={[styles.btnAction, styles.btnApprove]}
                        onPress={() => handleApproval(u, 'approved')}
                        disabled={actionLoading}
                      >
                        <Text style={styles.btnActionText}>Aprubahan</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnAction, styles.btnReject]}
                        onPress={() => handleApproval(u, 'rejected')}
                        disabled={actionLoading}
                      >
                        <Text style={styles.btnActionText}>Tanggihan</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  <TouchableOpacity
                    style={[styles.btnAction, u.is_suspended ? styles.btnRestore : styles.btnSuspend]}
                    onPress={() => handleSuspension(u)}
                    disabled={actionLoading}
                  >
                    <Text style={styles.btnActionText}>
                      {u.is_suspended ? 'Ibalik ang Access' : 'Isuspinde'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnAction, styles.btnDeduct]}
                    onPress={() => {
                      setSelectedUserForPoints(u);
                      setShowPointModal(true);
                    }}
                    disabled={actionLoading}
                  >
                    <Text style={styles.btnActionText}>Bawiin ang Puntos</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* ================= TAB 3: REPORTS & MODERATION ================= */}
      {activeTab === 'reports' && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>Mga Ulat ng Mag-aaral ({reports.length})</Text>
          {reports.length === 0 ? (
            <Text style={styles.emptyText}>Walang aktibong ulat.</Text>
          ) : (
            reports.map((rep) => (
              <View key={rep.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportReasonTag}>{rep.reason.toUpperCase()}</Text>
                  <Text style={styles.reportDate}>{new Date(rep.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.reportTargetText}>
                  Target: {rep.target_type.toUpperCase()} ({rep.targetItem?.title || rep.target_id})
                </Text>
                <Text style={styles.reporterText}>Naiulat ni: {rep.reporterNickname || 'Mag-aaral'}</Text>

                {rep.targetItem && (
                  <View style={styles.itemPreviewBox}>
                    <Text style={styles.itemPreviewTitle}>"{rep.targetItem.title}"</Text>
                    <Text style={styles.itemPreviewSub}>
                      Status: {rep.targetItem.status} • Hidden: {rep.targetItem.is_hidden ? 'YES' : 'NO'}
                    </Text>
                  </View>
                )}

                <View style={styles.reportBtnRow}>
                  <TouchableOpacity
                    style={[styles.btnAction, styles.btnSuspend]}
                    onPress={() => handleModerateItem(rep.target_id, 'hide')}
                    disabled={actionLoading}
                  >
                    <Text style={styles.btnActionText}>Itago ang Post</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnAction, styles.btnApprove]}
                    onPress={() => handleModerateItem(rep.target_id, 'restore')}
                    disabled={actionLoading}
                  >
                    <Text style={styles.btnActionText}>Ibalik ang Post</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnAction, styles.btnReject]}
                    onPress={() => handleModerateItem(rep.target_id, 'delete')}
                    disabled={actionLoading}
                  >
                    <Text style={styles.btnActionText}>Burahin</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* ================= TAB 4: DISPUTES ================= */}
      {activeTab === 'disputes' && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>Mga Inihain na Dispute ({disputes.length})</Text>
          {disputes.length === 0 ? (
            <Text style={styles.emptyText}>Walang bukas na dispute.</Text>
          ) : (
            disputes.map((disp) => (
              <View key={disp.id} style={styles.disputeCard}>
                <View style={styles.disputeHeader}>
                  <Text style={[styles.disputeStatusTag, disp.status === 'open' ? styles.statusOpen : styles.statusResolved]}>
                    {disp.status.toUpperCase()}
                  </Text>
                  <Text style={styles.disputeDate}>{new Date(disp.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.disputeItemTitle}>Item: {disp.itemTitle || disp.item_id}</Text>
                <Text style={styles.disputeRaiserText}>Inihain ni: {disp.raiserNickname} ({disp.raiserCollege})</Text>
                <Text style={styles.disputeReason}>Dahilan: {disp.reason}</Text>

                {disp.status === 'open' && (
                  <TouchableOpacity
                    style={styles.resolveBtn}
                    onPress={() => {
                      setSelectedDispute(disp);
                      setShowDisputeModal(true);
                    }}
                    disabled={actionLoading}
                  >
                    <Text style={styles.resolveBtnText}>Lutasin ang Dispute</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {/* ================= TAB 5: OFFICE SETTINGS ================= */}
      {activeTab === 'office' && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>Mga Oras ng Operasyon ng Opisina</Text>
          {officeSettings && (
            <View style={styles.card}>
              <Text style={styles.label}>Pangalan ng Opisina:</Text>
              <TextInput
                style={styles.input}
                value={officeSettings.office_name}
                onChangeText={(t) => setOfficeSettings({ ...officeSettings, office_name: t })}
              />

              <Text style={styles.label}>Mga Araw na Bukas (comma-separated):</Text>
              <TextInput
                style={styles.input}
                value={officeSettings.open_days.join(', ')}
                onChangeText={(t) =>
                  setOfficeSettings({
                    ...officeSettings,
                    open_days: t.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Bukas (HH:mm):</Text>
                  <TextInput
                    style={styles.input}
                    value={officeSettings.open_time}
                    onChangeText={(t) => setOfficeSettings({ ...officeSettings, open_time: t })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Sarado (HH:mm):</Text>
                  <TextInput
                    style={styles.input}
                    value={officeSettings.close_time}
                    onChangeText={(t) => setOfficeSettings({ ...officeSettings, close_time: t })}
                  />
                </View>
              </View>

              <Text style={styles.label}>Lokasyon / Tala:</Text>
              <TextInput
                style={styles.input}
                value={officeSettings.location_note || ''}
                onChangeText={(t) => setOfficeSettings({ ...officeSettings, location_note: t })}
              />

              <TouchableOpacity
                style={styles.saveSettingsBtn}
                onPress={async () => {
                  try {
                    setActionLoading(true);
                    await updateOfficeSettings(officeSettings);
                    Alert.alert('Tagumpay', 'Nai-save ang mga setting ng opisina.');
                  } catch (err: any) {
                    Alert.alert('May Error', err?.message || 'Nabigong i-save ang settings.');
                  } finally {
                    setActionLoading(false);
                  }
                }}
                disabled={actionLoading}
              >
                <Text style={styles.saveSettingsText}>I-save ang Settings</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ================= TAB 6: AUDIT TRAIL ================= */}
      {activeTab === 'audit' && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>Admin Audit Trail (Immutable)</Text>
          {auditLogs.length === 0 ? (
            <Text style={styles.emptyText}>Walang audit logs na naitala.</Text>
          ) : (
            auditLogs.map((log) => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <Text style={styles.logAction}>{log.action}</Text>
                  <Text style={styles.logDate}>{new Date(log.created_at).toLocaleString()}</Text>
                </View>
                <Text style={styles.logTarget}>Target: {log.target_type || 'N/A'} ({log.target_id || 'N/A'})</Text>
                {log.details && (
                  <Text style={styles.logDetails}>{JSON.stringify(log.details)}</Text>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {/* ================= TAB 7: JOB LOGS & SCHEDULING ================= */}
      {activeTab === 'jobs' && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>Scheduled Background Jobs</Text>

          <View style={styles.jobActionsCard}>
            <Text style={styles.jobActionsTitle}>Manu-manong Pagpapatakbo ng Jobs:</Text>
            <View style={styles.jobButtonsGrid}>
              <TouchableOpacity
                style={styles.jobBtn}
                onPress={() => handleTriggerJob('auto_confirm')}
                disabled={actionLoading}
              >
                <Text style={styles.jobBtnText}>▶ Auto-Confirm Job (7d)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.jobBtn}
                onPress={() => handleTriggerJob('expiration')}
                disabled={actionLoading}
              >
                <Text style={styles.jobBtnText}>▶ Expiration Job (30d)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.jobBtn}
                onPress={() => handleTriggerJob('day5')}
                disabled={actionLoading}
              >
                <Text style={styles.jobBtnText}>▶ Day 5 Reminder Job</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.jobBtn}
                onPress={() => handleTriggerJob('cleanup')}
                disabled={actionLoading}
              >
                <Text style={styles.jobBtnText}>▶ Photo Cleanup (&gt;60d)</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.sectionHeaderTitle, { marginTop: 16 }]}>Logs ng Pagpapatakbo ({jobLogs.length})</Text>
          {jobLogs.length === 0 ? (
            <Text style={styles.emptyText}>Walang job logs.</Text>
          ) : (
            jobLogs.map((jl) => (
              <View key={jl.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <Text style={styles.logAction}>{jl.job_name}</Text>
                  <Text
                    style={[
                      styles.statusTag,
                      jl.status === 'success' ? styles.statusSuccess : styles.statusFailed,
                    ]}
                  >
                    {jl.status.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.logDate}>
                  Nagsimula: {new Date(jl.started_at).toLocaleString()}
                </Text>
                {jl.error_message && (
                  <Text style={styles.logError}>Resulta: {jl.error_message}</Text>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {/* Point Reversal Modal (Section 23) */}
      <Modal visible={showPointModal} transparent animationType="fade" onRequestClose={() => setShowPointModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Bawiin ang Puntos (Section 23)</Text>
            <Text style={styles.modalSubtitle}>
              Mababawasan ang puntos ni {selectedUserForPoints?.nickname} at magtatala ng negatibong entry sa points_log.
            </Text>

            <Text style={styles.label}>Bilang ng Puntos na Ibabawas:</Text>
            <TextInput
              style={styles.input}
              placeholder="Hal: 50"
              keyboardType="number-pad"
              value={pointsToDeduct}
              onChangeText={setPointsToDeduct}
            />

            <Text style={styles.label}>Dahilan ng Pagbawi (Kailangan):</Text>
            <TextInput
              style={styles.input}
              placeholder="Hal: Peke o nagka-dispute na return"
              value={pointDeductReason}
              onChangeText={setPointDeductReason}
            />

            <Text style={styles.label}>Item ID (Opsyonal):</Text>
            <TextInput
              style={styles.input}
              placeholder="UUID ng item"
              value={targetItemIdForPoints}
              onChangeText={setTargetItemIdForPoints}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPointModal(false)}>
                <Text style={styles.modalCancelBtnText}>Kanselahin</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleReversePoints} disabled={actionLoading}>
                <Text style={styles.modalConfirmBtnText}>Ipatupad ang Pagbawi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Dispute Resolution Modal */}
      <Modal visible={showDisputeModal} transparent animationType="fade" onRequestClose={() => setShowDisputeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Lutasin ang Dispute</Text>
            <Text style={styles.modalSubtitle}>Item: {selectedDispute?.itemTitle}</Text>

            <Text style={styles.label}>Opisyal na Resolusyon / Paliwanag:</Text>
            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
              placeholder="Isulat ang opisyal na findings at desisyon ng administrator..."
              multiline
              value={disputeResolutionNote}
              onChangeText={setDisputeResolutionNote}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowDisputeModal(false)}>
                <Text style={styles.modalCancelBtnText}>Kanselahin</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleResolveDispute} disabled={actionLoading}>
                <Text style={styles.modalConfirmBtnText}>I-resolve ang Dispute</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Lockout Override Modal */}
      <Modal visible={showLockoutModal} transparent animationType="fade" onRequestClose={() => setShowLockoutModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Override Claim Lockout</Text>
            <Text style={styles.modalSubtitle}>
              I-reset ang automated attempt lockout para sa lehitimong claimant na na-lockout pagkatapos ng 3 maling sagot.
            </Text>

            <Text style={styles.label}>Item ID (UUID):</Text>
            <TextInput
              style={styles.input}
              placeholder="UUID ng item"
              value={lockoutItemId}
              onChangeText={setLockoutItemId}
            />

            <Text style={styles.label}>User ID (Claimant UUID):</Text>
            <TextInput
              style={styles.input}
              placeholder="UUID ng claimant"
              value={lockoutUserId}
              onChangeText={setLockoutUserId}
            />

            <Text style={styles.label}>Dahilan ng Override:</Text>
            <TextInput
              style={styles.input}
              value={lockoutReason}
              onChangeText={setLockoutReason}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowLockoutModal(false)}>
                <Text style={styles.modalCancelBtnText}>Kanselahin</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleOverrideLockout} disabled={actionLoading}>
                <Text style={styles.modalConfirmBtnText}>I-override ang Lockout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF8F3' },
  content: { padding: 16, paddingBottom: 50 },
  unauthorizedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  unauthorizedTitle: { fontSize: 22, fontWeight: '800', color: '#7B1123', marginBottom: 8 },
  unauthorizedText: { fontSize: 14, color: '#6B5A5E', textAlign: 'center', marginBottom: 20 },
  backButton: { backgroundColor: '#7B1123', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  backButtonText: { color: '#FFFFFF', fontWeight: '700' },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  adminTitle: { fontSize: 24, fontWeight: '900', color: '#7B1123' },
  adminSubtitle: { fontSize: 13, color: '#6B5A5E' },
  adminBadge: { backgroundColor: '#7B1123', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  adminBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  metricCard: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  metricValue: { fontSize: 24, fontWeight: '800' },
  metricLabel: { fontSize: 12, fontWeight: '600', marginTop: 2, color: '#6B5A5E' },
  tabsWrapper: { marginBottom: 16 },
  tabsScroll: { gap: 8 },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6DCCF',
  },
  tabChipActive: { backgroundColor: '#7B1123', borderColor: '#7B1123' },
  tabChipText: { fontSize: 13, fontWeight: '600', color: '#2A1E20' },
  tabChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  sectionContainer: { marginTop: 4 },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#2A1E20' },
  actionShortcutBtn: { backgroundColor: '#FFF6DC', borderWidth: 1, borderColor: '#F0DDA0', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  actionShortcutText: { fontSize: 12, fontWeight: '700', color: '#5A4000' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E6DCCF', marginBottom: 16 },
  cardInfoTitle: { fontSize: 15, fontWeight: '700', color: '#2A1E20', marginBottom: 4 },
  cardInfoText: { fontSize: 13, color: '#6B5A5E', lineHeight: 18, marginBottom: 12 },
  manageButton: { backgroundColor: '#7B1123', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  manageButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  subFilterChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6DCCF' },
  subFilterChipActive: { backgroundColor: '#7B1123', borderColor: '#7B1123' },
  subFilterText: { fontSize: 12, fontWeight: '600', color: '#6B5A5E' },
  subFilterTextActive: { color: '#FFFFFF', fontWeight: '700' },
  userCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E6DCCF', marginBottom: 10 },
  userHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFE6D8', alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { fontWeight: '800', color: '#5A4000', fontSize: 14 },
  userName: { fontSize: 14, fontWeight: '700', color: '#2A1E20' },
  userMeta: { fontSize: 12, color: '#6B5A5E' },
  userSubMeta: { fontSize: 11, color: '#7B1123', fontWeight: '600', marginTop: 1 },
  userActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  btnAction: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  btnApprove: { backgroundColor: '#E3F1E7' },
  btnReject: { backgroundColor: '#FFEBEE' },
  btnSuspend: { backgroundColor: '#FFF3E0' },
  btnRestore: { backgroundColor: '#E8F5E9' },
  btnDeduct: { backgroundColor: '#F3E5F5' },
  btnActionText: { fontSize: 11, fontWeight: '700', color: '#2A1E20' },
  emptyText: { fontSize: 13, color: '#9E9E9E', fontStyle: 'italic', paddingVertical: 16, textAlign: 'center' },
  reportCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E6DCCF', marginBottom: 10 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  reportReasonTag: { backgroundColor: '#FFEBEE', color: '#C62828', fontSize: 11, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  reportDate: { fontSize: 11, color: '#9E9E9E' },
  reportTargetText: { fontSize: 13, fontWeight: '700', color: '#2A1E20', marginTop: 4 },
  reporterText: { fontSize: 12, color: '#6B5A5E' },
  itemPreviewBox: { backgroundColor: '#FBF8F3', padding: 8, borderRadius: 8, marginVertical: 8 },
  itemPreviewTitle: { fontSize: 13, fontWeight: '700', color: '#2A1E20' },
  itemPreviewSub: { fontSize: 11, color: '#6B5A5E', marginTop: 2 },
  reportBtnRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  disputeCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E6DCCF', marginBottom: 10 },
  disputeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  disputeStatusTag: { fontSize: 11, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusOpen: { backgroundColor: '#FFF3E0', color: '#E65100' },
  statusResolved: { backgroundColor: '#E8F5E9', color: '#2E7D32' },
  disputeDate: { fontSize: 11, color: '#9E9E9E' },
  disputeItemTitle: { fontSize: 14, fontWeight: '700', color: '#2A1E20' },
  disputeRaiserText: { fontSize: 12, color: '#6B5A5E' },
  disputeReason: { fontSize: 13, color: '#C62828', marginTop: 4, fontStyle: 'italic' },
  resolveBtn: { backgroundColor: '#2E7D32', paddingVertical: 8, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  resolveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#2A1E20', marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: '#FBF8F3', borderWidth: 1, borderColor: '#E6DCCF', borderRadius: 10, padding: 10, fontSize: 13, color: '#2A1E20' },
  saveSettingsBtn: { backgroundColor: '#7B1123', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  saveSettingsText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  logCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E6DCCF', marginBottom: 8 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logAction: { fontSize: 13, fontWeight: '800', color: '#7B1123' },
  logDate: { fontSize: 11, color: '#9E9E9E' },
  logTarget: { fontSize: 12, color: '#6B5A5E', marginTop: 2 },
  logDetails: { fontSize: 11, color: '#4A3A2A', marginTop: 4, fontStyle: 'italic', backgroundColor: '#FBF8F3', padding: 6, borderRadius: 6 },
  logError: { fontSize: 11, color: '#C62828', marginTop: 2 },
  statusTag: { fontSize: 10, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  statusSuccess: { backgroundColor: '#E8F5E9', color: '#2E7D32' },
  statusFailed: { backgroundColor: '#FFEBEE', color: '#C62828' },
  jobActionsCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E6DCCF' },
  jobActionsTitle: { fontSize: 14, fontWeight: '700', color: '#2A1E20', marginBottom: 8 },
  jobButtonsGrid: { gap: 8 },
  jobBtn: { backgroundColor: '#F0EAE1', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  jobBtnText: { fontSize: 12, fontWeight: '700', color: '#3A0C14' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#2A1E20', marginBottom: 4 },
  modalSubtitle: { fontSize: 12, color: '#6B5A5E', marginBottom: 12 },
  modalCancelBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#E6DCCF', alignItems: 'center', justifyContent: 'center' },
  modalCancelBtnText: { fontWeight: '600', color: '#2A1E20' },
  modalConfirmBtn: { flex: 1, height: 44, borderRadius: 10, backgroundColor: '#7B1123', alignItems: 'center', justifyContent: 'center' },
  modalConfirmBtnText: { fontWeight: '700', color: '#FFFFFF' },
});
