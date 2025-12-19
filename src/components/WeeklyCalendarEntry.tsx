import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from 'lucide-react';

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

const timeOptions = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, '0');
  const m = String((i % 4) * 15).padStart(2, '0');
  return `${h}:${m}`;
});

const WeeklyCalendarEntry = ({ currentUser }: { currentUser: any }) => {
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return getWeekDates(now)[0];
  });
  const [days, setDays] = useState(() => getWeekDates(new Date()).map(date => ({ date, entries: [{ workType: "", project: "", hours: "", lunch: true, startTime: "", endTime: "" }], open: false })));
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const { toast } = useToast();
  const [dbDaysOff, setDbDaysOff] = useState(0);
  const [customProjects, setCustomProjects] = useState<Record<string, string>>({});
  const [submittedEntries, setSubmittedEntries] = useState<Record<string, any[]>>({});
  const [confirmedWeeks, setConfirmedWeeks] = useState<Record<string, boolean>>({});

  const weekDates = getWeekDates(weekStart);
  const weekNumber = getISOWeekNumber(weekDates[0]);

  useEffect(() => {
    const fetchProjects = async () => {
      const { data, error } = await supabase.from("projects").select("id, name");
      if (data) setProjects(data);
    };
    fetchProjects();
  }, []);

  // Fetch days off from database for the current user and year
  useEffect(() => {
    const fetchDaysOff = async () => {
      if (!currentUser) return;
      const currentYear = new Date().getFullYear();
      const fromDate = `${currentYear}-01-01`;
      const toDate = `${currentYear}-12-31`;
      const { data, error } = await supabase
        .from("timesheet")
        .select("hours, description")
        .eq("user_id", currentUser.id)
        .eq("description", "31")
        .gte("date", fromDate)
        .lte("date", toDate);
      if (data) {
        const totalHours = data.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);
        setDbDaysOff(totalHours / 8);
      }
    };
    fetchDaysOff();
  }, [currentUser]);

  // Fetch submitted entries for a day
  const fetchSubmittedEntries = async (dateStr: string) => {
    if (!currentUser) return;
    const { data } = await supabase
      .from("timesheet")
      .select("id, project, hours, description, date, startTime, endTime")
      .eq("user_id", currentUser.id)
      .eq("date", dateStr);
    setSubmittedEntries(prev => ({ ...prev, [dateStr]: data || [] }));
  };

  // On mount and when week changes, fetch submitted entries for all days in the week
  useEffect(() => {
    if (!currentUser) return;
    weekDates.forEach(d => fetchSubmittedEntries(d.toISOString().split('T')[0]));
    // eslint-disable-next-line
  }, [currentUser, weekStart]);

  // Fetch confirmed status for the week
  const fetchConfirmedStatus = async () => {
    if (!currentUser) return;
    const weekKey = weekDates[0].toISOString().split('T')[0];
    const { data } = await supabase
      .from('confirmed_weeks')
      .select('confirmed')
      .eq('user_id', currentUser.id)
      .eq('week_start_date', weekKey)
      .single();
    setConfirmedWeeks(prev => ({ ...prev, [weekKey]: !!data?.confirmed }));
  };

  useEffect(() => {
    fetchConfirmedStatus();
    // eslint-disable-next-line
  }, [currentUser, weekStart]);

  const changeWeek = (delta: number) => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + delta * 7);
    setWeekStart(getWeekDates(newStart)[0]);
    setDays(getWeekDates(newStart).map(date => ({ date, entries: [{ workType: "", project: "", hours: "", lunch: true, startTime: "", endTime: "" }], open: false })));
  };

  const handleOpenDay = (dayIdx: number) => {
    setDays(days.map((day, i) => {
      if (i !== dayIdx) {
        return { ...day, open: false };
      }
      // Ensure there is always at least one editable entry when a day is opened
      const hasEntries = day.entries && day.entries.length > 0;
      return {
        ...day,
        open: true,
        entries: hasEntries
          ? day.entries
          : [{ workType: "", project: "", hours: "", lunch: true, startTime: "", endTime: "" }],
      };
    }));
  };

  const handleAddEntry = (dayIdx: number) => {
    setDays(days.map((day, i) =>
      i === dayIdx ? { ...day, entries: [...day.entries, { workType: "", project: "", hours: "", lunch: true, startTime: "", endTime: "" }] } : day
    ));
  };

  const handleRemoveEntry = (dayIdx: number, entryIdx: number) => {
    setDays(days.map((day, i) =>
      i === dayIdx ? { ...day, entries: day.entries.filter((_, j) => j !== entryIdx) } : day
    ));
  };

  const handleEntryChange = (dayIdx: number, entryIdx: number, field: string, value: any) => {
    setDays(days.map((day, i) => {
      if (i !== dayIdx) return day;
      return {
        ...day,
        entries: day.entries.map((entry, j) => {
          if (j !== entryIdx) return entry;
          let updated = { ...entry, [field]: value };
          // Auto-calculate hours if startTime and endTime are set and field is startTime or endTime
          if ((field === "startTime" || field === "endTime") && updated.startTime && updated.endTime) {
            const start = new Date(`2000-01-01T${updated.startTime}`);
            const end = new Date(`2000-01-01T${updated.endTime}`);
            let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            if (diff > 0) {
              updated.hours = diff.toString();
            }
          }
          // Auto-set endTime if empty or before new startTime
          if (field === "startTime") {
            if (!updated.endTime || updated.endTime <= value) {
              updated.endTime = addMinutes(value, 15);
            }
          }
          return updated;
        })
      };
    }));
  };

  // Days Off Remaining calculation (for current year)
  const totalDaysOff = 25;
  const daysOffLeft = (totalDaysOff - dbDaysOff).toFixed(1);

  const handleSubmitAll = async () => {
    const entriesToSave = [];
    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const day = days[dayIdx];
      const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6; // Sunday=0, Saturday=6
      for (let entryIdx = 0; entryIdx < day.entries.length; entryIdx++) {
        const entry = day.entries[entryIdx];
        const isDayOff = entry.workType === "31";
        // Only validate required fields for Mon-Fri
        if (!isWeekend && ((!entry.project && !isDayOff) || !entry.workType || !entry.hours)) {
          toast({
            title: "Missing Information",
            description: `Please fill in all required fields for ${day.date.toLocaleDateString()}`,
            variant: "destructive",
          });
          return;
        }
        // For weekends, skip empty entries
        if (isWeekend && (!entry.project && !isDayOff) && !entry.workType && !entry.hours) {
          continue;
        }
        let hoursToSave = Number(entry.hours);
        if (entry.lunch && !isDayOff) {
          hoursToSave = Math.max(0, hoursToSave - 0.5);
        }
        entriesToSave.push({
          project: isDayOff ? null : entry.project,
          user_id: currentUser?.id || null,
          date: day.date.toISOString().split('T')[0],
          hours: hoursToSave,
          description: entry.workType,
        });
      }
    }
    if (entriesToSave.length === 0) {
      toast({ title: "No entries", description: "Nothing to submit.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("timesheet").insert(entriesToSave);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Entries Saved", description: `${entriesToSave.length} entries logged.` });
    }
  };

  const doTimesOverlap = (startA, endA, startB, endB) => {
    if (!startA || !endA || !startB || !endB) return false;
    const sA = new Date(`2000-01-01T${startA}`);
    const eA = new Date(`2000-01-01T${endA}`);
    const sB = new Date(`2000-01-01T${startB}`);
    const eB = new Date(`2000-01-01T${endB}`);
    return sA < eB && sB < eA;
  };

  const handleSubmitDay = async (dayIdx: number) => {
    const day = days[dayIdx];
    const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
    const entriesToSave = [];
    const dateStr = day.date.toISOString().split('T')[0];
    const allEntries = [
      ...day.entries,
      ...(submittedEntries[dateStr] || []).map(e => ({ startTime: e.startTime, endTime: e.endTime }))
    ];
    for (let i = 0; i < allEntries.length; i++) {
      for (let j = i + 1; j < allEntries.length; j++) {
        if (doTimesOverlap(allEntries[i].startTime, allEntries[i].endTime, allEntries[j].startTime, allEntries[j].endTime)) {
          toast({
            title: "Overlapping Hours",
            description: "You cannot have overlapping working hours on the same day.",
            variant: "destructive",
          });
          return;
        }
      }
    }
    for (let entryIdx = 0; entryIdx < day.entries.length; entryIdx++) {
      const entry = day.entries[entryIdx];
      const isDayOff = entry.workType === "31";
      if (!isWeekend && ((!entry.project && !isDayOff) || !entry.workType || !entry.hours)) {
        toast({
          title: "Missing Information",
          description: `Please fill in all required fields for ${day.date.toLocaleDateString()}`,
          variant: "destructive",
        });
        return;
      }
      if (isWeekend && (!entry.project && !isDayOff) && !entry.workType && !entry.hours) {
        continue;
      }
      let hoursToSave = Number(entry.hours);
      if (entry.lunch && !isDayOff) {
        hoursToSave = Math.max(0, hoursToSave - 0.5);
      }
      entriesToSave.push({
        project: isDayOff ? null : entry.project,
        user_id: currentUser?.id || null,
        date: day.date.toISOString().split('T')[0],
        hours: hoursToSave,
        description: entry.workType,
        startTime: entry.startTime || null,
        endTime: entry.endTime || null,
      });
    }
    if (entriesToSave.length === 0) {
      toast({ title: "No entries", description: "Nothing to submit.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("timesheet").insert(entriesToSave);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Entries Saved", description: `${entriesToSave.length} entries logged for ${day.date.toLocaleDateString()}.` });
      // Reset that day's entries to a single empty entry
      setDays(prevDays => prevDays.map((d, i) =>
        i === dayIdx
          ? { ...d, entries: [{ workType: "", project: "", hours: "", lunch: true, startTime: "", endTime: "" }] }
          : d
      ));
      await fetchSubmittedEntries(day.date.toISOString().split('T')[0]);
    }
  };

  // Add a helper function to round time to nearest 15 minutes
  function roundToQuarterHour(timeStr: string) {
    // Accepts 'HH:mm' or 'H:mm' format
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return timeStr;
    let [_, h, m] = match;
    let hour = parseInt(h, 10);
    let min = parseInt(m, 10);
    // Round minutes to nearest 15
    min = Math.round(min / 15) * 15;
    if (min === 60) {
      hour += 1;
      min = 0;
    }
    return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  }

  const handleAddCustomProject = (dayIdx: number, entryIdx: number) => {
    const key = `${dayIdx}-${entryIdx}`;
    const customProject = customProjects[key]?.trim();
    if (customProject) {
      setDays(days => days.map((day, i) =>
        i === dayIdx ? {
          ...day,
          entries: day.entries.map((entry, j) =>
            j === entryIdx ? { ...entry, project: customProject } : entry
          )
        } : day
      ));
      setCustomProjects(cp => ({ ...cp, [key]: "" }));
    }
  };

  const handleConfirmWeek = async () => {
    const weekKey = weekDates[0].toISOString().split('T')[0];
    await supabase.from('confirmed_weeks').upsert({
      user_id: currentUser.id,
      week_start_date: weekKey,
      confirmed: true
    });
    fetchConfirmedStatus();
  };

  const handleDeleteEntry = async (entryId: number, dateStr: string) => {
    await supabase.from('timesheet').delete().eq('id', entryId);
    fetchSubmittedEntries(dateStr);
  };

  const addMinutes = (timeStr, mins) => {
    if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return "";
    const [h, m] = timeStr.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return "";
    let total = h * 60 + m + mins;
    let hour = Math.floor(total / 60);
    let min = total % 60;
    // Round to nearest 15
    min = Math.round(min / 15) * 15;
    if (min === 60) {
      hour += 1;
      min = 0;
    }
    return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  };

  // Helper to check if all weekdays are filled
  const allWeekdaysFilled = weekDates.slice(0, 5).every((date, idx) => {
    const dateStr = date.toISOString().split('T')[0];
    const hasSubmitted = (submittedEntries[dateStr] || []).length > 0;
    const hasNew = days[idx].entries.some(e => e.project || e.workType || e.hours);
    return hasSubmitted || hasNew;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Weekly Calendar Entry</h2>
          <div className="mt-1 text-gray-700 font-medium">
            Week {weekNumber} ({weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()})
          </div>
          <div className="flex items-center gap-4 mt-2">
            <Button variant="outline" onClick={() => changeWeek(-1)}>&lt; Prev</Button>
            <Button variant="outline" onClick={() => changeWeek(1)}>Next &gt;</Button>
          </div>
        </div>
        <Card className="bg-blue-50 border-blue-200 min-w-[260px]">
          <CardHeader>
            <CardTitle className="text-blue-900 text-lg">Days Off Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">{daysOffLeft} / {totalDaysOff}</div>
            <div className="text-sm text-blue-600 mt-2">You have {daysOffLeft} days off left this year.</div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 mb-6">
            {days.map((day, dayIdx) => (
              <div key={dayIdx} className="border rounded-lg p-2 bg-gray-50 cursor-pointer" onClick={() => handleOpenDay(dayIdx)}>
                <div className="font-semibold text-center">{day.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                <div className="text-xs text-center text-gray-500">{day.entries.length} entr{day.entries.length === 1 ? 'y' : 'ies'}</div>
              </div>
            ))}
          </div>
          {days.map((day, dayIdx) => day.open && (
            <div key={dayIdx} className="mb-4 border rounded-lg p-4 bg-white shadow">
              <div className="font-semibold mb-2">{day.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</div>
              {day.entries.map((entry, entryIdx) => (
                <div key={entryIdx} className="flex flex-wrap gap-2 items-end mb-2">
                  <div>
                    <Label>Work Type</Label>
                    <Select value={entry.workType} onValueChange={val => handleEntryChange(dayIdx, entryIdx, "workType", val)}>
                      <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>
                        {workTypes.map(type => (
                          <SelectItem key={type.value} value={String(type.value)}>{type.value} - {type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Project</Label>
                    {entry.project && !projects.some(p => p.name === entry.project) ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          value={entry.project}
                          onChange={e => handleEntryChange(dayIdx, entryIdx, "project", e.target.value)}
                          placeholder="Project"
                          disabled={entry.workType === "31"}
                        />
                        <Button size="sm" variant="outline" onClick={() => handleEntryChange(dayIdx, entryIdx, "project", "")}>Clear</Button>
                      </div>
                    ) : (
                      <>
                        <Select
                          value={entry.project}
                          onValueChange={val => handleEntryChange(dayIdx, entryIdx, "project", val)}
                          disabled={entry.workType === "31"}
                        >
                          <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
                          <SelectContent>
                            {projects.map(project => (
                              <SelectItem key={project.id} value={project.name}>{project.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2 mt-1">
                          <Input
                            value={customProjects[`${dayIdx}-${entryIdx}`] || ""}
                            onChange={e => setCustomProjects(prev => ({ ...prev, [`${dayIdx}-${entryIdx}`]: e.target.value }))}
                            placeholder="Add custom project"
                            disabled={entry.workType === "31"}
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="ml-2"
                            onClick={() => handleAddCustomProject(dayIdx, entryIdx)}
                          >
                            Add
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <Label>Start Time</Label>
                    <Input
                      type="text"
                      value={entry.startTime}
                      onChange={e => handleEntryChange(dayIdx, entryIdx, "startTime", roundToQuarterHour(e.target.value))}
                      placeholder="Start (e.g. 08:10)"
                      className="w-20"
                    />
                  </div>
                  <div>
                    <Label>End Time</Label>
                    <Input
                      type="text"
                      value={entry.endTime}
                      onChange={e => handleEntryChange(dayIdx, entryIdx, "endTime", roundToQuarterHour(e.target.value))}
                      placeholder="End (e.g. 17:45)"
                      className="w-20"
                    />
                  </div>
                  <div>
                    <Label>Hours</Label>
                    <Input type="number" min="0" step="0.25" value={entry.hours} onChange={e => handleEntryChange(dayIdx, entryIdx, "hours", e.target.value)} placeholder="h" />
                  </div>
                  <div className="flex items-center ml-2">
                    <input
                      id={`lunch-${dayIdx}-${entryIdx}`}
                      type="checkbox"
                      checked={entry.lunch}
                      onChange={e => handleEntryChange(dayIdx, entryIdx, "lunch", e.target.checked)}
                      className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <label htmlFor={`lunch-${dayIdx}-${entryIdx}`} className="ml-1 text-xs text-gray-700 select-none">
                      Lunch
                    </label>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => handleRemoveEntry(dayIdx, entryIdx)}>-</Button>
                </div>
              ))}
              <div className="flex gap-4 mt-4">
                <Button variant="default" onClick={() => handleSubmitDay(dayIdx)}>Submit Day</Button>
              </div>
              {submittedEntries[day.date.toISOString().split('T')[0]] && submittedEntries[day.date.toISOString().split('T')[0]].length > 0 && (
                <div className="mt-4">
                  <div className="font-semibold text-sm mb-1 text-gray-700">Submitted Entries:</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs border rounded">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-1 border">Project</th>
                          <th className="p-1 border">Work Type</th>
                          <th className="p-1 border">Hours</th>
                          {!confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && (
                            <th className="p-1 border">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {submittedEntries[day.date.toISOString().split('T')[0]].map((entry, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-1 border">{entry.project}</td>
                            <td className="p-1 border">{entry.description}</td>
                            <td className="p-1 border">{entry.startTime && entry.endTime ? `${entry.startTime} - ${entry.endTime}` : '-'}</td>
                            {!confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && (
                              <td className="p-1 border">
                                <Button size="icon" variant="ghost" onClick={() => handleDeleteEntry(entry.id, day.date.toISOString().split('T')[0])}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      {!confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && allWeekdaysFilled && (
        <Button className="mt-4 w-full bg-orange-600 hover:bg-orange-700 text-white" variant="default" onClick={handleConfirmWeek}>Confirm Week</Button>
      )}
      {confirmedWeeks[weekDates[0].toISOString().split('T')[0]] && (
        <div className="mt-4 text-green-700 font-semibold">This week is confirmed. No further changes allowed.</div>
      )}
    </div>
  );
};

export default WeeklyCalendarEntry; 