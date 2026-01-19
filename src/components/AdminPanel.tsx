import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Calendar, Pencil, Check, X, Download, FileText, FileDown, Calendar as CalendarIcon, Users, Eye, AlertTriangle, Trash2, BarChart3, RefreshCw, Clock, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { createPDF } from "@/utils/pdfExport";
import { hashPassword } from "@/utils/password";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDateToYYYYMMDD } from "@/utils/dateUtils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

interface AdminPanelProps {
  currentUser: any;
  initialTab?: string;
  hideTabs?: boolean; // Hide the tab navigation when accessed from top banner
}

// Helper to get date range from week number and year (ISO week)
// Note: This function is now defined inside the component to avoid initialization order issues
// The duplicate definition inside the component will be used instead

// Helper functions for Excel export (matching WeeklyCalendarEntrySimple)
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


const AdminPanel = ({ currentUser, initialTab, hideTabs = false }: AdminPanelProps) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const isMobile = useIsMobile();
 
  // Break entries (work type 35) should never count as worked hours in totals/exports
  const isBreakEntry = (entry: any): boolean => String(entry?.description ?? "").trim() === "35";
  
  // Helper function to check if user is admin or administratie
  const isAdminOrAdministratie = (user: any): boolean => {
    return user?.isAdmin || user?.userType === 'administratie';
  };
  
  // Helper function to check if user is administratie type
  const isAdministratie = (user: any): boolean => {
    return user?.userType === 'administratie';
  };
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    userType: "user", // "super_admin", "admin", "user"
    must_change_password: true,
  });
  const [resetPassword, setResetPassword] = useState("");
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | number | null>(null);
  const [editingField, setEditingField] = useState<'email' | 'name' | null>(null);
  const [editedEmail, setEditedEmail] = useState<string>("");
  const [editedName, setEditedName] = useState<string>("");
  const [daysOffMap, setDaysOffMap] = useState<Record<string, number>>({});
  const [daysOffInput, setDaysOffInput] = useState<Record<string, string>>({});
  const [daysOffReasonInput, setDaysOffReasonInput] = useState<Record<string, string>>({});
  const [showDaysOffReasonDialog, setShowDaysOffReasonDialog] = useState(false);
  const [weekReviewDialog, setWeekReviewDialog] = useState<{
    open: boolean;
    userId: string;
    weekStartDate: string;
    userName: string;
    weekNumber: number;
    year: number;
  }>({ open: false, userId: "", weekStartDate: "", userName: "", weekNumber: 0, year: 0 });
  const [weekReviewComment, setWeekReviewComment] = useState<string>("");
  const [pendingDaysOffAction, setPendingDaysOffAction] = useState<{userId: string, hours: number} | null>(null);
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});
  const [confirmedWeeks, setConfirmedWeeks] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [reminderUserIds, setReminderUserIds] = useState<string[]>([]);
  const [reminderWeekNumber, setReminderWeekNumber] = useState<string>("");
  const [reminderYear, setReminderYear] = useState<string>(new Date().getFullYear().toString());
  const [timebuzzerSyncing, setTimebuzzerSyncing] = useState(false);
  
  // Error logs state (only for super admin)
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [errorLogsLoading, setErrorLogsLoading] = useState(false);
  const [errorLogsFilter, setErrorLogsFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
  const [errorLogsSeverity, setErrorLogsSeverity] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [errorLogsUserFilter, setErrorLogsUserFilter] = useState<string>('all');
  const [selectedErrorLog, setSelectedErrorLog] = useState<any | null>(null);
  const [errorLogNotes, setErrorLogNotes] = useState("");
  
  // Export state
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [selectedExportUserId, setSelectedExportUserId] = useState<string>("");
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  
  // Overtime tracking state
  const [overtimePeriod, setOvertimePeriod] = useState<"week" | "month" | "year" | "all">("month");
  const [overtimeSelectedUserId, setOvertimeSelectedUserId] = useState<string>("all");
  const [overtimeData, setOvertimeData] = useState<any[]>([]);
  const [overtimeLoading, setOvertimeLoading] = useState(false);
  const [overtimeSelectedWeek, setOvertimeSelectedWeek] = useState<string>("");
  const [overtimeSelectedMonth, setOvertimeSelectedMonth] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [overtimeSelectedYear, setOvertimeSelectedYear] = useState<string>(new Date().getFullYear().toString());
  
  // State for viewing week details
  const [selectedWeekForView, setSelectedWeekForView] = useState<{userId: string, weekStartDate: string} | null>(null);
  
  // Active tab state
  const [activeTab, setActiveTab] = useState<string>(initialTab || "users");
  
  // Update activeTab when initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  
  // State for confirmed weeks table: search, filters, sorting, pagination
  const [confirmedWeeksSearch, setConfirmedWeeksSearch] = useState<string>("");
  const [confirmedWeeksStatusFilter, setConfirmedWeeksStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [confirmedWeeksUserFilter, setConfirmedWeeksUserFilter] = useState<string>('all');
  const [confirmedWeeksSortBy, setConfirmedWeeksSortBy] = useState<'user' | 'week' | 'date' | 'hours' | 'status'>('date');
  const [confirmedWeeksSortOrder, setConfirmedWeeksSortOrder] = useState<'asc' | 'desc'>('desc');
  const [confirmedWeeksPage, setConfirmedWeeksPage] = useState<number>(1);
  const confirmedWeeksPerPage = 20;
  
  // UI-only hours taken overrides - ONLY affects the display in the "Hours Taken" column
  // Does NOT affect: database, weekly entries, days off calculations, or any other views
  // This is purely a visual override for the admin panel display only
  const [hoursTakenOverrides, setHoursTakenOverrides] = useState<Record<string, number>>({});
  const [editingHoursTaken, setEditingHoursTaken] = useState<Record<string, string>>({});
  
  // Helper function to get ISO week number
  const getISOWeekNumber = (date: Date) => {
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
  };

  // Helper to get the Monday of the ISO week for a given date
  const getISOWeekMonday = (date: Date): Date => {
    const tempDate = new Date(date.getTime());
    tempDate.setHours(0, 0, 0, 0);
    // Move to Thursday of the week (ISO week standard)
    tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
    // Get the Monday of that week (3 days before Thursday)
    const monday = new Date(tempDate);
    monday.setDate(tempDate.getDate() - 3);
    return monday;
  };


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

  // Helper to get day name (language-aware)
  // Kept as getDayNameNL because other parts of the file reference it.
  const getDayNameNL = (dateStr: string) => {
    const date = new Date(dateStr);
    const locale = language === 'nl' ? 'nl-NL' : 'en-US';
    return date.toLocaleDateString(locale, { weekday: 'long' });
  };

  // Helper to format date with day name (DD-MM-YYYY weekday)
  const formatDateWithDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const dayName = getDayNameNL(dateStr);
    return `${day}-${month}-${year} ${dayName}`;
  };

  // Helper to get work type label with code
  const getWorkTypeLabel = (desc: string) => {
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
    const workType = workTypes.find(wt => String(wt.value) === String(desc));
    return workType ? `${workType.value} - ${workType.label}` : desc;
  };

  const [timebuzzerSyncWeekNumber, setTimebuzzerSyncWeekNumber] = useState<number>(() => {
    // Get current ISO week number
    const today = new Date();
    return getISOWeekNumber(today);
  });
  const [timebuzzerSyncYear, setTimebuzzerSyncYear] = useState<number>(new Date().getFullYear());
  const [timebuzzerTestResult, setTimebuzzerTestResult] = useState<any>(null);
  const [timebuzzerActivities, setTimebuzzerActivities] = useState<any[]>([]);
  const [selectedActivityIds, setSelectedActivityIds] = useState<Set<number>>(new Set());
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedTimebuzzerUserId, setSelectedTimebuzzerUserId] = useState<string>(""); // For testing Timebuzzer per user
  const [timebuzzerUsers, setTimebuzzerUsers] = useState<any[]>([]);
  const [loadingTimebuzzerUsers, setLoadingTimebuzzerUsers] = useState(false);
  const [timebuzzerUserHours, setTimebuzzerUserHours] = useState<Record<number, any>>({});
  const [loadingUserHours, setLoadingUserHours] = useState<Record<number, boolean>>({});
  const [selectedUserForHours, setSelectedUserForHours] = useState<string>("");
  const [userActivitiesStatus, setUserActivitiesStatus] = useState<Record<number, { hasActivities: boolean; lastActivityDate?: string; totalActivities?: number }>>({});
  const [checkingAllActivities, setCheckingAllActivities] = useState(false);
  
  // Fetch projects for mapping
  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase.from("projects").select("id, name, timebuzzer_project_id");
      if (data) {
        setProjects(data);
      }
    };
    fetchProjects();
  }, []);

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    // Try to fetch with weekly_view_option, fallback if column doesn't exist
    let { data, error } = await supabase.from("users").select("id, email, name, isAdmin, must_change_password, approved, can_use_timebuzzer, timebuzzer_user_id, userType, weekly_view_option");
    
    // If error is about missing column, retry without it
    if (error && error.message?.includes('weekly_view_option')) {
      const fallbackResult = await supabase.from("users").select("id, email, name, isAdmin, must_change_password, approved, can_use_timebuzzer, timebuzzer_user_id, userType");
      if (fallbackResult.error) {
        toast({ title: "Error", description: fallbackResult.error.message, variant: "destructive" });
      } else {
        // Add default weekly_view_option to all users
        data = (fallbackResult.data || []).map((user: any) => ({
          ...user,
          weekly_view_option: 'both' // Default value
        }));
        error = null;
      }
    } else if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    
    if (!error) {
      setUsers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line
  }, []);

  // Build users map for quick lookup
  useEffect(() => {
    const map: Record<string, any> = {};
    users.forEach(u => { map[u.id] = u; });
    setUsersMap(map);
  }, [users]);

  // Fetch confirmed weeks that need admin review
  useEffect(() => {
    const fetchConfirmedWeeks = async () => {
      const { data } = await supabase
        .from('confirmed_weeks')
        .select('*')
        .eq('confirmed', true)
        .order('week_start_date', { ascending: false });
      setConfirmedWeeks(data || []);
    };
    fetchConfirmedWeeks();
    // Refresh every 30 seconds to catch new confirmations
    const interval = setInterval(fetchConfirmedWeeks, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch days off for all users
  useEffect(() => {
    const fetchDaysOff = async () => {
      const currentYear = new Date().getFullYear();
      const fromDate = `${currentYear}-01-01`;
      const toDate = `${currentYear}-12-31`;
      const { data, error } = await supabase
        .from("timesheet")
        .select("user_id, hours, description")
        .eq("description", "31")
        .gte("date", fromDate)
        .lte("date", toDate);
      if (data) {
        const map: Record<string, number> = {};
        data.forEach(e => {
          // Handle both string and number user_id
          const userId = String(e.user_id);
          map[userId] = (map[userId] || 0) + (parseFloat(String(e.hours)) || 0);
        });
        setDaysOffMap(map);
      }
    };
    fetchDaysOff();
  }, [users]);

  // Fetch all timesheet entries for all users
  useEffect(() => {
    const fetchAllEntries = async () => {
      const { data: entries } = await supabase
        .from("timesheet")
        .select("*, projects(name)")
        .order("date", { ascending: false });
      setAllEntries(entries || []);
      // Build project id->name map
      const { data: projects } = await supabase.from("projects").select("id, name");
      const map: Record<string, string> = {};
      (projects || []).forEach((p: any) => { map[p.id] = p.name; });
      setProjectsMap(map);
    };
    fetchAllEntries();
  }, [users]);

  // Calculate overtime hours
  const calculateOvertime = async () => {
    setOvertimeLoading(true);
    try {
      // Determine date range based on period
      let fromDate = "";
      let toDate = "";
      const now = new Date();
      
      if (overtimePeriod === "week") {
        if (!overtimeSelectedWeek || !overtimeSelectedYear) {
          toast({
            title: "Missing Information",
            description: "Please select a week and year.",
            variant: "destructive",
          });
          setOvertimeLoading(false);
          return;
        }
        const weekNum = parseInt(overtimeSelectedWeek);
        const year = parseInt(overtimeSelectedYear);
        const { from, to } = getWeekDateRange(weekNum, year);
        fromDate = from;
        toDate = to;
      } else if (overtimePeriod === "month") {
        const month = parseInt(overtimeSelectedMonth);
        const year = parseInt(overtimeSelectedYear);
        fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      } else if (overtimePeriod === "year") {
        const year = parseInt(overtimeSelectedYear);
        fromDate = `${year}-01-01`;
        toDate = `${year}-12-31`;
      } else {
        // All time - no date filter
        fromDate = "";
        toDate = "";
      }

      // Fetch timesheet + overnight stays (separate table so checkbox persists without entries)
      let timesheetQuery = supabase
        .from("timesheet")
        .select("user_id, date, hours, description, project, startTime, endTime, notes, stayed_overnight")
        .order("date", { ascending: true });

      let overnightQuery = supabase
        .from("overnight_stays")
        .select("user_id, date")
        .order("date", { ascending: true });
      
      if (fromDate && toDate) {
        timesheetQuery = timesheetQuery.gte("date", fromDate).lte("date", toDate);
        overnightQuery = overnightQuery.gte("date", fromDate).lte("date", toDate);
      }
      
      if (overtimeSelectedUserId && overtimeSelectedUserId !== "all") {
        timesheetQuery = timesheetQuery.eq("user_id", overtimeSelectedUserId);
        overnightQuery = overnightQuery.eq("user_id", overtimeSelectedUserId);
      }

      const [{ data, error }, { data: overnightData, error: overnightError }] = await Promise.all([
        timesheetQuery,
        overnightQuery,
      ]);
      
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        setOvertimeLoading(false);
        return;
      }

      if (overnightError) {
        toast({
          title: "Error",
          description: overnightError.message,
          variant: "destructive",
        });
        setOvertimeLoading(false);
        return;
      }

      // Group entries by user and date, and store detailed entry information
      const userDateMap: Record<string, Record<string, { totalHours: number; entries: any[]; stayedOvernight: boolean }>> = {};
      
      (data || []).forEach((entry: any) => {
        const userId = String(entry.user_id);
        const date = entry.date;
        
        if (!userDateMap[userId]) {
          userDateMap[userId] = {};
        }
        if (!userDateMap[userId][date]) {
          userDateMap[userId][date] = { totalHours: 0, entries: [], stayedOvernight: false };
        }

        if (entry.stayed_overnight) {
          userDateMap[userId][date].stayedOvernight = true;
        }
        
        // Only count work hours (not day off, sick, etc.)
        // Work types 10-29 and 100 are work hours
        const workType = parseInt(entry.description || "0");
        if ((workType >= 10 && workType <= 29) || workType === 100) {
          const hours = parseFloat(entry.hours || 0);
          userDateMap[userId][date].totalHours += hours;
          // Store entry details for breakdown
          userDateMap[userId][date].entries.push({
            project: entry.project || "-",
            workType: entry.description || "",
            workTypeLabel: getWorkTypeLabel(entry.description || ""),
            hours: hours.toFixed(2),
            startTime: entry.startTime || "-",
            endTime: entry.endTime || "-",
            notes: entry.notes || ""
          });
        }
      });

      // Calculate overtime per day with percentage breakdown
      // Overtime rules:
      // 1. After 8 hours on Monday-Friday: 9th and 10th hour = 125%
      // 2. After 10 hours on Monday-Friday: every hour = 150%
      // 3. ALL hours on Saturday = 150%
      // 4. ALL hours on Sunday = 200%
      const overtimeResults: any[] = [];
      
      const overnightByUser: Record<string, Set<string>> = {};
      (overnightData || []).forEach((r: any) => {
        const uid = String(r.user_id);
        if (!overnightByUser[uid]) overnightByUser[uid] = new Set<string>();
        overnightByUser[uid].add(String(r.date));
      });

      Object.keys(userDateMap).forEach(userId => {
        const user = users.find(u => String(u.id) === userId);
        if (!user) return;
        
        let totalOvertime = 0;
        let totalHours125 = 0; // 125% hours (9th and 10th hour on weekdays)
        let totalHours150 = 0; // 150% hours (after 10th hour on weekdays, all Saturday)
        let totalHours200 = 0; // 200% hours (all Sunday)
        const dailyOvertime: any[] = [];
        
        Object.keys(userDateMap[userId]).forEach(date => {
          const dayData = userDateMap[userId][date];
          const totalHours = dayData.totalHours;
          
          // Get day of week (0 = Sunday, 6 = Saturday)
          const dateObj = new Date(date);
          const dayOfWeek = dateObj.getDay();
          const isSaturday = dayOfWeek === 6;
          const isSunday = dayOfWeek === 0;
          const isWeekend = isSaturday || isSunday;
          
          let overtime = 0;
          let normalHours = 0;
          let hours125 = 0;
          let hours150 = 0;
          let hours200 = 0;
          
          if (isSunday) {
            // Sunday: ALL hours are 200%
            overtime = totalHours;
            normalHours = 0;
            hours200 = totalHours;
          } else if (isSaturday) {
            // Saturday: ALL hours are 150%
            overtime = totalHours;
            normalHours = 0;
            hours150 = totalHours;
          } else {
            // Weekday (Monday-Friday): calculate percentage breakdown
            normalHours = Math.min(totalHours, 8); // First 8 hours are normal
            const overtimeHours = totalHours > 8 ? totalHours - 8 : 0;
            
            if (overtimeHours > 0) {
              // 9th and 10th hour = 125%
              hours125 = Math.min(overtimeHours, 2);
              // Hours after 10th = 150%
              if (overtimeHours > 2) {
                hours150 = overtimeHours - 2;
              }
              overtime = overtimeHours;
            }
          }
          
          if (overtime > 0) {
            // Sort entries by startTime for better readability
            const sortedEntries = [...dayData.entries].sort((a, b) => {
              const timeA = a.startTime === "-" ? "99:99" : a.startTime;
              const timeB = b.startTime === "-" ? "99:99" : b.startTime;
              return timeA.localeCompare(timeB);
            });
            
            dailyOvertime.push({
              date,
              dayOfWeek: isWeekend ? (isSunday ? 'Sunday' : 'Saturday') : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][dayOfWeek - 1],
              totalHours: totalHours.toFixed(2),
              normalHours: normalHours.toFixed(2),
              overtime: overtime.toFixed(2),
              hours125: hours125.toFixed(2),
              hours150: hours150.toFixed(2),
              hours200: hours200.toFixed(2),
              isWeekend: isWeekend,
              isSaturday: isSaturday,
              isSunday: isSunday,
              entries: sortedEntries
            });
            totalOvertime += overtime;
            totalHours125 += hours125;
            totalHours150 += hours150;
            totalHours200 += hours200;
          }
        });

        const overnightFromTimesheet = Object.keys(userDateMap[userId]).filter(date => userDateMap[userId][date].stayedOvernight);
        const overnightFromTable = Array.from(overnightByUser[userId] || []);
        const overnightDates = Array.from(new Set([...overnightFromTimesheet, ...overnightFromTable])).sort((a, b) => a.localeCompare(b));
        
        if (totalOvertime > 0 || dailyOvertime.length > 0 || overnightDates.length > 0) {
          overtimeResults.push({
            userId,
            userName: user.name || user.email,
            userEmail: user.email,
            totalOvertime: totalOvertime.toFixed(2),
            totalHours125: totalHours125.toFixed(2),
            totalHours150: totalHours150.toFixed(2),
            totalHours200: totalHours200.toFixed(2),
            dailyOvertime: dailyOvertime.sort((a, b) => a.date.localeCompare(b.date)),
            overnightDates,
            totalOvernightStays: overnightDates.length,
          });
        }
      });
      
      // Sort by total overtime (descending)
      overtimeResults.sort((a, b) => parseFloat(b.totalOvertime) - parseFloat(a.totalOvertime));
      
      setOvertimeData(overtimeResults);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to calculate overtime",
        variant: "destructive",
      });
    } finally {
      setOvertimeLoading(false);
    }
  };

  // Add user (with optional invite via Supabase Edge Function)
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast({ 
        title: "Ontbrekende informatie", 
        description: "Email en wachtwoord zijn verplicht", 
        variant: "destructive" 
      });
      return;
    }
    
    // Validate password length
    if (form.password.length < 6) {
      toast({ 
        title: "Wachtwoord te kort", 
        description: "Wachtwoord moet minimaal 6 tekens lang zijn.", 
        variant: "destructive" 
      });
      return;
    }
    
    // Debug: Check environment variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    console.log("🔍 DEBUG INFO:");
    console.log("  Supabase URL:", supabaseUrl || "❌ MISSING!");
    console.log("  Anon Key:", anonKey ? "✅ Set" : "❌ MISSING!");
    
    if (!supabaseUrl || !anonKey) {
      toast({
        title: "❌ Configuratie Fout",
        description: `Environment variabelen ontbreken! URL: ${supabaseUrl ? "✅" : "❌"}, Key: ${anonKey ? "✅" : "❌"}. Check .env.local of Netlify settings.`,
        variant: "destructive",
      });
      // Continue with fallback anyway
    }
    
    // First try Edge Function for email invite - using Supabase client to avoid CORS issues
    try {
      console.log("🔵 Calling Edge Function via Supabase client...");
      console.log("🔵 Email:", form.email);
      console.log("🔵 Name:", form.name || form.email);
      console.log("🔵 UserType:", form.userType);
      
      // Use Supabase client's functions.invoke() method - this handles auth and CORS automatically
      console.log("🔵 Calling supabase.functions.invoke('invite-user')...");
      
      const isAdmin = form.userType === 'admin' || form.userType === 'super_admin';
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: form.email,
          name: form.name || form.email,
          isAdmin: isAdmin,
        },
      });
      
      console.log("🔵 Edge Function response:", { data, error });
      console.log("🔵 Error details:", error ? {
        message: error.message,
        name: error.name,
        context: error.context,
        status: error.status,
        statusCode: error.statusCode,
        fullError: JSON.stringify(error, null, 2)
      } : "No error");

      if (!error && data?.success) {
        console.log("✅ Edge Function success:", data);
      toast({
          title: "Uitnodiging verstuurd",
          description: `Een uitnodigingsemail is verstuurd naar ${form.email}. Check je inbox (en spam folder) voor de uitnodigingslink.`,
      });
      setForm({ email: "", name: "", password: "", userType: "user", must_change_password: true });
      fetchUsers();
        return;
      }
      
      // If Edge Function fails, show error and try direct user creation
      console.error("❌ Edge Function failed:", { data, error });
      
      // Show specific error to user
      if (error) {
        const errorMsg = error.message || JSON.stringify(error);
        const errorStatus = error.status || error.statusCode;
        
        if (errorMsg.includes("404") || errorMsg.includes("not found") || errorStatus === 404) {
          toast({
            title: "⚠️ Edge Function niet gevonden (404)",
            description: "De 'invite-user' function is NIET gedeployed in Supabase. Open Supabase Dashboard → Edge Functions → Functions → Create 'invite-user' function. Gebruiker wordt nu aangemaakt zonder email.",
            variant: "destructive",
          });
        } else if (errorMsg.includes("401") || errorMsg.includes("403") || errorMsg.includes("unauthorized") || errorStatus === 401 || errorStatus === 403) {
          toast({
            title: "⚠️ Toegang geweigerd (401/403)",
            description: "Check of VITE_SUPABASE_ANON_KEY correct is in Netlify environment variables. Gebruiker wordt nu aangemaakt zonder email.",
            variant: "destructive",
          });
        } else if (errorMsg.includes("Failed to send") || errorMsg.includes("network") || errorMsg.includes("fetch")) {
          toast({
            title: "⚠️ Netwerkfout",
            description: `Kon Edge Function niet bereiken: ${errorMsg}\n\nCheck Supabase Dashboard → Edge Functions → Functions → invite-user bestaat\nGebruiker wordt nu aangemaakt zonder email.`,
            variant: "destructive",
          });
        } else {
          let errorMessage = errorMsg;
          if (errorMessage.includes("already registered") || errorMessage.includes("already exists")) {
            errorMessage = "Dit email adres is al geregistreerd in Supabase Auth.";
          } else if (errorMessage.includes("email service") || errorMessage.includes("email")) {
            errorMessage = "Supabase email service probleem. Check Authentication → Email Templates.";
          }
          toast({
            title: "⚠️ Email kon niet worden verstuurd",
            description: `${errorMessage}. Druk F12 → Console voor details. Gebruiker wordt nu aangemaakt zonder email.`,
            variant: "destructive",
          });
        }
      } else if (data?.error) {
        let errorMessage = data.error;
        if (errorMessage.includes("already registered") || errorMessage.includes("already exists")) {
          errorMessage = "Dit email adres is al geregistreerd in Supabase Auth.";
        } else if (errorMessage.includes("email service") || errorMessage.includes("email")) {
          errorMessage = "Supabase email service probleem. Check Authentication → Email Templates.";
        }
        toast({
          title: "⚠️ Email kon niet worden verstuurd",
          description: `${errorMessage}. Druk F12 → Console voor details. Gebruiker wordt nu aangemaakt zonder email.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "⚠️ Edge Function Error",
          description: `Onverwachte response: ${JSON.stringify(data)}. Druk F12 → Console voor details. Gebruiker wordt nu aangemaakt zonder email.`,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("❌ Edge Function network error, falling back:", err);
      let errorMessage = err.message || "Unknown error";
      if (err.message?.includes("Failed to fetch") || err.message?.includes("network")) {
        errorMessage = "Kon Edge Function niet bereiken. Check of de function gedeployed is in Supabase Dashboard → Edge Functions → Functions.";
      }
      toast({
        title: "⚠️ Netwerkfout",
        description: `${errorMessage}. Gebruiker wordt nu aangemaakt zonder email.`,
        variant: "destructive",
      });
    }
    
    // Fallback: create user directly (no email sent)
    // Hash password before storing
    const hashedPassword = await hashPassword(form.password);
    const isAdmin = form.userType === 'admin' || form.userType === 'super_admin';
    const { error: insertError } = await supabase.from("users").insert([
      {
        email: form.email,
        name: form.name || form.email,
        password: hashedPassword, // Store hashed password
        isAdmin: isAdmin,
        userType: form.userType, // Store user type
        must_change_password: form.must_change_password,
        approved: true, // Admins can create users directly, so they're auto-approved
      },
    ]);
    
    if (insertError) {
      toast({
        title: "Fout bij aanmaken gebruiker",
        description: insertError.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Gebruiker aangemaakt",
        description: `${form.email} is aangemaakt. Let op: er is geen email verstuurd. De gebruiker kan direct inloggen met het wachtwoord.`,
        variant: "default",
      });
      setForm({ email: "", name: "", password: "", userType: "user", must_change_password: true });
      fetchUsers();
    }
  };

  // Start editing user email or name
  const handleStartEdit = (userId: string | number, field: 'email' | 'name', currentValue: string) => {
    if (!currentUser?.isAdmin) {
      toast({
        title: "Geen Toegang",
        description: "Alleen admins kunnen gebruikersgegevens bewerken.",
        variant: "destructive",
      });
      return;
    }
    setEditingUserId(userId);
    setEditingField(field);
    if (field === 'email') {
      setEditedEmail(currentValue);
    } else {
      setEditedName(currentValue);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditingField(null);
    setEditedEmail("");
    setEditedName("");
  };

  // Save edited email or name
  const handleSaveEdit = async (userId: string | number, field: 'email' | 'name') => {
    if (!currentUser?.isAdmin) {
      toast({
        title: "Geen Toegang",
        description: "Alleen admins kunnen gebruikersgegevens bewerken.",
        variant: "destructive",
      });
      return;
    }

    const user = users.find(u => u.id === userId);
    if (!user) return;

    const newValue = field === 'email' ? editedEmail.trim() : editedName.trim();
    const oldValue = field === 'email' ? user.email : user.name;

    if (!newValue) {
      toast({
        title: "Fout",
        description: `${field === 'email' ? 'Email' : 'Naam'} mag niet leeg zijn.`,
        variant: "destructive",
      });
      return;
    }

    if (newValue === oldValue) {
      handleCancelEdit();
      return;
    }

    // Prevent changing super admin email
    if (field === 'email' && user.email === SUPER_ADMIN_EMAIL) {
      toast({
        title: "Niet Toegestaan",
        description: "Je kunt het email adres van de super admin niet wijzigen.",
        variant: "destructive",
      });
      handleCancelEdit();
      return;
    }

    try {
      const updateData: any = {};
      updateData[field] = newValue;

      const { error } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", userId);

      if (error) {
        throw error;
      }

      toast({
        title: "Gebruiker Bijgewerkt",
        description: `${field === 'email' ? 'Email' : 'Naam'} is gewijzigd van "${oldValue}" naar "${newValue}".`,
      });

      // Refresh users list
      await fetchUsers();

      handleCancelEdit();
    } catch (error: any) {
      toast({
        title: "Fout",
        description: error.message || `Er is een fout opgetreden bij het bijwerken van de ${field === 'email' ? 'email' : 'naam'}.`,
        variant: "destructive",
      });
    }
  };

  const SUPER_ADMIN_EMAIL = "r.blance@bampro.nl";

  // Fetch error logs (only for super admin) - via edge function for security
  const fetchErrorLogs = async () => {
    if (currentUser?.email !== SUPER_ADMIN_EMAIL) return;
    
    setErrorLogsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('error-logs', {
        body: {
          action: 'list',
          filter: errorLogsFilter,
          severity: errorLogsSeverity,
          userFilter: errorLogsUserFilter,
          limit: 100,
        },
      });
      
      if (error) {
        // If edge function doesn't exist (404) or CORS error, fall back to direct query
        const shouldFallback = error.message?.includes('404') || 
                               error.message?.includes('CORS') || 
                               error.message?.includes('Failed to send') ||
                               error.message?.includes('NetworkError');
        
        if (shouldFallback) {
          console.log('Edge function not available, using direct query fallback');
          // Fallback to direct query if edge function doesn't exist
          let query = supabase
            .from('error_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

          if (errorLogsFilter === 'unresolved') {
            query = query.eq('resolved', false);
          } else if (errorLogsFilter === 'resolved') {
            query = query.eq('resolved', true);
          }

          if (errorLogsSeverity !== 'all') {
            query = query.eq('severity', errorLogsSeverity);
          }

          if (errorLogsUserFilter !== 'all') {
            query = query.eq('user_email', errorLogsUserFilter);
            console.log('Applying user filter in fallback query:', errorLogsUserFilter);
          }

          const { data: fallbackData, error: fallbackError } = await query;
          
          if (fallbackError) {
            toast({
              title: "Error",
              description: fallbackError.message,
              variant: "destructive",
            });
            setErrorLogs([]);
          } else {
            console.log('Error logs fetched from fallback query:', fallbackData?.length || 0, 'logs');
            console.log('User filter applied:', errorLogsUserFilter);
            console.log('Unique users in results:', [...new Set((fallbackData || []).map((log: any) => log.user_email))]);
            setErrorLogs(fallbackData || []);
          }
          return;
        }
        
        // Real error from edge function
        toast({
          title: "Error",
          description: error.message || 'Failed to fetch error logs',
          variant: "destructive",
        });
        setErrorLogs([]);
        return;
      }
      
      if (data?.success) {
        const logs = data.data || [];
        console.log('Error logs fetched from edge function:', logs.length, 'logs');
        console.log('User filter applied:', errorLogsUserFilter);
        console.log('Unique users in results:', [...new Set(logs.map((log: any) => log.user_email))]);
        setErrorLogs(logs);
      } else {
        // Edge function returned but without success flag - try fallback
        console.log('Edge function returned without success, using fallback');
        let query = supabase
          .from('error_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (errorLogsFilter === 'unresolved') {
          query = query.eq('resolved', false);
        } else if (errorLogsFilter === 'resolved') {
          query = query.eq('resolved', true);
        }

        if (errorLogsSeverity !== 'all') {
          query = query.eq('severity', errorLogsSeverity);
        }

        if (errorLogsUserFilter !== 'all') {
          query = query.eq('user_email', errorLogsUserFilter);
        }

        const { data: fallbackData, error: fallbackError } = await query;
        
        if (fallbackError) {
          toast({
            title: "Error",
            description: fallbackError.message,
            variant: "destructive",
          });
          setErrorLogs([]);
        } else {
          setErrorLogs(fallbackData || []);
        }
      }
    } catch (error: any) {
      // If edge function doesn't exist, fall back to direct query
      console.log('Edge function error, using direct query fallback:', error);
      try {
        let query = supabase
          .from('error_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (errorLogsFilter === 'unresolved') {
          query = query.eq('resolved', false);
        } else if (errorLogsFilter === 'resolved') {
          query = query.eq('resolved', true);
        }

        if (errorLogsSeverity !== 'all') {
          query = query.eq('severity', errorLogsSeverity);
        }

        if (errorLogsUserFilter !== 'all') {
          query = query.eq('user_email', errorLogsUserFilter);
          console.log('Applying user filter in second fallback query:', errorLogsUserFilter);
        }

        const { data: fallbackData, error: fallbackError } = await query;
        
        if (fallbackError) {
          toast({
            title: "Error",
            description: fallbackError.message || 'Failed to fetch error logs',
            variant: "destructive",
          });
          setErrorLogs([]);
        } else {
          console.log('Error logs fetched from second fallback query:', fallbackData?.length || 0, 'logs');
          console.log('User filter applied:', errorLogsUserFilter);
          console.log('Unique users in results:', [...new Set((fallbackData || []).map((log: any) => log.user_email))]);
          setErrorLogs(fallbackData || []);
        }
      } catch (fallbackError: any) {
        console.error('Error fetching error logs:', fallbackError);
        toast({
          title: "Error",
          description: fallbackError.message || 'Failed to fetch error logs',
          variant: "destructive",
        });
        setErrorLogs([]);
      }
    } finally {
      setErrorLogsLoading(false);
    }
  };

  // Mark error as resolved - via edge function for security
  const handleResolveError = async (errorId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('error-logs', {
        body: {
          action: 'resolve',
          errorId,
          notes: errorLogNotes || null,
          resolvedBy: currentUser?.id,
        },
      });

      if (error) {
        // Fallback to direct query if edge function doesn't exist
        const { error: fallbackError } = await supabase
          .from('error_logs')
          .update({
            resolved: true,
            resolved_at: new Date().toISOString(),
            resolved_by: currentUser?.id,
            notes: errorLogNotes || null,
          })
          .eq('id', errorId);

        if (fallbackError) {
          toast({
            title: "Error",
            description: fallbackError.message,
            variant: "destructive",
          });
          return;
        }
      }

      toast({
        title: "Success",
        description: "Error marked as resolved",
      });
      setSelectedErrorLog(null);
      setErrorLogNotes("");
      fetchErrorLogs();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Delete error log - via edge function for security
  const handleDeleteErrorLog = async (errorId: string) => {
    if (!confirm("Are you sure you want to delete this error log?")) return;

    try {
      const { error } = await supabase.functions.invoke('error-logs', {
        method: 'DELETE',
        body: {
          action: 'delete',
          id: errorId,
        },
      });

      if (error) {
        // Fallback to direct query if edge function doesn't exist
        const { error: fallbackError } = await supabase
          .from('error_logs')
          .delete()
          .eq('id', errorId);

        if (fallbackError) {
          toast({
            title: "Error",
            description: fallbackError.message,
            variant: "destructive",
          });
          return;
        }
      }

      toast({
        title: "Success",
        description: "Error log deleted",
      });
      fetchErrorLogs();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Delete all error logs
  const handleDeleteAllErrors = async () => {
    if (!confirm("Are you sure you want to delete ALL error logs? This action cannot be undone.")) return;

    try {
      const { data, error } = await supabase.functions.invoke('error-logs', {
        method: 'DELETE',
        body: {
          action: 'delete-all',
        },
      });

      if (error) {
        // Check if it's a network/404 error that should fallback
        const shouldFallback = error.message?.includes('404') || 
                              error.message?.includes('CORS') || 
                              error.message?.includes('Failed to send') ||
                              error.message?.includes('NetworkError');
        
        if (shouldFallback) {
          // Fallback to direct query if edge function doesn't exist
          // First get count
          const { count: countBefore } = await supabase
            .from('error_logs')
            .select('*', { count: 'exact', head: true });
          
          const { error: fallbackError } = await supabase
            .from('error_logs')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using a condition that matches all)

          if (fallbackError) {
            toast({
              title: "Error",
              description: fallbackError.message,
              variant: "destructive",
            });
            return;
          }
          
          // Verify deletion
          const { count: countAfter } = await supabase
            .from('error_logs')
            .select('*', { count: 'exact', head: true });
          
          toast({
            title: "Success",
            description: `All error logs deleted (${countBefore || 0} deleted, ${countAfter || 0} remaining)`,
          });
        } else {
          // Real error from edge function
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
          return;
        }
      } else {
        // Success from edge function
        toast({
          title: "Success",
          description: data?.message || "All error logs deleted",
        });
      }
      
      // Wait a moment before refreshing to ensure deletion is complete
      // and to avoid showing newly logged errors immediately
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Also delete any ResizeObserver errors that might have been logged during the delete operation
      try {
        await supabase
          .from('error_logs')
          .delete()
          .ilike('error_message', '%ResizeObserver%');
      } catch (e) {
        // Ignore errors here - we're just cleaning up
      }
      
      fetchErrorLogs();
    } catch (error: any) {
      console.error('Error deleting all error logs:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to delete all error logs',
        variant: "destructive",
      });
    }
  };

  // Delete only ResizeObserver errors
  const handleDeleteResizeObserverErrors = async () => {
    if (!confirm("Are you sure you want to delete all ResizeObserver errors?")) return;

    try {
      const { data, error } = await supabase.functions.invoke('error-logs', {
        method: 'DELETE',
        body: {
          action: 'delete-by-message',
          messagePattern: 'ResizeObserver',
        },
      });

      if (error) {
        // Check if it's a network/404 error that should fallback
        const shouldFallback = error.message?.includes('404') || 
                              error.message?.includes('CORS') || 
                              error.message?.includes('Failed to send') ||
                              error.message?.includes('NetworkError');
        
        if (shouldFallback) {
          // Fallback to direct query if edge function doesn't exist
          const { error: fallbackError } = await supabase
            .from('error_logs')
            .delete()
            .ilike('error_message', '%ResizeObserver%');

          if (fallbackError) {
            toast({
              title: "Error",
              description: fallbackError.message,
              variant: "destructive",
            });
            return;
          }
        } else {
          // Real error from edge function
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
          return;
        }
      }

      toast({
        title: "Success",
        description: data?.message || "All ResizeObserver errors deleted",
      });
      fetchErrorLogs();
    } catch (error: any) {
      console.error('Error deleting ResizeObserver errors:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to delete ResizeObserver errors',
        variant: "destructive",
      });
    }
  };

  // Fetch error logs on mount and when filters change
  useEffect(() => {
    if (currentUser?.email === SUPER_ADMIN_EMAIL) {
      console.log('Fetching error logs with filters:', {
        filter: errorLogsFilter,
        severity: errorLogsSeverity,
        userFilter: errorLogsUserFilter
      });
      fetchErrorLogs();
    }
    // eslint-disable-next-line
  }, [currentUser, errorLogsFilter, errorLogsSeverity, errorLogsUserFilter]);

  // Get current user type
  const getUserType = (user: any): string => {
    if (user.email === SUPER_ADMIN_EMAIL) {
      return 'super_admin';
    }
    // Check if user has userType field (new field), otherwise fall back to isAdmin
    if (user.userType) {
      return user.userType;
    }
    return user.isAdmin ? 'admin' : 'user';
  };

  // Reset password
  const handleResetPassword = async (userId: string) => {
    if (!resetPassword) {
      toast({ title: "Missing password", description: "Enter a new password", variant: "destructive" });
      return;
    }
    // Hash password before storing
    const hashedPassword = await hashPassword(resetPassword);
    const { error } = await supabase.from("users").update({ password: hashedPassword, must_change_password: true }).eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password reset", description: "User must change password on next login" });
      setResetPassword("");
      setResetUserId(null);
      fetchUsers();
    }
  };
  // Change user type (super admin, admin, or user)
  const handleChangeUserType = async (userId: string, userEmail: string, newUserType: string) => {
    // Prevent super admin from changing their own account type
    if (currentUser?.email === SUPER_ADMIN_EMAIL && String(userId) === String(currentUser.id)) {
      toast({
        title: "Action not allowed",
        description: "You cannot change your own account type as super admin.",
        variant: "destructive",
      });
      return;
    }
    // Prevent changing super admin email's user type (for other super admin accounts)
    if (userEmail === SUPER_ADMIN_EMAIL && newUserType !== 'super_admin') {
      toast({
        title: "Action not allowed",
        description: "You cannot change the super admin's user type.",
        variant: "destructive",
      });
      return;
    }
    // Prevent users from removing their own admin rights (unless they are super admin changing themselves, which is already blocked above)
    if (String(userId) === String(currentUser.id) && newUserType !== 'admin' && newUserType !== 'super_admin') {
      toast({
        title: "Action not allowed",
        description: "You cannot remove your own admin rights.",
        variant: "destructive",
      });
      return;
    }
    
    const isAdmin = newUserType === 'admin' || newUserType === 'super_admin';
    const { error } = await supabase.from("users").update({ 
      isAdmin: isAdmin,
      userType: newUserType 
    }).eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const typeLabels: Record<string, string> = {
        'super_admin': t('admin.userType.superAdmin'),
        'admin': t('admin.userType.admin'),
        'user': t('admin.userType.user')
      };
      toast({
        title: "User type updated",
        description: `${userEmail} is now ${typeLabels[newUserType] || newUserType}.`,
      });
      fetchUsers();
    }
  };

  // Toggle admin flag for an existing user (kept for backward compatibility)
  const handleToggleAdmin = async (userId: string, userEmail: string, makeAdmin: boolean) => {
    const newUserType = makeAdmin ? 'admin' : 'user';
    await handleChangeUserType(userId, userEmail, newUserType);
  };

  // Toggle Timebuzzer access for a user (only super admin can do this)
  const handleToggleTimebuzzer = async (userId: string, userEmail: string, canUse: boolean) => {
    if (currentUser.email !== SUPER_ADMIN_EMAIL) {
      toast({
        title: "Action not allowed",
        description: "Only the super admin can manage Timebuzzer access.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.from("users").update({ can_use_timebuzzer: canUse }).eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Timebuzzer access updated",
        description: `${userEmail} ${canUse ? "can now" : "can no longer"} use Timebuzzer integration.`,
      });
      fetchUsers();
    }
  };

  // Change weekly view option for a user (only super admin can do this)
  const handleChangeWeeklyViewOption = async (userId: string, userEmail: string, newOption: string) => {
    if (currentUser?.email !== SUPER_ADMIN_EMAIL) {
      toast({
        title: "Access Denied",
        description: "Only super admin can change weekly view options.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("users").update({ 
      weekly_view_option: newOption 
    }).eq("id", userId);

    if (error) {
      if (error.message?.includes('weekly_view_option') || error.message?.includes('column') || error.message?.includes('does not exist')) {
        toast({
          title: "Column Not Found",
          description: "The weekly_view_option column doesn't exist yet. Please run the SQL migration file 'add_weekly_view_option_column.sql' in Supabase SQL Editor first.",
          variant: "destructive",
          duration: 10000,
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      const optionLabels: Record<string, string> = {
        'simple': 'Simple Only',
        'original': 'Original Only',
        'both': 'Both Views (User Choice)'
      };
      toast({
        title: "Updated",
        description: `Weekly view option for ${userEmail} set to ${optionLabels[newOption] || newOption}.`,
      });
      fetchUsers();
    }
  };

  // Approve pending user
  const handleApproveUser = async (userId: string, userEmail: string) => {
    const { error } = await supabase.from("users").update({ approved: true }).eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "User Approved",
        description: `${userEmail} can now log in.`,
      });
      fetchUsers();
    }
  };

  // Delete user
  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (userEmail === SUPER_ADMIN_EMAIL) {
      toast({ title: "Action not allowed", description: "You cannot delete the super admin.", variant: "destructive" });
      return;
    }
    if (userId === currentUser.id) {
      toast({ title: "Action not allowed", description: "You cannot delete your own account.", variant: "destructive" });
      return;
    }
    const confirmText = window.prompt(`Type DELETE to confirm deletion of user ${userEmail}`);
    if (confirmText !== "DELETE") {
      toast({ title: "Cancelled", description: "User was not deleted." });
      return;
    }
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "User deleted" });
      fetchUsers();
    }
  };

  const totalDaysOff = 25;

  const handleAddOrDeductDaysOffClick = (userId: string, hours: number) => {
    if (!hours) return;
    
    // Store the pending action and show dialog to ask for reason
    setPendingDaysOffAction({ userId, hours });
    setShowDaysOffReasonDialog(true);
  };

  const handleConfirmDaysOffChange = async () => {
    if (!pendingDaysOffAction) return;
    
    const { userId, hours } = pendingDaysOffAction;
    const reason = daysOffReasonInput[userId] || '';
    
    if (!reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for this change.",
        variant: "destructive",
      });
      return;
    }
    
    // Close dialog and clear reason input
    setShowDaysOffReasonDialog(false);
    const reasonToUse = reason;
    setDaysOffReasonInput(prev => ({ ...prev, [userId]: "" }));
    setPendingDaysOffAction(null);
    
    // Now execute the actual change
    await handleAddOrDeductDaysOff(userId, hours, reasonToUse);
  };

  const handleAddOrDeductDaysOff = async (userId: string, hours: number, reason: string) => {
    if (!hours) return;
    
    console.log('🔵 handleAddOrDeductDaysOff called:', { userId, hours, hoursType: typeof hours, reason });
    
    // IMPORTANT: The logic is inverted!
    // "Add" means: give user more days off (reduce taken hours) -> insert NEGATIVE hours
    // "Subtract" means: take days off away (increase taken hours) -> insert POSITIVE hours
    // This is because daysOffMap sums all hours, and daysLeft = 25 - (daysOffMap / 8)
    // So to give more days: reduce daysOffMap (negative hours)
    // To take days away: increase daysOffMap (positive hours)
    
    // Invert the sign: if hours is positive, make it negative (and vice versa)
    const invertedHours = -hours;
    
    console.log('🔵 Hours inverted:', { original: hours, inverted: invertedHours });
    const today = formatDateToYYYYMMDD(new Date());
    
    console.log('🔵 Inserting timesheet entry:', {
      user_id: userId,
      date: today,
      hours: invertedHours,
      description: "31"
    });
    
    const { data: insertData, error } = await supabase.from("timesheet").insert([
      {
        user_id: userId,
        project_id: null,
        date: today,
        hours: invertedHours, // Use inverted hours
        description: "31",
        // IMPORTANT: Do NOT set startTime or endTime - this marks it as an admin adjustment
        // Weekly entry views filter out entries without startTime/endTime
        // This ensures admin adjustments don't show up in weekly entry view
        startTime: null,
        endTime: null,
        notes: reason ? `Admin adjustment: ${reason}` : "Admin adjustment",
      },
    ]).select();
    
    if (error) {
      console.error('❌ Error inserting timesheet entry:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      console.log('✅ Timesheet entry inserted:', insertData);
      
      // Create notification for the user
      // Note: hours is the original value (what admin clicked), invertedHours is what we stored
      // For notification, we want to show what the admin intended:
      // - If admin clicked "Add", hours is positive, but we stored negative -> user gets more days
      // - If admin clicked "Subtract", hours is negative, but we stored positive -> user loses days
      const daysChanged = Math.abs(hours) / 8;
      const isAdding = hours > 0; // Original hours value determines if it's "Add" or "Subtract"
      const baseMessage = isAdding
        ? `${daysChanged.toFixed(2)} day(s) off (${Math.abs(hours).toFixed(2)} hours) have been added to your account.`
        : `${daysChanged.toFixed(2)} day(s) off (${Math.abs(hours).toFixed(2)} hours) have been deducted from your account.`;
      const message = reason ? `${baseMessage}\n\nReason: ${reason}` : baseMessage;
      
      // Get user name for the notification
      const targetUser = users.find(u => String(u.id) === String(userId));
      const userName = targetUser?.name || targetUser?.email || 'User';
      
      // Insert notification
      // For notification, store the original hours value (what admin intended)
      // But the actual database entry uses invertedHours
      console.log('🔵 Creating days off notification:', {
        user_id: userId,
        hours_changed: hours, // Original value for notification
        hours_stored: invertedHours, // What's actually stored in timesheet
        days_changed: daysChanged,
        isAdding: isAdding,
        message: message,
        created_by: currentUser?.id,
        admin_name: currentUser?.name || currentUser?.email
      });
      
      const { data: notifData, error: notifError } = await supabase.from("days_off_notifications").insert([
        {
          user_id: String(userId), // Ensure it's a string
          hours_changed: hours, // Store original value for notification display
          days_changed: daysChanged,
          message: message,
          created_by: currentUser?.id ? String(currentUser.id) : null,
          admin_name: currentUser?.name || currentUser?.email || 'Admin',
        },
      ]).select();
      
      if (notifError) {
        console.error('❌ Error creating notification:', notifError);
        toast({
          title: "Warning",
          description: `Days off updated but notification could not be created: ${notifError.message}`,
          variant: "destructive",
        });
      } else {
        console.log('✅ Notification created successfully:', notifData);
      }
      
      toast({ 
        title: isAdding ? "Day(s) Off Added" : "Day(s) Off Deducted", 
        description: `${userName} will be notified about this change. ${isAdding ? 'Added' : 'Deducted'}: ${Math.abs(hours)} hours` 
      });
      setDaysOffInput((prev) => ({ ...prev, [userId]: "" }));
      
      // Refresh days off map
      const currentYear = new Date().getFullYear();
      const fromDate = `${currentYear}-01-01`;
      const toDate = `${currentYear}-12-31`;
      const { data } = await supabase
        .from("timesheet")
        .select("user_id, hours, description")
        .eq("description", "31")
        .gte("date", fromDate)
        .lte("date", toDate);
      
      if (data) {
        console.log('🔵 All timesheet entries with description 31:', data);
        const map: Record<string, number> = {};
        data.forEach(e => {
          // Handle both string and number user_id
          const userId = String(e.user_id);
          const hoursValue = parseFloat(String(e.hours)) || 0;
          map[userId] = (map[userId] || 0) + hoursValue;
          console.log(`🔵 User ${userId}: adding ${hoursValue} hours, total now: ${map[userId]}`);
        });
        console.log('🔵 Final daysOffMap:', map);
        setDaysOffMap(map);
      }
    }
  };

  function getISOWeek(dateStr: string) {
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    return (
      date.getFullYear() + "-W" +
      String(1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)).padStart(2, '0')
    );
  }


  // Get day of week index (Monday = 0, Sunday = 6)
  const getDayOfWeekIndex = (dateStr: string): number => {
    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDay();
    // Convert: Sunday (0) -> 6, Monday (1) -> 0, Tuesday (2) -> 1, etc.
    return day === 0 ? 6 : day - 1;
  };

  // Helper to get week date range from week number and year
  const getWeekDateRange = (weekNumber: number, year: number) => {
    try {
      const jan4 = new Date(year, 0, 4);
      const jan4Day = jan4.getDay() || 7;
      const daysToMonday = jan4Day === 1 ? 0 : 1 - jan4Day;
      const week1Monday = new Date(year, 0, 4 + daysToMonday);
      const weekMonday = new Date(week1Monday);
      weekMonday.setDate(week1Monday.getDate() + (weekNumber - 1) * 7);
      const weekSunday = new Date(weekMonday);
      weekSunday.setDate(weekMonday.getDate() + 6);
      return {
        from: formatDateToYYYYMMDD(weekMonday),
        to: formatDateToYYYYMMDD(weekSunday)
      };
    } catch (error) {
      console.error("Error calculating week date range:", error);
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(today.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        from: formatDateToYYYYMMDD(monday),
        to: formatDateToYYYYMMDD(sunday)
      };
    }
  };

  // Toggle user selection for reminders
  const toggleReminderUser = (userId: string) => {
    setReminderUserIds(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Send reminder to selected users
  const handleSendReminder = async () => {
    if (reminderUserIds.length === 0 || !reminderWeekNumber || !reminderYear) {
      toast({
        title: "Missing Information",
        description: "Please select at least one user, week number, and year",
        variant: "destructive",
      });
      return;
    }

    const weekNum = parseInt(reminderWeekNumber);
    const year = parseInt(reminderYear);
    
    if (isNaN(weekNum) || weekNum < 1 || weekNum > 53) {
      toast({
        title: "Invalid Week Number",
        description: "Week number must be between 1 and 53",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(year) || year < 2020 || year > 2100) {
      toast({
        title: "Invalid Year",
        description: "Please enter a valid year",
        variant: "destructive",
      });
      return;
    }

    // Create reminders for all selected users
    const remindersToInsert = reminderUserIds.map(userId => {
      const user = users.find(u => u.id.toString() === userId);
      const userName = user?.name || user?.email || "User";
      return {
        user_id: userId.toString(),
        week_number: weekNum,
        year: year,
        message: `Please fill in your hours for week ${weekNum} of ${year}.`,
        created_by: currentUser?.id ? currentUser.id.toString() : null,
      };
    });

    console.log("Inserting reminders:", remindersToInsert);

    // Insert reminders into database
    const { data: insertedReminders, error } = await supabase
      .from("reminders")
      .insert(remindersToInsert)
      .select();

    console.log("Reminder insert result:", { insertedReminders, error });

    if (error) {
      console.error("Error inserting reminders:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const userNames = reminderUserIds.map(userId => {
      const user = users.find(u => u.id.toString() === userId);
      return user?.name || user?.email || "User";
    }).join(", ");

    // Call edge function to send reminder emails
    try {
      console.log("Calling send-reminder-email edge function...");
      const { data: emailData, error: emailError } = await supabase.functions.invoke('send-reminder-email', {
        body: {
          userIds: reminderUserIds,
          weekNumber: weekNum,
          year: year,
          message: `Please fill in your hours for week ${weekNum} of ${year}.`,
        },
      });

      console.log("Email sending result:", { emailData, emailError });

      if (emailError) {
        console.error("Error sending reminder emails:", emailError);
        // Still show success for reminders, but warn about emails
        const errorMsg = emailError.message || JSON.stringify(emailError);
        const errorStatus = emailError.status || emailError.statusCode;
        
        if (errorStatus === 404) {
          toast({
            title: "Reminders Sent",
            description: `Reminders saved, but emails were not sent. The 'send-reminder-email' edge function is not deployed. Check Supabase Dashboard → Edge Functions.`,
            variant: "default",
          });
        } else {
          toast({
            title: "Reminders Sent",
            description: `Reminders saved to ${reminderUserIds.length} user(s), but email sending failed: ${errorMsg.substring(0, 100)}`,
            variant: "default",
          });
        }
      } else if (emailData?.error) {
        console.error("Edge function returned error:", emailData.error);
        toast({
          title: "Reminders Sent",
          description: `Reminders saved, but email sending failed: ${emailData.error}`,
          variant: "default",
        });
      } else {
        // Success - show results
        const sentCount = emailData?.sent || 0;
        const failedCount = emailData?.failed || 0;
        
        if (failedCount > 0) {
          toast({
            title: "Reminders Sent",
            description: `Reminders and ${sentCount} email(s) sent to ${reminderUserIds.length} user(s) for week ${weekNum} of ${year}. ${failedCount} email(s) failed to send.`,
            variant: "default",
          });
        } else {
          toast({
            title: "Reminders and Emails Sent",
            description: `Reminders and emails sent successfully to ${reminderUserIds.length} user(s): ${userNames} for week ${weekNum} of ${year}.`,
          });
        }
      }
    } catch (emailErr: any) {
      console.error("Exception sending reminder emails:", emailErr);
      // Still show success for reminders since they're already saved
      toast({
        title: "Reminders Sent",
        description: `Reminders saved to ${reminderUserIds.length} user(s), but email sending encountered an error. Check console for details.`,
        variant: "default",
      });
    }

    // Reset form
    setReminderUserIds([]);
    setReminderWeekNumber("");
    setReminderYear(new Date().getFullYear().toString());
  };

  // Handle admin actions on confirmed weeks
  const handleApproveWeek = async (userId: string, weekStartDate: string) => {
    const { error } = await supabase
      .from('confirmed_weeks')
      .update({ admin_approved: true, admin_reviewed: true, admin_review_comment: null, admin_reviewed_by: currentUser?.id || null, admin_reviewed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('week_start_date', weekStartDate);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: t('admin.weekReview.approvedToastTitle'), description: t('admin.weekReview.approvedToastDescription') });
      try {
        const user = users.find((u: any) => String(u.id) === String(userId));
        const weekStart = new Date(weekStartDate);
        const weekNum = getISOWeekNumber(weekStart);
        const year = weekStart.getFullYear();
        if (user?.id) {
          const { error: emailError } = await supabase.functions.invoke('send-week-review-email', {
            body: {
              userId: user.id,
              weekStartDate,
              weekNumber: weekNum,
              year,
              status: "approved",
            },
          });
          if (emailError) {
            toast({
              title: t('admin.weekReview.emailFailedTitle'),
              description: emailError.message || t('admin.weekReview.emailFailedDescription'),
              variant: "default",
            });
          }
        }
      } catch (e) {
        // Email failure should not block approval
        console.warn("Failed to send approval email", e);
        toast({
          title: t('admin.weekReview.emailFailedTitle'),
          description: t('admin.weekReview.emailFailedDescription'),
          variant: "default",
        });
      }
      // Refresh confirmed weeks
      const { data } = await supabase
        .from('confirmed_weeks')
        .select('*')
        .eq('confirmed', true)
        .order('week_start_date', { ascending: false });
      setConfirmedWeeks(data || []);
    }
  };

  // Helper function to generate and send Excel email for a week
  const generateAndSendWeekExcelEmail = async (userId: string, weekStartDate: string, weekNumber: number, year: number, emailType: 'rejection' | 'unlock'): Promise<boolean> => {
    const ADMINISTRATIE_EMAIL = "administratie@bampro.nl";
    
    try {
      const user = users.find((u: any) => String(u.id) === String(userId));
      if (!user) {
        console.error('User not found for Excel generation');
        return false;
      }

      // Calculate week dates
      const weekStart = new Date(weekStartDate);
      const weekDates = getWeekDates(weekStart);
      const fromDate = formatDateToYYYYMMDD(weekDates[0]);
      const toDate = formatDateToYYYYMMDD(weekDates[6]);

      // Fetch timesheet data
      const [{ data, error }, { data: overnightRows }] = await Promise.all([
        supabase
          .from("timesheet")
          .select("*, projects(name)")
          .eq("user_id", userId)
          .gte("date", fromDate)
          .lte("date", toDate)
          .order("date", { ascending: true })
          .order("startTime", { ascending: true }),
        supabase
          .from("overnight_stays")
          .select("date")
          .eq("user_id", userId)
          .gte("date", fromDate)
          .lte("date", toDate),
      ]);

      if (error || !data || data.length === 0) {
        console.error('Failed to fetch timesheet data:', error);
        return false;
      }

      // Filter out admin adjustments
      const filteredData = data.filter((e: any) => e.startTime && e.endTime);
      if (filteredData.length === 0) {
        console.error('No valid entries found');
        return false;
      }

      // Group entries by day
      const entriesByDay: Record<string, any[]> = {};
      weekDates.forEach(date => {
        const dateStr = formatDateToYYYYMMDD(date);
        entriesByDay[dateStr] = filteredData.filter((entry: any) => entry.date === dateStr);
      });

      // Load logo
      let logoBuffer: ArrayBuffer | null = null;
      try {
        const response = await fetch('/bampro-marine-logo.jpg');
        if (response.ok) logoBuffer = await response.arrayBuffer();
      } catch (err) {
        console.warn('Could not load logo:', err);
      }

      // Create Excel workbook (simplified version matching WeeklyCalendarEntrySimple pattern)
      const workbook = new ExcelJS.Workbook();
      const dayNamesEN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const overnightSet = new Set((overnightRows || []).map((r: any) => String(r.date)));

      weekDates.forEach((date, dayIdx) => {
        const dateStr = formatDateToYYYYMMDD(date);
        const dayEntries = entriesByDay[dateStr] || [];
        const dayName = dayNamesEN[dayIdx];
        const formattedDate = formatDateDDMMYY(dateStr);
        const locale = language === 'nl' ? 'nl-NL' : 'en-GB';
        const dayNameDisplay = date.toLocaleDateString(locale, { weekday: 'long' });

        // Calculate total hours (excluding breaks)
        const totalHours = dayEntries.reduce((sum, entry) => {
          if (entry.description === "35") return sum; // Skip breaks
          return sum + (parseFloat(entry.hours) || 0);
        }, 0);
        const totalHoursHHMM = formatHoursHHMM(totalHours);

        const worksheet = workbook.addWorksheet(dayName);

        // Add logo
        if (logoBuffer) {
          const logoId = workbook.addImage({ buffer: logoBuffer, extension: 'jpeg' });
          worksheet.addImage(logoId, { tl: { col: 6, row: 0 }, ext: { width: 200, height: 60 } });
        }

        // Set column widths
        worksheet.getColumn(1).width = 12;
        worksheet.getColumn(2).width = 20;
        worksheet.getColumn(3).width = 25;
        worksheet.getColumn(4).width = 8;
        worksheet.getColumn(5).width = 8;
        worksheet.getColumn(6).width = 15;
        worksheet.getColumn(7).width = 12;
        worksheet.getColumn(8).width = 30;

        // Headers
        worksheet.getCell('A1').value = 'Employee Name:';
        worksheet.getCell('B1').value = user.name || user.email || '';
        worksheet.getCell('A2').value = 'Date:';
        worksheet.getCell('B2').value = `From: ${formatDateDDMMYY(fromDate)}`;
        worksheet.getCell('D2').value = `To: ${formatDateDDMMYY(toDate)}`;
        worksheet.getCell('A3').value = 'Day:';
        worksheet.getCell('B3').value = `${formattedDate} ${dayNameDisplay}`;
        worksheet.getCell('A4').value = 'Week Number:';
        worksheet.getCell('B4').value = weekNumber.toString();
        worksheet.getCell('A5').value = 'Year:';
        worksheet.getCell('B5').value = year.toString();

        // Table headers
        const headerRow = worksheet.getRow(9);
        headerRow.values = ['Day', 'Work Type', 'Project Work Order', 'From', 'To', 'Hours Worked', 'Kilometers'];
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E5E5' } };

        // Data rows
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

        // Total row
        const totalRowIndex = 10 + dayEntries.length;
        const totalRow = worksheet.getRow(totalRowIndex);
        totalRow.getCell(2).value = 'Total';
        totalRow.getCell(2).font = { bold: true };
        totalRow.getCell(6).value = totalHoursHHMM;
        totalRow.getCell(6).font = { bold: true };
      });

      // Generate filename and convert to base64
      const userName = (user.name || user.email || 'User').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${userName}_Week${weekNumber}_${year}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      const uint8Array = new Uint8Array(buffer);
      const chunkSize = 0x8000;
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binaryString += String.fromCharCode.apply(null, Array.from(chunk) as any);
      }
      const base64 = btoa(binaryString);

      // Send via edge function
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('send-week-excel-email', {
        body: {
          userId: user.id,
          userName: user.name || user.email || '',
          userEmail: user.email || '',
          weekNumber,
          year,
          dateFrom: fromDate,
          dateTo: toDate,
          excelBase64: base64,
          recipientEmail: ADMINISTRATIE_EMAIL,
          filename,
        },
      });

      if (edgeError || edgeData?.error) {
        console.error('Failed to send Excel email:', edgeError || edgeData?.error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error generating/sending Excel email:', err);
      return false;
    }
  };

  const handleRejectWeek = async (userId: string, weekStartDate: string) => {
    const user = users.find((u: any) => String(u.id) === String(userId));
    const weekStart = new Date(weekStartDate);
    const weekNum = getISOWeekNumber(weekStart);
    const year = weekStart.getFullYear();
    setWeekReviewComment("");
    setWeekReviewDialog({
      open: true,
      userId,
      weekStartDate,
      userName: user?.name || user?.email || t('admin.unknownUser'),
      weekNumber: weekNum,
      year,
    });
  };

  const submitWeekRejection = async () => {
    if (!weekReviewDialog.userId || !weekReviewDialog.weekStartDate) return;
    const { userId, weekStartDate, weekNumber, year } = weekReviewDialog;

    const { error } = await supabase
      .from('confirmed_weeks')
      // Reject should UNLOCK the week so user can edit again
      .update({
        confirmed: false,
        admin_approved: false,
        admin_reviewed: true,
        admin_review_comment: weekReviewComment || null,
        admin_reviewed_by: currentUser?.id || null,
        admin_reviewed_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('week_start_date', weekStartDate);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: t('admin.weekReview.rejectedToastTitle'), description: t('admin.weekReview.rejectedToastDescription') });

    // Send Excel email with timesheet
    const excelEmailSuccess = await generateAndSendWeekExcelEmail(userId, weekStartDate, weekNumber, year, 'rejection');
    
    // Update rejection_email_sent_at if Excel email was sent successfully
    if (excelEmailSuccess) {
      await supabase
        .from('confirmed_weeks')
        .update({ rejection_email_sent_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('week_start_date', weekStartDate);
    }

    // Also send notification email (existing behavior)
    try {
      const { error: emailError } = await supabase.functions.invoke('send-week-review-email', {
        body: {
          userId,
          weekStartDate,
          weekNumber,
          year,
          status: "rejected",
          comment: weekReviewComment || undefined,
        },
      });
      if (emailError) {
        toast({
          title: t('admin.weekReview.emailFailedTitle'),
          description: emailError.message || t('admin.weekReview.emailFailedDescription'),
          variant: "default",
        });
      }
    } catch (e) {
      console.warn("Failed to send rejection email", e);
      toast({
        title: t('admin.weekReview.emailFailedTitle'),
        description: t('admin.weekReview.emailFailedDescription'),
        variant: "default",
      });
    }

    setWeekReviewDialog(prev => ({ ...prev, open: false }));
    setWeekReviewComment("");

    // Refresh confirmed weeks (only confirmed=true are listed)
    const { data } = await supabase
      .from('confirmed_weeks')
      .select('*')
      .eq('confirmed', true)
      .order('week_start_date', { ascending: false });
    setConfirmedWeeks(data || []);
  };

  const handleUnlockWeek = async (userId: string, weekStartDate: string) => {
    // Get week number and year for email
    const weekStart = new Date(weekStartDate);
    const weekNum = getISOWeekNumber(weekStart);
    const year = weekStart.getFullYear();

    // Send Excel email before unlocking
    const excelEmailSuccess = await generateAndSendWeekExcelEmail(userId, weekStartDate, weekNum, year, 'unlock');

    const { error } = await supabase
      .from('confirmed_weeks')
      .update({ 
        confirmed: false, 
        admin_approved: false, 
        admin_reviewed: false,
        // Update unlock_email_sent_at if Excel email was sent successfully
        unlock_email_sent_at: excelEmailSuccess ? new Date().toISOString() : null,
      })
      .eq('user_id', userId)
      .eq('week_start_date', weekStartDate);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ 
        title: "Week Teruggezet", 
        description: excelEmailSuccess 
          ? "De week is teruggezet en Excel is verzonden via email. De gebruiker kan de uren nu opnieuw aanpassen."
          : "De week is teruggezet. De gebruiker kan de uren nu opnieuw aanpassen." 
      });
      // Refresh confirmed weeks
      const { data } = await supabase
        .from('confirmed_weeks')
        .select('*')
        .eq('confirmed', true)
        .order('week_start_date', { ascending: false });
      setConfirmedWeeks(data || []);
    }
  };

  // Timebuzzer Sync
  const handleTimebuzzerSync = async () => {
    // Get week date range from week number and year
    const { from, to } = getWeekDateRange(timebuzzerSyncWeekNumber, timebuzzerSyncYear);
    
    setTimebuzzerSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('timebuzzer-sync', {
        body: {
          action: 'sync-to-timesheet',
          startDate: from,
          endDate: to,
        },
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast({
          title: "Sync Successful",
          description: `Synced ${data.inserted || 0} time entries from Timebuzzer`,
        });
      } else {
        throw new Error(data.error || "Sync failed");
      }
    } catch (error: any) {
      toast({
        title: "Sync Error",
        description: error.message || "Failed to sync Timebuzzer data",
        variant: "destructive",
      });
    } finally {
      setTimebuzzerSyncing(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-8 bg-white dark:bg-gray-800 rounded shadow w-full max-w-full">
      {!hideTabs && (
      <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">{t('admin.title')}</h2>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {!hideTabs && (
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 mb-6">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t('admin.tab.users')}</span>
          </TabsTrigger>
          {/* Weeks tab - Only for admins, not for administratie users */}
          {currentUser?.isAdmin && !isAdministratie(currentUser) && (
            <TabsTrigger value="weeks" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">{t('admin.tab.weeks')}</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="reminders" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">{t('admin.tab.reminders')}</span>
          </TabsTrigger>
          <TabsTrigger value="overtime" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('admin.tab.overtime')}</span>
          </TabsTrigger>
          {currentUser?.email === SUPER_ADMIN_EMAIL && (
            <TabsTrigger value="timebuzzer" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t('admin.tab.timebuzzer')}</span>
            </TabsTrigger>
          )}
          {(currentUser?.isAdmin || currentUser?.userType === 'administratie' || currentUser?.email === SUPER_ADMIN_EMAIL) && (
            <TabsTrigger value="daysOff" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">{t('admin.daysOffOverview')}</span>
            </TabsTrigger>
          )}
          {currentUser?.email === SUPER_ADMIN_EMAIL && (
            <TabsTrigger value="errors" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">{t('admin.errors')}</span>
            </TabsTrigger>
          )}
        </TabsList>
        )}

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          {/* Add User Section - Only for admins, not for administratie */}
          {currentUser?.isAdmin && !isAdministratie(currentUser) && (
      <div className="mb-6 sm:mb-8">
        <h3 className="text-base sm:text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('admin.addUser')}</h3>
        <form onSubmit={handleAddUser} className={`flex ${isMobile ? 'flex-col' : 'flex-row flex-wrap'} gap-3 sm:gap-4 ${isMobile ? '' : 'items-end'} w-full`}>
          <div className={isMobile ? 'w-full' : ''}>
            <Label className="text-sm">{t('admin.email')}</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className="h-10 sm:h-9" />
          </div>
          <div className={isMobile ? 'w-full' : ''}>
            <Label className="text-sm">{t('admin.name')}</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-10 sm:h-9" />
          </div>
          <div className={isMobile ? 'w-full' : ''}>
            <Label className="text-sm">{t('admin.password')}</Label>
            <Input 
              type="password" 
              value={form.password} 
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} 
              required 
              minLength={6}
              placeholder={t('admin.passwordPlaceholder')}
              className="h-10 sm:h-9"
            />
            {form.password && form.password.length > 0 && form.password.length < 6 && (
              <p className="text-xs text-red-500 mt-1">{t('admin.passwordMinLength')}</p>
            )}
          </div>
          <div className={isMobile ? 'w-full' : ''}>
            <Label className="text-sm">{t('admin.userType')}</Label>
            <Select value={form.userType} onValueChange={(value) => setForm(f => ({ ...f, userType: value }))}>
              <SelectTrigger className="h-10 sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{t('admin.userType.user')}</SelectItem>
                <SelectItem value="administratie">{t('admin.userType.administratie')}</SelectItem>
                <SelectItem value="admin">{t('admin.userType.admin')}</SelectItem>
                <SelectItem value="weekly_only">{t('admin.userType.weeklyOnly')}</SelectItem>
                {currentUser?.email === SUPER_ADMIN_EMAIL && (
                  <SelectItem value="super_admin">{t('admin.userType.superAdmin')}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className={`flex items-center gap-2 ${isMobile ? 'w-full' : ''}`}>
            <input type="checkbox" id="must_change_password" checked={form.must_change_password} onChange={e => setForm(f => ({ ...f, must_change_password: e.target.checked }))} className="h-4 w-4" />
            <Label htmlFor="must_change_password" className="text-sm">{t('admin.mustChangePassword')}</Label>
          </div>
          <Button type="submit" className={`${isMobile ? 'w-full' : ''} h-10 sm:h-9`} size={isMobile ? "lg" : "default"}>{t('admin.createUser')}</Button>
        </form>
      </div>
      )}

          {/* Pending Users Section - Only for admins, not for administratie */}
          {currentUser?.isAdmin && !isAdministratie(currentUser) && users.filter(u => u.approved === false).length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold mb-2 text-orange-600 dark:text-orange-400">{t('admin.pendingApproval')}</h3>
          {isMobile ? (
            <div className="space-y-3">
              {users.filter(u => u.approved === false).map(user => (
                <div key={user.id} className="border rounded-lg p-3 bg-orange-50 dark:bg-orange-900/30">
                  <div className="mb-2">
                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{user.email}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">{user.name || "-"}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" onClick={() => handleApproveUser(user.id, user.email)} className="flex-1 h-9">
                      {t('admin.approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteUser(user.id, user.email)}
                      className="flex-1 h-9"
                    >
                      {t('admin.reject')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="min-w-full border mt-2 text-sm border-gray-300 dark:border-gray-700">
                <thead>
                  <tr className="bg-orange-100 dark:bg-orange-900/30">
                    <th className="p-2 text-left text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{t('admin.email')}</th>
                    <th className="p-2 text-left text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{t('admin.name')}</th>
                    <th className="p-2 text-left text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => u.approved === false).map(user => (
                    <tr key={user.id} className="border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
                      <td className="p-2 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{user.email}</td>
                      <td className="p-2 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{user.name || "-"}</td>
                      <td className="p-2">
                        <Button size="sm" variant="default" onClick={() => handleApproveUser(user.id, user.email)}>
                          {t('admin.approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="ml-2"
                          onClick={() => handleDeleteUser(user.id, user.email)}
                        >
                          {t('admin.reject')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      
          {/* Existing Users Section - Visible for admins and administratie users */}
          {(currentUser?.isAdmin || isAdministratie(currentUser)) && (
          <div>
        <h3 className="text-base sm:text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('admin.existingUsers')}</h3>
        {loading ? (
          <div className="text-sm">{t('common.loading')}</div>
        ) : isMobile ? (
          /* Mobile: Card Layout */
          <div className="space-y-3">
            {users.filter(u => u.approved !== false).map(user => (
              <div key={user.id} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-700">
                <div className="mb-3">
                  <div className="font-semibold text-sm mb-1 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {editingUserId === user.id && editingField === 'email' ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type="email"
                          value={editedEmail}
                          onChange={(e) => setEditedEmail(e.target.value)}
                          className="h-8 text-sm flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveEdit(user.id, 'email');
                            } else if (e.key === "Escape") {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSaveEdit(user.id, 'email')}
                          className="h-8 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/40"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEdit}
                          className="h-8 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span>{user.email}</span>
                        {user.email === SUPER_ADMIN_EMAIL && <span className="ml-2 px-2 py-0.5 text-xs bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 rounded">Super Admin</span>}
                        {currentUser?.isAdmin && user.email !== SUPER_ADMIN_EMAIL && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(user.id, 'email', user.email)}
                            className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            title="Edit email"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    {editingUserId === user.id && editingField === 'name' ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="h-8 text-sm flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveEdit(user.id, 'name');
                            } else if (e.key === "Escape") {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSaveEdit(user.id, 'name')}
                          className="h-8 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/40"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEdit}
                          className="h-8 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span>{user.name}</span>
                        {currentUser?.isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(user.id, 'name', user.name || "")}
                            className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            title="Edit name"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">{t('admin.userType')}:</span>
                    <Select 
                      value={getUserType(user)} 
                      onValueChange={(value) => handleChangeUserType(user.id, user.email, value)}
                      disabled={
                        (user.email === SUPER_ADMIN_EMAIL && currentUser.email !== SUPER_ADMIN_EMAIL) ||
                        (currentUser?.email === SUPER_ADMIN_EMAIL && String(user.id) === String(currentUser.id))
                      }
                    >
                      <SelectTrigger className="h-8 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">{t('admin.userType.user')}</SelectItem>
                        <SelectItem value="administratie">{t('admin.userType.administratie')}</SelectItem>
                        <SelectItem value="admin">{t('admin.userType.admin')}</SelectItem>
                        <SelectItem value="weekly_only">{t('admin.userType.weeklyOnly')}</SelectItem>
                        {currentUser.email === SUPER_ADMIN_EMAIL && (
                          <SelectItem value="super_admin" disabled={user.email !== SUPER_ADMIN_EMAIL}>
                            {t('admin.userType.superAdmin')}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('admin.approved')}:</span>
                    <span className="text-gray-900 dark:text-gray-100">{user.approved !== false ? t('admin.yes') : t('admin.no')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('admin.mustChangePassword')}:</span>
                    <span className="text-gray-900 dark:text-gray-100">{user.must_change_password ? t('admin.yes') : t('admin.no')}</span>
                  </div>
                  {currentUser.email === SUPER_ADMIN_EMAIL && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Timebuzzer:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!user.can_use_timebuzzer}
                          onChange={(e) => handleToggleTimebuzzer(user.id, user.email, e.target.checked)}
                          className="h-3 w-3"
                        />
                        <span>{user.can_use_timebuzzer ? t('admin.yes') : t('admin.no')}</span>
                      </div>
                    </div>
                  )}
                  {currentUser.email === SUPER_ADMIN_EMAIL && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Weekly View:</span>
                      <Select 
                        value={user.weekly_view_option || 'both'} 
                        onValueChange={(value) => handleChangeWeeklyViewOption(user.id, user.email, value)}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="simple">Simple Only</SelectItem>
                          <SelectItem value="original">Original Only</SelectItem>
                          <SelectItem value="both">Both (User Choice)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('admin.daysOffLeft')}:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {(() => {
                        // Calculate hours left first (more accurate), then convert to days
                        const totalHoursTaken = daysOffMap[String(user.id)] || 0;
                        const totalHoursAvailable = totalDaysOff * 8;
                        const hoursLeft = totalHoursAvailable - totalHoursTaken;
                        const daysLeft = (hoursLeft / 8).toFixed(1);
                        const hoursLeftRounded = hoursLeft.toFixed(1);
                        return `${daysLeft} (${hoursLeftRounded} ${t('admin.hours')})`;
                      })()}
                    </span>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {resetUserId === user.id ? (
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder={t('admin.newPassword')}
                        value={resetPassword}
                        onChange={e => setResetPassword(e.target.value)}
                        className="h-9 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleResetPassword(user.id)} className="flex-1 h-9">{t('common.save')}</Button>
                        <Button size="sm" variant="outline" onClick={() => { setResetUserId(null); setResetPassword(""); }} className="flex-1 h-9">{t('common.cancel')}</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setResetUserId(user.id)} className="flex-1 h-9 text-xs">{t('admin.resetPassword')}</Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        disabled={user.id === currentUser.id || user.email === SUPER_ADMIN_EMAIL}
                        className="flex-1 h-9 text-xs"
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Input
                      type="number"
                      min="0.25"
                      step="0.25"
                      placeholder={t('admin.hours')}
                      value={daysOffInput[user.id] || ""}
                      onChange={e => setDaysOffInput(prev => ({ ...prev, [user.id]: e.target.value }))}
                      className="h-9 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAddOrDeductDaysOffClick(user.id, Math.abs(parseFloat(daysOffInput[user.id] || "0")))} className="flex-1 h-9 text-xs">
                        {t('admin.add')}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleAddOrDeductDaysOffClick(user.id, -Math.abs(parseFloat(daysOffInput[user.id] || "0")))} className="flex-1 h-9 text-xs">
                        {t('admin.subtract')}
                      </Button>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('admin.oneDayEqualsEightHours')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop: Table Layout */
            <div className="overflow-x-auto w-full">
              <table className="min-w-full border mt-2 text-sm border-gray-300 dark:border-gray-700">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <th className="p-2 text-left text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{t('admin.email')}</th>
                    <th className="p-2 text-left text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{t('admin.name')}</th>
                    <th className="p-2 text-left text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{t('admin.isAdmin')}</th>
                    <th className="p-2 text-left text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{t('admin.approved')}</th>
                    <th className="p-2 text-left text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{t('admin.mustChangePassword')}</th>
                    {currentUser.email === SUPER_ADMIN_EMAIL && (
                      <th className="p-2 text-left text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">Timebuzzer</th>
                    )}
                    {currentUser.email === SUPER_ADMIN_EMAIL && (
                      <th className="p-2 text-left text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">Weekly View</th>
                    )}
                    <th className="p-2 text-left text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{t('admin.daysOffLeft')}</th>
                    <th className="p-2 text-left text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => u.approved !== false).map(user => (
                    <tr key={user.id} className="border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <td className="p-2">
                      {editingUserId === user.id && editingField === 'email' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="email"
                            value={editedEmail}
                            onChange={(e) => setEditedEmail(e.target.value)}
                            className="h-8 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveEdit(user.id, 'email');
                              } else if (e.key === "Escape") {
                                handleCancelEdit();
                              }
                            }}
                            autoFocus
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSaveEdit(user.id, 'email')}
                            className="h-8 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/40"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEdit}
                            className="h-8 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 dark:text-gray-100">{user.email}</span>
                          {user.email === SUPER_ADMIN_EMAIL && <span className="ml-2 px-2 py-1 text-xs bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 rounded">Super Admin</span>}
                          {currentUser?.isAdmin && user.email !== SUPER_ADMIN_EMAIL && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStartEdit(user.id, 'email', user.email)}
                              className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                              title="Edit email"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-2 border border-gray-300 dark:border-gray-700">
                      {editingUserId === user.id && editingField === 'name' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            className="h-8 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveEdit(user.id, 'name');
                              } else if (e.key === "Escape") {
                                handleCancelEdit();
                              }
                            }}
                            autoFocus
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSaveEdit(user.id, 'name')}
                            className="h-8 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/40"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEdit}
                            className="h-8 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 dark:text-gray-100">{user.name}</span>
                          {currentUser?.isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStartEdit(user.id, 'name', user.name || "")}
                              className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                              title="Edit name"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-2 border border-gray-300 dark:border-gray-700">
                      <Select 
                        value={getUserType(user)} 
                        onValueChange={(value) => handleChangeUserType(user.id, user.email, value)}
                        disabled={
                          (user.email === SUPER_ADMIN_EMAIL && currentUser.email !== SUPER_ADMIN_EMAIL) ||
                          (currentUser?.email === SUPER_ADMIN_EMAIL && String(user.id) === String(currentUser.id))
                        }
                      >
                        <SelectTrigger className="h-9 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">{t('admin.userType.user')}</SelectItem>
                          <SelectItem value="administratie">{t('admin.userType.administratie')}</SelectItem>
                          <SelectItem value="admin">{t('admin.userType.admin')}</SelectItem>
                          <SelectItem value="weekly_only">{t('admin.userType.weeklyOnly')}</SelectItem>
                          {currentUser.email === SUPER_ADMIN_EMAIL && (
                            <SelectItem value="super_admin" disabled={user.email !== SUPER_ADMIN_EMAIL}>
                              {t('admin.userType.superAdmin')}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{user.approved !== false ? t('admin.yes') : t('admin.no')}</td>
                    <td className="p-2 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{user.must_change_password ? t('admin.yes') : t('admin.no')}</td>
                    {currentUser.email === SUPER_ADMIN_EMAIL && (
                      <td className="p-2 border border-gray-300 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!user.can_use_timebuzzer}
                            onChange={(e) => handleToggleTimebuzzer(user.id, user.email, e.target.checked)}
                            className="h-4 w-4"
                          />
                          <span className="text-gray-900 dark:text-gray-100">{user.can_use_timebuzzer ? t('admin.yes') : t('admin.no')}</span>
                        </div>
                      </td>
                    )}
                    {currentUser.email === SUPER_ADMIN_EMAIL && (
                      <td className="p-2 border border-gray-300 dark:border-gray-700">
                        <Select 
                          value={user.weekly_view_option || 'both'} 
                          onValueChange={(value) => handleChangeWeeklyViewOption(user.id, user.email, value)}
                        >
                          <SelectTrigger className="h-9 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="simple">Simple Only</SelectItem>
                            <SelectItem value="original">Original Only</SelectItem>
                            <SelectItem value="both">Both (User Choice)</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                    <td className="p-2 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">
                      {(() => {
                        // Calculate hours left first (more accurate), then convert to days
                        const totalHoursTaken = daysOffMap[String(user.id)] || 0;
                        const totalHoursAvailable = totalDaysOff * 8;
                        const hoursLeft = totalHoursAvailable - totalHoursTaken;
                        const daysLeft = (hoursLeft / 8).toFixed(1);
                        const hoursLeftRounded = hoursLeft.toFixed(1);
                        return `${daysLeft} (${hoursLeftRounded} ${t('admin.hours')})`;
                      })()}
                    </td>
                    <td className="p-2 border border-gray-300 dark:border-gray-700">
                      {resetUserId === user.id ? (
                        <div className="flex gap-2 items-center">
                          <Input
                            type="text"
                            placeholder={t('admin.newPassword')}
                            value={resetPassword}
                            onChange={e => setResetPassword(e.target.value)}
                            className="h-8"
                          />
                          <Button size="sm" onClick={() => handleResetPassword(user.id)}>{t('common.save')}</Button>
                          <Button size="sm" variant="outline" onClick={() => { setResetUserId(null); setResetPassword(""); }}>{t('common.cancel')}</Button>
                        </div>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setResetUserId(user.id)}>{t('admin.resetPassword')}</Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="ml-2"
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            disabled={user.id === currentUser.id || user.email === SUPER_ADMIN_EMAIL}
                            title={user.id === currentUser.id ? t('admin.youCannotDeleteOwnAccount') : user.email === SUPER_ADMIN_EMAIL ? t('admin.youCannotDeleteSuperAdmin') : t('admin.deleteUser')}
                          >
                            {t('common.delete')}
                          </Button>
                        </>
                      )}
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 mt-2">
                        <Input
                          type="number"
                          min="0.25"
                          step="0.25"
                          placeholder={t('admin.hours')}
                          value={daysOffInput[user.id] || ""}
                          onChange={e => setDaysOffInput(prev => ({ ...prev, [user.id]: e.target.value }))}
                          style={{ width: 70 }}
                          className="h-8"
                        />
                        <Button size="sm" onClick={() => handleAddOrDeductDaysOffClick(user.id, Math.abs(parseFloat(daysOffInput[user.id] || "0")))}>
                          {t('admin.add')}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleAddOrDeductDaysOffClick(user.id, -Math.abs(parseFloat(daysOffInput[user.id] || "0")))}>
                          {t('admin.subtract')}
                        </Button>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{t('admin.oneDayEqualsEightHours')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      )}
        </TabsContent>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="space-y-6">
          {/* Send Reminder Section - Available for admin and administratie */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="text-base sm:text-lg font-semibold mb-3 text-blue-800 dark:text-blue-200">{t('admin.sendReminder')}</h3>
            <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 mb-4">{t('admin.sendReminderDescription')}</p>
            <div className="mb-4">
              <Label className="text-sm font-semibold mb-2 block">{t('admin.selectUsers')}</Label>
              <div className="max-h-48 overflow-y-auto border rounded-lg p-3 bg-white dark:bg-gray-700">
                {users.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.noUsers')}</p>
                ) : (
                  <div className="space-y-2">
                    {users.map(user => (
                      <div key={user.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`reminder-user-${user.id}`}
                          checked={reminderUserIds.includes(user.id.toString())}
                          onChange={() => toggleReminderUser(user.id.toString())}
                          className="h-4 w-4"
                        />
                        <Label htmlFor={`reminder-user-${user.id}`} className="text-sm cursor-pointer text-gray-900 dark:text-gray-100">
                          {user.name || user.email} {user.isAdmin && <span className="text-xs text-blue-600 dark:text-blue-400">(Admin)</span>}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {reminderUserIds.length > 0 && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">{reminderUserIds.length} user(s) selected</p>
              )}
            </div>
            <div className={`flex ${isMobile ? 'flex-col' : 'flex-row flex-wrap'} gap-3 sm:gap-4 ${isMobile ? '' : 'items-end'} w-full`}>
              <div className={isMobile ? 'w-full' : ''}>
                <Label className="text-sm">{t('admin.weekNumber')}</Label>
                <Input 
                  type="number" 
                  value={reminderWeekNumber} 
                  onChange={e => setReminderWeekNumber(e.target.value)} 
                  placeholder={t('admin.weekNumberPlaceholder')}
                  min="1"
                  max="53"
                  className="h-10 sm:h-9"
                />
              </div>
              <div className={isMobile ? 'w-full' : ''}>
                <Label className="text-sm">{t('admin.year')}</Label>
                <Input 
                  type="number" 
                  value={reminderYear} 
                  onChange={e => setReminderYear(e.target.value)} 
                  placeholder={t('admin.yearPlaceholder')}
                  min="2020"
                  max="2100"
                  className="h-10 sm:h-9"
                />
              </div>
              <Button 
                onClick={handleSendReminder}
                className={`${isMobile ? 'w-full' : ''} h-10 sm:h-9 bg-blue-600 hover:bg-blue-700`}
                size={isMobile ? "lg" : "default"}
                disabled={reminderUserIds.length === 0 || !reminderWeekNumber || !reminderYear}
              >
                {t('admin.sendReminderButton')}{reminderUserIds.length > 0 ? ` (${reminderUserIds.length})` : ''}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Weeks Tab - Only for admins, not for administratie users (they access it via header) */}
        {currentUser?.isAdmin && !isAdministratie(currentUser) && (
        <TabsContent value="weeks" className="space-y-6">
          {/* All Confirmed Weeks Section - Available for admin */}
          {currentUser?.isAdmin && (() => {
            // Process all confirmed weeks into a flat array with computed data
            const processedWeeks = confirmedWeeks
              .filter(cw => cw.confirmed)
              .map((cw) => {
                    const storedDate = new Date(cw.week_start_date);
                    const isoWeekMonday = getISOWeekMonday(storedDate);
                    const weekStart = isoWeekMonday;
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    const weekNum = getISOWeekNumber(weekStart);
                    const weekStartStr = formatDateToYYYYMMDD(weekStart);
                    const weekEndStr = formatDateToYYYYMMDD(weekEnd);
                    const weekEntries = allEntries.filter(
                      e => e.user_id === cw.user_id && 
                      e.date >= weekStartStr && 
                      e.date <= weekEndStr &&
                      e.startTime && e.endTime
                    );
                    const totalHours = weekEntries.reduce((sum, e) => sum + (isBreakEntry(e) ? 0 : Number(e.hours || 0)), 0);
                const user = usersMap[cw.user_id];
                const userName = user?.name || user?.email || 'Unknown';
                const status = cw.admin_approved ? 'approved' : cw.admin_reviewed ? 'rejected' : 'pending';
                
                return {
                  ...cw,
                  weekStart,
                  weekEnd,
                  weekNum,
                  totalHours,
                  entryCount: weekEntries.length,
                  userName,
                  status,
                  weekStartDateStr: weekStartStr
                };
              });

            // Calculate current week and previous week for default filtering
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const currentWeekMonday = getISOWeekMonday(today);
            const previousWeekMonday = new Date(currentWeekMonday);
            previousWeekMonday.setDate(previousWeekMonday.getDate() - 7);
            
            // Apply filters
            let filteredWeeks = processedWeeks.filter((week) => {
              const hasSearchQuery = confirmedWeeksSearch.trim().length > 0;
              
              // If no search query, only show current week and previous week
              if (!hasSearchQuery) {
                const weekMondayStr = formatDateToYYYYMMDD(week.weekStart);
                const currentWeekStr = formatDateToYYYYMMDD(currentWeekMonday);
                const previousWeekStr = formatDateToYYYYMMDD(previousWeekMonday);
                
                // Only show if it's the current week or previous week
                if (weekMondayStr !== currentWeekStr && weekMondayStr !== previousWeekStr) {
                  return false;
                }
              } else {
                // If there's a search query, apply search filter
                const searchLower = confirmedWeeksSearch.toLowerCase();
                const matchesSearch = 
                  week.userName.toLowerCase().includes(searchLower) ||
                  week.weekNum.toString().includes(searchLower) ||
                  week.weekStart.toLocaleDateString('nl-NL').toLowerCase().includes(searchLower) ||
                  week.weekEnd.toLocaleDateString('nl-NL').toLowerCase().includes(searchLower);
                if (!matchesSearch) return false;
              }
              
              // Status filter
              if (confirmedWeeksStatusFilter !== 'all' && week.status !== confirmedWeeksStatusFilter) {
                return false;
              }
              
              // User filter
              if (confirmedWeeksUserFilter !== 'all' && week.user_id !== confirmedWeeksUserFilter) {
                return false;
              }
              
              return true;
            });

            // Apply sorting
            filteredWeeks.sort((a, b) => {
              let comparison = 0;
              switch (confirmedWeeksSortBy) {
                case 'user':
                  comparison = a.userName.localeCompare(b.userName);
                  break;
                case 'week':
                  comparison = a.weekNum - b.weekNum;
                  if (comparison === 0) {
                    comparison = a.weekStart.getTime() - b.weekStart.getTime();
                  }
                  break;
                case 'date':
                  comparison = a.weekStart.getTime() - b.weekStart.getTime();
                  break;
                case 'hours':
                  comparison = a.totalHours - b.totalHours;
                  break;
                case 'status':
                  const statusOrder = { 'approved': 1, 'pending': 2, 'rejected': 3 };
                  comparison = (statusOrder[a.status as keyof typeof statusOrder] || 0) - (statusOrder[b.status as keyof typeof statusOrder] || 0);
                  break;
              }
              return confirmedWeeksSortOrder === 'asc' ? comparison : -comparison;
            });

            // Pagination
            const totalPages = Math.ceil(filteredWeeks.length / confirmedWeeksPerPage);
            const startIndex = (confirmedWeeksPage - 1) * confirmedWeeksPerPage;
            const paginatedWeeks = filteredWeeks.slice(startIndex, startIndex + confirmedWeeksPerPage);

            const handleSort = (column: typeof confirmedWeeksSortBy) => {
              if (confirmedWeeksSortBy === column) {
                setConfirmedWeeksSortOrder(confirmedWeeksSortOrder === 'asc' ? 'desc' : 'asc');
              } else {
                setConfirmedWeeksSortBy(column);
                setConfirmedWeeksSortOrder('desc');
              }
              setConfirmedWeeksPage(1); // Reset to first page when sorting changes
            };

            const SortIcon = ({ column }: { column: typeof confirmedWeeksSortBy }) => {
              if (confirmedWeeksSortBy !== column) {
                return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
              }
              return confirmedWeeksSortOrder === 'asc' 
                ? <ArrowUp className="h-3 w-3 ml-1" />
                : <ArrowDown className="h-3 w-3 ml-1" />;
            };
                    
                    return (
              <div>
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-green-600 dark:text-green-400">{t('admin.allConfirmedWeeks')}</h3>
                
                {/* Filters and Search */}
                <div className="mb-4 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search */}
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder={t('admin.searchWeeks') || "Search by user, week number, or date..."}
                        value={confirmedWeeksSearch}
                        onChange={(e) => {
                          setConfirmedWeeksSearch(e.target.value);
                          setConfirmedWeeksPage(1);
                        }}
                        className="pl-10"
                      />
                    </div>
                    
                    {/* Status Filter */}
                    <Select
                      value={confirmedWeeksStatusFilter}
                      onValueChange={(value: 'all' | 'approved' | 'pending' | 'rejected') => {
                        setConfirmedWeeksStatusFilter(value);
                        setConfirmedWeeksPage(1);
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('admin.allStatuses') || "All Statuses"}</SelectItem>
                        <SelectItem value="approved">{t('admin.approvedStatus')}</SelectItem>
                        <SelectItem value="pending">{t('admin.pendingReviewStatus')}</SelectItem>
                        <SelectItem value="rejected">{t('admin.rejectedStatus')}</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {/* User Filter */}
                    <Select
                      value={confirmedWeeksUserFilter}
                      onValueChange={(value) => {
                        setConfirmedWeeksUserFilter(value);
                        setConfirmedWeeksPage(1);
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder={t('admin.allUsers') || "All Users"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('admin.allUsers') || "All Users"}</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name || user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                            </div>
                  
                  {/* Results count */}
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {confirmedWeeksSearch.trim() ? (
                      <>
                        {filteredWeeks.length} {filteredWeeks.length === 1 ? t('admin.week') || 'week' : t('admin.weeks') || 'weeks'} {filteredWeeks.length !== confirmedWeeks.filter(cw => cw.confirmed).length && `(${confirmedWeeks.filter(cw => cw.confirmed).length} total)`}
                      </>
                    ) : (
                      <>
                      </>
                    )}
                            </div>
                </div>

                {/* Table */}
                {paginatedWeeks.length > 0 ? (
                  <>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead 
                              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                              onClick={() => handleSort('user')}
                            >
                              <div className="flex items-center">
                                {t('admin.user') || "User"}
                                <SortIcon column="user" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                              onClick={() => handleSort('week')}
                            >
                              <div className="flex items-center">
                                {t('admin.week') || "Week"}
                                <SortIcon column="week" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                              onClick={() => handleSort('date')}
                            >
                              <div className="flex items-center">
                                {t('admin.dateRange') || "Date Range"}
                                <SortIcon column="date" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                              onClick={() => handleSort('hours')}
                            >
                              <div className="flex items-center">
                                {t('admin.total') || "Total Hours"}
                                <SortIcon column="hours" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                              onClick={() => handleSort('status')}
                            >
                              <div className="flex items-center">
                                {t('admin.status') || "Status"}
                                <SortIcon column="status" />
                              </div>
                            </TableHead>
                            <TableHead className="text-right">{t('admin.actions') || "Actions"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedWeeks.map((week) => (
                            <TableRow 
                              key={`${week.user_id}-${week.week_start_date}`}
                              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                              onClick={() => setSelectedWeekForView({ userId: week.user_id, weekStartDate: week.week_start_date })}
                            >
                              <TableCell className="font-medium">{week.userName}</TableCell>
                              <TableCell>Week {week.weekNum}</TableCell>
                              <TableCell>
                                {week.weekStart.toLocaleDateString('nl-NL')} - {week.weekEnd.toLocaleDateString('nl-NL')}
                              </TableCell>
                              <TableCell>
                                {week.totalHours.toFixed(2)} ({week.entryCount} {t('admin.entries') || 'entries'})
                              </TableCell>
                              <TableCell>
                                {week.status === 'approved' ? (
                                <span className="text-green-600 dark:text-green-400 font-semibold">{t('admin.approvedStatus')}</span>
                                ) : week.status === 'rejected' ? (
                                <span className="text-orange-600 dark:text-orange-400 font-semibold">{t('admin.rejectedStatus')}</span>
                              ) : (
                                <span className="text-orange-600 dark:text-orange-400 font-semibold">{t('admin.pendingReviewStatus')}</span>
                              )}
                              </TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-end gap-2">
                                  {!week.admin_reviewed && (
                                    <>
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700 h-8"
                                        onClick={() => handleApproveWeek(week.user_id, week.week_start_date)}
                              >
                                {t('admin.approveButton')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-orange-600 dark:border-orange-500 text-orange-600 dark:text-white-400 hover:bg-red-100 dark:hover:bg-red-900/40 h-8"
                                        onClick={() => handleRejectWeek(week.user_id, week.week_start_date)}
                              >
                                {t('admin.rejectButton')}
                              </Button>
                                    </>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-600 dark:border-orange-500 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 h-8"
                                    onClick={() => handleUnlockWeek(week.user_id, week.week_start_date)}
                            >
                              {t('admin.unlockButton')}
                            </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8"
                                    onClick={() => setSelectedWeekForView({ userId: week.user_id, weekStartDate: week.week_start_date })}
                                  >
                                    <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                        </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-4">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious 
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (confirmedWeeksPage > 1) {
                                    setConfirmedWeeksPage(confirmedWeeksPage - 1);
                                  }
                                }}
                                className={confirmedWeeksPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                              />
                            </PaginationItem>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setConfirmedWeeksPage(page);
                                  }}
                                  isActive={page === confirmedWeeksPage}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            ))}
                            <PaginationItem>
                              <PaginationNext 
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (confirmedWeeksPage < totalPages) {
                                    setConfirmedWeeksPage(confirmedWeeksPage + 1);
                                  }
                                }}
                                className={confirmedWeeksPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </>
                ) : (
            <div className="text-gray-400 dark:text-gray-500 text-center italic p-6 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    {confirmedWeeks.filter(cw => cw.confirmed).length === 0 
                      ? t('admin.noConfirmedWeeks')
                      : t('admin.noWeeksMatchFilters') || "No weeks match your filters"}
            </div>
          )}
        </div>
            );
          })()}
        </TabsContent>
        )}
      
      {/* Weeks Content for administratie users when accessed via header (hideTabs=true, initialTab="weeks") */}
      {isAdministratie(currentUser) && hideTabs && activeTab === 'weeks' && (() => {
        // Process all confirmed weeks into a flat array with computed data
        const processedWeeks = confirmedWeeks
          .filter(cw => cw.confirmed)
          .map((cw) => {
                const storedDate = new Date(cw.week_start_date);
                const isoWeekMonday = getISOWeekMonday(storedDate);
                const weekStart = isoWeekMonday;
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                const weekNum = getISOWeekNumber(weekStart);
                const weekStartStr = formatDateToYYYYMMDD(weekStart);
                const weekEndStr = formatDateToYYYYMMDD(weekEnd);
                const weekEntries = allEntries.filter(
                  e => e.user_id === cw.user_id && 
                  e.date >= weekStartStr && 
                  e.date <= weekEndStr &&
                  e.startTime && e.endTime
                );
                const totalHours = weekEntries.reduce((sum, e) => sum + (isBreakEntry(e) ? 0 : Number(e.hours || 0)), 0);
            const user = usersMap[cw.user_id];
            const userName = user?.name || user?.email || 'Unknown';
            const status = cw.admin_approved ? 'approved' : cw.admin_reviewed ? 'rejected' : 'pending';
            
            return {
              ...cw,
              weekStart,
              weekEnd,
              weekNum,
              totalHours,
              entryCount: weekEntries.length,
              userName,
              status,
              weekStartDateStr: weekStartStr
            };
          });

        // Calculate current week and previous week for default filtering
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentWeekMonday = getISOWeekMonday(today);
        const previousWeekMonday = new Date(currentWeekMonday);
        previousWeekMonday.setDate(previousWeekMonday.getDate() - 7);
        
        // Apply filters
        let filteredWeeks = processedWeeks.filter((week) => {
          const hasSearchQuery = confirmedWeeksSearch.trim().length > 0;
          
          // If no search query, only show current week and previous week
          if (!hasSearchQuery) {
            const weekMondayStr = formatDateToYYYYMMDD(week.weekStart);
            const currentWeekStr = formatDateToYYYYMMDD(currentWeekMonday);
            const previousWeekStr = formatDateToYYYYMMDD(previousWeekMonday);
            
            // Only show if it's the current week or previous week
            if (weekMondayStr !== currentWeekStr && weekMondayStr !== previousWeekStr) {
              return false;
            }
          } else {
            // If there's a search query, apply search filter
            const searchLower = confirmedWeeksSearch.toLowerCase();
            const matchesSearch = 
              week.userName.toLowerCase().includes(searchLower) ||
              week.weekNum.toString().includes(searchLower) ||
              week.weekStart.toLocaleDateString('nl-NL').toLowerCase().includes(searchLower) ||
              week.weekEnd.toLocaleDateString('nl-NL').toLowerCase().includes(searchLower);
            if (!matchesSearch) return false;
          }
          
          // Status filter
          if (confirmedWeeksStatusFilter !== 'all' && week.status !== confirmedWeeksStatusFilter) {
            return false;
          }
          
          // User filter
          if (confirmedWeeksUserFilter !== 'all' && week.user_id !== confirmedWeeksUserFilter) {
            return false;
          }
          
          return true;
        });

        // Apply sorting
        filteredWeeks.sort((a, b) => {
          let comparison = 0;
          switch (confirmedWeeksSortBy) {
            case 'user':
              comparison = a.userName.localeCompare(b.userName);
              break;
            case 'week':
              comparison = a.weekNum - b.weekNum;
              if (comparison === 0) {
                comparison = a.weekStart.getTime() - b.weekStart.getTime();
              }
              break;
            case 'date':
              comparison = a.weekStart.getTime() - b.weekStart.getTime();
              break;
            case 'hours':
              comparison = a.totalHours - b.totalHours;
              break;
            case 'status':
              const statusOrder = { 'approved': 1, 'pending': 2, 'rejected': 3 };
              comparison = (statusOrder[a.status as keyof typeof statusOrder] || 0) - (statusOrder[b.status as keyof typeof statusOrder] || 0);
              break;
          }
          return confirmedWeeksSortOrder === 'asc' ? comparison : -comparison;
        });

        // Pagination
        const totalPages = Math.ceil(filteredWeeks.length / confirmedWeeksPerPage);
        const startIndex = (confirmedWeeksPage - 1) * confirmedWeeksPerPage;
        const paginatedWeeks = filteredWeeks.slice(startIndex, startIndex + confirmedWeeksPerPage);

        const handleSort = (column: typeof confirmedWeeksSortBy) => {
          if (confirmedWeeksSortBy === column) {
            setConfirmedWeeksSortOrder(confirmedWeeksSortOrder === 'asc' ? 'desc' : 'asc');
          } else {
            setConfirmedWeeksSortBy(column);
            setConfirmedWeeksSortOrder('desc');
          }
          setConfirmedWeeksPage(1); // Reset to first page when sorting changes
        };

        const SortIcon = ({ column }: { column: typeof confirmedWeeksSortBy }) => {
          if (confirmedWeeksSortBy !== column) {
            return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
          }
          return confirmedWeeksSortOrder === 'asc' 
            ? <ArrowUp className="h-3 w-3 ml-1" />
            : <ArrowDown className="h-3 w-3 ml-1" />;
        };
                
                return (
          <div className="space-y-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-green-600 dark:text-green-400">{t('admin.allConfirmedWeeks')}</h3>
            
            {/* Filters and Search */}
            <div className="mb-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder={t('admin.searchWeeks') || "Search by user, week number, or date..."}
                    value={confirmedWeeksSearch}
                    onChange={(e) => {
                      setConfirmedWeeksSearch(e.target.value);
                      setConfirmedWeeksPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
                
                {/* Status Filter */}
                <Select
                  value={confirmedWeeksStatusFilter}
                  onValueChange={(value: 'all' | 'approved' | 'pending' | 'rejected') => {
                    setConfirmedWeeksStatusFilter(value);
                    setConfirmedWeeksPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.allStatuses') || "All Statuses"}</SelectItem>
                    <SelectItem value="approved">{t('admin.approvedStatus')}</SelectItem>
                    <SelectItem value="pending">{t('admin.pendingReviewStatus')}</SelectItem>
                    <SelectItem value="rejected">{t('admin.rejectedStatus')}</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* User Filter */}
                <Select
                  value={confirmedWeeksUserFilter}
                  onValueChange={(value) => {
                    setConfirmedWeeksUserFilter(value);
                    setConfirmedWeeksPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder={t('admin.allUsers') || "All Users"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.allUsers') || "All Users"}</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                        </div>
              
              {/* Results count */}
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {confirmedWeeksSearch.trim() ? (
                  <>
                    {filteredWeeks.length} {filteredWeeks.length === 1 ? t('admin.week') || 'week' : t('admin.weeks') || 'weeks'} {filteredWeeks.length !== confirmedWeeks.filter(cw => cw.confirmed).length && `(${confirmedWeeks.filter(cw => cw.confirmed).length} total)`}
                  </>
                ) : (
                  <>
                  </>
                )}
                        </div>
            </div>

            {/* Table */}
            {paginatedWeeks.length > 0 ? (
              <>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                          onClick={() => handleSort('user')}
                        >
                          <div className="flex items-center">
                            {t('admin.user') || "User"}
                            <SortIcon column="user" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                          onClick={() => handleSort('week')}
                        >
                          <div className="flex items-center">
                            {t('admin.week') || "Week"}
                            <SortIcon column="week" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                          onClick={() => handleSort('date')}
                        >
                          <div className="flex items-center">
                            {t('admin.dateRange') || "Date Range"}
                            <SortIcon column="date" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                          onClick={() => handleSort('hours')}
                        >
                          <div className="flex items-center">
                            {t('admin.total') || "Total Hours"}
                            <SortIcon column="hours" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                          onClick={() => handleSort('status')}
                        >
                          <div className="flex items-center">
                            {t('admin.status') || "Status"}
                            <SortIcon column="status" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right">{t('admin.actions') || "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedWeeks.map((week) => (
                        <TableRow 
                          key={`${week.user_id}-${week.week_start_date}`}
                          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                          onClick={() => setSelectedWeekForView({ userId: week.user_id, weekStartDate: week.week_start_date })}
                        >
                          <TableCell className="font-medium">{week.userName}</TableCell>
                          <TableCell>Week {week.weekNum}</TableCell>
                          <TableCell>
                            {week.weekStart.toLocaleDateString('nl-NL')} - {week.weekEnd.toLocaleDateString('nl-NL')}
                          </TableCell>
                          <TableCell>
                            {week.totalHours.toFixed(2)} ({week.entryCount} {t('admin.entries') || 'entries'})
                          </TableCell>
                          <TableCell>
                            {week.status === 'approved' ? (
                            <span className="text-green-600 dark:text-green-400 font-semibold">{t('admin.approvedStatus')}</span>
                            ) : week.status === 'rejected' ? (
                            <span className="text-orange-600 dark:text-orange-400 font-semibold">{t('admin.rejectedStatus')}</span>
                          ) : (
                            <span className="text-orange-600 dark:text-orange-400 font-semibold">{t('admin.pendingReviewStatus')}</span>
                          )}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-2">
                              {!week.admin_reviewed && (
                                <>
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600 hover:bg-green-700 h-8"
                                    onClick={() => handleApproveWeek(week.user_id, week.week_start_date)}
                          >
                            {t('admin.approveButton')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-orange-600 dark:border-orange-500 text-orange-600 dark:text-white-400 hover:bg-red-100 dark:hover:bg-red-900/40 h-8"
                                    onClick={() => handleRejectWeek(week.user_id, week.week_start_date)}
                          >
                            {t('admin.rejectButton')}
                          </Button>
                                </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-600 dark:border-orange-500 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 h-8"
                                onClick={() => handleUnlockWeek(week.user_id, week.week_start_date)}
                        >
                          {t('admin.unlockButton')}
                        </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8"
                                onClick={() => setSelectedWeekForView({ userId: week.user_id, weekStartDate: week.week_start_date })}
                              >
                                <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                    </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (confirmedWeeksPage > 1) {
                                setConfirmedWeeksPage(confirmedWeeksPage - 1);
                              }
                            }}
                            className={confirmedWeeksPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setConfirmedWeeksPage(page);
                              }}
                              isActive={page === confirmedWeeksPage}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext 
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (confirmedWeeksPage < totalPages) {
                                setConfirmedWeeksPage(confirmedWeeksPage + 1);
                              }
                            }}
                            className={confirmedWeeksPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            ) : (
        <div className="text-gray-400 dark:text-gray-500 text-center italic p-6 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                {confirmedWeeks.filter(cw => cw.confirmed).length === 0 
                  ? t('admin.noConfirmedWeeks')
                  : t('admin.noWeeksMatchFilters') || "No weeks match your filters"}
        </div>
      )}
    </div>
          );
        })()}
      
      {/* Below user table: User Weekly Entries Accordion - Only for admins, not for administratie */}
      {currentUser?.isAdmin && !isAdministratie(currentUser) && (
      <div className="mt-8 sm:mt-12">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">{t('admin.viewUserWeeklyEntries')}</h3>
        <Accordion type="multiple" className="w-full">
          {users.map(user => {
            // Group this user's entries by week
            // Filter out admin adjustments (entries without startTime/endTime are admin adjustments)
            // Only show entries that have both startTime and endTime - these are user-created entries
            const userEntries = allEntries.filter(e => e.user_id === user.id && e.startTime && e.endTime);
            const weeks: Record<string, any[]> = {};
            userEntries.forEach(e => {
              const week = getISOWeek(e.date);
              if (!weeks[week]) weeks[week] = [];
              weeks[week].push(e);
            });
            // Sort entries within each week by day of week (Monday to Sunday), then by startTime
            Object.keys(weeks).forEach(week => {
              weeks[week].sort((a, b) => {
                // First sort by day of week (Monday = 0, Sunday = 6)
                const dayA = getDayOfWeekIndex(a.date);
                const dayB = getDayOfWeekIndex(b.date);
                if (dayA !== dayB) return dayA - dayB;
                // If same day, sort by startTime
                const timeA = a.startTime || "00:00";
                const timeB = b.startTime || "00:00";
                return timeA.localeCompare(timeB);
              });
            });
            // Sort weeks descending (most recent first)
            const weekKeys = Object.keys(weeks).sort((a, b) => b.localeCompare(a));
            return (
              <AccordionItem key={user.id} value={user.id} className="border rounded-lg mb-4 shadow bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <AccordionTrigger className="px-4 py-3 font-medium bg-gray-50 dark:bg-gray-700 flex items-center gap-2">
                  <User className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  <span className="text-base font-semibold text-gray-900 dark:text-gray-100">{user.name || user.email}</span>
                </AccordionTrigger>
                <AccordionContent className="bg-white dark:bg-gray-800">
                  <Accordion type="multiple">
                    {weekKeys.length === 0 ? (
                      <div className="p-6 text-gray-400 dark:text-gray-500 text-center italic">{t('admin.noEntriesForUser')}</div>
                    ) : (
                      weekKeys.map(week => (
                        <AccordionItem key={week} value={week} className="border rounded mb-3 shadow-sm bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800">
                          <AccordionTrigger className="px-4 py-2 font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                            <Calendar className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                            <span>{week}</span>
                          </AccordionTrigger>
                          <AccordionContent className="bg-white dark:bg-gray-800 rounded-b-lg">
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm border rounded-lg shadow-sm border-gray-300 dark:border-gray-700">
                                <thead className="sticky top-0 bg-orange-100 dark:bg-orange-900/50 z-10">
                                  <tr>
                                    <th className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('admin.date')}</th>
                                    <th className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('weekly.project')}</th>
                                    <th className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('weekly.hours')}</th>
                                    <th className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('admin.workType')}</th>
                                    <th className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('admin.description')}</th>
                                    <th className="p-1 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('admin.startEnd')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {weeks[week].map((entry, idx) => (
                                    <tr key={entry.id || idx} className="border-t border-gray-300 dark:border-gray-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors bg-white dark:bg-gray-800">
                                      <td className="p-2 border border-gray-300 dark:border-gray-700 whitespace-nowrap text-gray-900 dark:text-gray-100">{formatDateWithDayName(entry.date)}</td>
                                      <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{entry.projects?.name || projectsMap[entry.project_id] || entry.project || "-"}</td>
                                      <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{entry.hours}</td>
                                      <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{entry.description}</td>
                                      <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{entry.notes || ""}</td>
                                      <td className="p-1 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{entry.startTime && entry.endTime ? `${entry.startTime} - ${entry.endTime}` : '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))
                    )}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
      )}

      {/* Export Section - Available for admin and administratie */}
      {isAdminOrAdministratie(currentUser) && (
      <div className="mt-8 sm:mt-12 mb-6 sm:mb-8 p-4 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg">
        <h3 className="text-base sm:text-lg font-semibold mb-3 text-orange-800 dark:text-orange-200 flex items-center gap-2">
          <Download className="h-5 w-5" />
          {t('export.title')}
        </h3>
        <p className="text-xs sm:text-sm text-orange-700 dark:text-orange-300 mb-4">
          {t('export.description')}
        </p>
        
        {/* User Selection Dropdown */}
        <div className="mb-4 bg-white dark:bg-gray-700 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
          <Label className="block text-sm font-medium text-orange-900 dark:text-orange-100 mb-2">
            {t('export.selectUser')}
          </Label>
          <Select value={selectedExportUserId || "all"} onValueChange={(value) => setSelectedExportUserId(value === "all" ? "" : value)}>
            <SelectTrigger className="w-full bg-white dark:bg-gray-800">
              <SelectValue placeholder={t('export.allUsers')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('export.allUsers')}</SelectItem>
              {users && users.length > 0 && users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-orange-700 dark:text-orange-300 mt-2">
            {t('export.selectUserHelp')}
          </p>
        </div>

        {/* Export Buttons */}
        <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'} gap-4`}>
          <div className="flex flex-col gap-2">
            <Button 
              className="h-20 flex flex-col items-center justify-center bg-orange-600 hover:bg-orange-700 text-white shadow-lg rounded-lg transition-all" 
              onClick={async () => {
                setExporting(true);
                const [{ data, error }, { data: overnightRows, error: overnightError }] = await Promise.all([
                  supabase
                    .from("timesheet")
                    .select("*, projects(name)"),
                  supabase
                    .from("overnight_stays")
                    .select("user_id, date"),
                ]);
                if (error) {
                  toast({
                    title: "Export Failed",
                    description: error.message,
                    variant: "destructive",
                  });
                  setExporting(false);
                  return;
                }
                if (overnightError) {
                  toast({
                    title: "Export Failed",
                    description: overnightError.message,
                    variant: "destructive",
                  });
                  setExporting(false);
                  return;
                }
                const rows = (data || []).map((row: any) => ({ 
                  ...row, 
                  project: row.projects?.name || "",
                  user_name: users.find((u: any) => u.id === row.user_id)?.name || "",
                  user_email: users.find((u: any) => u.id === row.user_id)?.email || ""
                }));
                // Excel export with summary (overtime + overnight)
                const computeSummaryByUser = (entries: any[]) => {
                  const byUserDate: Record<string, Record<string, number>> = {};
                  entries.forEach(e => {
                    const uid = String(e.user_id);
                    const date = String(e.date);
                    const workType = parseInt(e.description || "0");
                    if (!((workType >= 10 && workType <= 29) || workType === 100)) return;
                    const h = parseFloat(e.hours || 0) || 0;
                    if (!byUserDate[uid]) byUserDate[uid] = {};
                    byUserDate[uid][date] = (byUserDate[uid][date] || 0) + h;
                  });
                  const out: Record<string, { total: number; h125: number; h150: number; h200: number }> = {};
                  Object.keys(byUserDate).forEach(uid => {
                    let total = 0, h125 = 0, h150 = 0, h200 = 0;
                    Object.keys(byUserDate[uid]).forEach(dateStr => {
                      const totalHoursForDay = byUserDate[uid][dateStr] || 0;
                      const dow = new Date(dateStr).getDay();
                      const isSat = dow === 6;
                      const isSun = dow === 0;
                      if (isSun) { total += totalHoursForDay; h200 += totalHoursForDay; return; }
                      if (isSat) { total += totalHoursForDay; h150 += totalHoursForDay; return; }
                      const overtimeHours = totalHoursForDay > 8 ? totalHoursForDay - 8 : 0;
                      if (overtimeHours > 0) {
                        total += overtimeHours;
                        h125 += Math.min(overtimeHours, 2);
                        if (overtimeHours > 2) h150 += overtimeHours - 2;
                      }
                    });
                    out[uid] = { total, h125, h150, h200 };
                  });
                  return out;
                };

                const overnightByUser: Record<string, Set<string>> = {};
                (overnightRows || []).forEach((r: any) => {
                  const uid = String(r.user_id);
                  if (!overnightByUser[uid]) overnightByUser[uid] = new Set<string>();
                  overnightByUser[uid].add(formatDateDDMMYY(String(r.date)));
                });

                const overtimeByUser = computeSummaryByUser(data || []);

                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(rows.map((row: any) => ({
                  Date: formatDateDDMMYY(row.date),
                  Day: getDayNameNL(row.date),
                  'Work Type': getWorkTypeLabel(row.description || ""),
                  Project: row.projects?.name || row.project || "",
                  'Start Time': row.startTime || "",
                  'End Time': row.endTime || "",
                  Hours: parseFloat(row.hours || 0),
                  'Hours (HH:MM)': formatHoursHHMM(row.hours || 0),
                  Notes: row.notes || "",
                  'User Name': row.user_name || "",
                  'User Email': row.user_email || ""
                })));
                XLSX.utils.book_append_sheet(wb, ws, "Timesheet");

                const summaryRows = users.map((u: any) => {
                  const uid = String(u.id);
                  const ot = overtimeByUser[uid] || { total: 0, h125: 0, h150: 0, h200: 0 };
                  const overnightDates = Array.from(overnightByUser[uid] || []);
                  return {
                    'User Name': u.name || "",
                    'User Email': u.email || "",
                    [t('export.overtimeTotal')]: Number(ot.total.toFixed(2)),
                    [t('export.overtime125')]: Number(ot.h125.toFixed(2)),
                    [t('export.overtime150')]: Number(ot.h150.toFixed(2)),
                    [t('export.overtime200')]: Number(ot.h200.toFixed(2)),
                    [t('export.overnightStays')]: overnightDates.length,
                    [t('export.overnightDates')]: overnightDates.join(', '),
                  };
                });
                const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
                XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
                XLSX.writeFile(wb, "timesheet_all.xlsx");
                setExporting(false);
                toast({
                  title: "Export Successful",
                  description: "All timesheet data exported.",
                });
              }}
              disabled={exporting}
            >
              <FileText className="h-6 w-6 mb-2" />
              <span className="text-sm font-medium">{t('export.allData')} (Excel)</span>
            </Button>
            <Button 
              className="h-20 flex flex-col items-center justify-center bg-red-600 hover:bg-red-700 text-white shadow-lg rounded-lg transition-all" 
              onClick={async () => {
                setExporting(true);
                  const [{ data, error }, { data: overnightRows, error: overnightError }] = await Promise.all([
                    supabase
                      .from("timesheet")
                      .select("*, projects(name)")
                      .order("date", { ascending: true }),
                    supabase
                      .from("overnight_stays")
                      .select("user_id, date")
                      .order("date", { ascending: true }),
                  ]);
                if (error) {
                  toast({
                    title: "Export Failed",
                    description: error.message,
                    variant: "destructive",
                  });
                  setExporting(false);
                  return;
                }
                  if (overnightError) {
                    toast({
                      title: "Export Failed",
                      description: overnightError.message,
                      variant: "destructive",
                    });
                    setExporting(false);
                    return;
                  }

                  // Compute global overtime totals across users (user+date rules)
                  const byUserDate: Record<string, Record<string, number>> = {};
                  (data || []).forEach((e: any) => {
                    const uid = String(e.user_id);
                    const date = String(e.date);
                    const workType = parseInt(e.description || "0");
                    if (!((workType >= 10 && workType <= 29) || workType === 100)) return;
                    const h = parseFloat(e.hours || 0) || 0;
                    if (!byUserDate[uid]) byUserDate[uid] = {};
                    byUserDate[uid][date] = (byUserDate[uid][date] || 0) + h;
                  });
                  let total = 0, h125 = 0, h150 = 0, h200 = 0;
                  Object.keys(byUserDate).forEach(uid => {
                    Object.keys(byUserDate[uid]).forEach(dateStr => {
                      const totalHoursForDay = byUserDate[uid][dateStr] || 0;
                      const dow = new Date(dateStr).getDay();
                      const isSat = dow === 6;
                      const isSun = dow === 0;
                      if (isSun) { total += totalHoursForDay; h200 += totalHoursForDay; return; }
                      if (isSat) { total += totalHoursForDay; h150 += totalHoursForDay; return; }
                      const overtimeHours = totalHoursForDay > 8 ? totalHoursForDay - 8 : 0;
                      if (overtimeHours > 0) {
                        total += overtimeHours;
                        h125 += Math.min(overtimeHours, 2);
                        if (overtimeHours > 2) h150 += overtimeHours - 2;
                      }
                    });
                  });

                  const totalOvernight = (overnightRows || []).length;
                const formattedData = (data || []).map((row: any) => {
                  const user = users.find((u: any) => u.id === row.user_id);
                  return {
                    Date: formatDateDDMMYY(row.date),
                    Day: getDayNameNL(row.date),
                    'Work Type': getWorkTypeLabel(row.description || ""),
                    Project: row.projects?.name || row.project || "",
                    'Start Time': row.startTime || "",
                    'End Time': row.endTime || "",
                    Hours: typeof row.hours === 'number' ? row.hours : parseFloat(row.hours || 0),
                    'Hours (HH:MM)': formatHoursHHMM(row.hours || 0),
                    Notes: row.notes || "",
                    'User Name': user?.name || "",
                    'User Email': user?.email || "",
                  };
                });
                createPDF({
                  period: "All Data",
                    summaryLines: [
                      { label: t('export.overtimeTotal'), value: `${total.toFixed(2)}h (125% ${h125.toFixed(2)}h, 150% ${h150.toFixed(2)}h, 200% ${h200.toFixed(2)}h)` },
                      { label: t('export.overnightStays'), value: `${totalOvernight}` },
                    ],
                  data: formattedData
                }, "timesheet_all.pdf");
                setExporting(false);
                toast({
                  title: "PDF Export Successful",
                  description: "All timesheet data exported to PDF.",
                });
              }}
              disabled={exporting}
            >
              <FileDown className="h-6 w-6 mb-2" />
              <span className="text-sm font-medium">{t('export.allData')} (PDF)</span>
            </Button>
          </div>
          
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="flex gap-2 w-full">
              <Input 
                type="number" 
                min="1" 
                max="53" 
                placeholder={t('export.weekPlaceholder') || "Week (1-53)"} 
                value={selectedWeekNumber} 
                onChange={e => setSelectedWeekNumber(e.target.value)} 
                className="flex-1 border rounded px-2 py-1 text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" 
              />
              <Input 
                type="number" 
                min="2020" 
                max="2100" 
                placeholder={t('export.yearPlaceholder') || "Year"} 
                value={selectedYear} 
                onChange={e => setSelectedYear(e.target.value)} 
                className="flex-1 border rounded px-2 py-1 text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" 
              />
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Button 
                variant="outline" 
                className="h-14 w-full flex flex-col items-center justify-center border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/40 shadow-lg rounded-lg transition-all" 
                onClick={async () => {
                  if (!selectedWeekNumber || !selectedYear) {
                    toast({
                      title: "Missing Information",
                      description: "Please select a week number and year.",
                      variant: "destructive",
                    });
                    return;
                  }
                  const weekNum = parseInt(selectedWeekNumber);
                  const year = parseInt(selectedYear);
                  if (isNaN(weekNum) || weekNum < 1 || weekNum > 53) {
                    toast({
                      title: "Invalid Week Number",
                      description: "Week number must be between 1 and 53.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setExporting(true);
                  const { from, to } = getWeekDateRange(weekNum, year);
                  
                  // Get the user to export (must select a user, not "all")
                  if (!selectedExportUserId || selectedExportUserId === "all") {
                    toast({
                      title: "User Selection Required",
                      description: "Please select a specific user to export. The weekly export format requires a single user.",
                      variant: "destructive",
                    });
                    setExporting(false);
                    return;
                  }
                  
                  const selectedUser = users.find((u: any) => u.id === selectedExportUserId);
                  if (!selectedUser) {
                    toast({
                      title: "User Not Found",
                      description: "Selected user could not be found.",
                      variant: "destructive",
                    });
                    setExporting(false);
                    return;
                  }
                  
                  // Get week dates array (same as weekly entry)
                  const weekStartDate = new Date(from);
                  const weekDates = getWeekDates(weekStartDate);
                  const calculatedWeekNumber = getISOWeekNumber(weekDates[0]);
                  
                  const fromDate = formatDateToYYYYMMDD(weekDates[0]);
                  const toDate = formatDateToYYYYMMDD(weekDates[6]);
                  
                  let queryBuilder = supabase
                    .from("timesheet")
                    .select("*, projects(name)")
                    .eq("user_id", selectedExportUserId)
                    .gte("date", fromDate)
                    .lte("date", toDate)
                    .order("date", { ascending: true })
                    .order("startTime", { ascending: true });
                  
                  const { data, error } = await queryBuilder;
                  if (error) {
                    toast({
                      title: t('weekly.exportFailed') || "Export Failed",
                      description: error.message,
                      variant: "destructive",
                    });
                    setExporting(false);
                    return;
                  }

                  if (!data || data.length === 0) {
                    toast({
                      title: t('weekly.noData') || "No Data",
                      description: t('weekly.noEntriesForWeek') || "No entries found for this week.",
                      variant: "destructive",
                    });
                    setExporting(false);
                    return;
                  }

                  // Filter out admin adjustments (entries without startTime/endTime are admin adjustments)
                  // Only export entries that have both startTime and endTime - these are user-created entries
                  const filteredData = data.filter((e: any) => e.startTime && e.endTime);

                  if (filteredData.length === 0) {
                    toast({
                      title: t('weekly.noData') || "No Data",
                      description: t('weekly.noEntriesForWeek') || "No entries found for this week.",
                      variant: "destructive",
                    });
                    setExporting(false);
                    return;
                  }

                  // Group entries by day
                  const entriesByDay: Record<string, any[]> = {};
                  weekDates.forEach(date => {
                    const dateStr = formatDateToYYYYMMDD(date);
                    entriesByDay[dateStr] = filteredData.filter((entry: any) => entry.date === dateStr);
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
                  
                  // Create sheets for each day
                  weekDates.forEach((date, dayIdx) => {
                    const dateStr = formatDateToYYYYMMDD(date);
                    const dayEntries = entriesByDay[dateStr] || [];
                    const dayName = dayNamesEN[dayIdx];
                    const formattedDate = formatDateDDMMYY(dateStr);
                    
                    // Calculate total hours for the day
                    const totalHours = dayEntries.reduce((sum: number, entry: any) => sum + (isBreakEntry(entry) ? 0 : (parseFloat(entry.hours) || 0)), 0);
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
                    worksheet.getColumn(1).width = 12; // Day
                    worksheet.getColumn(2).width = 20; // Work Type
                    worksheet.getColumn(3).width = 25; // Project Work Order
                    worksheet.getColumn(4).width = 8;  // From
                    worksheet.getColumn(5).width = 8;  // To
                    worksheet.getColumn(6).width = 15; // Hours Worked
                    worksheet.getColumn(7).width = 30; // Space for logo

                    // Add header rows
                    worksheet.getCell('A1').value = 'Employee Name:';
                    worksheet.getCell('B1').value = selectedUser.name || selectedUser.email || '';
                    
                    worksheet.getCell('A2').value = 'Date:';
                    worksheet.getCell('B2').value = `From: ${formatDateDDMMYY(fromDate)}`;
                    worksheet.getCell('D2').value = `To: ${formatDateDDMMYY(toDate)}`;
                    
                    worksheet.getCell('A3').value = 'Day:';
                    worksheet.getCell('B3').value = `${formattedDate} ${dayName}`;
                    
                    worksheet.getCell('A4').value = 'Week Number:';
                    worksheet.getCell('B4').value = calculatedWeekNumber.toString();
                    
                    worksheet.getCell('A5').value = 'Year:';
                    worksheet.getCell('B5').value = new Date(fromDate).getFullYear().toString();

                    // Add table headers (row 7)
                    const headerRow = worksheet.getRow(7);
                    headerRow.values = ['Day', 'Work Type', 'Project Work Order', 'From', 'To', 'Hours Worked'];
                    headerRow.font = { bold: true };
                    headerRow.fill = {
                      type: 'pattern',
                      pattern: 'solid',
                      fgColor: { argb: 'FFE5E5E5' }
                    };

                    // Add data rows
                    dayEntries.forEach((entry: any, idx: number) => {
                      const row = worksheet.getRow(8 + idx);
                      row.values = [
                        dayName,
                        getWorkTypeLabel(entry.description || ''),
                        entry.projects?.name || entry.project || '',
                        entry.startTime || '',
                        entry.endTime || '',
                        formatHoursHHMM(parseFloat(entry.hours) || 0),
                      ];
                    });

                    // Add total row
                    const totalRowIndex = 8 + dayEntries.length;
                    const totalRow = worksheet.getRow(totalRowIndex);
                    totalRow.getCell(2).value = t('weekly.total');
                    totalRow.getCell(2).font = { bold: true };
                    totalRow.getCell(6).value = totalHoursHHMM;
                    totalRow.getCell(6).font = { bold: true };
                  });

                  // Generate filename with user name and week number (same as weekly entry)
                  const userName = (selectedUser.name || selectedUser.email || t('common.user') || 'User').replace(/[^a-zA-Z0-9]/g, '_');
                  const filename = `${userName}_Week${calculatedWeekNumber}_${new Date(fromDate).getFullYear()}.xlsx`;
                  
                  // Write to buffer and download
                  const buffer = await workbook.xlsx.writeBuffer();
                  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = filename;
                  link.click();
                  window.URL.revokeObjectURL(url);
                  
                  setExporting(false);
                  toast({
                    title: t('weekly.exportSuccessful') || "Export Successful",
                    description: t('weekly.exportSuccessfulDescription', { weekNumber: calculatedWeekNumber, filename, dayCount: weekDates.length }) || `Week ${calculatedWeekNumber} exported successfully.`,
                  });
                }}
                disabled={exporting || !selectedWeekNumber || !selectedYear}
              >
                <CalendarIcon className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">{t('export.weekNumber')} (Excel)</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-14 w-full flex flex-col items-center justify-center border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40 shadow-lg rounded-lg transition-all" 
                onClick={async () => {
                  if (!selectedWeekNumber || !selectedYear) {
                    toast({
                      title: "Missing Information",
                      description: "Please select a week number and year.",
                      variant: "destructive",
                    });
                    return;
                  }
                  const weekNum = parseInt(selectedWeekNumber);
                  const year = parseInt(selectedYear);
                  if (isNaN(weekNum) || weekNum < 1 || weekNum > 53) {
                    toast({
                      title: "Invalid Week Number",
                      description: "Week number must be between 1 and 53.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setExporting(true);
                  const { from, to } = getWeekDateRange(weekNum, year);
                  let queryBuilder = supabase
                    .from("timesheet")
                    .select("*, projects(name)")
                    .gte("date", from)
                    .lte("date", to)
                    .order("date", { ascending: true });
                  if (selectedExportUserId && selectedExportUserId !== "all") {
                    queryBuilder = queryBuilder.eq("user_id", selectedExportUserId);
                  }
                  const { data, error } = await queryBuilder;
                  if (error) {
                    toast({
                      title: "Export Failed",
                      description: error.message,
                      variant: "destructive",
                    });
                    setExporting(false);
                    return;
                  }
                  const selectedUser = users.find((u: any) => u.id === selectedExportUserId);
                  const userLabel = selectedUser ? `_${selectedUser.name || selectedUser.email}` : "";
                  const formattedData = (data || []).map((row: any) => {
                    const user = users.find((u: any) => u.id === row.user_id);
                    return {
                      Date: formatDateDDMMYY(row.date),
                      Day: getDayNameNL(row.date),
                      'Work Type': getWorkTypeLabel(row.description || ""),
                      Project: row.projects?.name || row.project || "",
                      'Start Time': row.startTime || "",
                      'End Time': row.endTime || "",
                      Hours: typeof row.hours === 'number' ? row.hours : parseFloat(row.hours || 0),
                      'Hours (HH:MM)': formatHoursHHMM(row.hours || 0),
                      Notes: row.notes || "",
                      'User Name': user?.name || "",
                      'User Email': user?.email || "",
                    };
                  });
                  createPDF({
                    userName: selectedUser?.name || selectedUser?.email,
                    dateRange: { from: formatDateDDMMYY(from), to: formatDateDDMMYY(to) },
                    period: `Week ${weekNum}, ${year}`,
                    data: formattedData
                  }, `timesheet_Week${weekNum}_${year}${userLabel}.pdf`);
                  setExporting(false);
                  toast({
                    title: "PDF Export Successful",
                    description: `Week ${weekNum} (${year}) exported to PDF${selectedUser ? ` for ${selectedUser.name || selectedUser.email}` : ""}.`,
                  });
                }}
                disabled={exporting || !selectedWeekNumber || !selectedYear}
              >
                <FileDown className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">{t('export.weekNumber')} (PDF)</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/40 shadow-lg rounded-lg transition-all" 
              onClick={async () => {
                if (!selectedExportUserId || selectedExportUserId === "all") {
                  toast({
                    title: "No User Selected",
                    description: "Please select a user to export.",
                    variant: "destructive",
                  });
                  return;
                }
                setExporting(true);
                const { data, error } = await supabase
                  .from("timesheet")
                  .select("*, projects(name)")
                  .eq("user_id", selectedExportUserId)
                  .order("date", { ascending: true });
                if (error) {
                  toast({
                    title: "Export Failed",
                    description: error.message,
                    variant: "destructive",
                  });
                  setExporting(false);
                  return;
                }
                const selectedUser = users.find((u: any) => u.id === selectedExportUserId);
                const rows = (data || []).map((row: any) => ({ 
                  ...row, 
                  project: row.projects?.name || "",
                  user_name: selectedUser?.name || selectedUser?.email || "",
                  user_email: selectedUser?.email || ""
                }));
                const userName = selectedUser?.name || selectedUser?.email || "user";
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(rows.map((row: any) => ({
                  Date: formatDateDDMMYY(row.date),
                  Day: getDayNameNL(row.date),
                  'Work Type': getWorkTypeLabel(row.description || ""),
                  Project: row.projects?.name || row.project || "",
                  'Start Time': row.startTime || "",
                  'End Time': row.endTime || "",
                  Hours: parseFloat(row.hours || 0),
                  'Hours (HH:MM)': formatHoursHHMM(row.hours || 0),
                  Notes: row.notes || ""
                })));
                XLSX.utils.book_append_sheet(wb, ws, "Timesheet");
                XLSX.writeFile(wb, `timesheet_${userName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
                setExporting(false);
                toast({
                  title: "Export Successful",
                  description: `All data exported for ${userName}.`,
                });
              }}
              disabled={exporting || !selectedExportUserId || selectedExportUserId === "all"}
            >
              <Users className="h-6 w-6 mb-2" />
              <span className="text-sm font-medium">{t('export.perUser')} (Excel)</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40 shadow-lg rounded-lg transition-all" 
              onClick={async () => {
                if (!selectedExportUserId || selectedExportUserId === "all") {
                  toast({
                    title: "No User Selected",
                    description: "Please select a user to export.",
                    variant: "destructive",
                  });
                  return;
                }
                setExporting(true);
                const { data, error } = await supabase
                  .from("timesheet")
                  .select("*, projects(name)")
                  .eq("user_id", selectedExportUserId)
                  .order("date", { ascending: true });
                if (error) {
                  toast({
                    title: "Export Failed",
                    description: error.message,
                    variant: "destructive",
                  });
                  setExporting(false);
                  return;
                }
                const selectedUser = users.find((u: any) => u.id === selectedExportUserId);
                const userName = selectedUser?.name || selectedUser?.email || "user";
                const formattedData = (data || []).map((row: any) => {
                  return {
                    Date: formatDateDDMMYY(row.date),
                    Day: getDayNameNL(row.date),
                    'Work Type': getWorkTypeLabel(row.description || ""),
                    Project: row.projects?.name || row.project || "",
                    'Start Time': row.startTime || "",
                    'End Time': row.endTime || "",
                    Hours: typeof row.hours === 'number' ? row.hours : parseFloat(row.hours || 0),
                    'Hours (HH:MM)': formatHoursHHMM(row.hours || 0),
                    Notes: row.notes || "",
                  };
                });
                createPDF({
                  userName: userName,
                  period: "All Data",
                  data: formattedData
                }, `timesheet_${userName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
                setExporting(false);
                toast({
                  title: "PDF Export Successful",
                  description: `All data exported for ${userName}.`,
                });
              }}
              disabled={exporting || !selectedExportUserId || selectedExportUserId === "all"}
            >
              <FileDown className="h-6 w-6 mb-2" />
              <span className="text-sm font-medium">{t('export.perUser')} (PDF)</span>
            </Button>
          </div>
        </div>
        
        <div className="text-sm text-orange-800 dark:text-orange-200 bg-orange-50 dark:bg-orange-900/30 p-4 rounded-lg border border-orange-200 dark:border-orange-800 mt-4">
          <strong className="text-orange-900 dark:text-orange-100">{t('export.note')}</strong> {t('export.adminNote')}
        </div>
          </div>
          )}

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-6">
          {/* Export Section - Available for admin and administratie */}
          {isAdminOrAdministratie(currentUser) && (
          <div className="p-4 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg">
            <h3 className="text-base sm:text-lg font-semibold mb-3 text-orange-800 dark:text-orange-200 flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t('export.title')}
            </h3>
            <p className="text-xs sm:text-sm text-orange-700 dark:text-orange-300 mb-4">
              {t('export.description')}
            </p>
            
            {/* User Selection */}
            <div className="mb-4">
              <Label className="text-sm font-semibold mb-2 block">{t('export.selectUser')}</Label>
              <Select value={selectedExportUserId} onValueChange={setSelectedExportUserId}>
                <SelectTrigger className="h-10 sm:h-9">
                  <SelectValue placeholder={t('export.selectUserPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('export.allUsers')}</SelectItem>
                  {users.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Export Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-20 flex flex-col items-center justify-center border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 shadow-lg rounded-lg transition-all" 
                onClick={async () => {
                  setExporting(true);
                  try {
                    let queryBuilder = supabase
                      .from("timesheet")
                      .select("*, projects(name)")
                      .order("date", { ascending: true });
                    
                    if (selectedExportUserId && selectedExportUserId !== "all") {
                      queryBuilder = queryBuilder.eq("user_id", selectedExportUserId);
                    }
                    const { data, error } = await queryBuilder;
                    
                    if (error) {
                      toast({
                        title: "Export Failed",
                        description: error.message,
                        variant: "destructive",
                      });
                      setExporting(false);
                      return;
                    }
                    const rows = (data || []).map((row: any) => ({ 
                      ...row, 
                      project: row.projects?.name || "",
                      user_name: users.find((u: any) => u.id === row.user_id)?.name || users.find((u: any) => u.id === row.user_id)?.email || "",
                      user_email: users.find((u: any) => u.id === row.user_id)?.email || ""
                    }));
                    const wb = XLSX.utils.book_new();
                    const ws = XLSX.utils.json_to_sheet(rows.map((row: any) => ({
                      Date: formatDateDDMMYY(row.date),
                      Day: getDayNameNL(row.date),
                      'Work Type': getWorkTypeLabel(row.description || ""),
                      Project: row.projects?.name || row.project || "",
                      'Start Time': row.startTime || "",
                      'End Time': row.endTime || "",
                      Hours: parseFloat(row.hours || 0),
                      'Hours (HH:MM)': formatHoursHHMM(row.hours || 0),
                      Notes: row.notes || "",
                      'User Name': row.user_name || "",
                      'User Email': row.user_email || ""
                    })));
                    XLSX.utils.book_append_sheet(wb, ws, "Timesheet");
                    XLSX.writeFile(wb, "timesheet_all.xlsx");
                    setExporting(false);
                    toast({
                      title: "Export Successful",
                      description: "All data exported to timesheet_all.xlsx",
                    });
                  } catch (error: any) {
                    toast({
                      title: "Export Failed",
                      description: error.message,
                      variant: "destructive",
                    });
                    setExporting(false);
                  }
                }}
                disabled={exporting}
              >
                <FileText className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">{t('export.allData')} (Excel)</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex flex-col items-center justify-center border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 shadow-lg rounded-lg transition-all" 
                onClick={async () => {
                  if (!selectedExportUserId || selectedExportUserId === "all") {
                    toast({
                      title: "No User Selected",
                      description: "Please select a user to export.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setExporting(true);
                  const [{ data, error }, { data: overnightRows, error: overnightError }] = await Promise.all([
                    supabase
                      .from("timesheet")
                      .select("*, projects(name)")
                      .eq("user_id", selectedExportUserId)
                      .order("date", { ascending: true }),
                    supabase
                      .from("overnight_stays")
                      .select("date")
                      .eq("user_id", selectedExportUserId)
                      .order("date", { ascending: true }),
                  ]);
                  if (error) {
                    toast({
                      title: "Export Failed",
                      description: error.message,
                      variant: "destructive",
                    });
                    setExporting(false);
                    return;
                  }
                  if (overnightError) {
                    toast({
                      title: "Export Failed",
                      description: overnightError.message,
                      variant: "destructive",
                    });
                    setExporting(false);
                    return;
                  }
                  const selectedUser = users.find((u: any) => u.id === selectedExportUserId);
                  const rows = (data || []).map((row: any) => ({ 
                    ...row, 
                    project: row.projects?.name || "",
                    user_name: selectedUser?.name || selectedUser?.email || "",
                    user_email: selectedUser?.email || ""
                  }));
                  const userName = selectedUser?.name || selectedUser?.email || "user";

                  // Overtime summary (same rules as overtime panel)
                  const dateHoursMap: Record<string, number> = {};
                  (data || []).forEach((e: any) => {
                    const workType = parseInt(e.description || "0");
                    if (!((workType >= 10 && workType <= 29) || workType === 100)) return;
                    const h = parseFloat(e.hours || 0) || 0;
                    dateHoursMap[String(e.date)] = (dateHoursMap[String(e.date)] || 0) + h;
                  });
                  let total = 0, h125 = 0, h150 = 0, h200 = 0;
                  Object.keys(dateHoursMap).forEach(dateStr => {
                    const totalHoursForDay = dateHoursMap[dateStr] || 0;
                    const dow = new Date(dateStr).getDay();
                    const isSat = dow === 6;
                    const isSun = dow === 0;
                    if (isSun) { total += totalHoursForDay; h200 += totalHoursForDay; return; }
                    if (isSat) { total += totalHoursForDay; h150 += totalHoursForDay; return; }
                    const overtimeHours = totalHoursForDay > 8 ? totalHoursForDay - 8 : 0;
                    if (overtimeHours > 0) {
                      total += overtimeHours;
                      h125 += Math.min(overtimeHours, 2);
                      if (overtimeHours > 2) h150 += overtimeHours - 2;
                    }
                  });

                  const overnightDates = (overnightRows || []).map((r: any) => formatDateDDMMYY(String(r.date)));

                  const wb = XLSX.utils.book_new();
                  const ws = XLSX.utils.json_to_sheet(rows.map((row: any) => ({
                    Date: formatDateDDMMYY(row.date),
                    Day: getDayNameNL(row.date),
                    'Work Type': getWorkTypeLabel(row.description || ""),
                    Project: row.projects?.name || row.project || "",
                    'Start Time': row.startTime || "",
                    'End Time': row.endTime || "",
                    Hours: parseFloat(row.hours || 0),
                    'Hours (HH:MM)': formatHoursHHMM(row.hours || 0),
                    Notes: row.notes || ""
                  })));
                  XLSX.utils.book_append_sheet(wb, ws, "Timesheet");

                  const wsSummary = XLSX.utils.json_to_sheet([{
                    [t('export.overtimeTotal')]: Number(total.toFixed(2)),
                    [t('export.overtime125')]: Number(h125.toFixed(2)),
                    [t('export.overtime150')]: Number(h150.toFixed(2)),
                    [t('export.overtime200')]: Number(h200.toFixed(2)),
                    [t('export.overnightStays')]: overnightDates.length,
                    [t('export.overnightDates')]: overnightDates.join(', '),
                  }]);
                  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
                  XLSX.writeFile(wb, `timesheet_${userName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
                  setExporting(false);
                  toast({
                    title: "Export Successful",
                    description: `All data exported for ${userName}.`,
                  });
                }}
                disabled={exporting || !selectedExportUserId || selectedExportUserId === "all"}
              >
                <Users className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">{t('export.perUser')} (Excel)</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex flex-col items-center justify-center border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40 shadow-lg rounded-lg transition-all" 
                onClick={async () => {
                  if (!selectedExportUserId || selectedExportUserId === "all") {
                    toast({
                      title: "No User Selected",
                      description: "Please select a user to export.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setExporting(true);
                  const [{ data, error }, { data: overnightRows, error: overnightError }] = await Promise.all([
                    supabase
                      .from("timesheet")
                      .select("*, projects(name)")
                      .eq("user_id", selectedExportUserId)
                      .order("date", { ascending: true }),
                    supabase
                      .from("overnight_stays")
                      .select("date")
                      .eq("user_id", selectedExportUserId)
                      .order("date", { ascending: true }),
                  ]);
                  if (error) {
                    toast({
                      title: "Export Failed",
                      description: error.message,
                      variant: "destructive",
                    });
                    setExporting(false);
                    return;
                  }
                  if (overnightError) {
                    toast({
                      title: "Export Failed",
                      description: overnightError.message,
                      variant: "destructive",
                    });
                    setExporting(false);
                    return;
                  }
                  const selectedUser = users.find((u: any) => u.id === selectedExportUserId);
                  const userName = selectedUser?.name || selectedUser?.email || "user";

                  // Overtime summary (same rules as overtime panel)
                  const dateHoursMap: Record<string, number> = {};
                  (data || []).forEach((e: any) => {
                    const workType = parseInt(e.description || "0");
                    if (!((workType >= 10 && workType <= 29) || workType === 100)) return;
                    const h = parseFloat(e.hours || 0) || 0;
                    dateHoursMap[String(e.date)] = (dateHoursMap[String(e.date)] || 0) + h;
                  });
                  let total = 0, h125 = 0, h150 = 0, h200 = 0;
                  Object.keys(dateHoursMap).forEach(dateStr => {
                    const totalHoursForDay = dateHoursMap[dateStr] || 0;
                    const dow = new Date(dateStr).getDay();
                    const isSat = dow === 6;
                    const isSun = dow === 0;
                    if (isSun) { total += totalHoursForDay; h200 += totalHoursForDay; return; }
                    if (isSat) { total += totalHoursForDay; h150 += totalHoursForDay; return; }
                    const overtimeHours = totalHoursForDay > 8 ? totalHoursForDay - 8 : 0;
                    if (overtimeHours > 0) {
                      total += overtimeHours;
                      h125 += Math.min(overtimeHours, 2);
                      if (overtimeHours > 2) h150 += overtimeHours - 2;
                    }
                  });
                  const overnightDates = (overnightRows || []).map((r: any) => formatDateDDMMYY(String(r.date)));

                  const formattedData = (data || []).map((row: any) => {
                    return {
                      Date: formatDateDDMMYY(row.date),
                      Day: getDayNameNL(row.date),
                      'Work Type': getWorkTypeLabel(row.description || ""),
                      Project: row.projects?.name || row.project || "",
                      'Start Time': row.startTime || "",
                      'End Time': row.endTime || "",
                      Hours: typeof row.hours === 'number' ? row.hours : parseFloat(row.hours || 0),
                      'Hours (HH:MM)': formatHoursHHMM(row.hours || 0),
                      Notes: row.notes || "",
                    };
                  });
                  createPDF({
                    userName: userName,
                    period: "All Data",
                    summaryLines: [
                      { label: t('export.overtimeTotal'), value: `${total.toFixed(2)}h (125% ${h125.toFixed(2)}h, 150% ${h150.toFixed(2)}h, 200% ${h200.toFixed(2)}h)` },
                      { label: t('export.overnightStays'), value: `${overnightDates.length}${overnightDates.length ? ` (${overnightDates.slice(0, 20).join(', ')}${overnightDates.length > 20 ? ', ...' : ''})` : ''}` },
                    ],
                    data: formattedData
                  }, `timesheet_${userName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
                  setExporting(false);
                  toast({
                    title: "PDF Export Successful",
                    description: `All data exported for ${userName}.`,
                  });
                }}
                disabled={exporting || !selectedExportUserId || selectedExportUserId === "all"}
              >
                <FileDown className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">{t('export.perUser')} (PDF)</span>
              </Button>
            </div>
            
            <div className="text-sm text-orange-800 dark:text-orange-200 bg-orange-50 dark:bg-orange-900/30 p-4 rounded-lg border border-orange-200 dark:border-orange-800 mt-4">
              <strong className="text-orange-900 dark:text-orange-100">{t('export.note')}</strong> {t('export.adminNote')}
            </div>
          </div>
          )}
        </TabsContent>

        {/* Overtime Tab */}
        <TabsContent value="overtime" className="space-y-6">
          {/* Overtime Tracking Section - Available for admin and administratie */}
          {isAdminOrAdministratie(currentUser) && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-base sm:text-lg font-semibold mb-3 text-blue-800 dark:text-blue-200 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {t('overtime.title')}
        </h3>
        <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 mb-4">
          {t('overtime.description')}
          <br className="hidden sm:inline" />
          <strong>{t('overtime.percentageRules')}</strong>
        </p>
        
        {/* Filters */}
        <div className="mb-4 bg-white dark:bg-gray-700 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4'} gap-4 mb-4`}>
            <div>
              <Label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                {t('overtime.period')}
              </Label>
              <Select value={overtimePeriod} onValueChange={(value: any) => setOvertimePeriod(value)}>
                <SelectTrigger className="w-full bg-white dark:bg-gray-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">{t('overtime.week')}</SelectItem>
                  <SelectItem value="month">{t('overtime.month')}</SelectItem>
                  <SelectItem value="year">{t('overtime.year')}</SelectItem>
                  <SelectItem value="all">{t('overtime.all')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {overtimePeriod === "week" && (
              <>
                <div>
                  <Label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    {t('overtime.week')}
                  </Label>
                  <Input 
                    type="number" 
                    min="1" 
                    max="53" 
                    placeholder="Week (1-53)" 
                    value={overtimeSelectedWeek} 
                    onChange={e => setOvertimeSelectedWeek(e.target.value)} 
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" 
                  />
                </div>
                <div>
                  <Label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    {t('overtime.year')}
                  </Label>
                  <Input 
                    type="number" 
                    min="2020" 
                    max="2100" 
                    placeholder="Jaar" 
                    value={overtimeSelectedYear} 
                    onChange={e => setOvertimeSelectedYear(e.target.value)} 
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" 
                  />
                </div>
              </>
            )}
            
            {(overtimePeriod === "month" || overtimePeriod === "year") && (
              <div>
                <Label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  {overtimePeriod === "month" ? t('overtime.month') : t('overtime.year')}
                </Label>
                {overtimePeriod === "month" ? (
                  <Select value={overtimeSelectedMonth} onValueChange={setOvertimeSelectedMonth}>
                    <SelectTrigger className="w-full bg-white dark:bg-gray-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => {
                        const monthNum = String(i + 1).padStart(2, '0');
                        const monthName = new Date(2000, i, 1).toLocaleDateString(language === 'nl' ? 'nl-NL' : 'en-US', { month: 'long' });
                        return (
                          <SelectItem key={monthNum} value={monthNum}>
                            {monthName}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input 
                    type="number" 
                    min="2020" 
                    max="2100" 
                    placeholder={t('export.yearPlaceholder') || "Year"}
                    value={overtimeSelectedYear} 
                    onChange={e => setOvertimeSelectedYear(e.target.value)} 
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" 
                  />
                )}
              </div>
            )}
            
            {overtimePeriod === "year" && (
              <div>
                <Label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  {t('overtime.year')}
                </Label>
                <Input 
                  type="number" 
                  min="2020" 
                  max="2100" 
                  placeholder={t('export.yearPlaceholder') || "Year"}
                  value={overtimeSelectedYear} 
                  onChange={e => setOvertimeSelectedYear(e.target.value)} 
                  className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" 
                />
              </div>
            )}
            
            <div>
              <Label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                {t('common.user')}
              </Label>
              <Select value={overtimeSelectedUserId} onValueChange={setOvertimeSelectedUserId}>
                <SelectTrigger className="w-full bg-white dark:bg-gray-800">
                  <SelectValue placeholder={t('export.allUsers')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('export.allUsers')}</SelectItem>
                  {users && users.length > 0 && users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button 
            onClick={calculateOvertime}
            disabled={overtimeLoading || (overtimePeriod === "week" && (!overtimeSelectedWeek || !overtimeSelectedYear))}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
          >
            {overtimeLoading ? t('overtime.calculating') : t('overtime.calculate')}
          </Button>
        </div>

        {/* Results */}
        {overtimeData.length > 0 && (
          <div className="mt-4 space-y-4">
            {overtimeData.map((userData) => (
              <div key={userData.userId} className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-base text-gray-900 dark:text-gray-100">
                      {userData.userName}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{userData.userEmail}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600 dark:text-gray-400">{t('overtime.totalOvertime')}</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {userData.totalOvertime}h
                    </div>
                  </div>
                </div>
                
                {/* Percentage Breakdown */}
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {t('overtime.percentageBreakdown')}
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {parseFloat(userData.totalHours125 || "0") > 0 && (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-2">
                        <div className="text-xs text-orange-700 dark:text-orange-300 font-medium">125%</div>
                        <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                          {userData.totalHours125}h
                        </div>
                        <div className="text-xs text-orange-600 dark:text-orange-400">{t('overtime.hours125')}</div>
                      </div>
                    )}
                    {parseFloat(userData.totalHours150 || "0") > 0 && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2">
                        <div className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">150%</div>
                        <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                          {userData.totalHours150}h
                        </div>
                        <div className="text-xs text-yellow-600 dark:text-yellow-400">{t('overtime.hours150')}</div>
                      </div>
                    )}
                    {parseFloat(userData.totalHours200 || "0") > 0 && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
                        <div className="text-xs text-red-700 dark:text-red-300 font-medium">200%</div>
                        <div className="text-lg font-bold text-red-600 dark:text-red-400">
                          {userData.totalHours200}h
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-400">{t('overtime.hours200')}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Overnight stays */}
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t('overtime.overnightTitle')}
                    </h5>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t('overtime.overnightCount')}: {userData.totalOvernightStays || 0}
                    </div>
                  </div>
                  {userData.overnightDates?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {userData.overnightDates.map((date: string) => (
                        <span
                          key={date}
                          className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded"
                        >
                          {formatDateWithDayName(date)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {t('overtime.overnightNone')}
                    </div>
                  )}
                </div>
                
                <Accordion type="multiple" className="w-full">
                  {userData.dailyOvertime.map((day: any, idx: number) => (
                    <AccordionItem key={idx} value={`day-${userData.userId}-${idx}`} className="border border-gray-200 dark:border-gray-700 rounded-lg mb-2">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="text-left">
                            <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                              {formatDateWithDayName(day.date)}
                              {day.isWeekend && (
                                <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded">
                                  {t('overtime.weekend')}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {day.isWeekend ? (
                                <span className="text-orange-600 dark:text-orange-400">
                                  {day.totalHours}{t('overtime.totalHours')}
                                </span>
                              ) : (
                                <span>
                                  {day.totalHours}{t('overtime.totalHoursNormal', { normalHours: day.normalHours })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              +{day.overtime}h overuren
                            </div>
                            {/* Percentage breakdown for this day */}
                            <div className="flex flex-wrap gap-1 mt-1 justify-end">
                              {parseFloat(day.hours125 || "0") > 0 && (
                                <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded">
                                  125%: {day.hours125}h
                                </span>
                              )}
                              {parseFloat(day.hours150 || "0") > 0 && (
                                <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded">
                                  150%: {day.hours150}h
                                </span>
                              )}
                              {parseFloat(day.hours200 || "0") > 0 && (
                                <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
                                  200%: {day.hours200}h
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="mt-3">
                          {/* Day percentage breakdown */}
                          {(parseFloat(day.hours125 || "0") > 0 || parseFloat(day.hours150 || "0") > 0 || parseFloat(day.hours200 || "0") > 0) && (
                            <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
                              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('overtime.perDayBreakdown')}</div>
                              <div className="flex flex-wrap gap-2">
                                {parseFloat(day.hours125 || "0") > 0 && (
                                  <div className="text-xs">
                                    <span className="font-semibold text-orange-600 dark:text-orange-400">125%:</span>
                                    <span className="text-gray-900 dark:text-gray-100 ml-1">{day.hours125}h</span>
                                  </div>
                                )}
                                {parseFloat(day.hours150 || "0") > 0 && (
                                  <div className="text-xs">
                                    <span className="font-semibold text-yellow-600 dark:text-yellow-400">150%:</span>
                                    <span className="text-gray-900 dark:text-gray-100 ml-1">{day.hours150}h</span>
                                  </div>
                                )}
                                {parseFloat(day.hours200 || "0") > 0 && (
                                  <div className="text-xs">
                                    <span className="font-semibold text-red-600 dark:text-red-400">200%:</span>
                                    <span className="text-gray-900 dark:text-gray-100 ml-1">{day.hours200}h</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            Details ({day.entries?.length || 0} entries):
                          </h5>
                          {isMobile ? (
                            <div className="space-y-2">
                              {day.entries?.map((entry: any, entryIdx: number) => (
                                <div key={entryIdx} className="bg-gray-50 dark:bg-gray-700 rounded p-3 border border-gray-200 dark:border-gray-600">
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="font-semibold text-gray-700 dark:text-gray-300">Project:</span>
                                      <div className="text-gray-900 dark:text-gray-100">{entry.project}</div>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-gray-700 dark:text-gray-300">Werk Type:</span>
                                      <div className="text-gray-900 dark:text-gray-100">{entry.workTypeLabel}</div>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-gray-700 dark:text-gray-300">Tijd:</span>
                                      <div className="text-gray-900 dark:text-gray-100">
                                        {entry.startTime !== "-" && entry.endTime !== "-" 
                                          ? `${entry.startTime} - ${entry.endTime}`
                                          : "-"}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-gray-700 dark:text-gray-300">Uren:</span>
                                      <div className="text-gray-900 dark:text-gray-100 font-semibold">{entry.hours}h</div>
                                    </div>
                                    {entry.notes && (
                                      <div className="col-span-2">
                                        <span className="font-semibold text-gray-700 dark:text-gray-300">Notities:</span>
                                        <div className="text-gray-900 dark:text-gray-100">{entry.notes}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-xs border border-gray-300 dark:border-gray-700">
                                <thead className="bg-gray-100 dark:bg-gray-700">
                                  <tr>
                                    <th className="p-2 text-left border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">Project</th>
                                    <th className="p-2 text-left border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">Werk Type</th>
                                    <th className="p-2 text-left border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">Tijd</th>
                                    <th className="p-2 text-right border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">Uren</th>
                                    <th className="p-2 text-left border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">Notities</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {day.entries?.map((entry: any, entryIdx: number) => (
                                    <tr key={entryIdx} className="border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
                                      <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                                        {entry.project}
                                      </td>
                                      <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                                        {entry.workTypeLabel}
                                      </td>
                                      <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                                        {entry.startTime !== "-" && entry.endTime !== "-" 
                                          ? `${entry.startTime} - ${entry.endTime}`
                                          : "-"}
                                      </td>
                                      <td className="p-2 text-right border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 font-semibold">
                                        {entry.hours}h
                                      </td>
                                      <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-xs">
                                        {entry.notes || "-"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        )}
        
        {overtimeData.length === 0 && !overtimeLoading && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {t('overtime.clickToCalculate')}
          </div>
        )}
      </div>
      )}

        </TabsContent>

        {/* Timebuzzer Tab - Only for super admin */}
        {currentUser?.email === SUPER_ADMIN_EMAIL && (
        <TabsContent value="timebuzzer" className="space-y-6">
          {/* Timebuzzer Sync Section */}
          <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
        <h3 className="text-base sm:text-lg font-semibold mb-3 text-green-800">Timebuzzer Integration</h3>
        <p className="text-xs sm:text-sm text-green-700 mb-4">
          Sync time entries from Timebuzzer to your timesheet. Make sure users and projects are mapped in the database first.
        </p>
        
        {/* Mapping Helper Section */}
        {timebuzzerTestResult && timebuzzerTestResult.success && timebuzzerTestResult.data && timebuzzerTestResult.data.activities && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="text-sm font-semibold text-yellow-800 mb-2">⚠️ Mapping Required</h4>
            <p className="text-xs text-yellow-700 mb-2">
              Activities worden overgeslagen omdat user- of projectmappings ontbreken. Gebruik de Test API om de Timebuzzer IDs te zien, en voeg ze toe aan de database:
            </p>
            <div className="text-xs text-yellow-700 space-y-1">
              <div><strong>Voor Users:</strong> UPDATE users SET timebuzzer_user_id = 'ID' WHERE email = 'email';</div>
              <div><strong>Voor Projects:</strong> UPDATE projects SET timebuzzer_project_id = 'ID' WHERE name = 'name';</div>
            </div>
            {timebuzzerTestResult.data.activities.length > 0 && (
              <div className="mt-2 text-xs">
                <div className="font-medium">Gevonden in Test API:</div>
                <div className="mt-1 space-y-1">
                  {Array.from(new Set(timebuzzerTestResult.data.activities.map((a: any) => a.userId))).map((userId: any) => (
                    <div key={userId}>User ID: {userId} - {timebuzzerTestResult.data.activities.find((a: any) => a.userId === userId)?.userName || 'Unknown'}</div>
                  ))}
                  {Array.from(new Set(timebuzzerTestResult.data.activities.flatMap((a: any) => a.tiles || []))).map((tileId: any) => (
                    <div key={tileId}>Tile ID: {tileId} - {timebuzzerTestResult.data.activities.find((a: any) => a.tiles?.includes(tileId))?.tileNames?.[0] || 'Unknown'}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Week Number</Label>
              <Input
                type="number"
                min="1"
                max="53"
                value={timebuzzerSyncWeekNumber}
                onChange={(e) => setTimebuzzerSyncWeekNumber(parseInt(e.target.value) || 1)}
                className="h-10 sm:h-9"
                disabled={timebuzzerSyncing}
                placeholder="e.g. 51"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">Year</Label>
              <Input
                type="number"
                min="2020"
                max="2100"
                value={timebuzzerSyncYear}
                onChange={(e) => setTimebuzzerSyncYear(parseInt(e.target.value) || new Date().getFullYear())}
                className="h-10 sm:h-9"
                disabled={timebuzzerSyncing}
                placeholder="e.g. 2025"
              />
            </div>
          </div>
          {timebuzzerSyncWeekNumber && timebuzzerSyncYear && (
            <div className="text-xs text-green-600 bg-green-100 p-2 rounded">
              <span className="font-medium">Week {timebuzzerSyncWeekNumber}, {timebuzzerSyncYear}:</span> {
                (() => {
                  const range = getWeekDateRange(timebuzzerSyncWeekNumber, timebuzzerSyncYear);
                  const fromDate = new Date(range.from);
                  const toDate = new Date(range.to);
                  return `${fromDate.toLocaleDateString('nl-NL')} - ${toDate.toLocaleDateString('nl-NL')}`;
                })()
              }
            </div>
          )}
          {/* User selection for Timebuzzer testing */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Filter by User (Optional)</Label>
            <Select
              value={selectedTimebuzzerUserId || "all"}
              onValueChange={(value) => {
                console.log('User selection changed:', value);
                setSelectedTimebuzzerUserId(value === "all" ? "" : value);
              }}
            >
              <SelectTrigger className="h-10 sm:h-9">
                <SelectValue placeholder="All users (default)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users (default)</SelectItem>
                {/* Show mapped users first */}
                {users
                  .filter((u: any) => u.timebuzzer_user_id)
                  .map((user: any) => (
                    <SelectItem key={user.id} value={user.timebuzzer_user_id}>
                      {user.name || user.email} ({user.timebuzzer_user_id}) - Mapped
                    </SelectItem>
                  ))}
                {/* Then show Timebuzzer users that are not yet mapped */}
                {timebuzzerUsers
                  .filter((tbUser: any) => !users.some((u: any) => u.timebuzzer_user_id === String(tbUser.id)))
                  .map((tbUser: any) => (
                    <SelectItem key={`tb-${tbUser.id}`} value={String(tbUser.id)}>
                      {tbUser.name || tbUser.email || `User ${tbUser.id}`} ({tbUser.id}) - Not mapped
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Select a user to test Timebuzzer API for that specific user only. Shows both mapped users and Timebuzzer users. Leave empty to test for all users.
            </p>
            {timebuzzerUsers.length === 0 && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                💡 Tip: Click "Fetch All Timebuzzer Users" first to see all available users from Timebuzzer.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                setLoadingTimebuzzerUsers(true);
                setTimebuzzerUsers([]);
                try {
                  const { data, error } = await supabase.functions.invoke('timebuzzer-sync', {
                    body: { 
                      action: 'fetch-users',
                    },
                  });
                  
                  if (error) {
                    toast({
                      title: "Error",
                      description: error.message || 'Failed to fetch users from Timebuzzer',
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  if (data && data.success && data.users) {
                    setTimebuzzerUsers(data.users);
                    toast({
                      title: "Success",
                      description: `Found ${data.users.length} users in Timebuzzer`,
                    });
                  } else {
                    toast({
                      title: "Error",
                      description: data?.error || 'Failed to fetch users from Timebuzzer',
                      variant: "destructive",
                    });
                  }
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || 'Failed to fetch users from Timebuzzer',
                    variant: "destructive",
                  });
                } finally {
                  setLoadingTimebuzzerUsers(false);
                }
              }}
              disabled={loadingTimebuzzerUsers}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            >
              {loadingTimebuzzerUsers ? "Loading..." : "Fetch All Timebuzzer Users"}
            </Button>
            <Button
              onClick={async () => {
                if (!timebuzzerSyncWeekNumber || !timebuzzerSyncYear) {
                  toast({
                    title: "Error",
                    description: "Please select a week number and year",
                    variant: "destructive",
                  });
                  return;
                }
                
                setLoadingActivities(true);
                setTimebuzzerActivities([]);
                setSelectedActivityIds(new Set());
                
                try {
                  // Calculate date range from week number
                  const dateRange = getWeekDateRange(timebuzzerSyncWeekNumber, timebuzzerSyncYear);
                  
                  console.log(`Fetching Timebuzzer activities for week ${timebuzzerSyncWeekNumber}, ${timebuzzerSyncYear}`);
                  if (selectedTimebuzzerUserId) {
                    console.log(`Filtering by Timebuzzer user ID: ${selectedTimebuzzerUserId}`);
                  }
                  console.log(`Date range: ${dateRange.from} to ${dateRange.to}`);
                  
                  // Fetch activities without syncing
                  const requestBody: any = {
                    action: 'fetch-activities',
                    startDate: dateRange.from,
                    endDate: dateRange.to,
                  };
                  if (selectedTimebuzzerUserId && selectedTimebuzzerUserId !== 'all') {
                    requestBody.userId = selectedTimebuzzerUserId;
                  }
                  
                  console.log('Fetch activities request:', requestBody);
                  const { data, error } = await supabase.functions.invoke('timebuzzer-sync', {
                    body: requestBody,
                  });
                  
                  console.log('Fetch activities response:', { data, error });
                  if (data && data.activities) {
                    console.log(`Received ${data.activities.length} activities`);
                    if (selectedTimebuzzerUserId && selectedTimebuzzerUserId !== 'all' && data.activities.length === 0) {
                      console.warn(`No activities found for user ${selectedTimebuzzerUserId} in week ${timebuzzerSyncWeekNumber}, ${timebuzzerSyncYear}`);
                    }
                  }
                  
                  if (error) {
                    console.error('Fetch error:', error);
                    toast({
                      title: "Error",
                      description: error.message || 'Failed to fetch activities from Timebuzzer',
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  if (data && data.success) {
                    if (data.activities && data.activities.length > 0) {
                      setTimebuzzerActivities(data.activities);
                      // Select all by default
                      setSelectedActivityIds(new Set(data.activities.map((a: any) => a.id)));
                      
                      // Check if we have mappings by looking at user and tile IDs in activities
                      const uniqueUserIds = new Set(data.activities.map((a: any) => a.userId));
                      const uniqueTileIds = new Set(data.activities.flatMap((a: any) => a.tiles || []));
                      
                      toast({
                        title: "Activities Loaded",
                        description: `Found ${data.activities.length} activities. Select which ones to add to weekly entries.${uniqueUserIds.size > 0 || uniqueTileIds.size > 0 ? ' Make sure users and projects are mapped in the database.' : ''}`,
                      });
                    } else {
                      // No activities found
                      let description = 'No activities found for this week';
                      if (selectedTimebuzzerUserId && selectedTimebuzzerUserId !== 'all') {
                        description = `No activities found for user ${selectedTimebuzzerUserId} in week ${timebuzzerSyncWeekNumber}, ${timebuzzerSyncYear}. `;
                        description += 'This could mean: (1) The user has no activities in this date range, (2) The API key doesn\'t have access to this user\'s activities, or (3) The userId mapping is incorrect.';
                        if (data.availableUserIds && Array.isArray(data.availableUserIds) && data.availableUserIds.length > 0) {
                          description += ` Available user IDs in this date range: ${data.availableUserIds.join(', ')}`;
                        }
                      }
                      toast({
                        title: "No Activities",
                        description: description,
                        variant: "default",
                      });
                      setTimebuzzerActivities([]);
                    }
                  } else {
                    toast({
                      title: "Error",
                      description: data?.error || 'Failed to fetch activities from Timebuzzer',
                      variant: "destructive",
                    });
                    setTimebuzzerActivities([]);
                  }
                } catch (error: any) {
                  console.error('Fetch error:', error);
                  toast({
                    title: "Error",
                    description: error.message || 'Failed to fetch activities from Timebuzzer',
                    variant: "destructive",
                  });
                } finally {
                  setLoadingActivities(false);
                }
              }}
              disabled={loadingActivities || !timebuzzerSyncWeekNumber || !timebuzzerSyncYear}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
            >
              {loadingActivities ? "Loading..." : "Load Activities from Timebuzzer"}
            </Button>
            <Button
              onClick={async () => {
                setTimebuzzerSyncing(true);
                try {
                  console.log('Testing Timebuzzer API...');
                  if (selectedTimebuzzerUserId) {
                    console.log(`Filtering by Timebuzzer user ID: ${selectedTimebuzzerUserId}`);
                  }
                  const { data, error } = await supabase.functions.invoke('timebuzzer-sync', {
                    body: { 
                      action: 'test-api',
                      userId: selectedTimebuzzerUserId || undefined, // Include userId if selected
                    },
                  });
                  
                  console.log('Response:', { data, error });
                  console.log('Error details:', error ? {
                    message: error.message,
                    name: error.name,
                    context: error.context,
                    status: (error as any).status,
                    statusCode: (error as any).statusCode,
                    fullError: JSON.stringify(error, null, 2)
                  } : "No error");
                  
                  // Check if there's an error from Supabase invoke
                  // Note: Even when there's an error, data might contain the response body
                  if (error) {
                    console.error('Error details:', error);
                    // Try to extract error message from multiple sources
                    let errorMessage = 'Failed to send a request to the Edge Function';
                    let foundError = false;
                    
                    // First, check if data contains the error response (Supabase sometimes puts it there even with error)
                    if (data && typeof data === 'object') {
                      if ('error' in data && (data as any).error) {
                        errorMessage = (data as any).error;
                        // Add suggestion if available
                        if ((data as any).suggestion) {
                          errorMessage += '\n\n' + (data as any).suggestion;
                        }
                        foundError = true;
                      } else if ('message' in data && (data as any).message) {
                        errorMessage = (data as any).message;
                        if ((data as any).suggestion) {
                          errorMessage += '\n\n' + (data as any).suggestion;
                        }
                        foundError = true;
                      }
                    }
                    
                    // If we don't have a good error message yet, try to fetch it directly
                    // This is especially important for 500 errors where Supabase might not parse the response
                    if (!foundError) {
                      try {
                        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                        if (supabaseUrl && supabaseKey) {
                          console.log('Fetching error details directly from Edge Function...');
                          const response = await fetch(`${supabaseUrl}/functions/v1/timebuzzer-sync`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${supabaseKey}`,
                            },
                            body: JSON.stringify({ action: 'test-api' }),
                          });
                          
                          const responseText = await response.text();
                          console.log('Direct fetch response status:', response.status);
                          console.log('Direct fetch response body:', responseText);
                          
                          // Always try to parse the response, even if status is not 200
                          if (responseText) {
                            try {
                              const responseData = JSON.parse(responseText);
                              if (responseData.error) {
                                errorMessage = responseData.error;
                                // Add suggestion if available
                                if (responseData.suggestion) {
                                  errorMessage += '\n\n' + responseData.suggestion;
                                }
                                foundError = true;
                              } else if (responseData.message) {
                                errorMessage = responseData.message;
                                if (responseData.suggestion) {
                                  errorMessage += '\n\n' + responseData.suggestion;
                                }
                                foundError = true;
                              } else if (typeof responseData === 'string') {
                                errorMessage = responseData;
                                foundError = true;
                              }
                            } catch (e) {
                              // If not JSON, use the text as error message
                              errorMessage = responseText.substring(0, 200); // Limit length
                              foundError = true;
                            }
                          }
                        }
                      } catch (fetchError) {
                        console.error('Failed to fetch error details:', fetchError);
                        // Keep the default error message
                      }
                    }
                    
                    // Fallback: try error.message (if it's not the generic one)
                    if (!foundError && error.message && error.message !== 'Edge Function returned a non-2xx status code') {
                      errorMessage = error.message;
                      foundError = true;
                    }
                    
                    // Fallback: try error.context (sometimes the response body is here)
                    if (!foundError && (error as any).context) {
                      try {
                        const context = typeof (error as any).context === 'string' 
                          ? JSON.parse((error as any).context) 
                          : (error as any).context;
                        if (context.error) {
                          errorMessage = context.error;
                          foundError = true;
                        } else if (context.message) {
                          errorMessage = context.message;
                          foundError = true;
                        }
                      } catch (e) {
                        // If parsing fails, use context as string
                        errorMessage = String((error as any).context).substring(0, 200);
                        foundError = true;
                      }
                    }
                    
                    toast({
                      title: "Test Error",
                      description: errorMessage,
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Check if the response indicates failure (even with 200 status)
                  if (data && typeof data === 'object' && 'success' in data) {
                    if (data.success) {
                      console.log('Timebuzzer API Test Response:', data);
                      setTimebuzzerTestResult(data);
                      
                      // Show detailed success message
                      const activityCount = data.count || 0;
                      const totalCount = data.totalCount || 0;
                      const message = totalCount > 0 
                        ? `✅ Success! Found ${activityCount} activities (of ${totalCount} total)`
                        : `✅ Success! API connection working. ${activityCount} activities returned.`;
                      
                      toast({
                        title: "API Test Successful",
                        description: message,
                      });
                    } else {
                      console.error('API test failed:', data);
                      setTimebuzzerTestResult(null);
                      toast({
                        title: "API Test Failed",
                        description: (data as any)?.error || 'Unknown error. Check console.',
                        variant: "destructive",
                      });
                    }
                  } else {
                    // Unexpected response format
                    console.error('Unexpected response format:', data);
                    setTimebuzzerTestResult(null);
                    toast({
                      title: "API Test Failed",
                      description: 'Unexpected response from server. Check console.',
                      variant: "destructive",
                    });
                  }
                } catch (error: any) {
                  console.error('Test API Error:', error);
                  toast({
                    title: "Test Error",
                    description: error.message || 'Failed to send a request to the Edge Function',
                    variant: "destructive",
                  });
                } finally {
                  setTimebuzzerSyncing(false);
                }
              }}
              disabled={timebuzzerSyncing}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Test API Connection
            </Button>
          </div>
          
          {/* API Testing Section */}
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800">
            <h4 className="text-sm font-semibold mb-3 text-gray-800 dark:text-gray-200">API Testing Tools</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                onClick={async () => {
                  try {
                    const { data, error } = await supabase.functions.invoke('timebuzzer-sync', {
                      body: { action: 'test-account' },
                    });
                    
                    if (error) {
                      toast({
                        title: "Error",
                        description: error.message || 'Failed to test account endpoint',
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    if (data && data.success) {
                      toast({
                        title: "Account Endpoint OK",
                        description: data.message || `Found ${data.usersCount || 0} users`,
                      });
                      console.log('Account data:', data);
                    } else {
                      toast({
                        title: "Error",
                        description: data?.error || 'Account endpoint test failed',
                        variant: "destructive",
                      });
                    }
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error.message || 'Failed to test account endpoint',
                      variant: "destructive",
                    });
                  }
                }}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Test Account Endpoint
              </Button>
              <Button
                onClick={async () => {
                  try {
                    const { data, error } = await supabase.functions.invoke('timebuzzer-sync', {
                      body: { action: 'test-tiles' },
                    });
                    
                    if (error) {
                      toast({
                        title: "Error",
                        description: error.message || 'Failed to test tiles endpoint',
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    if (data && data.success) {
                      toast({
                        title: "Tiles Endpoint OK",
                        description: `Found ${data.count || 0} tiles/projects`,
                      });
                      console.log('Tiles data:', data);
                    } else {
                      toast({
                        title: "Error",
                        description: data?.error || 'Tiles endpoint test failed',
                        variant: "destructive",
                      });
                    }
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error.message || 'Failed to test tiles endpoint',
                      variant: "destructive",
                    });
                  }
                }}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Test Tiles/Projects
              </Button>
            </div>
          </div>
          
          <p className="text-xs text-green-600">
            Note: Users and projects must be mapped with Timebuzzer IDs in the database before syncing.
          </p>
          
          {/* Activities Selection Section */}
          {timebuzzerActivities.length > 0 && (
            <div className="mt-4 p-4 bg-white border border-green-300 rounded-lg">
              {/* Warning if mappings might be missing */}
              {(() => {
                const uniqueUserIds = new Set(timebuzzerActivities.map((a: any) => a.userId));
                const uniqueTileIds = new Set(timebuzzerActivities.flatMap((a: any) => a.tiles || []));
                const unmappedTileIds = Array.from(uniqueTileIds).filter(tileId => 
                  !projects.some(p => String(p.timebuzzer_project_id) === String(tileId))
                );
                const unmappedUserIds = Array.from(uniqueUserIds).filter(userId => 
                  !users.some(u => String(u.timebuzzer_user_id) === String(userId))
                );
                
                return (
                  <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                    <strong>⚠️ Mapping Required:</strong>
                    {unmappedUserIds.length > 0 && (
                      <div className="mt-2">
                        <div className="font-medium mb-1">Missing User Mappings ({unmappedUserIds.length}):</div>
                        <div className="space-y-1">
                          {unmappedUserIds.map(userId => {
                            const activity = timebuzzerActivities.find((a: any) => a.userId === userId);
                            return (
                              <div key={userId} className="bg-yellow-100 p-2 rounded">
                                <div>User ID: <strong>{userId}</strong> - {activity?.userName || 'Unknown'}</div>
                                <div className="text-xs mt-1">
                                  SQL: <code className="bg-white px-1 rounded">UPDATE users SET timebuzzer_user_id = '{userId}' WHERE email = 'EMAIL_HERE';</code>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {unmappedTileIds.length > 0 && (
                      <div className="mt-2">
                        <div className="font-medium mb-1">Missing Project Mappings ({unmappedTileIds.length}):</div>
                        <div className="space-y-1">
                          {unmappedTileIds.map(tileId => {
                            const activity = timebuzzerActivities.find((a: any) => a.tiles?.includes(tileId));
                            const tileName = activity?.tileNames?.find((name: string, idx: number) => 
                              activity.tiles?.[idx] === tileId
                            ) || `Tile ${tileId}`;
                            return (
                              <div key={tileId} className="bg-yellow-100 p-2 rounded">
                                <div>Tile ID: <strong>{tileId}</strong> - {tileName}</div>
                                <div className="text-xs mt-1">
                                  SQL: <code className="bg-white px-1 rounded">UPDATE projects SET timebuzzer_project_id = '{tileId}' WHERE name = 'PROJECT_NAME_HERE';</code>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {unmappedUserIds.length === 0 && unmappedTileIds.length === 0 && (
                      <div className="mt-1 text-green-700">
                        ✅ All required mappings are set! You can now add activities.
                      </div>
                    )}
                  </div>
                );
              })()}
              
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-green-800">
                  Select Activities to Add ({selectedActivityIds.size} of {timebuzzerActivities.length} selected)
                </h4>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedActivityIds(new Set(timebuzzerActivities.map((a: any) => a.id)));
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedActivityIds(new Set());
                    }}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
              
              <div className="max-h-96 overflow-y-auto space-y-2 mb-4">
                {timebuzzerActivities.map((activity: any) => {
                  const isSelected = selectedActivityIds.has(activity.id);
                  let duration = 0;
                  if (activity.startDate && activity.endDate) {
                    const start = new Date(activity.startDate);
                    const end = new Date(activity.endDate);
                    duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                  }
                  
                  // Check if this activity might be skipped (no mappings visible)
                  // Note: We can't check the actual mappings from frontend, but we can show a warning
                  const hasUser = activity.userId !== undefined;
                  const hasTiles = activity.tiles && activity.tiles.length > 0;
                  
                  return (
                    <div
                      key={activity.id}
                      className={`p-3 rounded border-2 transition-colors ${
                        isSelected
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      {(!hasUser || !hasTiles) && (
                        <div className="mb-2 text-xs text-yellow-600 bg-yellow-100 p-1 rounded">
                          ⚠️ This activity might be skipped: {!hasUser ? 'Missing user ID' : ''} {!hasTiles ? 'Missing project tiles' : ''}
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedActivityIds);
                            if (checked) {
                              newSet.add(activity.id);
                            } else {
                              newSet.delete(activity.id);
                            }
                            setSelectedActivityIds(newSet);
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1 text-sm">
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div>
                              <span className="font-medium">Date:</span>{' '}
                              {activity.startDate
                                ? new Date(activity.startDate).toLocaleDateString('nl-NL')
                                : 'N/A'}
                            </div>
                            <div>
                              <span className="font-medium">Duration:</span>{' '}
                              {Math.round(duration * 100) / 100} hours
                            </div>
                          </div>
                          {activity.userName && (
                            <div>
                              <span className="font-medium">User:</span> {activity.userName}
                            </div>
                          )}
                          {activity.tileNames && activity.tileNames.length > 0 && (
                            <div>
                              <span className="font-medium">Projects:</span>{' '}
                              {activity.tileNames.join(' → ')}
                            </div>
                          )}
                          {activity.note && (
                            <div className="mt-1 text-xs text-gray-600">
                              <span className="font-medium">Note:</span> {activity.note}
                            </div>
                          )}
                          <div className="mt-1 text-xs text-gray-500">
                            Time: {activity.startDate ? new Date(activity.startDate).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : ''} - {activity.endDate ? new Date(activity.endDate).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <Button
                onClick={async () => {
                  if (selectedActivityIds.size === 0) {
                    toast({
                      title: "No Selection",
                      description: "Please select at least one activity to add",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  setTimebuzzerSyncing(true);
                  try {
                    const dateRange = getWeekDateRange(timebuzzerSyncWeekNumber, timebuzzerSyncYear);
                    const selectedActivities = timebuzzerActivities.filter((a: any) =>
                      selectedActivityIds.has(a.id)
                    );
                    
                    // Sync only selected activities
                    const { data, error } = await supabase.functions.invoke('timebuzzer-sync', {
                      body: {
                        action: 'sync-selected-activities',
                        activities: selectedActivities,
                        startDate: dateRange.from,
                        endDate: dateRange.to,
                      },
                    });
                    
                    if (error) {
                      toast({
                        title: "Sync Error",
                        description: error.message || 'Failed to sync selected activities',
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    if (data && data.success) {
                      const inserted = data.inserted || 0;
                      const skipped = data.skipped || 0;
                      const total = data.total || 0;
                      
                      if (inserted > 0) {
                        const projectsCreated = data.projectsCreated || 0;
                        let message = `Added ${inserted} activities to weekly entries`;
                        if (projectsCreated > 0) {
                          message += ` (${projectsCreated} project${projectsCreated > 1 ? 's' : ''} automatically created)`;
                        }
                        if (skipped > 0) {
                          message += ` (${skipped} skipped)`;
                        }
                        
                        toast({
                          title: "Sync Successful",
                          description: message,
                        });
                        // Clear selection and activities
                        setTimebuzzerActivities([]);
                        setSelectedActivityIds(new Set());
                        // Refresh projects list
                        const { data: updatedProjects } = await supabase.from("projects").select("id, name, timebuzzer_project_id");
                        if (updatedProjects) {
                          setProjects(updatedProjects);
                        }
                      } else {
                        // All were skipped - show detailed message
                        let message = `No activities were added. ${skipped} activities were skipped.`;
                        if (data.skipReasons && data.skipReasons.length > 0) {
                          const reasons = data.skipReasons.slice(0, 3).map((r: any) => r.reason).join('; ');
                          message += ` Reasons: ${reasons}`;
                        }
                        if (data.userMappingsFound === 0) {
                          message += ' No user mappings found. Please map users first.';
                        }
                        if (data.projectMappingsFound === 0) {
                          message += ' No project mappings found. Please map projects first.';
                        }
                        
                        toast({
                          title: "No Activities Added",
                          description: message,
                          variant: "destructive",
                        });
                      }
                    } else {
                      toast({
                        title: "Sync Failed",
                        description: data?.error || 'Unknown error occurred',
                        variant: "destructive",
                      });
                    }
                  } catch (error: any) {
                    console.error('Sync error:', error);
                    toast({
                      title: "Sync Error",
                      description: error.message || 'Failed to sync selected activities',
                      variant: "destructive",
                    });
                  } finally {
                    setTimebuzzerSyncing(false);
                  }
                }}
                disabled={timebuzzerSyncing || selectedActivityIds.size === 0}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {timebuzzerSyncing
                  ? `Adding ${selectedActivityIds.size} activities...`
                  : `Add ${selectedActivityIds.size} Selected Activities to Weekly Entries`}
              </Button>
            </div>
          )}
          
          {/* Timebuzzer Users Display */}
          {timebuzzerUsers.length > 0 && (
            <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-semibold text-green-800 dark:text-green-200">
                  Timebuzzer Users ({timebuzzerUsers.length})
                </h4>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setCheckingAllActivities(true);
                      try {
                        // Check activities for all users (last 3 months)
                        const today = new Date();
                        const threeMonthsAgo = new Date();
                        threeMonthsAgo.setMonth(today.getMonth() - 3);
                        
                        const statusUpdates: Record<number, { hasActivities: boolean; lastActivityDate?: string; totalActivities?: number }> = {};
                        
                        // Check each user
                        for (const user of timebuzzerUsers) {
                          try {
                            const { data, error } = await supabase.functions.invoke('timebuzzer-sync', {
                              body: {
                                action: 'fetch-activities',
                                startDate: formatDateToYYYYMMDD(threeMonthsAgo),
                                endDate: formatDateToYYYYMMDD(today),
                                userId: String(user.id),
                              },
                            });
                            
                            if (data && data.success) {
                              const activities = data.activities || [];
                              let lastActivityDate: string | undefined;
                              if (activities.length > 0) {
                                const dates = activities
                                  .map((a: any) => a.startDate || a.endDate)
                                  .filter(Boolean)
                                  .sort()
                                  .reverse();
                                lastActivityDate = dates[0];
                              }
                              
                              statusUpdates[user.id] = {
                                hasActivities: activities.length > 0,
                                lastActivityDate,
                                totalActivities: activities.length,
                              };
                            } else {
                              statusUpdates[user.id] = {
                                hasActivities: false,
                              };
                            }
                          } catch (error) {
                            console.error(`Error checking activities for user ${user.id}:`, error);
                            statusUpdates[user.id] = {
                              hasActivities: false,
                            };
                          }
                        }
                        
                        setUserActivitiesStatus(prev => ({ ...prev, ...statusUpdates }));
                        
                        const usersWithActivities = Object.values(statusUpdates).filter(s => s.hasActivities).length;
                        toast({
                          title: "Check Complete",
                          description: `${usersWithActivities} of ${timebuzzerUsers.length} users have activities in the last 3 months`,
                        });
                      } catch (error: any) {
                        toast({
                          title: "Error",
                          description: error.message || 'Failed to check all users',
                          variant: "destructive",
                        });
                      } finally {
                        setCheckingAllActivities(false);
                      }
                    }}
                    disabled={checkingAllActivities || timebuzzerUsers.length === 0}
                    className="text-xs"
                  >
                    {checkingAllActivities ? "Checking..." : "Check All Users"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTimebuzzerUsers([]);
                      setTimebuzzerUserHours({});
                      setUserActivitiesStatus({});
                    }}
                    className="text-xs"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs border border-gray-300 dark:border-gray-700">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      <th className="p-2 text-left border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">ID</th>
                      <th className="p-2 text-left border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">Name</th>
                      <th className="p-2 text-left border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">Email</th>
                      <th className="p-2 text-left border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">Mapped To</th>
                      <th className="p-2 text-left border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">Has Activities</th>
                      <th className="p-2 text-left border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timebuzzerUsers.map((user: any) => {
                      const mappedUser = users.find((u: any) => u.timebuzzer_user_id === String(user.id));
                      return (
                        <tr key={user.id} className="border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
                          <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 font-mono text-xs">
                            {user.id}
                          </td>
                          <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                            {user.name || '-'}
                          </td>
                          <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                            {user.email || '-'}
                          </td>
                          <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                            {mappedUser ? (
                              <span className="text-green-600 dark:text-green-400">
                                ✓ {mappedUser.name || mappedUser.email}
                              </span>
                            ) : (
                              <span className="text-orange-600 dark:text-orange-400">Not mapped</span>
                            )}
                          </td>
                          <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                            {userActivitiesStatus[user.id] ? (
                              userActivitiesStatus[user.id].hasActivities ? (
                                <div className="flex flex-col gap-1">
                                  <span className="text-green-600 dark:text-green-400 font-semibold">✓ Yes</span>
                                  {userActivitiesStatus[user.id].totalActivities !== undefined && (
                                    <span className="text-xs text-gray-500">
                                      {userActivitiesStatus[user.id].totalActivities} total
                                    </span>
                                  )}
                                  {userActivitiesStatus[user.id].lastActivityDate && (
                                    <span className="text-xs text-gray-500">
                                      Last: {new Date(userActivitiesStatus[user.id].lastActivityDate!).toLocaleDateString('nl-NL')}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-orange-600 dark:text-orange-400">✗ No activities</span>
                              )
                            ) : (
                              <span className="text-gray-400">Not checked</span>
                            )}
                          </td>
                          <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                setLoadingUserHours(prev => ({ ...prev, [user.id]: true }));
                                try {
                                  // Check for activities in the last 3 months
                                  const today = new Date();
                                  const threeMonthsAgo = new Date();
                                  threeMonthsAgo.setMonth(today.getMonth() - 3);
                                  
                                  const { data, error } = await supabase.functions.invoke('timebuzzer-sync', {
                                    body: {
                                      action: 'fetch-activities',
                                      startDate: formatDateToYYYYMMDD(threeMonthsAgo),
                                      endDate: formatDateToYYYYMMDD(today),
                                      userId: String(user.id),
                                    },
                                  });
                                  
                                  if (error) {
                                    toast({
                                      title: "Error",
                                      description: error.message || 'Failed to check activities',
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  
                                  if (data && data.success) {
                                    const activities = data.activities || [];
                                    const hasActivities = activities.length > 0;
                                    
                                    // Check for API access warnings
                                    if (data.warning) {
                                      toast({
                                        title: "⚠️ API Access Warning",
                                        description: data.warning,
                                        variant: "destructive",
                                      });
                                    }
                                    
                                    // If API returned activities for different users, show warning
                                    if (data.apiReturnedUserIds && data.apiReturnedUserIds.length > 0) {
                                      const requestedUserId = String(user.id);
                                      const returnedUserIds = data.apiReturnedUserIds.map((id: number) => String(id));
                                      if (!returnedUserIds.includes(requestedUserId)) {
                                        toast({
                                          title: "⚠️ Limited API Access",
                                          description: `API key may only have access to user ${returnedUserIds[0]}. Requested user ${requestedUserId} not accessible.`,
                                          variant: "destructive",
                                        });
                                      }
                                    }
                                    
                                    // Find last activity date
                                    let lastActivityDate: string | undefined;
                                    if (activities.length > 0) {
                                      const dates = activities
                                        .map((a: any) => a.startDate || a.endDate)
                                        .filter(Boolean)
                                        .sort()
                                        .reverse();
                                      lastActivityDate = dates[0];
                                    }
                                    
                                    setUserActivitiesStatus(prev => ({
                                      ...prev,
                                      [user.id]: {
                                        hasActivities,
                                        lastActivityDate,
                                        totalActivities: activities.length,
                                      }
                                    }));
                                    
                                    if (hasActivities) {
                                      toast({
                                        title: "Activities Found",
                                        description: `User has ${activities.length} activities in the last 3 months`,
                                      });
                                    } else {
                                      let description = "No activities found for this user in the last 3 months";
                                      if (data.availableUserIds && data.availableUserIds.length > 0) {
                                        description += `. API returned activities for other users: ${data.availableUserIds.join(', ')}. This suggests the API key has limited access.`;
                                      }
                                      toast({
                                        title: "No Activities",
                                        description: description,
                                        variant: "default",
                                      });
                                    }
                                  } else {
                                    setUserActivitiesStatus(prev => ({
                                      ...prev,
                                      [user.id]: {
                                        hasActivities: false,
                                      }
                                    }));
                                  }
                                } catch (error: any) {
                                  toast({
                                    title: "Error",
                                    description: error.message || 'Failed to check activities',
                                    variant: "destructive",
                                  });
                                } finally {
                                  setLoadingUserHours(prev => ({ ...prev, [user.id]: false }));
                                }
                              }}
                              disabled={loadingUserHours[user.id]}
                              className="text-xs h-7"
                            >
                              {loadingUserHours[user.id] ? "Checking..." : "Check Activities"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                <p><strong>Tip:</strong> Gebruik de ID kolom om users te mappen in de database:</p>
                <code className="block mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                  UPDATE users SET timebuzzer_user_id = 'ID' WHERE email = 'email';
                </code>
              </div>
            </div>
          )}

          {/* Test Results Display */}
          {timebuzzerTestResult && timebuzzerTestResult.success && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-green-800">✅ API Test Results</h4>
                <button
                  onClick={() => setTimebuzzerTestResult(null)}
                  className="text-xs text-green-600 hover:text-green-800 underline"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Status:</span> {timebuzzerTestResult.status || 'OK'}
                </div>
                {timebuzzerTestResult.totalCount !== undefined && (
                  <div>
                    <span className="font-medium">Total Activities in Timebuzzer:</span> {timebuzzerTestResult.totalCount}
                  </div>
                )}
                {timebuzzerTestResult.count !== undefined && (
                  <div>
                    <span className="font-medium">Activities Returned:</span> {timebuzzerTestResult.count}
                  </div>
                )}
                {timebuzzerTestResult.totalDuration !== undefined && (
                  <div>
                    <span className="font-medium">Total Duration:</span> {Math.round(timebuzzerTestResult.totalDuration / 3600000 * 100) / 100} hours
                  </div>
                )}
                {timebuzzerTestResult.usersFetched !== undefined && (
                  <div>
                    <span className="font-medium">Users Loaded:</span> {timebuzzerTestResult.usersFetched}
                  </div>
                )}
                {timebuzzerTestResult.tilesFetched !== undefined && (
                  <div>
                    <span className="font-medium">Projects Loaded:</span> {timebuzzerTestResult.tilesFetched}
                  </div>
                )}
                
                {/* Show sample activities */}
                {timebuzzerTestResult.data && timebuzzerTestResult.data.activities && 
                 Array.isArray(timebuzzerTestResult.data.activities) && 
                 timebuzzerTestResult.data.activities.length > 0 && (
                  <div className="mt-3">
                    <span className="font-medium">Sample Activities (first 3):</span>
                    <div className="mt-2 space-y-2">
                      {timebuzzerTestResult.data.activities.slice(0, 3).map((activity: any, idx: number) => {
                        // Calculate duration
                        let duration = '';
                        if (activity.startDate && activity.endDate) {
                          const start = new Date(activity.startDate);
                          const end = new Date(activity.endDate);
                          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                          duration = `${Math.round(hours * 100) / 100} hours`;
                        }
                        
                        return (
                          <div key={idx} className="p-2 bg-white rounded border border-green-200 text-xs">
                            <div className="grid grid-cols-2 gap-2">
                              <div><span className="font-medium">ID:</span> {activity.id}</div>
                              {duration && (
                                <div><span className="font-medium">Duration:</span> {duration}</div>
                              )}
                            </div>
                            {activity.userName && (
                              <div><span className="font-medium">User:</span> {activity.userName} {activity.userEmail && `(${activity.userEmail})`}</div>
                            )}
                            {!activity.userName && activity.userId && (
                              <div><span className="font-medium">User ID:</span> {activity.userId}</div>
                            )}
                            {activity.tileNames && activity.tileNames.length > 0 && (
                              <div><span className="font-medium">Projects:</span> {activity.tileNames.join(' → ')}</div>
                            )}
                            {!activity.tileNames && activity.tiles && activity.tiles.length > 0 && (
                              <div><span className="font-medium">Tile IDs:</span> {activity.tiles.join(', ')}</div>
                            )}
                            {activity.startDate && (
                              <div><span className="font-medium">Start:</span> {new Date(activity.startDate).toLocaleString()}</div>
                            )}
                            {activity.endDate && (
                              <div><span className="font-medium">End:</span> {new Date(activity.endDate).toLocaleString()}</div>
                            )}
                            {activity.note && (
                              <div><span className="font-medium">Note:</span> {activity.note.substring(0, 100)}{activity.note.length > 100 ? '...' : ''}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
          </div>
        </TabsContent>
        )}

        {/* Days Off Overview Tab - For admin, administratie, and super admin */}
        {(currentUser?.isAdmin || currentUser?.userType === 'administratie' || currentUser?.email === SUPER_ADMIN_EMAIL) && (
        <TabsContent value="daysOff" className="space-y-6">
          <div>
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              {t('admin.daysOffOverview')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('admin.daysOffOverviewDescription')}
            </p>
            
            {isMobile ? (
              // Mobile view: Cards
              <div className="space-y-3">
                {users
                  .filter(user => user.approved !== false)
                  .map((user) => {
                    const totalHoursTaken = daysOffMap[String(user.id)] || 0;
                    const totalHoursAvailable = totalDaysOff * 8;
                    const hoursLeft = totalHoursAvailable - totalHoursTaken;
                    const daysLeft = (hoursLeft / 8).toFixed(1);
                    const hoursLeftRounded = hoursLeft.toFixed(1);
                    
                    return (
                      <Card key={user.id} className="p-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-gray-100">
                                {user.name || user.email}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {user.email}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                                {daysLeft}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                {hoursLeftRounded} {t('admin.hours')}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
              </div>
            ) : (
              // Desktop view: Table
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 dark:border-gray-700">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      <th className="p-3 text-left text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{t('admin.name')}</th>
                      <th className="p-3 text-left text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{t('admin.email')}</th>
                      <th className="p-3 text-left text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{t('admin.daysOffLeft')}</th>
                      <th className="p-3 text-left text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">{t('admin.hoursTaken')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter(user => user.approved !== false)
                      .map((user) => {
                        // IMPORTANT: Always use actual database value for calculations
                        // The override is ONLY for display in the "Hours Taken" column
                        const totalHoursTaken = daysOffMap[String(user.id)] || 0;
                        const totalHoursAvailable = totalDaysOff * 8;
                        // Days Off Left calculation uses actual database value, NOT override
                        const hoursLeft = totalHoursAvailable - totalHoursTaken;
                        const daysLeft = (hoursLeft / 8).toFixed(1);
                        const hoursLeftRounded = hoursLeft.toFixed(1);
                        
                        // UI-only override for display - does NOT affect calculations above
                        const displayHoursTaken = hoursTakenOverrides[user.id] !== undefined 
                          ? hoursTakenOverrides[user.id] 
                          : totalHoursTaken;
                        
                        return (
                          <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="p-3 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">
                              {user.name || user.email}
                            </td>
                            <td className="p-3 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">
                              {user.email}
                            </td>
                            <td className="p-3 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">
                              <span className="font-semibold text-blue-700 dark:text-blue-400">
                                {daysLeft} ({hoursLeftRounded} {t('admin.hours')})
                              </span>
                            </td>
                            <td className="p-3 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">
                              <div className="flex items-center gap-2">
                                {editingHoursTaken[user.id] !== undefined ? (
                                  <>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      value={editingHoursTaken[user.id]}
                                      onChange={(e) => setEditingHoursTaken({ ...editingHoursTaken, [user.id]: e.target.value })}
                                      className="w-24 h-8"
                                      title="UI-only edit - does not affect database or other views"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        // Only update UI state - no database operations
                                        const newValue = parseFloat(editingHoursTaken[user.id] || "0");
                                        setHoursTakenOverrides({ ...hoursTakenOverrides, [user.id]: newValue });
                                        const updated = { ...editingHoursTaken };
                                        delete updated[user.id];
                                        setEditingHoursTaken(updated);
                                      }}
                                      className="h-8"
                                      title="Save (UI only - no database changes)"
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        const updated = { ...editingHoursTaken };
                                        delete updated[user.id];
                                        setEditingHoursTaken(updated);
                                      }}
                                      className="h-8"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <span>{displayHoursTaken.toFixed(1)} {t('admin.hours')}</span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingHoursTaken({ ...editingHoursTaken, [user.id]: displayHoursTaken.toFixed(1) })}
                                      className="h-6 w-6 p-0"
                                      title="Edit hours taken (UI only - does not affect database, weekly entries, or calculations)"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    {hoursTakenOverrides[user.id] !== undefined && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          const updated = { ...hoursTakenOverrides };
                                          delete updated[user.id];
                                          setHoursTakenOverrides(updated);
                                        }}
                                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                        title="Reset to actual database value"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
        )}

        {/* Error Logs Tab - Only for super admin */}
        {currentUser?.email === SUPER_ADMIN_EMAIL && (
        <TabsContent value="errors" className="space-y-6">
          <div>
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Error Logs
          </h3>
          
          <div className="mb-4 flex flex-wrap gap-4">
            <Select value={errorLogsFilter} onValueChange={(val: any) => setErrorLogsFilter(val)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Errors</SelectItem>
                <SelectItem value="unresolved">Unresolved</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>

            <Select value={errorLogsSeverity} onValueChange={(val: any) => setErrorLogsSeverity(val)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="error">Errors</SelectItem>
                <SelectItem value="warning">Warnings</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>

            <Select value={errorLogsUserFilter} onValueChange={(val: any) => setErrorLogsUserFilter(val)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users
                  .filter((user: any) => user.email) // Only show users with email
                  .map((user: any) => (
                    <SelectItem key={user.id} value={user.email}>
                      {user.name || user.email} ({user.email})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Button onClick={fetchErrorLogs} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={handleDeleteResizeObserverErrors} 
              variant="outline" 
              size="sm"
              className="text-orange-600 hover:text-orange-700 border-orange-300 hover:bg-orange-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete ResizeObserver Errors
            </Button>
            <Button 
              onClick={handleDeleteAllErrors} 
              variant="destructive" 
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Errors
            </Button>
          </div>

          {errorLogsLoading ? (
            <div className="text-center p-8">Loading error logs...</div>
          ) : errorLogs.length === 0 ? (
            <div className="text-center p-8 text-gray-500">No error logs found</div>
          ) : (
            <div className="space-y-4">
              {errorLogs.map((errorLog) => (
                <Card key={errorLog.id} className={errorLog.resolved ? "bg-gray-50 dark:bg-gray-800" : "bg-red-50 dark:bg-red-900/20"}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            errorLog.severity === 'error' ? 'bg-red-600 text-white' :
                            errorLog.severity === 'warning' ? 'bg-yellow-600 text-white' :
                            'bg-blue-600 text-white'
                          }`}>
                            {errorLog.severity?.toUpperCase()}
                          </span>
                          {errorLog.resolved && (
                            <span className="px-2 py-1 rounded text-xs bg-green-600 text-white">RESOLVED</span>
                          )}
                        </CardTitle>
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                          {new Date(errorLog.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!errorLog.resolved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedErrorLog(errorLog)}
                          >
                            Resolve
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteErrorLog(errorLog.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>
                        <strong>Message:</strong>
                        <div className="mt-1 p-2 bg-white dark:bg-gray-700 rounded font-mono text-xs">
                          {errorLog.error_message}
                        </div>
                      </div>
                      
                      {errorLog.user_email && (
                        <div>
                          <strong>User:</strong> {errorLog.user_name || errorLog.user_email}
                        </div>
                      )}
                      
                      {errorLog.error_component && (
                        <div>
                          <strong>Component:</strong> {errorLog.error_component}
                        </div>
                      )}
                      
                      {errorLog.error_url && (
                        <div>
                          <strong>URL:</strong> {errorLog.error_url}
                        </div>
                      )}
                      
                      {errorLog.error_stack && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs font-semibold">Stack Trace</summary>
                          <pre className="mt-2 p-2 bg-white dark:bg-gray-700 rounded text-xs overflow-auto max-h-48">
                            {errorLog.error_stack}
                          </pre>
                        </details>
                      )}
                      
                      {errorLog.notes && (
                        <div>
                          <strong>Notes:</strong>
                          <div className="mt-1 p-2 bg-white dark:bg-gray-700 rounded text-xs">
                            {errorLog.notes}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          </div>
        </TabsContent>
        )}

      {/* Resolve Error Dialog */}
      {selectedErrorLog && (
        <Dialog open={!!selectedErrorLog} onOpenChange={() => setSelectedErrorLog(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Resolve Error</DialogTitle>
              <DialogDescription>
                Add notes about how this error was resolved
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Error Message</Label>
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">
                  {selectedErrorLog.error_message}
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Input
                  value={errorLogNotes}
                  onChange={(e) => setErrorLogNotes(e.target.value)}
                  placeholder="Add notes about how this error was resolved..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  setSelectedErrorLog(null);
                  setErrorLogNotes("");
                }}>
                  Cancel
                </Button>
                <Button onClick={() => handleResolveError(selectedErrorLog.id)}>
                  Mark as Resolved
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Days Off Reason Dialog */}
      <Dialog open={showDaysOffReasonDialog} onOpenChange={setShowDaysOffReasonDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingDaysOffAction && pendingDaysOffAction.hours > 0 ? "Add Days Off" : "Subtract Days Off"}
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for this change. This will be shown to the user in the notification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {pendingDaysOffAction && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Hours:</strong> {Math.abs(pendingDaysOffAction.hours)} hours ({Math.abs(pendingDaysOffAction.hours / 8).toFixed(2)} days)
                <br />
                <strong>User:</strong> {users.find(u => String(u.id) === String(pendingDaysOffAction.userId))?.name || users.find(u => String(u.id) === String(pendingDaysOffAction.userId))?.email || 'Unknown'}
              </div>
            )}
            <div>
              <Label htmlFor="days-off-reason">Reason *</Label>
              <Textarea
                id="days-off-reason"
                placeholder="e.g., Correction for previous error, Bonus days, etc."
                value={pendingDaysOffAction ? (daysOffReasonInput[pendingDaysOffAction.userId] || "") : ""}
                onChange={(e) => {
                  if (pendingDaysOffAction) {
                    setDaysOffReasonInput(prev => ({ ...prev, [pendingDaysOffAction.userId]: e.target.value }));
                  }
                }}
                className="mt-2"
                rows={4}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setShowDaysOffReasonDialog(false);
              setPendingDaysOffAction(null);
              if (pendingDaysOffAction) {
                setDaysOffReasonInput(prev => ({ ...prev, [pendingDaysOffAction.userId]: "" }));
              }
            }}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDaysOffChange}>
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Week Rejection Dialog (comment) */}
      <Dialog open={weekReviewDialog.open} onOpenChange={(open) => setWeekReviewDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.rejectButton')}</DialogTitle>
            <DialogDescription>
              {weekReviewDialog.userName} — {t('admin.week')} {weekReviewDialog.weekNumber} ({weekReviewDialog.year})
              <br />
              {t('admin.weekReview.addCommentHint')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={weekReviewComment}
              onChange={(e) => setWeekReviewComment(e.target.value)}
              placeholder={t('admin.weekReview.commentPlaceholder')}
              className="min-h-[120px]"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setWeekReviewDialog(prev => ({ ...prev, open: false }));
                  setWeekReviewComment("");
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={submitWeekRejection}
              >
                {t('admin.rejectButton')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </Tabs>
      
      {/* Week Details Dialog - Available for both admins and administratie users */}
      {selectedWeekForView && (() => {
        const cw = confirmedWeeks.find(
          c => c.user_id === selectedWeekForView.userId && c.week_start_date === selectedWeekForView.weekStartDate
        );
        if (!cw) return null;
        
        // Calculate the correct ISO week Monday based on the stored week_start_date
        // This ensures we get the correct week number even if week_start_date was stored incorrectly
        const storedDate = new Date(cw.week_start_date);
        const isoWeekMonday = getISOWeekMonday(storedDate);
        const weekStart = isoWeekMonday;
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekNum = getISOWeekNumber(weekStart);
        const user = usersMap[cw.user_id];
        // Use the ISO week date range for filtering entries, not the stored week_start_date
        const weekStartStr = formatDateToYYYYMMDD(weekStart);
        const weekEndStr = formatDateToYYYYMMDD(weekEnd);
        let weekEntries = allEntries.filter(
          e => e.user_id === cw.user_id && 
          e.date >= weekStartStr && 
          e.date <= weekEndStr &&
          // Filter out admin adjustments (entries without startTime/endTime are admin adjustments)
          // Only show entries that have both startTime and endTime - these are user-created entries
          // Note: Full day off entries DO have startTime/endTime set (08:00-16:30), so they are included
          e.startTime && e.endTime
        );
        
        // Sort entries by date (Monday to Sunday), then by startTime
        weekEntries.sort((a, b) => {
          // First sort by date
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          if (dateA.getTime() !== dateB.getTime()) {
            return dateA.getTime() - dateB.getTime();
          }
          // If same date, sort by startTime
          const timeA = a.startTime || "00:00";
          const timeB = b.startTime || "00:00";
          return timeA.localeCompare(timeB);
        });
        
        // Group entries by day
        const entriesByDay: Record<string, typeof weekEntries> = {};
        weekEntries.forEach(entry => {
          const dateKey = entry.date;
          if (!entriesByDay[dateKey]) {
            entriesByDay[dateKey] = [];
          }
          entriesByDay[dateKey].push(entry);
        });
        
        // Get all days in the week (Monday to Sunday)
        const weekDays: string[] = [];
        for (let i = 0; i < 7; i++) {
          const day = new Date(weekStart);
          day.setDate(day.getDate() + i);
          weekDays.push(formatDateToYYYYMMDD(day));
        }
        
        const totalHours = weekEntries.reduce((sum, e) => sum + (isBreakEntry(e) ? 0 : Number(e.hours || 0)), 0);
        
        return (
          <Dialog open={!!selectedWeekForView} onOpenChange={(open) => !open && setSelectedWeekForView(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {user?.name || user?.email || t('admin.unknownUser')} - {t('admin.week')} {weekNum}
                </DialogTitle>
                <DialogDescription>
                  {weekStart.toLocaleDateString('nl-NL')} - {weekEnd.toLocaleDateString('nl-NL')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {t('admin.total')}: {totalHours.toFixed(2)} ({weekEntries.length} {t('admin.entries')})
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {t('admin.status')}: {cw.admin_approved ? (
                        <span className="text-green-600 dark:text-green-400 font-semibold">{t('admin.approvedStatus')}</span>
                      ) : cw.admin_reviewed ? (
                        <span className="text-red-600 dark:text-red-400 font-semibold">{t('admin.rejectedStatus')}</span>
                      ) : (
                        <span className="text-orange-600 dark:text-orange-400 font-semibold">{t('admin.pendingReviewStatus')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!cw.admin_reviewed && (
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          handleApproveWeek(cw.user_id, cw.week_start_date);
                          setSelectedWeekForView(null);
                        }}
                      >
                        {t('admin.approveButton')}
                      </Button>
                    )}
                    {!cw.admin_reviewed && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-600 dark:border-red-500 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40"
                        onClick={() => {
                          handleRejectWeek(cw.user_id, cw.week_start_date);
                          setSelectedWeekForView(null);
                        }}
                      >
                        {t('admin.rejectButton')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-orange-600 dark:border-orange-500 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40"
                      onClick={() => {
                        handleUnlockWeek(cw.user_id, cw.week_start_date);
                        setSelectedWeekForView(null);
                      }}
                    >
                      {t('admin.unlockButton')}
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border rounded-lg shadow-sm border-gray-300 dark:border-gray-700">
                    <thead className="sticky top-0 bg-orange-100 dark:bg-orange-900/50 z-10">
                      <tr>
                        <th className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('admin.date')}</th>
                        <th className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('weekly.project')}</th>
                        <th className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('weekly.hours')}</th>
                        <th className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('admin.workType')}</th>
                        <th className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('admin.description')}</th>
                        <th className="p-1 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('admin.startEnd')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekEntries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-gray-500 dark:text-gray-400">
                            Geen entries gevonden
                          </td>
                        </tr>
                      ) : (
                        weekDays.map((dayDate, dayIdx) => {
                          const dayEntries = entriesByDay[dayDate] || [];
                          const dayTotal = dayEntries.reduce((sum, e) => sum + (isBreakEntry(e) ? 0 : Number(e.hours || 0)), 0);
                          const day = new Date(dayDate);
                          const dayName = getDayNameNL(dayDate);
                          
                          return (
                            <React.Fragment key={dayDate}>
                              {/* Day header row */}
                              {dayEntries.length > 0 && (
                                <tr className="bg-blue-50 dark:bg-blue-900/30 border-t-2 border-blue-200 dark:border-blue-700">
                                  <td colSpan={6} className="p-2 font-semibold text-blue-900 dark:text-blue-100 border border-gray-300 dark:border-gray-700">
                                    {formatDateWithDayName(dayDate)} - Totaal: {dayTotal.toFixed(2)} ({dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'})
                                  </td>
                                </tr>
                              )}
                              {/* Day entries */}
                              {dayEntries.map((entry, idx) => (
                                <tr key={entry.id || `${dayDate}-${idx}`} className="border-t border-gray-300 dark:border-gray-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors bg-white dark:bg-gray-800">
                                  <td className="p-2 border border-gray-300 dark:border-gray-700 whitespace-nowrap text-gray-900 dark:text-gray-100">{formatDateWithDayName(entry.date)}</td>
                                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{entry.projects?.name || projectsMap[entry.project_id] || entry.project || "-"}</td>
                                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{entry.hours}</td>
                                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{entry.description}</td>
                                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{entry.notes || ""}</td>
                                  <td className="p-1 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{entry.startTime && entry.endTime ? `${entry.startTime} - ${entry.endTime}` : '-'}</td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
};

export default AdminPanel; 