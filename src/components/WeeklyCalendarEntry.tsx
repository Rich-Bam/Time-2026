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
import { cn } from "@/lib/utils";

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
  // Work types 30-40 don't require a project
  return workTypeNum < 30 || workTypeNum > 40;
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

const WeeklyCalendarEntry = ({ currentUser, hasUnreadDaysOffNotification = false }: { currentUser: any; hasUnreadDaysOffNotification?: boolean }) => {
  const { t } = useLanguage();
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return getWeekDates(now)[0];
  });
  const [days, setDays] = useState(() => getWeekDates(new Date()).map(date => ({ date, entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "", fullDayOff: false }], open: true }))); // Default open for better overview
  const [viewMode, setViewMode] = useState<"cards" | "overview">("cards"); // View mode: cards (current) or overview (week table)
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const { toast } = useToast();
  const [dbDaysOff, setDbDaysOff] = useState(0);
  const [customProjects, setCustomProjects] = useState<Record<string, string>>({});
  const [submittedEntries, setSubmittedEntries] = useState<Record<string, any[]>>({});
  const [confirmedWeeks, setConfirmedWeeks] = useState<Record<string, boolean>>({});
  const [openWorkTypePopovers, setOpenWorkTypePopovers] = useState<Record<string, boolean>>({});
  const [workTypeSearchValues, setWorkTypeSearchValues] = useState<Record<string, string>>({});

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
    
    setSubmittedEntries(prev => ({ ...prev, [dateStr]: filteredData }));
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
        : [{ workType: "", project: "", hours: "", startTime: "", endTime: "" }]
    })));
  }, [weekStart]);

  const changeWeek = (delta: number) => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + delta * 7);
    setWeekStart(getWeekDates(newStart)[0]);
    setDays(getWeekDates(newStart).map(date => ({ date, entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "" }], open: false })));
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
    const weekKey = weekDates[0].toISOString().split('T')[0];
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
    const weekKey = weekDates[0].toISOString().split('T')[0];
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
    
    const weekKey = weekDates[0].toISOString().split('T')[0];
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
        // Only validate required fields for Mon-Fri
        if (!isWeekend && ((!entry.project && requiresProject) || !entry.workType || !entry.hours)) {
          toast({
            title: "Missing Information",
            description: `Please fill in all required fields for ${day.date.toLocaleDateString()}`,
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
        if (isWeekend && (!entry.project && !isDayOff) && !entry.workType && !entry.hours) {
          continue;
        }
        
        // Validate hours match start/end time if both are provided
        if (entry.startTime && entry.endTime && entry.hours) {
          const start = new Date(`2000-01-01T${entry.startTime}`);
          const end = new Date(`2000-01-01T${entry.endTime}`);
          const calculatedHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          const enteredHours = Number(entry.hours);
          const expectedHours = calculatedHours;
          
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
        date: day.date.toISOString().split('T')[0],
        hours: hoursToSave,
        description: entry.workType,
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
          ? { ...d, entries: [{ workType: "", project: "", hours: "", lunch: true, startTime: "", endTime: "" }] }
          : d
      ));
      await fetchSubmittedEntries(day.date.toISOString().split('T')[0]);
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

  const handleEditEntry = (entry: any, dateStr: string) => {
    const weekKey = weekDates[0].toISOString().split('T')[0];
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
    
    const dayIdx = days.findIndex(d => d.date.toISOString().split('T')[0] === dateStr);
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
    
    const previousDay = days[dayIdx - 1];
    const previousDateStr = previousDay.date.toISOString().split('T')[0];
    const previousSubmitted = submittedEntries[previousDateStr] || [];
    const currentDay = days[dayIdx];
    const currentDateStr = currentDay.date.toISOString().split('T')[0];
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
          endTime: e.endTime || ""
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
      } else if (entry.hours) {
        hoursToSave = Number(entry.hours);
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
          <h2 className="text-2xl font-bold">{t('weekly.title')}</h2>
          <div className="mt-1 text-gray-700 dark:text-gray-300 font-medium">
            {t('weekly.week')} {weekNumber} ({weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()})
          </div>
          <div className="flex items-center gap-4 mt-2">
            <Button variant="outline" onClick={() => changeWeek(-1)}>&lt; {t('weekly.prev')}</Button>
            <Button variant="outline" onClick={() => changeWeek(1)}>{t('weekly.next')} &gt;</Button>
            <Button variant="outline" onClick={handleExportWeek} className="ml-2">
              <Download className="h-4 w-4 mr-2" />
              {t('weekly.exportWeek')}
            </Button>
          </div>
        </div>
        <Card className={`bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 min-w-[260px] ${hasUnreadDaysOffNotification ? 'ring-2 ring-orange-400 ring-offset-2' : ''}`}>
          <CardHeader>
            <CardTitle className="text-blue-900 dark:text-blue-100 text-lg flex items-center justify-between">
              <span>{t('weekly.daysOffRemaining')}</span>
              {hasUnreadDaysOffNotification && (
                <div className="flex items-center gap-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-2 py-0.5 rounded-full text-xs font-semibold animate-pulse">
                  <span>⚠️</span>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
              {daysOffLeft} <span className="text-lg">({hoursLeftRounded} {t('weekly.hours')})</span>
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400 mt-2">
              {t('weekly.daysOffLeft', { days: daysOffLeft })}
              {hasUnreadDaysOffNotification && (
                <span className="block mt-1 text-orange-600 dark:text-orange-400 font-semibold">⚠️ Updated!</span>
              )}
            </div>
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
                    className={`border rounded-lg p-2 cursor-pointer transition-colors ${day.open ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700' : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'}`} 
                    onClick={() => handleOpenDay(dayIdx)}
                  >
                    <div className="font-semibold text-center text-sm">{day.date.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                    <div className="font-medium text-center text-xs">{day.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
                    <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">{totalEntries} {totalEntries === 1 ? t('weekly.entry') : t('weekly.entries')}</div>
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
                {viewMode === "cards" ? `📊 ${t('weekly.weekOverview')}` : `📋 ${t('weekly.dayView')}`}
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
                    const dateStr = day.date.toISOString().split('T')[0];
                    const submitted = submittedEntries[dateStr] || [];
                    const isLocked = confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin;
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
              {!confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && (
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
            <div key={dayIdx} className="mb-4 border rounded-lg p-4 bg-white shadow">
              <div className="font-semibold mb-2">{day.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</div>
              {confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin && (
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
                          setWorkTypeSearchValues(prev => ({ ...prev, [key]: "" }));
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                          disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
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
                            <CommandEmpty>No work type found.</CommandEmpty>
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
                        disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
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
                          disabled={!workTypeRequiresProject(entry.workType) || (confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin)}
                        />
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleEntryChange(dayIdx, entryIdx, "project", "")}
                          disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
                        >
                          {t('weekly.clear')}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Select
                          value={entry.project}
                          onValueChange={val => handleEntryChange(dayIdx, entryIdx, "project", val)}
                          disabled={!workTypeRequiresProject(entry.workType) || (confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin)}
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
                            disabled={entry.workType === "31" || (confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin)}
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="ml-2"
                            onClick={() => handleAddCustomProject(dayIdx, entryIdx)}
                            disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
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
                      disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
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
                      disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
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
                    disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
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
                    disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
                  >
                    {t('weekly.copyPrevious')}
                  </Button>
                )}
                <Button 
                  variant="default" 
                  onClick={() => handleSubmitDay(dayIdx)}
                  disabled={confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && !currentUser?.isAdmin}
                >
                  {t('weekly.submitDay')}
                </Button>
              </div>
              {submittedEntries[day.date.toISOString().split('T')[0]] && submittedEntries[day.date.toISOString().split('T')[0]].length > 0 && (
                <div className="mt-4">
                  <div className="font-semibold text-sm mb-1 text-gray-700">{t('weekly.submittedEntries')}</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs border rounded">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-1 border">{t('weekly.project')}</th>
                          <th className="p-1 border">{t('weekly.workType')}</th>
                          <th className="p-1 border">{t('weekly.hours')}</th>
                          {!confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && (
                            <th className="p-1 border">{t('weekly.actions')}</th>
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
                                <div className="flex gap-1">
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => handleEditEntry(entry, day.date.toISOString().split('T')[0])}
                                    title={t('common.edit')}
                                  >
                                    <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => handleDeleteEntry(entry.id, day.date.toISOString().split('T')[0])}>
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
      {!confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && (
        <Card className="mt-4 bg-orange-50 border-orange-200">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="text-sm text-orange-800">
                <strong>{t('common.note')}:</strong> {t('weekly.confirmWeekText')}
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
      {confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && (
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