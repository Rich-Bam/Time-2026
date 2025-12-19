import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Clock, Calendar, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimeOverviewProps {
  currentUser: any;
}

const TimeOverview = ({ currentUser }: TimeOverviewProps) => {
  const [timesheet, setTimesheet] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<"all" | "month" | "week">("all");

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      setLoading(true);
      // Only fetch data for the current user
      const { data: timesheetData } = await supabase
        .from("timesheet")
        .select("*, projects(name)")
        .eq("user_id", currentUser.id)
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

  // Calculate hours per project
  const projectHoursMap: Record<string, { hours: number; entries: number }> = {};
  filteredEntries.forEach(e => {
    const projectName = e.projects?.name || e.project || "Geen project";
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
    <div className="space-y-6">
      {/* Period Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Project Overview</CardTitle>
              <CardDescription>Uren per project - {currentUser?.name || "Jouw"} uren</CardDescription>
            </div>
            <Select value={timePeriod} onValueChange={(value: "all" | "month" | "week") => setTimePeriod(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle tijd</SelectItem>
                <SelectItem value="month">Deze maand</SelectItem>
                <SelectItem value="week">Deze week</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Laden...</div>
          ) : projectHours.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Geen uren gevonden voor de geselecteerde periode.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-3 text-left border">Project</th>
                    <th className="p-3 text-right border">Totaal Uren</th>
                    <th className="p-3 text-right border">Aantal Entries</th>
                    <th className="p-3 text-left border">Percentage</th>
                    <th className="p-3 text-left border">Visualisatie</th>
                  </tr>
                </thead>
                <tbody>
                  {projectHours.map((project, idx) => {
                    const percentage = totalHours > 0 ? Math.round((project.hours / totalHours) * 100) : 0;
                    return (
                      <tr key={idx} className="border-t hover:bg-gray-50">
                        <td className="p-3 border font-medium">{project.name}</td>
                        <td className="p-3 border text-right font-semibold">{project.hours.toFixed(2)}h</td>
                        <td className="p-3 border text-right">{project.entries}</td>
                        <td className="p-3 border">{percentage}%</td>
                        <td className="p-3 border">
                          <div className="flex items-center gap-2">
                            <Progress value={percentage} className="h-2 flex-1" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-gray-400 bg-gray-50 font-bold">
                    <td className="p-3 border">TOTAAL</td>
                    <td className="p-3 border text-right">{totalHours.toFixed(2)}h</td>
                    <td className="p-3 border text-right">{filteredEntries.length}</td>
                    <td className="p-3 border">100%</td>
                    <td className="p-3 border"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  {timePeriod === "all" ? "Totaal Uren" : timePeriod === "month" ? "Deze Maand" : "Deze Week"}
                </p>
                <p className="text-2xl font-bold text-gray-900">{loading ? "-" : totalHours.toFixed(1) + "h"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Projecten</p>
                <p className="text-2xl font-bold text-gray-900">{loading ? "-" : projectHours.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Gemiddeld per Project</p>
                <p className="text-2xl font-bold text-gray-900">
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
