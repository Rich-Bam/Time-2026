import React, { useState, useEffect } from 'react';
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
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDateToYYYYMMDD } from '@/utils/dateUtils';

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

  useEffect(() => {
    if (open) {
      fetchUsers();
      // Initialize selected days when dialog opens for week sharing
      if (shareType === 'week' && weekDates) {
        // Default: select all days that have entries
        const daysWithEntries = weekDates.filter(day => {
          const dateStr = formatDateToYYYYMMDD(day);
          return (dayEntryCounts[dateStr] || 0) > 0;
        });
        setSelectedDays(daysWithEntries);
      } else {
        setSelectedDays([]);
      }
    } else {
      // Reset when dialog closes
      setSelectedDays([]);
      setSelectedUser(null);
      setMessage('');
    }
  }, [open, currentUserId, shareType, weekDates, dayEntryCounts]);

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
      const shareDateOnly = new Date(shareDate);
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

          if (dayEntries && dayEntries.length > 0) {
            // Create shared_entries record for this day
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
            const items = dayEntries.map(entry => ({
              shared_entry_id: sharedEntry.id,
              timesheet_entry_id: entry.id,
            }));

            const { error: itemsError } = await supabase
              .from('shared_entry_items')
              .insert(items);

            if (itemsError) throw itemsError;

            totalShared++;
            totalEntries += dayEntries.length;
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
          {shareType === 'week' && weekDates && (
            <div className="space-y-2">
              <Label>{t('share.selectDays')}</Label>
              <p className="text-sm text-gray-500">{t('share.selectDaysDescription')}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto border rounded-md p-2">
                {weekDates.map((day, idx) => {
                  const dateStr = formatDateToYYYYMMDD(day);
                  const dayEntryCount = dayEntryCounts[dateStr] || 0;
                  const isSelected = selectedDays.some(d => 
                    formatDateToYYYYMMDD(d) === dateStr
                  );
                  return (
                    <div key={idx} className="flex items-start space-x-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDays([...selectedDays, day]);
                          } else {
                            setSelectedDays(selectedDays.filter(d => 
                              formatDateToYYYYMMDD(d) !== dateStr
                            ));
                          }
                        }}
                        disabled={dayEntryCount === 0}
                      />
                      <Label className="flex-1 cursor-pointer text-sm">
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
                    const daysWithEntries = weekDates.filter(day => {
                      const dateStr = formatDateToYYYYMMDD(day);
                      return (dayEntryCounts[dateStr] || 0) > 0;
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
