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
  const [editingEntry, setEditingEntry] = useState<{ id: number; dateStr: string } | null>(null);
  const [openProjectPopovers, setOpenProjectPopovers] = useState<Record<string, boolean>>({});
  const [projectSearchValues, setProjectSearchValues] = useState<Record<string, string>>({});
  
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
      const { data: newProject, error } = await supabase
        .from("projects")
        .insert([{
          name: projectName.trim(),
          status: "active",
          user_id: currentUser?.id || null,
        }])
        .select("id, name")
        .single();

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
      entries: [{ workType: "", project: "", hours: "", startTime: "", endTime: "" }] 
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
    if (!isDayOff && (!entry.workType || (!entry.project && !isDayOff) || (!entry.startTime && !entry.endTime))) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: "Please enter valid start and end times",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Check if this entry is being edited (has an id)
      if (entry.id) {
        // Update existing entry in database
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
        fetchSubmittedEntries(dateStr);
      } else {
        // Create new entry
        const { data: newEntry, error } = await supabase.from("timesheet").insert([{
          project: isDayOff ? null : entry.project,
          user_id: currentUser.id,
          date: dateStr,
          hours: hoursToSave,
          description: entry.workType,
          startTime: entry.startTime || null,
          endTime: entry.endTime || null,
        }]).select("id").single();
        
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
        
        fetchSubmittedEntries(dateStr);
      }
      
      // Add a new empty entry
      setDays(prevDays => prevDays.map((d, i) => {
        if (i !== dayIdx) return d;
        return {
          ...d,
          entries: [...d.entries, { workType: "", project: "", hours: "", startTime: "", endTime: "" }]
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
    const weekKeyCheck = weekDates[0].toISOString().split('T')[0];
    if (confirmedWeeks[weekKeyCheck]) {
      return;
    }
    
    await supabase.from('timesheet').delete().eq('id', entryId);
    fetchSubmittedEntries(dateStr);
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
              Export Excel
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
              const submitted = (submittedEntries[dateStr] || []).sort((a, b) => {
                // Sort by startTime (ascending)
                const timeA = (a.startTime || "00:00").trim();
                const timeB = (b.startTime || "00:00").trim();
                
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
              const isDayLocked = isLocked;
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
                    {!isLocked && (
                      <Button 
                        variant="outline" 
                        size={isMobile ? "sm" : "sm"}
                        className={`${isMobile ? 'h-8 text-xs w-full' : 'h-7 text-xs'}`}
                        onClick={() => handleAddEntry(dayIdx)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Entry
                      </Button>
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
                              <Label className="text-xs font-semibold">Work Type</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="default" 
                                size="sm"
                                className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700"
                                onClick={() => handleSaveEntry(dayIdx, entryIdx)}
                                disabled={isLocked}
                              >
                                Save
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
                                    disabled={entry.workType === "31" || isLocked}
                                  >
                                    {entry.project || "Select project..."}
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
                                              Create "{projectSearchValues[`${dayIdx}-${entryIdx}`]}"
                                            </CommandItem>
                                          )}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
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
                                {(() => {
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
                        <div key={`submitted-${dayIdx}-${subIdx}`} className="bg-gray-100 rounded-lg border p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{getWorkTypeLabel(submittedEntry.workType || "")}</span>
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
                            {!isLocked && <th className="border p-2 text-center min-w-[50px]">Action</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {/* Editable entries - only show if week is not locked */}
                          {!isLocked && day.entries.map((entry, entryIdx) => {
                            const isNewEntry = !entry.id;
                            const isEditing = entry.id && editingEntry?.id === entry.id;
                            return (
                            <tr key={`edit-${dayIdx}-${entryIdx}`} className={`border-t hover:bg-white/50 ${isEditing ? 'bg-yellow-50/50' : 'bg-white/30'}`}>
                              <td className="border p-2">
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2">
                                    {isEditing && (
                                      <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded font-semibold">EDITING</span>
                                    )}
                                  </div>
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
                                </div>
                              </td>
                              <td className="border p-2">
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
                                      className="w-full justify-between h-9 text-sm bg-white"
                                      disabled={entry.workType === "31" || isLocked}
                                    >
                                      {entry.project || "Select project..."}
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
                                                Create "{projectSearchValues[`${dayIdx}-${entryIdx}`]}"
                                              </CommandItem>
                                            )}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
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
                                  {(() => {
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
                              <td className="border p-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button 
                                    variant="default" 
                                    size="sm"
                                    className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700"
                                    onClick={() => handleSaveEntry(dayIdx, entryIdx)}
                                    disabled={isLocked}
                                  >
                                    Save
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
                              {!isLocked && (
                                <td className="border p-2 text-center">
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
                                </td>
                              )}
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

