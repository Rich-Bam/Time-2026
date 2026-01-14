import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const workTypes = [
  { value: 10, label: "Work" },
  { value: 11, label: "Production" },
  { value: 12, label: "Administration" },
  { value: 13, label: "Drawing" },
  { value: 14, label: "Trade Fair" },
  { value: 15, label: "Commercial" },
  { value: 16, label: "Telephone Support" },
  { value: 17, label: "Internal BAMPRO" },
  { value: 20, label: "Commute: Home - Work" },
  { value: 21, label: "Commute: Work - Work" },
  { value: 22, label: "Loading / Unloading" },
  { value: 23, label: "Waiting" },
  { value: 30, label: "Sick" },
  { value: 31, label: "Day Off / Vacation" },
  { value: 32, label: "Doctor/Dentist/Hospital" },
  { value: 33, label: "Funeral/Wedding" },
  { value: 34, label: "Warehouse" },
  { value: 35, label: "Break" },
  { value: 36, label: "Course/Training" },
  { value: 37, label: "Meeting" },
  { value: 38, label: "Public Holiday" },
  { value: 39, label: "Time Off in Lieu (ADV)" },
  { value: 40, label: "Taken Time-for-Time (TFT)" },
  { value: 100, label: "Remote" },
];

function getWeekDates(date: Date) {
  const start = new Date(date);
  start.setDate(date.getDate() - ((date.getDay() + 6) % 7)); // Monday as first day
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const WeeklyDayListEntry = ({ currentUser }: { currentUser: any }) => {
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return getWeekDates(now)[0];
  });
  const [days, setDays] = useState(() => getWeekDates(new Date()).map(date => ({ date, entries: [] as any[] })));
  const [confirmedWeeks, setConfirmedWeeks] = useState<Record<string, boolean>>({});

  const weekDates = getWeekDates(weekStart);
  
  // Fetch confirmed status for the week
  const fetchConfirmedStatus = async () => {
    if (!currentUser) return;
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    const { data } = await supabase
      .from('confirmed_weeks')
      .select('confirmed, admin_approved')
      .eq('user_id', currentUser.id)
      .eq('week_start_date', weekKey)
      .single();
    // Week is locked if confirmed AND (not admin OR admin hasn't approved yet)
    const isLocked = !!data?.confirmed && (!currentUser.isAdmin || !data?.admin_approved);
    setConfirmedWeeks(prev => ({ ...prev, [weekKey]: isLocked }));
  };

  useEffect(() => {
    fetchConfirmedStatus();
    // eslint-disable-next-line
  }, [currentUser, weekStart]);

  const changeWeek = (delta: number) => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + delta * 7);
    setWeekStart(getWeekDates(newStart)[0]);
    setDays(getWeekDates(newStart).map(date => ({ date, entries: [] })));
  };

  const handleAddEntry = (dayIdx: number) => {
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    const isWeekLocked = confirmedWeeks[weekKey];
    
    // Non-admins cannot add entries if week is confirmed
    if (isWeekLocked && !currentUser?.isAdmin) {
      toast({
        title: "Not Allowed",
        description: "This week is confirmed and cannot be changed anymore.",
        variant: "destructive",
      });
      return;
    }
    
    setDays(days.map((day, i) =>
      i === dayIdx ? { ...day, entries: [...day.entries, { workType: "", project: "", hours: "" }] } : day
    ));
  };

  const handleRemoveEntry = (dayIdx: number, entryIdx: number) => {
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    const isWeekLocked = confirmedWeeks[weekKey];
    
    // Non-admins cannot remove entries if week is confirmed
    if (isWeekLocked && !currentUser?.isAdmin) {
      toast({
        title: "Not Allowed",
        description: "This week is confirmed and cannot be changed anymore.",
        variant: "destructive",
      });
      return;
    }
    
    setDays(days.map((day, i) =>
      i === dayIdx ? { ...day, entries: day.entries.filter((_, j) => j !== entryIdx) } : day
    ));
  };

  const handleEntryChange = (dayIdx: number, entryIdx: number, field: string, value: any) => {
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    const isWeekLocked = confirmedWeeks[weekKey];
    
    // Non-admins cannot change entries if week is confirmed
    if (isWeekLocked && !currentUser?.isAdmin) {
      return;
    }
    
    setDays(days.map((day, i) =>
      i === dayIdx ? {
        ...day,
        entries: day.entries.map((entry, j) =>
          j === entryIdx ? { ...entry, [field]: value } : entry
        )
      } : day
    ));
  };

  // Handle week confirmation
  const handleConfirmWeek = async () => {
    if (!currentUser) return;
    
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    
    // Check if week already has confirmed status
    const { data: existing } = await supabase
      .from('confirmed_weeks')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('week_start_date', weekKey)
      .single();
    
    if (existing?.confirmed) {
      toast({
        title: "Already Confirmed",
        description: "This week is already confirmed.",
        variant: "destructive",
      });
      return;
    }
    
    // Insert or update confirmed_weeks
    const { error } = await supabase
      .from('confirmed_weeks')
      .upsert({
        user_id: currentUser.id,
        week_start_date: weekKey,
        confirmed: true,
        admin_approved: false,
        admin_reviewed: false,
      }, {
        onConflict: 'user_id,week_start_date'
      });
    
    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to confirm week.",
        variant: "destructive",
      });
    } else {
      // Immediately update state to lock the week
      const weekKeyDate = formatDateToYYYYMMDD(weekDates[0]);
      setConfirmedWeeks(prev => ({ ...prev, [weekKeyDate]: true }));
      
      toast({
        title: "Week Confirmed",
        description: "This week has been confirmed and locked. You can no longer make changes.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
    <Card>
      <CardHeader>
        <CardTitle>Weekly Day-by-Day Entry</CardTitle>
        <div className="flex items-center gap-4 mt-2">
          <Button variant="outline" onClick={() => changeWeek(-1)}>&lt; Prev</Button>
          <span className="font-medium">Week of {weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()}</span>
          <Button variant="outline" onClick={() => changeWeek(1)}>Next &gt;</Button>
        </div>
      </CardHeader>
      <CardContent>
        {confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && !currentUser?.isAdmin && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
            ⚠️ This week is confirmed. You cannot make any changes until an admin has approved or reset it.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {days.map((day, dayIdx) => {
            const weekKey = formatDateToYYYYMMDD(weekDates[0]);
            const isLocked = confirmedWeeks[weekKey] && !currentUser?.isAdmin;
            return (
              <div key={dayIdx} className="border rounded-lg p-4 bg-gray-50">
                <div className="font-semibold mb-2">{day.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</div>
                {day.entries.map((entry, entryIdx) => (
                  <div key={entryIdx} className="flex flex-wrap gap-2 items-end mb-2 bg-white p-2 rounded shadow-sm">
                    <div>
                      <Label>Work Type</Label>
                      <Select value={entry.workType} onValueChange={val => handleEntryChange(dayIdx, entryIdx, "workType", val)} disabled={isLocked}>
                        <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                        <SelectContent>
                          {workTypes.map(type => (
                            <SelectItem key={type.value} value={String(type.value)}>{type.value} - {type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Project</Label>
                      <Input value={entry.project} onChange={e => handleEntryChange(dayIdx, entryIdx, "project", e.target.value)} placeholder="Project" disabled={isLocked} />
                    </div>
                    <div>
                      <Label>Hours</Label>
                      <Input type="number" min="0" step="0.25" value={entry.hours} onChange={e => handleEntryChange(dayIdx, entryIdx, "hours", e.target.value)} placeholder="h" disabled={isLocked} />
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => handleRemoveEntry(dayIdx, entryIdx)} disabled={isLocked}>-</Button>
                  </div>
                ))}
                <Button size="sm" onClick={() => handleAddEntry(dayIdx)} disabled={isLocked}>+ Add Entry</Button>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-4">
          <Button variant="default" disabled={confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && !currentUser?.isAdmin}>Submit All</Button>
        </div>
      </CardContent>
    </Card>
    {!confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && (
      <Card className="mt-4 bg-orange-50 border-orange-200">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="text-sm text-orange-800">
              <strong>Note:</strong> Once you confirm this week, you will no longer be able to make changes. Please make sure all entries are correct before confirming.
            </div>
            <Button 
              className="w-full bg-orange-600 hover:bg-orange-700 text-white" 
              variant="default" 
              onClick={handleConfirmWeek}
            >
              Confirm Week
            </Button>
          </div>
        </CardContent>
      </Card>
    )}
    {confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && (
      <Card className="mt-4 bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="text-blue-800 font-semibold">
            ✓ This week has been confirmed and locked. Contact an admin if you need to make changes.
          </div>
        </CardContent>
      </Card>
    )}
  </div>
  );
};

export default WeeklyDayListEntry; 
