import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Calendar, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

// Helper function to get week dates
function getWeekDates(date: Date): Date[] {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  const monday = new Date(d.setDate(diff));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  });
}

// Helper function to get ISO week number
function getISOWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

const ViewHours = ({ currentUser }: { currentUser: any }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return getWeekDates(now)[0];
  });
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [availableWeeks, setAvailableWeeks] = useState<Array<{ weekStart: string; weekNumber: number; year: number; label: string }>>([]);

  const weekDates = getWeekDates(weekStart);
  const weekNumber = getISOWeekNumber(weekDates[0]);

  // Fetch all weeks where user has entries
  const fetchAvailableWeeks = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from("timesheet")
        .select("date")
        .eq("user_id", currentUser.id)
        .order("date", { ascending: false });

      if (error) {
        console.error("Error fetching available weeks:", error);
        return;
      }

      if (!data || data.length === 0) {
        setAvailableWeeks([]);
        return;
      }

      // Get unique week start dates
      const weekStarts = new Set<string>();
      data.forEach(entry => {
        const date = new Date(entry.date);
        const weekStart = getWeekDates(date)[0];
        weekStarts.add(weekStart.toISOString().split('T')[0]);
      });

      // Convert to array and format for dropdown
      const weeks = Array.from(weekStarts).map(weekStartStr => {
        const weekStartDate = new Date(weekStartStr);
        const weekDates = getWeekDates(weekStartDate);
        const weekNumber = getISOWeekNumber(weekDates[0]);
        const year = weekStartDate.getFullYear();
        const label = `${t('weekly.week')} ${weekNumber} (${weekDates[0].toLocaleDateString()} - ${weekDates[6].toLocaleDateString()})`;
        return { weekStart: weekStartStr, weekNumber, year, label };
      });

      // Sort by date descending (newest first)
      weeks.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
      setAvailableWeeks(weeks);
    } catch (err) {
      console.error("Error fetching available weeks:", err);
    }
  };

  // Fetch entries for the selected week
  const fetchEntries = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const fromDate = weekDates[0].toISOString().split('T')[0];
      const toDate = weekDates[6].toISOString().split('T')[0];

      const { data, error } = await supabase
        .from("timesheet")
        .select("*, projects(name)")
        .eq("user_id", currentUser.id)
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("date", { ascending: true })
        .order("startTime", { ascending: true });

      if (error) {
        toast({
          title: t('common.error'),
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setEntries(data || []);
    } catch (err: any) {
      toast({
        title: t('common.error'),
        description: err.message || t('viewHours.errorFetching'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableWeeks();
  }, [currentUser]);

  useEffect(() => {
    fetchEntries();
  }, [currentUser, weekStart]);

  const changeWeek = (delta: number) => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + delta * 7);
    setWeekStart(getWeekDates(newStart)[0]);
  };

  const getWorkTypeLabel = (desc: string) => {
    const workTypes: Record<string, string> = {
      "10": "Work",
      "11": "Production",
      "12": "Administration",
      "13": "Drawing",
      "14": "Trade Fair",
      "15": "Commercial",
      "16": "Telephone Support",
      "17": "Internal BAMPRO",
      "20": "Commute: Home - Work",
      "21": "Commute: Work - Work",
      "22": "Loading / Unloading",
      "23": "Waiting",
      "24": "Travel",
      "25": "Overtime",
      "26": "Holiday",
      "27": "Sick Leave",
      "28": "Training",
      "29": "Meeting",
      "30": "Other",
      "31": "Day Off",
    };
    return workTypes[desc] || desc;
  };

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  // Group entries by day
  const entriesByDay: Record<string, any[]> = {};
  weekDates.forEach(date => {
    const dateStr = date.toISOString().split('T')[0];
    entriesByDay[dateStr] = entries.filter(e => e.date === dateStr);
  });

  // Calculate totals
  const totalHours = entries.reduce((sum, e) => sum + (parseFloat(String(e.hours)) || 0), 0);
  const totalHoursFormatted = formatHours(totalHours);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('viewHours.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Week Navigation */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button variant="outline" onClick={() => changeWeek(-1)} size="sm" className="text-xs sm:text-sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t('weekly.prev')}
            </Button>
            <Button variant="outline" onClick={() => changeWeek(1)} size="sm" className="text-xs sm:text-sm">
              {t('weekly.next')}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            {availableWeeks.length > 0 && (
              <Select
                value={weekDates[0].toISOString().split('T')[0]}
                onValueChange={(value) => {
                  const selectedWeek = availableWeeks.find(w => w.weekStart === value);
                  if (selectedWeek) {
                    const newStart = new Date(selectedWeek.weekStart);
                    setWeekStart(getWeekDates(newStart)[0]);
                  }
                }}
              >
                <SelectTrigger className="w-[200px] sm:w-[250px] md:w-[300px] text-xs sm:text-sm h-8 sm:h-9">
                  <SelectValue placeholder={t('weekly.selectWeek')} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableWeeks.map((week) => (
                    <SelectItem key={week.weekStart} value={week.weekStart}>
                      {week.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="ml-auto text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('weekly.week')} {weekNumber} ({weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()})
            </div>
          </div>

          {/* Entries by Day */}
          {loading ? (
            <div className="text-center py-8">{t('common.loading')}</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {t('viewHours.noEntries')}
            </div>
          ) : (
            <div className="space-y-4">
              {weekDates.map((date, idx) => {
                const dateStr = date.toISOString().split('T')[0];
                const dayEntries = entriesByDay[dateStr] || [];
                const dayTotal = dayEntries.reduce((sum, e) => sum + (parseFloat(String(e.hours)) || 0), 0);

                return (
                  <Card key={dateStr} className="border-l-4 border-l-orange-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base sm:text-lg">
                        {date.toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dayEntries.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('viewHours.noEntriesForDay')}</p>
                      ) : (
                        <div className="space-y-2">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left p-2">{t('viewHours.project')}</th>
                                  <th className="text-left p-2">{t('viewHours.workType')}</th>
                                  <th className="text-left p-2">{t('viewHours.time')}</th>
                                  <th className="text-right p-2">{t('viewHours.hours')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dayEntries.map((entry) => (
                                  <tr key={entry.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td className="p-2">{entry.projects?.name || entry.project || '-'}</td>
                                    <td className="p-2">{getWorkTypeLabel(entry.description || '')}</td>
                                    <td className="p-2">
                                      {entry.startTime && entry.endTime 
                                        ? `${entry.startTime} - ${entry.endTime}`
                                        : '-'
                                      }
                                    </td>
                                    <td className="p-2 text-right">{formatHours(parseFloat(String(entry.hours)) || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="font-semibold bg-gray-50 dark:bg-gray-800">
                                  <td colSpan={3} className="p-2 text-right">{t('viewHours.total')}</td>
                                  <td className="p-2 text-right">{formatHours(dayTotal)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {/* Week Total */}
              <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-lg">{t('viewHours.weekTotal')}</span>
                    <span className="font-bold text-xl text-orange-700 dark:text-orange-300">
                      {totalHoursFormatted} {t('viewHours.hours')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ViewHours;

