import { useState, useEffect } from "react";
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
import AdminPanel from "@/components/AdminPanel";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import WeeklyCalendarEntry from "@/components/WeeklyCalendarEntry";
import WeeklyCalendarEntrySimple from "@/components/WeeklyCalendarEntrySimple";
import ScreenshotButton from "@/components/ScreenshotButton";
import BugReports from "@/components/BugReports";
import InstallPWA from "@/components/InstallPWA";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { createPDF } from "@/utils/pdfExport";

const Index = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const SUPER_ADMIN_EMAIL = "r.blance@bampro.nl";
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("weekly");
  const [weeklySubTab, setWeeklySubTab] = useState('daylist');
  const [showReminder, setShowReminder] = useState(false);
  const [reminderWeek, setReminderWeek] = useState("");
  const [exportPeriod, setExportPeriod] = useState<"day" | "week" | "month" | "year">("week");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [useSimpleWeeklyView, setUseSimpleWeeklyView] = useState(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('bampro_use_simple_weekly_view');
    return saved === 'true';
  });
  const { toast } = useToast();

  // Check for saved session on page load (14 days persistence)
  useEffect(() => {
    const savedSession = localStorage.getItem('bampro_user_session');
    if (savedSession) {
      try {
        const sessionData = JSON.parse(savedSession);
        const sessionDate = new Date(sessionData.loginTime);
        const daysSinceLogin = (Date.now() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
        
        // Check if session is still valid (within 14 days)
        if (daysSinceLogin < 14) {
          // Verify user still exists and is approved
          const verifyUser = async () => {
            const { data: user, error } = await supabase
              .from("users")
              .select("*")
              .eq("email", sessionData.user.email)
              .single();
            
            if (!error && user && user.approved !== false) {
              setCurrentUser(user);
              setIsLoggedIn(true);
              console.log("✅ Auto-login: Session restored from localStorage");
            } else {
              // User no longer exists or not approved, clear session
              localStorage.removeItem('bampro_user_session');
            }
          };
          verifyUser();
        } else {
          // Session expired (older than 14 days)
          localStorage.removeItem('bampro_user_session');
          console.log("⏰ Session expired (older than 14 days)");
        }
      } catch (error) {
        console.error("Error parsing saved session:", error);
        localStorage.removeItem('bampro_user_session');
      }
    }
  }, []);

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

  // Helper to get ISO week number
  function getISOWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((Number(d.getTime()) - Number(yearStart.getTime())) / 86400000) + 1) / 7);
    return weekNum;
  }

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
  }
  const [reminderWeekNum, setReminderWeekNum] = useState("");

  // Helper to create formatted Excel file with better readability
  const createFormattedExcel = (data: any[], filename: string, options?: {
    userName?: string;
    dateRange?: { from: string; to: string };
    period?: string;
  }) => {
    const wb = XLSX.utils.book_new();
    
    // Sort data by date (ascending)
    const sortedData = [...data].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });
    
    // Prepare formatted data - only include user columns if user info exists
    const formattedData = sortedData.map((entry) => {
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
    
    // Create worksheet
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

  // Helper to get work type label
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
    ];
    const workType = workTypes.find(wt => String(wt.value) === String(desc));
    return workType ? workType.label : desc;
  };

  // Helper to get day name in English
  const getDayNameNL = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
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
    const rows = (data || []).map((row) => ({ 
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
    const selectedUser = users.find(u => u.id === selectedUserId);
    const rows = (data || []).map((row) => ({ 
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
    
    // Format data for PDF
    const formattedData = (data || []).map((row) => {
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

  // Export by week number (admin only)
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
    
    setExporting(true);
    
    // Get date range for the week
    const { from, to } = getWeekDateRange(weekNum, year);
    
    // Build query with optional user filter
    let queryBuilder = supabase
      .from("timesheet")
      .select("*, projects(name)")
      .gte("date", from)
      .lte("date", to);
    
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
    const rows = (data || []).map((row) => ({ 
      ...row, 
      project: row.projects?.name || "",
      user_name: users.find(u => u.id === row.user_id)?.name || "",
      user_email: users.find(u => u.id === row.user_id)?.email || ""
    }));
    const selectedUser = users.find(u => u.id === selectedUserId);
    const userLabel = selectedUser ? `_${selectedUser.name || selectedUser.email}` : "";
    createFormattedExcel(rows, `timesheet_Week${weekNum}_${year}${userLabel}.xlsx`, {
      userName: selectedUser?.name || selectedUser?.email,
      dateRange: { from, to },
      period: `Week ${weekNum}, ${year}`
    });
    setExporting(false);
    toast({
      title: "Export Successful",
      description: `Data exported for week ${weekNum} of ${year}${selectedUser ? ` for ${selectedUser.name || selectedUser.email}` : ""}.`,
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

  // Fetch users for admin export dropdown
  useEffect(() => {
    if (currentUser?.isAdmin && activeTab === 'export') {
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
  }, [currentUser, activeTab]);

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
        fromDate = selected.toISOString().split('T')[0];
        toDate = fromDate;
        filename = `Uren_${formatDateDDMMYY(fromDate)}.xlsx`;
        break;
      case "week":
        // Get Monday of the week
        const dayOfWeek = selected.getDay();
        const diff = selected.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(selected.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        fromDate = monday.toISOString().split('T')[0];
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        toDate = sunday.toISOString().split('T')[0];
        filename = `Uren_Week_${formatDateDDMMYY(fromDate)}_tot_${formatDateDDMMYY(toDate)}.xlsx`;
        break;
      case "month":
        fromDate = new Date(selected.getFullYear(), selected.getMonth(), 1).toISOString().split('T')[0];
        toDate = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).toISOString().split('T')[0];
        filename = `Uren_${selected.getFullYear()}_${String(selected.getMonth() + 1).padStart(2, '0')}.xlsx`;
        break;
      case "year":
        fromDate = new Date(selected.getFullYear(), 0, 1).toISOString().split('T')[0];
        toDate = new Date(selected.getFullYear(), 11, 31).toISOString().split('T')[0];
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

    // Format data for better Excel/PDF export
    const formattedDataForExport = data.map((entry) => ({
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
      description: `${data.length} entries exported to ${filename}`,
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
        fromDate = selected.toISOString().split('T')[0];
        toDate = fromDate;
        filename = `Uren_${formatDateDDMMYY(fromDate)}.pdf`;
        break;
      case "week":
        const dayOfWeek = selected.getDay();
        const diff = selected.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(selected.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        fromDate = monday.toISOString().split('T')[0];
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        toDate = sunday.toISOString().split('T')[0];
        filename = `Uren_Week_${formatDateDDMMYY(fromDate)}_tot_${formatDateDDMMYY(toDate)}.pdf`;
        break;
      case "month":
        fromDate = new Date(selected.getFullYear(), selected.getMonth(), 1).toISOString().split('T')[0];
        toDate = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).toISOString().split('T')[0];
        filename = `Uren_${selected.getFullYear()}_${String(selected.getMonth() + 1).padStart(2, '0')}.pdf`;
        break;
      case "year":
        fromDate = new Date(selected.getFullYear(), 0, 1).toISOString().split('T')[0];
        toDate = new Date(selected.getFullYear(), 11, 31).toISOString().split('T')[0];
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

    // Format data for PDF
    const formattedData = data.map((entry) => {
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
      description: `${data.length} entries exported to ${filename}`,
    });
  };

  // Reminder logic: check if previous week is missing entries after login
  // Skip reminder for admins
  useEffect(() => {
    const checkPreviousWeek = async () => {
      if (!isLoggedIn || !currentUser) return;
      // Don't show reminder to admins
      if (currentUser.isAdmin) return;
      // Get previous week (Monday-Sunday)
      const now = new Date();
      const day = now.getDay();
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() - day - 6); // last week's Monday
      lastMonday.setHours(0, 0, 0, 0);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      // Format dates as YYYY-MM-DD
      const fromDate = lastMonday.toISOString().split('T')[0];
      const toDate = lastSunday.toISOString().split('T')[0];
      // Query timesheet for this user for last week
      const { data, error } = await supabase
        .from("timesheet")
        .select("id")
        .eq("user_id", currentUser.id)
        .gte("date", fromDate)
        .lte("date", toDate);
      if (!error && (!data || data.length === 0)) {
        setShowReminder(true);
        setReminderWeekNum(`${getISOWeekNumber(lastMonday)}`);
      }
    };
    checkPreviousWeek();
  }, [isLoggedIn, currentUser]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100">
        <div className="container mx-auto px-4 py-12">
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

  // Reminder popup/modal
  const handleGoToWeekly = () => {
    setActiveTab('weekly');
    setShowReminder(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100">
      {/* Reminder Dialog */}
      <Dialog open={showReminder} onOpenChange={setShowReminder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-700">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
              Timesheet Reminder
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-base text-gray-700">
            You have not yet filled in your hours for <b>week {reminderWeekNum}</b>.<br />
            <br />
            <strong className="text-orange-700">Ingrid would like you to fill in your hours.</strong><br />
            Please fill in your timesheet for last week.
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowReminder(false)}>Dismiss</Button>
            <Button variant="default" onClick={handleGoToWeekly}>Go to Weekly Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-orange-100">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
            <div className="flex flex-col md:flex-row md:items-center gap-2 sm:gap-3 md:gap-12">
              <button
                onClick={() => setActiveTab('weekly')}
                className="cursor-pointer hover:opacity-80 transition-opacity self-center md:self-auto"
                title="Go to homepage"
              >
                <img 
                  src="/bampro-marine-logo.jpg" 
                  alt="BAMPRO MARINE" 
                  className="h-10 sm:h-12 md:h-14 lg:h-16 object-contain"
                />
              </button>
              <nav className="flex flex-wrap md:flex-nowrap items-center gap-1.5 sm:gap-2 md:gap-4 lg:gap-8 justify-center md:justify-start">
                <button
                  className={`text-sm sm:text-base md:text-lg font-medium px-2 sm:px-3 py-1.5 sm:py-1 rounded transition-colors ${activeTab === 'weekly' ? 'bg-orange-600 text-white' : 'text-orange-700 hover:bg-orange-50'}`}
                  onClick={() => setActiveTab('weekly')}
                >
                  {t('nav.weekly')}
                </button>
                {currentUser?.isAdmin && (
                  <button
                    className={`text-sm sm:text-base md:text-lg font-medium px-2 sm:px-3 py-1.5 sm:py-1 rounded transition-colors ${activeTab === 'projects' ? 'bg-orange-600 text-white' : 'text-orange-700 hover:bg-orange-50'}`}
                    onClick={() => setActiveTab('projects')}
                  >
                    {t('nav.projects')}
                  </button>
                )}
                <button
                  className={`text-sm sm:text-base md:text-lg font-medium px-2 sm:px-3 py-1.5 sm:py-1 rounded transition-colors ${activeTab === 'export' ? 'bg-orange-600 text-white' : 'text-orange-700 hover:bg-orange-50'}`}
                  onClick={() => setActiveTab('export')}
                >
                  {t('nav.export')}
                </button>
                {currentUser?.isAdmin && (
                  <button
                    className={`text-sm sm:text-base md:text-lg font-medium px-2 sm:px-3 py-1.5 sm:py-1 rounded transition-colors ${activeTab === 'admin' ? 'bg-orange-600 text-white' : 'text-orange-700 hover:bg-orange-50'}`}
                    onClick={() => setActiveTab('admin')}
                  >
                    {t('nav.admin')}
                  </button>
                )}
                {currentUser?.email === SUPER_ADMIN_EMAIL && (
                  <button
                    className={`text-sm sm:text-base md:text-lg font-medium px-2 sm:px-3 py-1.5 sm:py-1 rounded transition-colors ${activeTab === 'bugreports' ? 'bg-orange-600 text-white' : 'text-orange-700 hover:bg-orange-50'}`}
                    onClick={() => setActiveTab('bugreports')}
                  >
                    {t('nav.reportBug')}
                  </button>
                )}
                <button
                  className={`text-sm sm:text-base md:text-lg font-medium px-2 sm:px-3 py-1.5 sm:py-1 rounded transition-colors ${activeTab === 'overview' ? 'bg-orange-600 text-white' : 'text-orange-700 hover:bg-orange-50'}`}
                  onClick={() => setActiveTab('overview')}
                >
                  {t('nav.overview')}
                </button>
              </nav>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 md:gap-6 justify-center md:justify-end">
              <span className="text-xs sm:text-sm md:text-base text-gray-700 font-medium text-center sm:text-left">{t('nav.welcome')}, {currentUser?.name || "User"}</span>
              {currentUser?.isAdmin && (
                <ScreenshotButton currentUser={currentUser} />
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  // Clear session from localStorage
                  localStorage.removeItem('bampro_user_session');
                  setIsLoggedIn(false);
                  setCurrentUser(null);
                  toast({
                    title: "Logged Out",
                    description: "You have been successfully logged out.",
                  });
                }}
                className="border-orange-200 text-orange-700 hover:bg-orange-50 h-9 sm:h-8 text-xs sm:text-sm w-full sm:w-auto"
              >
                {t('nav.logout')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-8">
        {activeTab === 'timesheet' && (
          <TimesheetEntry currentUser={currentUser} />
        )}
        {activeTab === 'weekly' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newValue = !useSimpleWeeklyView;
                  setUseSimpleWeeklyView(newValue);
                  localStorage.setItem('bampro_use_simple_weekly_view', String(newValue));
                  toast({
                    title: "View Changed",
                    description: newValue 
                      ? "You are now using the simple view. You can always switch back using the button above." 
                      : "You are now using the original view. You can always switch back using the button above.",
                  });
                }}
                className="mb-4"
              >
                {useSimpleWeeklyView ? "🔄 Switch to original view" : "🔄 Switch to simple view"}
              </Button>
            </div>
            {useSimpleWeeklyView ? (
              <WeeklyCalendarEntrySimple currentUser={currentUser} />
            ) : (
              <WeeklyCalendarEntry currentUser={currentUser} />
            )}
          </div>
        )}
        {activeTab === 'projects' && (
          currentUser?.isAdmin ? (
            <ProjectManagement currentUser={currentUser} />
          ) : (
            <div className="p-8 text-center text-red-600 font-semibold">You do not have permission to view this page.</div>
          )
        )}
        {activeTab === 'overview' && (
          <TimeOverview currentUser={currentUser} />
        )}
        {activeTab === 'export' && (
          <Card className="shadow-lg border-orange-100 w-full overflow-x-auto">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-t-lg">
              <CardTitle className="flex items-center text-orange-900">
                <Download className="h-6 w-6 mr-3" />
                {t('export.title')}
              </CardTitle>
              <CardDescription className="text-orange-700">
                {t('export.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-8">
              {currentUser?.isAdmin ? (
                // Admin export options
                <div className="space-y-6">
                  {/* User Selection Dropdown */}
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <label className="block text-sm font-medium text-orange-900 mb-2">
                      {t('export.selectUser')}
                    </label>
                    <Select value={selectedUserId || "all"} onValueChange={(value) => setSelectedUserId(value === "all" ? "" : value)}>
                      <SelectTrigger className="w-full bg-white">
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
                    <p className="text-xs text-orange-700 mt-2">
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
                        className="mb-2 border rounded px-2 py-1 w-full" 
                      />
                      <input 
                        type="date" 
                        value={dateRange.to} 
                        onChange={e => setDateRange({ ...dateRange, to: e.target.value })} 
                        className="mb-2 border rounded px-2 py-1 w-full" 
                      />
                      <Button 
                        variant="outline" 
                        className="h-16 w-full flex flex-col items-center justify-center border-orange-200 text-orange-700 hover:bg-orange-50 shadow-lg rounded-lg transition-all" 
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
                          className="flex-1 border rounded px-2 py-1 text-center" 
                        />
                        <input 
                          type="number" 
                          min="2020" 
                          max="2100" 
                          placeholder={t('export.yearPlaceholder')} 
                          value={selectedYear} 
                          onChange={e => setSelectedYear(e.target.value)} 
                          className="flex-1 border rounded px-2 py-1 text-center" 
                        />
                      </div>
                      <div className="flex flex-col gap-2 w-full">
                        <Button 
                          variant="outline" 
                          className="h-14 w-full flex flex-col items-center justify-center border-orange-200 text-orange-700 hover:bg-orange-50 shadow-lg rounded-lg transition-all" 
                          onClick={handleExportWeekNumber} 
                          disabled={exporting || !selectedWeekNumber || !selectedYear}
                        >
                          <Calendar className="h-6 w-6 mb-2" />
                          <span className="text-sm font-medium">{t('export.weekNumber')} (Excel)</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          className="h-14 w-full flex flex-col items-center justify-center border-red-200 text-red-700 hover:bg-red-50 shadow-lg rounded-lg transition-all" 
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
                        className="h-20 flex flex-col items-center justify-center border-orange-200 text-orange-700 hover:bg-orange-50 shadow-lg rounded-lg transition-all" 
                        onClick={handleExportUser} 
                        disabled={exporting || !selectedUserId || selectedUserId === "all"}
                      >
                        <Users className="h-6 w-6 mb-2" />
                        <span className="text-sm font-medium">{t('export.perUser')} (Excel)</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-20 flex flex-col items-center justify-center border-red-200 text-red-700 hover:bg-red-50 shadow-lg rounded-lg transition-all" 
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
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('export.selectPeriod')}</label>
                      <Select value={exportPeriod} onValueChange={(value: "day" | "week" | "month" | "year") => setExportPeriod(value)}>
                        <SelectTrigger className="w-full">
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
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {exportPeriod === "day" ? t('export.selectDay') : exportPeriod === "week" ? t('export.selectWeek') : exportPeriod === "month" ? t('export.selectMonth') : t('export.selectYear')}
                      </label>
                      <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={e => setSelectedDate(e.target.value)} 
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Button 
                      className="w-full h-16 flex flex-col items-center justify-center bg-orange-600 hover:bg-orange-700 text-white shadow-lg rounded-lg transition-all" 
                      onClick={handleExportPeriod} 
                      disabled={exporting}
                    >
                      <Download className="h-6 w-6 mb-2" />
                      <span className="text-lg font-medium">
                        {exporting ? t('export.exporting') : `Export Excel (${exportPeriod === "day" ? t('export.day') : exportPeriod === "week" ? t('export.week') : exportPeriod === "month" ? t('export.month') : t('export.year')})`}
                      </span>
                    </Button>
                    <Button 
                      className="w-full h-16 flex flex-col items-center justify-center bg-red-600 hover:bg-red-700 text-white shadow-lg rounded-lg transition-all" 
                      onClick={handleExportPeriodPDF} 
                      disabled={exporting}
                    >
                      <FileDown className="h-6 w-6 mb-2" />
                      <span className="text-lg font-medium">
                        {exporting ? t('export.exporting') : `Export PDF (${exportPeriod === "day" ? t('export.day') : exportPeriod === "week" ? t('export.week') : exportPeriod === "month" ? t('export.month') : t('export.year')})`}
                      </span>
                    </Button>
                  </div>
                </div>
              )}
              <div className="text-sm text-orange-800 bg-orange-50 p-6 rounded-lg border border-orange-200">
                <strong className="text-orange-900">{t('export.note')}</strong> {currentUser?.isAdmin 
                  ? t('export.adminNote')
                  : t('export.userNote')}
              </div>
            </CardContent>
          </Card>
        )}
        {activeTab === 'admin' && currentUser?.isAdmin && (
          <AdminPanel currentUser={currentUser} />
        )}
        {activeTab === 'bugreports' && currentUser?.email === SUPER_ADMIN_EMAIL && (
          <BugReports currentUser={currentUser} />
        )}
      </div>
      {/* PWA Install Prompt */}
      <InstallPWA />
    </div>
  );
};

export default Index;
