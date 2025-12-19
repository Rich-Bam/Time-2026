import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Clock, Calendar, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TimeOverviewProps {
  currentUser: any;
}

const TimeOverview = ({ currentUser }: TimeOverviewProps) => {
  const [timesheet, setTimesheet] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      setLoading(true);
      // Only fetch data for the current user
      const { data: timesheetData } = await supabase
        .from("timesheet")
        .select("*, projects(name)")
        .eq("user_id", currentUser.id);
      const { data: projectData } = await supabase.from("projects").select("*");
      setTimesheet(timesheetData || []);
      setProjects(projectData || []);
      setLoading(false);
    };
    fetchData();
  }, [currentUser]);

  // Helper: get start/end of this week and month
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Filter timesheet data for this week/month
  const isInRange = (dateStr: string, start: Date, end: Date) => {
    const d = new Date(dateStr);
    return d >= start && d <= end;
  };
  const weekEntries = timesheet.filter(e => isInRange(e.date, startOfWeek, endOfWeek));
  const monthEntries = timesheet.filter(e => isInRange(e.date, startOfMonth, endOfMonth));

  // This Week
  const totalWeeklyHours = weekEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);
  // Daily Average
  const averageDaily = weekEntries.length > 0 ? totalWeeklyHours / 5 : 0;
  // Active Projects
  const activeProjects = projects.filter(p => p.status === "active").length;
  // This Month
  const totalMonthlyHours = monthEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);

  // Weekly Overview (Mon-Fri)
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const weeklyData = days.map((day, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const hours = weekEntries
      .filter(e => e.date === dateStr)
      .reduce((sum, e) => sum + Number(e.hours || 0), 0);
    return { day, hours };
  });

  // Project Time Distribution (this week)
  const projectSummaryMap: Record<string, { hours: number }> = {};
  weekEntries.forEach(e => {
    const name = e.projects?.name || "Unknown";
    if (!projectSummaryMap[name]) projectSummaryMap[name] = { hours: 0 };
    projectSummaryMap[name].hours += Number(e.hours || 0);
  });
  const projectSummary = Object.entries(projectSummaryMap).map(([name, { hours }]) => ({
    name,
    hours,
    percentage: totalWeeklyHours ? Math.round((hours / totalWeeklyHours) * 100) : 0,
    color: "bg-orange-500"
  }));

  // Recent Activity (last 5 entries)
  const recentActivity = [...timesheet]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
    .map(e => ({
      time: e.date,
      action: `Logged ${e.hours} hours`,
      project: e.projects?.name || "Unknown",
      type: "time-entry",
      description: e.description
    }));

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-2xl font-bold text-gray-900">{loading ? "-" : totalWeeklyHours + "h"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Daily Average</p>
                <p className="text-2xl font-bold text-gray-900">{loading ? "-" : averageDaily.toFixed(1) + "h"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Projects</p>
                <p className="text-2xl font-bold text-gray-900">{loading ? "-" : activeProjects}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-2xl font-bold text-gray-900">{loading ? "-" : totalMonthlyHours + "h"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Overview</CardTitle>
            <CardDescription>Your hours logged each day this week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {weeklyData.map((day) => (
                <div key={day.day} className="flex items-center space-x-4">
                  <div className="w-20 text-sm font-medium">{day.day}</div>
                  <div className="flex-1">
                    <Progress value={day.hours ? (day.hours / 8) * 100 : 0} className="h-2" />
                  </div>
                  <div className="w-16 text-sm text-gray-600">{day.hours}h</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Project Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Project Time Distribution</CardTitle>
            <CardDescription>Your hours spent on each project this week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projectSummary.map((project) => (
                <div key={project.name} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{project.name}</span>
                    <span className="text-sm text-gray-600">{project.hours}h</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-4 h-4 rounded ${project.color}`}></div>
                    <Progress value={project.percentage} className="h-2 flex-1" />
                    <span className="text-sm text-gray-500">{project.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest time entries and updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center space-x-4 p-3 rounded-lg border">
                <div className="flex-shrink-0">
                  {activity.type === "time-entry" && <Clock className="h-5 w-5 text-orange-500" />}
                  {activity.type === "project" && <BarChart3 className="h-5 w-5 text-green-500" />}
                  {activity.type === "completion" && <TrendingUp className="h-5 w-5 text-purple-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.action} • {activity.project}
                  </p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                  {activity.description && <p className="text-xs text-gray-500">{activity.description}</p>}
                </div>
                <Badge variant="outline">{activity.type}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TimeOverview;
