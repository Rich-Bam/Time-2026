import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Trash2, Download, Plus, Check, ChevronsUpDown, Mail, ChevronDown } from 'lucide-react';
import { useIsMobile } from "@/hooks/use-mobile";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { cn } from "@/lib/utils";
import { formatDateToYYYYMMDD } from "@/utils/dateUtils";
import OvertimeSummaryPanel from "@/components/OvertimeSummaryPanel";
import OvernightSummaryPanel from "@/components/OvernightSummaryPanel";
import { BarChart3, Moon } from 'lucide-react';
import ShareEntryButton from "@/components/ShareEntryButton";
import ShareEntryDialog from "@/components/ShareEntryDialog";

// Helper function to get work types with translations
const getWorkTypes = (t: (key: string) => string) => [
  { value: 10, label: t('workType.10') },
  { value: 11, label: t('workType.11') },
  { value: 12, label: t('workType.12') },
  { value: 13, label: t('workType.13') },
  { value: 14, label: t('workType.14') },
  { value: 15, label: t('workType.15') },
  { value: 16, label: t('workType.16') },
  { value: 17, label: t('workType.17') },
  { value: 20, label: t('workType.20') },
  { value: 21, label: t('workType.21') },
  { value: 22, label: t('workType.22') },
  { value: 23, label: t('workType.23') },
  { value: 30, label: t('workType.30') },
  { value: 31, label: t('workType.31') },
  { value: 32, label: t('workType.32') },
  { value: 33, label: t('workType.33') },
  { value: 34, label: t('workType.34') },
  { value: 35, label: t('workType.35') },
  { value: 36, label: t('workType.36') },
  { value: 37, label: t('workType.37') },
  { value: 38, label: t('workType.38') },
  { value: 39, label: t('workType.39') },
  { value: 40, label: t('workType.40') },
  { value: 100, label: t('workType.100') },
];

