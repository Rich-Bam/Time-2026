import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Download } from 'lucide-react';
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

const timeOptions = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, '0');
  const m = String((i % 4) * 15).padStart(2, '0');
  return `${h}:${m}`;
});

const WeeklyCalendarEntry = ({ currentUser }: { currentUser: any }) => {
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return getWeekDates(now)[0];
  });
  const [days, setDays] = useState(() => getWeekDates(new Date()).map(date => ({ date, entries: [{ workType: "", project: "", hours: "", lunch: true, startTime: "", endTime: "" }], open: true }))); // Default open for better overview
  const [viewMode, setViewMode] = useState<"cards" | "overview">("cards"); // View mode: cards (current) or overview (week table)
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const { toast } = useToast();
  const [dbDaysOff, setDbDaysOff] = useState(0);
  const [customProjects, setCustomProjects] = useState<Record<string, string>>({});
  const [submittedEntries, setSubmittedEntries] = useState<Record<string, any[]>>({});
  const [confirmedWeeks, setConfirmedWeeks] = useState<Record<string, boolean>>({});

  const weekDates = getWeekDates(weekStart);
  const weekNumber = getISOWeekNumber(weekDates[0]);

  useEffect(() => {
    const fetchProjects = async () => {
      const { data, error } = await supabase.from("projects").select("id, name");
      if (data) setProjects(data);
    };
    fetchProjects();
  }, []);

  // Fetch days off from database for the current user and year
  useEffect(() => {
    const fetchDaysOff = async () => {
      if (!currentUser) return;
      const currentYear = new Date().getFullYear();
      const fromDate = `${currentYear}-01-01`;
      const toDate = `${currentYear}-12-31`;
      const { data, error } = await supabase
        .from("timesheet")
        .select("hours, description")
        .eq("user_id", currentUser.id)
        .eq("description", "31")
        .gte("date", fromDate)
        .lte("date", toDate);
      if (data) {
        const totalHours = data.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);
        setDbDaysOff(totalHours / 8);
      }
    };
    fetchDaysOff();
  }, [currentUser]);

  // Fetch submitted entries for a day
  const fetchSubmittedEntries = async (dateStr: string) => {
    if (!currentUser) return;
    const { data } = await supabase
      .from("timesheet")
      .select("id, project, hours, description, date, startTime, endTime")
      .eq("user_id", currentUser.id)
      .eq("date", dateStr);
    setSubmittedEntries(prev => ({ ...prev, [dateStr]: data || [] }));
  };

  // On mount and when week changes, fetch submitted entries for all days in the week
  useEffect(() => {
    if (!currentUser) return;
    weekDates.forEach(d => fetchSubmittedEntries(d.toISOString().split('T')[0]));
    // eslint-disable-next-line
  }, [currentUser, weekStart]);

  // Fetch confirmed status for the week
  const fetchConfirmedStatus = async () => {
    if (!currentUser) return;
    const weekKey = weekDates[0].toISOString().split('T')[0];
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

  // Ensure every day always has at least one entry
  useEffect(() => {
    setDays(prevDays => prevDays.map(day => ({
      ...day,
      entries: day.entries.length > 0 
        ? day.entries 
        : [{ workType: "", project: "", hours: "", lunch: true, startTime: "", endTime: "" }]
    })));
  }, [weekStart]);

  const changeWeek = (delta: number) => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + delta * 7);
    setWeekStart(getWeekDates(newStart)[0]);
    setDays(getWeekDates(newStart).map(date => ({ date, entries: [{ workType: "", project: "", hours: "", lunch: true, startTime: "", endTime: "" }], open: false })));
  };

  const handleOpenDay = (dayIdx: number) => {
    setDays(days.map((day, i) => {
      if (i !== dayIdx) {
        return { ...day, open: false };
      }
      // Ensure there is always at least one editable entry when a day is opened
      const hasEntries = day.entries && day.entries.length > 0;
      return {
        ...day,
        open: true,
        entries: hasEntries
          ? day.entries
          : [{ workType: "", project: "", hours: "", lunch: true, startTime: "", endTime: "" }],
      };
    }));
  };

  const handleAddEntry = (dayIdx: number) => {
    setDays(days.map((day, i) =>
      i === dayIdx ? { ...day, entries: [...day.entries, { workType: "", project: "", hours: "", lunch: true, startTime: "", endTime: "" }] } : day
    ));
  };

  const handleRemoveEntry = (dayIdx: number, entryIdx: number) => {
    setDays(days.map((day, i) =>
      i === dayIdx ? { ...day, entries: day.entries.filter((_, j) => j !== entryIdx) } : day
    ));
  };

  const handleEntryChange = (dayIdx: number, entryIdx: number, field: string, value: any) => {
    // Prevent updates for submitted entries (entryIdx === -1)
    if (entryIdx < 0) return;
    
    setDays(days.map((day, i) => {
      if (i !== dayIdx) return day;
      // Ensure entries array exists and has at least one entry
      const currentEntries = day.entries.length > 0 
        ? day.entries 
        : [{ workType: "", project: "", hours: "", lunch: true, startTime: "", endTime: "" }];
      
      return {
        ...day,
        entries: currentEntries.map((entry, j) => {
          if (j !== entryIdx) return entry;
          let updated = { ...entry, [field]: value };
          
          // Warn when lunch checkbox is toggled and hours would become 0
          if (field === "lunch" && value === true && updated.hours) {
            const hoursAfterLunch = Math.max(0, Number(updated.hours) - 0.5);
            if (hoursAfterLunch === 0) {
              toast({
                title: "Warning: Lunch Deduction",
                description: "Lunch will reduce hours to 0. Consider using work type 35 (Break) instead for flexible break times.",
                variant: "default",
              });
            }
          }
          
          // Auto-calculate hours if startTime and endTime are set and field is startTime or endTime
          if ((field === "startTime" || field === "endTime") && updated.startTime && updated.endTime) {
            const start = new Date(`2000-01-01T${updated.startTime}`);
            const end = new Date(`2000-01-01T${updated.endTime}`);
            let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            if (diff > 0) {
              updated.hours = diff.toString();
            }
          }
          // Auto-set endTime if empty or before new startTime
          if (field === "startTime") {
            if (!updated.endTime || updated.endTime <= value) {
              updated.endTime = addMinutes(value, 15);
            }
          }
          return updated;
        })
      };
    }));
  };

  // Days Off Remaining calculation (for current year)
  const totalDaysOff = 25;
  const daysOffLeft = (totalDaysOff - dbDaysOff).toFixed(1);

  const handleSubmitAll = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekKey = weekDates[0].toISOString().split('T')[0];
    const isWeekLocked = confirmedWeeks[weekKey];
    
    // Non-admins cannot submit if week is confirmed
    if (isWeekLocked && !currentUser?.isAdmin) {
      toast({
        title: "Niet toegestaan",
        description: "Deze week is bevestigd en kan niet meer worden gewijzigd. Neem contact op met een admin.",
        variant: "destructive",
      });
      return;
    }
    
    const entriesToSave = [];
    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const day = days[dayIdx];
      
      // Prevent future dates
      const entryDate = new Date(day.date);
      entryDate.setHours(0, 0, 0, 0);
      if (entryDate > today) {
        toast({
          title: "Future Date Not Allowed",
          description: `You cannot log hours for ${day.date.toLocaleDateString()} (future date). Please select today or a past date.`,
          variant: "destructive",
        });
        return;
      }
      
      const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6; // Sunday=0, Saturday=6
      for (let entryIdx = 0; entryIdx < day.entries.length; entryIdx++) {
        const entry = day.entries[entryIdx];
        const isDayOff = entry.workType === "31";
        // Only validate required fields for Mon-Fri
        if (!isWeekend && ((!entry.project && !isDayOff) || !entry.workType || !entry.hours)) {
          toast({
            title: "Missing Information",
            description: `Please fill in all required fields for ${day.date.toLocaleDateString()}`,
            variant: "destructive",
          });
          return;
        }
        // For weekends, skip empty entries
        if (isWeekend && (!entry.project && !isDayOff) && !entry.workType && !entry.hours) {
          continue;
        }
        
        // Validate hours match start/end time if both are provided
        if (entry.startTime && entry.endTime && entry.hours) {
          const start = new Date(`2000-01-01T${entry.startTime}`);
          const end = new Date(`2000-01-01T${entry.endTime}`);
          const calculatedHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          const enteredHours = Number(entry.hours);
          const lunchDeduction = entry.lunch && !isDayOff ? 0.5 : 0;
          const expectedHours = Math.max(0, calculatedHours - lunchDeduction);
          
          // Allow small difference (0.25 hours = 15 minutes tolerance)
          if (Math.abs(enteredHours - expectedHours) > 0.25) {
            toast({
              title: "Hours Mismatch",
              description: `For ${day.date.toLocaleDateString()}: The entered hours (${enteredHours}h) don't match the time range (${entry.startTime} - ${entry.endTime}). Expected approximately ${expectedHours.toFixed(2)}h.`,
              variant: "destructive",
            });
            return;
          }
        }
        
        let hoursToSave = Number(entry.hours);
        if (entry.lunch && !isDayOff) {
          hoursToSave = Math.max(0, hoursToSave - 0.5);
        }
        entriesToSave.push({
          project: isDayOff ? null : entry.project,
          user_id: currentUser?.id || null,
          date: day.date.toISOString().split('T')[0],
          hours: hoursToSave,
          description: entry.workType,
        });
      }
    }
    if (entriesToSave.length === 0) {
      toast({ title: "No entries", description: "Nothing to submit.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("timesheet").insert(entriesToSave);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Entries Saved", description: `${entriesToSave.length} entries logged.` });
    }
  };

  const doTimesOverlap = (startA, endA, startB, endB) => {
    if (!startA || !endA || !startB || !endB) return false;
    const sA = new Date(`2000-01-01T${startA}`);
    const eA = new Date(`2000-01-01T${endA}`);
    const sB = new Date(`2000-01-01T${startB}`);
    const eB = new Date(`2000-01-01T${endB}`);
    return sA < eB && sB < eA;
  };

  const handleSubmitDay = async (dayIdx: number) => {
    const day = days[dayIdx];
    const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
    const weekKey = weekDates[0].toISOString().split('T')[0];
    const isWeekLocked = confirmedWeeks[weekKey];
    
    // Non-admins cannot submit if week is confirmed
    if (isWeekLocked && !currentUser?.isAdmin) {
      toast({
        title: "Niet toegestaan",
        description: "Deze week is bevestigd en kan niet meer worden gewijzigd. Neem contact op met een admin.",
        variant: "destructive",
      });
      return;
    }
    
    // Prevent future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entryDate = new Date(day.date);
    entryDate.setHours(0, 0, 0, 0);
    if (entryDate > today) {
      toast({
        title: "Future Date Not Allowed",
        description: "You cannot log hours for future dates. Please select today or a past date.",
        variant: "destructive",
      });
      return;
    }
    
    const entriesToSave = [];
    const dateStr = day.date.toISOString().split('T')[0];
    const allEntries = [
      ...day.entries,
      ...(submittedEntries[dateStr] || []).map(e => ({ startTime: e.startTime, endTime: e.endTime }))
    ];
    for (let i = 0; i < allEntries.length; i++) {
      for (let j = i + 1; j < allEntries.length; j++) {
        if (doTimesOverlap(allEntries[i].startTime, allEntries[i].endTime, allEntries[j].startTime, allEntries[j].endTime)) {
          toast({
            title: "Overlapping Hours",
            description: "You cannot have overlapping working hours on the same day.",
            variant: "destructive",
          });
          return;
        }
      }
    }
    for (let entryIdx = 0; entryIdx < day.entries.length; entryIdx++) {
      const entry = day.entries[entryIdx];
      const isDayOff = entry.workType === "31";
      if (!isWeekend && ((!entry.project && !isDayOff) || !entry.workType || !entry.hours)) {
        toast({
          title: "Missing Information",
          description: `Please fill in all required fields for ${day.date.toLocaleDateString()}`,
          variant: "destructive",
        });
        return;
      }
      if (isWeekend && (!entry.project && !isDayOff) && !entry.workType && !entry.hours) {
        continue;
      }
      
      // Validate hours match start/end time if both are provided
      if (entry.startTime && entry.endTime && entry.hours) {
        const start = new Date(`2000-01-01T${entry.startTime}`);
        const end = new Date(`2000-01-01T${entry.endTime}`);
        const calculatedHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        const enteredHours = Number(entry.hours);
        const lunchDeduction = entry.lunch && !isDayOff ? 0.5 : 0;
        const expectedHours = Math.max(0, calculatedHours - lunchDeduction);
        
        // Allow small difference (0.25 hours = 15 minutes tolerance)
        if (Math.abs(enteredHours - expectedHours) > 0.25) {
          toast({
            title: "Hours Mismatch",
            description: `The entered hours (${enteredHours}h) don't match the time range (${entry.startTime} - ${entry.endTime}). Expected approximately ${expectedHours.toFixed(2)}h.`,
            variant: "destructive",
          });
          return;
        }
      }
      
      let hoursToSave = Number(entry.hours);
      if (entry.lunch && !isDayOff) {
        hoursToSave = Math.max(0, hoursToSave - 0.5);
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
    if (entriesToSave.length === 0) {
      toast({ title: "No entries", description: "Nothing to submit.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("timesheet").insert(entriesToSave);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Entries Saved", description: `${entriesToSave.length} entries logged for ${day.date.toLocaleDateString()}.` });
      // Reset that day's entries to a single empty entry
      setDays(prevDays => prevDays.map((d, i) =>
        i === dayIdx
          ? { ...d, entries: [{ workType: "", project: "", hours: "", lunch: true, startTime: "", endTime: "" }] }
          : d
      ));
      await fetchSubmittedEntries(day.date.toISOString().split('T')[0]);
    }
  };

  // Add a helper function to round time to nearest 15 minutes
  function roundToQuarterHour(timeStr: string) {
    // Accepts 'HH:mm' or 'H:mm' format
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return timeStr;
    let [_, h, m] = match;
    let hour = parseInt(h, 10);
    let min = parseInt(m, 10);
    // Round minutes to nearest 15
    min = Math.round(min / 15) * 15;
    if (min === 60) {
      hour += 1;
      min = 0;
    }
    return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  }

  const handleAddCustomProject = (dayIdx: number, entryIdx: number) => {
    const key = `${dayIdx}-${entryIdx}`;
    const customProject = customProjects[key]?.trim();
    if (customProject) {
      setDays(days => days.map((day, i) =>
        i === dayIdx ? {
          ...day,
          entries: day.entries.map((entry, j) =>
            j === entryIdx ? { ...entry, project: customProject } : entry
          )
        } : day
      ));
      setCustomProjects(cp => ({ ...cp, [key]: "" }));
    }
  };

  const handleConfirmWeek = async () => {
    const weekKey = weekDates[0].toISOString().split('T')[0];
    const { error } = await supabase.from('confirmed_weeks').upsert({
      user_id: currentUser.id,
      week_start_date: weekKey,
      confirmed: true,
      admin_approved: false,
      admin_reviewed: false
    });
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Week Bevestigd",
        description: "De week is bevestigd en wacht op admin goedkeuring. Je kunt de uren niet meer wijzigen tot een admin dit heeft goedgekeurd of teruggezet.",
      });
      fetchConfirmedStatus();
    }
  };

  const handleDeleteEntry = async (entryId: number, dateStr: string) => {
    const weekKey = weekDates[0].toISOString().split('T')[0];
    const isWeekLocked = confirmedWeeks[weekKey];
    
    // Non-admins cannot delete if week is confirmed
    if (isWeekLocked && !currentUser?.isAdmin) {
      toast({
        title: "Niet toegestaan",
        description: "Deze week is bevestigd en kan niet meer worden gewijzigd. Neem contact op met een admin.",
        variant: "destructive",
      });
      return;
    }
    
    await supabase.from('timesheet').delete().eq('id', entryId);
    fetchSubmittedEntries(dateStr);
  };

  const addMinutes = (timeStr, mins) => {
    if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return "";
    const [h, m] = timeStr.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return "";
    let total = h * 60 + m + mins;
    let hour = Math.floor(total / 60);
    let min = total % 60;
    // Round to nearest 15
    min = Math.round(min / 15) * 15;
    if (min === 60) {
      hour += 1;
      min = 0;
    }
    return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  };

  // Helper to check if all weekdays are filled
  const allWeekdaysFilled = weekDates.slice(0, 5).every((date, idx) => {
    const dateStr = date.toISOString().split('T')[0];
    const hasSubmitted = (submittedEntries[dateStr] || []).length > 0;
    const hasNew = days[idx].entries.some(e => e.project || e.workType || e.hours);
    return hasSubmitted || hasNew;
  });

  // Helper to format date as DD/MM/YY
  const formatDateDDMMYY = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  // Helper to format hours as HH:MM
  const formatHoursHHMM = (hours: number | string) => {
    const numHours = typeof hours === 'string' ? parseFloat(hours) : hours;
    if (isNaN(numHours)) return "00:00";
    const h = Math.floor(numHours);
    const m = Math.round((numHours - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Helper to get day name in Dutch
  const getDayNameNL = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
    return days[date.getDay()];
  };

  // Helper to get work type label
  const getWorkTypeLabel = (desc: string) => {
    const workType = workTypes.find(wt => String(wt.value) === String(desc));
    return workType ? workType.label : desc;
  };

  // Export week entries to Excel
  const handleExportWeek = async () => {
    if (!currentUser) {
      toast({
        title: "Error",
        description: "User not found",
        variant: "destructive",
      });
      return;
    }

    const fromDate = weekDates[0].toISOString().split('T')[0];
    const toDate = weekDates[6].toISOString().split('T')[0];

    const { data, error } = await supabase
      .from("timesheet")
      .select("*, projects(name)")
      .eq("user_id", currentUser.id)
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date", { ascending: true });

    if (error) {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (!data || data.length === 0) {
      toast({
        title: "No Data",
        description: "No entries found for this week.",
        variant: "destructive",
      });
      return;
    }

    // Get work type label for each entry
    const getWorkTypeLabel = (desc: string) => {
      const workType = workTypes.find(wt => String(wt.value) === String(desc));
      return workType ? workType.label : desc;
    };

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create header rows
    const headerRows = [
      ["Naam werknemer:", currentUser.name || currentUser.email || ""],
      ["Datum:", `Van: ${formatDateDDMMYY(fromDate)}`, `Tot: ${formatDateDDMMYY(toDate)}`],
      ["Dag:", ""],
      ["Weeknummer:", weekNumber.toString()],
      [""], // Empty row
      ["Jaar:", new Date().getFullYear().toString()],
      [""], // Empty row
    ];

    // Create table headers
    const tableHeaders = [
      ["Dag", "Soort werk", "Project", "Werkbon", "Van", "Tot", "Gewerkte uren", "Projectleider", "Km stand auto", "Uitgevoerde werkzaamheden"]
    ];

    // Format data rows
    const dataRows = data.map((entry) => [
      getDayNameNL(entry.date),
      getWorkTypeLabel(entry.description || ""),
      entry.projects?.name || entry.project || "",
      "", // Werkbon - not in database yet
      entry.startTime || "",
      entry.endTime || "",
      formatHoursHHMM(entry.hours || 0),
      "", // Projectleider - not in database yet
      "", // Km stand auto - not in database yet
      entry.notes || "",
    ]);

    // Combine all rows
    const allRows = [...headerRows, ...tableHeaders, ...dataRows];

    // Create worksheet from array
    const ws = XLSX.utils.aoa_to_sheet(allRows);

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // Dag
      { wch: 20 }, // Soort werk
      { wch: 20 }, // Project
      { wch: 12 }, // Werkbon
      { wch: 8 },  // Van
      { wch: 8 },  // Tot
      { wch: 12 }, // Gewerkte uren
      { wch: 15 }, // Projectleider
      { wch: 12 }, // Km stand auto
      { wch: 30 }, // Uitgevoerde werkzaamheden
    ];

    // Append worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Week Entries");

    // Generate filename
    const filename = `Week_${weekNumber}_${formatDateDDMMYY(fromDate)}_${formatDateDDMMYY(toDate)}.xlsx`;
    XLSX.writeFile(wb, filename);

    toast({
      title: "Export Successful",
      description: `Week ${weekNumber} entries exported to ${filename}`,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Weekly Calendar Entry</h2>
          <div className="mt-1 text-gray-700 font-medium">
            Week {weekNumber} ({weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()})
          </div>
          <div className="flex items-center gap-4 mt-2">
            <Button variant="outline" onClick={() => changeWeek(-1)}>&lt; Prev</Button>
            <Button variant="outline" onClick={() => changeWeek(1)}>Next &gt;</Button>
            <Button variant="outline" onClick={handleExportWeek} className="ml-2">
              <Download className="h-4 w-4 mr-2" />
              Export Week to Excel
            </Button>
          </div>
        </div>
        <Card className="bg-blue-50 border-blue-200 min-w-[260px]">
          <CardHeader>
            <CardTitle className="text-blue-900 text-lg">Days Off Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">{daysOffLeft} / {totalDaysOff}</div>
            <div className="text-sm text-blue-600 mt-2">You have {daysOffLeft} days off left this year.</div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="grid grid-cols-7 gap-2 flex-1">
              {days.map((day, dayIdx) => {
                const dateStr = day.date.toISOString().split('T')[0];
                const submittedCount = (submittedEntries[dateStr] || []).length;
                const totalEntries = day.entries.filter(e => e.project || e.workType || e.hours).length + submittedCount;
                return (
                  <div 
                    key={dayIdx} 
                    className={`border rounded-lg p-2 cursor-pointer transition-colors ${day.open ? 'bg-orange-100 border-orange-300' : 'bg-gray-50 hover:bg-gray-100'}`} 
                    onClick={() => handleOpenDay(dayIdx)}
                  >
                    <div className="font-semibold text-center text-sm">{day.date.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                    <div className="font-medium text-center text-xs">{day.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
                    <div className="text-xs text-center text-gray-500 mt-1">{totalEntries} {totalEntries === 1 ? 'entry' : 'entries'}</div>
                  </div>
                );
              })}
            </div>
            <div className="ml-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setViewMode(viewMode === "cards" ? "overview" : "cards")}
              >
                {viewMode === "cards" ? "📊 Week Overzicht" : "📋 Dag Weergave"}
              </Button>
            </div>
          </div>
          
          {confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
              ⚠️ Deze week is bevestigd. Je kunt geen wijzigingen meer aanbrengen tot een admin dit heeft goedgekeurd of teruggezet.
            </div>
          )}

          {viewMode === "overview" ? (
            // Week Overview - All days in one table
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left sticky left-0 bg-gray-100 z-10 min-w-[120px]">Dag</th>
                    <th className="border p-2 text-left min-w-[100px]">Werk Type</th>
                    <th className="border p-2 text-left min-w-[150px]">Project</th>
                    <th className="border p-2 text-left min-w-[80px]">Van</th>
                    <th className="border p-2 text-left min-w-[80px]">Tot</th>
                    <th className="border p-2 text-left min-w-[80px]">Uren</th>
                    <th className="border p-2 text-center min-w-[60px]">Lunch</th>
                    <th className="border p-2 text-center min-w-[50px]">Actie</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day, dayIdx) => {
                    const dateStr = day.date.toISOString().split('T')[0];
                    const submitted = submittedEntries[dateStr] || [];
                    const isLocked = confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin;
                    const dayName = day.date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
                    
                    // Combine editable entries and submitted entries
                    const allEntriesForDay = [
                      ...day.entries,
                      ...submitted.map(s => ({ 
                        id: s.id, 
                        workType: s.description, 
                        project: s.project, 
                        hours: s.hours, 
                        startTime: s.startTime, 
                        endTime: s.endTime,
                        lunch: false,
                        isSubmitted: true 
                      }))
                    ];

                    // Ensure at least one empty entry for editing
                    const editableEntries = day.entries.length > 0 
                      ? day.entries 
                      : [{ workType: "", project: "", hours: "", lunch: true, startTime: "", endTime: "" }];

                    return editableEntries.map((entry, entryIdx) => {
                      const isFirstEntry = entryIdx === 0;
                      const rowSpan = isFirstEntry ? editableEntries.length : 0;
                      
                      return (
                        <tr key={`${dayIdx}-${entryIdx}`} className="border-t hover:bg-gray-50">
                          {isFirstEntry && (
                            <td rowSpan={rowSpan} className="border p-2 sticky left-0 bg-white font-medium align-top">
                              {dayName}
                              <div className="mt-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="h-6 text-xs w-full"
                                  onClick={() => handleAddEntry(dayIdx)}
                                  disabled={isLocked}
                                >
                                  + Toevoegen
                                </Button>
                              </div>
                            </td>
                          )}
                          <td className="border p-1">
                            <Select 
                              value={entry.workType || ""} 
                              onValueChange={val => handleEntryChange(dayIdx, entryIdx, "workType", val)}
                              disabled={isLocked}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                              <SelectContent>
                                {workTypes.map(type => (
                                  <SelectItem key={type.value} value={String(type.value)}>{type.value} - {type.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="border p-1">
                            <Select
                              value={entry.project || ""}
                              onValueChange={val => handleEntryChange(dayIdx, entryIdx, "project", val)}
                              disabled={entry.workType === "31" || isLocked}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Project" /></SelectTrigger>
                              <SelectContent>
                                {projects.map(project => (
                                  <SelectItem key={project.id} value={project.name}>{project.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="border p-1">
                            <Input
                              type="text"
                              value={entry.startTime || ""}
                              onChange={e => handleEntryChange(dayIdx, entryIdx, "startTime", roundToQuarterHour(e.target.value))}
                              placeholder="08:00"
                              className="h-8 text-xs w-20"
                              disabled={isLocked}
                            />
                          </td>
                          <td className="border p-1">
                            <Input
                              type="text"
                              value={entry.endTime || ""}
                              onChange={e => handleEntryChange(dayIdx, entryIdx, "endTime", roundToQuarterHour(e.target.value))}
                              placeholder="17:00"
                              className="h-8 text-xs w-20"
                              disabled={isLocked}
                            />
                          </td>
                          <td className="border p-1">
                            <Input 
                              type="number" 
                              min="0" 
                              step="0.25" 
                              value={entry.hours || ""}
                              onChange={e => handleEntryChange(dayIdx, entryIdx, "hours", e.target.value)} 
                              placeholder="0"
                              className="h-8 text-xs w-16"
                              disabled={isLocked}
                            />
                          </td>
                          <td className="border p-1 text-center">
                            <input
                              type="checkbox"
                              checked={entry.lunch || false}
                              onChange={e => handleEntryChange(dayIdx, entryIdx, "lunch", e.target.checked)}
                              className="h-4 w-4"
                              disabled={isLocked}
                            />
                          </td>
                          <td className="border p-1 text-center">
                            <div className="flex gap-1 justify-center">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleSubmitDay(dayIdx)}
                                disabled={isLocked}
                              >
                                ✓
                              </Button>
                              {editableEntries.length > 1 && (
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
                          </td>
                        </tr>
                      );
                    });
                  })}
                  {/* Show submitted entries as read-only rows */}
                  {days.map((day, dayIdx) => {
                    const dateStr = day.date.toISOString().split('T')[0];
                    const submitted = submittedEntries[dateStr] || [];
                    const isLocked = confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin;
                    
                    return submitted.map((submittedEntry, subIdx) => (
                      <tr key={`submitted-${dayIdx}-${subIdx}`} className="border-t bg-gray-50">
                        <td className="border p-2 sticky left-0 bg-gray-50 font-medium text-xs">
                          {day.date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </td>
                        <td className="border p-1">
                          <span className="text-xs">{getWorkTypeLabel(submittedEntry.description || "")}</span>
                        </td>
                        <td className="border p-1">
                          <span className="text-xs">{submittedEntry.project || "-"}</span>
                        </td>
                        <td className="border p-1">
                          <span className="text-xs">{submittedEntry.startTime || "-"}</span>
                        </td>
                        <td className="border p-1">
                          <span className="text-xs">{submittedEntry.endTime || "-"}</span>
                        </td>
                        <td className="border p-1">
                          <span className="text-xs">{submittedEntry.hours || "0"}</span>
                        </td>
                        <td className="border p-1 text-center">
                          <span className="text-xs">-</span>
                        </td>
                        <td className="border p-1 text-center">
                          {!isLocked && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-7 w-7"
                              onClick={() => handleDeleteEntry(submittedEntry.id, dateStr)}
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
              {!confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && (
                <div className="mt-4 flex justify-end">
                  <Button 
                    variant="default" 
                    onClick={handleSubmitAll}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    Submit All Days
                  </Button>
                </div>
              )}
            </div>
          ) : (
            // Cards view - original functionality
            <>
          {days.map((day, dayIdx) => day.open && (
            <div key={dayIdx} className="mb-4 border rounded-lg p-4 bg-white shadow">
              <div className="font-semibold mb-2">{day.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</div>
              {confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
                  ⚠️ Deze week is bevestigd. Je kunt geen wijzigingen meer aanbrengen tot een admin dit heeft goedgekeurd of teruggezet.
                </div>
              )}
              {day.entries.map((entry, entryIdx) => (
                <div key={entryIdx} className="flex flex-wrap gap-2 items-end mb-2">
                  <div>
                    <Label>Work Type</Label>
                    <Select 
                      value={entry.workType} 
                      onValueChange={val => handleEntryChange(dayIdx, entryIdx, "workType", val)}
                      disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
                    >
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
                    {entry.project && !projects.some(p => p.name === entry.project) ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          value={entry.project}
                          onChange={e => handleEntryChange(dayIdx, entryIdx, "project", e.target.value)}
                          placeholder="Project"
                          disabled={entry.workType === "31" || (confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin)}
                        />
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleEntryChange(dayIdx, entryIdx, "project", "")}
                          disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
                        >
                          Clear
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Select
                          value={entry.project}
                          onValueChange={val => handleEntryChange(dayIdx, entryIdx, "project", val)}
                          disabled={entry.workType === "31" || (confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin)}
                        >
                          <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
                          <SelectContent>
                            {projects.map(project => (
                              <SelectItem key={project.id} value={project.name}>{project.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2 mt-1">
                          <Input
                            value={customProjects[`${dayIdx}-${entryIdx}`] || ""}
                            onChange={e => setCustomProjects(prev => ({ ...prev, [`${dayIdx}-${entryIdx}`]: e.target.value }))}
                            placeholder="Add custom project"
                            disabled={entry.workType === "31" || (confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin)}
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="ml-2"
                            onClick={() => handleAddCustomProject(dayIdx, entryIdx)}
                            disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
                          >
                            Add
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <Label>Start Time</Label>
                    <Input
                      type="text"
                      value={entry.startTime}
                      onChange={e => handleEntryChange(dayIdx, entryIdx, "startTime", roundToQuarterHour(e.target.value))}
                      placeholder="Start (e.g. 08:10)"
                      className="w-20"
                      disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
                    />
                  </div>
                  <div>
                    <Label>End Time</Label>
                    <Input
                      type="text"
                      value={entry.endTime}
                      onChange={e => handleEntryChange(dayIdx, entryIdx, "endTime", roundToQuarterHour(e.target.value))}
                      placeholder="End (e.g. 17:45)"
                      className="w-20"
                      disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
                    />
                  </div>
                  <div>
                    <Label>Hours</Label>
                    <Input 
                      type="number" 
                      min="0" 
                      step="0.25" 
                      value={entry.hours} 
                      onChange={e => handleEntryChange(dayIdx, entryIdx, "hours", e.target.value)} 
                      placeholder="h"
                      disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
                    />
                  </div>
                  <div className="flex items-center ml-2">
                    <input
                      id={`lunch-${dayIdx}-${entryIdx}`}
                      type="checkbox"
                      checked={entry.lunch}
                      onChange={e => handleEntryChange(dayIdx, entryIdx, "lunch", e.target.checked)}
                      className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                      disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
                    />
                    <label htmlFor={`lunch-${dayIdx}-${entryIdx}`} className="ml-1 text-xs text-gray-700 select-none">
                      Lunch
                    </label>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => handleRemoveEntry(dayIdx, entryIdx)}
                    disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
                  >
                    -
                  </Button>
                </div>
              ))}
              <div className="flex gap-4 mt-4">
                <Button 
                  variant="default" 
                  onClick={() => handleSubmitDay(dayIdx)}
                  disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
                >
                  Submit Day
                </Button>
              </div>
              {submittedEntries[day.date.toISOString().split('T')[0]] && submittedEntries[day.date.toISOString().split('T')[0]].length > 0 && (
                <div className="mt-4">
                  <div className="font-semibold text-sm mb-1 text-gray-700">Submitted Entries:</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs border rounded">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-1 border">Project</th>
                          <th className="p-1 border">Work Type</th>
                          <th className="p-1 border">Hours</th>
                          {!confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && (
                            <th className="p-1 border">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {submittedEntries[day.date.toISOString().split('T')[0]].map((entry, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-1 border">{entry.project}</td>
                            <td className="p-1 border">{entry.description}</td>
                            <td className="p-1 border">{entry.startTime && entry.endTime ? `${entry.startTime} - ${entry.endTime}` : '-'}</td>
                            {!confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && (
                              <td className="p-1 border">
                                <Button size="icon" variant="ghost" onClick={() => handleDeleteEntry(entry.id, day.date.toISOString().split('T')[0])}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            ))}
            </>
          )}
        </CardContent>
      </Card>
      {!confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && allWeekdaysFilled && (
        <Card className="mt-4 bg-orange-50 border-orange-200">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="text-sm text-orange-800">
                <strong>Let op:</strong> Na bevestiging kun je de uren niet meer wijzigen tot een admin dit heeft goedgekeurd of teruggezet.
              </div>
              <Button 
                className="w-full bg-orange-600 hover:bg-orange-700 text-white" 
                variant="default" 
                onClick={handleConfirmWeek}
              >
                Week Bevestigen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && (
        <Card className="mt-4 bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="text-blue-800 font-semibold">
              ✓ Deze week is bevestigd en wacht op admin goedkeuring. Je kunt de uren niet meer wijzigen.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WeeklyCalendarEntry; 