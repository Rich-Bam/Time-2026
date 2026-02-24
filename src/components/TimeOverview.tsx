import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Clock, Calendar as CalendarIcon, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDateToYYYYMMDD } from "@/utils/dateUtils";

interface TimeOverviewProps {
  currentUser: any;
}

const TimeOverview = ({ currentUser }: TimeOverviewProps) => {
  const { t } = useLanguage();
  const canSelectUser = currentUser?.isAdmin || currentUser?.userType === "administratie";
  const [timesheet, setTimesheet] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  type TimePeriodValue = "all" | "month" | "week" | "lastMonth" | "last6Months" | "last1Year" | "day" | "dateRange";
  const [timePeriod, setTimePeriod] = useState<TimePeriodValue>("all");
  const [selectedDay, setSelectedDay] = useState<Date | null>(() => new Date());
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to: new Date(now) };
  });
  const [dateRangePickerOpen, setDateRangePickerOpen] = useState(false);
  const dateRangeRef = useRef(dateRange);
  dateRangeRef.current = dateRange;
  const isMobile = useIsMobile();

  // Fetch users for admin/administratie dropdown
  useEffect(() => {
    if (!canSelectUser) return;
    const fetchUsers = async () => {
      const { data } = await supabase
        .from("users")
        .select("id, email, name")
        .eq("approved", true)
        .order("name");
      setUsers(data || []);
    };
    fetchUsers();
  }, [canSelectUser]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // For weekly_only users: only their own entries; for others: all users or selected user
      let timesheetQuery = supabase
        .from("timesheet")
        .select("*, projects(name)")
        .order("date", { ascending: false });
      if (currentUser?.userType === "weekly_only" && currentUser?.id) {
        timesheetQuery = timesheetQuery.eq("user_id", currentUser.id);
      } else if (canSelectUser && selectedUserId && selectedUserId !== "all") {
        timesheetQuery = timesheetQuery.eq("user_id", selectedUserId);
      }
      const { data: timesheetData } = await timesheetQuery;
      const { data: projectData } = await supabase.from("projects").select("*");
      setTimesheet(timesheetData || []);
      setProjects(projectData || []);
      setLoading(false);
    };
    fetchData();
  }, [currentUser, canSelectUser, selectedUserId]);

  // Helper: get start/end of this week, month, last month, last 6 months, last year, or single day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  const startOfLast6Months = new Date(today);
  startOfLast6Months.setMonth(today.getMonth() - 6);
  startOfLast6Months.setHours(0, 0, 0, 0);
  const startOfLast1Year = new Date(today);
  startOfLast1Year.setFullYear(today.getFullYear() - 1);
  startOfLast1Year.setHours(0, 0, 0, 0);

  const isInRange = (dateStr: string, start: Date, end: Date) => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return d >= start && d <= end;
  };

  let filteredEntries = timesheet;
  if (timePeriod === "week") {
    filteredEntries = timesheet.filter(e => isInRange(e.date, startOfWeek, endOfWeek));
  } else if (timePeriod === "month") {
    filteredEntries = timesheet.filter(e => isInRange(e.date, startOfMonth, endOfMonth));
  } else if (timePeriod === "lastMonth") {
    filteredEntries = timesheet.filter(e => isInRange(e.date, startOfLastMonth, endOfLastMonth));
  } else if (timePeriod === "last6Months") {
    filteredEntries = timesheet.filter(e => isInRange(e.date, startOfLast6Months, today));
  } else if (timePeriod === "last1Year") {
    filteredEntries = timesheet.filter(e => isInRange(e.date, startOfLast1Year, today));
  } else if (timePeriod === "day") {
    const day = selectedDay ?? today;
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    filteredEntries = timesheet.filter(e => isInRange(e.date, dayStart, dayEnd));
  } else if (timePeriod === "dateRange") {
    if (!dateRange.from) {
      filteredEntries = [];
    } else {
      const from = dateRange.from;
      const to = dateRange.to ?? dateRange.from;
      const rangeStart = new Date(from);
      rangeStart.setHours(0, 0, 0, 0);
      const rangeEnd = new Date(to);
      rangeEnd.setHours(23, 59, 59, 999);
      const start = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
      const end = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
      filteredEntries = timesheet.filter(e => isInRange(e.date, start, end));
    }
  }

  // Filter out admin adjustments (entries without startTime/endTime are admin adjustments)
  // Only use entries that have both startTime and endTime - these are user-created entries
  // This matches the behavior of Weekly Entry, View Hours, and Export
  filteredEntries = filteredEntries.filter(e => e.startTime && e.endTime);

  // Filter out break entries (work type 35) and entries without a project
  filteredEntries = filteredEntries.filter(e => {
    // Filter out break entries
    if (e.description === "35" || e.description === 35) {
      return false;
    }
    
    // Get project name
    const projectName = e.projects?.name || e.project;
    
    // Filter out entries with no project or "Geen project"
    if (!projectName || projectName.trim() === "" || projectName === "Geen project") {
      return false;
    }
    
    return true;
  });

  // Calculate hours per project
  const projectHoursMap: Record<string, { hours: number; entries: number }> = {};
  filteredEntries.forEach(e => {
    const projectName = e.projects?.name || e.project;
    // At this point, projectName should always exist and not be "Geen project" due to filtering above
    if (!projectName) return; // Safety check
    
    if (!projectHoursMap[projectName]) {
      projectHoursMap[projectName] = { hours: 0, entries: 0 };
    }
    projectHoursMap[projectName].hours += Number(e.hours || 0);
    projectHoursMap[projectName].entries += 1;
  });

  // Convert to array and sort by hours (descending)
  const projectHours = Object.entries(projectHoursMap)
    .map(([name, data]) => ({
      name,
      hours: data.hours,
      entries: data.entries,
    }))
    .sort((a, b) => b.hours - a.hours);

  const totalHours = projectHours.reduce((sum, p) => sum + p.hours, 0);

  const formatDateRangeLabel = (from: Date | null, to: Date | null) => {
    if (!from) return null;
    const end = to ?? from;
    return `${from.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} – ${end.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
  };

  const displayName =
    canSelectUser && selectedUserId && selectedUserId !== "all"
      ? (users.find((u) => String(u.id) === selectedUserId)?.name ||
         users.find((u) => String(u.id) === selectedUserId)?.email) ||
        t("common.user")
      : currentUser?.name || t("common.user");

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Period Selector */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-3 sm:gap-0`}>
            <div>
              <CardTitle className="text-lg sm:text-xl">{t('overview.title')}</CardTitle>
              <CardDescription className="text-sm">{t('overview.subtitle', { name: displayName })}</CardDescription>
            </div>
            <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-3`}>
              {canSelectUser && (
                <Select value={selectedUserId || "all"} onValueChange={(v) => setSelectedUserId(v)}>
                  <SelectTrigger className={`${isMobile ? 'w-full' : 'w-48'} h-10 sm:h-9`}>
                    <SelectValue placeholder={t("export.allUsers")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("export.allUsers")}</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={timePeriod} onValueChange={(value: TimePeriodValue) => setTimePeriod(value)}>
                <SelectTrigger className={`${isMobile ? 'w-full' : 'w-40'} h-10 sm:h-9`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('overview.allTime')}</SelectItem>
                  <SelectItem value="month">{t('overview.thisMonth')}</SelectItem>
                  <SelectItem value="week">{t('overview.thisWeek')}</SelectItem>
                  <SelectItem value="lastMonth">{t('overview.lastMonth')}</SelectItem>
                  <SelectItem value="last6Months">{t('overview.last6Months')}</SelectItem>
                  <SelectItem value="last1Year">{t('overview.last1Year')}</SelectItem>
                  <SelectItem value="day">{t('overview.specificDay')}</SelectItem>
                  <SelectItem value="dateRange">{t('overview.dateRange')}</SelectItem>
                </SelectContent>
              </Select>
              {timePeriod === "day" && (
                <Popover open={dayPickerOpen} onOpenChange={setDayPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`${isMobile ? 'w-full' : ''} h-10 sm:h-9 justify-start text-left font-normal`}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDay ? formatDateToYYYYMMDD(selectedDay) : t('overview.pickDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDay ?? undefined}
                      onSelect={(date) => {
                        setSelectedDay(date ?? null);
                        setDayPickerOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
              {timePeriod === "dateRange" && (
                <Popover
                  open={dateRangePickerOpen}
                  onOpenChange={(open) => {
                    if (!open) {
                      const r = dateRangeRef.current;
                      if (r.from == null || r.to == null) return;
                    }
                    setDateRangePickerOpen(open);
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`${isMobile ? 'w-full' : ''} h-10 sm:h-9 justify-start text-left font-normal`}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {!dateRangePickerOpen && dateRange.from
                        ? formatDateRangeLabel(dateRange.from, dateRange.to)
                        : t('overview.selectDateRange')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={{ from: dateRange.from ?? undefined, to: dateRange.to ?? undefined }}
                      onSelect={(range) => {
                        const newRange = { from: range?.from ?? null, to: range?.to ?? null };
                        dateRangeRef.current = newRange;
                        setDateRange(newRange);
                        if (range?.from != null && range?.to != null) setDateRangePickerOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {loading ? (
            <div className="text-center py-8 text-sm">{t('overview.loading')}</div>
          ) : projectHours.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">{t('overview.noHoursFound')}</div>
          ) : isMobile ? (
            /* Mobile: Card Layout */
            <div className="space-y-3">
              {projectHours.map((project, idx) => {
                const percentage = totalHours > 0 ? Math.round((project.hours / totalHours) * 100) : 0;
                return (
                  <div key={idx} className="border rounded-lg p-3 bg-white">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm text-gray-900">{project.name}</h4>
                        <div className="text-xs text-gray-600 mt-1">{project.entries} {t('overview.entries')}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm text-orange-600">{project.hours.toFixed(2)}h</div>
                        <div className="text-xs text-gray-500">{percentage}%</div>
                      </div>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
              <div className="border-t-2 border-gray-400 rounded-lg p-3 bg-gray-50 font-bold">
                <div className="flex justify-between items-center">
                  <span className="text-sm">{t('overview.total')}</span>
                  <div className="text-right">
                    <div className="text-sm">{totalHours.toFixed(2)}h</div>
                    <div className="text-xs text-gray-600">{filteredEntries.length} {t('overview.entries')}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Desktop: Table Layout */
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="p-3 text-left border text-gray-900 dark:text-gray-100">{t('overview.project')}</th>
                    <th className="p-3 text-right border text-gray-900 dark:text-gray-100">{t('overview.totalHours')}</th>
                    <th className="p-3 text-right border text-gray-900 dark:text-gray-100">{t('overview.entries')}</th>
                    <th className="p-3 text-left border text-gray-900 dark:text-gray-100">{t('overview.percentage')}</th>
                    <th className="p-3 text-left border text-gray-900 dark:text-gray-100">{t('overview.visualization')}</th>
                  </tr>
                </thead>
                <tbody>
                  {projectHours.map((project, idx) => {
                    const percentage = totalHours > 0 ? Math.round((project.hours / totalHours) * 100) : 0;
                    return (
                      <tr key={idx} className="border-t hover:bg-gray-50 dark:hover:bg-gray-700 bg:white dark:bg-gray-900">
                        <td className="p-3 border font-medium text-gray-900 dark:text-gray-100">{project.name}</td>
                        <td className="p-3 border text-right font-semibold text-gray-900 dark:text-gray-100">{project.hours.toFixed(2)}h</td>
                        <td className="p-3 border text-right text-gray-900 dark:text-gray-100">{project.entries}</td>
                        <td className="p-3 border text-right text-gray-900 dark:text-gray-100">{percentage}%</td>
                        <td className="p-3 border dark:gb-gray-800">
                          <div className="flex items-center gap-2">
                            <Progress value={percentage} className="h-2 flex-1" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-gray-400 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 font-bold">
                    <td className="p-3 border text-gray-900 dark:text-gray-100">{t('overview.total')}</td>
                    <td className="p-3 border text-right text-gray-900 dark:text-gray-100">{totalHours.toFixed(2)}h</td>
                    <td className="p-3 border text-right text-gray-900 dark:text-gray-100">{filteredEntries.length}</td>
                    <td className="p-3 border text-gray-900 dark:text-gray-100">100%</td>
                    <td className="p-3 border text-gray-900 dark:text-gray-100"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center">
              <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-orange-600">
                  {timePeriod === "all" && t('overview.totalHours')}
                  {timePeriod === "month" && t('overview.thisMonth')}
                  {timePeriod === "week" && t('overview.thisWeek')}
                  {timePeriod === "lastMonth" && t('overview.lastMonth')}
                  {timePeriod === "last6Months" && t('overview.last6Months')}
                  {timePeriod === "last1Year" && t('overview.last1Year')}
                  {timePeriod === "day" && (selectedDay ? formatDateToYYYYMMDD(selectedDay) : t('overview.specificDay'))}
                  {timePeriod === "dateRange" && (dateRange.from ? formatDateRangeLabel(dateRange.from, dateRange.to) : t('overview.dateRange'))}
                </p>
                <p className="text-xl sm:text-2xl font-bold text-white-900">{loading ? "-" : totalHours.toFixed(1) + "h"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center">
              <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-purple-600">{t('overview.projects')}</p>
                <p className="text-xl sm:text-2xl font-bold text-white-900">{loading ? "-" : projectHours.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center">
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-green-600">{t('overview.avgPerProject')}</p>
                <p className="text-xl sm:text-2xl font-bold text-white-900">
                  {loading ? "-" : projectHours.length > 0 ? (totalHours / projectHours.length).toFixed(1) + "h" : "0h"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TimeOverview;
