import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDateToYYYYMMDD } from "@/utils/dateUtils";

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
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return getWeekDates(now)[0];
  });
  const [rows, setRows] = useState([
    { workType: "", project: "", hours: Array(7).fill("") }
  ]);
  const [confirmedWeeks, setConfirmedWeeks] = useState<Record<string, boolean>>({});

  const weekDates = getWeekDates(weekStart);
  
  // Fetch confirmed status for the week
  const fetchConfirmedStatus = async () => {
    if (!currentUser) return;
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    const { data } = await supabase
      .from('confirmed_weeks')
      .select('confirmed, admin_approved')
      .eq('user_id', currentUser.id)
      .eq('week_start_date', weekKey)
      .single();
    // Week is locked if confirmed AND (not admin OR admin hasn't approved yet)
    const isLocked = !!data?.confirmed && (!currentUser.isAdmin || !data?.admin_approved);
    setConfirmedWeeks(prev => ({ ...prev, [weekKey]: isLocked }));
  };

  useEffect(() => {
    fetchConfirmedStatus();
    // eslint-disable-next-line
  }, [currentUser, weekStart]);

  const handleAddRow = () => {
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    const isWeekLocked = confirmedWeeks[weekKey];
    
    // Non-admins cannot add rows if week is confirmed
    if (isWeekLocked && !currentUser?.isAdmin) {
      toast({
        title: "Not Allowed",
        description: "This week is confirmed and cannot be changed anymore.",
        variant: "destructive",
      });
      return;
    }
    
    setRows([...rows, { workType: "", project: "", hours: Array(7).fill("") }]);
  };

  const handleRemoveRow = (idx: number) => {
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    const isWeekLocked = confirmedWeeks[weekKey];
    
    // Non-admins cannot remove rows if week is confirmed
    if (isWeekLocked && !currentUser?.isAdmin) {
      toast({
        title: "Not Allowed",
        description: "This week is confirmed and cannot be changed anymore.",
        variant: "destructive",
      });
      return;
    }
    
    setRows(rows.filter((_, i) => i !== idx));
  };

  const handleChange = (rowIdx: number, field: string, value: any) => {
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    const isWeekLocked = confirmedWeeks[weekKey];
    
    // Non-admins cannot change entries if week is confirmed
    if (isWeekLocked && !currentUser?.isAdmin) {
      return;
    }
    
    setRows(rows.map((row, i) =>
      i === rowIdx ? { ...row, [field]: value } : row
    ));
  };

  const handleHourChange = (rowIdx: number, dayIdx: number, value: string) => {
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    const isWeekLocked = confirmedWeeks[weekKey];
    
    // Non-admins cannot change hours if week is confirmed
    if (isWeekLocked && !currentUser?.isAdmin) {
      return;
    }
    
    setRows(rows.map((row, i) =>
      i === rowIdx ? { ...row, hours: row.hours.map((h: string, j: number) => j === dayIdx ? value : h) } : row
    ));
  };

  const changeWeek = (delta: number) => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + delta * 7);
    setWeekStart(getWeekDates(newStart)[0]);
  };

  // Handle week confirmation
  const handleConfirmWeek = async () => {
    if (!currentUser) return;
    
    const weekKey = formatDateToYYYYMMDD(weekDates[0]);
    
    // Check if week already has confirmed status
    const { data: existing } = await supabase
      .from('confirmed_weeks')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('week_start_date', weekKey)
      .single();
    
    if (existing?.confirmed) {
      toast({
        title: "Already Confirmed",
        description: "This week is already confirmed.",
        variant: "destructive",
      });
      return;
    }
    
    // Insert or update confirmed_weeks
    const { error } = await supabase
      .from('confirmed_weeks')
      .upsert({
        user_id: currentUser.id,
        week_start_date: weekKey,
        confirmed: true,
        admin_approved: false,
        admin_reviewed: false,
      }, {
        onConflict: 'user_id,week_start_date'
      });
    
    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to confirm week.",
        variant: "destructive",
      });
    } else {
      // Immediately update state to lock the week
      const weekKeyDate = formatDateToYYYYMMDD(weekDates[0]);
      setConfirmedWeeks(prev => ({ ...prev, [weekKeyDate]: true }));
      
      toast({
        title: "Week Confirmed",
        description: "This week has been confirmed and locked. You can no longer make changes.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
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
        {confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && !currentUser?.isAdmin && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
            ⚠️ This week is confirmed. You cannot make any changes until an admin has approved or reset it.
          </div>
        )}
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
              {rows.map((row, rowIdx) => {
                const weekKey = formatDateToYYYYMMDD(weekDates[0]);
                const isLocked = confirmedWeeks[weekKey] && !currentUser?.isAdmin;
                return (
                  <tr key={rowIdx}>
                    <td className="p-2 border">
                      <Select value={row.workType} onValueChange={val => handleChange(rowIdx, "workType", val)} disabled={isLocked}>
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
                        disabled={row.workType === "31" || isLocked}
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
                          disabled={isLocked}
                        />
                      </td>
                    ))}
                    <td className="p-2 border text-center">
                      <Button variant="destructive" size="sm" onClick={() => handleRemoveRow(rowIdx)} disabled={isLocked}>-</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex gap-4 mt-4">
          <Button onClick={handleAddRow} disabled={confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && !currentUser?.isAdmin}>Add Entry</Button>
          <Button variant="default" disabled={confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && !currentUser?.isAdmin}>Submit All</Button>
        </div>
      </CardContent>
    </Card>
    {!confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && (
      <Card className="mt-4 bg-orange-50 border-orange-200">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="text-sm text-orange-800">
              <strong>Note:</strong> Once you confirm this week, you will no longer be able to make changes. Please make sure all entries are correct before confirming.
            </div>
            <Button 
              className="w-full bg-orange-600 hover:bg-orange-700 text-white" 
              variant="default" 
              onClick={handleConfirmWeek}
            >
              Confirm Week
            </Button>
          </div>
        </CardContent>
      </Card>
    )}
    {confirmedWeeks[formatDateToYYYYMMDD(weekDates[0])] && (
      <Card className="mt-4 bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="text-blue-800 font-semibold">
            ✓ This week has been confirmed and locked. Contact an admin if you need to make changes.
          </div>
        </CardContent>
      </Card>
    )}
  </div>
  );
};

export default WeeklyTimesheetEntry; 