import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Trash2, Download, Plus, Check, ChevronsUpDown } from 'lucide-react';
import { useIsMobile } from "@/hooks/use-mobile";
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

interface Entry {
  id?: number;
  workType: string;
  project: string;
  hours: string;
  startTime: string;
  endTime: string;
  isSubmitted?: boolean;
  fullDayOff?: boolean;
}

interface DayData {
  date: Date;
  entries: Entry[];
}

const WeeklyCalendarEntrySimple = ({ currentUser }: { currentUser: any }) => {
  const { t, language } = useLanguage();
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
      entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "", fullDayOff: false }] 
    }))
  );
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [submittedEntries, setSubmittedEntries] = useState<Record<string, Entry[]>>({});
  const [confirmedWeeks, setConfirmedWeeks] = useState<Record<string, boolean>>({});
  const [dbDaysOff, setDbDaysOff] = useState(0);
  const [customProjectInputs, setCustomProjectInputs] = useState<Record<string, string>>({});
  const [editingEntry, setEditingEntry] = useState<{ id: number; dateStr: string } | null>(null);
  const [openProjectPopovers, setOpenProjectPopovers] = useState<Record<string, boolean>>({});
  const [projectSearchValues, setProjectSearchValues] = useState<Record<string, string>>({});
  const [openWorkTypePopovers, setOpenWorkTypePopovers] = useState<Record<string, boolean>>({});
  const [workTypeSearchValues, setWorkTypeSearchValues] = useState<Record<string, string>>({});
  
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

  // Fetch submitted entries
  const fetchSubmittedEntries = async (dateStr: string) => {
    if (!currentUser) return;
    const { data } = await supabase
      .from("timesheet")
      .select("id, project, hours, description, date, startTime, endTime")
      .eq("user_id", currentUser.id)
      .eq("date", dateStr);
    if (data) {
      // Filter out admin adjustments (entries without startTime/endTime are admin adjustments)
      // Only show entries that have both startTime and endTime - these are user-created entries
      // Admin adjustments don't have startTime/endTime and should not be shown in weekly entry
      const filteredData = data.filter(e => e.startTime && e.endTime);
      
      setSubmittedEntries(prev => ({ 
        ...prev, 
        [dateStr]: filteredData.map(e => ({
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
  const fetchConfirmedStatus = async () => {
    if (!currentUser) return;
    const weekKey = weekDates[0].toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('confirmed_weeks')
      .select('confirmed, admin_approved')
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
  };

  useEffect(() => {
    fetchConfirmedStatus();
  }, [currentUser, weekStart]);

  const changeWeek = (delta: number) => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + delta * 7);
    setWeekStart(getWeekDates(newStart)[0]);
    setDays(getWeekDates(newStart).map(date => ({ 
      date, 
      entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "", fullDayOff: false }] 
    })));
  };

  const handleAddEntry = (dayIdx: number) => {
    const weekKeyCheck = weekDates[0].toISOString().split('T')[0];
    if (confirmedWeeks[weekKeyCheck]) {
      return;
    }
    
    setDays(days.map((day, i) =>
      i === dayIdx 
        ? { ...day, entries: [...day.entries, { workType: "", project: "", hours: "", startTime: "", endTime: "" }] }
        : day
    ));
  };

  const handleRemoveEntry = (dayIdx: number, entryIdx: number) => {
    const weekKeyCheck = weekDates[0].toISOString().split('T')[0];
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
    const weekKeyCheck = weekDates[0].toISOString().split('T')[0];
    if (confirmedWeeks[weekKeyCheck]) {
      return; // Silently ignore changes if week is locked
    }
    
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
      
      return updatedDays;
    });
  };
  
  // Save a single entry and add a new entry
  const handleSaveEntry = async (dayIdx: number, entryIdx: number) => {
    if (!currentUser) return;
    
    const weekKeyCheck = weekDates[0].toISOString().split('T')[0];
    if (confirmedWeeks[weekKeyCheck]) {
      return;
    }
    
    const day = days[dayIdx];
    if (!day) return;
    
    const entry = day.entries[entryIdx];
    if (!entry) return;
    const dateStr = day.date.toISOString().split('T')[0];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entryDate = new Date(day.date);
    entryDate.setHours(0, 0, 0, 0);
    
    // Don't save future dates
    if (entryDate > today) {
      toast({
        title: "Error",
        description: "Cannot save entries for future dates",
        variant: "destructive",
      });
      return;
    }
    
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
          project: isDayOff ? null : entry.project,
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
          project: isDayOff ? null : entry.project,
          user_id: currentUser.id,
          date: dateStr,
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
      
      // Add a new empty entry
      setDays(prevDays => prevDays.map((d, i) => {
        if (i !== dayIdx) return d;
        return {
          ...d,
          entries: [...d.entries, { workType: "", project: "", hours: "", startTime: "", endTime: "", fullDayOff: false }]
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
  
  // Edit an existing entry
  const handleEditEntry = (entry: Entry, dateStr: string) => {
    const weekKeyCheck = weekDates[0].toISOString().split('T')[0];
    if (confirmedWeeks[weekKeyCheck]) {
      return;
    }
    
    const dayIdx = days.findIndex(d => d.date.toISOString().split('T')[0] === dateStr);
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
    
    // Add hours from submitted entries
    const submitted = submittedEntries[dateStr] || [];
    submitted.forEach(submittedEntry => {
      const hours = parseFloat(submittedEntry.hours || "0") || 0;
      total += hours;
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
      } else if (entry.hours) {
        hoursToSave = Number(entry.hours);
      }
      
      // For day off (31), hours can be 0, but for other types we need valid hours
      if (hoursToSave <= 0 && !isDayOff) {
        continue; // Skip entries with invalid hours
      }
      
      entriesToSave.push({
        project: isDayOff ? null : entry.project,
        user_id: currentUser.id,
        date: currentDateStr,
        hours: hoursToSave,
        description: entry.workType,
        startTime: entry.startTime || null,
        endTime: entry.endTime || null,
      });
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
      // Check if any saved entries were day off entries and refresh days off
      const hasDayOffEntry = entriesToSave.some(e => e.description === "31");
      if (hasDayOffEntry) {
        await fetchDaysOff();
      }
      // Reset entries
      setDays(getWeekDates(weekStart).map(date => ({ 
        date, 
        entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "", fullDayOff: false }] 
      })));
    }
  };

  const handleDeleteEntry = async (entryId: number, dateStr: string) => {
    const weekKeyCheck = weekDates[0].toISOString().split('T')[0];
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
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
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
      .order("date", { ascending: true })
      .order("startTime", { ascending: true });

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

    // Group entries by day
    const entriesByDay: Record<string, any[]> = {};
    weekDates.forEach(date => {
      const dateStr = date.toISOString().split('T')[0];
      entriesByDay[dateStr] = data.filter(entry => entry.date === dateStr);
    });

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    const dayNamesEN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Create sheets for each day and store them with their day index for sorting
    const sheets: Array<{ dayIndex: number; dayName: string; ws: any }> = [];
    
    weekDates.forEach((date, dayIdx) => {
      const dateStr = date.toISOString().split('T')[0];
      const dayEntries = entriesByDay[dateStr] || [];
      const dayName = dayNamesEN[dayIdx];
      const formattedDate = formatDateDDMMYY(dateStr);
      
      // Calculate total hours for the day
      const totalHours = dayEntries.reduce((sum, entry) => sum + (parseFloat(entry.hours) || 0), 0);
      const totalHoursHHMM = formatHoursHHMM(totalHours);
      
      // Create header rows (similar to original template)
      // Layout: Logo space on right, info on left
      const headerRows = [
        ["Employee Name:", currentUser.name || currentUser.email || "", "", "", "", "", "", "", "BAMPRO"], // Logo space
        ["Date:", `From: ${formatDateDDMMYY(fromDate)}`, `To: ${formatDateDDMMYY(toDate)}`, "", "", "", "", "", ""],
        ["Day:", `${formattedDate} ${dayName}`, "", "", "", "", "", "", ""],
        ["Week Number:", weekNumber.toString(), "", "", "", "", "", "", ""],
        ["Year:", new Date().getFullYear().toString(), "", "", "", "", "", "", ""],
        [""], // Empty row
      ];

      // Create table headers
      const tableHeaders = [
        ["Day", "Work Type", "Project Work Order", "From", "To", "Hours Worked", "Project Leader", "Car Mileage", "Work Performed"]
      ];

      // Format data rows for this day
      const dataRows = dayEntries.map((entry) => [
        dayName,
        getWorkTypeLabel(entry.description || ""),
        entry.projects?.name || entry.project || "",
        entry.startTime || "",
        entry.endTime || "",
        formatHoursHHMM(parseFloat(entry.hours) || 0),
        "", // Projectleider - not in database yet
        "", // Km stand auto - not in database yet
        entry.notes || "",
      ]);

      // Add total hours row at the bottom
      const totalRow = [
        "",
        "Total:",
        "",
        "",
        "",
        totalHoursHHMM,
        "",
        "",
        "",
      ];

      // Combine all rows
      const allRows = [...headerRows, ...tableHeaders, ...dataRows, [""], totalRow];

      // Create worksheet from array
      const ws = XLSX.utils.aoa_to_sheet(allRows);

      // Set column widths
      ws['!cols'] = [
        { wch: 12 }, // Dag
        { wch: 20 }, // Soort werk
        { wch: 25 }, // Project Werkbon
        { wch: 8 },  // Van
        { wch: 8 },  // Tot
        { wch: 15 }, // Gewerkte uren
        { wch: 15 }, // Projectleider
        { wch: 12 }, // Km stand auto
        { wch: 35 }, // Uitgevoerde werkzaamheden
      ];

      // Store sheet with day index for sorting (dayIdx is already 0-6 for Monday-Sunday)
      sheets.push({ dayIndex: dayIdx, dayName, ws });
    });
    
    // Sort sheets by day index (Monday=0, Tuesday=1, ..., Sunday=6)
    sheets.sort((a, b) => a.dayIndex - b.dayIndex);
    
    // Append sheets to workbook in correct order (Monday to Sunday)
    sheets.forEach(({ dayName, ws }) => {
      XLSX.utils.book_append_sheet(wb, ws, dayName);
    });

    // Generate filename with user name and week number
    const userName = (currentUser.name || currentUser.email || "User").replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${userName}_Week${weekNumber}_${new Date(fromDate).getFullYear()}.xlsx`;
    XLSX.writeFile(wb, filename);

    toast({
      title: "Export Successful",
      description: `Week ${weekNumber} entries exported to ${filename} with ${weekDates.length} day sheets`,
    });
  };

  // Handle week confirmation
  const handleConfirmWeek = async () => {
    if (!currentUser) return;
    
    const weekKey = weekDates[0].toISOString().split('T')[0];
    
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
      // Immediately update state to lock the week - this will trigger a re-render and hide all editable elements
      const weekKeyDate = weekDates[0].toISOString().split('T')[0];
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
      
      toast({
        title: "Week Confirmed",
        description: "This week has been confirmed and locked. You can no longer make changes.",
      });
      
      // DON'T call fetchConfirmedStatus here - it might overwrite our state
      // The state is already set correctly above
    }
  };

  // Calculate isLocked directly from state for rendering
  // Week is locked if confirmed AND (user is not admin OR admin hasn't approved yet)
  // For simplicity: if confirmedWeeks[weekKey] is true, the week is locked (regardless of admin status)
  // Admins will need to use the admin panel to approve/unlock weeks
  const weekKey = weekDates[0].toISOString().split('T')[0];
  const isLocked = !!confirmedWeeks[weekKey];
  
  // Debug logging
  console.log('RENDER - isLocked calculation:', { 
    weekKey, 
    confirmedWeeksValue: confirmedWeeks[weekKey], 
    confirmedWeeksState: confirmedWeeks,
    isAdmin: currentUser?.isAdmin, 
    isLocked 
  });

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
            <Button variant="outline" size={isMobile ? "sm" : "default"} onClick={handleExportWeek} className="text-xs sm:text-sm">
              <Download className="h-4 w-4 mr-2" />
              {t('weekly.exportWeek')}
            </Button>
          </div>
        </div>
        <Card className="bg-blue-50 border-blue-200 w-full sm:w-auto sm:min-w-[200px]">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-blue-900 text-sm sm:text-lg">{t('weekly.daysOffRemaining')}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-blue-700">
              {daysOffLeft} <span className="text-base sm:text-lg">({(parseFloat(daysOffLeft) * 8).toFixed(1)} {t('weekly.hours')})</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLocked && (
        <div className="p-2 sm:p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-xs sm:text-sm">
          ⚠️ {t('weekly.confirmed')}
        </div>
      )}

      <Card>
        <CardContent className="p-2 sm:p-4">
          <div className="space-y-3 sm:space-y-4">
            {days.map((day, dayIdx) => {
              const dateStr = day.date.toISOString().split('T')[0];
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
                    {!isLocked && (
                      <div className={`flex gap-2 ${isMobile ? 'w-full' : ''}`}>
                        {dayIdx > 0 && (
                          <Button 
                            variant="outline" 
                            size={isMobile ? "sm" : "sm"}
                            className={`${isMobile ? 'h-8 text-xs flex-1' : 'h-7 text-xs'}`}
                            onClick={() => handleCopyFromPreviousDay(dayIdx)}
                          >
                            {t('weekly.copyPrevious')}
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size={isMobile ? "sm" : "sm"}
                          className={`${isMobile ? 'h-8 text-xs flex-1' : 'h-7 text-xs'}`}
                          onClick={() => handleAddEntry(dayIdx)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {t('weekly.addEntry')}
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {/* Mobile: Card Layout, Desktop: Table Layout */}
                  {isMobile ? (
                    <div className="p-2 sm:p-4 space-y-3">
                      {/* Editable entries - only show if week is not locked */}
                      {!isLocked && day.entries.map((entry, entryIdx) => {
                        const isNewEntry = !entry.id;
                        const isEditing = entry.id && editingEntry?.id === entry.id;
                        return (
                        <div key={`edit-${dayIdx}-${entryIdx}`} className={`rounded-lg border p-3 space-y-3 ${isEditing ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isEditing && (
                                <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded font-semibold">EDITING</span>
                              )}
                              <Label className="text-xs font-semibold">{t('weekly.workType')}</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="default" 
                                size="sm"
                                className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700"
                                onClick={() => handleSaveEntry(dayIdx, entryIdx)}
                                disabled={isLocked}
                              >
                                {t('common.save')}
                              </Button>
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
                                  className="w-full justify-between h-10 text-sm bg-white mt-1"
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
                                    className="w-full justify-between h-10 text-sm bg-white"
                                    disabled={!workTypeRequiresProject(entry.workType) || isLocked}
                                  >
                                    {entry.project || t('weekly.selectProject')}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs font-semibold">{t('weekly.from')}</Label>
                              <Input
                                type="text"
                                value={entry.startTime || ""}
                                onChange={e => handleEntryChange(dayIdx, entryIdx, "startTime", roundToQuarterHour(e.target.value))}
                                placeholder="08:00"
                                className="h-10 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mt-1"
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
                                className="h-10 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mt-1"
                                disabled={isLocked}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold">{t('weekly.hours')}</Label>
                              <div className="h-10 flex items-center justify-center bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
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
                        </div>
                      );
                      })}
                      
                      {/* Submitted entries (read-only with edit option) */}
                      {submitted.map((submittedEntry, subIdx) => (
                        <div key={`submitted-${dayIdx}-${subIdx}`} className="bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{getWorkTypeLabel(submittedEntry.workType || "")}</span>
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
                          </div>
                        </div>
                      ))}
                      
                      {/* Total for mobile */}
                      <div className="bg-gray-200 dark:bg-gray-700 rounded-lg border-2 border-gray-400 dark:border-gray-600 p-3 font-bold">
                        <div className="flex items-center justify-between">
                          <span className="text-sm sm:text-base text-gray-900 dark:text-gray-100">{t('weekly.total') || 'Totaal per dag'}:</span>
                          <span className="text-sm sm:text-base text-gray-900 dark:text-gray-100">
                            {calculateDayTotal(dayIdx, dateStr).toFixed(2)}h
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
                            {!isLocked && <th className="border border-gray-300 dark:border-gray-700 p-2 text-center min-w-[50px] text-gray-900 dark:text-gray-100">{t('weekly.actions')}</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {/* Editable entries - only show if week is not locked */}
                          {!isLocked && day.entries.map((entry, entryIdx) => {
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
                                        className="w-full justify-between h-9 text-sm bg-white"
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
                                      disabled={!workTypeRequiresProject(entry.workType) || isLocked}
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
                                                Create "{projectSearchValues[`${dayIdx}-${entryIdx}`]}"
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
                          <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold">
                            <td className="border p-2 text-right" colSpan={4}>
                              <span className="text-sm sm:text-base">{t('weekly total') || 'Totaal per dag'}:</span>
                            </td>
                            <td className="border p-2">
                              <span className="text-sm sm:text-base">
                                {calculateDayTotal(dayIdx, dateStr).toFixed(2)}h
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
        </CardContent>
      </Card>
      
      {/* Confirm Week Button */}
      {!isLocked && (
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
      
      {/* Week Confirmed Message */}
      {isLocked && (
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

export default WeeklyCalendarEntrySimple;

