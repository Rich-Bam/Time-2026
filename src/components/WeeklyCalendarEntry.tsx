import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Trash2, Download, Plus, Check, ChevronsUpDown } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { cn } from "@/lib/utils";
import { formatDateToYYYYMMDD } from "@/utils/dateUtils";
import OvertimeSummaryPanel from "@/components/OvertimeSummaryPanel";
import OvernightSummaryPanel from "@/components/OvernightSummaryPanel";

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

// Helper function to check if a work type doesn't require a project
const workTypeRequiresProject = (workType: string): boolean => {
  if (!workType) return true; // Empty work type requires project
  const workTypeNum = parseInt(workType, 10);
  // Work types 17 and 30-40 don't require a project
  if (workTypeNum === 17) return false;
  if (workTypeNum >= 30 && workTypeNum <= 40) return false;
  return true;
};

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

type WeeklyEntryRow = {
  workType: string;
  project: string;
  hours: string;
  startTime: string;
  endTime: string;
  fullDayOff?: boolean;
  id?: any;
};

type WeeklyDayState = {
  date: Date;
  stayedOvernight: boolean;
  entries: WeeklyEntryRow[];
  open: boolean;
};

const WeeklyCalendarEntry = ({ currentUser, hasUnreadDaysOffNotification = false, useSimpleView, setUseSimpleView }: { currentUser: any; hasUnreadDaysOffNotification?: boolean; useSimpleView?: boolean; setUseSimpleView?: (value: boolean) => void }) => {
  const { t } = useLanguage();
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return getWeekDates(now)[0];
  });
  const [days, setDays] = useState<WeeklyDayState[]>(() =>
    getWeekDates(new Date()).map(date => ({
      date,
      stayedOvernight: false,
      entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "", fullDayOff: false }],
      open: true,
    }))
  ); // Default open for better overview
  const [viewMode, setViewMode] = useState<"cards" | "overview">("cards"); // View mode: cards (current) or overview (week table)
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const { toast } = useToast();
  const [dbDaysOff, setDbDaysOff] = useState(0);
  const [customProjects, setCustomProjects] = useState<Record<string, string>>({});
  const [submittedEntries, setSubmittedEntries] = useState<Record<string, any[]>>({});
  const [confirmedWeeks, setConfirmedWeeks] = useState<Record<string, boolean>>({});
  const [openWorkTypePopovers, setOpenWorkTypePopovers] = useState<Record<string, boolean>>({});
  const [workTypeSearchValues, setWorkTypeSearchValues] = useState<Record<string, string>>({});
  const [availableWeeks, setAvailableWeeks] = useState<Array<{ weekStart: string; weekNumber: number; year: number; label: string }>>([]);

  const weekDates = getWeekDates(weekStart);
  const weekNumber = getISOWeekNumber(weekDates[0]);

  // Store projects with status for validation - ALWAYS fetch ALL projects (including closed) for validation
  const [projectsWithStatus, setProjectsWithStatus] = useState<{ id: number; name: string; status: string | null }[]>([]);
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        // First, fetch ALL projects with status for validation (including closed ones)
        let allProjectsQuery = supabase
          .from("projects")
          .select("id, name, user_id, status");
        
        if (currentUser?.id) {
          try {
            const { data: allProjectsData } = await allProjectsQuery.or(`user_id.is.null,user_id.eq.${currentUser.id}`);
            if (allProjectsData) {
              // Store ALL projects (including closed) for validation
              setProjectsWithStatus(allProjectsData
                .filter(p => !p.user_id || p.user_id === currentUser.id)
                .map(p => ({ id: p.id, name: p.name, status: p.status || null })));
            }
          } catch (err) {
            // Fallback: fetch all projects without user_id filter
            const { data: allData } = await supabase.from("projects").select("id, name, status");
            setProjectsWithStatus((allData || []).map(p => ({ id: p.id, name: p.name, status: p.status || null })));
          }
        } else {
          const { data: allData } = await supabase.from("projects").select("id, name, status");
          setProjectsWithStatus((allData || []).map(p => ({ id: p.id, name: p.name, status: p.status || null })));
        }
        
        // Now fetch only active projects for the dropdown
        let query = supabase
          .from("projects")
          .select("id, name, user_id, status");
        
        // Only filter by user_id if currentUser exists
        if (currentUser?.id) {
          try {
            const { data, error } = await query.or(`user_id.is.null,user_id.eq.${currentUser.id}`);
            if (error && error.message.includes("does not exist")) {
              // user_id or status column doesn't exist yet, fetch all projects
              const { data: allData } = await supabase.from("projects").select("id, name");
              setProjects(allData || []);
              return;
            }
            if (data) {
              // Only show global projects and current user's custom projects
              // Filter out closed projects (only show active projects for time entry)
              const filteredProjects = data
                .filter(p => !p.user_id || p.user_id === currentUser.id)
                .filter(p => !p.status || p.status !== "closed")
                .map(p => ({ id: p.id, name: p.name }));
              setProjects(filteredProjects);
              return;
            }
          } catch (err) {
            // If user_id or status column doesn't exist, just fetch all projects
            const { data: allData } = await supabase.from("projects").select("id, name");
            setProjects(allData || []);
            return;
          }
        } else {
          // No currentUser, just fetch all active projects
          const { data } = await supabase
            .from("projects")
            .select("id, name, status")
            .or("status.is.null,status.neq.closed");
          setProjects((data || []).map(p => ({ id: p.id, name: p.name })));
        }
      } catch (err) {
        // Fallback: fetch all projects without user_id/status filtering
        const { data } = await supabase.from("projects").select("id, name");
        setProjects(data || []);
        // Still try to get status for validation
        const { data: allData } = await supabase.from("projects").select("id, name, status");
        setProjectsWithStatus((allData || []).map(p => ({ id: p.id, name: p.name, status: p.status || null })));
      }
    };
    fetchProjects();
  }, [currentUser]);

  // Fetch overnight stays for the visible week (saved independently from timesheet entries)
  useEffect(() => {
    const fetchOvernightStaysForWeek = async () => {
      if (!currentUser?.id) return;
      const from = formatDateToYYYYMMDD(weekDates[0]);
      const to = formatDateToYYYYMMDD(weekDates[6]);

      const { data, error } = await supabase
        .from("overnight_stays")
        .select("date")
        .eq("user_id", currentUser.id)
        .gte("date", from)
        .lte("date", to);

      if (error) {
        console.warn("Failed to fetch overnight stays:", error);
        return;
      }

      const dates = new Set((data || []).map((r: any) => String(r.date)));
      setDays(prevDays =>
        prevDays.map(d => ({
          ...d,
          stayedOvernight: dates.has(formatDateToYYYYMMDD(d.date)),
        }))
      );
    };

    fetchOvernightStaysForWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, weekStart]);

  const persistOvernightStay = async (dayIdx: number, checked: boolean, isLocked: boolean) => {
    if (!currentUser?.id || isLocked) return;
    const dateStr = formatDateToYYYYMMDD(days[dayIdx].date);

    // Optimistic UI
    setDays(prevDays => prevDays.map((d, i) => (i === dayIdx ? { ...d, stayedOvernight: checked } : d)));

    try {
      if (checked) {
        const { error } = await supabase
          .from("overnight_stays")
          .upsert([{ user_id: currentUser.id, date: dateStr }], { onConflict: "user_id,date" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("overnight_stays")
          .delete()
          .eq("user_id", currentUser.id)
          .eq("date", dateStr);
        if (error) throw error;
      }
    } catch (error: any) {
      // Revert on failure
      setDays(prevDays => prevDays.map((d, i) => (i === dayIdx ? { ...d, stayedOvernight: !checked } : d)));
      toast({
        title: t('common.error'),
        description: error?.message || "Failed to save overnight stay",
        variant: "destructive",
      });
    }
  };

  // Fetch days off from database for the current user and year
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
      // Sum all entries with description "31" (both user entries and admin adjustments)
      const totalHours = data.reduce((sum, e) => sum + (parseFloat(String(e.hours)) || 0), 0);
      setDbDaysOff(totalHours / 8);
    }
  };

  useEffect(() => {
    fetchDaysOff();
  }, [currentUser]);

  // Fetch all weeks where user has entries (for all users)
  const fetchAvailableWeeks = async () => {
    if (!currentUser) {
      setAvailableWeeks([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("timesheet")
        .select("date")
        .eq("user_id", currentUser.id)
        .order("date", { ascending: false });

      if (error) {
        console.error("Error fetching available weeks:", error);
        return;
      }

      if (!data || data.length === 0) {
        setAvailableWeeks([]);
        return;
      }

      // Get unique week start dates
      const weekStarts = new Set<string>();
      data.forEach(entry => {
        const date = new Date(entry.date);
        const weekStart = getWeekDates(date)[0];
        weekStarts.add(formatDateToYYYYMMDD(weekStart));
      });

      // Convert to array and format for dropdown
      const weeks = Array.from(weekStarts).map(weekStartStr => {
        const weekStartDate = new Date(weekStartStr);
        const weekDates = getWeekDates(weekStartDate);
        const weekNumber = getISOWeekNumber(weekDates[0]);
        const year = weekStartDate.getFullYear();
        const label = `${t('weekly.week')} ${weekNumber} (${weekDates[0].toLocaleDateString()} - ${weekDates[6].toLocaleDateString()})`;
        return { weekStart: weekStartStr, weekNumber, year, label };
      });

      // Sort by date descending (newest first)
      weeks.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
      setAvailableWeeks(weeks);
    } catch (err) {
      console.error("Error fetching available weeks:", err);
    }
  };

  useEffect(() => {
    fetchAvailableWeeks();
  }, [currentUser]);

  // Fetch submitted entries for a day
  const fetchSubmittedEntries = async (dateStr: string) => {
    if (!currentUser) return;
    const { data } = await supabase
      .from("timesheet")
      .select("id, project, hours, description, date, startTime, endTime")
      .eq("user_id", currentUser.id)
      .eq("date", dateStr);
    
    // Filter out admin adjustments (entries without startTime/endTime are admin adjustments)
    // Only show entries that have both startTime and endTime - these are user-created entries
    // Admin adjustments don't have startTime/endTime and should not be shown in weekly entry
    const filteredData = (data || []).filter(e => e.startTime && e.endTime);
    
    // Sort by startTime (earliest to latest)
    const sortedData = filteredData.sort((a, b) => {
      const timeA = a.startTime || "";
      const timeB = b.startTime || "";
      return timeA.localeCompare(timeB);
    });
    
    setSubmittedEntries(prev => ({ ...prev, [dateStr]: sortedData }));
  };

  // On mount and when week changes, fetch submitted entries for all days in the week
  useEffect(() => {
    if (!currentUser) return;
    weekDates.forEach(d => fetchSubmittedEntries(formatDateToYYYYMMDD(d)));
    // eslint-disable-next-line
  }, [currentUser, weekStart]);

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
    // Week is locked if confirmed = true (regardless of admin status)
    // This ensures consistency with Simple view - once confirmed, week is locked in both views
    // Admins can unlock via admin panel if needed
    const isLocked = !!data?.confirmed;
    setConfirmedWeeks(prev => ({ ...prev, [weekKey]: isLocked }));
  };

  useEffect(() => {
    fetchConfirmedStatus();
    // eslint-disable-next-line
  }, [currentUser, weekStart]);

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
      console.log('CONFIRMING WEEK (Original view) - Setting state to locked:', weekKeyDate);
      
      // Lock the week immediately
      setConfirmedWeeks(prev => {
        const updated = { ...prev, [weekKeyDate]: true };
        console.log('CONFIRMING WEEK (Original view) - Updated state:', updated);
        return updated;
      });
      
      toast({
        title: t('weekly.weekConfirmed'),
        description: t('admin.weekConfirmedAndLocked')
      });
    }
  };

  // Set up real-time subscription to listen for changes to confirmed_weeks
  useEffect(() => {
    if (!currentUser) return;
    
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    
    const channel = supabase
      .channel(`confirmed_weeks_${currentUser.id}_${weekKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'confirmed_weeks',
          filter: `user_id=eq.${currentUser.id} AND week_start_date=eq.${weekKey}`
        },
        (payload) => {
          console.log('Real-time update for confirmed_weeks:', payload);
          // Update confirmed status immediately when it changes
          // Week is locked if confirmed = true (regardless of admin status)
          const isLocked = !!(payload.new as any)?.confirmed;
          setConfirmedWeeks(prev => ({ ...prev, [weekKey]: isLocked }));
          // Also refresh from database to ensure consistency
          fetchConfirmedStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, weekStart]);

  // Ensure every day always has at least one entry
  useEffect(() => {
    setDays(prevDays => prevDays.map(day => ({
      ...day,
      entries: day.entries.length > 0 
        ? day.entries 
        : [{ workType: "", project: "", hours: "", startTime: "", endTime: "" }]
    })));
  }, [weekStart]);

  const changeWeek = (delta: number) => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + delta * 7);
    setWeekStart(getWeekDates(newStart)[0]);
    setDays(getWeekDates(newStart).map(date => ({
      date,
      stayedOvernight: false,
      entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "", fullDayOff: false }],
      open: false,
    })));
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
          : [{ workType: "", project: "", hours: "", startTime: "", endTime: "" }],
      };
    }));
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
      i === dayIdx ? { ...day, entries: [...day.entries, { workType: "", project: "", hours: "", startTime: "", endTime: "" }] } : day
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
    // Prevent updates for submitted entries (entryIdx === -1)
    if (entryIdx < 0) return;
    
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    const isWeekLocked = confirmedWeeks[weekKey];
    
    // Non-admins cannot change entries if week is confirmed
    if (isWeekLocked && !currentUser?.isAdmin) {
      return;
    }
    
    setDays(days.map((day, i) => {
      if (i !== dayIdx) return day;
      // Ensure entries array exists and has at least one entry
      const currentEntries = day.entries.length > 0 
        ? day.entries 
        : [{ workType: "", project: "", hours: "", startTime: "", endTime: "", fullDayOff: false }];
      
      return {
        ...day,
        entries: currentEntries.map((entry, j) => {
          if (j !== entryIdx) return entry;
          let updated = { ...entry, [field]: value };
          
          // Handle fullDayOff checkbox
          if (field === "fullDayOff") {
            const isFullDay = value === true;
            if (isFullDay) {
              // Set times to 08:00 - 16:30, but hours to 8 (minus 0.5 hour break)
              updated.startTime = "08:00";
              updated.endTime = "16:30";
              updated.hours = "8";
            } else {
              // Clear times and hours when unchecking
              updated.startTime = "";
              updated.endTime = "";
              updated.hours = "";
            }
          }
          // Auto-calculate hours if startTime and endTime are set and field is startTime or endTime
          if ((field === "startTime" || field === "endTime") && updated.startTime && updated.endTime && !updated.fullDayOff) {
            const start = new Date(`2000-01-01T${updated.startTime}`);
            const end = new Date(`2000-01-01T${updated.endTime}`);
            let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            if (diff > 0) {
              updated.hours = diff.toString();
            }
          }
          // Auto-set endTime if empty or before new startTime
          if (field === "startTime" && !updated.fullDayOff) {
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
  // Calculate hours left first (more accurate), then convert to days
  const totalHoursAvailable = totalDaysOff * 8;
  const totalHoursTaken = dbDaysOff * 8;
  const hoursLeft = totalHoursAvailable - totalHoursTaken;
  const daysOffLeft = (hoursLeft / 8).toFixed(1);
  const hoursLeftRounded = hoursLeft.toFixed(1);

  const handleSubmitAll = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
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
    const customProjectsToCreate = new Set<string>();
    
    // First pass: collect all custom projects that need to be created
    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const day = days[dayIdx];
      const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
      for (let entryIdx = 0; entryIdx < day.entries.length; entryIdx++) {
        const entry = day.entries[entryIdx];
        const isDayOff = entry.workType === "31";
        if (entry.project && !isDayOff && currentUser?.id) {
          const isCustomProject = !projects.some(p => p.name === entry.project);
          if (isCustomProject) {
            customProjectsToCreate.add(entry.project);
          }
        }
      }
    }
    
    // Create all custom projects in batch
    if (customProjectsToCreate.size > 0) {
      for (const projectName of customProjectsToCreate) {
        // Check if project already exists (by name only, since user_id might not exist)
        const { data: existingProject } = await supabase
          .from("projects")
          .select("id")
          .eq("name", projectName)
          .single();
        
        if (!existingProject) {
          // Try to insert with user_id first, if it fails, try without
          const projectData: any = {
            name: projectName,
            status: "active",
          };
          
          if (currentUser?.id) {
            // First attempt: try with user_id
            const result = await supabase
              .from("projects")
              .insert([{
                ...projectData,
                user_id: currentUser.id,
              }]);
            
            // If error mentions user_id column doesn't exist, try without it
            if (result.error && result.error.message?.includes("user_id")) {
              await supabase
                .from("projects")
                .insert([projectData]);
            }
          } else {
            // No user_id, insert without it
            await supabase
              .from("projects")
              .insert([projectData]);
          }
        }
      }
      
      // Refresh projects list once after creating all custom projects
      // Try to fetch with user_id filter, if it fails, fetch all
      let updatedProjects;
      if (currentUser?.id) {
        const result = await supabase
          .from("projects")
          .select("id, name, user_id")
          .or(`user_id.is.null,user_id.eq.${currentUser.id}`);
        
        if (result.error && result.error.message?.includes("user_id")) {
          // user_id column doesn't exist, fetch all projects
          const allProjectsResult = await supabase
            .from("projects")
            .select("id, name");
          updatedProjects = allProjectsResult.data;
        } else {
          updatedProjects = result.data;
          if (updatedProjects) {
            updatedProjects = updatedProjects.filter(
              p => !p.user_id || p.user_id === currentUser.id
            );
          }
        }
      } else {
        const result = await supabase
          .from("projects")
          .select("id, name");
        updatedProjects = result.data;
      }
      
      if (updatedProjects) {
        setProjects(updatedProjects);
      }
    }
    
    // Second pass: create entries
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
        const requiresProject = workTypeRequiresProject(entry.workType);
        // For non-weekend days, require: workType, and either (project or work type doesn't require project), and (startTime/endTime or hours)
        if (!isWeekend && ((!entry.project && requiresProject) || !entry.workType || (!entry.startTime && !entry.endTime && !entry.hours))) {
          toast({
            title: "Missing Information",
            description: `Please fill in all required fields for ${day.date.toLocaleDateString()}. You need to enter start and end times.`,
            variant: "destructive",
          });
          return;
        }
        // Validate that project is not closed - check directly from database for most up-to-date status
        if (entry.project && requiresProject && !isDayOff) {
          // First check local cache
          const selectedProject = projectsWithStatus.find(p => p.name === entry.project);
          if (selectedProject && selectedProject.status === "closed") {
            toast({
              title: "Project Closed",
              description: `The project "${entry.project}" is closed and cannot be used for time entries.`,
              variant: "destructive",
            });
            return;
          }
          // Also check directly from database to ensure we have the latest status
          const { data: projectData } = await supabase
            .from("projects")
            .select("id, name, status")
            .eq("name", entry.project)
            .maybeSingle();
          
          if (projectData && projectData.status === "closed") {
            toast({
              title: "Project Closed",
              description: `The project "${entry.project}" is closed and cannot be used for time entries.`,
              variant: "destructive",
            });
            // Refresh projectsWithStatus
            const { data: allProjects } = await supabase
              .from("projects")
              .select("id, name, user_id, status");
            if (allProjects && currentUser?.id) {
              const filtered = allProjects.filter(p => !p.user_id || p.user_id === currentUser.id);
              setProjectsWithStatus(filtered.map(p => ({ id: p.id, name: p.name, status: p.status || null })));
            } else if (allProjects) {
              setProjectsWithStatus(allProjects.map(p => ({ id: p.id, name: p.name, status: p.status || null })));
            }
            return;
          }
        }
        // For weekends, skip empty entries
        if (isWeekend && (!entry.project && !isDayOff) && !entry.workType && !entry.startTime && !entry.endTime && !entry.hours) {
          continue;
        }
        
        // Calculate hours from start/end time if available, otherwise use entered hours
        let hoursToSave = 0;
        // If full day off is checked, use 8 hours
        if (isDayOff && entry.fullDayOff) {
          hoursToSave = 8;
        } else if (entry.startTime && entry.endTime) {
          const start = new Date(`2000-01-01T${entry.startTime}`);
          const end = new Date(`2000-01-01T${entry.endTime}`);
          const calculatedHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          hoursToSave = calculatedHours;
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
        
        // For day off, ensure we have at least some hours
        if (isDayOff && hoursToSave <= 0) {
          toast({
            title: "Error",
            description: "Please enter valid hours or check 'Hele dag vrij'",
            variant: "destructive",
          });
          return;
        }
        
        const insertData: any = {
          project: isDayOff ? null : entry.project,
          user_id: currentUser?.id || null,
          date: formatDateToYYYYMMDD(day.date),
          hours: hoursToSave,
          description: entry.workType,
          stayed_overnight: !!day.stayedOvernight,
        };
        
        // Only include startTime/endTime if they are provided
        if (entry.startTime) {
          insertData.startTime = entry.startTime;
        } else {
          insertData.startTime = null;
        }
        
        if (entry.endTime) {
          insertData.endTime = entry.endTime;
        } else {
          insertData.endTime = null;
        }
        
        entriesToSave.push(insertData);
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
      // Refresh submitted entries for all days in the week
      weekDates.forEach(d => fetchSubmittedEntries(formatDateToYYYYMMDD(d)));
      // Check if any saved entries were day off entries and refresh days off
      const hasDayOffEntry = entriesToSave.some(e => e.description === "31");
      if (hasDayOffEntry) {
        await fetchDaysOff();
      }
      // Reset entries to empty
      setDays(getWeekDates(weekStart).map(date => ({ 
        date, 
        stayedOvernight: false,
        entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "", fullDayOff: false }],
        open: false,
      })));
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
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
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
    
    // First, collect custom projects that need to be created
    const customProjectsToCreate = new Set<string>();
    for (let entryIdx = 0; entryIdx < day.entries.length; entryIdx++) {
      const entry = day.entries[entryIdx];
      const isDayOff = entry.workType === "31";
      if (entry.project && !isDayOff && currentUser?.id) {
        const isCustomProject = !projects.some(p => p.name === entry.project);
        if (isCustomProject) {
          customProjectsToCreate.add(entry.project);
        }
      }
    }
    
    // Create all custom projects in batch
    if (customProjectsToCreate.size > 0 && currentUser?.id) {
      for (const projectName of customProjectsToCreate) {
        const { data: existingProject } = await supabase
          .from("projects")
          .select("id")
          .eq("name", projectName)
          .eq("user_id", currentUser.id)
          .single();
        
        if (!existingProject) {
          await supabase
            .from("projects")
            .insert([{
              name: projectName,
              user_id: currentUser.id,
              description: null
            }]);
        }
      }
      
      // Refresh projects list once after creating all custom projects
      const { data: updatedProjects } = await supabase
        .from("projects")
        .select("id, name, user_id")
        .or(`user_id.is.null,user_id.eq.${currentUser.id}`);
      if (updatedProjects) {
        const filteredProjects = updatedProjects.filter(
          p => !p.user_id || p.user_id === currentUser.id
        );
        setProjects(filteredProjects);
      }
    }
    
    const entriesToSave = [];
    const dateStr = formatDateToYYYYMMDD(day.date);
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
      const requiresProject = workTypeRequiresProject(entry.workType);
      // For day off entries, either fullDayOff must be checked OR time fields must be filled
      if (isDayOff) {
        if (!entry.fullDayOff && !entry.startTime && !entry.endTime && !entry.hours) {
          toast({
            title: "Missing Information",
            description: `Please enter start and end times, or check 'Hele dag vrij' for ${day.date.toLocaleDateString()}`,
            variant: "destructive",
          });
          return;
        }
      } else {
        if (!isWeekend && ((!entry.project && requiresProject) || !entry.workType || !entry.hours)) {
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
      }
      
      // Calculate hours
      let hoursToSave = 0;
      // If full day off is checked, use 8 hours (08:00 to 16:30 minus 0.5 hour break)
      if (isDayOff && entry.fullDayOff) {
        hoursToSave = 8;
      } else if (entry.startTime && entry.endTime) {
        const start = new Date(`2000-01-01T${entry.startTime}`);
        const end = new Date(`2000-01-01T${entry.endTime}`);
        const calculatedHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        hoursToSave = calculatedHours;
      } else if (entry.hours) {
        hoursToSave = Number(entry.hours);
      }
      
      if (hoursToSave <= 0 && !isDayOff) {
        toast({
          title: "Error",
          description: "Please enter valid start and end times",
          variant: "destructive",
        });
        return;
      }
      
      // For day off, ensure we have at least some hours
      if (isDayOff && hoursToSave <= 0) {
        toast({
          title: "Error",
          description: "Please enter valid hours or check 'Hele dag vrij'",
          variant: "destructive",
        });
        return;
      }
      
      // Check if project is a custom project (not in global projects list)
      let projectToSave = isDayOff ? null : entry.project;
      if (projectToSave && !isDayOff && currentUser?.id) {
        // Check if this is a custom project (not in the projects list)
        const isCustomProject = !projects.some(p => p.name === projectToSave);
        if (isCustomProject) {
          try {
            // Try to check if project exists with user_id
            const { data: existingProject, error: checkError } = await supabase
              .from("projects")
              .select("id")
              .eq("name", projectToSave);
            
            let projectExists = false;
            if (checkError && checkError.message.includes("does not exist")) {
              // user_id column doesn't exist, just check by name
              projectExists = existingProject && existingProject.length > 0;
            } else {
              // Try to filter by user_id
              const { data: userProject } = await supabase
                .from("projects")
                .select("id")
                .eq("name", projectToSave)
                .eq("user_id", currentUser.id)
                .single();
              projectExists = !!userProject;
            }
            
            if (!projectExists) {
              // Try to insert with user_id
              const { error: insertError } = await supabase
                .from("projects")
                .insert([{
                  name: projectToSave,
                  user_id: currentUser.id,
                  description: null
                }]);
              
              // If user_id column doesn't exist, insert without it
              if (insertError && insertError.message.includes("does not exist")) {
                await supabase
                  .from("projects")
                  .insert([{
                    name: projectToSave,
                    description: null
                  }]);
              }
              
              // Refresh projects list
              const { data: updatedProjects } = await supabase
                .from("projects")
                .select("id, name");
              setProjects(updatedProjects || []);
            }
          } catch (err) {
            console.warn("Could not save custom project:", err);
          }
        }
      }
      
      // For full day off, set startTime and endTime explicitly
      const insertData: any = {
        project: projectToSave,
        user_id: currentUser?.id || null,
        date: formatDateToYYYYMMDD(day.date),
        hours: hoursToSave,
        description: entry.workType,
        stayed_overnight: !!day.stayedOvernight,
      };
      
      // Only include startTime/endTime if they are provided (not for full day off)
      if (entry.startTime) {
        insertData.startTime = entry.startTime;
      } else {
        insertData.startTime = null;
      }
      
      if (entry.endTime) {
        insertData.endTime = entry.endTime;
      } else {
        insertData.endTime = null;
      }
      
      entriesToSave.push(insertData);
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
          ? { ...d, stayedOvernight: false, entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "", fullDayOff: false }] }
          : d
      ));
      await fetchSubmittedEntries(formatDateToYYYYMMDD(day.date));
      // Check if any saved entries were day off entries and refresh days off
      const hasDayOffEntry = entriesToSave.some(e => e.description === "31");
      if (hasDayOffEntry) {
        await fetchDaysOff();
      }
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


  const handleEditEntry = (entry: any, dateStr: string) => {
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    const isWeekLocked = confirmedWeeks[weekKey];
    
    // Non-admins cannot edit if week is confirmed
    if (isWeekLocked && !currentUser?.isAdmin) {
      toast({
        title: "Not Allowed",
        description: "This week is confirmed and cannot be changed anymore.",
        variant: "destructive",
      });
      return;
    }
    
    const dayIdx = days.findIndex(d => formatDateToYYYYMMDD(d.date) === dateStr);
    if (dayIdx === -1) return;
    
    const day = days[dayIdx];
    
    // Convert submitted entry to editable format
    const editableEntry = {
      workType: entry.description || "",
      project: entry.project || "",
      hours: entry.hours?.toString() || "",
      startTime: entry.startTime || "",
      endTime: entry.endTime || "",
      id: entry.id // Keep the ID to track which entry is being edited
    };
    
    // Check if there are any completely empty entries
    const emptyEntryIndex = day.entries.findIndex(e => 
      !e.workType && !e.project && !e.startTime && !e.endTime && !e.hours && !e.id
    );
    
    setDays(days.map((d, i) => {
      if (i !== dayIdx) return d;
      
      const newEntries = [...d.entries];
      
      if (emptyEntryIndex !== -1) {
        // Replace the first empty entry with the entry being edited
        newEntries[emptyEntryIndex] = editableEntry;
      } else {
        // No empty entry found, add the entry to edit
        newEntries.push(editableEntry);
      }
      
      return { ...d, entries: newEntries };
    }));
    
    // Delete the submitted entry (it will be re-saved when user submits)
    handleDeleteEntry(entry.id, dateStr);
  };

  const handleDeleteEntry = async (entryId: number, dateStr: string) => {
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
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
    
    // Check if this is a day off entry before deleting
    const { data: entry } = await supabase.from('timesheet').select('description').eq('id', entryId).single();
    const isDayOff = entry?.description === "31";
    
    await supabase.from('timesheet').delete().eq('id', entryId);
    await fetchSubmittedEntries(dateStr);
    
    // Refresh days off if a day off entry was deleted
    if (isDayOff) {
      await fetchDaysOff();
    }
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

  // Copy entries from previous day to current day and save them immediately
  const handleCopyFromPreviousDay = async (dayIdx: number) => {
    if (dayIdx === 0) {
      toast({
        title: "Cannot Copy",
        description: "There is no previous day to copy from.",
        variant: "destructive",
      });
      return;
    }
    
    if (!currentUser) return;
    
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    const isWeekLocked = confirmedWeeks[weekKey];
    
    if (isWeekLocked && !currentUser?.isAdmin) {
      toast({
        title: "Not Allowed",
        description: "This week is confirmed and cannot be changed anymore.",
        variant: "destructive",
      });
      return;
    }
    
    const previousDay = days[dayIdx - 1];
    const previousDateStr = formatDateToYYYYMMDD(previousDay.date);
    const previousSubmitted = submittedEntries[previousDateStr] || [];
    const currentDay = days[dayIdx];
    const currentDateStr = formatDateToYYYYMMDD(currentDay.date);
    const isWeekend = currentDay.date.getDay() === 0 || currentDay.date.getDay() === 6;
    
    // Prevent future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entryDate = new Date(currentDay.date);
    entryDate.setHours(0, 0, 0, 0);
    if (entryDate > today) {
      toast({
        title: "Future Date Not Allowed",
        description: "You cannot log hours for future dates. Please select today or a past date.",
        variant: "destructive",
      });
      return;
    }
    
    // Combine previous day's editable entries and submitted entries
    // Include entries that have workType and either:
    // - For work types 30-40: workType + (startTime/endTime or hours) is enough (no project needed)
    // - For other work types: workType + project + (startTime/endTime or hours)
    const previousEntries = [
      ...previousDay.entries.filter(e => {
        if (!e.workType || e.workType.trim() === "") return false;
        const requiresProject = workTypeRequiresProject(e.workType);
        // Check for time data - hours can be 0, so check explicitly for existence
        const hasTimeData = (e.startTime && e.startTime.trim() !== "") || 
                           (e.endTime && e.endTime.trim() !== "") || 
                           (e.hours !== undefined && e.hours !== null && e.hours !== "");
        if (requiresProject) {
          return e.project && e.project.trim() !== "" && hasTimeData;
        } else {
          return hasTimeData; // Work types 30-40 don't need project
        }
      }),
      ...previousSubmitted
        .filter(e => {
          // In regular view, submitted entries use 'description' field
          const workType = e.description || "";
          if (!workType || workType.trim() === "") return false;
          const requiresProject = workTypeRequiresProject(workType);
          // Check for time data - hours can be 0 or a number, so check explicitly
          const hasTimeData = (e.startTime && e.startTime.trim() !== "") || 
                             (e.endTime && e.endTime.trim() !== "") || 
                             (e.hours !== undefined && e.hours !== null && e.hours !== "");
          if (requiresProject) {
            return e.project && e.project.trim() !== "" && hasTimeData;
          } else {
            return hasTimeData; // Work types 30-40 don't need project
          }
        })
        .map(e => ({
          workType: e.description || "", // In regular view, submitted entries use 'description' field
          project: e.project || "",
          hours: e.hours?.toString() || "",
          startTime: e.startTime || "",
          endTime: e.endTime || "",
          fullDayOff: false,
        }))
    ];
    
    if (previousEntries.length === 0) {
      toast({
        title: t('weekly.noEntries'),
        description: t('weekly.noEntriesToCopy'),
        variant: "destructive",
      });
      return;
    }
    
    // First, collect custom projects that need to be created
    const customProjectsToCreate = new Set<string>();
    for (const entry of previousEntries) {
      const isDayOff = entry.workType === "31";
      if (entry.project && !isDayOff && currentUser?.id) {
        const isCustomProject = !projects.some(p => p.name === entry.project);
        if (isCustomProject) {
          customProjectsToCreate.add(entry.project);
        }
      }
    }
    
    // Create all custom projects in batch
    if (customProjectsToCreate.size > 0 && currentUser?.id) {
      for (const projectName of customProjectsToCreate) {
        const { data: existingProject } = await supabase
          .from("projects")
          .select("id")
          .eq("name", projectName)
          .eq("user_id", currentUser.id)
          .single();
        
        if (!existingProject) {
          await supabase
            .from("projects")
            .insert([{
              name: projectName,
              user_id: currentUser.id,
              description: null
            }]);
        }
      }
      
      // Refresh projects list once after creating all custom projects
      const { data: updatedProjects } = await supabase
        .from("projects")
        .select("id, name, user_id")
        .or(`user_id.is.null,user_id.eq.${currentUser.id}`);
      if (updatedProjects) {
        const filteredProjects = updatedProjects.filter(
          p => !p.user_id || p.user_id === currentUser.id
        );
        setProjects(filteredProjects);
      }
    }
    
    // Prepare entries to save
    const entriesToSave = [];
    for (const entry of previousEntries) {
      const isDayOff = entry.workType === "31";
      const requiresProject = workTypeRequiresProject(entry.workType);
      
      // Validate required fields
      // For work types 30-40: only need workType and time data (no project needed)
      // For other work types: need workType, project, and time data
      if (!entry.workType) {
        continue; // Skip entries without workType
      }
      
      // Check project requirement
      if (requiresProject && !entry.project) {
        continue; // Skip entries that require project but don't have one
      }
      
      // Check time data requirement
      const hasTimeData = (entry.startTime && entry.startTime.trim() !== "") || 
                         (entry.endTime && entry.endTime.trim() !== "") || 
                         (entry.hours && entry.hours.trim() !== "");
      if (!hasTimeData) {
        continue; // Skip entries without time data
      }
      
      // Calculate hours
      let hoursToSave = 0;
      // If full day off is checked, use 8 hours
      if (isDayOff && entry.fullDayOff) {
        hoursToSave = 8;
      } else if (entry.startTime && entry.endTime) {
        const start = new Date(`2000-01-01T${entry.startTime}`);
        const end = new Date(`2000-01-01T${entry.endTime}`);
        hoursToSave = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        // If it's a day off (31) and hours are close to 8 (between 7.5 and 8.5), treat as full day off
        if (isDayOff && hoursToSave >= 7.5 && hoursToSave <= 8.5) {
          hoursToSave = 8;
        }
      } else if (entry.hours) {
        hoursToSave = Number(entry.hours);
        // If it's a day off (31) and hours are close to 8 (between 7.5 and 8.5), treat as full day off
        if (isDayOff && hoursToSave >= 7.5 && hoursToSave <= 8.5) {
          hoursToSave = 8;
        }
      }
      
      // For day off (31), hours can be 0, but for other types we need valid hours
      if (hoursToSave <= 0 && !isDayOff) {
        continue; // Skip entries with invalid hours
      }
      
      // For full day off, set startTime and endTime explicitly
      const insertData: any = {
        project: isDayOff ? null : entry.project,
        user_id: currentUser.id,
        date: currentDateStr,
        hours: hoursToSave,
        description: entry.workType,
        stayed_overnight: !!previousDay?.stayedOvernight,
      };
      
      // Only include startTime/endTime if they are provided (not for full day off)
      if (entry.startTime) {
        insertData.startTime = entry.startTime;
      } else {
        insertData.startTime = null;
      }
      
      if (entry.endTime) {
        insertData.endTime = entry.endTime;
      } else {
        insertData.endTime = null;
      }
      
      entriesToSave.push(insertData);
    }
    
    if (entriesToSave.length === 0) {
      toast({
        title: "Error",
        description: "No valid entries to copy.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Save all entries to database
      const { error } = await supabase.from("timesheet").insert(entriesToSave);
      
      if (error) throw error;
      
      // Refresh submitted entries for the current day
      await fetchSubmittedEntries(currentDateStr);

      // Copy "stayed overnight" flag at day level
      setDays(prevDays => prevDays.map((d, i) => (
        i === dayIdx ? { ...d, stayedOvernight: !!previousDay?.stayedOvernight } : d
      )));
      
      // Check if any copied entries were day off entries and refresh days off
      const hasDayOffEntry = entriesToSave.some(e => e.description === "31");
      if (hasDayOffEntry) {
        await fetchDaysOff();
      }
      
      toast({
        title: "Copied",
        description: `Copied ${entriesToSave.length} entries from ${previousDay.date.toLocaleDateString()}.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to copy entries",
        variant: "destructive",
      });
    }
  };

  // Helper to check if all weekdays are filled
  const allWeekdaysFilled = weekDates.slice(0, 5).every((date, idx) => {
    const dateStr = formatDateToYYYYMMDD(date);
    const hasSubmitted = (submittedEntries[dateStr] || []).length > 0;
    const hasNew = days[idx].entries.some(e => e.project || e.workType || e.hours);
    return hasSubmitted || hasNew;
  });

  // Helper functions for Excel export

  // Helper to format date as DD/MM/YY
  const formatDateDDMMYY = (dateStr: string) => {
    // Parse date string directly to avoid timezone conversion issues
    // dateStr is in format "YYYY-MM-DD"
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year.slice(-2)}`;
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

    const fromDate = formatDateToYYYYMMDD(weekDates[0]);
    const toDate = formatDateToYYYYMMDD(weekDates[6]);

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
        title: t('weekly.noData'),
        description: t('weekly.noEntriesForWeek'),
        variant: "destructive",
      });
      return;
    }

    // Filter out admin adjustments (entries without startTime/endTime are admin adjustments)
    // Only export entries that have both startTime and endTime - these are user-created entries
    // This matches the behavior of Weekly Entry and View Hours
    const filteredData = data.filter(e => e.startTime && e.endTime);

    if (filteredData.length === 0) {
      toast({
        title: t('weekly.noData'),
        description: t('weekly.noEntriesForWeek'),
        variant: "destructive",
      });
      return;
    }

    // Get work type label for each entry
    const getWorkTypeLabel = (desc: string) => {
      const workType = workTypes.find(wt => String(wt.value) === String(desc));
      return workType ? workType.label : desc;
    };

    // Load logo image
    let logoBuffer: ArrayBuffer | null = null;
    try {
      const response = await fetch('/bampro-marine-logo.jpg');
      if (response.ok) {
        logoBuffer = await response.arrayBuffer();
      }
    } catch (err) {
      console.warn('Could not load logo:', err);
    }

    // Create ExcelJS workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Week Entries");

    // Add logo to cell G1 (column 7, row 1) if logo is available
    if (logoBuffer) {
      const logoId = workbook.addImage({
        buffer: logoBuffer,
        extension: 'jpeg',
      });
      worksheet.addImage(logoId, {
        tl: { col: 6, row: 0 }, // Column G (0-indexed = 6), Row 1 (0-indexed = 0)
        ext: { width: 200, height: 60 }, // Adjust size as needed
      });
    }

    // Set column widths
    worksheet.getColumn(1).width = 12; // Day
    worksheet.getColumn(2).width = 20; // Work Type
    worksheet.getColumn(3).width = 25; // Project Work Order
    worksheet.getColumn(4).width = 8;  // From
    worksheet.getColumn(5).width = 8;  // To
    worksheet.getColumn(6).width = 15; // Hours Worked
    worksheet.getColumn(7).width = 30; // Space for logo

    // Add header rows
    worksheet.getCell('A1').value = t('weekly.employeeName');
    worksheet.getCell('B1').value = currentUser.name || currentUser.email || '';
    
    worksheet.getCell('A2').value = t('weekly.date');
    worksheet.getCell('B2').value = `${t('weekly.from')}: ${formatDateDDMMYY(fromDate)}`;
    worksheet.getCell('D2').value = `${t('weekly.to')}: ${formatDateDDMMYY(toDate)}`;
    
    worksheet.getCell('A3').value = t('weekly.day');
    
    worksheet.getCell('A4').value = t('weekly.weekNumber');
    worksheet.getCell('B4').value = weekNumber.toString();
    
    worksheet.getCell('A5').value = t('weekly.year');
    worksheet.getCell('B5').value = new Date().getFullYear().toString();

    // Add table headers (row 7)
    const headerRow = worksheet.getRow(7);
    headerRow.values = [t('weekly.day'), t('weekly.workType'), t('weekly.projectWorkOrder'), t('weekly.from'), t('weekly.to'), t('weekly.hoursWorked')];
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E5E5' }
    };

    // Format data rows
    filteredData.forEach((entry, idx) => {
      const date = new Date(entry.date);
      const dayNames = [
        t('weekly.sunday'),
        t('weekly.monday'),
        t('weekly.tuesday'),
        t('weekly.wednesday'),
        t('weekly.thursday'),
        t('weekly.friday'),
        t('weekly.saturday')
      ];
      const dayName = dayNames[date.getDay()];
      
      const row = worksheet.getRow(8 + idx);
      row.values = [
        dayName,
        getWorkTypeLabel(entry.description || ''),
        entry.projects?.name || entry.project || '',
        entry.startTime || '',
        entry.endTime || '',
        formatHoursHHMM(entry.hours || 0),
      ];
    });

    // Calculate total hours
    const totalHours = filteredData.reduce((sum, entry) => sum + (parseFloat(entry.hours) || 0), 0);
    const totalHoursHHMM = formatHoursHHMM(totalHours);
    
    // Add total row
    const totalRowIndex = 8 + filteredData.length;
    const totalRow = worksheet.getRow(totalRowIndex);
      totalRow.getCell(2).value = t('weekly.total');
    totalRow.getCell(2).font = { bold: true };
    totalRow.getCell(6).value = totalHoursHHMM;
    totalRow.getCell(6).font = { bold: true };

    // Generate filename
    const filename = `Week_${weekNumber}_${formatDateDDMMYY(fromDate)}_${formatDateDDMMYY(toDate)}.xlsx`;
    
    // Write to buffer and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: `Week ${weekNumber} entries exported to ${filename}`,
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Overtime Summary Panel - For all users (except admins/administratie) */}
      {currentUser && !currentUser?.isAdmin && currentUser?.userType !== 'administratie' && (
        <>
          <OvertimeSummaryPanel currentUser={currentUser} weekStart={weekStart} />
          <OvernightSummaryPanel currentUser={currentUser} weekStart={weekStart} />
        </>
      )}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
        <div className="w-full">
          <h2 className="text-xl sm:text-2xl font-bold pt-1 sm:pt-0">{t('weekly.title')}</h2>
          <div className="mt-1 text-sm sm:text-base text-gray-700 dark:text-gray-300 font-medium">
            {t('weekly.week')} {weekNumber} ({weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()})
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
            <Button variant="outline" onClick={() => changeWeek(-1)} size="sm" className="text-xs sm:text-sm">
              &lt; {t('weekly.prev')}
            </Button>
            <Button variant="outline" onClick={() => changeWeek(1)} size="sm" className="text-xs sm:text-sm">
              {t('weekly.next')} &gt;
            </Button>
            {/* Week selector - Available for all users */}
            {currentUser && availableWeeks.length > 0 && (
              <Select
                value={formatDateToYYYYMMDD(weekDates[0])}
                onValueChange={(value) => {
                  const selectedWeek = availableWeeks.find(w => w.weekStart === value);
                  if (selectedWeek) {
                    const newStart = new Date(selectedWeek.weekStart);
                    setWeekStart(getWeekDates(newStart)[0]);
                    setDays(getWeekDates(newStart).map(date => ({
                      date,
                      stayedOvernight: false,
                      entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "", fullDayOff: false }],
                      open: false,
                    })));
                  }
                }}
              >
                <SelectTrigger className="w-[200px] sm:w-[250px] md:w-[300px] text-xs sm:text-sm h-8 sm:h-9">
                  <SelectValue placeholder={t('weekly.selectWeek')} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableWeeks.map((week) => (
                    <SelectItem key={week.weekStart} value={week.weekStart}>
                      {week.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" onClick={handleExportWeek} size="sm" className="text-xs sm:text-sm">
              <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              {t('weekly.exportWeek')}
            </Button>
            {setUseSimpleView && (
              <Button 
                variant="outline" 
                onClick={() => {
                  const newValue = !useSimpleView;
                  setUseSimpleView(newValue);
                  localStorage.setItem('bampro_use_simple_weekly_view', String(newValue));
                }}
                size="sm" 
                className="text-xs sm:text-sm"
                title={useSimpleView ? t('weekly.switchToOriginal') : t('weekly.switchToSimple')}
              >
                🔄 {useSimpleView ? t('weekly.original') : t('weekly.simple')}
              </Button>
            )}
          </div>
        </div>
        <Card className={`bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 w-full md:min-w-[260px] ${hasUnreadDaysOffNotification ? 'ring-2 ring-orange-400 ring-offset-2' : ''}`}>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-blue-900 dark:text-blue-100 text-base sm:text-lg flex items-center justify-between">
              <span>{t('weekly.daysOffRemaining')}</span>
              {hasUnreadDaysOffNotification && (
                <div className="flex items-center gap-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-2 py-0.5 rounded-full text-xs font-semibold animate-pulse">
                  <span>⚠️</span>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-blue-700 dark:text-blue-300">
              {daysOffLeft} <span className="text-base sm:text-lg">({hoursLeftRounded} {t('weekly.hours')})</span>
            </div>
            <div className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 mt-2">
              {t('weekly.daysOffLeft', { days: daysOffLeft })}
              {hasUnreadDaysOffNotification && (
                <span className="block mt-1 text-orange-600 dark:text-orange-400 font-semibold">⚠️ {t('weekly.updated')}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-4">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 flex-1">
              {days.map((day, dayIdx) => {
                const dateStr = formatDateToYYYYMMDD(day.date);
                const submittedCount = (submittedEntries[dateStr] || []).length;
                const totalEntries = day.entries.filter(e => e.project || e.workType || e.hours).length + submittedCount;
                return (
                  <div 
                    key={dayIdx} 
                    className={`border rounded-lg p-1.5 sm:p-2 cursor-pointer transition-colors ${day.open ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700' : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'}`} 
                    onClick={() => handleOpenDay(dayIdx)}
                  >
                    <div className="font-semibold text-center text-xs sm:text-sm">{day.date.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                    <div className="font-medium text-center text-[10px] sm:text-xs">{day.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
                    <div className="text-[10px] sm:text-xs text-center text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">{totalEntries} {totalEntries === 1 ? t('weekly.entry') : t('weekly.entries')}</div>
                  </div>
                );
              })}
            </div>
            <div className="sm:ml-4 w-full sm:w-auto">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setViewMode(viewMode === "cards" ? "overview" : "cards")}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                {viewMode === "cards" ? `📊 ${t('weekly.weekOverview')}` : `📋 ${t('weekly.dayView')}`}
              </Button>
            </div>
          </div>
          
          {confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
              ⚠️ {t('weekly.weekConfirmedWarning')}
            </div>
          )}

          {viewMode === "overview" ? (
            // Week Overview - All days in one table
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <table className="min-w-full border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="border p-2 text-left sticky left-0 bg-gray-100 dark:bg-gray-800 z-10 min-w-[120px]">{t('weekly.day')}</th>
                    <th className="border p-2 text-left min-w-[100px]">{t('weekly.workType')}</th>
                    <th className="border p-2 text-left min-w-[150px]">{t('weekly.project')}</th>
                    <th className="border p-2 text-left min-w-[80px]">{t('weekly.van')}</th>
                    <th className="border p-2 text-left min-w-[80px]">{t('weekly.tot')}</th>
                    <th className="border p-2 text-left min-w-[80px]">{t('weekly.hours')}</th>
                    <th className="border p-2 text-center min-w-[50px]">{t('weekly.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day, dayIdx) => {
                    const dateStr = formatDateToYYYYMMDD(day.date);
                    const submitted = (submittedEntries[dateStr] || []).sort((a, b) => {
                      const timeA = a.startTime || "";
                      const timeB = b.startTime || "";
                      return timeA.localeCompare(timeB);
                    });
                    // Week is locked if confirmed = true (regardless of admin status)
                    // Once confirmed, no one can edit (admins can unlock via admin panel if needed)
                    const isLocked = !!confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])];
                    const dayName = day.date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
                    
                    // Ensure at least one empty entry for editing
                    const editableEntries = day.entries.length > 0 
                      ? day.entries 
                      : [{ workType: "", project: "", hours: "", startTime: "", endTime: "" }];
                    
                    // Calculate total rows for this day (editable + submitted)
                    const totalRows = editableEntries.length + submitted.length;
                    const hasRows = totalRows > 0;

                    // Render all rows for this day (editable entries first, then submitted entries)
                    return (
                      <>
                        {editableEntries.map((entry, entryIdx) => {
                          const isFirstRow = entryIdx === 0 && submitted.length === 0;
                          const isFirstEntry = entryIdx === 0;
                          const rowSpan = isFirstEntry && hasRows ? totalRows : 0;
                          
                          return (
                            <tr key={`${dayIdx}-${entryIdx}`} className="border-t hover:bg-gray-50 dark:hover:bg-gray-800">
                              {isFirstEntry && (
                                <td rowSpan={rowSpan || (hasRows ? totalRows : 1)} className="border p-2 sticky left-0 bg-white dark:bg-gray-900 font-medium align-top">
                                  {dayName}
                                  <div className="mt-2 space-y-1">
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="h-6 text-xs w-full"
                                      onClick={() => handleAddEntry(dayIdx)}
                                      disabled={isLocked}
                                    >
                                      + {t('weekly.add')}
                                    </Button>
                                    {dayIdx > 0 && (
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        className="h-6 text-xs w-full"
                                        onClick={() => handleCopyFromPreviousDay(dayIdx)}
                                        disabled={isLocked}
                                      >
                                        {t('weekly.copyPrevious')}
                                      </Button>
                                    )}
                                  </div>
                                  <div className="mt-3 flex items-center space-x-2">
                                    <Checkbox
                                      id={`stayedOvernight-${dayIdx}`}
                                      checked={!!day.stayedOvernight}
                                      onCheckedChange={(checked) => {
                                        persistOvernightStay(dayIdx, checked === true, isLocked);
                                      }}
                                      disabled={isLocked}
                                    />
                                    <Label
                                      htmlFor={`stayedOvernight-${dayIdx}`}
                                      className="text-xs font-medium cursor-pointer"
                                    >
                                      {t('weekly.overnightStay')}
                                    </Label>
                                  </div>
                                </td>
                              )}
                              <td className="border p-1">
                                <Popover
                                  open={openWorkTypePopovers[`${dayIdx}-${entryIdx}`] || false}
                                  onOpenChange={(open) => {
                                    const key = `${dayIdx}-${entryIdx}`;
                                    setOpenWorkTypePopovers(prev => ({ ...prev, [key]: open }));
                                    if (!open) {
                                      setWorkTypeSearchValues(prev => ({ ...prev, [key]: "" }));
                                    }
                                  }}
                                >
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className="w-full justify-between h-8 text-xs"
                                      disabled={isLocked}
                                    >
                                      {entry.workType 
                                        ? `${entry.workType} - ${workTypes.find(t => String(t.value) === entry.workType)?.label || ""}`
                                        : t('weekly.type')}
                                      <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                    <Command>
                                      <CommandInput
                                        placeholder={t('weekly.searchWorkType')}
                                        value={workTypeSearchValues[`${dayIdx}-${entryIdx}`] || ""}
                                        onValueChange={(value) => {
                                          const key = `${dayIdx}-${entryIdx}`;
                                          setWorkTypeSearchValues(prev => ({ ...prev, [key]: value }));
                                        }}
                                      />
                                      <CommandList>
                                        <CommandEmpty>{t('weekly.noWorkTypeFound')}</CommandEmpty>
                                        <CommandGroup>
                                          {workTypes
                                            .filter(type =>
                                              !workTypeSearchValues[`${dayIdx}-${entryIdx}`] ||
                                              String(type.value).includes(workTypeSearchValues[`${dayIdx}-${entryIdx}`]) ||
                                              type.label.toLowerCase().includes(workTypeSearchValues[`${dayIdx}-${entryIdx}`].toLowerCase())
                                            )
                                            .map((type) => (
                                              <CommandItem
                                                key={type.value}
                                                value={String(type.value)}
                                                onSelect={() => {
                                                  handleEntryChange(dayIdx, entryIdx, "workType", String(type.value));
                                                  const key = `${dayIdx}-${entryIdx}`;
                                                  setOpenWorkTypePopovers(prev => ({ ...prev, [key]: false }));
                                                  setWorkTypeSearchValues(prev => ({ ...prev, [key]: "" }));
                                                }}
                                              >
                                                <Check
                                                  className={cn(
                                                    "mr-2 h-4 w-4",
                                                    entry.workType === String(type.value) ? "opacity-100" : "opacity-0"
                                                  )}
                                                />
                                                {type.value} - {type.label}
                                              </CommandItem>
                                            ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                                {/* Full Day Off checkbox for work type 31 */}
                                {entry.workType === "31" && (
                                  <div className="flex items-center space-x-2 mt-1">
                                    <Checkbox
                                      id={`fullDayOff-overview-${dayIdx}-${entryIdx}`}
                                      checked={entry.fullDayOff || false}
                                      onCheckedChange={(checked) => {
                                        handleEntryChange(dayIdx, entryIdx, "fullDayOff", checked === true);
                                      }}
                                      disabled={isLocked}
                                    />
                                    <Label 
                                      htmlFor={`fullDayOff-overview-${dayIdx}-${entryIdx}`}
                                      className="text-xs font-medium cursor-pointer"
                                    >
                                      {t('weekly.fullDayOff') || 'Hele dag vrij (8 uren)'}
                                    </Label>
                                  </div>
                                )}
                              </td>
                              <td className="border p-1">
                                <Select
                                  value={entry.project || ""}
                                  onValueChange={val => handleEntryChange(dayIdx, entryIdx, "project", val)}
                                  disabled={!workTypeRequiresProject(entry.workType) || isLocked}
                                >
                                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('weekly.projectPlaceholder')} /></SelectTrigger>
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
                                  placeholder={t('weekly.startPlaceholder')}
                                  className="h-8 text-xs w-20"
                                  disabled={isLocked}
                                />
                              </td>
                              <td className="border p-1">
                                <Input
                                  type="text"
                                  value={entry.endTime || ""}
                                  onChange={e => handleEntryChange(dayIdx, entryIdx, "endTime", roundToQuarterHour(e.target.value))}
                                  placeholder={t('weekly.endPlaceholder')}
                                  className="h-8 text-xs w-20"
                                  disabled={isLocked}
                                />
                              </td>
                              <td className="border p-1">
                                <div className="h-8 flex items-center justify-center bg-gray-50 dark:bg-gray-800 border rounded px-2 text-xs font-medium">
                                  {(() => {
                                    // If full day off is checked, show 8 hours
                                    if (entry.workType === "31" && entry.fullDayOff) {
                                      return "8h";
                                    }
                                    if (entry.startTime && entry.endTime) {
                                      const start = new Date(`2000-01-01T${entry.startTime}`);
                                      const end = new Date(`2000-01-01T${entry.endTime}`);
                                      const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                                      if (!isNaN(diff) && diff > 0) {
                                        return `${diff.toFixed(2)}h`;
                                      }
                                    }
                                    if (entry.hours) {
                                      const hours = parseFloat(entry.hours);
                                      if (!isNaN(hours) && hours > 0) {
                                        return `${hours.toFixed(2)}h`;
                                      }
                                    }
                                    return "-";
                                  })()}
                                </div>
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
                        })}
                        {/* Show submitted entries right after editable entries for this day */}
                        {submitted.map((submittedEntry, subIdx) => (
                          <tr key={`submitted-${dayIdx}-${subIdx}`} className="border-t bg-gray-50 dark:bg-gray-800/50">
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
                                <div className="flex gap-1 justify-center">
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7"
                                    onClick={() => handleEditEntry(submittedEntry, dateStr)}
                                    title={t('common.edit')}
                                  >
                                    <svg className="h-3 w-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </Button>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7"
                                    onClick={() => handleDeleteEntry(submittedEntry.id, dateStr)}
                                  >
                                    <Trash2 className="h-3 w-3 text-red-500" />
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </>
                    );
                  })}
                </tbody>
              </table>
              {!confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && (
                <div className="mt-4 flex justify-end">
                  <Button 
                    variant="default" 
                    onClick={handleSubmitAll}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {t('weekly.submitAll')}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            // Cards view - original functionality
            <>
          {days.map((day, dayIdx) => day.open && (
            <div key={dayIdx} className="mb-3 sm:mb-4 border rounded-lg p-3 sm:p-4 bg-white dark:bg-gray-800 shadow">
              <div className="font-semibold mb-2 text-sm sm:text-base">{day.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</div>
              <div className="mb-3 flex items-center space-x-2">
                <Checkbox
                  id={`stayedOvernight-cards-${dayIdx}`}
                  checked={!!day.stayedOvernight}
                  onCheckedChange={(checked) => {
                    const isLocked = !!confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])];
                    persistOvernightStay(dayIdx, checked === true, isLocked);
                  }}
                  disabled={confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && !currentUser?.isAdmin}
                />
                <Label
                  htmlFor={`stayedOvernight-cards-${dayIdx}`}
                  className="text-sm font-medium cursor-pointer"
                >
                  {t('weekly.overnightStay')}
                </Label>
              </div>
              {confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
                  ⚠️ {t('weekly.confirmed')}
                </div>
              )}
              {day.entries.map((entry, entryIdx) => (
                <div key={entryIdx} className="flex flex-wrap gap-2 items-end mb-2">
                  <div>
                    <Label>{t('weekly.workType')}</Label>
                    <Popover
                      open={openWorkTypePopovers[`${dayIdx}-${entryIdx}`] || false}
                      onOpenChange={(open) => {
                        const key = `${dayIdx}-${entryIdx}`;
                        setOpenWorkTypePopovers(prev => ({ ...prev, [key]: open }));
                        if (!open) {
                          setWorkTypeSearchValues(prev => ({ ...prev, [key]: " " }));
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between !bg-white dark:!bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                        >
                          {entry.workType 
                            ? `${entry.workType} - ${workTypes.find(t => String(t.value) === entry.workType)?.label || ""}`
                            : t('weekly.type')}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder={t('weekly.searchWorkType')}
                            value={workTypeSearchValues[`${dayIdx}-${entryIdx}`] || ""}
                            onValueChange={(value) => {
                              const key = `${dayIdx}-${entryIdx}`;
                              setWorkTypeSearchValues(prev => ({ ...prev, [key]: value }));
                            }}
                          />
                          <CommandList>
                            <CommandEmpty>{t('weekly.noWorkTypeFound')}</CommandEmpty>
                            <CommandGroup>
                              {workTypes
                                .filter(type =>
                                  !workTypeSearchValues[`${dayIdx}-${entryIdx}`] ||
                                  String(type.value).includes(workTypeSearchValues[`${dayIdx}-${entryIdx}`]) ||
                                  type.label.toLowerCase().includes(workTypeSearchValues[`${dayIdx}-${entryIdx}`].toLowerCase())
                                )
                                .map((type) => (
                                  <CommandItem
                                    key={type.value}
                                    value={String(type.value)}
                                    onSelect={() => {
                                      handleEntryChange(dayIdx, entryIdx, "workType", String(type.value));
                                      const key = `${dayIdx}-${entryIdx}`;
                                      setOpenWorkTypePopovers(prev => ({ ...prev, [key]: false }));
                                      setWorkTypeSearchValues(prev => ({ ...prev, [key]: "" }));
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        entry.workType === String(type.value) ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {type.value} - {type.label}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {/* Full Day Off checkbox for work type 31 */}
                  {entry.workType === "31" && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`fullDayOff-cards-${dayIdx}-${entryIdx}`}
                        checked={entry.fullDayOff || false}
                        onCheckedChange={(checked) => {
                          handleEntryChange(dayIdx, entryIdx, "fullDayOff", checked === true);
                        }}
                        disabled={confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && !currentUser?.isAdmin}
                      />
                      <Label 
                        htmlFor={`fullDayOff-cards-${dayIdx}-${entryIdx}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {t('weekly.fullDayOff') || 'Hele dag vrij (8 uren)'}
                      </Label>
                    </div>
                  )}
                  <div>
                    <Label>{t('weekly.project')}</Label>
                    {entry.project && !projects.some(p => p.name === entry.project) ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          value={entry.project}
                          onChange={e => handleEntryChange(dayIdx, entryIdx, "project", e.target.value)}
                          placeholder={t('weekly.projectPlaceholder')}
                          disabled={confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && !currentUser?.isAdmin}
                        />
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleEntryChange(dayIdx, entryIdx, "project", "")}
                          disabled={!!confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])]}
                        >
                          {t('weekly.clear')}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Select
                          value={entry.project}
                          onValueChange={val => handleEntryChange(dayIdx, entryIdx, "project", val)}
                          disabled={confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && !currentUser?.isAdmin}
                        >
                          <SelectTrigger><SelectValue placeholder={t('weekly.projectPlaceholder')} /></SelectTrigger>
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
                            placeholder={t('weekly.addCustomProject')}
                            disabled={entry.workType === "31" || (confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && !currentUser?.isAdmin)}
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="ml-2"
                            onClick={() => handleAddCustomProject(dayIdx, entryIdx)}
                            disabled={!!confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])]}
                          >
                            {t('weekly.add')}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <Label>{t('weekly.startTime')}</Label>
                    <Input
                      type="text"
                      value={entry.startTime}
                      onChange={e => handleEntryChange(dayIdx, entryIdx, "startTime", roundToQuarterHour(e.target.value))}
                      placeholder={t('weekly.startPlaceholder')}
                      className="w-20"
                      disabled={confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && !currentUser?.isAdmin}
                    />
                  </div>
                  <div>
                    <Label>{t('weekly.endTime')}</Label>
                    <Input
                      type="text"
                      value={entry.endTime}
                      onChange={e => handleEntryChange(dayIdx, entryIdx, "endTime", roundToQuarterHour(e.target.value))}
                      placeholder={t('weekly.endPlaceholder')}
                      className="w-20"
                      disabled={confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && !currentUser?.isAdmin}
                    />
                  </div>
                  <div>
                    <Label>{t('weekly.hours')}</Label>
                    <div className="h-10 flex items-center justify-center bg-gray-50 dark:bg-gray-800 border rounded px-2 text-sm font-medium">
                      {(() => {
                        // If full day off is checked, show 8 hours
                        if (entry.workType === "31" && entry.fullDayOff) {
                          return "8h";
                        }
                        if (entry.startTime && entry.endTime) {
                          const start = new Date(`2000-01-01T${entry.startTime}`);
                          const end = new Date(`2000-01-01T${entry.endTime}`);
                          const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                          if (!isNaN(diff) && diff > 0) {
                            return `${diff.toFixed(2)}h`;
                          }
                        }
                        if (entry.hours) {
                          const hours = parseFloat(entry.hours);
                          if (!isNaN(hours) && hours > 0) {
                            return `${hours.toFixed(2)}h`;
                          }
                        }
                        return "-";
                      })()}
                    </div>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => handleRemoveEntry(dayIdx, entryIdx)}
                    disabled={confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && !currentUser?.isAdmin}
                  >
                    -
                  </Button>
                </div>
              ))}
              <div className="flex gap-4 mt-4">
                {dayIdx > 0 && (
                  <Button 
                    variant="outline" 
                    onClick={() => handleCopyFromPreviousDay(dayIdx)}
                    disabled={confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && !currentUser?.isAdmin}
                  >
                    {t('weekly.copyPrevious')}
                  </Button>
                )}
                <Button 
                  variant="default" 
                  onClick={() => handleSubmitDay(dayIdx)}
                  disabled={confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && !currentUser?.isAdmin}
                >
                  {t('weekly.submitDay')}
                </Button>
              </div>
              {submittedEntries[formatDateToYYYYMMDD(day.date)] && submittedEntries[formatDateToYYYYMMDD(day.date)].length > 0 && (
                <div className="mt-4">
                  <div className="font-semibold text-sm mb-1 text-gray-700 dark:text-gray-200">{t('weekly.submittedEntries')}</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs border border-gray-300 dark:border-gray-700 rounded">
                      <thead className="bg-gray-100 dark:bg-gray-800">
                        <tr>
                          <th className="p-1 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('weekly.project')}</th>
                          <th className="p-1 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('weekly.workType')}</th>
                          <th className="p-1 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('weekly.hours')}</th>
                          {!confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && (
                            <th className="p-1 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('weekly.actions')}</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {(submittedEntries[formatDateToYYYYMMDD(day.date)] || []).sort((a, b) => {
                          const timeA = a.startTime || "";
                          const timeB = b.startTime || "";
                          return timeA.localeCompare(timeB);
                        }).map((entry, idx) => (
                          <tr key={idx} className="border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
                            <td className="p-1 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-200">{entry.project}</td>
                            <td className="p-1 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-200">{entry.description}</td>
                            <td className="p-1 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-200">{entry.startTime && entry.endTime ? `${entry.startTime} - ${entry.endTime}` : '-'}</td>
                            {!confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && (
                              <td className="p-1 border border-gray-300 dark:border-gray-700">
                                <div className="flex gap-1">
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => handleEditEntry(entry, formatDateToYYYYMMDD(day.date))}
                                    title={t('common.edit')}
                                  >
                                    <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => handleDeleteEntry(entry.id, formatDateToYYYYMMDD(day.date))}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
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
      {!confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && (
        <Card className="mt-4 bg-orange-50 border-orange-200 dark:bg-gray-900 border-gray-600">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="text-sm text-orange-800">
                <strong>{t('note')}:</strong> {t('weekly.confirmWeekText')}
              </div>
              <Button 
                className="w-full bg-orange-600 hover:bg-orange-700 text-white" 
                variant="default" 
                onClick={handleConfirmWeek}
              >
                {t('weekly.confirmWeek')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && (
        <Card className="mt-4 bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="text-blue-800 font-semibold">
              ✓ {t('weekly.weekConfirmedText')}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WeeklyCalendarEntry; 