// Helper function to check if a work type doesn't require a project
const workTypeRequiresProject = (workType: string): boolean => {
  if (!workType) return true; // Empty work type requires project
  const workTypeNum = parseInt(workType, 10);
  // Work types 17, 20, 21, and 30-40 don't require a project
  if (workTypeNum === 17) return false;
  if (workTypeNum === 20 || workTypeNum === 21) return false;
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

interface Entry {
  id?: number;
  workType: string;
  project: string;
  hours: string;
  startTime: string;
  endTime: string;
  isSubmitted?: boolean;
  fullDayOff?: boolean;
  kilometers?: string;
}

interface DayData {
  date: Date;
  stayedOvernight: boolean;
  entries: Entry[];
}

const WeeklyCalendarEntrySimple = ({ currentUser, hasUnreadDaysOffNotification = false, useSimpleView, setUseSimpleView }: { currentUser: any; hasUnreadDaysOffNotification?: boolean; useSimpleView?: boolean; setUseSimpleView?: (value: boolean) => void }) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const getTodayIndexInWeek = (dates: Date[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const idx = dates.findIndex((d) => {
      const dateOnly = new Date(d);
      dateOnly.setHours(0, 0, 0, 0);
      return dateOnly.getTime() === today.getTime();
    });
    return idx !== -1 ? idx : 0;
  };
  
  // Get translated work types
  const workTypes = getWorkTypes(t);
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return getWeekDates(now)[0];
  });
  const [days, setDays] = useState<DayData[]>(() => 
    getWeekDates(new Date()).map(date => ({ 
      date, 
      stayedOvernight: false,
      entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "", fullDayOff: false, kilometers: "" }] 
    }))
  );
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [submittedEntries, setSubmittedEntries] = useState<Record<string, Entry[]>>({});
  const [confirmedWeeks, setConfirmedWeeks] = useState<Record<string, boolean>>({});
  const [emailStatus, setEmailStatus] = useState<Record<string, { email_sent_at: string | null; rejection_email_sent_at: string | null; unlock_email_sent_at: string | null }>>({});
  const [dbDaysOff, setDbDaysOff] = useState(0);
  const [customProjectInputs, setCustomProjectInputs] = useState<Record<string, string>>({});
  const [editingEntry, setEditingEntry] = useState<{ id: number; dateStr: string } | null>(null);
  const [openProjectPopovers, setOpenProjectPopovers] = useState<Record<string, boolean>>({});
  const [projectSearchValues, setProjectSearchValues] = useState<Record<string, string>>({});
  const [openWorkTypePopovers, setOpenWorkTypePopovers] = useState<Record<string, boolean>>({});
  const [workTypeSearchValues, setWorkTypeSearchValues] = useState<Record<string, string>>({});
  const [availableWeeks, setAvailableWeeks] = useState<Array<{ weekStart: string; weekNumber: number; year: number; label: string }>>([]);
  const [weekReviewComment, setWeekReviewComment] = useState<string>("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareType, setShareType] = useState<'day' | 'week'>('day');
  const [shareDate, setShareDate] = useState<Date>(new Date());
  const [shareEntryCount, setShareEntryCount] = useState(0);
  const [showSendEmailDialog, setShowSendEmailDialog] = useState(false);
  
  // State for combined mobile panel
  const [combinedOvertimeData, setCombinedOvertimeData] = useState<any>(null);
  const [combinedOvertimeLoading, setCombinedOvertimeLoading] = useState(false);
  const [combinedOvernightCount, setCombinedOvernightCount] = useState<number>(0);
  const [combinedOvernightLoading, setCombinedOvernightLoading] = useState(false);
  
  // State for mobile UI improvements
  const [activeDayIdx, setActiveDayIdx] = useState(() => getTodayIndexInWeek(getWeekDates(weekStart)));
  const [summaryPanelOpen, setSummaryPanelOpen] = useState(false);
  const [fabDialogOpen, setFabDialogOpen] = useState(false);
  const [quickEntryDayIdx, setQuickEntryDayIdx] = useState(() => getTodayIndexInWeek(getWeekDates(weekStart)));
  
  // Quick entry form state for FAB
  const [quickEntry, setQuickEntry] = useState({
    workType: "",
    project: "",
    startTime: "",
    endTime: "",
  });
  
  // Configurable email addresses - change this after testing
  const ADMINISTRATIE_EMAILS = [
    "administratie@bampro.nl",
    "r.blance@bampro.nl",
    // Add second email address here, e.g.:
    // "second-person@bampro.nl",
  ];
  const ADMINISTRATIE_EMAIL = ADMINISTRATIE_EMAILS[0];
  
  const weekDates = getWeekDates(weekStart);
  const weekNumber = getISOWeekNumber(weekDates[0]);
  const totalDaysOff = 25;
  // Calculate hours left first (more accurate), then convert to days
  const totalHoursAvailable = totalDaysOff * 8;
  const totalHoursTaken = dbDaysOff * 8;
  const hoursLeft = totalHoursAvailable - totalHoursTaken;
  const daysOffLeft = (hoursLeft / 8).toFixed(1);
  const hoursLeftRounded = hoursLeft.toFixed(1);

  // Fetch projects with status for validation - ALWAYS fetch ALL projects (including closed) for validation
  const [projectsWithStatus, setProjectsWithStatus] = useState<{ id: number; name: string; status: string | null }[]>([]);
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        // First, fetch ALL projects with status for validation (including closed ones)
        let allProjectsQuery = supabase.from("projects").select("id, name, user_id, status");
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
        // Still try to get status for validation
        const { data: allData } = await supabase.from("projects").select("id, name, status");
        setProjectsWithStatus((allData || []).map(p => ({ id: p.id, name: p.name, status: p.status || null })));
      }
    };
    fetchProjects();
  }, [currentUser]);

  // Function to add a new project to the database
  const handleAddNewProject = async (projectName: string, dayIdx: number, entryIdx: number) => {
    if (!projectName.trim()) {
      toast({
        title: "Error",
        description: "Project name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    // Check if project already exists
    const existingProject = projects.find(p => p.name.toLowerCase() === projectName.trim().toLowerCase());
    if (existingProject) {
      handleEntryChange(dayIdx, entryIdx, "project", existingProject.name);
      const key = `${dayIdx}-${entryIdx}`;
      setOpenProjectPopovers(prev => ({ ...prev, [key]: false }));
      return;
    }

    try {
      // Add new project to database
      // Only include fields that definitely exist in the schema
      const projectData: any = {
        name: projectName.trim(),
        status: "active",
      };
      
      // Only add user_id if it exists in the schema (optional)
      // Try to insert with user_id first, if it fails, try without
      let newProject;
      let error;
      
      // First attempt: try with user_id
      if (currentUser?.id) {
        const result = await supabase
          .from("projects")
          .insert([{
            ...projectData,
            user_id: currentUser.id,
          }])
          .select("id, name")
          .single();
        
        newProject = result.data;
        error = result.error;
        
        // If error mentions user_id column doesn't exist, try without it
        if (error && error.message?.includes("user_id")) {
          const resultWithoutUserId = await supabase
            .from("projects")
            .insert([projectData])
            .select("id, name")
            .single();
          
          newProject = resultWithoutUserId.data;
          error = resultWithoutUserId.error;
        }
      } else {
        // No user_id, insert without it
        const result = await supabase
          .from("projects")
          .insert([projectData])
          .select("id, name")
          .single();
        
        newProject = result.data;
        error = result.error;
      }

      if (error) throw error;

      // Add to projects list
      setProjects(prev => [...prev, { id: newProject.id, name: newProject.name }]);

      // Set the project in the entry
      handleEntryChange(dayIdx, entryIdx, "project", newProject.name);

      // Close popover
      const key = `${dayIdx}-${entryIdx}`;
      setOpenProjectPopovers(prev => ({ ...prev, [key]: false }));
      setProjectSearchValues(prev => ({ ...prev, [key]: "" }));

      toast({
        title: "Success",
        description: `Project "${newProject.name}" added successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add project",
        variant: "destructive",
      });
    }
  };

  // Fetch days off
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

  // Fetch submitted entries
  const fetchSubmittedEntries = async (dateStr: string) => {
    if (!currentUser) return;
    const { data } = await supabase
      .from("timesheet")
      .select("id, project, hours, description, date, startTime, endTime, stayed_overnight, kilometers")
      .eq("user_id", currentUser.id)
      .eq("date", dateStr);
    if (data) {
      // Day-level overnight flag is primarily sourced from `overnight_stays`.
      // We only OR-in any legacy `timesheet.stayed_overnight` flags here, and never clear the checkbox.
      const hasOvernightFromTimesheet = (data || []).some((e: any) => !!e.stayed_overnight);
      if (hasOvernightFromTimesheet) {
        setDays(prevDays =>
          prevDays.map(d =>
            formatDateToYYYYMMDD(d.date) === dateStr ? { ...d, stayedOvernight: true } : d
          )
        );
      }

      // Filter out admin adjustments (entries without startTime/endTime are admin adjustments)
      // Only show entries that have both startTime and endTime - these are user-created entries
      // Admin adjustments don't have startTime/endTime and should not be shown in weekly entry
      const filteredData = data.filter(e => e.startTime && e.endTime);
      
      setSubmittedEntries(prev => ({ 
        ...prev, 
        [dateStr]: filteredData.map((e: any) => ({
          id: e.id,
          workType: e.description || "",
          project: e.project || "",
          hours: String(e.hours || 0),
          startTime: e.startTime || "",
          endTime: e.endTime || "",
          isSubmitted: true,
          fullDayOff: false,
          kilometers: e.kilometers ? String(e.kilometers) : "",
        }))
      }));
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    weekDates.forEach(d => fetchSubmittedEntries(formatDateToYYYYMMDD(d)));
  }, [currentUser, weekStart]);

  // Fetch confirmed status
  const fetchConfirmedStatus = async () => {
    if (!currentUser) return;
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    const { data, error } = await supabase
      .from('confirmed_weeks')
      .select('confirmed, admin_approved, admin_reviewed, admin_review_comment, email_sent_at, rejection_email_sent_at, unlock_email_sent_at')
      .eq('user_id', currentUser.id)
      .eq('week_start_date', weekKey)
      .single();
    
    // If there's an error or no data, don't update state (keep current state)
    if (error || !data) {
      console.log('fetchConfirmedStatus: No data or error, keeping current state', { error, data });
      return;
    }
    
    // Week is locked if confirmed = true (regardless of admin status)
    // Admins can unlock via admin panel
    const isLocked = !!data.confirmed;
    console.log('fetchConfirmedStatus:', { weekKey, confirmed: data.confirmed, isAdmin: currentUser.isAdmin, admin_approved: data.admin_approved, isLocked });
    
    // Only update if the value changed to prevent unnecessary re-renders
    setConfirmedWeeks(prev => {
      if (prev[weekKey] === isLocked) {
        console.log('fetchConfirmedStatus: State unchanged, skipping update');
        return prev;
      }
      const updated = { ...prev, [weekKey]: isLocked };
      console.log('fetchConfirmedStatus updated state:', updated);
      return updated;
    });

    // Update email status
    setEmailStatus(prev => ({
      ...prev,
      [weekKey]: {
        email_sent_at: data.email_sent_at || null,
        rejection_email_sent_at: data.rejection_email_sent_at || null,
        unlock_email_sent_at: data.unlock_email_sent_at || null,
      }
    }));

    if (data.admin_reviewed && !data.admin_approved) {
      setWeekReviewComment(data.admin_review_comment || "");
    } else {
      setWeekReviewComment("");
    }
  };

  useEffect(() => {
    fetchConfirmedStatus();
  }, [currentUser, weekStart]);

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

  // Fetch combined panel data for mobile
  const fetchCombinedPanelData = async () => {
    if (!currentUser || !weekStart) return;
    
    const from = formatDateToYYYYMMDD(weekDates[0]);
    const to = formatDateToYYYYMMDD(weekDates[6]);

    // Fetch overtime data
    setCombinedOvertimeLoading(true);
    try {
      const { data, error } = await supabase
        .from("timesheet")
        .select("user_id, date, hours, description")
        .eq("user_id", currentUser.id)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true });

      if (error) {
        console.error("Error fetching overtime data:", error);
        setCombinedOvertimeData(null);
        setCombinedOvertimeLoading(false);
      } else {
        // Group entries by date and calculate overtime
        const dateMap: Record<string, { totalHours: number }> = {};
        (data || []).forEach((entry: any) => {
          const date = entry.date;
          if (!dateMap[date]) {
            dateMap[date] = { totalHours: 0 };
          }
          const workType = parseInt(entry.description || "0");
          if ((workType >= 10 && workType <= 29) || workType === 100) {
            const hours = parseFloat(entry.hours || 0);
            dateMap[date].totalHours += hours;
          }
        });

        // Calculate overtime per day with percentage breakdown
        let totalOvertime = 0;
        let totalHours125 = 0;
        let totalHours150 = 0;
        let totalHours200 = 0;

        Object.keys(dateMap).forEach(date => {
          const dayData = dateMap[date];
          const totalHours = dayData.totalHours;
          const dateObj = new Date(date);
          const dayOfWeek = dateObj.getDay();
          const isSaturday = dayOfWeek === 6;
          const isSunday = dayOfWeek === 0;

          let overtime = 0;
          let hours125 = 0;
          let hours150 = 0;
          let hours200 = 0;

          if (isSunday) {
            overtime = totalHours;
            hours200 = totalHours;
          } else if (isSaturday) {
            overtime = totalHours;
            hours150 = totalHours;
          } else {
            const overtimeHours = totalHours > 8 ? totalHours - 8 : 0;
            if (overtimeHours > 0) {
              hours125 = Math.min(overtimeHours, 2);
              if (overtimeHours > 2) {
                hours150 = overtimeHours - 2;
              }
              overtime = overtimeHours;
            }
          }

          totalOvertime += overtime;
          totalHours125 += hours125;
          totalHours150 += hours150;
          totalHours200 += hours200;
        });

        setCombinedOvertimeData({
          totalOvertime: totalOvertime.toFixed(2),
          totalHours125: totalHours125.toFixed(2),
          totalHours150: totalHours150.toFixed(2),
          totalHours200: totalHours200.toFixed(2),
        });
        setCombinedOvertimeLoading(false);
      }
    } catch (error: any) {
      console.error("Error calculating overtime:", error);
      setCombinedOvertimeData(null);
      setCombinedOvertimeLoading(false);
    }

    // Fetch overnight stays count
    setCombinedOvernightLoading(true);
    try {
      const { data, error } = await supabase
        .from("overnight_stays")
        .select("date")
        .eq("user_id", currentUser.id)
        .gte("date", from)
        .lte("date", to);

      if (error) {
        console.warn("Error fetching overnight stays:", error);
        setCombinedOvernightCount(0);
      } else {
        setCombinedOvernightCount((data || []).length);
      }
    } catch (error: any) {
      console.warn("Error fetching overnight stays:", error);
      setCombinedOvernightCount(0);
    } finally {
      setCombinedOvernightLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch combined panel data on mobile
    if (isMobile && currentUser && !currentUser?.isAdmin && currentUser?.userType !== 'administratie') {
      fetchCombinedPanelData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, currentUser, weekStart?.getTime()]);

  // Initialize selected day (mobile) and quick-entry day when week changes
  useEffect(() => {
    if (weekDates.length === 0) return;
    const idx = getTodayIndexInWeek(weekDates);
    setActiveDayIdx(idx);
    setQuickEntryDayIdx(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart?.getTime()]);

  // Helper function to calculate daily summary (used by mobile day navigator)
  const calculateDailySummary = (dayIdx: number) => {
    const day = days[dayIdx];
    const dateStr = formatDateToYYYYMMDD(day.date);
    const submitted = submittedEntries[dateStr] || [];
    
    // Calculate total hours from submitted entries
    let totalHours = 0;
    submitted.forEach((entry: any) => {
      if (entry.hours) {
        totalHours += parseFloat(String(entry.hours || 0));
      } else if (entry.startTime && entry.endTime) {
        const calculated = calculateHours(entry.startTime, entry.endTime);
        totalHours += parseFloat(calculated || "0");
      }
    });
    
    // Calculate hours from editable entries
    day.entries.forEach(entry => {
      if (entry.hours) {
        totalHours += parseFloat(String(entry.hours || 0));
      } else if (entry.startTime && entry.endTime) {
        const calculated = calculateHours(entry.startTime, entry.endTime);
        totalHours += parseFloat(calculated || "0");
      }
    });
    
    const entryCount = submitted.length + day.entries.filter(e => e.workType || e.project || e.hours).length;
    
    return {
      totalHours: totalHours.toFixed(2),
      entryCount,
      hasOvernight: day.stayedOvernight,
    };
  };

  const persistOvernightStay = async (dayIdx: number, checked: boolean) => {
    if (!currentUser?.id) return;
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    if (confirmedWeeks[weekKey]) return;

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

  // Set up real-time subscription to listen for changes to confirmed_weeks
  useEffect(() => {
    if (!currentUser) return;
    
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    
    const channel = supabase
      .channel(`confirmed_weeks_simple_${currentUser.id}_${weekKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'confirmed_weeks',
          filter: `user_id=eq.${currentUser.id} AND week_start_date=eq.${weekKey}`
        },
        (payload) => {
          console.log('Real-time update for confirmed_weeks (Simple view):', payload);
          // Update confirmed status immediately when it changes
          // Week is locked if confirmed = true (regardless of admin status)
          const isLocked = !!(payload.new as any)?.confirmed;
          setConfirmedWeeks(prev => ({ ...prev, [weekKey]: isLocked }));
          
          // Update email status from payload
          const newData = payload.new as any;
          if (newData) {
            setEmailStatus(prev => ({
              ...prev,
              [weekKey]: {
                email_sent_at: newData.email_sent_at || null,
                rejection_email_sent_at: newData.rejection_email_sent_at || null,
                unlock_email_sent_at: newData.unlock_email_sent_at || null,
              }
            }));
          }
          
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

  const changeWeek = (delta: number) => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + delta * 7);
    setWeekStart(getWeekDates(newStart)[0]);
    setDays(getWeekDates(newStart).map(date => ({ 
      date, 
      stayedOvernight: false,
      entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "", fullDayOff: false, kilometers: "" }] 
    })));
  };

  const handleAddEntry = (dayIdx: number) => {
    const weekKeyCheck = formatDateToYYYYMMDD(weekDates[0]);
    if (confirmedWeeks[weekKeyCheck]) {
      return;
    }
    
    // Find the last entry's endTime and project (from either editable entries or submitted entries)
    const day = days[dayIdx];
    const dateStr = formatDateToYYYYMMDD(day.date);
    
    // Get all entries for this day (editable + submitted)
    const allEntries = [
      ...day.entries.filter(e => e.endTime && e.endTime.trim() !== ""),
      ...(submittedEntries[dateStr] || []).filter(e => e.endTime && e.endTime.trim() !== "")
    ];
    
    // Sort by endTime to get the latest one
    const sortedEntries = allEntries.sort((a, b) => {
      const timeA = (a.endTime || "").trim();
      const timeB = (b.endTime || "").trim();
      if (!timeA && !timeB) return 0;
      if (!timeA) return 1;
      if (!timeB) return -1;
      
      // Convert time strings to comparable numbers (HH:MM -> minutes since midnight)
      const parseTime = (timeStr: string): number => {
        const parts = timeStr.split(':');
        if (parts.length !== 2) return 0;
        const hours = parseInt(parts[0], 10) || 0;
        const minutes = parseInt(parts[1], 10) || 0;
        return hours * 60 + minutes;
      };
      
      return parseTime(timeA) - parseTime(timeB);
    });
    
    // Get the endTime and project from the last entry (if any)
    const lastEntry = sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1] : null;
    const lastEndTime = lastEntry?.endTime || "";
    const lastProject = lastEntry?.project || "";
    
    setDays(days.map((day, i) =>
      i === dayIdx 
        ? { ...day, entries: [...day.entries, { workType: "", project: lastProject, hours: "", startTime: lastEndTime, endTime: "", fullDayOff: false, kilometers: "" }] }
        : day
    ));
  };

  const handleRemoveEntry = (dayIdx: number, entryIdx: number) => {
    const weekKeyCheck = formatDateToYYYYMMDD(weekDates[0]);
    if (confirmedWeeks[weekKeyCheck]) {
      return;
    }
    
    setDays(days.map((day, i) =>
      i === dayIdx 
        ? { ...day, entries: day.entries.filter((_, j) => j !== entryIdx) }
        : day
    ));
  };

  const handleEntryChange = (dayIdx: number, entryIdx: number, field: string, value: any) => {
    // Prevent changes if week is locked
    const weekKeyCheck = formatDateToYYYYMMDD(weekDates[0]);
    const isWeekLocked = !!confirmedWeeks[weekKeyCheck];
    if (isWeekLocked) {
      console.log('handleEntryChange blocked - week is locked:', weekKeyCheck);
      toast({
        title: "Week Locked",
        description: "This week is confirmed and cannot be modified.",
        variant: "destructive",
      });
      return; // Prevent changes if week is locked
    }
    
    setDays(prevDays => {
      const updatedDays = prevDays.map((day, i) => {
        if (i !== dayIdx) return day;
        return {
          ...day,
          entries: day.entries.map((entry, j) => {
            if (j !== entryIdx) return entry;
            let updated = { ...entry, [field]: value };
            
            // Clear project when work type is changed to 35 (Break) - breaks don't need a project
            if (field === "workType" && value === "35") {
              updated.project = "";
            }
            
            // Auto-calculate hours from start/end time
            if (field === "startTime" || field === "endTime") {
              const calculatedHours = calculateHours(updated.startTime, updated.endTime);
              updated.hours = calculatedHours;
            }
            
            return updated;
          })
        };
      });
      
      return updatedDays;
    });
  };
  
  // Save a single entry and add a new entry
  const handleSaveEntry = async (dayIdx: number, entryIdx: number) => {
    if (!currentUser) return;
    
    const weekKeyCheck = formatDateToYYYYMMDD(weekDates[0]);
    if (confirmedWeeks[weekKeyCheck]) {
      return;
    }
    
    const day = days[dayIdx];
    if (!day) return;
    
    const entry = day.entries[entryIdx];
    if (!entry) return;
    const dateStr = formatDateToYYYYMMDD(day.date);
    
    // Validate required fields
    const isDayOff = entry.workType === "31";
    const requiresProject = workTypeRequiresProject(entry.workType);
    
    // Validate work type is selected
    if (!entry.workType) {
      toast({
        title: "Error",
        description: "Please select a work type",
        variant: "destructive",
      });
      return;
    }
    
    // For non-day-off entries, validate project and time fields
    if (!isDayOff) {
      if (requiresProject && !entry.project) {
        toast({
          title: "Error",
          description: "Please select a project",
          variant: "destructive",
        });
        return;
      }
      // Validate that project is not closed - check directly from database for most up-to-date status
      if (entry.project && requiresProject) {
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
      if (!entry.startTime || !entry.endTime) {
        toast({
          title: "Error",
          description: "Please enter start and end times",
          variant: "destructive",
        });
        return;
      }
    } else {
      // For day off entries, either fullDayOff must be checked OR time fields must be filled
      if (!entry.fullDayOff && !entry.startTime && !entry.endTime && !entry.hours) {
        toast({
          title: "Error",
          description: "Please enter start and end times, or check 'Hele dag vrij'",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Calculate hours
    let hoursToSave = 0;
    // If full day off is checked, use 8 hours (08:00 to 16:30 minus 0.5 hour break)
    if (isDayOff && entry.fullDayOff) {
      hoursToSave = 8;
    } else if (entry.startTime && entry.endTime) {
      const calculated = calculateHours(entry.startTime, entry.endTime);
      hoursToSave = parseFloat(calculated) || 0;
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
    
    try {
      // Check if this entry is being edited (has an id)
      if (entry.id) {
        // Update existing entry in database
        // For full day off, set startTime and endTime to null explicitly
        const updateData: any = {
          project: (isDayOff || entry.workType === "35" || entry.workType === "20" || entry.workType === "21") ? (entry.project?.trim() || null) : entry.project,
          hours: hoursToSave,
          description: entry.workType,
        };
        
        // Only include startTime/endTime if they are provided (not for full day off)
        if (entry.startTime) {
          updateData.startTime = entry.startTime;
        } else {
          updateData.startTime = null;
        }
        
        if (entry.endTime) {
          updateData.endTime = entry.endTime;
        } else {
          updateData.endTime = null;
        }
        
        // Include kilometers for work types 20 and 21
        if (entry.workType === "20" || entry.workType === "21") {
          updateData.kilometers = entry.kilometers ? parseFloat(entry.kilometers) : null;
        } else {
          updateData.kilometers = null;
        }
        
        const { error } = await supabase
          .from("timesheet")
          .update(updateData)
          .eq("id", entry.id);
        
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Entry updated successfully",
        });
        
        // Remove from editable entries and refresh submitted entries
        setDays(prevDays => prevDays.map((d, i) => {
          if (i !== dayIdx) return d;
          return {
            ...d,
            entries: d.entries.filter((_, j) => j !== entryIdx)
          };
        }));
        
        setEditingEntry(null);
        await fetchSubmittedEntries(dateStr);
        // Refresh days off if this was a day off entry
        if (isDayOff) {
          await fetchDaysOff();
        }
      } else {
        // Create new entry
        // For full day off, set startTime and endTime to null explicitly
        const insertData: any = {
          project: (isDayOff || entry.workType === "35" || entry.workType === "20" || entry.workType === "21") ? (entry.project?.trim() || null) : entry.project,
          user_id: currentUser.id,
          date: dateStr,
          hours: hoursToSave,
          description: entry.workType,
          stayed_overnight: !!days[dayIdx]?.stayedOvernight,
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
        
        // Include kilometers for work types 20 and 21
        if (entry.workType === "20" || entry.workType === "21") {
          insertData.kilometers = entry.kilometers ? parseFloat(entry.kilometers) : null;
        } else {
          insertData.kilometers = null;
        }
        
        const { data: newEntry, error } = await supabase.from("timesheet").insert([insertData]).select("id").single();
        
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Entry saved successfully",
        });
        
        // Remove from editable entries and refresh submitted entries
        setDays(prevDays => prevDays.map((d, i) => {
          if (i !== dayIdx) return d;
          return {
            ...d,
            entries: d.entries.filter((_, j) => j !== entryIdx)
          };
        }));
        
        await fetchSubmittedEntries(dateStr);
        // Refresh days off if this was a day off entry
        if (isDayOff) {
          await fetchDaysOff();
        }
      }
      
      // Add a new empty entry with startTime set to the endTime of the saved entry and project copied
      const nextStartTime = entry.endTime || "";
      const nextProject = entry.project || "";
      setDays(prevDays => prevDays.map((d, i) => {
        if (i !== dayIdx) return d;
        return {
          ...d,
          entries: [...d.entries, { workType: "", project: nextProject, hours: "", startTime: nextStartTime, endTime: "", fullDayOff: false, kilometers: "" }]
        };
      }));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save entry",
        variant: "destructive",
      });
    }
  };
  
  // Handle quick entry from FAB
  const handleQuickEntry = async () => {
    if (!currentUser) return;
    
    const weekKeyCheck = formatDateToYYYYMMDD(weekDates[0]);
    if (confirmedWeeks[weekKeyCheck]) {
      toast({
        title: "Week Locked",
        description: "This week is confirmed and cannot be modified.",
        variant: "destructive",
      });
      return;
    }
    
    const targetDayIdx = quickEntryDayIdx;
    if (targetDayIdx < 0 || targetDayIdx >= weekDates.length) {
      toast({
        title: "Error",
        description: "Selected day is not in the current week",
        variant: "destructive",
      });
      return;
    }
    
    // Validate required fields
    if (!quickEntry.workType) {
      toast({
        title: "Error",
        description: "Please select a work type",
        variant: "destructive",
      });
      return;
    }
    
    const requiresProject = workTypeRequiresProject(quickEntry.workType);
    const isDayOff = quickEntry.workType === "31";
    
    if (!isDayOff) {
      if (requiresProject && !quickEntry.project) {
        toast({
          title: "Error",
          description: "Please select a project",
          variant: "destructive",
        });
        return;
      }
      
      if (!quickEntry.startTime || !quickEntry.endTime) {
        toast({
          title: "Error",
          description: "Please enter start and end times",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Calculate hours
    let hoursToSave = 0;
    if (quickEntry.startTime && quickEntry.endTime) {
      const calculated = calculateHours(quickEntry.startTime, quickEntry.endTime);
      hoursToSave = parseFloat(calculated) || 0;
    }
    
    if (hoursToSave <= 0 && !isDayOff) {
      toast({
        title: "Error",
        description: "Please enter valid start and end times",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const dateStr = formatDateToYYYYMMDD(weekDates[targetDayIdx]);
      
      const insertData: any = {
        project: (isDayOff || quickEntry.workType === "35" || quickEntry.workType === "20" || quickEntry.workType === "21") ? (quickEntry.project?.trim() || null) : quickEntry.project,
        user_id: currentUser.id,
        date: dateStr,
        hours: hoursToSave || 0,
        description: quickEntry.workType,
        stayed_overnight: !!days[targetDayIdx]?.stayedOvernight,
      };
      
      if (quickEntry.startTime) insertData.startTime = quickEntry.startTime;
      if (quickEntry.endTime) insertData.endTime = quickEntry.endTime;
      
      const { error } = await supabase.from("timesheet").insert([insertData]).select("id").single();
      
      if (error) throw error;
      
      // Refresh submitted entries for today
      await fetchSubmittedEntries(dateStr);
      
      // After saving on mobile, jump to that day
      if (isMobile) {
        setActiveDayIdx(targetDayIdx);
      }
      
      // Refresh days off if day off entry
      if (isDayOff) {
        await fetchDaysOff();
      }
      
      // Refresh combined panel data if mobile
      if (isMobile) {
        await fetchCombinedPanelData();
      }
      
      // Close dialog and reset form
      setFabDialogOpen(false);
      setQuickEntry({
        workType: "",
        project: "",
        startTime: "",
        endTime: "",
      });
      
      toast({
        title: "Success",
        description: "Entry added successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add entry",
        variant: "destructive",
      });
    }
  };

  // Edit an existing entry
  const handleEditEntry = (entry: Entry, dateStr: string) => {
    const weekKeyCheck = formatDateToYYYYMMDD(weekDates[0]);
    if (confirmedWeeks[weekKeyCheck]) {
      return;
    }
    
    const dayIdx = days.findIndex(d => formatDateToYYYYMMDD(d.date) === dateStr);
    if (dayIdx === -1) return;
    
    const day = days[dayIdx];
    // Check if this entry is already in the editable entries
    const existingEntryIndex = day.entries.findIndex(e => e.id === entry.id);
    
    if (existingEntryIndex !== -1) {
      // Entry is already being edited, just update the editingEntry state
      setEditingEntry({ id: entry.id!, dateStr });
      return;
    }
    
    // Check if there are any completely empty entries (no data at all)
    const emptyEntryIndex = day.entries.findIndex(e => 
      !e.workType && !e.project && !e.startTime && !e.endTime && !e.id
    );
    
    setDays(days.map((d, i) => {
      if (i !== dayIdx) return d;
      
      const newEntries = [...d.entries];
      
      if (emptyEntryIndex !== -1) {
        // Replace the first empty entry with the entry being edited
        newEntries[emptyEntryIndex] = { ...entry, id: entry.id };
      } else {
        // No empty entry found, add the entry to edit (without adding a new empty one)
        newEntries.push({ ...entry, id: entry.id });
      }
      
      return { ...d, entries: newEntries };
    }));
    
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

  // Calculate total hours for a day
  const calculateDayTotal = (dayIdx: number, dateStr: string): number => {
    let total = 0;
    
    // Add hours from editable entries
    const day = days[dayIdx];
    if (day && day.entries) {
      day.entries.forEach(entry => {
        // Skip breaks (work type 35) - they should not count toward total hours
        if (entry.workType === "35") {
          return;
        }
        
        let hours = 0;
        
        // If full day off is checked, add 8 hours
        if (entry.workType === "31" && entry.fullDayOff) {
          hours = 8;
        } else if (entry.startTime && entry.endTime) {
          // Calculate from start/end time
          const calculated = calculateHours(entry.startTime, entry.endTime);
          hours = parseFloat(calculated) || 0;
        } else if (entry.hours) {
          // Use direct hours value
          hours = parseFloat(entry.hours) || 0;
        }
        
        total += hours;
      });
    }
    
    // Add hours from submitted entries (excluding those currently being edited to avoid double-counting)
    const submitted = submittedEntries[dateStr] || [];
    // Get IDs of entries currently being edited
    const editableEntryIds = new Set(
      (day?.entries || [])
        .filter(e => e.id)
        .map(e => e.id!)
    );
    // Filter submitted entries to exclude those being edited
    const submittedForTotal = submitted.filter(
      se => !se.id || !editableEntryIds.has(se.id)
    );
    
    submittedForTotal.forEach(submittedEntry => {
      // Skip breaks (work type 35) - they should not count toward total hours
      if (submittedEntry.workType === "35") {
        return;
      }
      
      const hours = parseFloat(submittedEntry.hours || "0") || 0;
      total += hours;
    });
    
    return total;
  };

  // Calculate total kilometers for a day (only for work types 20 and 21)
  const calculateDayKilometersTotal = (dayIdx: number, dateStr: string): number => {
    let total = 0;
    
    // Sum from editable entries (workType 20 or 21)
    const day = days[dayIdx];
    if (day && day.entries) {
      day.entries.forEach(entry => {
        if ((entry.workType === "20" || entry.workType === "21") && entry.kilometers) {
          total += parseFloat(entry.kilometers) || 0;
        }
      });
    }
    
    // Sum from submitted entries (workType 20 or 21), excluding those currently being edited to avoid double-counting
    const submitted = submittedEntries[dateStr] || [];
    // Get IDs of entries currently being edited
    const editableEntryIds = new Set(
      (day?.entries || [])
        .filter(e => e.id)
        .map(e => e.id!)
    );
    // Filter submitted entries to exclude those being edited
    const submittedForTotal = submitted.filter(
      se => !se.id || !editableEntryIds.has(se.id)
    );
    
    submittedForTotal.forEach(submittedEntry => {
      if ((submittedEntry.workType === "20" || submittedEntry.workType === "21") && submittedEntry.kilometers) {
        total += parseFloat(submittedEntry.kilometers) || 0;
      }
    });
    
    return total;
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
          // workType is already mapped from description in fetchSubmittedEntries
          const workType = e.workType || "";
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
          workType: e.workType || "", // workType is already mapped from description in fetchSubmittedEntries
          project: e.project || "",
          hours: e.hours?.toString() || "",
          startTime: e.startTime || "",
          endTime: e.endTime || "",
          fullDayOff: false,
          kilometers: e.kilometers || "",
        }))
    ];
    
    if (previousEntries.length === 0) {
      toast({
        title: "No Entries",
        description: "The previous day has no entries to copy.",
        variant: "destructive",
      });
      return;
    }
    
    // Check for future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entryDate = new Date(currentDay.date);
    entryDate.setHours(0, 0, 0, 0);
    
    if (entryDate > today) {
      toast({
        title: "Error",
        description: "Cannot save entries for future dates",
        variant: "destructive",
      });
      return;
    }
    
    // Prepare entries to save
    const entriesToSave = [];
    for (const entry of previousEntries) {
      const isDayOff = entry.workType === "31";
      const requiresProject = workTypeRequiresProject(entry.workType);
      
      // Validate required fields
      // For work types 30-40: only need workType and time data (no project needed)
      // For other work types: need workType, project, and time data
      if (!entry.workType || 
          (requiresProject && !entry.project) ||
          (!entry.startTime && !entry.endTime && !entry.hours)) {
        continue; // Skip invalid entries
      }
      
      // Calculate hours
      let hoursToSave = 0;
      // If full day off is checked, use 8 hours
      if (isDayOff && entry.fullDayOff) {
        hoursToSave = 8;
      } else if (entry.startTime && entry.endTime) {
        const calculated = calculateHours(entry.startTime, entry.endTime);
        hoursToSave = parseFloat(calculated) || 0;
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
      
      entriesToSave.push({
        project: (isDayOff || entry.workType === "35" || entry.workType === "20" || entry.workType === "21") ? (entry.project?.trim() || null) : entry.project,
        user_id: currentUser.id,
        date: currentDateStr,
        hours: hoursToSave,
        description: entry.workType,
        startTime: entry.startTime || null,
        endTime: entry.endTime || null,
        stayed_overnight: !!currentDay?.stayedOvernight,
        kilometers: (entry.workType === "20" || entry.workType === "21") && entry.kilometers ? parseFloat(entry.kilometers) : null,
      });
    }
    
    if (entriesToSave.length === 0) {
      toast({
        title: t('common.error'),
        description: t('weekly.noValidEntriesToCopy'),
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

  const getDayEntryCount = (dayIdx: number): number => {
    const day = days[dayIdx];
    const dateStr = formatDateToYYYYMMDD(day.date);
    const submittedCount = (submittedEntries[dateStr] || []).length;
    const editableCount = day.entries.filter(e => e.project || e.workType || e.hours || e.startTime || e.endTime).length;
    return submittedCount + editableCount;
  };

  const getWeekEntryCount = (): number => {
    let total = 0;
    days.forEach((day, dayIdx) => {
      total += getDayEntryCount(dayIdx);
    });
    return total;
  };

  const handleShareDay = (dayIdx: number) => {
    const day = days[dayIdx];
    const entryCount = getDayEntryCount(dayIdx);
    if (entryCount === 0) {
      toast({
        title: t('share.noEntries'),
        description: t('share.noEntriesDescription'),
        variant: 'destructive',
      });
      return;
    }
    setShareType('day');
    setShareDate(day.date);
    setShareEntryCount(entryCount);
    setShareDialogOpen(true);
  };

  const handleShareWeek = () => {
    const entryCount = getWeekEntryCount();
    if (entryCount === 0) {
      toast({
        title: t('share.noEntries'),
        description: t('share.noEntriesDescription'),
        variant: 'destructive',
      });
      return;
    }
    setShareType('week');
    setShareDate(weekDates[0]);
    setShareEntryCount(entryCount);
    setShareDialogOpen(true);
  };

  const getDayEntryCounts = (): Record<string, number> => {
    const counts: Record<string, number> = {};
    days.forEach((day, dayIdx) => {
      const dateStr = formatDateToYYYYMMDD(day.date);
      counts[dateStr] = getDayEntryCount(dayIdx);
    });
    return counts;
  };

  const handleShareSuccess = () => {
    // Refresh submitted entries to show updated state
    weekDates.forEach(d => fetchSubmittedEntries(formatDateToYYYYMMDD(d)));
  };

  const handleSubmitAll = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
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
        
        if (isWeekend && (!entry.project && !isDayOff) && !entry.workType && !entry.startTime && !entry.endTime && !entry.hours) {
          continue;
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
        
        // Calculate hours from start/end time if available, otherwise use entered hours
        let hoursToSave = 0;
        // If full day off is checked, use 8 hours
        if (isDayOff && entry.fullDayOff) {
          hoursToSave = 8;
        } else if (entry.startTime && entry.endTime) {
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
          project: (isDayOff || entry.workType === "35" || entry.workType === "20" || entry.workType === "21") ? (entry.project?.trim() || null) : entry.project,
          user_id: currentUser?.id || null,
          date: formatDateToYYYYMMDD(day.date),
          hours: hoursToSave,
          description: entry.workType,
          startTime: entry.startTime || null,
          endTime: entry.endTime || null,
          stayed_overnight: !!day.stayedOvernight,
          kilometers: (entry.workType === "20" || entry.workType === "21") && entry.kilometers ? parseFloat(entry.kilometers) : null,
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
      weekDates.forEach(d => fetchSubmittedEntries(formatDateToYYYYMMDD(d)));
      // Check if any saved entries were day off entries and refresh days off
      const hasDayOffEntry = entriesToSave.some(e => e.description === "31");
      if (hasDayOffEntry) {
        await fetchDaysOff();
      }
      // Reset entries
      setDays(getWeekDates(weekStart).map(date => ({ 
        date, 
        stayedOvernight: false,
        entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "", fullDayOff: false, kilometers: "" }] 
      })));
    }
  };

  const handleDeleteEntry = async (entryId: number, dateStr: string) => {
    const weekKeyCheck = formatDateToYYYYMMDD(weekDates[0]);
    if (confirmedWeeks[weekKeyCheck]) {
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

  const getWorkTypeLabel = (desc: string) => {
    const workType = workTypes.find(wt => String(wt.value) === String(desc));
    return workType ? `${workType.value} - ${workType.label}` : desc;
  };

  // Helper functions for Excel export

  const formatDateDDMMYY = (dateStr: string) => {
    // Parse date string directly to avoid timezone conversion issues
    // dateStr is in format "YYYY-MM-DD"
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year.slice(-2)}`;
  };

  const getDayNameNL = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
    return days[date.getDay()];
  };

  const formatHoursHHMM = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Export week entries to Excel with per-day sheets
  const handleExportWeek = async () => {
    // You can change the export font size here
    const EXPORT_FONT_SIZE = 14;
    const EXPORT_FONT_NAME = 'Calibri';

    const applyDefaultFont = (ws: any, maxRow: number) => {
      for (let r = 1; r <= maxRow; r++) {
        const row = ws.getRow(r);
        row.eachCell({ includeEmpty: true }, (cell: any) => {
          cell.font = { ...(cell.font || {}), name: EXPORT_FONT_NAME, size: EXPORT_FONT_SIZE };
        });
      }
    };

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

    const [{ data, error }, { data: overnightRows, error: overnightError }] = await Promise.all([
      supabase
        .from("timesheet")
        .select("*, projects(name)")
        .eq("user_id", currentUser.id)
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("date", { ascending: true })
        .order("startTime", { ascending: true }),
      supabase
        .from("overnight_stays")
        .select("date")
        .eq("user_id", currentUser.id)
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("date", { ascending: true }),
    ]);

    if (error) {
      toast({
        title: t('weekly.exportFailed'),
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (overnightError) {
      toast({
        title: t('weekly.exportFailed'),
        description: overnightError.message,
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

    // Group entries by day
    const entriesByDay: Record<string, any[]> = {};
    weekDates.forEach(date => {
      const dateStr = formatDateToYYYYMMDD(date);
      entriesByDay[dateStr] = filteredData.filter(entry => entry.date === dateStr);
    });

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
    
    const dayNamesEN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const overnightSet = new Set((overnightRows || []).map((r: any) => String(r.date)));

    // Add week summary sheet (overtime + overnight) so it's visible immediately on open
    const summarySheet = workbook.addWorksheet("Summary");
    summarySheet.getColumn(1).width = 25;
    summarySheet.getColumn(2).width = 80;

    summarySheet.getCell('A1').value = t('weekly.employeeName');
    summarySheet.getCell('B1').value = currentUser.name || currentUser.email || '';
    summarySheet.getCell('A2').value = t('weekly.date');
    summarySheet.getCell('B2').value = `${t('weekly.from')}: ${formatDateDDMMYY(fromDate)}  ${t('weekly.to')}: ${formatDateDDMMYY(toDate)}`;
    summarySheet.getCell('A3').value = t('weekly.weekNumber');
    summarySheet.getCell('B3').value = weekNumber.toString();
    summarySheet.getCell('A4').value = t('weekly.year');
    summarySheet.getCell('B4').value = new Date(fromDate).getFullYear().toString();

    // Weekly overtime totals (same rules as overtime panel)
    const dateHoursMap: Record<string, number> = {};
    filteredData.forEach((entry: any) => {
      const workType = parseInt(entry.description || "0");
      if ((workType >= 10 && workType <= 29) || workType === 100) {
        const h = parseFloat(entry.hours) || 0;
        dateHoursMap[String(entry.date)] = (dateHoursMap[String(entry.date)] || 0) + h;
      }
    });
    let totalOvertime = 0;
    let total125 = 0;
    let total150 = 0;
    let total200 = 0;
    Object.keys(dateHoursMap).forEach(dateStr => {
      const totalHoursForDay = dateHoursMap[dateStr] || 0;
      const dow = new Date(dateStr).getDay();
      const isSat = dow === 6;
      const isSun = dow === 0;
      if (isSun) { totalOvertime += totalHoursForDay; total200 += totalHoursForDay; return; }
      if (isSat) { totalOvertime += totalHoursForDay; total150 += totalHoursForDay; return; }
      const overtimeHours = totalHoursForDay > 8 ? totalHoursForDay - 8 : 0;
      if (overtimeHours > 0) {
        totalOvertime += overtimeHours;
        total125 += Math.min(overtimeHours, 2);
        if (overtimeHours > 2) total150 += overtimeHours - 2;
      }
    });

    const overnightDates = (overnightRows || []).map((r: any) => formatDateDDMMYY(String(r.date)));
    
    // Calculate weekly total kilometers (work types 20 and 21 only)
    const weeklyTotalKilometers = filteredData.reduce((sum, entry) => {
      const workType = parseInt(entry.description || "0");
      if ((workType === 20 || workType === 21) && entry.kilometers) {
        return sum + (parseFloat(String(entry.kilometers)) || 0);
      }
      return sum;
    }, 0);
    
    // Make summary easy to read (separate cells)
    summarySheet.getCell('A6').value = t('export.overtimeSummary');
    summarySheet.getCell('A6').font = { bold: true };
    summarySheet.mergeCells('A6:H6');

    summarySheet.getCell('A7').value = t('export.overtimeTotal');
    summarySheet.getCell('A7').font = { bold: true };
    summarySheet.getCell('B7').value = totalOvertime;
    summarySheet.getCell('B7').numFmt = '0.00';
    summarySheet.getCell('C7').value = '125%';
    summarySheet.getCell('C7').font = { bold: true };
    summarySheet.getCell('D7').value = total125;
    summarySheet.getCell('D7').numFmt = '0.00';
    summarySheet.getCell('E7').value = '150%';
    summarySheet.getCell('E7').font = { bold: true };
    summarySheet.getCell('F7').value = total150;
    summarySheet.getCell('F7').numFmt = '0.00';
    summarySheet.getCell('G7').value = '200%';
    summarySheet.getCell('G7').font = { bold: true };
    summarySheet.getCell('H7').value = total200;
    summarySheet.getCell('H7').numFmt = '0.00';

    summarySheet.getCell('A9').value = t('export.overnightStays');
    summarySheet.getCell('A9').font = { bold: true };
    summarySheet.getCell('B9').value = overnightDates.length;
    summarySheet.getCell('C9').value = t('export.overnightDates');
    summarySheet.getCell('C9').font = { bold: true };
    summarySheet.getCell('D9').value = overnightDates.join(', ');
    summarySheet.mergeCells('D9:H9');

    summarySheet.getCell('A11').value = t('weekly.kilometers') || 'Kilometers';
    summarySheet.getCell('A11').font = { bold: true };
    summarySheet.getCell('B11').value = weeklyTotalKilometers > 0 ? weeklyTotalKilometers : '';
    summarySheet.getCell('B11').font = { bold: true };
    if (weeklyTotalKilometers > 0) {
      summarySheet.getCell('B11').numFmt = '0.0';
    }

    // Light styling band
    ['A7','B7','C7','D7','E7','F7','G7','H7','A9','B9','C9','D9','A11','B11'].forEach(addr => {
      const cell = summarySheet.getCell(addr);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
    });

    applyDefaultFont(summarySheet, 12);
    
    // Set print settings for Summary sheet
    summarySheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1
    };
    
    // Create sheets for each day
    weekDates.forEach((date, dayIdx) => {
      const dateStr = formatDateToYYYYMMDD(date);
      const dayEntries = entriesByDay[dateStr] || [];
      const locale = language === 'nl' ? 'nl-NL' : 'en-GB';
      const dayName = dayNamesEN[dayIdx]; // sheet name (stable)
      const dayNameDisplay = date.toLocaleDateString(locale, { weekday: 'long' });
      const formattedDate = formatDateDDMMYY(dateStr);
      
      // Calculate total hours for the day (excluding breaks - work type 35)
      const totalHours = dayEntries.reduce((sum, entry) => {
        // Skip breaks (work type 35) - they should not count toward total hours
        if (entry.description === "35") {
          return sum;
        }
        return sum + (parseFloat(entry.hours) || 0);
      }, 0);
      const totalHoursHHMM = formatHoursHHMM(totalHours);
      
      // Create worksheet
      const worksheet = workbook.addWorksheet(dayName);

      // Add logo to cell H1 (column 8, row 1) if logo is available
      if (logoBuffer) {
        const logoId = workbook.addImage({
          buffer: logoBuffer,
          extension: 'jpeg',
        });
        worksheet.addImage(logoId, {
          tl: { col: 7, row: 0 }, // Column H (0-indexed = 7), Row 1 (0-indexed = 0)
          ext: { width: 200, height: 60 }, // Adjust size as needed
        });
      }
      
      // Set column widths
      worksheet.getColumn(1).width = 20; // Day
      worksheet.getColumn(2).width = 20; // Work Type
      worksheet.getColumn(3).width = 30; // Project Work Order
      worksheet.getColumn(4).width = 8;  // From
      worksheet.getColumn(5).width = 8;  // To
      worksheet.getColumn(6).width = 18; // Hours Worked
      worksheet.getColumn(7).width = 12; // Kilometers
      worksheet.getColumn(8).width = 30; // Space for logo

      // Add header rows
      worksheet.getCell('A1').value = t('weekly.employeeName');
      worksheet.getCell('B1').value = currentUser.name || currentUser.email || '';
      
      worksheet.getCell('A2').value = t('weekly.date');
      worksheet.getCell('B2').value = `${t('weekly.from')}: ${formatDateDDMMYY(fromDate)}`;
      worksheet.getCell('D2').value = `${t('weekly.to')}: ${formatDateDDMMYY(toDate)}`;
      
      worksheet.getCell('A3').value = t('weekly.day');
      worksheet.getCell('B3').value = `${formattedDate} ${dayNameDisplay}`;
      
      worksheet.getCell('A4').value = t('weekly.weekNumber');
      worksheet.getCell('B4').value = weekNumber.toString();
      
      worksheet.getCell('A5').value = t('weekly.year');
      worksheet.getCell('B5').value = new Date(fromDate).getFullYear().toString();

      // Overtime + overnight for this day (same rules as overtime panel)
      let dayOvertime = 0;
      let day125 = 0;
      let day150 = 0;
      let day200 = 0;
      const dow = date.getDay();
      const isSaturday = dow === 6;
      const isSunday = dow === 0;
      if (isSunday) {
        dayOvertime = totalHours;
        day200 = totalHours;
      } else if (isSaturday) {
        dayOvertime = totalHours;
        day150 = totalHours;
      } else {
        const overtimeHours = totalHours > 8 ? totalHours - 8 : 0;
        if (overtimeHours > 0) {
          dayOvertime = overtimeHours;
          day125 = Math.min(overtimeHours, 2);
          if (overtimeHours > 2) day150 = overtimeHours - 2;
        }
      }
      // Clear, per-day summary (separate cells)
      worksheet.getCell('A6').value = t('export.overtimeSummary');
      worksheet.getCell('A6').font = { bold: true };
      worksheet.mergeCells('A6:H6');

      worksheet.getCell('A7').value = t('export.overtimeTotal');
      worksheet.getCell('A7').font = { bold: true };
      worksheet.getCell('B7').value = dayOvertime;
      worksheet.getCell('B7').numFmt = '0.00';
      worksheet.getCell('C7').value = '125%';
      worksheet.getCell('C7').font = { bold: true };
      worksheet.getCell('D7').value = day125;
      worksheet.getCell('D7').numFmt = '0.00';
      worksheet.getCell('E7').value = '150%';
      worksheet.getCell('E7').font = { bold: true };
      worksheet.getCell('F7').value = day150;
      worksheet.getCell('F7').numFmt = '0.00';
      worksheet.getCell('G7').value = '200%';
      worksheet.getCell('G7').font = { bold: true };
      worksheet.getCell('H7').value = day200;
      worksheet.getCell('H7').numFmt = '0.00';

      worksheet.getCell('A8').value = t('export.overnightStays');
      worksheet.getCell('A8').font = { bold: true };
      worksheet.getCell('B8').value = overnightSet.has(dateStr) ? t('admin.yes') : t('admin.no');

      ['A7','B7','C7','D7','E7','F7','G7','H7','A8','B8'].forEach(addr => {
        const cell = worksheet.getCell(addr);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
      });

      // Add table headers (row 7)
      const headerRow = worksheet.getRow(9);
      headerRow.values = [t('weekly.day'), t('weekly.workType'), t('weekly.projectWorkOrder'), t('weekly.from'), t('weekly.to'), t('weekly.hoursWorked'), t('weekly.kilometers')];
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E5E5' }
      };

      // Add data rows
      dayEntries.forEach((entry, idx) => {
        const workType = parseInt(entry.description || "0");
        const row = worksheet.getRow(10 + idx);
        row.values = [
          dayNameDisplay,
          getWorkTypeLabel(entry.description || ''),
          entry.projects?.name || entry.project || '',
          entry.startTime || '',
          entry.endTime || '',
          formatHoursHHMM(parseFloat(entry.hours) || 0),
          (workType === 20 || workType === 21) ? (entry.kilometers ? String(entry.kilometers) : '') : '',
        ];
      });

      // Calculate total kilometers for the day (work types 20 and 21 only)
      const totalKilometers = dayEntries.reduce((sum, entry) => {
        const workType = parseInt(entry.description || "0");
        if ((workType === 20 || workType === 21) && entry.kilometers) {
          return sum + (parseFloat(String(entry.kilometers)) || 0);
        }
        return sum;
      }, 0);

      // Add total row
      const totalRowIndex = 10 + dayEntries.length;
      const totalRow = worksheet.getRow(totalRowIndex);
      totalRow.getCell(2).value = t('daily.total');
      totalRow.getCell(2).font = { bold: true };
      totalRow.getCell(6).value = totalHoursHHMM;
      totalRow.getCell(6).font = { bold: true };
      totalRow.getCell(7).value = totalKilometers > 0 ? totalKilometers : '';
      totalRow.getCell(7).font = { bold: true };
      if (totalKilometers > 0) {
        totalRow.getCell(7).numFmt = '0.0';
      }

      // Make each sheet easier to read
      applyDefaultFont(worksheet, totalRowIndex);
      
      // Set print settings for day sheet
      worksheet.pageSetup = {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1
      };
    });

    // Generate filename with user name and week number
    const userName = (currentUser.name || currentUser.email || t('common.user')).replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${userName}_Week${weekNumber}_${new Date(fromDate).getFullYear()}.xlsx`;
    
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
      title: t('weekly.exportSuccessful'),
      description: t('weekly.exportSuccessfulDescription', { weekNumber, filename, dayCount: weekDates.length }),
    });
  };

  // Send week to email - reuses exact same Excel generation logic as handleExportWeek
  // Returns true if successful, false otherwise
  const handleSendWeekToEmail = async (updateEmailStatus: boolean = true): Promise<boolean> => {
    // You can change the export font size here
    const EXPORT_FONT_SIZE = 14;
    const EXPORT_FONT_NAME = 'Calibri';

    const applyDefaultFont = (ws: any, maxRow: number) => {
      for (let r = 1; r <= maxRow; r++) {
        const row = ws.getRow(r);
        row.eachCell({ includeEmpty: true }, (cell: any) => {
          cell.font = { ...(cell.font || {}), name: EXPORT_FONT_NAME, size: EXPORT_FONT_SIZE };
        });
      }
    };

    if (!currentUser) {
      toast({
        title: "Error",
        description: "User not found",
        variant: "destructive",
      });
      return false;
    }

    // Check if email is configured
    if (!ADMINISTRATIE_EMAIL || !ADMINISTRATIE_EMAIL.includes('@')) {
      toast({
        title: "Error",
        description: "Email address not configured. Please contact administrator.",
        variant: "destructive",
      });
      return false;
    }

    setSendingEmail(true);

    try {
      const fromDate = formatDateToYYYYMMDD(weekDates[0]);
      const toDate = formatDateToYYYYMMDD(weekDates[6]);

      const [{ data, error }, { data: overnightRows, error: overnightError }] = await Promise.all([
        supabase
          .from("timesheet")
          .select("*, projects(name)")
          .eq("user_id", currentUser.id)
          .gte("date", fromDate)
          .lte("date", toDate)
          .order("date", { ascending: true })
          .order("startTime", { ascending: true }),
        supabase
          .from("overnight_stays")
          .select("date")
          .eq("user_id", currentUser.id)
          .gte("date", fromDate)
          .lte("date", toDate)
          .order("date", { ascending: true }),
      ]);

      if (error) {
        toast({
          title: t('weekly.exportFailed'),
          description: error.message,
          variant: "destructive",
        });
        setSendingEmail(false);
        return false;
      }

      if (overnightError) {
        toast({
          title: t('weekly.exportFailed'),
          description: overnightError.message,
          variant: "destructive",
        });
        setSendingEmail(false);
        return false;
      }

      if (!data || data.length === 0) {
        toast({
          title: t('weekly.noData'),
          description: t('weekly.noEntriesForWeek'),
          variant: "destructive",
        });
        setSendingEmail(false);
        return false;
      }

      // Filter out admin adjustments (entries without startTime/endTime are admin adjustments)
      // Only export entries that have both startTime and endTime - these are user-created entries
      const filteredData = data.filter(e => e.startTime && e.endTime);

      if (filteredData.length === 0) {
        toast({
          title: t('weekly.noData'),
          description: t('weekly.noEntriesForWeek'),
          variant: "destructive",
        });
        setSendingEmail(false);
        return false;
      }

      // Group entries by day
      const entriesByDay: Record<string, any[]> = {};
      weekDates.forEach(date => {
        const dateStr = formatDateToYYYYMMDD(date);
        entriesByDay[dateStr] = filteredData.filter(entry => entry.date === dateStr);
      });

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

      // Create ExcelJS workbook (EXACT same logic as handleExportWeek)
      const workbook = new ExcelJS.Workbook();
      
      const dayNamesEN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const overnightSet = new Set((overnightRows || []).map((r: any) => String(r.date)));

      // Add week summary sheet (overtime + overnight) so it's visible immediately on open
      const summarySheet = workbook.addWorksheet("Summary");
      summarySheet.getColumn(1).width = 25;
      summarySheet.getColumn(2).width = 80;

      summarySheet.getCell('A1').value = t('weekly.employeeName');
      summarySheet.getCell('B1').value = currentUser.name || currentUser.email || '';
      summarySheet.getCell('A2').value = t('weekly.date');
      summarySheet.getCell('B2').value = `${t('weekly.from')}: ${formatDateDDMMYY(fromDate)}  ${t('weekly.to')}: ${formatDateDDMMYY(toDate)}`;
      summarySheet.getCell('A3').value = t('weekly.weekNumber');
      summarySheet.getCell('B3').value = weekNumber.toString();
      summarySheet.getCell('A4').value = t('weekly.year');
      summarySheet.getCell('B4').value = new Date(fromDate).getFullYear().toString();

      // Weekly overtime totals (same rules as overtime panel)
      const dateHoursMap: Record<string, number> = {};
      filteredData.forEach((entry: any) => {
        const workType = parseInt(entry.description || "0");
        if ((workType >= 10 && workType <= 29) || workType === 100) {
          const h = parseFloat(entry.hours) || 0;
          dateHoursMap[String(entry.date)] = (dateHoursMap[String(entry.date)] || 0) + h;
        }
      });
      let totalOvertime = 0;
      let total125 = 0;
      let total150 = 0;
      let total200 = 0;
      Object.keys(dateHoursMap).forEach(dateStr => {
        const totalHoursForDay = dateHoursMap[dateStr] || 0;
        const dow = new Date(dateStr).getDay();
        const isSat = dow === 6;
        const isSun = dow === 0;
        if (isSun) { totalOvertime += totalHoursForDay; total200 += totalHoursForDay; return; }
        if (isSat) { totalOvertime += totalHoursForDay; total150 += totalHoursForDay; return; }
        const overtimeHours = totalHoursForDay > 8 ? totalHoursForDay - 8 : 0;
        if (overtimeHours > 0) {
          totalOvertime += overtimeHours;
          total125 += Math.min(overtimeHours, 2);
          if (overtimeHours > 2) total150 += overtimeHours - 2;
        }
      });

      const overnightDates = (overnightRows || []).map((r: any) => formatDateDDMMYY(String(r.date)));
      
      // Calculate weekly total kilometers (work types 20 and 21 only)
      const weeklyTotalKilometers = filteredData.reduce((sum, entry) => {
        const workType = parseInt(entry.description || "0");
        if ((workType === 20 || workType === 21) && entry.kilometers) {
          return sum + (parseFloat(String(entry.kilometers)) || 0);
        }
        return sum;
      }, 0);
      
      // Make summary easy to read (separate cells)
      summarySheet.getCell('A6').value = t('export.overtimeSummary');
      summarySheet.getCell('A6').font = { bold: true };
      summarySheet.mergeCells('A6:H6');

      summarySheet.getCell('A7').value = t('export.overtimeTotal');
      summarySheet.getCell('A7').font = { bold: true };
      summarySheet.getCell('B7').value = totalOvertime;
      summarySheet.getCell('B7').numFmt = '0.00';
      summarySheet.getCell('C7').value = '125%';
      summarySheet.getCell('C7').font = { bold: true };
      summarySheet.getCell('D7').value = total125;
      summarySheet.getCell('D7').numFmt = '0.00';
      summarySheet.getCell('E7').value = '150%';
      summarySheet.getCell('E7').font = { bold: true };
      summarySheet.getCell('F7').value = total150;
      summarySheet.getCell('F7').numFmt = '0.00';
      summarySheet.getCell('G7').value = '200%';
      summarySheet.getCell('G7').font = { bold: true };
      summarySheet.getCell('H7').value = total200;
      summarySheet.getCell('H7').numFmt = '0.00';

      summarySheet.getCell('A9').value = t('export.overnightStays');
      summarySheet.getCell('A9').font = { bold: true };
      summarySheet.getCell('B9').value = overnightDates.length;
      summarySheet.getCell('C9').value = t('export.overnightDates');
      summarySheet.getCell('C9').font = { bold: true };
      summarySheet.getCell('D9').value = overnightDates.join(', ');
      summarySheet.mergeCells('D9:H9');

      summarySheet.getCell('A11').value = t('weekly.kilometers') || 'Kilometers';
      summarySheet.getCell('A11').font = { bold: true };
      summarySheet.getCell('B11').value = weeklyTotalKilometers > 0 ? weeklyTotalKilometers : '';
      summarySheet.getCell('B11').font = { bold: true };
      if (weeklyTotalKilometers > 0) {
        summarySheet.getCell('B11').numFmt = '0.0';
      }

      // Light styling band
      ['A7','B7','C7','D7','E7','F7','G7','H7','A9','B9','C9','D9','A11','B11'].forEach(addr => {
        const cell = summarySheet.getCell(addr);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
      });

      applyDefaultFont(summarySheet, 12);
      
      // Set print settings for Summary sheet
      summarySheet.pageSetup = {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1
      };
      
      // Create sheets for each day
      weekDates.forEach((date, dayIdx) => {
        const dateStr = formatDateToYYYYMMDD(date);
        const dayEntries = entriesByDay[dateStr] || [];
        const locale = language === 'nl' ? 'nl-NL' : 'en-GB';
        const dayName = dayNamesEN[dayIdx]; // sheet name (stable)
        const dayNameDisplay = date.toLocaleDateString(locale, { weekday: 'long' });
        const formattedDate = formatDateDDMMYY(dateStr);
        
        // Calculate total hours for the day (excluding breaks - work type 35)
        const totalHours = dayEntries.reduce((sum, entry) => {
          // Skip breaks (work type 35) - they should not count toward total hours
          if (entry.description === "35") {
            return sum;
          }
          return sum + (parseFloat(entry.hours) || 0);
        }, 0);
        const totalHoursHHMM = formatHoursHHMM(totalHours);
        
        // Create worksheet
        const worksheet = workbook.addWorksheet(dayName);

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
        worksheet.getColumn(1).width = 20; // Day
        worksheet.getColumn(2).width = 20; // Work Type
        worksheet.getColumn(3).width = 30; // Project Work Order
        worksheet.getColumn(4).width = 8;  // From
        worksheet.getColumn(5).width = 8;  // To
        worksheet.getColumn(6).width = 18; // Hours Worked
        worksheet.getColumn(7).width = 12; // Kilometers
        worksheet.getColumn(8).width = 30; // Space for logo

        // Add header rows
        worksheet.getCell('A1').value = t('weekly.employeeName');
        worksheet.getCell('B1').value = currentUser.name || currentUser.email || '';
        
        worksheet.getCell('A2').value = t('weekly.date');
        worksheet.getCell('B2').value = `${t('weekly.from')}: ${formatDateDDMMYY(fromDate)}`;
        worksheet.getCell('D2').value = `${t('weekly.to')}: ${formatDateDDMMYY(toDate)}`;
        
        worksheet.getCell('A3').value = t('weekly.day');
        worksheet.getCell('B3').value = `${formattedDate} ${dayNameDisplay}`;
        
        worksheet.getCell('A4').value = t('weekly.weekNumber');
        worksheet.getCell('B4').value = weekNumber.toString();
        
        worksheet.getCell('A5').value = t('weekly.year');
        worksheet.getCell('B5').value = new Date(fromDate).getFullYear().toString();

        // Overtime + overnight for this day (same rules as overtime panel)
        let dayOvertime = 0;
        let day125 = 0;
        let day150 = 0;
        let day200 = 0;
        const dow = date.getDay();
        const isSaturday = dow === 6;
        const isSunday = dow === 0;
        if (isSunday) {
          dayOvertime = totalHours;
          day200 = totalHours;
        } else if (isSaturday) {
          dayOvertime = totalHours;
          day150 = totalHours;
        } else {
          const overtimeHours = totalHours > 8 ? totalHours - 8 : 0;
          if (overtimeHours > 0) {
            dayOvertime = overtimeHours;
            day125 = Math.min(overtimeHours, 2);
            if (overtimeHours > 2) day150 = overtimeHours - 2;
          }
        }
        // Clear, per-day summary (separate cells)
        worksheet.getCell('A6').value = t('export.overtimeSummary');
        worksheet.getCell('A6').font = { bold: true };
        worksheet.mergeCells('A6:H6');

        worksheet.getCell('A7').value = t('export.overtimeTotal');
        worksheet.getCell('A7').font = { bold: true };
        worksheet.getCell('B7').value = dayOvertime;
        worksheet.getCell('B7').numFmt = '0.00';
        worksheet.getCell('C7').value = '125%';
        worksheet.getCell('C7').font = { bold: true };
        worksheet.getCell('D7').value = day125;
        worksheet.getCell('D7').numFmt = '0.00';
        worksheet.getCell('E7').value = '150%';
        worksheet.getCell('E7').font = { bold: true };
        worksheet.getCell('F7').value = day150;
        worksheet.getCell('F7').numFmt = '0.00';
        worksheet.getCell('G7').value = '200%';
        worksheet.getCell('G7').font = { bold: true };
        worksheet.getCell('H7').value = day200;
        worksheet.getCell('H7').numFmt = '0.00';

        worksheet.getCell('A8').value = t('export.overnightStays');
        worksheet.getCell('A8').font = { bold: true };
        worksheet.getCell('B8').value = overnightSet.has(dateStr) ? t('admin.yes') : t('admin.no');

        ['A7','B7','C7','D7','E7','F7','G7','H7','A8','B8'].forEach(addr => {
          const cell = worksheet.getCell(addr);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
        });

        // Add table headers (row 7)
        const headerRow = worksheet.getRow(9);
        headerRow.values = [t('weekly.day'), t('weekly.workType'), t('weekly.projectWorkOrder'), t('weekly.from'), t('weekly.to'), t('weekly.hoursWorked'), t('weekly.kilometers')];
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5E5E5' }
        };

        // Add data rows
        dayEntries.forEach((entry, idx) => {
          const workType = parseInt(entry.description || "0");
          const row = worksheet.getRow(10 + idx);
          row.values = [
            dayNameDisplay,
            getWorkTypeLabel(entry.description || ''),
            entry.projects?.name || entry.project || '',
            entry.startTime || '',
            entry.endTime || '',
            formatHoursHHMM(parseFloat(entry.hours) || 0),
            (workType === 20 || workType === 21) ? (entry.kilometers ? String(entry.kilometers) : '') : '',
          ];
        });

        // Calculate total kilometers for the day (work types 20 and 21 only)
        const totalKilometers = dayEntries.reduce((sum, entry) => {
          const workType = parseInt(entry.description || "0");
          if ((workType === 20 || workType === 21) && entry.kilometers) {
            return sum + (parseFloat(String(entry.kilometers)) || 0);
          }
          return sum;
        }, 0);

        // Add total row
        const totalRowIndex = 10 + dayEntries.length;
        const totalRow = worksheet.getRow(totalRowIndex);
        totalRow.getCell(2).value = t('daily.total');
        totalRow.getCell(2).font = { bold: true };
        totalRow.getCell(6).value = totalHoursHHMM;
        totalRow.getCell(6).font = { bold: true };
        totalRow.getCell(7).value = totalKilometers > 0 ? totalKilometers : '';
        totalRow.getCell(7).font = { bold: true };
        if (totalKilometers > 0) {
          totalRow.getCell(7).numFmt = '0.0';
        }

        // Make each sheet easier to read
        applyDefaultFont(worksheet, totalRowIndex);
        
        // Set print settings for day sheet
        worksheet.pageSetup = {
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 1
        };
      });

      // Generate filename with user name and week number
      const userName = (currentUser.name || currentUser.email || t('common.user')).replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${userName}_Week${weekNumber}_${new Date(fromDate).getFullYear()}.xlsx`;
      
      // Write to buffer and convert to base64
      const buffer = await workbook.xlsx.writeBuffer();
      // Convert Uint8Array to base64 string (chunked to avoid stack overflow)
      const uint8Array = new Uint8Array(buffer);
      const chunkSize = 0x8000; // 32KB chunks
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binaryString += String.fromCharCode.apply(null, Array.from(chunk) as any);
      }
      const base64 = btoa(binaryString);

      // Call edge function to send email
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('send-week-excel-email', {
        body: {
          userId: currentUser.id,
          userName: currentUser.name || currentUser.email || '',
          userEmail: currentUser.email || '',
          weekNumber,
          year: new Date(fromDate).getFullYear(),
          dateFrom: fromDate,
          dateTo: toDate,
          excelBase64: base64,
          recipientEmails: ADMINISTRATIE_EMAILS,
          filename,
        },
      });

      if (edgeError) {
        console.error('Edge function error:', edgeError);
        toast({
          title: t('weekly.emailSentError', { error: edgeError.message || 'Unknown error' }),
          variant: "destructive",
        });
        setSendingEmail(false);
        return false;
      }

      if (edgeData?.error) {
        toast({
          title: t('weekly.emailSentError', { error: edgeData.error || 'Unknown error' }),
          variant: "destructive",
        });
        setSendingEmail(false);
        return false;
      }

      // Update email_sent_at in confirmed_weeks table if updateEmailStatus is true
      if (updateEmailStatus) {
        const weekKey = formatDateToYYYYMMDD(weekDates[0]);
        const { error: updateError } = await supabase
          .from('confirmed_weeks')
          .update({
            email_sent_at: new Date().toISOString(),
            email_sent_by: currentUser.id,
          })
          .eq('user_id', currentUser.id)
          .eq('week_start_date', weekKey);
        
        if (updateError) {
          console.error('Failed to update email_sent_at:', updateError);
        } else {
          // Update local state
          setEmailStatus(prev => ({
            ...prev,
            [weekKey]: {
              ...prev[weekKey],
              email_sent_at: new Date().toISOString(),
            }
          }));
        }
      }

      toast({
        title: t('weekly.emailSentSuccess', { email: ADMINISTRATIE_EMAIL }),
        description: t('weekly.emailSentSuccessDescription', { weekNumber, year: new Date(fromDate).getFullYear() }),
      });
      setSendingEmail(false);
      return true;
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: t('weekly.emailSentError', { error: error.message || 'Unknown error' }),
        variant: "destructive",
      });
      setSendingEmail(false);
      return false;
    }
  };

  // Handle week confirmation
  const handleConfirmWeek = async () => {
    if (!currentUser) return;
    
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    
    // Validate that Monday through Friday all have entries
    const weekdays = weekDates.slice(0, 5); // Monday-Friday (indices 0-4)
    const missingDays: string[] = [];
    
    weekdays.forEach((date, idx) => {
      const dateStr = formatDateToYYYYMMDD(date);
      const submitted = submittedEntries[dateStr] || [];
      // Check if day has submitted entries OR has entries in the editable days array
      const day = days[idx];
      const hasEditableEntries = day?.entries?.some((e: Entry) => {
        const hasWorkType = e.workType && e.workType.trim() !== "";
        if (!hasWorkType) return false;
        
        const isDayOff = e.workType === "31";
        const requiresProject = workTypeRequiresProject(e.workType);
        
        // For day off with fullDayOff checkbox, only need workType
        if (isDayOff && e.fullDayOff) {
          return true;
        }
        
        // For other entries, check time fields
        const hasTime = (e.startTime && e.startTime.trim() !== "") || 
                       (e.endTime && e.endTime.trim() !== "") || 
                       (e.hours && e.hours.trim() !== "");
        
        if (requiresProject) {
          return e.project && e.project.trim() !== "" && hasTime;
        }
        return hasTime;
      });
      
      if (submitted.length === 0 && !hasEditableEntries) {
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        missingDays.push(dayNames[idx]);
      }
    });
    
    if (missingDays.length > 0) { 
      toast({
        title: "Cannot Confirm Week",
        description: t('weekly.fill.missing.entries'),
        variant: "destructive",
      });
      return;
    }
    
    // IMPORTANT: Save all unsaved entries BEFORE confirming the week
    // This prevents data loss when the week is locked
    const entriesToSave: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const day = days[dayIdx];
      const entryDate = new Date(day.date);
      entryDate.setHours(0, 0, 0, 0);
      
      // Skip future dates
      if (entryDate > today) {
        continue;
      }
      
      const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
      const dateStr = formatDateToYYYYMMDD(day.date);
      
      // Check if this day already has submitted entries - skip if it does
      const alreadySubmitted = (submittedEntries[dateStr] || []).length > 0;
      
      for (let entryIdx = 0; entryIdx < day.entries.length; entryIdx++) {
        const entry = day.entries[entryIdx];
        
        // Skip entries without an id that are empty
        if (!entry.id && !entry.workType && !entry.project && !entry.startTime && !entry.endTime && !entry.hours) {
          continue;
        }
        
        // Skip if entry already has an id (already saved)
        if (entry.id) {
          continue;
        }
        
        const isDayOff = entry.workType === "31";
        const requiresProject = workTypeRequiresProject(entry.workType);
        
        // Validate entry
        if (!isWeekend && ((!entry.project && requiresProject) || !entry.workType)) {
          // Skip invalid entries for weekdays, but continue to save valid ones
          continue;
        }
        
        // For day off with fullDayOff checkbox, validate it's set
        if (isDayOff && !entry.fullDayOff && !entry.startTime && !entry.endTime && !entry.hours) {
          // Skip invalid day off entries
          continue;
        }
        
        // Calculate hours
        let hoursToSave = 0;
        if (isDayOff && entry.fullDayOff) {
          hoursToSave = 8; // Full day off = 8 hours
        } else if (entry.startTime && entry.endTime) {
          const calculated = calculateHours(entry.startTime, entry.endTime);
          hoursToSave = parseFloat(calculated) || 0;
        } else if (entry.hours) {
          hoursToSave = Number(entry.hours);
        }
        
        // Skip entries with invalid hours (unless it's a day off, which can be 0)
        if (hoursToSave <= 0 && !isDayOff) {
          continue;
        }
        
        // For day off, ensure we have at least 8 hours if fullDayOff is checked
        if (isDayOff && entry.fullDayOff && hoursToSave < 8) {
          hoursToSave = 8;
        }
        
        entriesToSave.push({
          project: (isDayOff || entry.workType === "35" || entry.workType === "20" || entry.workType === "21") ? (entry.project?.trim() || null) : entry.project,
          user_id: currentUser.id,
          date: dateStr,
          hours: hoursToSave,
          description: entry.workType,
          startTime: entry.startTime || null,
          endTime: entry.endTime || null,
          stayed_overnight: !!day.stayedOvernight,
          kilometers: (entry.workType === "20" || entry.workType === "21") && entry.kilometers ? parseFloat(entry.kilometers) : null,
        });
      }
    }
    
    // Save all unsaved entries before confirming
    if (entriesToSave.length > 0) {
      const { error: saveError } = await supabase.from("timesheet").insert(entriesToSave);
      
      if (saveError) {
        toast({
          title: "Error Saving Entries",
          description: `Failed to save entries before confirming: ${saveError.message}. Please try again.`,
          variant: "destructive",
        });
        return; // Don't confirm if save fails
      }
      
      // Refresh submitted entries and days off after saving
      await Promise.all([
        ...weekDates.map(d => fetchSubmittedEntries(formatDateToYYYYMMDD(d))),
        entriesToSave.some(e => e.description === "31") ? fetchDaysOff() : Promise.resolve()
      ]);
      
      toast({
        title: "Entries Saved",
        description: `${entriesToSave.length} entry(s) saved before confirming the week.`,
      });
    }
    
    // Check if week already has confirmed status
    const { data: existing } = await supabase
      .from('confirmed_weeks')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('week_start_date', weekKey)
      .single();
    
    if (existing?.confirmed) {
      toast({
        title: t('weekly.alreadyConfirmed'),
        description: t('weekly.alreadyConfirmedDescription'),
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
        title: t('common.error'),
        description: error.message || t('weekly.failedToConfirmWeek'),
        variant: "destructive",
      });
    } else {
      // Immediately update state to lock the week - this will trigger a re-render and hide all editable elements
      const weekKeyDate = formatDateToYYYYMMDD(weekDates[0]);
      console.log('CONFIRMING WEEK - Setting state to locked:', weekKeyDate, 'isAdmin:', currentUser.isAdmin);
      
      // Lock the week immediately - both for admins and non-admins
      // Admins can unlock via admin panel if needed
      const shouldBeLocked = true;
      
      console.log('CONFIRMING WEEK - shouldBeLocked:', shouldBeLocked);
      
      // Force state update immediately
      setConfirmedWeeks(prev => {
        const updated = { ...prev, [weekKeyDate]: shouldBeLocked };
        console.log('CONFIRMING WEEK - Updated state:', updated);
        console.log('CONFIRMING WEEK - New value for weekKey:', updated[weekKeyDate]);
        return updated;
      });
      
      // Clear all editable entries to prevent any further editing
      setDays(prevDays => prevDays.map(day => ({
        ...day,
        entries: [] // Clear all editable entries when week is confirmed
      })));
      
      // Show dialog for all users to optionally send email
      setShowSendEmailDialog(true);
      
      toast({
        title: "Week Confirmed",
        description: "This week has been confirmed and locked. You can no longer make changes.",
      });
      
      // Refresh confirmed status
      await fetchConfirmedStatus();
    }
  };

  // Calculate isLocked directly from state for rendering
  // Week is locked if confirmed AND (user is not admin OR admin hasn't approved yet)
  // For simplicity: if confirmedWeeks[weekKey] is true, the week is locked (regardless of admin status)
  // Admins will need to use the admin panel to approve/unlock weeks
  const weekKey = formatDateToYYYYMMDD(weekDates[0]);
  const isLocked = !!confirmedWeeks[weekKey];

  // Check if week has submitted entries for all weekdays (Monday through Friday)
  const hasSubmittedEntries = () => {
    // Check that all weekdays (Monday-Friday, indices 0-4) have at least one entry
    // This checks both submitted entries AND editable entries in the days array
    return weekDates.slice(0, 5).every((date, idx) => {
      const dateStr = formatDateToYYYYMMDD(date);
      const submitted = submittedEntries[dateStr] || [];
      
      // Also check editable entries for this day
      const day = days[idx];
      const hasEditableEntries = day?.entries?.some((e: Entry) => {
        const hasWorkType = e.workType && e.workType.trim() !== "";
        const hasTime = (e.startTime && e.startTime.trim() !== "") || 
                       (e.endTime && e.endTime.trim() !== "") || 
                       (e.hours && e.hours.trim() !== "");
        const requiresProject = workTypeRequiresProject(e.workType);
        if (requiresProject) {
          return hasWorkType && e.project && e.project.trim() !== "" && hasTime;
        }
        return hasWorkType && hasTime;
      });
      
      return submitted.length > 0 || hasEditableEntries;
    });
  };
  // Debug logging
  console.log('RENDER - isLocked calculation:', { 
    weekKey, 
    confirmedWeeksValue: confirmedWeeks[weekKey], 
    confirmedWeeksState: confirmedWeeks,
    isAdmin: currentUser?.isAdmin, 
    isLocked 
  });

  // Display data for combined panel
  const combinedOvertimeDisplay = combinedOvertimeData || {
    totalOvertime: "0.00",
    totalHours125: "0.00",
    totalHours150: "0.00",
    totalHours200: "0.00",
  };

  return (
    <div className="flex flex-col gap-2 sm:gap-4">
      {/* Mobile: unified Days Off + Overtime/Overnight panel */}
      {isMobile && (
        <Card className={`bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800 ${hasUnreadDaysOffNotification ? 'ring-2 ring-orange-400 ring-offset-2' : ''}`}>
          {currentUser && !currentUser?.isAdmin && currentUser?.userType !== 'administratie' ? (
            <Collapsible open={summaryPanelOpen} onOpenChange={setSummaryPanelOpen}>
              <CollapsibleTrigger asChild>
                <button type="button" className="w-full text-left">
                  <CardHeader className="p-3">
                    <CardTitle className="text-blue-900 dark:text-blue-100 text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        {t('weekly.daysOffRemaining')}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-blue-600 dark:text-blue-400 transition-transform duration-200 ${summaryPanelOpen ? 'rotate-180' : ''}`} />
                    </CardTitle>
                    <div className="mt-1 flex items-center justify-between gap-3 text-xs text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-blue-700 dark:text-blue-200">
                          {daysOffLeft}
                        </span>
                        <span className="opacity-80">({hoursLeftRounded} {t('weekly.hours')})</span>
                        {hasUnreadDaysOffNotification && (
                          <span className="ml-1 inline-flex items-center gap-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-1.5 py-0.5 rounded-full text-[10px] font-semibold animate-pulse">
                            ⚠️
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-600 dark:text-gray-400">{t('overtime.totalOvertime')}:</span>
                          <span className="font-bold text-blue-700 dark:text-blue-200">
                            {combinedOvertimeLoading ? "..." : `${combinedOvertimeDisplay.totalOvertime}h`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Moon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span className="font-bold text-indigo-700 dark:text-indigo-200">
                            {combinedOvernightLoading ? "..." : combinedOvernightCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-3 pt-0">
                  {/* Divider */}
                  <div className="border-t border-blue-200 dark:border-blue-700 my-3"></div>

                  {/* Overtime breakdown */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400">{t('overtime.totalOvertime')}:</span>
                    <span className="text-base font-bold text-blue-600 dark:text-blue-300">
                      {combinedOvertimeLoading ? "..." : `${combinedOvertimeDisplay.totalOvertime}h`}
                    </span>
                  </div>
                  {!combinedOvertimeLoading && (
                    <div className="flex flex-wrap gap-2">
                      {parseFloat(combinedOvertimeDisplay.totalHours125 || "0") > 0 && (
                        <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded px-2 py-1">
                          <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">125%:</span>
                          <span className="text-xs font-bold text-orange-700 dark:text-orange-300">{combinedOvertimeDisplay.totalHours125}h</span>
                        </div>
                      )}
                      {parseFloat(combinedOvertimeDisplay.totalHours150 || "0") > 0 && (
                        <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded px-2 py-1">
                          <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">150%:</span>
                          <span className="text-xs font-bold text-yellow-700 dark:text-yellow-300">{combinedOvertimeDisplay.totalHours150}h</span>
                        </div>
                      )}
                      {parseFloat(combinedOvertimeDisplay.totalHours200 || "0") > 0 && (
                        <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-2 py-1">
                          <span className="text-xs font-semibold text-red-600 dark:text-red-400">200%:</span>
                          <span className="text-xs font-bold text-red-700 dark:text-red-300">{combinedOvertimeDisplay.totalHours200}h</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Divider */}
                  <div className="border-t border-blue-200 dark:border-blue-700 my-3"></div>

                  {/* Overnight stays */}
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">{t("overtime.overnightCount")}:</span>
                    <span className="text-base font-bold text-indigo-700 dark:text-indigo-200">
                      {combinedOvernightLoading ? "..." : combinedOvernightCount}
                    </span>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  {t('weekly.daysOffRemaining')}
                </div>
                {hasUnreadDaysOffNotification && (
                  <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-1.5 py-0.5 rounded-full text-[10px] font-semibold animate-pulse">
                    ⚠️
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm font-bold text-blue-700 dark:text-blue-200">
                {daysOffLeft} <span className="text-xs font-medium opacity-80">({hoursLeftRounded} {t('weekly.hours')})</span>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Desktop: Overtime Summary Panels (not admins/administratie) */}
      {!isMobile && currentUser && !currentUser?.isAdmin && currentUser?.userType !== 'administratie' && (
        <>
          <OvertimeSummaryPanel currentUser={currentUser} weekStart={weekStart} />
          <OvernightSummaryPanel currentUser={currentUser} weekStart={weekStart} />
        </>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div className="flex-1">
          <h2 className="text-lg sm:text-2xl font-bold pt-1 sm:pt-0">{t('weekly.title')}</h2>
          <div className="mt-1 text-xs sm:text-base text-gray-700 dark:text-gray-300 font-medium">
            {t('weekly.week')} {weekNumber} ({weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()})
          </div>
          <div className="flex items-center gap-1.5 sm:gap-4 mt-2 flex-wrap">
            <Button variant="outline" size={isMobile ? "sm" : "default"} onClick={() => changeWeek(-1)} className="text-xs sm:text-sm">
              &lt; {t('weekly.prev')}
            </Button>
            <Button variant="outline" size={isMobile ? "sm" : "default"} onClick={() => changeWeek(1)} className="text-xs sm:text-sm">
              {t('weekly.next')} &gt;
            </Button>
            {currentUser && (
              <ShareEntryButton
                onClick={handleShareWeek}
                hasEntries={getWeekEntryCount() > 0}
              />
            )}
            {/* Week selector - Available for all users - Hide on mobile or make more compact */}
            {!isMobile && currentUser && availableWeeks.length > 0 && (
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
                      entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "", fullDayOff: false, kilometers: "" }] 
                    })));
                  }
                }}
              >
                <SelectTrigger className={`${isMobile ? 'w-[140px] h-7' : 'w-[250px] md:w-[300px] h-9'} text-xs sm:text-sm`}>
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
            {!isMobile && (
              <Button variant="outline" size={isMobile ? "sm" : "default"} onClick={handleExportWeek} className="text-xs sm:text-sm">
                <Download className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} mr-1 sm:mr-2`} />
                {t('weekly.exportWeek')}
              </Button>
            )}
            {setUseSimpleView && (
              <Button 
                variant="outline" 
                onClick={() => {
                  const newValue = !useSimpleView;
                  setUseSimpleView(newValue);
                  localStorage.setItem('bampro_use_simple_weekly_view', String(newValue));
                }}
                size={isMobile ? "sm" : "default"} 
                className="text-xs sm:text-sm"
                title={useSimpleView ? "Switch to original view" : "Switch to simple view"}
              >
                🔄 {useSimpleView ? "Original" : "Simple"}
              </Button>
            )}
          </div>
        </div>
        {!isMobile && (
          <Card className={`bg-blue-50 border-blue-200 w-full sm:w-auto sm:min-w-[200px] ${hasUnreadDaysOffNotification ? 'ring-2 ring-orange-400 ring-offset-2' : ''}`}>
            <CardHeader className="p-2 sm:p-6">
              <CardTitle className="text-blue-900 text-xs sm:text-lg flex items-center justify-between">
                <span>{t('weekly.daysOffRemaining')}</span>
                {hasUnreadDaysOffNotification && (
                  <div className="flex items-center gap-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-1.5 py-0.5 rounded-full text-xs font-semibold animate-pulse">
                    <span>⚠️</span>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
              <div className="text-xl sm:text-3xl font-bold text-blue-700">
                {daysOffLeft} <span className="text-xs sm:text-lg">({hoursLeftRounded} {t('weekly.hours')})</span>
              </div>
              {hasUnreadDaysOffNotification && (
                <div className="text-xs sm:text-sm text-orange-600 dark:text-orange-400 mt-1.5 sm:mt-2 font-semibold">
                  ⚠️ Updated!
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {isLocked && (
        <div className="p-1.5 sm:p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md sm:rounded text-yellow-800 dark:text-yellow-200 text-xs sm:text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span>⚠️ {t('weekly.confirmed')}</span>
            {emailStatus[weekKey]?.email_sent_at ? (
              <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
                <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="text-xs">
                  Email Sent {new Date(emailStatus[weekKey].email_sent_at).toLocaleDateString()}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="text-xs">Email not sent</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Reminder to confirm week when entries are filled */}
      {!isLocked && hasSubmittedEntries() && (
        <div className="p-1.5 sm:p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md sm:rounded text-orange-800 dark:text-orange-200 text-xs sm:text-sm">
          <strong>💡 {t('weekly.confirmReminder')}</strong>
        </div>
      )}
      
      {!isLocked && weekReviewComment && (
        <div className="p-1.5 sm:p-3 bg-red-50 border border-red-200 rounded-md sm:rounded text-red-800 text-xs sm:text-sm">
          <strong>{t('admin.rejectedStatus')}:</strong> {weekReviewComment}
        </div>
      )}

      <Card>
        <CardContent className="p-2 sm:p-4">
          {isMobile ? (
            // One-day view for mobile
            <div className="space-y-3">
              {(() => {
                const locale = language === 'nl' ? 'nl-NL' : 'en-GB';
                const safeDayIdx = Math.max(0, Math.min(activeDayIdx, weekDates.length - 1));
                const todayIdx = getTodayIndexInWeek(weekDates);
                const activeSummary = calculateDailySummary(safeDayIdx);

                return (
                  <>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 px-2"
                          onClick={() => setActiveDayIdx((i) => Math.max(0, i - 1))}
                          disabled={safeDayIdx === 0}
                        >
                          ‹
                        </Button>
                        <div className="flex-1 min-w-0">
                          <Select
                            value={String(safeDayIdx)}
                            onValueChange={(v) => setActiveDayIdx(parseInt(v, 10) || 0)}
                          >
                            <SelectTrigger className="h-9 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                              <SelectValue placeholder="Select day" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {weekDates.map((d, idx) => (
                                <SelectItem key={formatDateToYYYYMMDD(d)} value={String(idx)}>
                                  {d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
                            <span className="truncate">
                              {activeSummary.totalHours}h • {activeSummary.entryCount}{" "}
                              {activeSummary.entryCount === 1 ? (t('weekly.entry') || 'entry') : (t('weekly.entries') || 'entries')}
                            </span>
                            <div className="flex items-center gap-2">
                              {activeSummary.hasOvernight && (
                                <span className="flex items-center gap-1 shrink-0">
                                  <Moon className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                                  <span>{t('weekly.overnightStay')}</span>
                                </span>
                              )}
                              {currentUser && (
                                <ShareEntryButton
                                  onClick={() => handleShareDay(safeDayIdx)}
                                  hasEntries={getDayEntryCount(safeDayIdx) > 0}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 px-2"
                          onClick={() => setActiveDayIdx((i) => Math.min(weekDates.length - 1, i + 1))}
                          disabled={safeDayIdx >= weekDates.length - 1}
                        >
                          ›
                        </Button>
                      </div>

                      <div className="mt-2 grid grid-cols-4 gap-1">
                        {weekDates.map((d, idx) => {
                          const chipSummary = calculateDailySummary(idx);
                          const isSelected = idx === safeDayIdx;
                          const isToday = idx === todayIdx;
                          return (
                            <Button
                              key={formatDateToYYYYMMDD(d)}
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              onClick={() => setActiveDayIdx(idx)}
                              className={`h-8 w-full px-1 text-[11px] justify-center min-w-0 ${isToday ? 'ring-2 ring-orange-400 ring-offset-1' : ''}`}
                            >
                              <span className="flex items-center gap-1 min-w-0">
                                <span className="truncate">
                                  {d.toLocaleDateString(locale, { weekday: 'short' })} {d.getDate()}
                                </span>
                                {chipSummary.entryCount > 0 && <span className="opacity-70">•</span>}
                                {chipSummary.hasOvernight && <Moon className="h-3 w-3 shrink-0" />}
                              </span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <Accordion type="single" value={`day-${safeDayIdx}`} className="space-y-2">
                      {(() => {
                        const dayIdx = safeDayIdx;
                        const day = days[dayIdx];
                        const dayValue = `day-${dayIdx}`;

                        return (
                          <AccordionItem key={dayIdx} value={dayValue} className="border-none">
                            <AccordionTrigger className="hidden"></AccordionTrigger>
                            <AccordionContent>
                              {(() => {
                                const dateStr = formatDateToYYYYMMDD(day.date);
                        
                        // Check if there's a fullDayOff entry for this day (in editable or submitted entries)
                        const hasFullDayOff = day.entries.some(e => e.workType === "31" && e.fullDayOff) ||
                          (submittedEntries[dateStr] || []).some(e => {
                            if (e.workType === "31") {
                              return e.fullDayOff || parseFloat(e.hours || "0") === 8;
                            }
                            return false;
                          });
                        
                        const submitted = (submittedEntries[dateStr] || []).sort((a, b) => {
                          const timeA = (a.startTime || "").trim();
                          const timeB = (b.startTime || "").trim();
                          
                          if (timeA && timeB) {
                            const parseTime = (timeStr: string): number => {
                              const parts = timeStr.split(':');
                              if (parts.length !== 2) return 0;
                              const hours = parseInt(parts[0], 10) || 0;
                              const minutes = parseInt(parts[1], 10) || 0;
                              return hours * 60 + minutes;
                            };
                            return parseTime(timeA) - parseTime(timeB);
                          }
                          
                          if (timeA && !timeB) return -1;
                          if (!timeA && timeB) return 1;
                          return 0;
                        });
                        const isDayLocked = isLocked;
                        const locale = language === 'nl' ? 'nl-NL' : 'en-GB';
                        const dayName = day.date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
                        const dayShort = day.date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
                        const dayColors = [
                          'bg-blue-50 border-blue-200',
                          'bg-green-50 border-green-200',
                          'bg-yellow-50 border-yellow-200',
                          'bg-purple-50 border-purple-200',
                          'bg-pink-50 border-pink-200',
                          'bg-gray-50 border-gray-200',
                          'bg-slate-50 border-slate-200',
                        ];
                        const dayColor = dayColors[day.date.getDay() === 0 ? 6 : day.date.getDay() - 1];
                        
                        return (
                          <div className={`border-2 rounded-md sm:rounded-lg ${dayColor} overflow-hidden mt-2`}>
                            {/* Day Header */}
                            <div className={`px-2 sm:px-4 py-1.5 sm:py-3 border-b-2 ${dayColor.replace('50', '200')} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2`}>
                              <div className="flex items-center gap-1.5 sm:gap-3">
                                <h3 className="font-bold text-sm sm:text-lg text-gray-800 dark:text-gray-900">{dayShort}</h3>
                                {!isMobile && <span className="text-sm text-gray-600 dark:text-gray-900">({dayShort})</span>}
                              </div>
                              {!isLocked && (
                                <div className={`flex gap-1.5 sm:gap-2 ${isMobile ? 'w-full' : ''}`}>
                                  {dayIdx > 0 && (
                                    <Button 
                                      variant="outline" 
                                      size={isMobile ? "sm" : "sm"}
                                      className={`${isMobile ? 'h-7 text-xs flex-1' : 'h-7 text-xs'}`}
                                      onClick={() => handleCopyFromPreviousDay(dayIdx)}
                                      disabled={hasFullDayOff}
                                    >
                                      {t('weekly.copyPrevious')}
                                    </Button>
                                  )}
                                  <Button 
                                    variant="outline" 
                                    size={isMobile ? "sm" : "sm"}
                                    className={`${isMobile ? 'h-7 text-xs flex-1' : 'h-7 text-xs'}`}
                                    onClick={() => handleAddEntry(dayIdx)}
                                    disabled={hasFullDayOff}
                                    title={hasFullDayOff ? "Je hebt deze dag als volledige vrije dag gemarkeerd. Je kunt geen extra entries toevoegen." : ""}
                                  >
                                    <Plus className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
                                    {t('weekly.addEntry')}
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Stayed overnight checkbox */}
                            <div className={`px-2 sm:px-4 py-1.5 sm:py-2 border-b ${dayColor.replace('50', '200')} flex items-center justify-between`}>
                              <div className="flex items-center space-x-1.5 sm:space-x-2">
                                <Checkbox
                                  id={`stayedOvernight-simple-${dayIdx}`}
                                  checked={!!day.stayedOvernight}
                                  onCheckedChange={(checked) => {
                                    persistOvernightStay(dayIdx, checked === true);
                                  }}
                                  disabled={isDayLocked}
                                />
                                <Label
                                  htmlFor={`stayedOvernight-simple-${dayIdx}`}
                                  className="text-xs sm:text-sm font-medium cursor-pointer text-gray-800 dark:text-gray-900"
                                >
                                  {t('weekly.overnightStay')}
                                </Label>
                              </div>
                            </div>
                            
                            {/* Mobile: Card Layout - Reuse same logic as desktop */}
                            <div className="p-2 sm:p-4 space-y-2 sm:space-y-3">
                              {/* Render editable entries */}
                              {!isLocked && day.entries
                                .filter((entry, entryIdx) => {
                                  if (hasFullDayOff) {
                                    return entry.workType === "31" && entry.fullDayOff;
                                  }
                                  return true;
                                })
                                .map((entry, entryIdx) => {
                                const isNewEntry = !entry.id;
                                const isEditing = entry.id && editingEntry?.id === entry.id;
                                return (
                                <div key={`edit-${dayIdx}-${entryIdx}`} className={`rounded-md sm:rounded-lg border border-gray-300 dark:border-gray-700 p-2 sm:p-3 space-y-2 sm:space-y-3 ${isEditing ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700' : 'bg-white dark:bg-gray-800'}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                      {isEditing && (
                                        <span className="text-xs bg-yellow-500 text-white px-1.5 py-0.5 rounded font-semibold">{t('weekly.editing')}</span>
                                      )}
                                      <Label className="text-xs font-semibold text-gray-900 dark:text-gray-100">{t('weekly.workType')}</Label>
                                    </div>
                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                      <Button 
                                        variant="default" 
                                        size="sm"
                                        className={`${isMobile ? 'h-6 px-2' : 'h-7 px-3'} text-xs bg-green-600 hover:bg-green-700`}
                                        onClick={() => handleSaveEntry(dayIdx, entryIdx)}
                                        disabled={isLocked}
                                      >
                                        {t('common.save')}
                                      </Button>
                                      {day.entries.length > 1 && (
                                        <Button 
                                          variant="destructive" 
                                          size="sm"
                                          className={`${isMobile ? 'h-6 w-6' : 'h-7 w-7'} text-xs`}
                                          onClick={() => handleRemoveEntry(dayIdx, entryIdx)}
                                          disabled={isLocked}
                                        >
                                          -
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                          <div>
                            <Label className="text-xs font-semibold">{t('weekly.workType')}</Label>
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
                                  className={`w-full justify-between ${isMobile ? 'h-8' : 'h-10'} text-xs sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mt-1`}
                                  disabled={isLocked}
                                >
                                  {entry.workType 
                                    ? `${entry.workType} - ${workTypes.find(t => String(t.value) === entry.workType)?.label || ""}`
                                    : t('weekly.selectWorkType')}
                                  <ChevronsUpDown className={`ml-2 ${isMobile ? 'h-3 w-3' : 'h-4 w-4'} shrink-0 opacity-50`} />
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

                          <div>
                            <Label className="text-xs font-semibold">{t('weekly.project')}</Label>
                            <div className="mt-1">
                              <Popover
                                open={openProjectPopovers[`${dayIdx}-${entryIdx}`] || false}
                                onOpenChange={(open) => {
                                  const key = `${dayIdx}-${entryIdx}`;
                                  setOpenProjectPopovers(prev => ({ ...prev, [key]: open }));
                                  if (!open) {
                                    setProjectSearchValues(prev => ({ ...prev, [key]: "" }));
                                  }
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={`w-full justify-between ${isMobile ? 'h-8' : 'h-10'} text-xs sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
                                    disabled={isLocked || entry.workType === "31" || entry.workType === "35"}
                                  >
                                    {entry.project || t('weekly.selectProject')}
                                    <ChevronsUpDown className={`ml-2 ${isMobile ? 'h-3 w-3' : 'h-4 w-4'} shrink-0 opacity-50`} />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                  <Command>
                                    <CommandInput
                                      placeholder="Search project or type to create new..."
                                      value={projectSearchValues[`${dayIdx}-${entryIdx}`] || ""}
                                      onValueChange={(value) => {
                                        const key = `${dayIdx}-${entryIdx}`;
                                        setProjectSearchValues(prev => ({ ...prev, [key]: value }));
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && projectSearchValues[`${dayIdx}-${entryIdx}`]) {
                                          const searchValue = projectSearchValues[`${dayIdx}-${entryIdx}`];
                                          if (searchValue && !projects.some(p => p.name.toLowerCase() === searchValue.toLowerCase())) {
                                            e.preventDefault();
                                            handleAddNewProject(searchValue, dayIdx, entryIdx);
                                          }
                                        }
                                      }}
                                    />
                                    <CommandList>
                                      <CommandEmpty>
                                        {projectSearchValues[`${dayIdx}-${entryIdx}`] ? (
                                          <div className="py-2 px-4">
                                            <div className="text-sm text-muted-foreground mb-2">
                                              No project found. Press Enter to create "{projectSearchValues[`${dayIdx}-${entryIdx}`]}"
                                            </div>
                                            <Button
                                              size="sm"
                                              className="w-full"
                                              onClick={() => {
                                                const searchValue = projectSearchValues[`${dayIdx}-${entryIdx}`];
                                                if (searchValue) {
                                                  handleAddNewProject(searchValue, dayIdx, entryIdx);
                                                }
                                              }}
                                            >
                                              Add "{projectSearchValues[`${dayIdx}-${entryIdx}`]}"
                                            </Button>
                                          </div>
                                        ) : (
                                          "No projects found."
                                        )}
                                      </CommandEmpty>
                                      <CommandGroup>
                                        {projects
                                          .filter(project =>
                                            !projectSearchValues[`${dayIdx}-${entryIdx}`] ||
                                            project.name.toLowerCase().includes(projectSearchValues[`${dayIdx}-${entryIdx}`].toLowerCase())
                                          )
                                          .map((project) => (
                                            <CommandItem
                                              key={project.id}
                                              value={project.name}
                                              onSelect={() => {
                                                handleEntryChange(dayIdx, entryIdx, "project", project.name);
                                                const key = `${dayIdx}-${entryIdx}`;
                                                setOpenProjectPopovers(prev => ({ ...prev, [key]: false }));
                                                setProjectSearchValues(prev => ({ ...prev, [key]: "" }));
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  entry.project === project.name ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              {project.name}
                                            </CommandItem>
                                          ))}
                                        {projectSearchValues[`${dayIdx}-${entryIdx}`] &&
                                          !projects.some(p =>
                                            p.name.toLowerCase() === projectSearchValues[`${dayIdx}-${entryIdx}`].toLowerCase()
                                          ) && (
                                            <CommandItem
                                              value={projectSearchValues[`${dayIdx}-${entryIdx}`]}
                                              onSelect={() => {
                                                const searchValue = projectSearchValues[`${dayIdx}-${entryIdx}`];
                                                if (searchValue) {
                                                  handleAddNewProject(searchValue, dayIdx, entryIdx);
                                                }
                                              }}
                                              className="text-blue-600 font-medium"
                                            >
                                              <Plus className="mr-2 h-4 w-4" />
                                              {t('weekly.create')} "{projectSearchValues[`${dayIdx}-${entryIdx}`]}"
                                            </CommandItem>
                                          )}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>

                          {/* Full Day Off checkbox for work type 31 */}
                          {entry.workType === "31" && (
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`fullDayOff-${dayIdx}-${entryIdx}`}
                                checked={entry.fullDayOff || false}
                                onCheckedChange={(checked) => {
                                  const isFullDay = checked === true;
                                  handleEntryChange(dayIdx, entryIdx, "fullDayOff", isFullDay);
                                  if (isFullDay) {
                                    // Set times to 08:00 - 16:30, but hours to 8 (minus 0.5 hour break)
                                    handleEntryChange(dayIdx, entryIdx, "startTime", "08:00");
                                    handleEntryChange(dayIdx, entryIdx, "endTime", "16:30");
                                    handleEntryChange(dayIdx, entryIdx, "hours", "8");
                                    
                                    // Remove all other entries for this day (keep only this fullDayOff entry)
                                    setDays(prevDays => prevDays.map((d, i) => {
                                      if (i !== dayIdx) return d;
                                      // Keep only the current entry (the fullDayOff one)
                                      return {
                                        ...d,
                                        entries: [d.entries[entryIdx]]
                                      };
                                    }));
                                  } else {
                                    // Clear times and hours when unchecking
                                    handleEntryChange(dayIdx, entryIdx, "startTime", "");
                                    handleEntryChange(dayIdx, entryIdx, "endTime", "");
                                    handleEntryChange(dayIdx, entryIdx, "hours", "");
                                  }
                                }}
                                disabled={isLocked}
                              />
                              <Label 
                                htmlFor={`fullDayOff-${dayIdx}-${entryIdx}`}
                                className="text-xs font-medium cursor-pointer"
                              >
                                {t('weekly.fullDayOff') || 'Hele dag vrij (8 uren)'}
                              </Label>
                            </div>
                          )}

                          <div className={`grid grid-cols-3 ${isMobile ? 'gap-1.5' : 'gap-2'}`}>
                            <div>
                              <Label className="text-xs font-semibold">{t('weekly.from')}</Label>
                              <Input
                                type="text"
                                value={entry.startTime || ""}
                                onChange={e => handleEntryChange(dayIdx, entryIdx, "startTime", roundToQuarterHour(e.target.value))}
                                placeholder="08:00"
                                className={`${isMobile ? 'h-8 text-xs' : 'h-10 text-sm'} bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mt-1`}
                                disabled={isLocked}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold">{t('weekly.to')}</Label>
                              <Input
                                type="text"
                                value={entry.endTime || ""}
                                onChange={e => handleEntryChange(dayIdx, entryIdx, "endTime", roundToQuarterHour(e.target.value))}
                                placeholder="17:00"
                                className={`${isMobile ? 'h-8 text-xs' : 'h-10 text-sm'} bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mt-1`}
                                disabled={isLocked}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold">{t('weekly.hours')}</Label>
                              <div className={`${isMobile ? 'h-8 text-xs' : 'h-10 text-sm'} flex items-center justify-center bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 font-medium text-gray-900 dark:text-gray-100 mt-1`}>
                                {(() => {
                                  // If full day off is checked, show 8 hours
                                  if (entry.workType === "31" && entry.fullDayOff) {
                                    return "8h";
                                  }
                                  if (entry.startTime && entry.endTime) {
                                    const calculated = calculateHours(entry.startTime, entry.endTime);
                                    const hours = parseFloat(calculated);
                                    if (!isNaN(hours) && hours > 0) {
                                      return `${hours.toFixed(2)}h`;
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
                          </div>

                          {/* Kilometers field for work types 20 and 21 */}
                          {(entry.workType === "20" || entry.workType === "21") && (
                            <div>
                              <Label className="text-xs font-semibold">{t('weekly.kilometers')}</Label>
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                value={entry.kilometers || ""}
                                onChange={e => handleEntryChange(dayIdx, entryIdx, "kilometers", e.target.value)}
                                placeholder="0.0"
                                className="h-10 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mt-1"
                                disabled={isLocked}
                              />
                            </div>
                          )}
                                </div>
                              );
                            })}
                      
                      {/* Submitted entries (read-only with edit option) */}
                      {submitted.map((submittedEntry, subIdx) => (
                        <div key={`submitted-${dayIdx}-${subIdx}`} className="bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{getWorkTypeLabel(submittedEntry.workType || "")}</span>
                            {!isLocked && (
                              <div className="flex items-center gap-1">
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7"
                                  onClick={() => handleEditEntry(submittedEntry, dateStr)}
                                  title={t('common.edit')}
                                >
                                  <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7"
                                  onClick={() => handleDeleteEntry(submittedEntry.id!, dateStr)}
                                  title={t('common.delete')}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            <div><strong className="text-gray-900 dark:text-gray-200">{t('weekly.project')}:</strong> {submittedEntry.project || "-"}</div>
                            <div><strong className="text-gray-900 dark:text-gray-200">{t('weekly.time')}:</strong> {
                              submittedEntry.startTime && submittedEntry.endTime 
                                ? `${submittedEntry.startTime} - ${submittedEntry.endTime}`
                                : submittedEntry.workType === "31" && parseFloat(submittedEntry.hours || "0") >= 8
                                  ? t('weekly.fullDayOff') || "Hele dag vrij (8 uren)"
                                  : "-"
                            }</div>
                            <div><strong className="text-gray-900 dark:text-gray-200">{t('weekly.hours')}:</strong> {submittedEntry.hours || "0"}h</div>
                            {(submittedEntry.workType === "20" || submittedEntry.workType === "21") && (
                              <div><strong className="text-gray-900 dark:text-gray-200">{t('weekly.kilometers')}:</strong> {submittedEntry.kilometers ? `${submittedEntry.kilometers} km` : "-"}</div>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {/* Total for mobile */}
                      <div className="bg-gray-200 dark:bg-gray-700 rounded-lg border-2 border-gray-400 dark:border-gray-600 p-3 font-bold">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm sm:text-base text-gray-900 dark:text-gray-100">{t('weekly.hours')}:</span>
                          <span className="text-sm sm:text-base text-gray-900 dark:text-gray-100">
                            {calculateDayTotal(dayIdx, dateStr).toFixed(2)}h
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm sm:text-base text-gray-900 dark:text-gray-100">{t('weekly.kilometers')}:</span>
                          <span className="text-sm sm:text-base text-gray-900 dark:text-gray-100">
                            {(() => {
                              const kmTotal = calculateDayKilometersTotal(dayIdx, dateStr);
                              return kmTotal > 0 ? `${kmTotal.toFixed(1)} km` : "-";
                            })()}
                          </span>
                        </div>
                      </div>
                            </div>
                          </div>
                        );
                      })()}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })()}
                    </Accordion>
                  </>
                );
              })()}
            </div>
          ) : (
            // Desktop layout - no accordion
            <div className="space-y-2 sm:space-y-4">
              {days.map((day, dayIdx) => {
              const dateStr = formatDateToYYYYMMDD(day.date);
              
              // Check if there's a fullDayOff entry for this day (in editable or submitted entries)
              // A fullDayOff entry is either:
              // 1. An editable entry with workType "31" and fullDayOff checked
              // 2. A submitted entry with workType "31" and 8 hours (which indicates full day off)
              const hasFullDayOff = day.entries.some(e => e.workType === "31" && e.fullDayOff) ||
                (submittedEntries[dateStr] || []).some(e => {
                  if (e.workType === "31") {
                    // Check if it's a full day off: either has fullDayOff property or has 8 hours
                    return e.fullDayOff || parseFloat(e.hours || "0") === 8;
                  }
                  return false;
                });
              
              const submitted = (submittedEntries[dateStr] || []).sort((a, b) => {
                // Sort by startTime (ascending)
                const timeA = (a.startTime || "").trim();
                const timeB = (b.startTime || "").trim();
                
                // If both have startTime, sort by time
                if (timeA && timeB) {
                  // Convert time strings to comparable numbers (HH:MM -> minutes since midnight)
                  const parseTime = (timeStr: string): number => {
                    const parts = timeStr.split(':');
                    if (parts.length !== 2) return 0;
                    const hours = parseInt(parts[0], 10) || 0;
                    const minutes = parseInt(parts[1], 10) || 0;
                    return hours * 60 + minutes;
                  };
                  
                  return parseTime(timeA) - parseTime(timeB);
                }
                
                // If only one has startTime, put the one with startTime first
                if (timeA && !timeB) return -1;
                if (!timeA && timeB) return 1;
                
                // If neither has startTime, maintain original order
                return 0;
              });
              const isDayLocked = isLocked;
              const locale = language === 'nl' ? 'nl-NL' : 'en-GB';
              const dayName = day.date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
              const dayShort = day.date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
              const dayColors = [
                'bg-blue-50 border-blue-200 dark:', // Monday
                'bg-green-50 border-green-200', // Tuesday
                'bg-yellow-50 border-yellow-200', // Wednesday
                'bg-purple-50 border-purple-200', // Thursday
                'bg-pink-50 border-pink-200', // Friday
                'bg-gray-50 border-gray-200', // Saturday
                'bg-slate-50 border-slate-200', // Sunday
              ];
              const dayColor = dayColors[day.date.getDay() === 0 ? 6 : day.date.getDay() - 1];
              
              return (
                <div key={dayIdx} className={`border-2 rounded-md sm:rounded-lg ${dayColor} overflow-hidden`}>
                  {/* Day Header */}
                  <div className={`px-2 sm:px-4 py-1.5 sm:py-3 border-b-2 ${dayColor.replace('50', '200')} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2`}>
                    <div className="flex items-center gap-1.5 sm:gap-3">
                      <h3 className="font-bold text-sm sm:text-lg text-gray-800 dark:text-gray-900">{isMobile ? dayShort : dayName}</h3>
                      {!isMobile && <span className="text-sm text-gray-600 dark:text-gray-900">({dayShort})</span>}
                    </div>
                    {!isLocked && (
                      <div className={`flex gap-1.5 sm:gap-2 ${isMobile ? 'w-full' : ''}`}>
                        {dayIdx > 0 && (
                          <Button 
                            variant="outline" 
                            size={isMobile ? "sm" : "sm"}
                            className={`${isMobile ? 'h-7 text-xs flex-1' : 'h-7 text-xs'}`}
                            onClick={() => handleCopyFromPreviousDay(dayIdx)}
                            disabled={hasFullDayOff}
                          >
                            {t('weekly.copyPrevious')}
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size={isMobile ? "sm" : "sm"}
                          className={`${isMobile ? 'h-7 text-xs flex-1' : 'h-7 text-xs'}`}
                          onClick={() => handleAddEntry(dayIdx)}
                          disabled={hasFullDayOff}
                          title={hasFullDayOff ? "Je hebt deze dag als volledige vrije dag gemarkeerd. Je kunt geen extra entries toevoegen." : ""}
                        >
                          <Plus className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
                          {t('weekly.addEntry')}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Stayed overnight checkbox */}
                  <div className={`px-2 sm:px-4 py-1.5 sm:py-2 border-b ${dayColor.replace('50', '200')} flex items-center justify-between`}>
                    <div className="flex items-center space-x-1.5 sm:space-x-2">
                      <Checkbox
                        id={`stayedOvernight-simple-${dayIdx}`}
                        checked={!!day.stayedOvernight}
                        onCheckedChange={(checked) => {
                          persistOvernightStay(dayIdx, checked === true);
                        }}
                        disabled={isDayLocked}
                      />
                      <Label
                        htmlFor={`stayedOvernight-simple-${dayIdx}`}
                        className="text-xs sm:text-sm font-medium cursor-pointer text-gray-800 dark:text-gray-900"
                      >
                        {t('weekly.overnightStay')}
                      </Label>
                    </div>
                  </div>
                  
                  {/* Mobile: Card Layout, Desktop: Table Layout */}
                  {isMobile ? (
                    <div className="p-2 sm:p-4 space-y-2 sm:space-y-3">
                      {/* Editable entries - only show if week is not locked */}
                      {/* If there's a fullDayOff entry, only show that entry */}
                      {!isLocked && day.entries
                        .filter((entry, entryIdx) => {
                          // If there's a fullDayOff entry, only show that one
                          if (hasFullDayOff) {
                            return entry.workType === "31" && entry.fullDayOff;
                          }
                          return true;
                        })
                        .map((entry, entryIdx) => {
                        const isNewEntry = !entry.id;
                        const isEditing = entry.id && editingEntry?.id === entry.id;
                        return (
                        <div key={`edit-${dayIdx}-${entryIdx}`} className={`rounded-md sm:rounded-lg border border-gray-300 dark:border-gray-700 p-2 sm:p-3 space-y-2 sm:space-y-3 ${isEditing ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700' : 'bg-white dark:bg-gray-800'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              {isEditing && (
                                <span className="text-xs bg-yellow-500 text-white px-1.5 py-0.5 rounded font-semibold">{t('weekly.editing')}</span>
                              )}
                              <Label className="text-xs font-semibold text-gray-900 dark:text-gray-100">{t('weekly.workType')}</Label>
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <Button 
                                variant="default" 
                                size="sm"
                                className={`${isMobile ? 'h-6 px-2' : 'h-7 px-3'} text-xs bg-green-600 hover:bg-green-700`}
                                onClick={() => handleSaveEntry(dayIdx, entryIdx)}
                                disabled={isLocked}
                              >
                                {t('common.save')}
                              </Button>
                              {day.entries.length > 1 && (
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  className={`${isMobile ? 'h-6 w-6' : 'h-7 w-7'} text-xs`}
                                  onClick={() => handleRemoveEntry(dayIdx, entryIdx)}
                                  disabled={isLocked}
                                >
                                  -
                                </Button>
                              )}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs font-semibold">{t('weekly.workType')}</Label>
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
                                  className={`w-full justify-between ${isMobile ? 'h-8' : 'h-10'} text-xs sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mt-1`}
                                  disabled={isLocked}
                                >
                                  {entry.workType 
                                    ? `${entry.workType} - ${workTypes.find(t => String(t.value) === entry.workType)?.label || ""}`
                                    : t('weekly.selectWorkType')}
                                  <ChevronsUpDown className={`ml-2 ${isMobile ? 'h-3 w-3' : 'h-4 w-4'} shrink-0 opacity-50`} />
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

                          <div>
                            <Label className="text-xs font-semibold">{t('weekly.project')}</Label>
                            <div className="mt-1">
                              <Popover
                                open={openProjectPopovers[`${dayIdx}-${entryIdx}`] || false}
                                onOpenChange={(open) => {
                                  const key = `${dayIdx}-${entryIdx}`;
                                  setOpenProjectPopovers(prev => ({ ...prev, [key]: open }));
                                  if (!open) {
                                    setProjectSearchValues(prev => ({ ...prev, [key]: "" }));
                                  }
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={`w-full justify-between ${isMobile ? 'h-8' : 'h-10'} text-xs sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
                                    disabled={isLocked || entry.workType === "31" || entry.workType === "35"}
                                  >
                                    {entry.project || t('weekly.selectProject')}
                                    <ChevronsUpDown className={`ml-2 ${isMobile ? 'h-3 w-3' : 'h-4 w-4'} shrink-0 opacity-50`} />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                  <Command>
                                    <CommandInput
                                      placeholder="Search project or type to create new..."
                                      value={projectSearchValues[`${dayIdx}-${entryIdx}`] || ""}
                                      onValueChange={(value) => {
                                        const key = `${dayIdx}-${entryIdx}`;
                                        setProjectSearchValues(prev => ({ ...prev, [key]: value }));
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && projectSearchValues[`${dayIdx}-${entryIdx}`]) {
                                          const searchValue = projectSearchValues[`${dayIdx}-${entryIdx}`];
                                          if (searchValue && !projects.some(p => p.name.toLowerCase() === searchValue.toLowerCase())) {
                                            e.preventDefault();
                                            handleAddNewProject(searchValue, dayIdx, entryIdx);
                                          }
                                        }
                                      }}
                                    />
                                    <CommandList>
                                      <CommandEmpty>
                                        {projectSearchValues[`${dayIdx}-${entryIdx}`] ? (
                                          <div className="py-2 px-4">
                                            <div className="text-sm text-muted-foreground mb-2">
                                              No project found. Press Enter to create "{projectSearchValues[`${dayIdx}-${entryIdx}`]}"
                                            </div>
                                            <Button
                                              size="sm"
                                              className="w-full"
                                              onClick={() => {
                                                const searchValue = projectSearchValues[`${dayIdx}-${entryIdx}`];
                                                if (searchValue) {
                                                  handleAddNewProject(searchValue, dayIdx, entryIdx);
                                                }
                                              }}
                                            >
                                              Add "{projectSearchValues[`${dayIdx}-${entryIdx}`]}"
                                            </Button>
                                          </div>
                                        ) : (
                                          "No projects found."
                                        )}
                                      </CommandEmpty>
                                      <CommandGroup>
                                        {projects
                                          .filter(project =>
                                            !projectSearchValues[`${dayIdx}-${entryIdx}`] ||
                                            project.name.toLowerCase().includes(projectSearchValues[`${dayIdx}-${entryIdx}`].toLowerCase())
                                          )
                                          .map((project) => (
                                            <CommandItem
                                              key={project.id}
                                              value={project.name}
                                              onSelect={() => {
                                                handleEntryChange(dayIdx, entryIdx, "project", project.name);
                                                const key = `${dayIdx}-${entryIdx}`;
                                                setOpenProjectPopovers(prev => ({ ...prev, [key]: false }));
                                                setProjectSearchValues(prev => ({ ...prev, [key]: "" }));
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  entry.project === project.name ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              {project.name}
                                            </CommandItem>
                                          ))}
                                        {projectSearchValues[`${dayIdx}-${entryIdx}`] &&
                                          !projects.some(p =>
                                            p.name.toLowerCase() === projectSearchValues[`${dayIdx}-${entryIdx}`].toLowerCase()
                                          ) && (
                                            <CommandItem
                                              value={projectSearchValues[`${dayIdx}-${entryIdx}`]}
                                              onSelect={() => {
                                                const searchValue = projectSearchValues[`${dayIdx}-${entryIdx}`];
                                                if (searchValue) {
                                                  handleAddNewProject(searchValue, dayIdx, entryIdx);
                                                }
                                              }}
                                              className="text-blue-600 font-medium"
                                            >
                                              <Plus className="mr-2 h-4 w-4" />
                                              {t('weekly.create')} "{projectSearchValues[`${dayIdx}-${entryIdx}`]}"
                                            </CommandItem>
                                          )}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>

                          {/* Full Day Off checkbox for work type 31 */}
                          {entry.workType === "31" && (
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`fullDayOff-${dayIdx}-${entryIdx}`}
                                checked={entry.fullDayOff || false}
                                onCheckedChange={(checked) => {
                                  const isFullDay = checked === true;
                                  handleEntryChange(dayIdx, entryIdx, "fullDayOff", isFullDay);
                                  if (isFullDay) {
                                    // Set times to 08:00 - 16:30, but hours to 8 (minus 0.5 hour break)
                                    handleEntryChange(dayIdx, entryIdx, "startTime", "08:00");
                                    handleEntryChange(dayIdx, entryIdx, "endTime", "16:30");
                                    handleEntryChange(dayIdx, entryIdx, "hours", "8");
                                    
                                    // Remove all other entries for this day (keep only this fullDayOff entry)
                                    setDays(prevDays => prevDays.map((d, i) => {
                                      if (i !== dayIdx) return d;
                                      // Keep only the current entry (the fullDayOff one)
                                      return {
                                        ...d,
                                        entries: [d.entries[entryIdx]]
                                      };
                                    }));
                                  } else {
                                    // Clear times and hours when unchecking
                                    handleEntryChange(dayIdx, entryIdx, "startTime", "");
                                    handleEntryChange(dayIdx, entryIdx, "endTime", "");
                                    handleEntryChange(dayIdx, entryIdx, "hours", "");
                                  }
                                }}
                                disabled={isLocked}
                              />
                              <Label 
                                htmlFor={`fullDayOff-${dayIdx}-${entryIdx}`}
                                className="text-xs font-medium cursor-pointer"
                              >
                                {t('weekly.fullDayOff') || 'Hele dag vrij (8 uren)'}
                              </Label>
                            </div>
                          )}

                          <div className={`grid grid-cols-3 ${isMobile ? 'gap-1.5' : 'gap-2'}`}>
                            <div>
                              <Label className="text-xs font-semibold">{t('weekly.from')}</Label>
                              <Input
                                type="text"
                                value={entry.startTime || ""}
                                onChange={e => handleEntryChange(dayIdx, entryIdx, "startTime", roundToQuarterHour(e.target.value))}
                                placeholder="08:00"
                                className={`${isMobile ? 'h-8 text-xs' : 'h-10 text-sm'} bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mt-1`}
                                disabled={isLocked}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold">{t('weekly.to')}</Label>
                              <Input
                                type="text"
                                value={entry.endTime || ""}
                                onChange={e => handleEntryChange(dayIdx, entryIdx, "endTime", roundToQuarterHour(e.target.value))}
                                placeholder="17:00"
                                className={`${isMobile ? 'h-8 text-xs' : 'h-10 text-sm'} bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mt-1`}
                                disabled={isLocked}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold">{t('weekly.hours')}</Label>
                              <div className={`${isMobile ? 'h-8 text-xs' : 'h-10 text-sm'} flex items-center justify-center bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 font-medium text-gray-900 dark:text-gray-100 mt-1`}>
                                {(() => {
                                  // If full day off is checked, show 8 hours
                                  if (entry.workType === "31" && entry.fullDayOff) {
                                    return "8h";
                                  }
                                  if (entry.startTime && entry.endTime) {
                                    const calculated = calculateHours(entry.startTime, entry.endTime);
                                    const hours = parseFloat(calculated);
                                    if (!isNaN(hours) && hours > 0) {
                                      return `${hours.toFixed(2)}h`;
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
                          </div>

                          {/* Kilometers field for work types 20 and 21 */}
                          {(entry.workType === "20" || entry.workType === "21") && (
                            <div>
                              <Label className="text-xs font-semibold">{t('weekly.kilometers')}</Label>
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                value={entry.kilometers || ""}
                                onChange={e => handleEntryChange(dayIdx, entryIdx, "kilometers", e.target.value)}
                                placeholder="0.0"
                                className="h-10 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mt-1"
                                disabled={isLocked}
                              />
                            </div>
                          )}
                        </div>
                      );
                      })}
                      
                      {/* Submitted entries (read-only with edit option) */}
                      {submitted.map((submittedEntry, subIdx) => (
                        <div key={`submitted-${dayIdx}-${subIdx}`} className="bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{getWorkTypeLabel(submittedEntry.workType || "")}</span>
                            {!isLocked && (
                              <div className="flex items-center gap-1">
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7"
                                  onClick={() => handleEditEntry(submittedEntry, dateStr)}
                                  title={t('common.edit')}
                                >
                                  <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7"
                                  onClick={() => handleDeleteEntry(submittedEntry.id!, dateStr)}
                                  title={t('common.delete')}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            <div><strong className="text-gray-900 dark:text-gray-200">{t('weekly.project')}:</strong> {submittedEntry.project || "-"}</div>
                            <div><strong className="text-gray-900 dark:text-gray-200">{t('weekly.time')}:</strong> {
                              submittedEntry.startTime && submittedEntry.endTime 
                                ? `${submittedEntry.startTime} - ${submittedEntry.endTime}`
                                : submittedEntry.workType === "31" && parseFloat(submittedEntry.hours || "0") >= 8
                                  ? t('weekly.fullDayOff') || "Hele dag vrij (8 uren)"
                                  : "-"
                            }</div>
                            <div><strong className="text-gray-900 dark:text-gray-200">{t('weekly.hours')}:</strong> {submittedEntry.hours || "0"}h</div>
                            {(submittedEntry.workType === "20" || submittedEntry.workType === "21") && (
                              <div><strong className="text-gray-900 dark:text-gray-200">{t('weekly.kilometers')}:</strong> {submittedEntry.kilometers ? `${submittedEntry.kilometers} km` : "-"}</div>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {/* Total for mobile */}
                      <div className="bg-gray-200 dark:bg-gray-700 rounded-lg border-2 border-gray-400 dark:border-gray-600 p-3 font-bold">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm sm:text-base text-gray-900 dark:text-gray-900">{t('weekly.hours')}:</span>
                          <span className="text-sm sm:text-base text-gray-900 dark:text-gray-100">
                            {calculateDayTotal(dayIdx, dateStr).toFixed(2)}h
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm sm:text-base text-gray-900 dark:text-gray-900">{t('weekly.kilometers')}:</span>
                          <span className="text-sm sm:text-base text-gray-900 dark:text-gray-100">
                            {(() => {
                              const kmTotal = calculateDayKilometersTotal(dayIdx, dateStr);
                              return kmTotal > 0 ? `${kmTotal.toFixed(1)} km` : "-";
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Desktop: Table Layout */
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse">
                        <thead>
                          <tr className="bg-white/50 dark:bg-gray-800/50">
                            <th className="border border-gray-300 dark:border-gray-700 p-2 text-left min-w-[120px] text-gray-900 dark:text-gray-100">{t('weekly.workType')}</th>
                            <th className="border border-gray-300 dark:border-gray-700 p-2 text-left min-w-[150px] text-gray-900 dark:text-gray-100">{t('weekly.project')}</th>
                            <th className="border border-gray-300 dark:border-gray-700 p-2 text-left min-w-[80px] text-gray-900 dark:text-gray-100">{t('weekly.from')}</th>
                            <th className="border border-gray-300 dark:border-gray-700 p-2 text-left min-w-[80px] text-gray-900 dark:text-gray-100">{t('weekly.to')}</th>
                            <th className="border border-gray-300 dark:border-gray-700 p-2 text-left min-w-[80px] text-gray-900 dark:text-gray-100">{t('weekly.hours')}</th>
                            <th className="border border-gray-300 dark:border-gray-700 p-2 text-left min-w-[100px] text-gray-900 dark:text-gray-100">{t('weekly.kilometers')}</th>
                            {!isLocked && <th className="border border-gray-300 dark:border-gray-700 p-2 text-center min-w-[50px] text-gray-900 dark:text-gray-100">{t('weekly.actions')}</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {/* Editable entries - only show if week is not locked */}
                          {/* If there's a fullDayOff entry, only show that entry */}
                          {!isLocked && day.entries
                            .filter((entry, entryIdx) => {
                              // If there's a fullDayOff entry, only show that one
                              if (hasFullDayOff) {
                                return entry.workType === "31" && entry.fullDayOff;
                              }
                              return true;
                            })
                            .map((entry, entryIdx) => {
                            const isNewEntry = !entry.id;
                            const isEditing = entry.id && editingEntry?.id === entry.id;
                            return (
                            <tr key={`edit-${dayIdx}-${entryIdx}`} className={`border-t border-gray-300 dark:border-gray-700 hover:bg-white/50 dark:hover:bg-gray-700/50 ${isEditing ? 'bg-yellow-50/50 dark:bg-yellow-900/20' : 'bg-white/30 dark:bg-gray-800/30'}`}>
                              <td className="border border-gray-300 dark:border-gray-700 p-2">
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2">
                                    {isEditing && (
                                      <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded font-semibold">EDITING</span>
                                    )}
                                  </div>
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
                                        className="w-full justify-between h-9 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                        disabled={isLocked}
                                      >
                                        {entry.workType 
                                          ? `${entry.workType} - ${workTypes.find(t => String(t.value) === entry.workType)?.label || ""}`
                                          : t('weekly.selectWorkType')}
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
                              </td>
                              <td className="border border-gray-300 dark:border-gray-700 p-2">
                                <Popover
                                  open={openProjectPopovers[`${dayIdx}-${entryIdx}`] || false}
                                  onOpenChange={(open) => {
                                    const key = `${dayIdx}-${entryIdx}`;
                                    setOpenProjectPopovers(prev => ({ ...prev, [key]: open }));
                                    if (!open) {
                                      setProjectSearchValues(prev => ({ ...prev, [key]: "" }));
                                    }
                                  }}
                                >
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className="w-full justify-between h-9 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                      disabled={isLocked || entry.workType === "31" || entry.workType === "35"}
                                    >
                                      {entry.project || t('weekly.selectProject')}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                    <Command>
                                      <CommandInput
                                        placeholder={t('weekly.searchProject')}
                                        value={projectSearchValues[`${dayIdx}-${entryIdx}`] || ""}
                                        onValueChange={(value) => {
                                          const key = `${dayIdx}-${entryIdx}`;
                                          setProjectSearchValues(prev => ({ ...prev, [key]: value }));
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && projectSearchValues[`${dayIdx}-${entryIdx}`]) {
                                            const searchValue = projectSearchValues[`${dayIdx}-${entryIdx}`];
                                            if (searchValue && !projects.some(p => p.name.toLowerCase() === searchValue.toLowerCase())) {
                                              e.preventDefault();
                                              handleAddNewProject(searchValue, dayIdx, entryIdx);
                                            }
                                          }
                                        }}
                                      />
                                      <CommandList>
                                        <CommandEmpty>
                                          {projectSearchValues[`${dayIdx}-${entryIdx}`] ? (
                                            <div className="py-2 px-4">
                                              <div className="text-sm text-muted-foreground mb-2">
                                                {t('weekly.noProjectFound')} "{projectSearchValues[`${dayIdx}-${entryIdx}`]}"
                                              </div>
                                              <Button
                                                size="sm"
                                                className="w-full"
                                                onClick={() => {
                                                  const searchValue = projectSearchValues[`${dayIdx}-${entryIdx}`];
                                                  if (searchValue) {
                                                    handleAddNewProject(searchValue, dayIdx, entryIdx);
                                                  }
                                                }}
                                              >
                                                {t('weekly.add')} "{projectSearchValues[`${dayIdx}-${entryIdx}`]}"
                                              </Button>
                                            </div>
                                          ) : (
                                            t('weekly.noProjectsFound')
                                          )}
                                        </CommandEmpty>
                                        <CommandGroup>
                                          {projects
                                            .filter(project =>
                                              !projectSearchValues[`${dayIdx}-${entryIdx}`] ||
                                              project.name.toLowerCase().includes(projectSearchValues[`${dayIdx}-${entryIdx}`].toLowerCase())
                                            )
                                            .map((project) => (
                                              <CommandItem
                                                key={project.id}
                                                value={project.name}
                                                onSelect={() => {
                                                  handleEntryChange(dayIdx, entryIdx, "project", project.name);
                                                  const key = `${dayIdx}-${entryIdx}`;
                                                  setOpenProjectPopovers(prev => ({ ...prev, [key]: false }));
                                                  setProjectSearchValues(prev => ({ ...prev, [key]: "" }));
                                                }}
                                              >
                                                <Check
                                                  className={cn(
                                                    "mr-2 h-4 w-4",
                                                    entry.project === project.name ? "opacity-100" : "opacity-0"
                                                  )}
                                                />
                                                {project.name}
                                              </CommandItem>
                                            ))}
                                          {projectSearchValues[`${dayIdx}-${entryIdx}`] &&
                                            !projects.some(p =>
                                              p.name.toLowerCase() === projectSearchValues[`${dayIdx}-${entryIdx}`].toLowerCase()
                                            ) && (
                                              <CommandItem
                                                value={projectSearchValues[`${dayIdx}-${entryIdx}`]}
                                                onSelect={() => {
                                                  const searchValue = projectSearchValues[`${dayIdx}-${entryIdx}`];
                                                  if (searchValue) {
                                                    handleAddNewProject(searchValue, dayIdx, entryIdx);
                                                  }
                                                }}
                                                className="text-blue-600 font-medium"
                                              >
                                                <Plus className="mr-2 h-4 w-4" />
                                                {t('weekly.create')} "{projectSearchValues[`${dayIdx}-${entryIdx}`]}"
                                              </CommandItem>
                                            )}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                                {/* Full Day Off checkbox for work type 31 */}
                                {entry.workType === "31" && (
                                  <div className="flex items-center space-x-2 mt-2">
                                    <Checkbox
                                      id={`fullDayOff-desktop-${dayIdx}-${entryIdx}`}
                                      checked={entry.fullDayOff || false}
                                      onCheckedChange={(checked) => {
                                        const isFullDay = checked === true;
                                        handleEntryChange(dayIdx, entryIdx, "fullDayOff", isFullDay);
                                        if (isFullDay) {
                                          // Set times to 08:00 - 16:30, but hours to 8 (minus 0.5 hour break)
                                          handleEntryChange(dayIdx, entryIdx, "startTime", "08:00");
                                          handleEntryChange(dayIdx, entryIdx, "endTime", "16:30");
                                          handleEntryChange(dayIdx, entryIdx, "hours", "8");
                                          
                                          // Remove all other entries for this day (keep only this fullDayOff entry)
                                          setDays(prevDays => prevDays.map((d, i) => {
                                            if (i !== dayIdx) return d;
                                            // Keep only the current entry (the fullDayOff one)
                                            return {
                                              ...d,
                                              entries: [d.entries[entryIdx]]
                                            };
                                          }));
                                        } else {
                                          // Clear times and hours when unchecking
                                          handleEntryChange(dayIdx, entryIdx, "startTime", "");
                                          handleEntryChange(dayIdx, entryIdx, "endTime", "");
                                          handleEntryChange(dayIdx, entryIdx, "hours", "");
                                        }
                                      }}
                                      disabled={isLocked}
                                    />
                                    <Label 
                                      htmlFor={`fullDayOff-desktop-${dayIdx}-${entryIdx}`}
                                      className="text-xs font-medium cursor-pointer"
                                    >
                                      {t('weekly.fullDayOff') || 'Hele dag vrij (8 uren)'}
                                    </Label>
                                  </div>
                                )}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-700 p-2">
                                <Input
                                  type="text"
                                  value={entry.startTime || ""}
                                  onChange={e => handleEntryChange(dayIdx, entryIdx, "startTime", roundToQuarterHour(e.target.value))}
                                  placeholder="08:00"
                                  className="h-9 text-sm w-24 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                  disabled={isLocked}
                                />
                              </td>
                              <td className="border border-gray-300 dark:border-gray-700 p-2">
                                <Input
                                  type="text"
                                  value={entry.endTime || ""}
                                  onChange={e => handleEntryChange(dayIdx, entryIdx, "endTime", roundToQuarterHour(e.target.value))}
                                  placeholder="17:00"
                                  className="h-9 text-sm w-24 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                  disabled={isLocked}
                                />
                              </td>
                              <td className="border border-gray-300 dark:border-gray-700 p-2">
                                <div className="h-9 flex items-center justify-center bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {(() => {
                                    // If full day off is checked, show 8 hours
                                    if (entry.workType === "31" && entry.fullDayOff) {
                                      return "8.00h";
                                    }
                                    if (entry.startTime && entry.endTime) {
                                      const calculated = calculateHours(entry.startTime, entry.endTime);
                                      const hours = parseFloat(calculated);
                                      if (!isNaN(hours) && hours > 0) {
                                        return `${hours.toFixed(2)}h`;
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
                              <td className="border border-gray-300 dark:border-gray-700 p-2">
                                {(entry.workType === "20" || entry.workType === "21") ? (
                                  <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={entry.kilometers || ""}
                                    onChange={e => handleEntryChange(dayIdx, entryIdx, "kilometers", e.target.value)}
                                    placeholder="0.0"
                                    className="h-9 text-sm w-24 bg-white dark:bg-gray-800 text-white-900 dark:text-gray-100"
                                    disabled={isLocked}
                                  />
                                ) : (
                                  <div className="h-9 flex items-center justify-center text-gray-400 text-sm">-</div>
                                )}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-700 p-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button 
                                    variant="default" 
                                    size="sm"
                                    className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700"
                                    onClick={() => handleSaveEntry(dayIdx, entryIdx)}
                                    disabled={isLocked}
                                  >
                                    {t('common.save')}
                                  </Button>
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
                                </div>
                              </td>
                            </tr>
                          );
                          })}
                          
                          {/* Submitted entries (read-only with edit option) */}
                          {submitted.map((submittedEntry, subIdx) => (
                            <tr key={`submitted-${dayIdx}-${subIdx}`} className="border-t bg-gray-100/50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700">
                              <td className="border border-gray-300 dark:border-gray-700 p-2">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{getWorkTypeLabel(submittedEntry.workType || "")}</span>
                              </td>
                              <td className="border border-gray-300 dark:border-gray-700 p-2">
                                <span className="text-sm text-gray-900 dark:text-gray-100">{submittedEntry.project || "-"}</span>
                              </td>
                              <td className="border border-gray-300 dark:border-gray-700 p-2">
                                <span className="text-sm text-gray-900 dark:text-gray-100">{submittedEntry.startTime || "-"}</span>
                              </td>
                              <td className="border border-gray-300 dark:border-gray-700 p-2">
                                <span className="text-sm text-gray-900 dark:text-gray-100">{submittedEntry.endTime || "-"}</span>
                              </td>
                              <td className="border border-gray-300 dark:border-gray-700 p-2">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{submittedEntry.hours || "0"}</span>
                              </td>
                              <td className="border border-gray-300 dark:border-gray-700 p-2">
                                <span className="text-sm text-gray-900 dark:text-gray-100">
                                  {(submittedEntry.workType === "20" || submittedEntry.workType === "21") 
                                    ? (submittedEntry.kilometers ? `${submittedEntry.kilometers} km` : "-")
                                    : "-"}
                                </span>
                              </td>
                              {!isLocked && (
                                <td className="border border-gray-300 dark:border-gray-700 p-2 text-center">
                                  <div className="flex justify-center gap-1">
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-8 w-8"
                                      onClick={() => handleEditEntry(submittedEntry, dateStr)}
                                      title={t('common.edit')}
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
                                </td>
                              )}
                            </tr>
                          ))}
                          
                          {/* Total row */}
                          <tr className="border-t-2 border-gray-400 dark:border-gray-600 bg-gray-100 dark:border-gray-800 font-bold">
                            <td className="border border-gray-300 dark:border-gray-700 p-2 text-right" colSpan={4}>
                              <span className="text-sm sm:text-base text-gray-900 dark:text-gray-900">{t('daily.total') || 'Totaal per dag'}:</span>
                            </td>
                            <td className="border border-gray-300 dark:border-gray-700 p-2">
                              <span className="text-sm sm:text-base text-gray-900 dark:text-gray-900">
                                {calculateDayTotal(dayIdx, dateStr).toFixed(2)}h
                              </span>
                            </td>
                            <td className="border border-gray-300 dark:border-gray-700 p-2">
                              <span className="text-sm sm:text-base text-gray-900 dark:text-gray-900">
                                {(() => {
                                  const kmTotal = calculateDayKilometersTotal(dayIdx, dateStr);
                                  return kmTotal > 0 ? `${kmTotal.toFixed(1)} km` : "-";
                                })()}
                              </span>
                            </td>
                            {!isLocked && <td className="border p-2"></td>}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </CardContent>
      </Card>
      
      {/* Confirm Week Button */}
      {!isLocked && (
        <Card className="mt-4 bg-orange-50 border-orange-200 dark:bg-gray-900 border-orange-600">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="text-sm text-white-800">
                <strong>Note:</strong> {t('weekly.confirmNote') || 'Once you confirm this week, you will no longer be able to make changes. Please make sure all entries are correct before confirming.'}
              </div>
              {!hasSubmittedEntries() && (
                <div className="text-sm text-red-600 dark:text-red-400 font-semibold">
                  ⚠️ {t('weekly.fill.all.entries')}
                </div>
              )}
              <Button 
                className="w-full bg-orange-600 hover:bg-orange-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed" 
                variant="default" 
                onClick={handleConfirmWeek}
                disabled={!hasSubmittedEntries()}
              >
                <strong>{t('weekly.confirm') || 'Confirm Week'}</strong>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Week Confirmed Message */}
      {isLocked && (
        <Card className="mt-4 bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="text-blue-800 font-semibold">
              {t('weekly.weekLockedMessage')}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Send Email Dialog - shown after week confirmation for all users */}
      <Dialog open={showSendEmailDialog} onOpenChange={setShowSendEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('weekly.weekConfirmed')}</DialogTitle>
            <DialogDescription>
              {t('weekly.weekConfirmedSendEmailPrompt')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowSendEmailDialog(false)}
              disabled={sendingEmail}
            >
              {t('weekly.skip')}
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={async () => {
                setShowSendEmailDialog(false);
                const success = await handleSendWeekToEmail(true);
                if (success) {
                  // Refresh status to update email_sent_at in UI
                  await fetchConfirmedStatus();
                }
              }}
              disabled={sendingEmail}
            >
              {sendingEmail ? (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  {t('weekly.sendingEmail')}
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  {t('weekly.sendWeekToEmail')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Action Button for Mobile - Quick Entry */}
      {isMobile && (
        <>
          <Button
            onClick={() => {
              setQuickEntryDayIdx(activeDayIdx);
              setFabDialogOpen(true);
            }}
            className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full bg-orange-600 hover:bg-orange-700 text-white shadow-lg"
            size="icon"
          >
            <Plus className="h-6 w-6" />
          </Button>

          {/* Quick Entry Dialog/Sheet */}
          <Sheet open={fabDialogOpen} onOpenChange={setFabDialogOpen}>
            <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>
                  {t('weekly.addEntry')} -{" "}
                  {(weekDates[quickEntryDayIdx] || new Date()).toLocaleDateString(language === 'nl' ? 'nl-NL' : 'en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </SheetTitle>
                <SheetDescription>
                  {t('weekly.quickEntryDescription') || 'Quickly add an entry for a day in this week'}
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-4 space-y-4">
                {/* Day */}
                <div>
                  <Label className="text-xs font-semibold mb-1 block">{t('weekly.date') || 'Date'}</Label>
                  <Select
                    value={String(quickEntryDayIdx)}
                    onValueChange={(v) => setQuickEntryDayIdx(parseInt(v, 10) || 0)}
                  >
                    <SelectTrigger className="h-10 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {weekDates.map((d, idx) => (
                        <SelectItem key={formatDateToYYYYMMDD(d)} value={String(idx)}>
                          {d.toLocaleDateString(language === 'nl' ? 'nl-NL' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Work Type */}
                <div>
                  <Label className="text-xs font-semibold mb-1 block">{t('weekly.workType')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between h-10 text-sm"
                      >
                        {quickEntry.workType 
                          ? `${quickEntry.workType} - ${workTypes.find(t => String(t.value) === quickEntry.workType)?.label || ""}`
                          : t('weekly.selectWorkType')}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <CommandInput placeholder={t('weekly.searchWorkType')} />
                        <CommandList>
                          <CommandEmpty>{t('weekly.noWorkTypeFound')}</CommandEmpty>
                          <CommandGroup>
                            {workTypes.map((type) => (
                              <CommandItem
                                key={type.value}
                                value={String(type.value)}
                                onSelect={() => {
                                  setQuickEntry(prev => ({ ...prev, workType: String(type.value) }));
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    quickEntry.workType === String(type.value) ? "opacity-100" : "opacity-0"
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

                {/* Project - only show if work type requires it */}
                {workTypeRequiresProject(quickEntry.workType) && (
                  <div>
                    <Label className="text-xs font-semibold mb-1 block">{t('weekly.project')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between h-10 text-sm"
                          disabled={quickEntry.workType === "31" || quickEntry.workType === "35"}
                        >
                          {quickEntry.project || t('weekly.selectProject')}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                        <Command>
                          <CommandInput placeholder="Search project..." />
                          <CommandList>
                            <CommandEmpty>No project found.</CommandEmpty>
                            <CommandGroup>
                              {projects.map((project) => (
                                <CommandItem
                                  key={project.id}
                                  value={project.name}
                                  onSelect={() => {
                                    setQuickEntry(prev => ({ ...prev, project: project.name }));
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      quickEntry.project === project.name ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {project.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Start Time */}
                <div>
                  <Label className="text-xs font-semibold mb-1 block">{t('weekly.from')}</Label>
                  <Input
                    type="text"
                    value={quickEntry.startTime}
                    onChange={e => setQuickEntry(prev => ({ ...prev, startTime: roundToQuarterHour(e.target.value) }))}
                    placeholder="08:00"
                    className="h-10 text-sm"
                  />
                </div>

                {/* End Time */}
                <div>
                  <Label className="text-xs font-semibold mb-1 block">{t('weekly.to')}</Label>
                  <Input
                    type="text"
                    value={quickEntry.endTime}
                    onChange={e => setQuickEntry(prev => ({ ...prev, endTime: roundToQuarterHour(e.target.value) }))}
                    placeholder="17:00"
                    className="h-10 text-sm"
                  />
                </div>

                {/* Calculated Hours */}
                {quickEntry.startTime && quickEntry.endTime && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <Label className="text-xs font-semibold mb-1 block">{t('weekly.hours')}</Label>
                    <div className="text-lg font-bold">
                      {(() => {
                        const calculated = calculateHours(quickEntry.startTime, quickEntry.endTime);
                        const hours = parseFloat(calculated);
                        return !isNaN(hours) && hours > 0 ? `${hours.toFixed(2)}h` : "-";
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <SheetFooter className="mt-6">
                <Button variant="outline" onClick={() => {
                  setFabDialogOpen(false);
                  setQuickEntry({ workType: "", project: "", startTime: "", endTime: "" });
                }}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleQuickEntry} className="bg-orange-600 hover:bg-orange-700">
                  {t('common.save')}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </>
      )}
      {currentUser && (
        <ShareEntryDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          shareType={shareType}
          shareDate={shareDate}
          entryCount={shareEntryCount}
          currentUserId={currentUser.id}
          onShareSuccess={handleShareSuccess}
          weekDates={shareType === 'week' ? weekDates : undefined}
          dayEntryCounts={shareType === 'week' ? getDayEntryCounts() : undefined}
        />
      )}
    </div>
  );
};

export default WeeklyCalendarEntrySimple;

