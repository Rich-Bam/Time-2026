import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, FileText, Calendar, BarChart3, Download, AlertTriangle } from "lucide-react";
import TimesheetEntry from "@/components/TimesheetEntry";
import ProjectManagement from "@/components/ProjectManagement";
import TimeOverview from "@/components/TimeOverview";
import AuthSection from "@/components/AuthSection";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import AdminPanel from "@/components/AdminPanel";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import WeeklyCalendarEntry from "@/components/WeeklyCalendarEntry";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const Index = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("weekly");
  const [weeklySubTab, setWeeklySubTab] = useState('daylist');
  const [showReminder, setShowReminder] = useState(false);
  const [reminderWeek, setReminderWeek] = useState("");

  // Helper to get ISO week number
  function getISOWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((Number(d.getTime()) - Number(yearStart.getTime())) / 86400000) + 1) / 7);
    return weekNum;
  }
  const [reminderWeekNum, setReminderWeekNum] = useState("");

  // Helper to download Excel file
  const downloadExcel = (data, filename = "timesheet.xlsx") => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timesheet");
    XLSX.writeFile(wb, filename);
  };

  // Export all data
  const handleExportAll = async () => {
    setExporting(true);
    const { data, error } = await supabase
      .from("timesheet")
      .select("*, projects(name)");
    if (error) {
      alert("Failed to fetch data: " + error.message);
      setExporting(false);
      return;
    }
    // Flatten project name
    const rows = (data || []).map((row) => ({ ...row, project: row.projects?.name || "" }));
    downloadExcel(rows, "timesheet_all.xlsx");
    setExporting(false);
  };

  // Export by date range
  const handleExportRange = async () => {
    if (!dateRange.from || !dateRange.to) {
      alert("Please select a date range.");
      return;
    }
    setExporting(true);
    const { data, error } = await supabase
      .from("timesheet")
      .select("*, projects(name)")
      .gte("date", dateRange.from)
      .lte("date", dateRange.to);
    if (error) {
      alert("Failed to fetch data: " + error.message);
      setExporting(false);
      return;
    }
    const rows = (data || []).map((row) => ({ ...row, project: row.projects?.name || "" }));
    downloadExcel(rows, `timesheet_${dateRange.from}_to_${dateRange.to}.xlsx`);
    setExporting(false);
  };

  // Reminder logic: check if previous week is missing entries after login
  useEffect(() => {
    const checkPreviousWeek = async () => {
      if (!isLoggedIn || !currentUser) return;
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
            You have not filled in your work times for <b>week {reminderWeekNum}</b>.<br />
            Please complete your timesheet for last week.
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowReminder(false)}>Dismiss</Button>
            <Button variant="default" onClick={handleGoToWeekly}>Go to Weekly Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-orange-100">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-12">
              <img 
                src="/bampro-marine-logo.jpg" 
                alt="BAMPRO MARINE" 
                className="h-12 sm:h-14 md:h-16 object-contain"
              />
              <nav className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-8 justify-center md:justify-start">
                <button
                  className={`text-base sm:text-lg font-medium px-3 py-1 rounded transition-colors ${activeTab === 'weekly' ? 'bg-orange-600 text-white' : 'text-orange-700 hover:bg-orange-50'}`}
                  onClick={() => setActiveTab('weekly')}
                >
                  Weekly Entry
                </button>
                {currentUser?.isAdmin && (
                  <button
                    className={`text-base sm:text-lg font-medium px-3 py-1 rounded transition-colors ${activeTab === 'projects' ? 'bg-orange-600 text-white' : 'text-orange-700 hover:bg-orange-50'}`}
                    onClick={() => setActiveTab('projects')}
                  >
                    Projects
                  </button>
                )}
                <button
                  className={`text-base sm:text-lg font-medium px-3 py-1 rounded transition-colors ${activeTab === 'export' ? 'bg-orange-600 text-white' : 'text-orange-700 hover:bg-orange-50'}`}
                  onClick={() => setActiveTab('export')}
                >
                  Export
                </button>
                {currentUser?.isAdmin && (
                  <button
                    className={`text-base sm:text-lg font-medium px-3 py-1 rounded transition-colors ${activeTab === 'admin' ? 'bg-orange-600 text-white' : 'text-orange-700 hover:bg-orange-50'}`}
                    onClick={() => setActiveTab('admin')}
                  >
                    Admin
                  </button>
                )}
                <button
                  className={`text-base sm:text-lg font-medium px-3 py-1 rounded transition-colors ${activeTab === 'overview' ? 'bg-orange-600 text-white' : 'text-orange-700 hover:bg-orange-50'}`}
                  onClick={() => setActiveTab('overview')}
                >
                  Overview
                </button>
              </nav>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 justify-center md:justify-end">
              <span className="text-gray-700 font-medium text-center sm:text-left">Welcome, {currentUser?.name || "User"}</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsLoggedIn(false)}
                className="border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-2 sm:px-6 py-4 sm:py-8">
        {activeTab === 'timesheet' && (
          <TimesheetEntry currentUser={currentUser} />
        )}
        {activeTab === 'weekly' && (
          <WeeklyCalendarEntry currentUser={currentUser} />
        )}
        {activeTab === 'projects' && (
          currentUser?.isAdmin ? (
            <ProjectManagement />
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
                Export Timesheet Data
              </CardTitle>
              <CardDescription className="text-orange-700">
                Export timesheet data to Excel for reporting and analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Button className="h-24 flex flex-col items-center justify-center bg-orange-600 hover:bg-orange-700 text-white shadow-lg rounded-lg transition-all" onClick={handleExportAll} disabled={exporting}>
                  <FileText className="h-8 w-8 mb-3" />
                  <span className="text-lg font-medium">Export All Data</span>
                </Button>
                <div className="flex flex-col items-center justify-center gap-2">
                  <input type="date" value={dateRange.from} onChange={e => setDateRange({ ...dateRange, from: e.target.value })} className="mb-2 border rounded px-2 py-1" />
                  <input type="date" value={dateRange.to} onChange={e => setDateRange({ ...dateRange, to: e.target.value })} className="mb-2 border rounded px-2 py-1" />
                  <Button variant="outline" className="h-16 flex flex-col items-center justify-center border-orange-200 text-orange-700 hover:bg-orange-50 shadow-lg rounded-lg transition-all" onClick={handleExportRange} disabled={exporting}>
                    <Calendar className="h-8 w-8 mb-3" />
                    <span className="text-lg font-medium">Export Date Range</span>
                  </Button>
                </div>
              </div>
              <div className="text-sm text-orange-800 bg-orange-50 p-6 rounded-lg border border-orange-200">
                <strong className="text-orange-900">Note:</strong> To enable Excel export functionality, connect to Supabase using the green button in the top right. This will allow you to store and retrieve timesheet data for export.
              </div>
            </CardContent>
          </Card>
        )}
        {activeTab === 'admin' && currentUser?.isAdmin && (
          <AdminPanel currentUser={currentUser} />
        )}
      </div>
    </div>
  );
};

export default Index;
