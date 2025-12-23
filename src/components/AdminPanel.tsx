import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Calendar, Pencil, Check, X, Download, FileText, FileDown, Calendar as CalendarIcon, Users, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import * as XLSX from "xlsx";
import { createPDF } from "@/utils/pdfExport";
import { hashPassword } from "@/utils/password";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";

interface AdminPanelProps {
  currentUser: any;
}

// Helper to get date range from week number and year (ISO week) - defined outside component to avoid duplicate definition
const getWeekDateRange = (weekNumber: number, year: number) => {
  try {
    // Calculate the date of the first Thursday of the year (ISO week standard)
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7; // Convert Sunday (0) to 7
    const daysToMonday = jan4Day === 1 ? 0 : 1 - jan4Day;
    
    // Get the Monday of week 1
    const week1Monday = new Date(year, 0, 4 + daysToMonday);
    
    // Calculate the Monday of the requested week
    const weekMonday = new Date(week1Monday);
    weekMonday.setDate(week1Monday.getDate() + (weekNumber - 1) * 7);
    
    // Calculate the Sunday of that week
    const weekSunday = new Date(weekMonday);
    weekSunday.setDate(weekMonday.getDate() + 6);
    
    return {
      from: weekMonday.toISOString().split('T')[0],
      to: weekSunday.toISOString().split('T')[0]
    };
  } catch (error) {
    console.error("Error calculating week date range:", error);
    // Fallback: return current week
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      from: monday.toISOString().split('T')[0],
      to: sunday.toISOString().split('T')[0]
    };
  }
};

