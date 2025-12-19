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
];

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekDates(date: Date) {
  const start = new Date(date);
  start.setDate(date.getDate() - ((date.getDay() + 6) % 7)); // Monday as first day
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const WeeklyTimesheetEntry = ({ currentUser }: { currentUser: any }) => {
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return getWeekDates(now)[0];
  });
  const [rows, setRows] = useState([
    { workType: "", project: "", hours: Array(7).fill("") }
  ]);

  const weekDates = getWeekDates(weekStart);

  const handleAddRow = () => {
    setRows([...rows, { workType: "", project: "", hours: Array(7).fill("") }]);
  };

  const handleRemoveRow = (idx: number) => {
    setRows(rows.filter((_, i) => i !== idx));
  };

  const handleChange = (rowIdx: number, field: string, value: any) => {
    setRows(rows.map((row, i) =>
      i === rowIdx ? { ...row, [field]: value } : row
    ));
  };

  const handleHourChange = (rowIdx: number, dayIdx: number, value: string) => {
    setRows(rows.map((row, i) =>
      i === rowIdx ? { ...row, hours: row.hours.map((h: string, j: number) => j === dayIdx ? value : h) } : row
    ));
  };

  const changeWeek = (delta: number) => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + delta * 7);
    setWeekStart(getWeekDates(newStart)[0]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Time Entry</CardTitle>
        <div className="flex items-center gap-4 mt-2">
          <Button variant="outline" onClick={() => changeWeek(-1)}>&lt; Prev</Button>
          <span className="font-medium">Week of {weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()}</span>
          <Button variant="outline" onClick={() => changeWeek(1)}>Next &gt;</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border">Work Type</th>
                <th className="p-2 border">Project</th>
                {daysOfWeek.map((day, i) => (
                  <th key={day} className="p-2 border">{day}<br />{weekDates[i].toLocaleDateString()}</th>
                ))}
                <th className="p-2 border">Remove</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  <td className="p-2 border">
                    <Select value={row.workType} onValueChange={val => handleChange(rowIdx, "workType", val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {workTypes.map(type => (
                          <SelectItem key={type.value} value={String(type.value)}>
                            {type.value} - {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2 border">
                    <Input
                      value={row.project}
                      onChange={e => handleChange(rowIdx, "project", e.target.value)}
                      placeholder="Project"
                      disabled={row.workType === "31"}
                    />
                  </td>
                  {daysOfWeek.map((_, dayIdx) => (
                    <td className="p-2 border" key={dayIdx}>
                      <Input
                        type="number"
                        min="0"
                        step="0.25"
                        value={row.hours[dayIdx]}
                        onChange={e => handleHourChange(rowIdx, dayIdx, e.target.value)}
                        placeholder="h"
                      />
                    </td>
                  ))}
                  <td className="p-2 border text-center">
                    <Button variant="destructive" size="sm" onClick={() => handleRemoveRow(rowIdx)}>-</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-4 mt-4">
          <Button onClick={handleAddRow}>Add Entry</Button>
          <Button variant="default">Submit All</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyTimesheetEntry; 