import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Clock, Calendar, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/contexts/LanguageContext";

interface TimeOverviewProps {
  currentUser: any;
}

const TimeOverview = ({ currentUser }: TimeOverviewProps) => {
  const { t } = useLanguage();
  const [timesheet, setTimesheet] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<"all" | "month" | "week">("all");
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // fetch data for all users
      const { data: timesheetData } = await supabase
        .from("timesheet")
        .select("*, projects(name)")
        .order("date", { ascending: false });
      const { data: projectData } = await supabase.from("projects").select("*");
      setTimesheet(timesheetData || []);
      setProjects(projectData || []);
      setLoading(false);
    };
    fetchData();
  }, [currentUser]);

  // Helper: get start/end of this week and month
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Filter timesheet data based on selected period
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

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Period Selector */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-3 sm:gap-0`}>
            <div>
              <CardTitle className="text-lg sm:text-xl">{t('overview.title')}</CardTitle>
              <CardDescription className="text-sm">{t('overview.subtitle', { name: currentUser?.name || t('common.user') })}</CardDescription>
            </div>
            <Select value={timePeriod} onValueChange={(value: "all" | "month" | "week") => setTimePeriod(value)}>
              <SelectTrigger className={`${isMobile ? 'w-full' : 'w-40'} h-10 sm:h-9`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('overview.allTime')}</SelectItem>
                <SelectItem value="month">{t('overview.thisMonth')}</SelectItem>
                <SelectItem value="week">{t('overview.thisWeek')}</SelectItem>
              </SelectContent>
            </Select>
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
                  {timePeriod === "all" ? t('overview.totalHours') : timePeriod === "month" ? t('overview.thisMonth') : t('overview.thisWeek')}
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
