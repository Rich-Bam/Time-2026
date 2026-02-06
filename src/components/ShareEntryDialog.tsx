import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Check, ChevronsUpDown, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDateToYYYYMMDD } from '@/utils/dateUtils';

// Helper function to get week dates (Monday to Sunday)
function getWeekDates(date: Date): Date[] {
  const start = new Date(date);
  start.setDate(date.getDate() - ((date.getDay() + 6) % 7)); // Monday as first day
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// Helper function to get ISO week number
function getISOWeekNumber(date: Date): number {
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
  const week1 = new Date(tempDate.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  );
}

interface ShareEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareType: 'day' | 'week';
  shareDate: Date;
  entryCount: number;
  currentUserId: number | string;
  onShareSuccess: () => void;
  weekDates?: Date[];
  dayEntryCounts?: Record<string, number>;
}

interface User {
  id: number | string;
  name: string;
  email: string;
}

const ShareEntryDialog: React.FC<ShareEntryDialogProps> = ({
  open,
  onOpenChange,
  shareType,
  shareDate,
  entryCount,
  currentUserId,
  onShareSuccess,
  weekDates,
  dayEntryCounts = {},
}) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [message, setMessage] = useState('');
  const [openUserPopover, setOpenUserPopover] = useState(false);
  const [userSearchValue, setUserSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Date[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date | null>(null);
  const [currentWeekDates, setCurrentWeekDates] = useState<Date[]>([]);
  const [currentDayEntryCounts, setCurrentDayEntryCounts] = useState<Record<string, number>>({});
  const [loadingEntries, setLoadingEntries] = useState(false);
  const prevWeekStartRef = useRef<Date | null>(null);

  // Initialize week navigation when dialog opens
  useEffect(() => {
    if (open && shareType === 'week') {
      // Get Monday of the week from shareDate
      const shareDateCopy = new Date(shareDate);
      shareDateCopy.setHours(0, 0, 0, 0);
      const dayOfWeek = shareDateCopy.getDay();
      const monday = new Date(shareDateCopy);
      monday.setDate(shareDateCopy.getDate() - ((dayOfWeek + 6) % 7));
      setCurrentWeekStart(monday);
      setSelectedDays([]); // Ensure empty selection on open
      prevWeekStartRef.current = null; // Reset ref
    } else if (open) {
      setCurrentWeekStart(null);
      setCurrentWeekDates([]);
      setCurrentDayEntryCounts({});
      setSelectedDays([]); // Ensure empty for non-week shares
    } else {
      // Reset when dialog closes
      setSelectedDays([]);
      setSelectedUser(null);
      setMessage('');
      setCurrentWeekStart(null);
      setCurrentWeekDates([]);
      setCurrentDayEntryCounts({});
      prevWeekStartRef.current = null; // Reset ref
    }
  }, [open, shareType, shareDate]);

  // Update week dates and fetch entries when currentWeekStart changes
  useEffect(() => {
    if (currentWeekStart && shareType === 'week') {
      const weekDates = getWeekDates(currentWeekStart);
      setCurrentWeekDates(weekDates);
      
      // Reset selection when week actually changes (not just when loading)
      const weekChanged = prevWeekStartRef.current === null || 
        prevWeekStartRef.current.getTime() !== currentWeekStart.getTime();
      
      if (weekChanged) {
        setSelectedDays([]); // Reset to empty selection when week changes
        prevWeekStartRef.current = currentWeekStart;
      }
      
      fetchWeekEntryCounts(weekDates);
    }
  }, [currentWeekStart, shareType, currentUserId]);


  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open, currentUserId]);

  const fetchWeekEntryCounts = async (weekDates: Date[]) => {
    if (!currentUserId) return;
    
    setLoadingEntries(true);
    try {
      const fromDate = formatDateToYYYYMMDD(weekDates[0]);
      const toDate = formatDateToYYYYMMDD(weekDates[6]);

      // Fetch all entries for the week
      const { data, error } = await supabase
        .from('timesheet')
        .select('id, date, startTime, endTime')
        .eq('user_id', currentUserId)
        .gte('date', fromDate)
        .lte('date', toDate);

      if (error) throw error;

      // Count entries per day (filter out admin adjustments - entries without startTime/endTime)
      const counts: Record<string, number> = {};
      weekDates.forEach(day => {
        const dateStr = formatDateToYYYYMMDD(day);
        counts[dateStr] = 0;
      });

      // Count only user-created entries (those with startTime and endTime)
      if (data) {
        data.forEach(entry => {
          if (entry.startTime && entry.endTime) {
            const dateStr = entry.date;
            if (counts[dateStr] !== undefined) {
              counts[dateStr] = (counts[dateStr] || 0) + 1;
            }
          }
        });
      }

      setCurrentDayEntryCounts(counts);
    } catch (error: any) {
      console.error('Error fetching week entry counts:', error);
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to load entry counts',
        variant: 'destructive',
      });
    } finally {
      setLoadingEntries(false);
    }
  };

  const getWeeksBack = (): number => {
    if (!currentWeekStart) return 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentDayOfWeek = today.getDay();
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - ((currentDayOfWeek + 6) % 7));
    
    const diffTime = currentMonday.getTime() - currentWeekStart.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    
    return diffWeeks;
  };

  const canGoBack = (): boolean => {
    if (!currentWeekStart) return false;
    const weeksBack = getWeeksBack();
    return weeksBack < 6; // Can go back up to 6 weeks
  };

  const goToPreviousWeek = () => {
    if (!currentWeekStart || !canGoBack()) return;
    
    const previousWeek = new Date(currentWeekStart);
    previousWeek.setDate(previousWeek.getDate() - 7);
    setCurrentWeekStart(previousWeek);
    setSelectedDays([]); // Reset selection when changing weeks
  };

  const fetchUsers = async () => {
    setFetchingUsers(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email')
        .neq('id', currentUserId)
        .eq('approved', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to fetch users',
        variant: 'destructive',
      });
    } finally {
      setFetchingUsers(false);
    }
  };

  const validateShareDate = (): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (shareType === 'day') {
      const shareDateOnly = new Date(shareDate);
      shareDateOnly.setHours(0, 0, 0, 0);
      return shareDateOnly <= today;
    } else {
      // For week shares, check if the Monday of the week is <= current week's Monday
      const weekStartToCheck = currentWeekStart || shareDate;
      const shareDateOnly = new Date(weekStartToCheck);
      shareDateOnly.setHours(0, 0, 0, 0);
      const dayOfWeek = shareDateOnly.getDay();
      const monday = new Date(shareDateOnly);
      monday.setDate(shareDateOnly.getDate() - ((dayOfWeek + 6) % 7));
      
      const currentMonday = new Date(today);
      const currentDayOfWeek = today.getDay();
      currentMonday.setDate(today.getDate() - ((currentDayOfWeek + 6) % 7));
      
      return monday <= currentMonday;
    }
  };

  const handleShare = async () => {
    if (!selectedUser) {
      toast({
        title: t('share.shareError'),
        description: t('share.selectUser'),
        variant: 'destructive',
      });
      return;
    }

    if (!validateShareDate()) {
      toast({
        title: t('share.futureDateError'),
        description: t('share.futureDateErrorDescription'),
        variant: 'destructive',
      });
      return;
    }

    // For week sharing, validate that at least one day is selected
    if (shareType === 'week') {
      if (selectedDays.length === 0) {
        toast({
          title: t('share.noDaysSelected'),
          description: t('share.noDaysSelected'),
          variant: 'destructive',
        });
        return;
      }
    } else {
      if (entryCount === 0) {
        toast({
          title: t('share.noEntries'),
          description: t('share.noEntriesDescription'),
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);
    try {
      if (shareType === 'week' && selectedDays.length > 0) {
        // Share selected days individually
        let totalShared = 0;
        let totalEntries = 0;

        // Fetch sharer's overnight stays for the week (for days with only overnight, no timesheet entries)
        const weekStart = currentWeekStart || selectedDays[0];
        const weekDates = getWeekDates(weekStart);
        const fromDate = formatDateToYYYYMMDD(weekDates[0]);
        const toDate = formatDateToYYYYMMDD(weekDates[6]);
        const { data: overnightRows } = await supabase
          .from('overnight_stays')
          .select('date')
          .eq('user_id', currentUserId)
          .gte('date', fromDate)
          .lte('date', toDate);
        const overnightStaysSet = new Set((overnightRows || []).map((r: { date: string }) => String(r.date)));

        for (const selectedDay of selectedDays) {
          const dayDateStr = formatDateToYYYYMMDD(selectedDay);
          
          // Check for existing pending share for this day
          const { data: existingShare } = await supabase
            .from('shared_entries')
            .select('id')
            .eq('sharer_id', currentUserId)
            .eq('recipient_id', selectedUser.id)
            .eq('share_type', 'day')
            .eq('share_date', dayDateStr)
            .eq('status', 'pending')
            .maybeSingle();

          if (existingShare) {
            continue; // Skip this day if already shared
          }

          // Get entries for this specific day
          const { data: dayEntries, error: entriesError } = await supabase
            .from('timesheet')
            .select('id')
            .eq('user_id', currentUserId)
            .eq('date', dayDateStr);

          if (entriesError) throw entriesError;

          const hasTimesheetEntries = dayEntries && dayEntries.length > 0;
          const hasOvernightOnly = !hasTimesheetEntries && overnightStaysSet.has(dayDateStr);

          if (hasTimesheetEntries) {
            // Create shared_entries record for this day with timesheet items
            const { data: sharedEntry, error: shareError } = await supabase
              .from('shared_entries')
              .insert({
                sharer_id: currentUserId,
                recipient_id: selectedUser.id,
                share_type: 'day',
                share_date: dayDateStr,
                message: message || null,
              })
              .select()
              .single();

            if (shareError) throw shareError;

            // Create shared_entry_items for this day
            const items = dayEntries.map((entry: { id: number }) => ({
              shared_entry_id: sharedEntry.id,
              timesheet_entry_id: entry.id,
            }));

            const { error: itemsError } = await supabase
              .from('shared_entry_items')
              .insert(items);

            if (itemsError) throw itemsError;

            totalShared++;
            totalEntries += dayEntries.length;
          } else if (hasOvernightOnly) {
            // Day has only overnight stay (no timesheet entries): create shared_entries with no items
            const { error: shareError } = await supabase
              .from('shared_entries')
              .insert({
                sharer_id: currentUserId,
                recipient_id: selectedUser.id,
                share_type: 'day',
                share_date: dayDateStr,
                message: message || null,
              });

            if (shareError) throw shareError;

            totalShared++;
          }
        }

        if (totalShared === 0) {
          toast({
            title: t('share.alreadyShared'),
            description: t('share.alreadySharedDescription'),
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        toast({
          title: t('share.sharedSuccess'),
          description: t('share.sharedSuccessDescription', { name: selectedUser.name }),
        });

        onShareSuccess();
        onOpenChange(false);
        setSelectedUser(null);
        setMessage('');
        setSelectedDays([]);
      } else if (shareType === 'day') {
        // Existing single day logic
        const shareDateStr = formatDateToYYYYMMDD(shareDate);
        
        // Check for existing pending share
        const { data: existingShare } = await supabase
          .from('shared_entries')
          .select('id')
          .eq('sharer_id', currentUserId)
          .eq('recipient_id', selectedUser.id)
          .eq('share_type', 'day')
          .eq('share_date', shareDateStr)
          .eq('status', 'pending')
          .maybeSingle();

        if (existingShare) {
          toast({
            title: t('share.alreadyShared'),
            description: t('share.alreadySharedDescription'),
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        // Get all timesheet entries for the day
        const { data: entries, error: entriesError } = await supabase
          .from('timesheet')
          .select('id')
          .eq('user_id', currentUserId)
          .eq('date', shareDateStr);

        if (entriesError) throw entriesError;

        if (!entries || entries.length === 0) {
          toast({
            title: t('share.noEntries'),
            description: t('share.noEntriesDescription'),
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        // Create shared_entries record
        const { data: sharedEntry, error: shareError } = await supabase
          .from('shared_entries')
          .insert({
            sharer_id: currentUserId,
            recipient_id: selectedUser.id,
            share_type: 'day',
            share_date: shareDateStr,
            message: message || null,
          })
          .select()
          .single();

        if (shareError) throw shareError;

        // Create shared_entry_items records
        const items = entries.map(entry => ({
          shared_entry_id: sharedEntry.id,
          timesheet_entry_id: entry.id,
        }));

        const { error: itemsError } = await supabase
          .from('shared_entry_items')
          .insert(items);

        if (itemsError) throw itemsError;

        toast({
          title: t('share.sharedSuccess'),
          description: t('share.sharedSuccessDescription', { name: selectedUser.name }),
        });

        onShareSuccess();
        onOpenChange(false);
        setSelectedUser(null);
        setMessage('');
      }
    } catch (error: any) {
      console.error('Error sharing entries:', error);
      toast({
        title: t('share.shareError'),
        description: t('share.shareErrorDescription', { error: error.message }),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {shareType === 'day' ? t('share.shareDay') : t('share.shareWeek')}
          </DialogTitle>
          <DialogDescription>
            {shareType === 'week' && selectedDays.length > 0
              ? t('share.selectedDaysCount', { count: selectedDays.length })
              : t('share.entriesCount', { count: entryCount })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {shareType === 'week' && currentWeekDates.length > 0 && (
            <div className="space-y-2">
              {/* Week Navigation */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousWeek}
                  disabled={!canGoBack() || loadingEntries}
                  className="flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('share.previousWeek')}
                </Button>
                <div className="flex-1 text-center text-sm">
                  {loadingEntries ? (
                    <span className="text-gray-500">{t('share.loadingEntries')}</span>
                  ) : (
                    <>
                      <div className="font-medium">
                        {t('share.weekOf', {
                          startDate: currentWeekDates[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
                          endDate: currentWeekDates[6].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                        })}
                      </div>
                      <div className="text-xs text-gray-500">
                        {t('share.weekNumber', {
                          weekNumber: getISOWeekNumber(currentWeekDates[0]),
                          year: currentWeekDates[0].getFullYear()
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <Label>{t('share.selectDays')}</Label>
              <p className="text-sm text-gray-500">{t('share.selectDaysDescription')}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto border rounded-md p-2">
                {currentWeekDates.map((day, idx) => {
                  const dateStr = formatDateToYYYYMMDD(day);
                  const dayEntryCount = currentDayEntryCounts[dateStr] || 0;
                  const isSelected = selectedDays.some(d => 
                    formatDateToYYYYMMDD(d) === dateStr
                  );
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (dayEntryCount === 0) return; // Don't allow selection of days with no entries
                        
                        if (isSelected) {
                          setSelectedDays(selectedDays.filter(d => 
                            formatDateToYYYYMMDD(d) !== dateStr
                          ));
                        } else {
                          setSelectedDays([...selectedDays, day]);
                        }
                      }}
                      className={cn(
                        "flex items-start space-x-2 p-2 rounded transition-colors",
                        isSelected 
                          ? "bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 cursor-pointer" 
                          : "hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer",
                        dayEntryCount === 0 && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={dayEntryCount === 0}
                        readOnly
                        className="pointer-events-none"
                      />
                      <Label className="flex-1 text-sm pointer-events-none">
                        <div className="font-medium">
                          {day.toLocaleDateString(undefined, { weekday: 'short' })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {day.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        </div>
                        <div className="text-xs text-gray-400">
                          {dayEntryCount} {dayEntryCount === 1 ? t('weekly.entry') : t('weekly.entries')}
                        </div>
                      </Label>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Select all days with entries
                    const daysWithEntries = currentWeekDates.filter(day => {
                      const dateStr = formatDateToYYYYMMDD(day);
                      return (currentDayEntryCounts[dateStr] || 0) > 0;
                    });
                    setSelectedDays(daysWithEntries);
                  }}
                >
                  {t('share.selectAllWithEntries')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDays([])}
                >
                  {t('share.clearSelection')}
                </Button>
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="user">{t('share.selectUser')}</Label>
            <Popover open={openUserPopover} onOpenChange={setOpenUserPopover}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openUserPopover}
                  className="w-full justify-between"
                  disabled={fetchingUsers}
                >
                  {selectedUser
                    ? `${selectedUser.name} (${selectedUser.email})`
                    : t('share.searchUser')}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder={t('share.searchUser')}
                    value={userSearchValue}
                    onValueChange={setUserSearchValue}
                  />
                  <CommandList>
                    <CommandEmpty>{t('share.noUserFound')}</CommandEmpty>
                    <CommandGroup>
                      {users.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={`${user.name} ${user.email}`}
                          onSelect={() => {
                            setSelectedUser(user);
                            setOpenUserPopover(false);
                            setUserSearchValue('');
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedUser?.id === user.id
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          {user.name} ({user.email})
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="message">{t('share.message')}</Label>
            <Textarea
              id="message"
              placeholder={t('share.messagePlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleShare} 
            disabled={loading || !selectedUser || (shareType === 'week' && selectedDays.length === 0)}
          >
            {loading ? t('share.sharing') : t('share.shareButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareEntryDialog;
