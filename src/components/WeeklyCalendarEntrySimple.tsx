import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Trash2, Download, Plus } from 'lucide-react';
import { useIsMobile } from "@/hooks/use-mobile";
import * as XLSX from "xlsx";

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

function getISOWeekNumber(date: Date) {
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

interface Entry {
  id?: number;
  workType: string;
  project: string;
  hours: string;
  startTime: string;
  endTime: string;
  isSubmitted?: boolean;
}

interface DayData {
  date: Date;
  entries: Entry[];
}

const WeeklyCalendarEntrySimple = ({ currentUser }: { currentUser: any }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return getWeekDates(now)[0];
  });
  const [days, setDays] = useState<DayData[]>(() => 
    getWeekDates(new Date()).map(date => ({ 
      date, 
      entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "" }] 
    }))
  );
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [submittedEntries, setSubmittedEntries] = useState<Record<string, Entry[]>>({});
  const [confirmedWeeks, setConfirmedWeeks] = useState<Record<string, boolean>>({});
  const [dbDaysOff, setDbDaysOff] = useState(0);
  const [customProjectInputs, setCustomProjectInputs] = useState<Record<string, string>>({});
  const [autoSaveTimeouts, setAutoSaveTimeouts] = useState<Record<string, NodeJS.Timeout>>({});
  const [editingEntry, setEditingEntry] = useState<{ id: number; dateStr: string } | null>(null);

  const weekDates = getWeekDates(weekStart);
  const weekNumber = getISOWeekNumber(weekDates[0]);
  const totalDaysOff = 25;
  const daysOffLeft = (totalDaysOff - dbDaysOff).toFixed(1);

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        let query = supabase.from("projects").select("id, name, user_id, status");
        if (currentUser?.id) {
          try {
            const { data, error } = await query.or(`user_id.is.null,user_id.eq.${currentUser.id}`);
            if (error && error.message.includes("does not exist")) {
              const { data: allData } = await supabase.from("projects").select("id, name");
              setProjects(allData || []);
              return;
            }
            if (data) {
              const filteredProjects = data
                .filter(p => !p.user_id || p.user_id === currentUser.id)
                .filter(p => !p.status || p.status !== "closed")
                .map(p => ({ id: p.id, name: p.name }));
              setProjects(filteredProjects);
              return;
            }
          } catch (err) {
            const { data: allData } = await supabase.from("projects").select("id, name");
            setProjects(allData || []);
          }
        } else {
          const { data } = await supabase
            .from("projects")
            .select("id, name, status")
            .or("status.is.null,status.neq.closed");
          setProjects((data || []).map(p => ({ id: p.id, name: p.name })));
        }
      } catch (err) {
        const { data } = await supabase.from("projects").select("id, name");
        setProjects(data || []);
      }
    };
    fetchProjects();
  }, [currentUser]);

  // Fetch days off
  useEffect(() => {
    const fetchDaysOff = async () => {
      if (!currentUser) return;
      const currentYear = new Date().getFullYear();
      const { data } = await supabase
        .from("timesheet")
        .select("hours, description")
        .eq("user_id", currentUser.id)
        .eq("description", "31")
        .gte("date", `${currentYear}-01-01`)
        .lte("date", `${currentYear}-12-31`);
      if (data) {
        const totalHours = data.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);
        setDbDaysOff(totalHours / 8);
      }
    };
    fetchDaysOff();
  }, [currentUser]);

  // Fetch submitted entries
  const fetchSubmittedEntries = async (dateStr: string) => {
    if (!currentUser) return;
    const { data } = await supabase
      .from("timesheet")
      .select("id, project, hours, description, date, startTime, endTime")
      .eq("user_id", currentUser.id)
      .eq("date", dateStr);
    if (data) {
      setSubmittedEntries(prev => ({ 
        ...prev, 
        [dateStr]: data.map(e => ({
          id: e.id,
          workType: e.description || "",
          project: e.project || "",
          hours: String(e.hours || 0),
          startTime: e.startTime || "",
          endTime: e.endTime || "",
          isSubmitted: true
        }))
      }));
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    weekDates.forEach(d => fetchSubmittedEntries(d.toISOString().split('T')[0]));
  }, [currentUser, weekStart]);

  // Fetch confirmed status
  useEffect(() => {
    const fetchConfirmedStatus = async () => {
      if (!currentUser) return;
      const weekKey = weekDates[0].toISOString().split('T')[0];
      const { data } = await supabase
        .from('confirmed_weeks')
        .select('confirmed, admin_approved')
        .eq('user_id', currentUser.id)
        .eq('week_start_date', weekKey)
        .single();
      const isLocked = !!data?.confirmed && (!currentUser.isAdmin || !data?.admin_approved);
      setConfirmedWeeks(prev => ({ ...prev, [weekKey]: isLocked }));
    };
    fetchConfirmedStatus();
  }, [currentUser, weekStart]);

  const changeWeek = (delta: number) => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + delta * 7);
    setWeekStart(getWeekDates(newStart)[0]);
    setDays(getWeekDates(newStart).map(date => ({ 
      date, 
      entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "" }] 
    })));
  };

  const handleAddEntry = (dayIdx: number) => {
    setDays(days.map((day, i) =>
      i === dayIdx 
        ? { ...day, entries: [...day.entries, { workType: "", project: "", hours: "", startTime: "", endTime: "" }] }
        : day
    ));
  };

  const handleRemoveEntry = (dayIdx: number, entryIdx: number) => {
    setDays(days.map((day, i) =>
      i === dayIdx 
        ? { ...day, entries: day.entries.filter((_, j) => j !== entryIdx) }
        : day
    ));
  };

  const handleEntryChange = (dayIdx: number, entryIdx: number, field: string, value: any) => {
    setDays(prevDays => {
      const updatedDays = prevDays.map((day, i) => {
        if (i !== dayIdx) return day;
        return {
          ...day,
          entries: day.entries.map((entry, j) => {
            if (j !== entryIdx) return entry;
            let updated = { ...entry, [field]: value };
            
            // Auto-calculate hours from start/end time
            if (field === "startTime" || field === "endTime") {
              const calculatedHours = calculateHours(updated.startTime, updated.endTime);
              updated.hours = calculatedHours;
            }
            
            return updated;
          })
        };
      });
      
      // Auto-save after 4 seconds of inactivity
      const dateStr = updatedDays[dayIdx].date.toISOString().split('T')[0];
      const entryKey = `${dateStr}-${entryIdx}`;
      
      // Clear existing timeout
      if (autoSaveTimeouts[entryKey]) {
        clearTimeout(autoSaveTimeouts[entryKey]);
      }
      
      // Set new timeout for auto-save (4 seconds delay)
      const timeout = setTimeout(() => {
        autoSaveEntry(dayIdx, entryIdx, updatedDays);
      }, 4000);
      
      setAutoSaveTimeouts(prev => ({ ...prev, [entryKey]: timeout }));
      
      return updatedDays;
    });
  };
  
  // Auto-save a single entry
  const autoSaveEntry = async (dayIdx: number, entryIdx: number, currentDays?: DayData[]) => {
    if (!currentUser) return;
    
    // Use provided days or get from state
    const daysToUse = currentDays || days;
    const day = daysToUse[dayIdx];
    if (!day) return;
    
    const entry = day.entries[entryIdx];
    if (!entry) return;
    const dateStr = day.date.toISOString().split('T')[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entryDate = new Date(day.date);
    entryDate.setHours(0, 0, 0, 0);
    
    // Don't save future dates
    if (entryDate > today) return;
    
    // Don't save if required fields are missing
    const isDayOff = entry.workType === "31";
    if (!isDayOff && (!entry.workType || (!entry.project && !isDayOff) || (!entry.startTime && !entry.endTime))) {
      return;
    }
    
    // Calculate hours
    let hoursToSave = 0;
    if (entry.startTime && entry.endTime) {
      const calculated = calculateHours(entry.startTime, entry.endTime);
      hoursToSave = parseFloat(calculated) || 0;
    } else if (entry.hours) {
      hoursToSave = Number(entry.hours);
    }
    
    if (hoursToSave <= 0 && !isDayOff) {
      return;
    }
    
    // Check if this entry is being edited (has an id)
    if (entry.id) {
      // Update existing entry in database (silent background save)
      const { error } = await supabase
        .from("timesheet")
        .update({
          project: isDayOff ? null : entry.project,
          hours: hoursToSave,
          description: entry.workType,
          startTime: entry.startTime || null,
          endTime: entry.endTime || null,
        })
        .eq("id", entry.id);
      
      if (!error) {
        // Silently refresh submitted entries in background
        fetchSubmittedEntries(dateStr);
        // Keep entry in editable entries - don't remove it
        // Entry stays visible and editable
      }
      // No toast notification - silent save
    } else {
      // Check if a similar entry already exists (to prevent duplicates)
      const { data: existingEntries } = await supabase
        .from("timesheet")
        .select("id")
        .eq("user_id", currentUser.id)
        .eq("date", dateStr)
        .eq("description", entry.workType)
        .eq("project", isDayOff ? null : entry.project)
        .eq("startTime", entry.startTime || null)
        .eq("endTime", entry.endTime || null);
      
      if (existingEntries && existingEntries.length > 0) {
        // Entry already exists, update it instead
        const existingId = existingEntries[0].id;
        const { error } = await supabase
          .from("timesheet")
          .update({
            project: isDayOff ? null : entry.project,
            hours: hoursToSave,
            description: entry.workType,
            startTime: entry.startTime || null,
            endTime: entry.endTime || null,
          })
          .eq("id", existingId);
        
        if (!error) {
          // Update the entry in state with the ID so future saves will update instead of insert
          setDays(prevDays => prevDays.map((d, i) => {
            if (i !== dayIdx) return d;
            return {
              ...d,
              entries: d.entries.map((e, j) => {
                if (j !== entryIdx) return e;
                return { ...e, id: existingId };
              })
            };
          }));
          // Silently refresh submitted entries in background
          fetchSubmittedEntries(dateStr);
        }
      } else {
        // Create new entry (only if it doesn't have an id and doesn't exist)
        const { data: newEntry, error } = await supabase.from("timesheet").insert([{
          project: isDayOff ? null : entry.project,
          user_id: currentUser.id,
          date: dateStr,
          hours: hoursToSave,
          description: entry.workType,
          startTime: entry.startTime || null,
          endTime: entry.endTime || null,
        }]).select("id").single();
        
        if (!error && newEntry) {
          // Update the entry in state with the ID so future saves will update instead of insert
          setDays(prevDays => prevDays.map((d, i) => {
            if (i !== dayIdx) return d;
            return {
              ...d,
              entries: d.entries.map((e, j) => {
                if (j !== entryIdx) return e;
                return { ...e, id: newEntry.id };
              })
            };
          }));
          // Silently refresh submitted entries in background
          fetchSubmittedEntries(dateStr);
        }
      }
      // No toast notification - silent save
    }
  };
  
  // Edit an existing entry
  const handleEditEntry = (entry: Entry, dateStr: string) => {
    const dayIdx = days.findIndex(d => d.date.toISOString().split('T')[0] === dateStr);
    if (dayIdx === -1) return;
    
    // Add entry to editable entries (don't delete from database yet)
    setDays(days.map((day, i) => 
      i === dayIdx 
        ? { ...day, entries: [...day.entries, { ...entry, id: entry.id }] }
        : day
    ));
    
    setEditingEntry({ id: entry.id!, dateStr });
  };

  const roundToQuarterHour = (timeStr: string) => {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return timeStr;
    let [_, h, m] = match;
    let hour = parseInt(h, 10);
    let min = parseInt(m, 10);
    min = Math.round(min / 15) * 15;
    if (min === 60) {
      hour += 1;
      min = 0;
    }
    return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  };

  // Calculate hours from start and end time
  const calculateHours = (startTime: string, endTime: string): string => {
    if (!startTime || !endTime) return "";
    
    try {
      const start = new Date(`2000-01-01T${startTime}`);
      const end = new Date(`2000-01-01T${endTime}`);
      const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      
      if (diff < 0) return ""; // Invalid time range
      
      // Round to 2 decimal places
      return diff.toFixed(2);
    } catch (e) {
      return "";
    }
  };

  const handleSubmitAll = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekKey = weekDates[0].toISOString().split('T')[0];
    const isWeekLocked = confirmedWeeks[weekKey];
    
    if (isWeekLocked && !currentUser?.isAdmin) {
      toast({
        title: "Not Allowed",
        description: "This week is confirmed and cannot be changed anymore.",
        variant: "destructive",
      });
      return;
    }
    
    const entriesToSave = [];
    
    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const day = days[dayIdx];
      const entryDate = new Date(day.date);
      entryDate.setHours(0, 0, 0, 0);
      
      if (entryDate > today) {
        toast({
          title: "Future Date Not Allowed",
          description: `You cannot log hours for ${day.date.toLocaleDateString()}`,
          variant: "destructive",
        });
        return;
      }
      
      const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
      
      for (let entryIdx = 0; entryIdx < day.entries.length; entryIdx++) {
        const entry = day.entries[entryIdx];
        const isDayOff = entry.workType === "31";
        
        // For non-weekend days, require: workType, and either (project or dayOff), and (startTime/endTime or hours)
        if (!isWeekend && ((!entry.project && !isDayOff) || !entry.workType || (!entry.startTime && !entry.endTime && !entry.hours))) {
          toast({
            title: "Missing Information",
            description: `Please fill in all required fields for ${day.date.toLocaleDateString()}. You need to enter start and end times.`,
            variant: "destructive",
          });
          return;
        }
        
        if (isWeekend && (!entry.project && !isDayOff) && !entry.workType && !entry.startTime && !entry.endTime && !entry.hours) {
          continue;
        }
        
        // Calculate hours from start/end time if available, otherwise use entered hours
        let hoursToSave = 0;
        if (entry.startTime && entry.endTime) {
          const calculated = calculateHours(entry.startTime, entry.endTime);
          hoursToSave = parseFloat(calculated) || 0;
        } else if (entry.hours) {
          hoursToSave = Number(entry.hours);
        }
        
        if (hoursToSave <= 0 && !isDayOff) {
          toast({
            title: "Invalid Hours",
            description: `Please enter valid start and end times for ${day.date.toLocaleDateString()}.`,
            variant: "destructive",
          });
          return;
        }
        
        entriesToSave.push({
          project: isDayOff ? null : entry.project,
          user_id: currentUser?.id || null,
          date: day.date.toISOString().split('T')[0],
          hours: hoursToSave,
          description: entry.workType,
          startTime: entry.startTime || null,
          endTime: entry.endTime || null,
        });
      }
    }
    
    if (entriesToSave.length === 0) {
      toast({ title: "No Entries", description: "Nothing to save.", variant: "destructive" });
      return;
    }
    
    const { error } = await supabase.from("timesheet").insert(entriesToSave);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: `${entriesToSave.length} entries saved.` });
      // Refresh submitted entries
      weekDates.forEach(d => fetchSubmittedEntries(d.toISOString().split('T')[0]));
      // Reset entries
      setDays(getWeekDates(weekStart).map(date => ({ 
        date, 
        entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "" }] 
      })));
    }
  };

  const handleDeleteEntry = async (entryId: number, dateStr: string) => {
    const weekKey = weekDates[0].toISOString().split('T')[0];
    const isWeekLocked = confirmedWeeks[weekKey];
    
    if (isWeekLocked && !currentUser?.isAdmin) {
      toast({
        title: "Not Allowed",
        description: "This week is confirmed and cannot be changed anymore.",
        variant: "destructive",
      });
      return;
    }
    
    await supabase.from('timesheet').delete().eq('id', entryId);
    fetchSubmittedEntries(dateStr);
  };

  const getWorkTypeLabel = (desc: string) => {
    const workType = workTypes.find(wt => String(wt.value) === String(desc));
    return workType ? workType.label : desc;
  };

  const isLocked = confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin;

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-bold">{t('weekly.title')}</h2>
          <div className="mt-1 text-sm sm:text-base text-gray-700 font-medium">
            {t('weekly.week')} {weekNumber} ({weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()})
          </div>
          <div className="flex items-center gap-2 sm:gap-4 mt-2">
            <Button variant="outline" size={isMobile ? "sm" : "default"} onClick={() => changeWeek(-1)} className="text-xs sm:text-sm">
              &lt; {t('weekly.prev')}
            </Button>
            <Button variant="outline" size={isMobile ? "sm" : "default"} onClick={() => changeWeek(1)} className="text-xs sm:text-sm">
              {t('weekly.next')} &gt;
            </Button>
          </div>
        </div>
        <Card className="bg-blue-50 border-blue-200 w-full sm:w-auto sm:min-w-[200px]">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-blue-900 text-sm sm:text-lg">{t('weekly.daysOffRemaining')}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-blue-700">{daysOffLeft} / {totalDaysOff}</div>
          </CardContent>
        </Card>
      </div>

      {isLocked && (
        <div className="p-2 sm:p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-xs sm:text-sm">
          ⚠️ This week is confirmed. You cannot make any more changes.
        </div>
      )}

      <Card>
        <CardContent className="p-2 sm:p-4">
          <div className="space-y-3 sm:space-y-4">
            {days.map((day, dayIdx) => {
              const dateStr = day.date.toISOString().split('T')[0];
              const submitted = submittedEntries[dateStr] || [];
              const isDayLocked = confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin;
              const dayName = day.date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
              const dayShort = day.date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
              const dayColors = [
                'bg-blue-50 border-blue-200', // Monday
                'bg-green-50 border-green-200', // Tuesday
                'bg-yellow-50 border-yellow-200', // Wednesday
                'bg-purple-50 border-purple-200', // Thursday
                'bg-pink-50 border-pink-200', // Friday
                'bg-gray-50 border-gray-200', // Saturday
                'bg-slate-50 border-slate-200', // Sunday
              ];
              const dayColor = dayColors[day.date.getDay() === 0 ? 6 : day.date.getDay() - 1];
              
              return (
                <div key={dayIdx} className={`border-2 rounded-lg ${dayColor} overflow-hidden`}>
                  {/* Day Header */}
                  <div className={`px-3 sm:px-4 py-2 sm:py-3 border-b-2 ${dayColor.replace('50', '200')} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`}>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <h3 className="font-bold text-base sm:text-lg text-gray-800">{isMobile ? dayShort : dayName}</h3>
                      {!isMobile && <span className="text-sm text-gray-600">({dayShort})</span>}
                    </div>
                    <Button 
                      variant="outline" 
                      size={isMobile ? "sm" : "sm"}
                      className={`${isMobile ? 'h-8 text-xs w-full' : 'h-7 text-xs'}`}
                      onClick={() => handleAddEntry(dayIdx)}
                      disabled={isLocked}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Entry
                    </Button>
                  </div>
                  
                  {/* Mobile: Card Layout, Desktop: Table Layout */}
                  {isMobile ? (
                    <div className="p-2 sm:p-4 space-y-3">
                      {/* Editable entries */}
                      {day.entries.map((entry, entryIdx) => (
                        <div key={`edit-${dayIdx}-${entryIdx}`} className="bg-white rounded-lg border p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold">Work Type</Label>
                            {day.entries.length > 1 && (
                              <Button 
                                variant="destructive" 
                                size="sm"
                                className="h-7 w-7 text-xs"
                                onClick={() => handleRemoveEntry(dayIdx, entryIdx)}
                                disabled={isLocked}
                              >
                                -
                              </Button>
                            )}
                          </div>
                          <Select 
                            value={entry.workType || ""} 
                            onValueChange={val => handleEntryChange(dayIdx, entryIdx, "workType", val)}
                            disabled={isLocked}
                          >
                            <SelectTrigger className="h-10 text-sm bg-white">
                              <SelectValue placeholder="Select work type" />
                            </SelectTrigger>
                            <SelectContent>
                              {workTypes.map(type => (
                                <SelectItem key={type.value} value={String(type.value)}>
                                  {type.value} - {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <div>
                            <Label className="text-xs font-semibold">Project</Label>
                            <div className="space-y-2 mt-1">
                              <Select
                                value={entry.project && projects.some(p => p.name === entry.project) ? entry.project : ""}
                                onValueChange={val => {
                                  const key = `${dayIdx}-${entryIdx}`;
                                  setCustomProjectInputs(prev => ({ ...prev, [key]: "" }));
                                  handleEntryChange(dayIdx, entryIdx, "project", val);
                                }}
                                disabled={entry.workType === "31" || isLocked}
                              >
                                <SelectTrigger className="h-10 text-sm bg-white">
                                  <SelectValue placeholder="Select project" />
                                </SelectTrigger>
                                <SelectContent>
                                  {projects.map(project => (
                                    <SelectItem key={project.id} value={project.name}>
                                      {project.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="text"
                                value={entry.project && !projects.some(p => p.name === entry.project) 
                                  ? entry.project 
                                  : customProjectInputs[`${dayIdx}-${entryIdx}`] || ""}
                                onChange={e => {
                                  const value = e.target.value;
                                  const key = `${dayIdx}-${entryIdx}`;
                                  setCustomProjectInputs(prev => ({ ...prev, [key]: value }));
                                  if (value.trim()) {
                                    handleEntryChange(dayIdx, entryIdx, "project", value);
                                  } else {
                                    handleEntryChange(dayIdx, entryIdx, "project", "");
                                  }
                                }}
                                placeholder="Or type a new project..."
                                className="h-10 text-sm bg-white"
                                disabled={entry.workType === "31" || isLocked}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs font-semibold">From</Label>
                              <Input
                                type="text"
                                value={entry.startTime || ""}
                                onChange={e => handleEntryChange(dayIdx, entryIdx, "startTime", roundToQuarterHour(e.target.value))}
                                placeholder="08:00"
                                className="h-10 text-sm bg-white mt-1"
                                disabled={isLocked}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold">To</Label>
                              <Input
                                type="text"
                                value={entry.endTime || ""}
                                onChange={e => handleEntryChange(dayIdx, entryIdx, "endTime", roundToQuarterHour(e.target.value))}
                                placeholder="17:00"
                                className="h-10 text-sm bg-white mt-1"
                                disabled={isLocked}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold">Hours</Label>
                              <div className="h-10 flex items-center justify-center bg-gray-50 border rounded px-2 text-sm font-medium mt-1">
                                {entry.startTime && entry.endTime 
                                  ? `${calculateHours(entry.startTime, entry.endTime)}h`
                                  : entry.hours 
                                    ? `${entry.hours}h`
                                    : "-"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Submitted entries (read-only with edit option) */}
                      {submitted.map((submittedEntry, subIdx) => (
                        <div key={`submitted-${dayIdx}-${subIdx}`} className="bg-gray-100 rounded-lg border p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{getWorkTypeLabel(submittedEntry.workType || "")}</span>
                            {!isDayLocked && (
                              <div className="flex gap-1">
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8"
                                  onClick={() => handleEditEntry(submittedEntry, dateStr)}
                                  title="Edit entry"
                                >
                                  <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8"
                                  onClick={() => handleDeleteEntry(submittedEntry.id!, dateStr)}
                                  title="Delete entry"
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-600">
                            <div><strong>Project:</strong> {submittedEntry.project || "-"}</div>
                            <div><strong>Time:</strong> {submittedEntry.startTime || "-"} - {submittedEntry.endTime || "-"}</div>
                            <div><strong>Hours:</strong> {submittedEntry.hours || "0"}h</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Desktop: Table Layout */
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse">
                        <thead>
                          <tr className="bg-white/50">
                            <th className="border p-2 text-left min-w-[120px]">Work Type</th>
                            <th className="border p-2 text-left min-w-[150px]">Project</th>
                            <th className="border p-2 text-left min-w-[80px]">From</th>
                            <th className="border p-2 text-left min-w-[80px]">To</th>
                            <th className="border p-2 text-left min-w-[80px]">Hours</th>
                            <th className="border p-2 text-center min-w-[50px]">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Editable entries */}
                          {day.entries.map((entry, entryIdx) => (
                            <tr key={`edit-${dayIdx}-${entryIdx}`} className="border-t hover:bg-white/50 bg-white/30">
                              <td className="border p-2">
                                <Select 
                                  value={entry.workType || ""} 
                                  onValueChange={val => handleEntryChange(dayIdx, entryIdx, "workType", val)}
                                  disabled={isLocked}
                                >
                                  <SelectTrigger className="h-9 text-sm bg-white">
                                    <SelectValue placeholder="Type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {workTypes.map(type => (
                                      <SelectItem key={type.value} value={String(type.value)}>
                                        {type.value} - {type.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="border p-2">
                                <div className="space-y-1">
                                  <Select
                                    value={entry.project && projects.some(p => p.name === entry.project) ? entry.project : ""}
                                    onValueChange={val => {
                                      const key = `${dayIdx}-${entryIdx}`;
                                      setCustomProjectInputs(prev => ({ ...prev, [key]: "" }));
                                      handleEntryChange(dayIdx, entryIdx, "project", val);
                                    }}
                                    disabled={entry.workType === "31" || isLocked}
                                  >
                                    <SelectTrigger className="h-9 text-sm bg-white">
                                      <SelectValue placeholder="Project" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {projects.map(project => (
                                        <SelectItem key={project.id} value={project.name}>
                                          {project.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    type="text"
                                    value={entry.project && !projects.some(p => p.name === entry.project) 
                                      ? entry.project 
                                      : customProjectInputs[`${dayIdx}-${entryIdx}`] || ""}
                                    onChange={e => {
                                      const value = e.target.value;
                                      const key = `${dayIdx}-${entryIdx}`;
                                      setCustomProjectInputs(prev => ({ ...prev, [key]: value }));
                                      if (value.trim()) {
                                        handleEntryChange(dayIdx, entryIdx, "project", value);
                                      } else {
                                        handleEntryChange(dayIdx, entryIdx, "project", "");
                                      }
                                    }}
                                    placeholder="Or type a new project..."
                                    className="h-8 text-sm bg-white"
                                    disabled={entry.workType === "31" || isLocked}
                                  />
                                </div>
                              </td>
                              <td className="border p-2">
                                <Input
                                  type="text"
                                  value={entry.startTime || ""}
                                  onChange={e => handleEntryChange(dayIdx, entryIdx, "startTime", roundToQuarterHour(e.target.value))}
                                  placeholder="08:00"
                                  className="h-9 text-sm w-24 bg-white"
                                  disabled={isLocked}
                                />
                              </td>
                              <td className="border p-2">
                                <Input
                                  type="text"
                                  value={entry.endTime || ""}
                                  onChange={e => handleEntryChange(dayIdx, entryIdx, "endTime", roundToQuarterHour(e.target.value))}
                                  placeholder="17:00"
                                  className="h-9 text-sm w-24 bg-white"
                                  disabled={isLocked}
                                />
                              </td>
                              <td className="border p-2">
                                <div className="h-9 flex items-center justify-center bg-gray-50 border rounded px-3 text-sm font-medium">
                                  {entry.startTime && entry.endTime 
                                    ? `${calculateHours(entry.startTime, entry.endTime)}h`
                                    : entry.hours 
                                      ? `${entry.hours}h`
                                      : "-"}
                                </div>
                              </td>
                              <td className="border p-2 text-center">
                                {day.entries.length > 1 && (
                                  <Button 
                                    variant="destructive" 
                                    size="sm"
                                    className="h-8 w-8"
                                    onClick={() => handleRemoveEntry(dayIdx, entryIdx)}
                                    disabled={isLocked}
                                  >
                                    -
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                          
                          {/* Submitted entries (read-only with edit option) */}
                          {submitted.map((submittedEntry, subIdx) => (
                            <tr key={`submitted-${dayIdx}-${subIdx}`} className="border-t bg-gray-100/50">
                              <td className="border p-2">
                                <span className="text-sm font-medium">{getWorkTypeLabel(submittedEntry.workType || "")}</span>
                              </td>
                              <td className="border p-2">
                                <span className="text-sm">{submittedEntry.project || "-"}</span>
                              </td>
                              <td className="border p-2">
                                <span className="text-sm">{submittedEntry.startTime || "-"}</span>
                              </td>
                              <td className="border p-2">
                                <span className="text-sm">{submittedEntry.endTime || "-"}</span>
                              </td>
                              <td className="border p-2">
                                <span className="text-sm font-medium">{submittedEntry.hours || "0"}</span>
                              </td>
                              <td className="border p-2 text-center">
                                {!isDayLocked && (
                                  <div className="flex justify-center gap-1">
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-8 w-8"
                                      onClick={() => handleEditEntry(submittedEntry, dateStr)}
                                      title="Edit entry"
                                    >
                                      <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </Button>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-8 w-8"
                                      onClick={() => handleDeleteEntry(submittedEntry.id!, dateStr)}
                                      title="Delete entry"
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {!isLocked && (
            <div className="mt-4 flex justify-end">
              <Button 
                variant="default" 
                onClick={handleSubmitAll}
                className="bg-orange-600 hover:bg-orange-700 w-full sm:w-auto"
                size={isMobile ? "lg" : "default"}
              >
                Save All Entries
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WeeklyCalendarEntrySimple;

