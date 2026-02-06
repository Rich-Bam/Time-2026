import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateToYYYYMMDD } from '@/utils/dateUtils';
import { Check, X, Calendar, Clock } from 'lucide-react';

interface SharedEntry {
  id: number;
  sharer_id: number;
  recipient_id: number;
  share_type: 'day' | 'week';
  share_date: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  message: string | null;
  sharer_name: string;
  sharer_email: string;
  entry_count: number;
}

interface SharedEntriesPanelProps {
  currentUserId: number;
  onAcceptSuccess?: () => void;
}

const SharedEntriesPanel: React.FC<SharedEntriesPanelProps> = ({
  currentUserId,
  onAcceptSuccess,
}) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [pendingShares, setPendingShares] = useState<SharedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [decliningId, setDecliningId] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewEntries, setPreviewEntries] = useState<any[]>([]);
  const [previewShare, setPreviewShare] = useState<SharedEntry | null>(null);
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState(false);
  const [pendingAcceptId, setPendingAcceptId] = useState<number | null>(null);

  useEffect(() => {
    fetchPendingShares();
  }, [currentUserId]);

  const fetchPendingShares = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shared_entries')
        .select(`
          *,
          sharer:users!shared_entries_sharer_id_fkey(name, email)
        `)
        .eq('recipient_id', currentUserId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get entry counts for each share
      const sharesWithCounts = await Promise.all(
        (data || []).map(async (share: any) => {
          const { data: items } = await supabase
            .from('shared_entry_items')
            .select('timesheet_entry_id')
            .eq('shared_entry_id', share.id);

          return {
            ...share,
            sharer_name: share.sharer?.name || 'Unknown',
            sharer_email: share.sharer?.email || '',
            entry_count: items?.length || 0,
          };
        })
      );

      setPendingShares(sharesWithCounts);
    } catch (error: any) {
      console.error('Error fetching pending shares:', error);
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to fetch shared entries',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (share: SharedEntry): string => {
    if (share.share_type === 'day') {
      const date = new Date(share.share_date);
      return date.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } else {
      const monday = new Date(share.share_date);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return `${monday.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
  };

  const previewShareEntries = async (share: SharedEntry) => {
    try {
      const { data: items, error: itemsError } = await supabase
        .from('shared_entry_items')
        .select('timesheet_entry_id')
        .eq('shared_entry_id', share.id);

      if (itemsError) throw itemsError;

      const entryIds = items?.map((item) => item.timesheet_entry_id) || [];

      if (entryIds.length === 0) {
        setPreviewEntries([]);
        setPreviewShare(share);
        setPreviewOpen(true);
        return;
      }

      const { data: entries, error: entriesError } = await supabase
        .from('timesheet')
        .select('*')
        .in('id', entryIds)
        .order('date', { ascending: true })
        .order('startTime', { ascending: true });

      if (entriesError) throw entriesError;

      setPreviewEntries(entries || []);
      setPreviewShare(share);
      setPreviewOpen(true);
    } catch (error: any) {
      console.error('Error fetching preview entries:', error);
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to fetch entries',
        variant: 'destructive',
      });
    }
  };

  const checkExistingEntries = async (share: SharedEntry): Promise<boolean> => {
    if (share.share_type === 'day') {
      const { data } = await supabase
        .from('timesheet')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('date', share.share_date)
        .maybeSingle();
      return !!data;
    } else {
      const monday = new Date(share.share_date);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const mondayStr = monday.toISOString().split('T')[0];
      const sundayStr = sunday.toISOString().split('T')[0];
      const { data } = await supabase
        .from('timesheet')
        .select('id')
        .eq('user_id', currentUserId)
        .gte('date', mondayStr)
        .lte('date', sundayStr)
        .limit(1);
      return (data?.length || 0) > 0;
    }
  };

  // Copy sharer's overnight stay for share_date to recipient (if sharer had one)
  const copyOvernightStayForShare = async (sharerId: number, shareDate: string) => {
    const { data: sharerOvernight } = await supabase
      .from('overnight_stays')
      .select('date')
      .eq('user_id', sharerId)
      .eq('date', shareDate)
      .maybeSingle();

    if (sharerOvernight) {
      await supabase
        .from('overnight_stays')
        .upsert([{ user_id: currentUserId, date: shareDate }], { onConflict: 'user_id,date' });
    }
  };

  const handleAccept = async (share: SharedEntry, skipConfirm = false) => {
    setAcceptingId(share.id);
    try {
      // Get all shared entry items (may be empty for overnight-only share)
      const { data: items, error: itemsError } = await supabase
        .from('shared_entry_items')
        .select('timesheet_entry_id')
        .eq('shared_entry_id', share.id);

      if (itemsError) throw itemsError;

      const isOvernightOnlyShare = !items || items.length === 0;

      // For shares with timesheet entries, check if recipient has existing entries (overwrite confirm)
      if (!isOvernightOnlyShare && !skipConfirm) {
        const hasExisting = await checkExistingEntries(share);
        if (hasExisting) {
          setAcceptingId(null);
          setPendingAcceptId(share.id);
          setOverwriteConfirmOpen(true);
          return;
        }
      }

      if (isOvernightOnlyShare) {
        // Overnight-only day: no timesheet entries to copy; do not delete recipient's entries. Only copy overnight stay.
        await copyOvernightStayForShare(share.sharer_id, share.share_date);

        const { error: updateError } = await supabase
          .from('shared_entries')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString(),
          })
          .eq('id', share.id);

        if (updateError) throw updateError;

        toast({
          title: t('share.accepted'),
          description: t('share.acceptedDescription'),
        });

        fetchPendingShares();
        if (onAcceptSuccess) {
          onAcceptSuccess();
        }
        return;
      }

      const entryIds = items.map((item) => item.timesheet_entry_id);

      // Fetch original entries
      const { data: originalEntries, error: entriesError } = await supabase
        .from('timesheet')
        .select('*')
        .in('id', entryIds);

      if (entriesError) throw entriesError;

      if (!originalEntries || originalEntries.length === 0) {
        throw new Error('Original entries not found');
      }

      // Check and delete existing entries if needed
      if (share.share_type === 'day') {
        await supabase
          .from('timesheet')
          .delete()
          .eq('user_id', currentUserId)
          .eq('date', share.share_date);
      } else {
        const monday = new Date(share.share_date);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const mondayStr = monday.toISOString().split('T')[0];
        const sundayStr = sunday.toISOString().split('T')[0];
        await supabase
          .from('timesheet')
          .delete()
          .eq('user_id', currentUserId)
          .gte('date', mondayStr)
          .lte('date', sundayStr);
      }

      // Create new entries with recipient's user_id
      const newEntries = originalEntries.map((entry) => ({
        user_id: currentUserId,
        date: entry.date,
        hours: entry.hours,
        description: entry.description,
        project: entry.project,
        startTime: entry.startTime,
        endTime: entry.endTime,
        stayed_overnight: entry.stayed_overnight,
      }));

      const { error: insertError } = await supabase
        .from('timesheet')
        .insert(newEntries);

      if (insertError) throw insertError;

      // Copy sharer's overnight stay for this date to recipient (so UI shows overnight checkbox)
      await copyOvernightStayForShare(share.sharer_id, share.share_date);

      // Update share status
      const { error: updateError } = await supabase
        .from('shared_entries')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', share.id);

      if (updateError) throw updateError;

      toast({
        title: t('share.accepted'),
        description: t('share.acceptedDescription'),
      });

      fetchPendingShares();
      if (onAcceptSuccess) {
        onAcceptSuccess();
      }
    } catch (error: any) {
      console.error('Error accepting share:', error);
      toast({
        title: t('share.acceptError'),
        description: t('share.acceptErrorDescription', { error: error.message }),
        variant: 'destructive',
      });
    } finally {
      setAcceptingId(null);
      setOverwriteConfirmOpen(false);
      setPendingAcceptId(null);
    }
  };

  const handleDecline = async (share: SharedEntry) => {
    setDecliningId(share.id);
    try {
      const { error } = await supabase
        .from('shared_entries')
        .update({ status: 'declined' })
        .eq('id', share.id);

      if (error) throw error;

      toast({
        title: t('share.declined'),
        description: t('share.declinedDescription'),
      });

      fetchPendingShares();
    } catch (error: any) {
      console.error('Error declining share:', error);
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to decline share',
        variant: 'destructive',
      });
    } finally {
      setDecliningId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center text-sm text-gray-500">
            {t('common.loading')}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingShares.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('share.pendingSharesTitle')}
            <Badge variant="secondary">{pendingShares.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingShares.map((share) => (
            <div
              key={share.id}
              className="border rounded-lg p-3 space-y-2 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium">
                    {t('share.sharedBy', { name: share.sharer_name })}
                  </div>
                  <div className="text-sm text-gray-500">
                    {share.share_type === 'day'
                      ? t('share.sharedDate', { date: getDateRange(share) })
                      : t('share.sharedWeek', { week: getDateRange(share) })}
                  </div>
                  {share.message && (
                    <div className="text-sm text-gray-600 mt-1 italic">
                      "{share.message}"
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {t('share.entriesPreview', { count: share.entry_count })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => previewShareEntries(share)}
                  className="flex-1"
                >
                  {t('share.previewEntries')}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleAccept(share)}
                  disabled={acceptingId === share.id || decliningId === share.id}
                  className="flex-1"
                >
                  {acceptingId === share.id ? (
                    t('share.accepting')
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      {t('share.accept')}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDecline(share)}
                  disabled={acceptingId === share.id || decliningId === share.id}
                >
                  {decliningId === share.id ? (
                    t('share.declining')
                  ) : (
                    <>
                      <X className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('share.previewEntries')}</DialogTitle>
            <DialogDescription>
              {previewShare &&
                (previewShare.share_type === 'day'
                  ? t('share.sharedDate', { date: getDateRange(previewShare) })
                  : t('share.sharedWeek', { week: getDateRange(previewShare) }))}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {previewEntries.length === 0 ? (
              <div className="text-center text-gray-500 py-4">
                {t('share.noEntries')}
              </div>
            ) : (
              previewEntries.map((entry, idx) => (
                <div
                  key={idx}
                  className="border rounded p-3 text-sm space-y-1"
                >
                  <div className="font-medium">{entry.date}</div>
                  <div className="text-gray-600">
                    {entry.description} - {entry.project || 'N/A'}
                  </div>
                  <div className="text-gray-500">
                    {entry.startTime && entry.endTime
                      ? `${entry.startTime} - ${entry.endTime}`
                      : ''}{' '}
                    ({entry.hours}h)
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>
              {t('share.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overwrite Confirmation Dialog */}
      <Dialog open={overwriteConfirmOpen} onOpenChange={setOverwriteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('share.overwriteConfirm')}</DialogTitle>
            <DialogDescription>
              {pendingAcceptId &&
                (() => {
                  const share = pendingShares.find((s) => s.id === pendingAcceptId);
                  return share
                    ? t('share.overwriteConfirmDescription', {
                        date: getDateRange(share),
                      })
                    : '';
                })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOverwriteConfirmOpen(false);
                setPendingAcceptId(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (pendingAcceptId) {
                  const share = pendingShares.find((s) => s.id === pendingAcceptId);
                  if (share) {
                    handleAccept(share, true);
                  }
                }
              }}
            >
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SharedEntriesPanel;
