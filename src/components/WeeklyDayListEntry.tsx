import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

function getWeekDates(date: Date) {
  const start = new Date(date);
  start.setDate(date.getDate() - ((date.getDay() + 6) % 7)); // Monday as first day
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const WeeklyDayListEntry = ({ currentUser }: { currentUser: any }) => {
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return getWeekDates(now)[0];
  });
  const [days, setDays] = useState(() => getWeekDates(new Date()).map(date => ({ date, entries: [] as any[] })));

  const weekDates = getWeekDates(weekStart);

  const changeWeek = (delta: number) => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + delta * 7);
    setWeekStart(getWeekDates(newStart)[0]);
    setDays(getWeekDates(newStart).map(date => ({ date, entries: [] })));
  };

  const handleAddEntry = (dayIdx: number) => {
    setDays(days.map((day, i) =>
      i === dayIdx ? { ...day, entries: [...day.entries, { workType: "", project: "", hours: "" }] } : day
    ));
  };

  const handleRemoveEntry = (dayIdx: number, entryIdx: number) => {
    setDays(days.map((day, i) =>
      i === dayIdx ? { ...day, entries: day.entries.filter((_, j) => j !== entryIdx) } : day
    ));
  };

  const handleEntryChange = (dayIdx: number, entryIdx: number, field: string, value: any) => {
    setDays(days.map((day, i) =>
      i === dayIdx ? {
        ...day,
        entries: day.entries.map((entry, j) =>
          j === entryIdx ? { ...entry, [field]: value } : entry
        )
      } : day
    ));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Day-by-Day Entry</CardTitle>
        <div className="flex items-center gap-4 mt-2">
          <Button variant="outline" onClick={() => changeWeek(-1)}>&lt; Prev</Button>
          <span className="font-medium">Week of {weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()}</span>
          <Button variant="outline" onClick={() => changeWeek(1)}>Next &gt;</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {days.map((day, dayIdx) => (
            <div key={dayIdx} className="border rounded-lg p-4 bg-gray-50">
              <div className="font-semibold mb-2">{day.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</div>
              {day.entries.map((entry, entryIdx) => (
                <div key={entryIdx} className="flex flex-wrap gap-2 items-end mb-2 bg-white p-2 rounded shadow-sm">
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
                    <Input value={entry.project} onChange={e => handleEntryChange(dayIdx, entryIdx, "project", e.target.value)} placeholder="Project" disabled={entry.workType === "31"} />
                  </div>
                  <div>
                    <Label>Hours</Label>
                    <Input type="number" min="0" step="0.25" value={entry.hours} onChange={e => handleEntryChange(dayIdx, entryIdx, "hours", e.target.value)} placeholder="h" />
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => handleRemoveEntry(dayIdx, entryIdx)}>-</Button>
                </div>
              ))}
              <Button size="sm" onClick={() => handleAddEntry(dayIdx)}>+ Add Entry</Button>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4">
          <Button variant="default">Submit All</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyDayListEntry; 