const AdminPanel = ({ currentUser }: AdminPanelProps) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
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
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});
  const [confirmedWeeks, setConfirmedWeeks] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [reminderUserIds, setReminderUserIds] = useState<string[]>([]);
  const [reminderWeekNumber, setReminderWeekNumber] = useState<string>("");
  const [reminderYear, setReminderYear] = useState<string>(new Date().getFullYear().toString());
  const [timebuzzerSyncing, setTimebuzzerSyncing] = useState(false);
  
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

  // Helper to get day name in Dutch
  const getDayNameNL = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
    return days[date.getDay()];
  };

  // Helper to format date with day name (DD-MM-YYYY Dagnaam)
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
    const { data, error } = await supabase.from("users").select("id, email, name, isAdmin, must_change_password, approved, can_use_timebuzzer, timebuzzer_user_id, userType");
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
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

      // Build query - include more fields for detailed breakdown
      let queryBuilder = supabase
        .from("timesheet")
        .select("user_id, date, hours, description, project, startTime, endTime, notes")
        .order("date", { ascending: true });
      
      if (fromDate && toDate) {
        queryBuilder = queryBuilder.gte("date", fromDate).lte("date", toDate);
      }
      
      if (overtimeSelectedUserId && overtimeSelectedUserId !== "all") {
        queryBuilder = queryBuilder.eq("user_id", overtimeSelectedUserId);
      }

      const { data, error } = await queryBuilder;
      
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        setOvertimeLoading(false);
        return;
      }

      // Group entries by user and date, and store detailed entry information
      const userDateMap: Record<string, Record<string, { totalHours: number; entries: any[] }>> = {};
      
      (data || []).forEach((entry: any) => {
        const userId = String(entry.user_id);
        const date = entry.date;
        
        if (!userDateMap[userId]) {
          userDateMap[userId] = {};
        }
        if (!userDateMap[userId][date]) {
          userDateMap[userId][date] = { totalHours: 0, entries: [] };
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

      // Calculate overtime per day (more than 8 hours = overtime)
      const overtimeResults: any[] = [];
      
      Object.keys(userDateMap).forEach(userId => {
        const user = users.find(u => String(u.id) === userId);
        if (!user) return;
        
        let totalOvertime = 0;
        const dailyOvertime: any[] = [];
        
        Object.keys(userDateMap[userId]).forEach(date => {
          const dayData = userDateMap[userId][date];
          const totalHours = dayData.totalHours;
          const normalHours = 8;
          const overtime = totalHours > normalHours ? totalHours - normalHours : 0;
          
          if (overtime > 0) {
            // Sort entries by startTime for better readability
            const sortedEntries = [...dayData.entries].sort((a, b) => {
              const timeA = a.startTime === "-" ? "99:99" : a.startTime;
              const timeB = b.startTime === "-" ? "99:99" : b.startTime;
              return timeA.localeCompare(timeB);
            });
            
            dailyOvertime.push({
              date,
              totalHours: totalHours.toFixed(2),
              normalHours: normalHours.toFixed(2),
              overtime: overtime.toFixed(2),
              entries: sortedEntries
            });
            totalOvertime += overtime;
          }
        });
        
        if (totalOvertime > 0 || dailyOvertime.length > 0) {
          overtimeResults.push({
            userId,
            userName: user.name || user.email,
            userEmail: user.email,
            totalOvertime: totalOvertime.toFixed(2),
            dailyOvertime: dailyOvertime.sort((a, b) => a.date.localeCompare(b.date))
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
    if (userEmail === SUPER_ADMIN_EMAIL && newUserType !== 'super_admin') {
      toast({
        title: "Action not allowed",
        description: "You cannot change the super admin's user type.",
        variant: "destructive",
      });
      return;
    }
    if (userId === currentUser.id && newUserType !== 'admin' && newUserType !== 'super_admin') {
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

  const handleAddOrDeductDaysOff = async (userId: string, hours: number) => {
    if (!hours) return;
    // Add: insert a new timesheet entry with +hours
    // Deduct: insert a new timesheet entry with -hours
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from("timesheet").insert([
      {
        user_id: userId,
        project_id: null,
        date: today,
        hours: hours,
        description: "31",
      },
    ]);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: hours > 0 ? "Day(s) Off Added" : "Day(s) Off Deducted", description: `User ${userId} now has updated days off.` });
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
        const map: Record<string, number> = {};
        data.forEach(e => {
          // Handle both string and number user_id
          const userId = String(e.user_id);
          map[userId] = (map[userId] || 0) + (parseFloat(String(e.hours)) || 0);
        });
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
  function getWeekDateRange(weekNumber: number, year: number) {
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
        from: weekMonday.toISOString().split('T')[0],
        to: weekSunday.toISOString().split('T')[0]
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
        from: monday.toISOString().split('T')[0],
        to: sunday.toISOString().split('T')[0]
      };
    }
  }

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

    toast({
      title: "Reminders Sent",
      description: `Reminders sent to ${reminderUserIds.length} user(s): ${userNames} for week ${weekNum} of ${year}.`,
    });

    // Reset form
    setReminderUserIds([]);
    setReminderWeekNumber("");
    setReminderYear(new Date().getFullYear().toString());
  };

  // Handle admin actions on confirmed weeks
  const handleApproveWeek = async (userId: string, weekStartDate: string) => {
    const { error } = await supabase
      .from('confirmed_weeks')
      .update({ admin_approved: true, admin_reviewed: true })
      .eq('user_id', userId)
      .eq('week_start_date', weekStartDate);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Week Goedgekeurd", description: "De week is goedgekeurd door admin." });
      // Refresh confirmed weeks
      const { data } = await supabase
        .from('confirmed_weeks')
        .select('*')
        .eq('confirmed', true)
        .order('week_start_date', { ascending: false });
      setConfirmedWeeks(data || []);
    }
  };

  const handleRejectWeek = async (userId: string, weekStartDate: string) => {
    const { error } = await supabase
      .from('confirmed_weeks')
      .update({ admin_approved: false, admin_reviewed: true })
      .eq('user_id', userId)
      .eq('week_start_date', weekStartDate);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Week Afgekeurd", description: "De week is afgekeurd door admin." });
      // Refresh confirmed weeks
      const { data } = await supabase
        .from('confirmed_weeks')
        .select('*')
        .eq('confirmed', true)
        .order('week_start_date', { ascending: false });
      setConfirmedWeeks(data || []);
    }
  };

  const handleUnlockWeek = async (userId: string, weekStartDate: string) => {
    const { error } = await supabase
      .from('confirmed_weeks')
      .update({ confirmed: false, admin_approved: false, admin_reviewed: false })
      .eq('user_id', userId)
      .eq('week_start_date', weekStartDate);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ 
        title: "Week Teruggezet", 
        description: "De week is teruggezet. De gebruiker kan de uren nu opnieuw aanpassen." 
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
      <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">{t('admin.title')}</h2>
      
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
      
      {/* Send Reminder Section - Available for admin and administratie */}
      <div className="mb-6 sm:mb-8 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
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
      
      {/* Existing Users Section - Only for admins, not for administratie */}
      {currentUser?.isAdmin && !isAdministratie(currentUser) && (
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
                      disabled={user.email === SUPER_ADMIN_EMAIL && currentUser.email !== SUPER_ADMIN_EMAIL}
                    >
                      <SelectTrigger className="h-8 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">{t('admin.userType.user')}</SelectItem>
                        <SelectItem value="administratie">{t('admin.userType.administratie')}</SelectItem>
                        <SelectItem value="admin">{t('admin.userType.admin')}</SelectItem>
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
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('admin.daysOffLeft')}:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {(() => {
                        const daysLeft = (totalDaysOff - ((daysOffMap[String(user.id)] || 0) / 8)).toFixed(2);
                        const hoursLeft = (parseFloat(daysLeft) * 8).toFixed(1);
                        return `${daysLeft} (${hoursLeft} ${t('admin.hours')})`;
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
                      <Button size="sm" onClick={() => handleAddOrDeductDaysOff(user.id, -Math.abs(parseFloat(daysOffInput[user.id] || "0")))} className="flex-1 h-9 text-xs">
                        {t('admin.add')}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleAddOrDeductDaysOff(user.id, Math.abs(parseFloat(daysOffInput[user.id] || "0")))} className="flex-1 h-9 text-xs">
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
                        disabled={user.email === SUPER_ADMIN_EMAIL && currentUser.email !== SUPER_ADMIN_EMAIL}
                      >
                        <SelectTrigger className="h-9 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">{t('admin.userType.user')}</SelectItem>
                          <SelectItem value="administratie">{t('admin.userType.administratie')}</SelectItem>
                          <SelectItem value="admin">{t('admin.userType.admin')}</SelectItem>
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
                    <td className="p-2 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">
                      {(() => {
                        const daysLeft = (totalDaysOff - ((daysOffMap[String(user.id)] || 0) / 8)).toFixed(2);
                        const hoursLeft = (parseFloat(daysLeft) * 8).toFixed(1);
                        return `${daysLeft} (${hoursLeft} ${t('admin.hours')})`;
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
                        <Button size="sm" onClick={() => handleAddOrDeductDaysOff(user.id, -Math.abs(parseFloat(daysOffInput[user.id] || "0")))}>
                          {t('admin.add')}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleAddOrDeductDaysOff(user.id, Math.abs(parseFloat(daysOffInput[user.id] || "0")))}>
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
      
      {/* All Confirmed Weeks Section - Available for admin and administratie */}
      {isAdminOrAdministratie(currentUser) && (
      <div className="mt-8 sm:mt-12">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-green-600 dark:text-green-400">{t('admin.allConfirmedWeeks')}</h3>
        <div className="space-y-3">
          {users.map(user => {
            const userConfirmedWeeks = confirmedWeeks.filter(
              cw => cw.user_id === user.id && cw.confirmed
            );
            
            if (userConfirmedWeeks.length === 0) {
              return null;
            }
            
            return (
              <div key={user.id} className="border rounded-lg p-3 sm:p-4 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow">
                <div className="font-semibold text-base sm:text-lg mb-3 text-gray-900 dark:text-gray-100">
                  {user.name || user.email}
                </div>
                <div className="space-y-2">
                  {userConfirmedWeeks.map((cw) => {
                    // Calculate the correct ISO week Monday based on the stored week_start_date
                    // This ensures we get the correct week number even if week_start_date was stored incorrectly
                    const storedDate = new Date(cw.week_start_date);
                    const isoWeekMonday = getISOWeekMonday(storedDate);
                    const weekStart = isoWeekMonday;
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    const weekNum = getISOWeekNumber(weekStart);
                    // Use the ISO week date range for filtering entries, not the stored week_start_date
                    const weekStartStr = weekStart.toISOString().split('T')[0];
                    const weekEndStr = weekEnd.toISOString().split('T')[0];
                    const weekEntries = allEntries.filter(
                      e => e.user_id === cw.user_id && 
                      e.date >= weekStartStr && 
                      e.date <= weekEndStr
                    );
                    const totalHours = weekEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);
                    
                    const isNotApproved = !cw.admin_approved;
                    
                    return (
                      <div 
                        key={`${cw.user_id}-${cw.week_start_date}`} 
                        className="border rounded p-2 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        onClick={() => setSelectedWeekForView({ userId: cw.user_id, weekStartDate: cw.week_start_date })}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
                              {t('admin.week')} {weekNum} ({weekStart.toLocaleDateString('nl-NL')} - {weekEnd.toLocaleDateString('nl-NL')})
                              <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                              {t('admin.total')}: {totalHours.toFixed(2)} ({weekEntries.length} {t('admin.entries')})
                            </div>
                            <div className="text-xs sm:text-sm mt-1 text-gray-700 dark:text-gray-300">
                              {t('admin.status')}: {cw.admin_approved ? (
                                <span className="text-green-600 dark:text-green-400 font-semibold">{t('admin.approvedStatus')}</span>
                              ) : cw.admin_reviewed ? (
                                <span className="text-red-600 dark:text-red-400 font-semibold">{t('admin.rejectedStatus')}</span>
                              ) : (
                                <span className="text-orange-600 dark:text-orange-400 font-semibold">{t('admin.pendingReviewStatus')}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            {!cw.admin_approved && (
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700 h-8"
                                onClick={() => handleApproveWeek(cw.user_id, cw.week_start_date)}
                              >
                                {t('admin.approveButton')}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-orange-600 dark:border-orange-500 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 h-8"
                              onClick={() => handleUnlockWeek(cw.user_id, cw.week_start_date)}
                            >
                              {t('admin.unlockButton')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {confirmedWeeks.filter(cw => cw.confirmed).length === 0 && (
            <div className="text-gray-400 dark:text-gray-500 text-center italic p-6 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              {t('admin.noConfirmedWeeks')}
            </div>
          )}
        </div>
      </div>
      )}
      
      {/* Week Details Dialog */}
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
        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEndStr = weekEnd.toISOString().split('T')[0];
        let weekEntries = allEntries.filter(
          e => e.user_id === cw.user_id && 
          e.date >= weekStartStr && 
          e.date <= weekEndStr
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
          weekDays.push(day.toISOString().split('T')[0]);
        }
        
        const totalHours = weekEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);
        
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
                    {!cw.admin_approved && (
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
                          const dayTotal = dayEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);
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
      
      {/* Below user table: User Weekly Entries Accordion - Only for admins, not for administratie */}
      {currentUser?.isAdmin && !isAdministratie(currentUser) && (
      <div className="mt-8 sm:mt-12">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">{t('admin.viewUserWeeklyEntries')}</h3>
        <Accordion type="multiple" className="w-full">
          {users.map(user => {
            // Group this user's entries by week
            const userEntries = allEntries.filter(e => e.user_id === user.id);
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
                const { data, error } = await supabase
                  .from("timesheet")
                  .select("*, projects(name)");
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
                  user_name: users.find((u: any) => u.id === row.user_id)?.name || "",
                  user_email: users.find((u: any) => u.id === row.user_id)?.email || ""
                }));
                // Simple Excel export for now
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
                const { data, error } = await supabase
                  .from("timesheet")
                  .select("*, projects(name)")
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
                  let queryBuilder = supabase
                    .from("timesheet")
                    .select("*, projects(name)")
                    .gte("date", from)
                    .lte("date", to);
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
                    user_name: users.find((u: any) => u.id === row.user_id)?.name || "",
                    user_email: users.find((u: any) => u.id === row.user_id)?.email || ""
                  }));
                  const selectedUser = users.find((u: any) => u.id === selectedExportUserId);
                  const userName = selectedUser ? (selectedUser.name || selectedUser.email || "User").replace(/[^a-zA-Z0-9]/g, '_') : "All_Users";
                  const filename = `${userName}_Week${weekNum}_${year}.xlsx`;
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
                  XLSX.writeFile(wb, filename);
                  setExporting(false);
                  toast({
                    title: "Export Successful",
                    description: `Week ${weekNum} (${year}) exported${selectedUser ? ` for ${selectedUser.name || selectedUser.email}` : ""}.`,
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

      {/* Overtime Tracking Section - Available for admin and administratie */}
      {isAdminOrAdministratie(currentUser) && (
      <div className="mt-8 sm:mt-12 mb-6 sm:mb-8 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-base sm:text-lg font-semibold mb-3 text-blue-800 dark:text-blue-200 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Overuren Tracking
        </h3>
        <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 mb-4">
          Bekijk overuren per gebruiker. Een normale werkdag is 8 uur. Alles wat meer is gewerkt wordt als overuren geteld.
        </p>
        
        {/* Filters */}
        <div className="mb-4 bg-white dark:bg-gray-700 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4'} gap-4 mb-4`}>
            <div>
              <Label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                Periode
              </Label>
              <Select value={overtimePeriod} onValueChange={(value: any) => setOvertimePeriod(value)}>
                <SelectTrigger className="w-full bg-white dark:bg-gray-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Maand</SelectItem>
                  <SelectItem value="year">Jaar</SelectItem>
                  <SelectItem value="all">Alles</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {overtimePeriod === "week" && (
              <>
                <div>
                  <Label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    Week
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
                    Jaar
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
                  {overtimePeriod === "month" ? "Maand" : "Jaar"}
                </Label>
                {overtimePeriod === "month" ? (
                  <Select value={overtimeSelectedMonth} onValueChange={setOvertimeSelectedMonth}>
                    <SelectTrigger className="w-full bg-white dark:bg-gray-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => {
                        const monthNum = String(i + 1).padStart(2, '0');
                        const monthName = new Date(2000, i, 1).toLocaleDateString('nl-NL', { month: 'long' });
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
                    placeholder="Jaar" 
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
                  Jaar
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
            )}
            
            <div>
              <Label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                Gebruiker
              </Label>
              <Select value={overtimeSelectedUserId} onValueChange={setOvertimeSelectedUserId}>
                <SelectTrigger className="w-full bg-white dark:bg-gray-800">
                  <SelectValue placeholder="Alle gebruikers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle gebruikers</SelectItem>
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
            {overtimeLoading ? "Berekenen..." : "Bereken Overuren"}
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
                    <div className="text-sm text-gray-600 dark:text-gray-400">Totaal Overuren</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {userData.totalOvertime}h
                    </div>
                  </div>
                </div>
                
                <Accordion type="multiple" className="w-full">
                  {userData.dailyOvertime.map((day: any, idx: number) => (
                    <AccordionItem key={idx} value={`day-${userData.userId}-${idx}`} className="border border-gray-200 dark:border-gray-700 rounded-lg mb-2">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="text-left">
                            <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                              {formatDateWithDayName(day.date)}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {day.totalHours}h totaal - {day.normalHours}h normaal
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              +{day.overtime}h overuren
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="mt-3">
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
            Klik op "Bereken Overuren" om de overuren te berekenen.
          </div>
        )}
      </div>
      )}

      {/* Timebuzzer Sync Section - Only for admins, not for administratie */}
      {currentUser?.isAdmin && !isAdministratie(currentUser) && (
      <div className="mb-6 sm:mb-8 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
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
                {users
                  .filter((u: any) => u.timebuzzer_user_id) // Only show users with Timebuzzer mapping
                  .map((user: any) => (
                    <SelectItem key={user.id} value={user.timebuzzer_user_id}>
                      {user.name || user.email} ({user.timebuzzer_user_id})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Select a user to test Timebuzzer API for that specific user only. Leave empty to test for all users.
            </p>
          </div>
          <div className="flex gap-2">
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
              Test API
            </Button>
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
      )}
    </div>
  );
};

export default AdminPanel; 