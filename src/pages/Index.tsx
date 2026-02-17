import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, FileText, Calendar, BarChart3, Download, AlertTriangle, FileDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TimesheetEntry from "@/components/TimesheetEntry";
import ProjectManagement from "@/components/ProjectManagement";
import TimeOverview from "@/components/TimeOverview";
import AuthSection from "@/components/AuthSection";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import AdminPanel from "@/components/AdminPanel";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import WeeklyCalendarEntry from "@/components/WeeklyCalendarEntry";
import WeeklyCalendarEntrySimple from "@/components/WeeklyCalendarEntrySimple";
import ViewHours from "@/components/ViewHours";
import UserOvertimeView from "@/components/UserOvertimeView";
import ScreenshotButton from "@/components/ScreenshotButton";
import BugReports from "@/components/BugReports";
import InstallPWA from "@/components/InstallPWA";
import Profile from "@/components/Profile";
import LanguageSelector from "@/components/LanguageSelector";
import ThemeToggle from "@/components/ThemeToggle";
import SharedEntriesPanel from "@/components/SharedEntriesPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { createPDF } from "@/utils/pdfExport";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDateToYYYYMMDD } from "@/utils/dateUtils";

const Index = () => {
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  
  // Helper function to check if user is administratie type
  const isAdministratie = (user: any): boolean => {
    return user?.userType === 'administratie';
  };
  
  // Helper function to check if user is tester type
  const isTester = (user: any): boolean => {
    return user?.userType === 'tester';
  };
  
  // Helper function to check if user is weekly_only type
  const isWeeklyOnly = (user: any): boolean => {
    return user?.userType === 'weekly_only';
  };

  // Helper function to check if user is viewer type (read-only overview + weeks)
  const isViewer = (user: any): boolean => {
    return user?.userType === 'viewer';
  };
  
  // Helper function to check if user can see projects (all logged-in users except viewer)
  const canSeeProjects = (user: any): boolean => {
    return !!user && user?.userType !== 'viewer';
  };
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const SUPER_ADMIN_EMAIL = "r.blance@bampro.nl";
  
  // Helper function to check if user is super admin
  const isSuperAdmin = (user: any): boolean => {
    return user?.email === SUPER_ADMIN_EMAIL;
  };
  
  // Make currentUser available globally for error logging
  useEffect(() => {
    (window as any).__currentUser = currentUser;
    return () => {
      delete (window as any).__currentUser;
    };
  }, [currentUser]);
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [userReminder, setUserReminder] = useState<any>(null);
  const [showDaysOffDialog, setShowDaysOffDialog] = useState(false);
  const [daysOffNotification, setDaysOffNotification] = useState<any>(null);
  const [hasUnreadDaysOffNotification, setHasUnreadDaysOffNotification] = useState(false);
  const [pendingSharesCount, setPendingSharesCount] = useState(0);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("weekly");
  // Super admin "view as" user type (persisted in localStorage); only used when logged-in user is super admin
  const [viewAsUserType, setViewAsUserType] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('bampro_view_as_user_type');
    return saved && saved.length > 0 ? saved : null;
  });
  const [weeklySubTab, setWeeklySubTab] = useState('daylist');
  const [exportPeriod, setExportPeriod] = useState<"day" | "week" | "month" | "year">("week");
  // Initialize selectedDate with today's date in local timezone (avoiding import initialization issues)
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [useSimpleWeeklyView, setUseSimpleWeeklyView] = useState(() => {
    // Check localStorage for saved preference (will be overridden by useEffect when user loads)
    const saved = localStorage.getItem('bampro_use_simple_weekly_view');
    return saved === 'true';
  });
  const { toast } = useToast();

  // Effective user for UI visibility: when super admin has "view as" set, use that role for nav/tabs only; data stays currentUser
  const effectiveUser = useMemo(() => {
    if (!currentUser) return null;
    if (viewAsUserType && currentUser?.email === SUPER_ADMIN_EMAIL) {
      return {
        ...currentUser,
        userType: viewAsUserType,
        isAdmin: viewAsUserType === 'admin' || viewAsUserType === 'super_admin',
      };
    }
    return currentUser;
  }, [currentUser, viewAsUserType]);

  // When view-as changes, redirect to a valid tab for the new role if current tab is not available
  useEffect(() => {
    if (!effectiveUser || !currentUser) return;
    const validTabs: Record<string, boolean> = {
      weekly: !isAdministratie(effectiveUser) && !isViewer(effectiveUser),
      viewhours: !!effectiveUser && !effectiveUser?.isAdmin && effectiveUser?.userType !== 'administratie' && !isViewer(effectiveUser) && !isTester(effectiveUser) && !isWeeklyOnly(effectiveUser),
      overtime: !!effectiveUser && (!effectiveUser?.isAdmin && effectiveUser?.userType !== 'administratie' && !isViewer(effectiveUser) || isViewer(effectiveUser)),
      weeks: isAdministratie(effectiveUser) || isViewer(effectiveUser),
      projects: canSeeProjects(effectiveUser),
      export: !!effectiveUser && !effectiveUser?.isAdmin && !isAdministratie(effectiveUser) && !isViewer(effectiveUser) && !isTester(effectiveUser) && !isWeeklyOnly(effectiveUser),
      bugreports: (effectiveUser?.isAdmin || effectiveUser?.userType === 'super_admin') && !isAdministratie(effectiveUser),
      overview: !isTester(effectiveUser),
      admin: (effectiveUser?.isAdmin || isAdministratie(effectiveUser)) && !isViewer(effectiveUser),
      profile: true,
      timesheet: true,
    };
    if (!validTabs[activeTab]) {
      const defaultTab = isViewer(effectiveUser) ? 'overview' : isAdministratie(effectiveUser) ? 'weeks' : 'weekly';
      setActiveTab(defaultTab);
    }
  }, [viewAsUserType, effectiveUser, activeTab, currentUser]);

  // Update view based on user's weekly_view_option when user changes
  useEffect(() => {
    if (!currentUser) return;
    
    // Handle case where weekly_view_option might not exist yet (column not added)
    const weeklyViewOption = currentUser.weekly_view_option;
    
    if (weeklyViewOption === 'simple') {
      setUseSimpleWeeklyView(true);
      // Clear localStorage to prevent override
      localStorage.removeItem('bampro_use_simple_weekly_view');
    } else if (weeklyViewOption === 'original') {
      setUseSimpleWeeklyView(false);
      // Clear localStorage to prevent override
      localStorage.removeItem('bampro_use_simple_weekly_view');
    } else {
      // 'both', null, or undefined - use localStorage preference
      const saved = localStorage.getItem('bampro_use_simple_weekly_view');
      setUseSimpleWeeklyView(saved === 'true');
    }
  }, [currentUser?.weekly_view_option, currentUser?.id]);
  
  // Fetch pending shares count
  const fetchPendingSharesCount = async () => {
    if (!currentUser?.id) return;
    try {
      const { count, error } = await supabase
        .from('shared_entries')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', currentUser.id)
        .eq('status', 'pending');
      
      if (!error && count !== null) {
        setPendingSharesCount(count);
      } else if (error) {
        console.error('Error fetching pending shares count:', error);
      }
    } catch (error) {
      console.error('Error fetching pending shares count:', error);
    }
  };

  // Fetch pending shares count when user logs in
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      fetchPendingSharesCount();
      // Refresh every 30 seconds
      const interval = setInterval(fetchPendingSharesCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, currentUser]);

  // Periodically refetch user data to get updated weekly_view_option (when admin changes it)
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;
    
    const refetchUserData = async () => {
      if (!currentUser?.id) return;
      
      try {
        const { data: userData, error } = await supabase
          .from("users")
          .select("id, email, name, isAdmin, must_change_password, approved, created_at, photo_url, phone_number, userType, weekly_view_option")
          .eq("id", currentUser.id)
          .single();
        
        if (!error && userData) {
          // Update currentUser with all fields from database (in case any changed)
          // This ensures weekly_view_option and other fields stay in sync
          setCurrentUser((prevUser: any) => {
            if (!prevUser) return userData;
            // Only update if something actually changed to avoid unnecessary re-renders
            const hasChanged = Object.keys(userData).some(key => prevUser[key] !== userData[key]);
            if (!hasChanged) {
              return prevUser;
            }
            return { ...prevUser, ...userData };
          });
        }
      } catch (err) {
        console.error("Error refetching user data:", err);
      }
    };
    
    // Refetch every 60 seconds when page is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refetchUserData();
      }
    }, 60000); // Check every 60 seconds
    
    // Also refetch when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetchUserData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoggedIn, currentUser?.id]); // Use id instead of email to avoid unnecessary re-runs

  // Check for unread reminders when user logs in (including admins)
  useEffect(() => {
    const checkReminders = async () => {
      if (!isLoggedIn || !currentUser) {
        console.log("Reminder check skipped: not logged in or no user", { isLoggedIn, hasUser: !!currentUser });
        return;
      }
      
      try {
        console.log("Checking reminders for user:", currentUser.id, currentUser.email);
        const { data: reminders, error } = await supabase
          .from("reminders")
          .select("*")
          .eq("user_id", currentUser.id.toString())
          .is("read_at", null)
          .order("created_at", { ascending: false })
          .limit(1);
        
        console.log("Reminder query result:", { reminders, error, count: reminders?.length });
        
        // If table doesn't exist, just ignore (table will be created later)
        if (error) {
          // Check if it's a "table doesn't exist" error
          if (error.message?.includes("does not exist") || error.message?.includes("relation") || error.code === "42P01") {
            console.log("Reminders table not found - skipping reminder check");
            return;
          }
          console.error("Error checking reminders:", error);
          return;
        }
        
        if (reminders && reminders.length > 0) {
          console.log("Found reminder, showing dialog:", reminders[0]);
          setUserReminder(reminders[0]);
          setShowReminderDialog(true);
        } else {
          console.log("No unread reminders found");
        }
      } catch (err) {
        console.error("Error in reminder check:", err);
        // Don't block page rendering if reminder check fails
      }
    };
    
    checkReminders();
  }, [isLoggedIn, currentUser]);

  // Check for unread days off notifications
  // This function will be called on login, page load, and when user returns to the page
  const checkDaysOffNotifications = async () => {
    if (!isLoggedIn || !currentUser) {
      console.log("Days off notification check skipped: not logged in or no user", { isLoggedIn, hasUser: !!currentUser });
      return;
    }
    
    try {
      console.log("Checking days off notifications for user:", currentUser.id, currentUser.email);
      const userId = String(currentUser.id);
      console.log("Querying with user_id:", userId);
      
      const { data: notifications, error } = await supabase
        .from("days_off_notifications")
        .select("*")
        .eq("user_id", userId)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      
      console.log("Days off notifications query result:", { notifications, error, count: notifications?.length });
      
      // If table doesn't exist, just ignore
      if (error) {
        if (error.message?.includes("does not exist") || error.message?.includes("relation") || error.code === "42P01") {
          console.log("Days off notifications table not found - skipping check. Please run create_days_off_notifications_table.sql in Supabase.");
          return;
        }
        console.error("Error checking days off notifications:", error);
        return;
      }
      
      if (notifications && notifications.length > 0) {
        // Only show dialog if we don't already have this notification shown
        const notificationId = notifications[0].id;
        if (!daysOffNotification || daysOffNotification.id !== notificationId) {
          console.log("Found unread days off notification:", notifications[0]);
          setDaysOffNotification(notifications[0]);
          setShowDaysOffDialog(true);
          setHasUnreadDaysOffNotification(true);
        }
      } else {
        console.log("No unread days off notifications found");
        setHasUnreadDaysOffNotification(false);
      }
    } catch (err) {
      console.error("Error in days off notification check:", err);
    }
  };

  // Check notifications when user logs in or currentUser changes
  useEffect(() => {
    checkDaysOffNotifications();
  }, [isLoggedIn, currentUser]);

  // Check notifications when page becomes visible (user returns to tab/window)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isLoggedIn && currentUser) {
        console.log("Page became visible, checking for new notifications");
        checkDaysOffNotifications();
      }
    };

    const handleFocus = () => {
      if (isLoggedIn && currentUser) {
        console.log("Window gained focus, checking for new notifications");
        checkDaysOffNotifications();
      }
    };

    // Listen for visibility changes (tab switching)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Listen for window focus (returning to window)
    window.addEventListener('focus', handleFocus);

    // Also check periodically (every 30 seconds) if user is logged in
    const interval = setInterval(() => {
      if (isLoggedIn && currentUser && document.visibilityState === 'visible') {
        console.log("Periodic check for new notifications");
        checkDaysOffNotifications();
      }
    }, 30000); // Check every 30 seconds

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [isLoggedIn, currentUser]);

  // Check for saved session on page load (only if rememberMe was checked)
  useEffect(() => {
    // Only check localStorage for rememberMe sessions (168 hours / 7 days)
    const savedSession = localStorage.getItem('bampro_user_session');
    
    if (savedSession) {
      try {
        const sessionData = JSON.parse(savedSession);
        const sessionDate = new Date(sessionData.loginTime);
        const hoursSinceLogin = (Date.now() - sessionDate.getTime()) / (1000 * 60 * 60);
        
        // Only restore session if rememberMe was true and within 168 hours (7 days)
        const isRememberMe = sessionData.rememberMe === true;
        const maxHours = 168; // 7 days
        
        if (isRememberMe && hoursSinceLogin < maxHours) {
          // Verify user still exists and is approved
          const verifyUser = async () => {
            const { data: user, error } = await supabase
              .from("users")
              .select("id, email, name, isAdmin, must_change_password, approved, created_at, photo_url, phone_number, userType, weekly_view_option")
              .eq("email", sessionData.user.email)
              .single();
            
            if (!error && user && user.approved !== false) {
              setCurrentUser(user);
              setIsLoggedIn(true);
              console.log(`✅ Auto-login: Session restored (rememberMe was enabled)`);
            } else {
              // User no longer exists or not approved, clear session
              localStorage.removeItem('bampro_user_session');
            }
          };
          verifyUser();
        } else {
          // Session expired or rememberMe was false
          localStorage.removeItem('bampro_user_session');
          if (!isRememberMe) {
            console.log(`⏰ Session cleared (rememberMe was not enabled)`);
          } else {
            console.log(`⏰ Session expired (older than ${maxHours} hours)`);
          }
        }
      } catch (error) {
        console.error("Error parsing saved session:", error);
        localStorage.removeItem('bampro_user_session');
      }
    }
  }, []);

  // Set activeTab to "weeks" for administratie users when they log in; "overview" for viewer (uses effectiveUser for view-as)
  useEffect(() => {
    if (!isLoggedIn || !currentUser || !effectiveUser) return;
    if (isAdministratie(effectiveUser) && activeTab === "weekly") {
      setActiveTab("weeks");
    } else if (isViewer(effectiveUser) && activeTab === "weekly") {
      setActiveTab("overview");
    }
  }, [isLoggedIn, currentUser, effectiveUser, activeTab]);

  // Check if user came from invite email and redirect to invite-confirm page
  useEffect(() => {
    let token = searchParams.get("access_token");
    const type = searchParams.get("type");
    
    if (!token && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      token = hashParams.get("access_token");
      const hashType = hashParams.get("type");
      if (hashType === "invite" || hashType === "signup") {
        // Redirect to invite-confirm page with tokens
        navigate(`/invite-confirm${window.location.hash}`, { replace: true });
        return;
      }
    }
    
    // If we have an access_token and it's an invite, redirect to invite-confirm
    if (token && (type === "invite" || type === "signup")) {
      navigate(`/invite-confirm${window.location.search}${window.location.hash}`, { replace: true });
    }
  }, [searchParams, navigate]);

  // Helper to get ISO week number (matching WeeklyCalendarEntrySimple)
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

  // Helper to get week dates array
  function getWeekDates(date: Date) {
    const start = new Date(date);
    start.setDate(date.getDate() - ((date.getDay() + 6) % 7)); // Monday as first day
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }

  // Helper to format date to YYYY-MM-DD
  const formatDateToYYYYMMDD = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to get date range from week number and year (ISO week)
  function getWeekDateRange(weekNumber: number, year: number) {
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
        from: formatDateToYYYYMMDD(weekMonday),
        to: formatDateToYYYYMMDD(weekSunday)
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
        from: formatDateToYYYYMMDD(monday),
        to: formatDateToYYYYMMDD(sunday)
      };
    }
  }

  // Helper to get day name in Dutch
  const getDayNameNL = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
    return days[date.getDay()];
  };

  // Helper to create formatted Excel file with better readability
  const createFormattedExcel = (data: any[], filename: string, options?: {
    userName?: string;
    dateRange?: { from: string; to: string };
    period?: string;
  }) => {
    const wb = XLSX.utils.book_new();
    
    // Check if this is a week export (period contains "Week" and dateRange spans 7 days)
    const isWeekExport = options?.period?.toLowerCase().includes('week') && 
                         options?.dateRange && 
                         (() => {
                           const from = new Date(options.dateRange.from);
                           const to = new Date(options.dateRange.to);
                           const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
                           return diffDays === 6; // 7 days (0-6 inclusive)
                         })();
    
    // Sort data by date (ascending)
    const sortedData = [...data].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      // If same date, sort by startTime
      const timeA = a.startTime || "";
      const timeB = b.startTime || "";
      return timeA.localeCompare(timeB);
    });
    
    // Prepare formatted data - only include user columns if user info exists
    const formattedData = sortedData.map((entry) => {
      const workType = parseInt(entry.description || "0");
      const baseRow: any = {
        Date: formatDateDDMMYY(entry.date),
        Day: getDayNameNL(entry.date),
        'Work Type': getWorkTypeLabel(entry.description || ""),
        Project: entry.projects?.name || entry.project || "",
        'Start Time': entry.startTime || "",
        'End Time': entry.endTime || "",
        Hours: typeof entry.hours === 'number' ? entry.hours : parseFloat(entry.hours || 0),
        'Hours (HH:MM)': formatHoursHHMM(entry.hours || 0),
        Notes: entry.notes || "",
      };
      
      // Add kilometers for work types 20 and 21
      if (workType === 20 || workType === 21) {
        baseRow['Kilometers'] = entry.kilometers ? parseFloat(String(entry.kilometers)) : "";
      }
      
      // Only add user columns if user info exists (for admin exports)
      if (entry.user_name || entry.user_email) {
        return {
          ...baseRow,
          'User Name': entry.user_name || "",
          'User Email': entry.user_email || "",
        };
      }
      
      return baseRow;
    });

    // Check if user columns exist to determine column count
    const hasUserColumns = formattedData.length > 0 && (formattedData[0] as any)['User Name'] !== undefined;
    
    // If this is a week export, create per-day sheets
    if (isWeekExport && options?.dateRange) {
      const fromDate = new Date(options.dateRange.from);
      const toDate = new Date(options.dateRange.to);
      const dayNamesEN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      
      // Group entries by day
      const entriesByDay: Record<string, any[]> = {};
      for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDateToYYYYMMDD(d);
        entriesByDay[dateStr] = sortedData.filter(entry => entry.date === dateStr);
      }
      
      // Create sheets for each day and store them with their day index for sorting
      const sheets: Array<{ dayIndex: number; dayName: string; ws: any }> = [];
      
      for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDateToYYYYMMDD(d);
        const dayEntries = entriesByDay[dateStr] || [];
        // Convert day index: Sunday (0) -> 6, Monday (1) -> 0, etc.
        const dayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1;
        const dayName = dayNamesEN[dayIndex];
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
        
        // Create header rows (similar to original template)
        const headerRows: any[][] = [
          ["Employee Name:", options.userName || "", "", "", "", "", "", "", "BAMPRO"],
          ["Date:", `From: ${formatDateDDMMYY(options.dateRange.from)}`, `To: ${formatDateDDMMYY(options.dateRange.to)}`, "", "", "", "", "", ""],
          ["Day:", `${formattedDate} ${dayName}`, "", "", "", "", "", "", ""],
          ["Week Number:", options.period?.match(/\d+/)?.[0] || "", "", "", "", "", "", "", ""],
          ["Year:", new Date(options.dateRange.from).getFullYear().toString(), "", "", "", "", "", "", ""],
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
          "", // Projectleider
          "", // Km stand auto
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

        // Store sheet with day index for sorting
        sheets.push({ dayIndex, dayName, ws });
      }
      
      // Sort sheets by day index (Monday=0, Tuesday=1, ..., Sunday=6)
      sheets.sort((a, b) => a.dayIndex - b.dayIndex);
      
      // Append sheets to workbook in correct order (Monday to Sunday)
      sheets.forEach(({ dayName, ws }) => {
        XLSX.utils.book_append_sheet(wb, ws, dayName);
      });
      
      XLSX.writeFile(wb, filename);
      return;
    }
    
    // Create worksheet (original logic for non-week exports)
    const ws = XLSX.utils.json_to_sheet(formattedData);

    // Set column widths for better readability
    const baseCols = [
      { wch: 12 }, // Date
      { wch: 12 }, // Day
      { wch: 25 }, // Work Type
      { wch: 25 }, // Project
      { wch: 10 }, // Start Time
      { wch: 10 }, // End Time
      { wch: 10 }, // Hours (decimal)
      { wch: 12 }, // Hours (HH:MM)
      { wch: 40 }, // Notes
    ];
    
    if (hasUserColumns) {
      ws['!cols'] = [
        ...baseCols,
        { wch: 25 }, // User Name
        { wch: 30 }, // User Email
      ];
    } else {
      ws['!cols'] = baseCols;
    }

    // Add header information if provided
    if (options?.userName || options?.dateRange) {
      const headerRows: any[][] = [];
      
      if (options.userName) {
        headerRows.push(['Employee Name:', options.userName]);
      }
      
      if (options.dateRange) {
        headerRows.push(['Period:', `From: ${formatDateDDMMYY(options.dateRange.from)} To: ${formatDateDDMMYY(options.dateRange.to)}`]);
      }
      
      if (options.period) {
        headerRows.push(['Period Type:', options.period]);
      }
      
      // Calculate total hours
      const calculatedTotalHours = formattedData.reduce((sum, row) => sum + (row.Hours || 0), 0);
      headerRows.push(['Total Hours:', calculatedTotalHours.toFixed(2)]);
      headerRows.push(['Total Hours (HH:MM):', formatHoursHHMM(calculatedTotalHours)]);
      headerRows.push([]); // Empty row
      
      // Get current sheet data as array of arrays
      const sheetData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      
      // Combine headers with data
      const allRows: any[][] = [...headerRows, ...sheetData];
      
      // Create new worksheet with headers
      const newWs = XLSX.utils.aoa_to_sheet(allRows);
      
      // Copy column widths
      newWs['!cols'] = ws['!cols'];
      
      // Style header rows (bold, background color)
      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "EA580C" } }, // Orange background
        alignment: { horizontal: "left", vertical: "center" }
      };
      
      // Determine column count based on whether user columns exist
      const colCount = hasUserColumns ? 11 : 9;
      
      // Apply styles to header rows
      for (let row = 0; row < headerRows.length; row++) {
        for (let col = 0; col < colCount; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!newWs[cellAddress]) continue;
          newWs[cellAddress].s = headerStyle;
        }
      }
      
      // Style table header row
      const tableHeaderRow = headerRows.length;
      const tableHeaderStyle = {
        font: { bold: true, color: { rgb: "000000" }, sz: 11 },
        fill: { fgColor: { rgb: "FFF4E6" } }, // Light orange background
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "medium", color: { rgb: "EA580C" } },
          bottom: { style: "medium", color: { rgb: "EA580C" } },
          left: { style: "thin", color: { rgb: "CCCCCC" } },
          right: { style: "thin", color: { rgb: "CCCCCC" } }
        }
      };
      
      for (let col = 0; col < colCount; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: tableHeaderRow, c: col });
        if (newWs[cellAddress]) {
          newWs[cellAddress].s = tableHeaderStyle;
        }
      }
      
      // Add borders to data rows for better readability
      const dataStartRow = tableHeaderRow + 1;
      const dataEndRow = tableHeaderRow + formattedData.length;
      
      for (let row = dataStartRow; row <= dataEndRow; row++) {
        for (let col = 0; col < colCount; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (newWs[cellAddress]) {
            // Add border style if not already styled
            if (!newWs[cellAddress].s) {
              newWs[cellAddress].s = {};
            }
            if (!newWs[cellAddress].s.border) {
              newWs[cellAddress].s.border = {
                top: { style: "thin", color: { rgb: "E5E5E5" } },
                bottom: { style: "thin", color: { rgb: "E5E5E5" } },
                left: { style: "thin", color: { rgb: "E5E5E5" } },
                right: { style: "thin", color: { rgb: "E5E5E5" } }
              };
            }
            // Alternate row colors for better readability
            if ((row - dataStartRow) % 2 === 0) {
              newWs[cellAddress].s.fill = { fgColor: { rgb: "FAFAFA" } };
            }
          }
        }
      }
      
      // Add total row at the bottom
      const totalRow = dataEndRow + 1;
      const totalRowStyle = {
        font: { bold: true, color: { rgb: "000000" }, sz: 10 },
        fill: { fgColor: { rgb: "FFF4E6" } },
        alignment: { horizontal: "right", vertical: "center" },
        border: {
          top: { style: "medium", color: { rgb: "EA580C" } },
          bottom: { style: "medium", color: { rgb: "EA580C" } },
          left: { style: "thin", color: { rgb: "CCCCCC" } },
          right: { style: "thin", color: { rgb: "CCCCCC" } }
        }
      };
      
      // Find Hours column index (usually column 6 or 7)
      const hoursColIndex = formattedData[0] ? Object.keys(formattedData[0]).indexOf('Hours') : 6;
      const hoursHHMMColIndex = formattedData[0] ? Object.keys(formattedData[0]).indexOf('Hours (HH:MM)') : 7;
      
      // Add "Total" label
      const totalLabelCell = XLSX.utils.encode_cell({ r: totalRow, c: hoursColIndex - 1 });
      newWs[totalLabelCell] = { v: "Total:", t: "s" };
      newWs[totalLabelCell].s = totalRowStyle;
      
      // Add total hours (decimal)
      const totalHoursCell = XLSX.utils.encode_cell({ r: totalRow, c: hoursColIndex });
      const rowTotalHours = formattedData.reduce((sum, row) => sum + (row.Hours || 0), 0);
      newWs[totalHoursCell] = { v: rowTotalHours, t: "n" };
      newWs[totalHoursCell].s = { ...totalRowStyle, numFmt: "0.00" };
      
      // Add total hours (HH:MM)
      const totalHoursHHMMCell = XLSX.utils.encode_cell({ r: totalRow, c: hoursHHMMColIndex });
      newWs[totalHoursHHMMCell] = { v: formatHoursHHMM(rowTotalHours), t: "s" };
      newWs[totalHoursHHMMCell].s = totalRowStyle;
      
      // Freeze header row
      newWs['!freeze'] = { xSplit: 0, ySplit: tableHeaderRow + 1, topLeftCell: `A${tableHeaderRow + 2}`, activePane: 'bottomLeft', state: 'frozen' };
      
      XLSX.utils.book_append_sheet(wb, newWs, "Timesheet");
    } else {
      XLSX.utils.book_append_sheet(wb, ws, "Timesheet");
    }

    XLSX.writeFile(wb, filename);
  };

  // Helper to download Excel file (backward compatibility)
  const downloadExcel = (data: any[], filename = "timesheet.xlsx") => {
    createFormattedExcel(data, filename);
  };

  // Helper to format date as DD/MM/YY (matching WeeklyCalendarEntrySimple)
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

  // Export all data (admin only)
  const handleExportAll = async () => {
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
    // Flatten project name and add user info
    const rows = (data || []).map((row) => ({ 
      ...row, 
      project: row.projects?.name || "",
      user_name: users.find(u => u.id === row.user_id)?.name || "",
      user_email: users.find(u => u.id === row.user_id)?.email || ""
    }));
    createFormattedExcel(rows, "timesheet_all.xlsx", {
      period: "All Data"
    });
    setExporting(false);
    toast({
      title: "Export Successful",
      description: "All timesheet data exported.",
    });
  };

  // Export all data to PDF (admin only)
  const handleExportAllPDF = async () => {
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
    
    // Format data for PDF
    const formattedData = (data || []).map((row) => {
      const user = users.find(u => u.id === row.user_id);
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
  };

  // Export by date range (admin only) - can optionally filter by user
  const handleExportRange = async () => {
    if (!dateRange.from || !dateRange.to) {
      toast({
        title: "Missing Dates",
        description: "Please select a date range.",
        variant: "destructive",
      });
      return;
    }
    setExporting(true);
    
    // Build query with optional user filter
    let queryBuilder = supabase
      .from("timesheet")
      .select("*, projects(name)")
      .gte("date", dateRange.from)
      .lte("date", dateRange.to);
    
    // If a user is selected, filter by user
    if (selectedUserId && selectedUserId !== "all") {
      queryBuilder = queryBuilder.eq("user_id", selectedUserId);
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
    // Filter out admin adjustments (entries without startTime/endTime are admin adjustments)
    // Only export entries that have both startTime and endTime - these are user-created entries
    const filteredData = (data || []).filter(e => e.startTime && e.endTime);
    const rows = filteredData.map((row) => ({ 
      ...row, 
      project: row.projects?.name || "",
      user_name: users.find(u => u.id === row.user_id)?.name || "",
      user_email: users.find(u => u.id === row.user_id)?.email || ""
    }));
    const selectedUser = users.find(u => u.id === selectedUserId);
    const userLabel = selectedUser ? `_${selectedUser.name || selectedUser.email}` : "";
    createFormattedExcel(rows, `timesheet${userLabel}_${dateRange.from}_to_${dateRange.to}.xlsx`, {
      userName: selectedUser?.name || selectedUser?.email,
      dateRange: { from: dateRange.from, to: dateRange.to },
      period: "Date Range"
    });
    setExporting(false);
    toast({
      title: "Export Successful",
      description: `Data exported from ${dateRange.from} to ${dateRange.to}${selectedUser ? ` for ${selectedUser.name || selectedUser.email}` : ""}.`,
    });
  };

  // Export by user (admin only) - all data for selected user
  const handleExportUser = async () => {
    if (!selectedUserId || selectedUserId === "all") {
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
      .eq("user_id", selectedUserId)
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
    // Filter out admin adjustments (entries without startTime/endTime are admin adjustments)
    // Only export entries that have both startTime and endTime - these are user-created entries
    const filteredData = (data || []).filter(e => e.startTime && e.endTime);
    const selectedUser = users.find(u => u.id === selectedUserId);
    const rows = filteredData.map((row) => ({ 
      ...row, 
      project: row.projects?.name || "",
      user_name: selectedUser?.name || selectedUser?.email || "",
      user_email: selectedUser?.email || ""
    }));
    const userName = selectedUser?.name || selectedUser?.email || "user";
    createFormattedExcel(rows, `timesheet_${userName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`, {
      userName: userName,
      period: "All Data"
    });
    setExporting(false);
    toast({
      title: "Export Successful",
      description: `All data exported for ${userName}.`,
    });
  };

  // Export by user to PDF (admin only)
  const handleExportUserPDF = async () => {
    if (!selectedUserId || selectedUserId === "all") {
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
      .eq("user_id", selectedUserId)
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
    
    const selectedUser = users.find(u => u.id === selectedUserId);
    const userName = selectedUser?.name || selectedUser?.email || "user";
    
    // Filter out admin adjustments (entries without startTime/endTime are admin adjustments)
    // Only export entries that have both startTime and endTime - these are user-created entries
    const filteredData = (data || []).filter(e => e.startTime && e.endTime);
    
    // Format data for PDF
    const formattedData = filteredData.map((row) => {
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
  };

  // Export by week number (admin only) - using same template as WeeklyCalendarEntrySimple
  const handleExportWeekNumber = async () => {
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
    
    // Get the user to export (must select a user, not "all")
    if (!selectedUserId || selectedUserId === "all") {
      toast({
        title: "User Selection Required",
        description: "Please select a specific user to export. The weekly export format requires a single user.",
        variant: "destructive",
      });
      return;
    }
    
    setExporting(true);
    
    // Get date range for the week
    const { from, to } = getWeekDateRange(weekNum, year);
    
    // Get week dates array (same as weekly entry)
    const weekStartDate = new Date(from);
    const weekDates = getWeekDates(weekStartDate);
    const calculatedWeekNumber = getISOWeekNumber(weekDates[0]);
    
    const fromDate = formatDateToYYYYMMDD(weekDates[0]);
    const toDate = formatDateToYYYYMMDD(weekDates[6]);
    
    const selectedUser = users.find(u => u.id === selectedUserId);
    if (!selectedUser) {
      toast({
        title: "User Not Found",
        description: "Selected user could not be found.",
        variant: "destructive",
      });
      setExporting(false);
      return;
    }
    
    let queryBuilder = supabase
      .from("timesheet")
      .select("*, projects(name)")
      .eq("user_id", selectedUserId)
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date", { ascending: true })
      .order("startTime", { ascending: true });
    
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

    if (!data || data.length === 0) {
      toast({
        title: "No Data",
        description: "No entries found for this week.",
        variant: "destructive",
      });
      setExporting(false);
      return;
    }

    // Filter out admin adjustments (entries without startTime/endTime are admin adjustments)
    const filteredData = data.filter((e: any) => e.startTime && e.endTime);

    if (filteredData.length === 0) {
      toast({
        title: "No Data",
        description: "No entries found for this week.",
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
      
      // Calculate total hours for the day (excluding breaks - work type 35)
      const totalHours = dayEntries.reduce((sum: number, entry: any) => {
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
      totalRow.getCell(2).value = 'Total per day';
      totalRow.getCell(2).font = { bold: true };
      totalRow.getCell(6).value = totalHoursHHMM;
      totalRow.getCell(6).font = { bold: true };
      
      // Set print settings for day sheet
      worksheet.pageSetup = {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1
      };
    });

    // Generate filename with user name and week number (same as weekly entry)
    const userName = (selectedUser.name || selectedUser.email || "User").replace(/[^a-zA-Z0-9]/g, '_');
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
      title: "Export Successful",
      description: `Week ${calculatedWeekNumber} (${year}) exported for ${selectedUser.name || selectedUser.email}.`,
    });
  };

  // Export by week number to PDF (admin only)
  const handleExportWeekNumberPDF = async () => {
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
    
    // Get date range for the week
    const { from, to } = getWeekDateRange(weekNum, year);
    
    // Build query with optional user filter
    let queryBuilder = supabase
      .from("timesheet")
      .select("*, projects(name)")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true });
    
    // If a user is selected, filter by user
    if (selectedUserId && selectedUserId !== "all") {
      queryBuilder = queryBuilder.eq("user_id", selectedUserId);
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
    
    const selectedUser = users.find(u => u.id === selectedUserId);
    const userLabel = selectedUser ? `_${selectedUser.name || selectedUser.email}` : "";
    
    // Format data for PDF
    const formattedData = (data || []).map((row) => {
      const user = users.find(u => u.id === row.user_id);
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
      description: `Data exported for week ${weekNum} of ${year}${selectedUser ? ` for ${selectedUser.name || selectedUser.email}` : ""}.`,
    });
  };

  // Fetch users for admin export dropdown (uses effectiveUser for view-as)
  useEffect(() => {
    if (effectiveUser?.isAdmin && activeTab === 'export') {
      const fetchUsers = async () => {
        const { data, error } = await supabase
          .from("users")
          .select("id, email, name")
          .eq("approved", true)
          .order("name");
        if (error) {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        } else {
          setUsers(data || []);
        }
      };
      fetchUsers();
    }
  }, [effectiveUser, activeTab]);

  // Export for normal users (day/week/month/year)
  const handleExportPeriod = async () => {
    if (!currentUser) {
      toast({
        title: "Error",
        description: "User not found",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    let fromDate: string;
    let toDate: string;
    let filename: string;

    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);

    switch (exportPeriod) {
      case "day":
        fromDate = formatDateToYYYYMMDD(selected);
        toDate = fromDate;
        filename = `Uren_${formatDateDDMMYY(fromDate)}.xlsx`;
        break;
      case "week":
        // Get Monday of the week
        const dayOfWeek = selected.getDay();
        const diff = selected.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(selected.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        fromDate = formatDateToYYYYMMDD(monday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        toDate = formatDateToYYYYMMDD(sunday);
        filename = `Uren_Week_${formatDateDDMMYY(fromDate)}_tot_${formatDateDDMMYY(toDate)}.xlsx`;
        break;
      case "month":
        fromDate = formatDateToYYYYMMDD(new Date(selected.getFullYear(), selected.getMonth(), 1));
        toDate = formatDateToYYYYMMDD(new Date(selected.getFullYear(), selected.getMonth() + 1, 0));
        filename = `Uren_${selected.getFullYear()}_${String(selected.getMonth() + 1).padStart(2, '0')}.xlsx`;
        break;
      case "year":
        fromDate = formatDateToYYYYMMDD(new Date(selected.getFullYear(), 0, 1));
        toDate = formatDateToYYYYMMDD(new Date(selected.getFullYear(), 11, 31));
        filename = `Uren_${selected.getFullYear()}.xlsx`;
        break;
    }

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
      setExporting(false);
      return;
    }

    if (!data || data.length === 0) {
      toast({
        title: "No Data",
        description: "No hours found for the selected period.",
        variant: "destructive",
      });
      setExporting(false);
      return;
    }

    // Filter out admin adjustments (entries without startTime/endTime are admin adjustments)
    // Only export entries that have both startTime and endTime - these are user-created entries
    // This matches the behavior of Weekly Entry and View Hours
    const filteredData = data.filter(e => e.startTime && e.endTime);

    if (filteredData.length === 0) {
      toast({
        title: "No Data",
        description: "No hours found for the selected period.",
        variant: "destructive",
      });
      setExporting(false);
      return;
    }

    // Format data for better Excel/PDF export
    const formattedDataForExport = filteredData.map((entry) => ({
      date: entry.date,
      description: entry.description || "",
      projects: entry.projects,
      project: entry.project || "",
      startTime: entry.startTime || "",
      endTime: entry.endTime || "",
      hours: entry.hours || 0,
      notes: entry.notes || "",
    }));

    // Prepare formatted data for display
    const formattedData = formattedDataForExport.map((entry) => {
      const baseRow = {
        Date: formatDateDDMMYY(entry.date),
        Day: getDayNameNL(entry.date),
        'Work Type': getWorkTypeLabel(entry.description || ""),
        Project: entry.projects?.name || entry.project || "",
        'Start Time': entry.startTime || "",
        'End Time': entry.endTime || "",
        Hours: typeof entry.hours === 'number' ? entry.hours : parseFloat(entry.hours || 0),
        'Hours (HH:MM)': formatHoursHHMM(entry.hours || 0),
        Notes: entry.notes || "",
      };
      return baseRow;
    });

    const exportOptions = {
      userName: currentUser.name || currentUser.email,
      dateRange: { from: formatDateDDMMYY(fromDate), to: formatDateDDMMYY(toDate) },
      period: exportPeriod === "day" ? "Day" : exportPeriod === "week" ? "Week" : exportPeriod === "month" ? "Month" : "Year"
    };

    // Create formatted Excel
    createFormattedExcel(formattedDataForExport, filename, exportOptions);

    setExporting(false);
    toast({
      title: "Export Successful",
      description: `${filteredData.length} entries exported to ${filename}`,
    });
  };

  // Export to PDF (same data as Excel)
  const handleExportPeriodPDF = async () => {
    if (!currentUser) {
      toast({
        title: "Error",
        description: "User not found",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    let fromDate: string;
    let toDate: string;
    let filename: string;

    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);

    switch (exportPeriod) {
      case "day":
        fromDate = formatDateToYYYYMMDD(selected);
        toDate = fromDate;
        filename = `Uren_${formatDateDDMMYY(fromDate)}.pdf`;
        break;
      case "week":
        const dayOfWeek = selected.getDay();
        const diff = selected.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(selected.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        fromDate = formatDateToYYYYMMDD(monday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        toDate = formatDateToYYYYMMDD(sunday);
        filename = `Uren_Week_${formatDateDDMMYY(fromDate)}_tot_${formatDateDDMMYY(toDate)}.pdf`;
        break;
      case "month":
        fromDate = formatDateToYYYYMMDD(new Date(selected.getFullYear(), selected.getMonth(), 1));
        toDate = formatDateToYYYYMMDD(new Date(selected.getFullYear(), selected.getMonth() + 1, 0));
        filename = `Uren_${selected.getFullYear()}_${String(selected.getMonth() + 1).padStart(2, '0')}.pdf`;
        break;
      case "year":
        fromDate = formatDateToYYYYMMDD(new Date(selected.getFullYear(), 0, 1));
        toDate = formatDateToYYYYMMDD(new Date(selected.getFullYear(), 11, 31));
        filename = `Uren_${selected.getFullYear()}.pdf`;
        break;
    }

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
      setExporting(false);
      return;
    }

    if (!data || data.length === 0) {
      toast({
        title: "No Data",
        description: "No hours found for the selected period.",
        variant: "destructive",
      });
      setExporting(false);
      return;
    }

    // Filter out admin adjustments (entries without startTime/endTime are admin adjustments)
    // Only export entries that have both startTime and endTime - these are user-created entries
    // This matches the behavior of Weekly Entry and View Hours
    const filteredData = data.filter(e => e.startTime && e.endTime);

    if (filteredData.length === 0) {
      toast({
        title: "No Data",
        description: "No hours found for the selected period.",
        variant: "destructive",
      });
      setExporting(false);
      return;
    }

    // Format data for PDF
    const formattedData = filteredData.map((entry) => {
      return {
        Date: formatDateDDMMYY(entry.date),
        Day: getDayNameNL(entry.date),
        'Work Type': getWorkTypeLabel(entry.description || ""),
        Project: entry.projects?.name || entry.project || "",
        'Start Time': entry.startTime || "",
        'End Time': entry.endTime || "",
        Hours: typeof entry.hours === 'number' ? entry.hours : parseFloat(entry.hours || 0),
        'Hours (HH:MM)': formatHoursHHMM(entry.hours || 0),
        Notes: entry.notes || "",
      };
    });

    const exportOptions = {
      userName: currentUser.name || currentUser.email,
      dateRange: { from: formatDateDDMMYY(fromDate), to: formatDateDDMMYY(toDate) },
      period: exportPeriod === "day" ? "Day" : exportPeriod === "week" ? "Week" : exportPeriod === "month" ? "Month" : "Year",
      data: formattedData
    };

    // Create PDF
    createPDF(exportOptions, filename);

    setExporting(false);
    toast({
      title: "PDF Export Successful",
      description: `${filteredData.length} entries exported to ${filename}`,
    });
  };


  if (!isLoggedIn) {
    return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <div className="container mx-auto px-4 py-12">
            <div className="flex justify-end gap-2 mb-4">
              <ThemeToggle />
              <LanguageSelector />
            </div>
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <img 
                src="/bampro-marine-logo.jpg" 
                alt="BAMPRO MARINE" 
                className="h-20 sm:h-24 md:h-28 object-contain"
              />
            </div>
          </div>
          
          <AuthSection onLogin={setIsLoggedIn} setCurrentUser={setCurrentUser} />
        </div>
      </div>
    );
  }

  // Force password change if required
  if (currentUser?.must_change_password) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ChangePasswordForm currentUser={currentUser} setCurrentUser={setCurrentUser} />
      </div>
    );
  }

  // Mark reminder as read
  const handleReminderRead = async () => {
    if (!userReminder) return;
    
    const { error } = await supabase
      .from("reminders")
      .update({ read_at: new Date().toISOString() })
      .eq("id", userReminder.id);
    
    if (!error) {
      setShowReminderDialog(false);
      setUserReminder(null);
    }
  };

  const handleGoToWeeklyFromReminder = () => {
    if (userReminder) {
      setActiveTab('weekly');
      handleReminderRead();
    }
  };

  const handleDaysOffNotificationRead = async () => {
    if (!daysOffNotification) return;
    
    const { error } = await supabase
      .from("days_off_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", daysOffNotification.id);
    
    if (!error) {
      setShowDaysOffDialog(false);
      setDaysOffNotification(null);
      setHasUnreadDaysOffNotification(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Reminder Dialog for Users */}
      <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-6 w-6 text-orange-500 dark:text-orange-400" />
              Timesheet Reminder
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-base text-gray-700 dark:text-gray-300">
            {userReminder && (
              <>
                <p className="mb-3">
                  You have a reminder to fill in your hours for <strong className="text-gray-900 dark:text-gray-100">week {userReminder.week_number} of {userReminder.year}</strong>.
                </p>
                {userReminder.message && (
                  <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{userReminder.message}</p>
                )}
                <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                  Please fill in your timesheet for this week.
                </p>
              </>
            )}
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleReminderRead}>Dismiss</Button>
            <Button variant="default" onClick={handleGoToWeeklyFromReminder} className="bg-orange-600 hover:bg-orange-700">
              Go to Weekly Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Days Off Notification Dialog */}
      <Dialog open={showDaysOffDialog} onOpenChange={setShowDaysOffDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Calendar className="h-6 w-6 text-green-500 dark:text-green-400" />
              Days Off Update
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-base text-gray-700 dark:text-gray-300">
            {daysOffNotification && (
              <>
                <p className="mb-3">
                  {daysOffNotification.hours_changed > 0 ? (
                    <span className="text-green-700 dark:text-green-400 font-semibold">
                      {Math.abs(daysOffNotification.days_changed).toFixed(2)} day(s) off ({Math.abs(daysOffNotification.hours_changed).toFixed(2)} hours) have been <strong>added</strong> to your account.
                    </span>
                  ) : (
                    <span className="text-orange-700 dark:text-orange-400 font-semibold">
                      {Math.abs(daysOffNotification.days_changed).toFixed(2)} day(s) off ({Math.abs(daysOffNotification.hours_changed).toFixed(2)} hours) have been <strong>deducted</strong> from your account.
                    </span>
                  )}
                </p>
                {daysOffNotification.admin_name && (
                  <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                    Changed by: <strong>{daysOffNotification.admin_name}</strong>
                  </p>
                )}
                {daysOffNotification.message && (
                  <>
                    {daysOffNotification.message.includes('\n\nReason:') ? (
                      <>
                        <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                          {daysOffNotification.message.split('\n\nReason:')[0]}
                        </p>
                        <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Reason:</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {daysOffNotification.message.split('\n\nReason:')[1]}
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                        {daysOffNotification.message}
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button onClick={handleDaysOffNotificationRead} className="bg-green-600 hover:bg-green-700">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className={`bg-white dark:bg-gray-800 shadow-lg border-b border-orange-100 dark:border-gray-700 ${isMobile ? '' : 'fixed top-0 left-0 right-0'} z-50`}>
        <div className="container mx-auto px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-1.5 sm:py-1.5 md:py-2 lg:py-3 max-w-full">
          {/* Logo Row - Only on mobile */}
          {isMobile && (
            <div className="flex justify-center mb-1">
              <button
                onClick={() => setActiveTab(isViewer(effectiveUser) ? 'overview' : isAdministratie(effectiveUser) ? 'weeks' : 'weekly')}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                title="Go to homepage"
              >
                <img 
                  src="/bampro-marine-logo.jpg" 
                  alt="BAMPRO MARINE" 
                  className="h-8 sm:h-12 object-contain"
                />
              </button>
            </div>
          )}
          
          {/* Navigation and Controls Row - All in one line from left to right */}
          <div className="flex flex-row items-center gap-1.5 sm:gap-1 md:gap-1.5 lg:gap-2 overflow-hidden">
            {!isMobile && (
              <button
                onClick={() => setActiveTab(isViewer(effectiveUser) ? 'overview' : isAdministratie(effectiveUser) ? 'weeks' : 'weekly')}
                className="cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                title="Go to homepage"
              >
                <img 
                  src="/bampro-marine-logo.jpg" 
                  alt="BAMPRO MARINE" 
                  className="h-6 md:h-7 lg:h-8 xl:h-9 2xl:h-10 object-contain"
                />
              </button>
            )}
            <nav className="flex items-center gap-1.5 sm:gap-0.5 md:gap-1 lg:gap-1.5 shrink-0 flex-1 min-w-0 flex-nowrap overflow-x-auto">
                {/* Weekly, View Hours, Overtime - hidden for administratie and viewer */}
                {!isAdministratie(effectiveUser) && !isViewer(effectiveUser) && (
                  <>
                    <button
                      className={`text-xs sm:text-xs md:text-sm lg:text-sm xl:text-base font-medium px-2.5 sm:px-1.5 md:px-2 lg:px-2.5 py-1.5 sm:py-1 md:py-1.5 lg:py-2 rounded transition-colors whitespace-nowrap min-h-[36px] sm:min-h-0 flex-shrink-0 relative ${activeTab === 'weekly' ? 'bg-orange-600 text-white dark:bg-orange-500' : 'text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-700'}`}
                      onClick={() => setActiveTab('weekly')}
                    >
                      {t('nav.weekly')}
                      {pendingSharesCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] sm:text-[10px] font-bold rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center">
                          {pendingSharesCount > 9 ? '9+' : pendingSharesCount}
                        </span>
                      )}
                    </button>
                    {/* View Hours - Only for normal users (not admins, administratie, viewer, tester, or weekly_only) */}
                    {effectiveUser && !effectiveUser?.isAdmin && effectiveUser?.userType !== 'administratie' && !isViewer(effectiveUser) && !isTester(effectiveUser) && !isWeeklyOnly(effectiveUser) && (
                      <button
                        className={`text-xs sm:text-xs md:text-sm lg:text-sm xl:text-base font-medium px-2.5 sm:px-1.5 md:px-2 lg:px-2.5 py-1.5 sm:py-1 md:py-1.5 lg:py-2 rounded transition-colors whitespace-nowrap min-h-[36px] sm:min-h-0 flex-shrink-0 ${activeTab === 'viewhours' ? 'bg-orange-600 text-white dark:bg-orange-500' : 'text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-700'}`}
                        onClick={() => setActiveTab('viewhours')}
                      >
                        {t('nav.viewHours')}
                      </button>
                    )}
                    {/* Overtime - Available for all users (except admins/administratie/viewer) */}
                    {effectiveUser && !effectiveUser?.isAdmin && effectiveUser?.userType !== 'administratie' && !isViewer(effectiveUser) && (
                      <button
                        className={`text-xs sm:text-xs md:text-sm lg:text-sm xl:text-base font-medium px-2.5 sm:px-1.5 md:px-2 lg:px-2.5 py-1.5 sm:py-1 md:py-1.5 lg:py-2 rounded transition-colors whitespace-nowrap min-h-[36px] sm:min-h-0 flex-shrink-0 ${activeTab === 'overtime' ? 'bg-orange-600 text-white dark:bg-orange-500' : 'text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-700'}`}
                        onClick={() => setActiveTab('overtime')}
                      >
                        {t('nav.overtime')}
                      </button>
                    )}
                  </>
                )}
                {/* Weken - For administratie and viewer */}
                {(isAdministratie(effectiveUser) || isViewer(effectiveUser)) && (
                  <button
                    className={`text-xs sm:text-xs md:text-sm lg:text-sm xl:text-base font-medium px-2.5 sm:px-1.5 md:px-2 lg:px-2.5 py-1.5 sm:py-1 md:py-1.5 lg:py-2 rounded transition-colors whitespace-nowrap min-h-[36px] sm:min-h-0 flex-shrink-0 ${activeTab === 'weeks' ? 'bg-orange-600 text-white dark:bg-orange-500' : 'text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-700'}`}
                    onClick={() => setActiveTab('weeks')}
                  >
                    {t('nav.weeks')}
                  </button>
                )}
                {/* Overtime - For viewer (read-only all-users overtime) */}
                {isViewer(effectiveUser) && (
                  <button
                    className={`text-xs sm:text-xs md:text-sm lg:text-sm xl:text-base font-medium px-2.5 sm:px-1.5 md:px-2 lg:px-2.5 py-1.5 sm:py-1 md:py-1.5 lg:py-2 rounded transition-colors whitespace-nowrap min-h-[36px] sm:min-h-0 flex-shrink-0 ${activeTab === 'overtime' ? 'bg-orange-600 text-white dark:bg-orange-500' : 'text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-700'}`}
                    onClick={() => setActiveTab('overtime')}
                  >
                    {t('nav.overtime')}
                  </button>
                )}
                {canSeeProjects(effectiveUser) && (
                  <button
                    className={`text-[9px] sm:text-xs md:text-sm lg:text-sm xl:text-base font-medium px-1 sm:px-1.5 md:px-2 lg:px-2.5 py-1.5 sm:py-1 md:py-1.5 lg:py-2 rounded transition-colors whitespace-nowrap min-h-[32px] sm:min-h-0 flex-shrink-0 ${activeTab === 'projects' ? 'bg-orange-600 text-white dark:bg-orange-500' : 'text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-700'}`}
                    onClick={() => setActiveTab('projects')}
                  >
                    {t('nav.projects')}
                  </button>
                )}
                {/* Export - Visible for regular users, not for admin/administratie/viewer/tester/weekly_only (they have it in Admin Panel or don't need it) */}
                {effectiveUser && !effectiveUser?.isAdmin && !isAdministratie(effectiveUser) && !isViewer(effectiveUser) && !isTester(effectiveUser) && !isWeeklyOnly(effectiveUser) && (
                  <button
                    className={`text-[9px] sm:text-xs md:text-sm lg:text-sm xl:text-base font-medium px-1 sm:px-1.5 md:px-2 lg:px-2.5 py-1.5 sm:py-1 md:py-1.5 lg:py-2 rounded transition-colors whitespace-nowrap min-h-[32px] sm:min-h-0 flex-shrink-0 ${activeTab === 'export' ? 'bg-orange-600 text-white dark:bg-orange-500' : 'text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-700'}`}
                    onClick={() => setActiveTab('export')}
                  >
                    {t('nav.export')}
                  </button>
                )}
                {(effectiveUser?.isAdmin || effectiveUser?.userType === 'super_admin') && !isAdministratie(effectiveUser) && (
                  <button
                    className={`text-[9px] sm:text-xs md:text-sm lg:text-sm xl:text-base font-medium px-1 sm:px-1.5 md:px-2 lg:px-2.5 py-1.5 sm:py-1 md:py-1.5 lg:py-2 rounded transition-colors whitespace-nowrap min-h-[32px] sm:min-h-0 flex-shrink-0 ${activeTab === 'bugreports' ? 'bg-orange-600 text-white dark:bg-orange-500' : 'text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-700'}`}
                    onClick={() => setActiveTab('bugreports')}
                  >
                    {t('nav.reportBug')}
                  </button>
                )}
                {/* Overview - Not visible for tester */}
                {!isTester(effectiveUser) && (
                  <button
                    className={`text-[9px] sm:text-xs md:text-sm lg:text-sm xl:text-base font-medium px-1 sm:px-1.5 md:px-2 lg:px-2.5 py-1.5 sm:py-1 md:py-1.5 lg:py-2 rounded transition-colors whitespace-nowrap min-h-[32px] sm:min-h-0 flex-shrink-0 ${activeTab === 'overview' ? 'bg-orange-600 text-white dark:bg-orange-500' : 'text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-700'}`}
                    onClick={() => setActiveTab('overview')}
                  >
                    {t('nav.overview')}
                  </button>
                )}
                {(effectiveUser?.isAdmin || isAdministratie(effectiveUser)) && !isViewer(effectiveUser) && (
                  <button
                    className={`text-[9px] sm:text-xs md:text-sm lg:text-sm xl:text-base font-medium px-1 sm:px-1.5 md:px-2 lg:px-2.5 py-1.5 sm:py-1 md:py-1.5 lg:py-2 rounded transition-colors whitespace-nowrap min-h-[32px] sm:min-h-0 flex-shrink-0 ${activeTab === 'admin' ? 'bg-orange-600 text-white dark:bg-orange-500' : 'text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-700'}`}
                    onClick={() => setActiveTab('admin')}
                  >
                    {t('nav.admin')}
                  </button>
                )}
              </nav>
            {/* Controls - Theme, Language, Logout - All in one line */}
            <div className="flex items-center gap-1.5 sm:gap-0.5 md:gap-1 lg:gap-1.5 ml-auto shrink-0 flex-nowrap">
              <ThemeToggle currentUser={currentUser} />
              <LanguageSelector />
              {currentUser && isSuperAdmin(currentUser) && viewAsUserType && !isMobile && (
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="text-[10px] sm:text-xs text-orange-600 dark:text-orange-400 font-medium whitespace-nowrap px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800"
                  title={t('profile.viewAppAsDescription')}
                >
                  {t('profile.viewingAs')}: {viewAsUserType === 'tester' ? t('profile.viewAppAsTester') : viewAsUserType === 'weekly_only' ? t('admin.userType.weeklyOnly') : viewAsUserType === 'super_admin' ? t('admin.userType.superAdmin') : t(`admin.userType.${viewAsUserType}` as 'admin.userType.user')}
                </button>
              )}
              {currentUser && !isMobile && (
                <button
                  onClick={() => setActiveTab('profile')}
                  className="text-[10px] sm:text-xs md:text-xs lg:text-sm text-gray-700 dark:text-gray-300 font-medium text-center hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer underline decoration-1 hover:decoration-2 whitespace-nowrap"
                  title={t('nav.clickToViewProfile')}
                >
                  {t('nav.welcome')}, {currentUser?.name || t('common.user')}
                </button>
              )}
              {currentUser && !isMobile && (
                <ScreenshotButton currentUser={currentUser} />
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  // Clear session from both localStorage and sessionStorage
                  localStorage.removeItem('bampro_user_session');
                  localStorage.removeItem('bampro_view_as_user_type');
                  sessionStorage.removeItem('bampro_user_session');
                  setIsLoggedIn(false);
                  setCurrentUser(null);
                  toast({
                    title: t('auth.loggedOut'),
                    description: t('auth.loggedOutText'),
                  });
                }}
                className="border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-700 h-7 sm:h-6 md:h-6 lg:h-7 text-xs sm:text-[9px] md:text-xs lg:text-sm px-2 sm:px-1.5 md:px-1.5 lg:px-2 py-1 sm:py-0.5 whitespace-nowrap flex-shrink-0"
              >
                {t('nav.logout')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-2 sm:px-4 md:px-6 py-2 sm:py-4 md:py-6 lg:py-8" style={{ marginTop: isMobile ? '0' : '100px' }}>
        {activeTab === 'timesheet' && (
          <TimesheetEntry currentUser={currentUser} hasUnreadDaysOffNotification={hasUnreadDaysOffNotification} />
        )}
        {activeTab === 'weekly' && !isAdministratie(effectiveUser) && !isViewer(effectiveUser) && (
          <div className="space-y-4">
            {currentUser && (
              <SharedEntriesPanel
                currentUserId={currentUser.id}
                onAcceptSuccess={() => {
                  // Refresh pending shares count
                  fetchPendingSharesCount();
                }}
              />
            )}
            {useSimpleWeeklyView ? (
              <WeeklyCalendarEntrySimple 
                currentUser={currentUser} 
                hasUnreadDaysOffNotification={hasUnreadDaysOffNotification}
                useSimpleView={useSimpleWeeklyView}
                setUseSimpleView={(() => {
                  const weeklyViewOption = currentUser?.weekly_view_option;
                  // Only allow toggle if user has 'both' option or no option set
                  if (weeklyViewOption === 'simple' || weeklyViewOption === 'original') {
                    return undefined; // Locked - no toggle allowed
                  }
                  // Return controlled setter that checks before allowing change
                  return (value: boolean) => {
                    // Double-check the setting hasn't changed (defense in depth)
                    if (currentUser?.weekly_view_option === 'simple' || currentUser?.weekly_view_option === 'original') {
                      return; // Don't allow change if locked
                    }
                    setUseSimpleWeeklyView(value);
                    localStorage.setItem('bampro_use_simple_weekly_view', String(value));
                  };
                })()}
              />
            ) : (
              <WeeklyCalendarEntry 
                currentUser={currentUser} 
                hasUnreadDaysOffNotification={hasUnreadDaysOffNotification}
                useSimpleView={useSimpleWeeklyView}
                setUseSimpleView={(() => {
                  const weeklyViewOption = currentUser?.weekly_view_option;
                  // Only allow toggle if user has 'both' option or no option set
                  if (weeklyViewOption === 'simple' || weeklyViewOption === 'original') {
                    return undefined; // Locked - no toggle allowed
                  }
                  // Return controlled setter that checks before allowing change
                  return (value: boolean) => {
                    // Double-check the setting hasn't changed (defense in depth)
                    if (currentUser?.weekly_view_option === 'simple' || currentUser?.weekly_view_option === 'original') {
                      return; // Don't allow change if locked
                    }
                    setUseSimpleWeeklyView(value);
                    localStorage.setItem('bampro_use_simple_weekly_view', String(value));
                  };
                })()}
              />
            )}
          </div>
        )}
        {activeTab === 'viewhours' && effectiveUser && !effectiveUser?.isAdmin && effectiveUser?.userType !== 'administratie' && !isTester(effectiveUser) && !isWeeklyOnly(effectiveUser) && (
          <ViewHours currentUser={currentUser} />
        )}
        {activeTab === 'overtime' && isViewer(effectiveUser) && (
          <div className="w-full">
            <AdminPanel currentUser={effectiveUser} initialTab="overtime" hideTabs={true} readOnly={true} />
          </div>
        )}
        {activeTab === 'overtime' && effectiveUser && !effectiveUser?.isAdmin && effectiveUser?.userType !== 'administratie' && !isViewer(effectiveUser) && (
          <UserOvertimeView currentUser={currentUser} />
        )}
        {activeTab === 'projects' && (
          canSeeProjects(effectiveUser) ? (
            <ProjectManagement currentUser={currentUser} />
          ) : (
            <div className="p-8 text-center text-red-600 font-semibold">You do not have permission to view this page.</div>
          )
        )}
        {activeTab === 'overview' && !isTester(effectiveUser) && (
          <TimeOverview currentUser={currentUser} />
        )}
        {activeTab === 'export' && !effectiveUser?.isAdmin && !isAdministratie(effectiveUser) && !isTester(effectiveUser) && !isWeeklyOnly(effectiveUser) && (
          <Card className="shadow-lg border-orange-100 w-full overflow-x-auto">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 rounded-t-lg p-4 sm:p-6">
              <CardTitle className="flex items-center text-orange-900 dark:text-orange-100 text-lg sm:text-xl">
                <Download className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3" />
                {t('export.title')}
              </CardTitle>
              <CardDescription className="text-orange-700 dark:text-orange-300 text-sm">
                {t('export.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 md:p-8">
              {effectiveUser?.isAdmin ? (
                // Admin export options
                <div className="space-y-6">
                  {/* User Selection Dropdown */}
                  <div className="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                    <label className="block text-sm font-medium text-orange-900 dark:text-orange-100 mb-2">
                      {t('export.selectUser')}
                    </label>
                    <Select value={selectedUserId || "all"} onValueChange={(value) => setSelectedUserId(value === "all" ? "" : value)}>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="flex flex-col gap-2">
                      <Button 
                        className="h-20 flex flex-col items-center justify-center bg-orange-600 hover:bg-orange-700 text-white shadow-lg rounded-lg transition-all" 
                        onClick={handleExportAll} 
                        disabled={exporting}
                      >
                        <FileText className="h-6 w-6 mb-2" />
                        <span className="text-sm font-medium">{t('export.allData')} (Excel)</span>
                      </Button>
                      <Button 
                        className="h-20 flex flex-col items-center justify-center bg-red-600 hover:bg-red-700 text-white shadow-lg rounded-lg transition-all" 
                        onClick={handleExportAllPDF} 
                        disabled={exporting}
                      >
                        <FileDown className="h-6 w-6 mb-2" />
                        <span className="text-sm font-medium">{t('export.allData')} (PDF)</span>
                      </Button>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center gap-2">
                      <input 
                        type="date" 
                        value={dateRange.from} 
                        onChange={e => setDateRange({ ...dateRange, from: e.target.value })} 
                        className="mb-2 border rounded px-2 py-1 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" 
                      />
                      <input 
                        type="date" 
                        value={dateRange.to} 
                        onChange={e => setDateRange({ ...dateRange, to: e.target.value })} 
                        className="mb-2 border rounded px-2 py-1 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" 
                      />
                      <Button 
                        variant="outline" 
                        className="h-16 w-full flex flex-col items-center justify-center border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/40 shadow-lg rounded-lg transition-all" 
                        onClick={handleExportRange} 
                        disabled={exporting}
                      >
                        <Calendar className="h-8 w-8 mb-3" />
                        <span className="text-lg font-medium">{t('export.dateRange')}</span>
                      </Button>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="flex gap-2 w-full">
                        <input 
                          type="number" 
                          min="1" 
                          max="53" 
                          placeholder={t('export.weekPlaceholder')} 
                          value={selectedWeekNumber} 
                          onChange={e => setSelectedWeekNumber(e.target.value)} 
                          className="flex-1 border rounded px-2 py-1 text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" 
                        />
                        <input 
                          type="number" 
                          min="2020" 
                          max="2100" 
                          placeholder={t('export.yearPlaceholder')} 
                          value={selectedYear} 
                          onChange={e => setSelectedYear(e.target.value)} 
                          className="flex-1 border rounded px-2 py-1 text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" 
                        />
                      </div>
                      <div className="flex flex-col gap-2 w-full">
                        <Button 
                          variant="outline" 
                          className="h-14 w-full flex flex-col items-center justify-center border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/40 shadow-lg rounded-lg transition-all" 
                          onClick={handleExportWeekNumber} 
                          disabled={exporting || !selectedWeekNumber || !selectedYear}
                        >
                          <Calendar className="h-6 w-6 mb-2" />
                          <span className="text-sm font-medium">{t('export.weekNumber')} (Excel)</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          className="h-14 w-full flex flex-col items-center justify-center border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40 shadow-lg rounded-lg transition-all" 
                          onClick={handleExportWeekNumberPDF} 
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
                        onClick={handleExportUser} 
                        disabled={exporting || !selectedUserId || selectedUserId === "all"}
                      >
                        <Users className="h-6 w-6 mb-2" />
                        <span className="text-sm font-medium">{t('export.perUser')} (Excel)</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-20 flex flex-col items-center justify-center border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40 shadow-lg rounded-lg transition-all" 
                        onClick={handleExportUserPDF} 
                        disabled={exporting || !selectedUserId || selectedUserId === "all"}
                      >
                        <FileDown className="h-6 w-6 mb-2" />
                        <span className="text-sm font-medium">{t('export.perUser')} (PDF)</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                // Normal user export options
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-end">
                    <div className="flex-1 w-full">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('export.selectPeriod')}</label>
                      <Select value={exportPeriod} onValueChange={(value: "day" | "week" | "month" | "year") => setExportPeriod(value)}>
                        <SelectTrigger className="w-full h-10 sm:h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">{t('export.day')}</SelectItem>
                          <SelectItem value="week">{t('export.week')}</SelectItem>
                          <SelectItem value="month">{t('export.month')}</SelectItem>
                          <SelectItem value="year">{t('export.year')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 w-full">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {exportPeriod === "day" ? t('export.selectDay') : exportPeriod === "week" ? t('export.selectWeek') : exportPeriod === "month" ? t('export.selectMonth') : t('export.selectYear')}
                      </label>
                      <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={e => setSelectedDate(e.target.value)} 
                        className="w-full border rounded px-3 py-2 h-10 sm:h-9 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm sm:text-base"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <Button 
                      className="w-full h-14 sm:h-16 flex flex-col items-center justify-center bg-orange-600 hover:bg-orange-700 text-white shadow-lg rounded-lg transition-all" 
                      onClick={handleExportPeriod} 
                      disabled={exporting}
                      size="lg"
                    >
                      <Download className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                      <span className="text-sm sm:text-base font-medium">
                        {exporting ? t('export.exporting') : `Export Excel (${exportPeriod === "day" ? t('export.day') : exportPeriod === "week" ? t('export.week') : exportPeriod === "month" ? t('export.month') : t('export.year')})`}
                      </span>
                    </Button>
                    <Button 
                      className="w-full h-14 sm:h-16 flex flex-col items-center justify-center bg-red-600 hover:bg-red-700 text-white shadow-lg rounded-lg transition-all" 
                      onClick={handleExportPeriodPDF} 
                      disabled={exporting}
                      size="lg"
                    >
                      <FileDown className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                      <span className="text-sm sm:text-base font-medium">
                        {exporting ? t('export.exporting') : `Export PDF (${exportPeriod === "day" ? t('export.day') : exportPeriod === "week" ? t('export.week') : exportPeriod === "month" ? t('export.month') : t('export.year')})`}
                      </span>
                    </Button>
                  </div>
                </div>
              )}
              <div className="text-xs sm:text-sm text-orange-800 dark:text-orange-200 bg-orange-50 dark:bg-orange-900/30 p-4 sm:p-6 rounded-lg border border-orange-200 dark:border-orange-800">
                <strong className="text-orange-900 dark:text-orange-100">{t('export.note')}</strong> {effectiveUser?.isAdmin 
                  ? t('export.adminNote')
                  : t('export.userNote')}
              </div>
            </CardContent>
          </Card>
        )}
        {activeTab === 'export' && (effectiveUser?.isAdmin || isAdministratie(effectiveUser)) && (
          <div className="text-center p-8 text-orange-600 font-semibold">
            {t('export.title')} is now available in the Admin Panel.
          </div>
        )}
        {activeTab === 'profile' && (
          <Profile currentUser={currentUser} setCurrentUser={setCurrentUser} viewAsUserType={viewAsUserType} onViewAsChange={(value) => { setViewAsUserType(value); if (value !== null) localStorage.setItem('bampro_view_as_user_type', value); else localStorage.removeItem('bampro_view_as_user_type'); }} />
        )}
        {activeTab === 'weeks' && (isAdministratie(effectiveUser) || isViewer(effectiveUser)) && (
          <div className="w-full">
            <AdminPanel currentUser={effectiveUser} initialTab="weeks" hideTabs={true} readOnly={isViewer(effectiveUser)} />
          </div>
        )}
        {activeTab === 'admin' && (effectiveUser?.isAdmin || isAdministratie(effectiveUser)) && (
          <div className="w-full">
            <AdminPanel currentUser={effectiveUser} />
          </div>
        )}
        {activeTab === 'bugreports' && (effectiveUser?.isAdmin || effectiveUser?.userType === 'super_admin') && (
          <BugReports currentUser={currentUser} />
        )}
      </div>
      
      {/* Floating Report Bug Button - Always visible for all users */}
      {currentUser && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
          <ScreenshotButton currentUser={currentUser} floating={true} />
        </div>
      )}
      
      {/* PWA Install Prompt */}
      <InstallPWA />
    </div>
  );
};

export default Index;
