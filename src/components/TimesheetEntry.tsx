import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Clock, Calendar, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TimesheetEntryProps {
  currentUser: any;
}

const TimesheetEntry = ({ currentUser }: TimesheetEntryProps) => {
  const [entry, setEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    project: "",
    hours: "",
    description: "",
    startTime: "",
    endTime: ""
  });
  const [lunchBreak, setLunchBreak] = useState(false);

  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Fetch projects from Supabase (id and name) - only active projects
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    const fetchProjects = async () => {
      // Only fetch active projects (not closed) for time entry
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status")
        .or("status.is.null,status.neq.closed");
      if (data) {
        // Filter out closed projects
        const activeProjects = data
          .filter(p => !p.status || p.status !== "closed")
          .map(p => ({ id: p.id, name: p.name }));
        setProjects(activeProjects);
      }
      // Optionally handle error
    };
    fetchProjects();
  }, []);

  // Fetch recent time entries for the current user (for display)
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  useEffect(() => {
    const fetchEntries = async () => {
      if (!currentUser) return;
      const { data, error } = await supabase
        .from("timesheet")
        .select("*, projects(name)")
        .eq("user_id", currentUser.id)
        .order("date", { ascending: false })
        .limit(5);
      setRecentEntries(data || []);
    };
    fetchEntries();
  }, [currentUser]);

  // Count days off taken (work type 31) by hours, 8 hours = 1 day, using allYearEntries
  const totalDaysOff = 25;
  const totalHoursOff = recentEntries
    .filter(e => String(e.description) === "31")
    .reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);
  const daysOffTaken = totalHoursOff / 8;
  const daysOffLeft = (totalDaysOff - daysOffTaken).toFixed(1);

  const workTypes = [
    { value: 10, label: "Work" },
    { value: 11, label: "Production " },
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

  // Helper to check if selected work type is 'Day Off / Vacation' (31)
  const isDayOff = entry.description === "31";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry.project && !isDayOff) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Deduct 0.5 hours if lunch break is checked
    let hoursToSave = Number(entry.hours);
    if (lunchBreak) {
      hoursToSave = Math.max(0, hoursToSave - 0.5);
    }

    // Insert time entry into Supabase
    const { error } = await supabase.from("timesheet").insert([
      {
        project: isDayOff ? null : entry.project,
        user_id: currentUser?.id || null,
        date: entry.date,
        hours: hoursToSave,
        description: entry.description,
      }
    ]);
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Time Entry Saved",
      description: `${hoursToSave} hours logged`,
    });

    setEntry({
      date: new Date().toISOString().split('T')[0],
      project: "",
      hours: "",
      description: "",
      startTime: "",
      endTime: ""
    });
    setLunchBreak(false);
  };

  const calculateHours = () => {
    if (entry.startTime && entry.endTime) {
      const start = new Date(`2000-01-01 ${entry.startTime}`);
      const end = new Date(`2000-01-01 ${entry.endTime}`);
      const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (diff > 0) {
        setEntry({ ...entry, hours: diff.toString() });
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {/* Time Entry Form */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center text-lg sm:text-xl">
            <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            Log Time Entry
          </CardTitle>
          <CardDescription className="text-sm">
            Record your work hours for projects
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm font-semibold">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={entry.date}
                  onChange={(e) => setEntry({ ...entry, date: e.target.value })}
                  required
                  className="h-10 sm:h-9"
                />
              </div>
              {/* Project select is hidden if Day Off is selected */}
              {!isDayOff && (
                <div className="space-y-2">
                  <Label htmlFor="project" className="text-sm font-semibold">Project</Label>
                  <Input
                    value={entry.project}
                    onChange={e => setEntry({ ...entry, project: e.target.value })}
                    placeholder="Project"
                    disabled={isDayOff}
                    className="h-10 sm:h-9"
                  />
                </div>
              )}
            </div>

            <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-3'} gap-4`}>
              <div className="space-y-2">
                <Label htmlFor="startTime" className="text-sm font-semibold">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={entry.startTime}
                  onChange={(e) => setEntry({ ...entry, startTime: e.target.value })}
                  onBlur={calculateHours}
                  className="h-10 sm:h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime" className="text-sm font-semibold">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={entry.endTime}
                  onChange={(e) => setEntry({ ...entry, endTime: e.target.value })}
                  onBlur={calculateHours}
                  className="h-10 sm:h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hours" className="text-sm font-semibold">Hours</Label>
                <Input
                  id="hours"
                  type="number"
                  step="0.25"
                  placeholder="8.0"
                  value={entry.hours}
                  onChange={(e) => setEntry({ ...entry, hours: e.target.value })}
                  required
                  className="h-10 sm:h-9"
                />
              </div>
            </div>

            {/* Lunch break is hidden if Day Off is selected */}
            {!isDayOff && (
              <div className="flex items-center space-x-2">
                <input
                  id="lunchBreak"
                  type="checkbox"
                  checked={lunchBreak}
                  onChange={(e) => setLunchBreak(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="lunchBreak" className="text-sm">Lunch break</Label>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="workType" className="text-sm font-semibold">Work Type</Label>
              <Select
                value={entry.description}
                onValueChange={(value) => setEntry({ ...entry, description: value })}
              >
                <SelectTrigger className="h-10 sm:h-9">
                  <SelectValue placeholder="Select work type" />
                </SelectTrigger>
                <SelectContent>
                  {workTypes.map((type) => (
                    <SelectItem key={type.value} value={String(type.value)}>
                      {type.value} - {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full h-10 sm:h-9" size={isMobile ? "lg" : "default"}>
              <Clock className="h-4 w-4 mr-2" />
              Log Time Entry
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Days Off Banner */}
      <div className="flex flex-col gap-4 sm:gap-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-blue-900 text-base sm:text-lg">Days Off Remaining</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-blue-700">{daysOffLeft} / {totalDaysOff}</div>
            <div className="text-xs sm:text-sm text-blue-600 mt-2">You have {daysOffLeft} days off left this year.</div>
          </CardContent>
        </Card>
        {/* Recent Entries */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center text-lg sm:text-xl">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Recent Entries
            </CardTitle>
            <CardDescription className="text-sm">
              Your latest time entries
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="space-y-3 sm:space-y-4">
              {recentEntries.length === 0 ? (
                <div className="text-sm text-gray-500">No recent entries.</div>
              ) : (
                recentEntries.map((entry, index) => (
                  <div key={index} className="border-l-4 border-orange-500 pl-3 sm:pl-4 py-2">
                    <div className={`flex ${isMobile ? 'flex-col' : 'justify-between items-start'} gap-2`}>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm sm:text-base text-gray-900">{entry.projects?.name || "Unknown Project"}</h4>
                        <p className="text-xs sm:text-sm text-gray-600">{entry.description ? entry.description : "No description provided."}</p>
                      </div>
                      <div className={`text-${isMobile ? 'left' : 'right'}`}>
                        <div className="font-medium text-sm sm:text-base text-orange-600">{entry.hours}h</div>
                        <div className="text-xs text-gray-500">{entry.date}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs sm:text-sm text-gray-600">
              Connect to Supabase to save and retrieve your time entries permanently.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TimesheetEntry;
