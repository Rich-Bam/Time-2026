import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BarChart3 } from "lucide-react";
import { formatDateToYYYYMMDD } from "@/utils/dateUtils";
import { useLanguage } from "@/contexts/LanguageContext";

interface UserOvertimeViewProps {
  currentUser: any;
}

// Helper to get week date range from week number and year
function getWeekDateRange(weekNumber: number, year: number) {
  try {
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7;
    const daysToMonday = jan4Day === 1 ? 0 : 1 - jan4Day;
    const week1Monday = new Date(year, 0, 4 + daysToMonday);
    const weekMonday = new Date(week1Monday);
    weekMonday.setDate(week1Monday.getDate() + (weekNumber - 1) * 7);
    const weekSunday = new Date(weekMonday);
    weekSunday.setDate(weekMonday.getDate() + 6);
    return {
      from: formatDateToYYYYMMDD(weekMonday),
      to: formatDateToYYYYMMDD(weekSunday)
    };
  } catch (error) {
    console.error("Error calculating week date range:", error);
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      from: formatDateToYYYYMMDD(monday),
      to: formatDateToYYYYMMDD(sunday)
    };
  }
}

// Helper to get day name in Dutch
const getDayNameNL = (dateStr: string) => {
  const date = new Date(dateStr);
  const days = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
  return days[date.getDay()];
};

// Helper to format date with day name (DD-MM-YYYY Dagnaam)
const formatDateWithDayName = (dateStr: string) => {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const dayName = getDayNameNL(dateStr);
  return `${day}-${month}-${year} ${dayName}`;
};

// Helper to get work type label
const getWorkTypeLabel = (desc: string) => {
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
    { value: 21, label: "Commute: Work - Home" },
    { value: 22, label: "Commute: Work - Work" },
    { value: 23, label: "Commute: Home - Home" },
    { value: 24, label: "Commute: Other" },
    { value: 25, label: "Travel" },
    { value: 26, label: "Travel: Overnight Stay" },
    { value: 27, label: "Travel: Hotel" },
    { value: 28, label: "Travel: Other" },
    { value: 29, label: "Other" },
    { value: 100, label: "Work" },
  ];
  const workType = parseInt(desc || "0");
  const found = workTypes.find(wt => wt.value === workType);
  return found ? found.label : desc || "Unknown";
};

const UserOvertimeView = ({ currentUser }: UserOvertimeViewProps) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { t, language } = useLanguage();
  
  const [overtimePeriod, setOvertimePeriod] = useState<"week" | "month" | "year" | "all">("month");
  const [overtimeData, setOvertimeData] = useState<any>(null);
  const [overtimeLoading, setOvertimeLoading] = useState(false);
  const [overtimeSelectedWeek, setOvertimeSelectedWeek] = useState<string>("");
  const [overtimeSelectedMonth, setOvertimeSelectedMonth] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [overtimeSelectedYear, setOvertimeSelectedYear] = useState<string>(new Date().getFullYear().toString());

  // Calculate overtime hours
  const calculateOvertime = async () => {
    if (!currentUser) return;
    
    setOvertimeLoading(true);
    try {
      // Determine date range based on period
      let fromDate = "";
      let toDate = "";
      
      if (overtimePeriod === "week") {
        if (!overtimeSelectedWeek || !overtimeSelectedYear) {
          toast({
            title: t('overtime.missingInformation'),
            description: t('overtime.selectWeekAndYear'),
            variant: "destructive",
          });
          setOvertimeLoading(false);
          return;
        }
        const weekNum = parseInt(overtimeSelectedWeek);
        const year = parseInt(overtimeSelectedYear);
        const { from, to } = getWeekDateRange(weekNum, year);
        fromDate = from;
        toDate = to;
      } else if (overtimePeriod === "month") {
        const month = parseInt(overtimeSelectedMonth);
        const year = parseInt(overtimeSelectedYear);
        fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      } else if (overtimePeriod === "year") {
        const year = parseInt(overtimeSelectedYear);
        fromDate = `${year}-01-01`;
        toDate = `${year}-12-31`;
      } else {
        // All time - no date filter
        fromDate = "";
        toDate = "";
      }

      // Build query - only for current user
      let queryBuilder = supabase
        .from("timesheet")
        .select("user_id, date, hours, description, project, startTime, endTime, notes")
        .eq("user_id", currentUser.id)
        .order("date", { ascending: true });
      
      if (fromDate && toDate) {
        queryBuilder = queryBuilder.gte("date", fromDate).lte("date", toDate);
      }

      const { data, error } = await queryBuilder;
      
      if (error) {
        toast({
          title: t('overtime.error'),
          description: error.message,
          variant: "destructive",
        });
        setOvertimeLoading(false);
        return;
      }

      // Group entries by date
      const dateMap: Record<string, { totalHours: number; entries: any[] }> = {};
      
      (data || []).forEach((entry: any) => {
        const date = entry.date;
        
        if (!dateMap[date]) {
          dateMap[date] = { totalHours: 0, entries: [] };
        }
        
        // Only count work hours (not day off, sick, etc.)
        // Work types 10-29 and 100 are work hours
        const workType = parseInt(entry.description || "0");
        if ((workType >= 10 && workType <= 29) || workType === 100) {
          const hours = parseFloat(entry.hours || 0);
          dateMap[date].totalHours += hours;
          // Store entry details for breakdown
          dateMap[date].entries.push({
            project: entry.project || "-",
            workType: entry.description || "",
            workTypeLabel: getWorkTypeLabel(entry.description || ""),
            hours: hours.toFixed(2),
            startTime: entry.startTime || "-",
            endTime: entry.endTime || "-",
            notes: entry.notes || ""
          });
        }
      });

      // Calculate overtime per day with percentage breakdown
      let totalOvertime = 0;
      let totalHours125 = 0;
      let totalHours150 = 0;
      let totalHours200 = 0;
      const dailyOvertime: any[] = [];
      
      Object.keys(dateMap).forEach(date => {
        const dayData = dateMap[date];
        const totalHours = dayData.totalHours;
        
        // Get day of week (0 = Sunday, 6 = Saturday)
        const dateObj = new Date(date);
        const dayOfWeek = dateObj.getDay();
        const isSaturday = dayOfWeek === 6;
        const isSunday = dayOfWeek === 0;
        const isWeekend = isSaturday || isSunday;
        
        let overtime = 0;
        let normalHours = 0;
        let hours125 = 0;
        let hours150 = 0;
        let hours200 = 0;
        
        if (isSunday) {
          // Sunday: ALL hours are 200%
          overtime = totalHours;
          normalHours = 0;
          hours200 = totalHours;
        } else if (isSaturday) {
          // Saturday: ALL hours are 150%
          overtime = totalHours;
          normalHours = 0;
          hours150 = totalHours;
        } else {
          // Weekday (Monday-Friday): calculate percentage breakdown
          normalHours = Math.min(totalHours, 8); // First 8 hours are normal
          const overtimeHours = totalHours > 8 ? totalHours - 8 : 0;
          
          if (overtimeHours > 0) {
            // 9th and 10th hour = 125%
            hours125 = Math.min(overtimeHours, 2);
            // Hours after 10th = 150%
            if (overtimeHours > 2) {
              hours150 = overtimeHours - 2;
            }
            overtime = overtimeHours;
          }
        }
        
        if (overtime > 0) {
          // Sort entries by startTime for better readability
          const sortedEntries = [...dayData.entries].sort((a, b) => {
            const timeA = a.startTime === "-" ? "99:99" : a.startTime;
            const timeB = b.startTime === "-" ? "99:99" : b.startTime;
            return timeA.localeCompare(timeB);
          });
          
          dailyOvertime.push({
            date,
            dayOfWeek: isWeekend ? (isSunday ? 'Sunday' : 'Saturday') : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][dayOfWeek - 1],
            totalHours: totalHours.toFixed(2),
            normalHours: normalHours.toFixed(2),
            overtime: overtime.toFixed(2),
            hours125: hours125.toFixed(2),
            hours150: hours150.toFixed(2),
            hours200: hours200.toFixed(2),
            isWeekend: isWeekend,
            isSaturday: isSaturday,
            isSunday: isSunday,
            entries: sortedEntries
          });
          totalOvertime += overtime;
          totalHours125 += hours125;
          totalHours150 += hours150;
          totalHours200 += hours200;
        }
      });
      
      setOvertimeData({
        totalOvertime: totalOvertime.toFixed(2),
        totalHours125: totalHours125.toFixed(2),
        totalHours150: totalHours150.toFixed(2),
        totalHours200: totalHours200.toFixed(2),
        dailyOvertime: dailyOvertime.sort((a, b) => a.date.localeCompare(b.date))
      });
    } catch (error: any) {
      toast({
        title: t('overtime.error'),
        description: error.message || t('overtime.failedToCalculate'),
        variant: "destructive",
      });
    } finally {
      setOvertimeLoading(false);
    }
  };

  const monthNames = language === 'nl' 
    ? ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="space-y-6">
      {/* Overtime Tracking Section */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-base sm:text-lg font-semibold mb-3 text-blue-800 dark:text-blue-200 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {t('overtime.title')}
        </h3>
        <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 mb-4">
          {t('overtime.description')}
          <br className="hidden sm:inline" />
          <strong>{t('overtime.percentageRules')}</strong>
        </p>
        
        {/* Filters */}
        <div className="mb-4 bg-white dark:bg-gray-700 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4'} gap-4 mb-4`}>
            <div>
              <Label className="text-sm font-semibold mb-2 block">{t('overtime.period')}</Label>
              <Select value={overtimePeriod} onValueChange={(value: any) => setOvertimePeriod(value)}>
                <SelectTrigger className="w-full bg-white dark:bg-gray-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">{t('overtime.week')}</SelectItem>
                  <SelectItem value="month">{t('overtime.month')}</SelectItem>
                  <SelectItem value="year">{t('overtime.year')}</SelectItem>
                  <SelectItem value="all">{t('overtime.all')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {overtimePeriod === "week" && (
              <>
                <div>
                  <Label className="text-sm font-semibold mb-2 block">{t('overtime.week')}</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    max="53" 
                    placeholder={t('export.weekPlaceholder') || "Week (1-53)"} 
                    value={overtimeSelectedWeek} 
                    onChange={e => setOvertimeSelectedWeek(e.target.value)} 
                    className="w-full bg-white dark:bg-gray-800" 
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-2 block">{t('overtime.year')}</Label>
                  <Input 
                    type="number" 
                    min="2020" 
                    max="2100" 
                    placeholder={t('export.yearPlaceholder') || "Year"} 
                    value={overtimeSelectedYear} 
                    onChange={e => setOvertimeSelectedYear(e.target.value)} 
                    className="w-full bg-white dark:bg-gray-800" 
                  />
                </div>
              </>
            )}

            {overtimePeriod === "month" && (
              <>
                <div>
                  <Label className="text-sm font-semibold mb-2 block">{t('overtime.month')}</Label>
                  <Select value={overtimeSelectedMonth} onValueChange={setOvertimeSelectedMonth}>
                    <SelectTrigger className="w-full bg-white dark:bg-gray-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => {
                        const monthNum = String(i + 1).padStart(2, '0');
                        return (
                          <SelectItem key={monthNum} value={monthNum}>
                            {monthNames[i]}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-2 block">{t('overtime.year')}</Label>
                  <Input 
                    type="number" 
                    min="2020" 
                    max="2100" 
                    placeholder={t('export.yearPlaceholder') || "Year"} 
                    value={overtimeSelectedYear} 
                    onChange={e => setOvertimeSelectedYear(e.target.value)} 
                    className="w-full bg-white dark:bg-gray-800" 
                  />
                </div>
              </>
            )}

            {overtimePeriod === "year" && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">{t('overtime.year')}</Label>
                <Input 
                  type="number" 
                  min="2020" 
                  max="2100" 
                  placeholder={t('export.yearPlaceholder') || "Year"} 
                  value={overtimeSelectedYear} 
                  onChange={e => setOvertimeSelectedYear(e.target.value)} 
                  className="w-full bg-white dark:bg-gray-800" 
                />
              </div>
            )}
          </div>

          <Button 
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
            onClick={calculateOvertime}
            disabled={overtimeLoading || (overtimePeriod === "week" && (!overtimeSelectedWeek || !overtimeSelectedYear))}
          >
            {overtimeLoading ? t('overtime.calculating') : t('overtime.calculate')}
          </Button>
        </div>

        {/* Results */}
        {overtimeData && (
          <div className="mt-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-base text-gray-900 dark:text-gray-100">
                    {currentUser?.name || currentUser?.email}
                  </h4>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600 dark:text-gray-400">{t('overtime.totalOvertime')}</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {overtimeData.totalOvertime}h
                  </div>
                </div>
              </div>
              
              {/* Percentage Breakdown */}
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {t('overtime.percentageBreakdown')}
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {parseFloat(overtimeData.totalHours125 || "0") > 0 && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-2">
                      <div className="text-xs text-orange-700 dark:text-orange-300 font-medium">125%</div>
                      <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                        {overtimeData.totalHours125}h
                      </div>
                      <div className="text-xs text-orange-600 dark:text-orange-400">{t('overtime.hours125')}</div>
                    </div>
                  )}
                  {parseFloat(overtimeData.totalHours150 || "0") > 0 && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2">
                      <div className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">150%</div>
                      <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                        {overtimeData.totalHours150}h
                      </div>
                      <div className="text-xs text-yellow-600 dark:text-yellow-400">{t('overtime.hours150')}</div>
                    </div>
                  )}
                  {parseFloat(overtimeData.totalHours200 || "0") > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
                      <div className="text-xs text-red-700 dark:text-red-300 font-medium">200%</div>
                      <div className="text-lg font-bold text-red-600 dark:text-red-400">
                        {overtimeData.totalHours200}h
                      </div>
                      <div className="text-xs text-red-600 dark:text-red-400">{t('overtime.hours200')}</div>
                    </div>
                  )}
                </div>
              </div>
              
              <Accordion type="multiple" className="w-full">
                {overtimeData.dailyOvertime.map((day: any, idx: number) => (
                  <AccordionItem key={idx} value={`day-${idx}`} className="border border-gray-200 dark:border-gray-700 rounded-lg mb-2">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="text-left">
                          <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            {formatDateWithDayName(day.date)}
                            {day.isWeekend && (
                              <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded">
                                {t('overtime.weekend')}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {day.isWeekend ? (
                              <span className="text-orange-600 dark:text-orange-400">
                                {day.totalHours}{t('overtime.totalHours')}
                              </span>
                            ) : (
                              <span>
                                {day.totalHours}{t('overtime.totalHoursNormal', { normalHours: day.normalHours })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            +{day.overtime}h {t('admin.tab.overtime').toLowerCase()}
                          </div>
                          {/* Percentage breakdown for this day */}
                          <div className="flex flex-wrap gap-1 mt-1 justify-end">
                            {parseFloat(day.hours125 || "0") > 0 && (
                              <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded">
                                125%: {day.hours125}h
                              </span>
                            )}
                            {parseFloat(day.hours150 || "0") > 0 && (
                              <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded">
                                150%: {day.hours150}h
                              </span>
                            )}
                            {parseFloat(day.hours200 || "0") > 0 && (
                              <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
                                200%: {day.hours200}h
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="mt-3">
                        {/* Day percentage breakdown */}
                        {(parseFloat(day.hours125 || "0") > 0 || parseFloat(day.hours150 || "0") > 0 || parseFloat(day.hours200 || "0") > 0) && (
                          <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
                            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('overtime.perDayBreakdown')}</div>
                            <div className="flex flex-wrap gap-2">
                              {parseFloat(day.hours125 || "0") > 0 && (
                                <div className="text-xs">
                                  <span className="font-semibold text-orange-600 dark:text-orange-400">125%:</span>
                                  <span className="text-gray-900 dark:text-gray-100 ml-1">{day.hours125}h</span>
                                </div>
                              )}
                              {parseFloat(day.hours150 || "0") > 0 && (
                                <div className="text-xs">
                                  <span className="font-semibold text-yellow-600 dark:text-yellow-400">150%:</span>
                                  <span className="text-gray-900 dark:text-gray-100 ml-1">{day.hours150}h</span>
                                </div>
                              )}
                              {parseFloat(day.hours200 || "0") > 0 && (
                                <div className="text-xs">
                                  <span className="font-semibold text-red-600 dark:text-red-400">200%:</span>
                                  <span className="text-gray-900 dark:text-gray-100 ml-1">{day.hours200}h</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          {t('overtime.details')} ({day.entries?.length || 0} {t('overtime.entries')}):
                        </h5>
                        {isMobile ? (
                          <div className="space-y-2">
                            {day.entries?.map((entry: any, entryIdx: number) => (
                              <div key={entryIdx} className="bg-gray-50 dark:bg-gray-700 rounded p-3 border border-gray-200 dark:border-gray-600">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">{t('overtime.project')}:</span>
                                    <div className="text-gray-900 dark:text-gray-100">{entry.project}</div>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">{t('overtime.workType')}:</span>
                                    <div className="text-gray-900 dark:text-gray-100">{entry.workTypeLabel}</div>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">{t('overtime.time')}:</span>
                                    <div className="text-gray-900 dark:text-gray-100">
                                      {entry.startTime !== "-" && entry.endTime !== "-" 
                                        ? `${entry.startTime} - ${entry.endTime}`
                                        : "-"}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">{t('overtime.hours')}:</span>
                                    <div className="text-gray-900 dark:text-gray-100 font-semibold">{entry.hours}h</div>
                                  </div>
                                  {entry.notes && (
                                    <div className="col-span-2">
                                      <span className="font-semibold text-gray-700 dark:text-gray-300">{t('overtime.notes')}:</span>
                                      <div className="text-gray-900 dark:text-gray-100">{entry.notes}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs border border-gray-300 dark:border-gray-700">
                              <thead className="bg-gray-100 dark:bg-gray-700">
                                <tr>
                                  <th className="p-2 text-left border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('overtime.project')}</th>
                                  <th className="p-2 text-left border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('overtime.workType')}</th>
                                  <th className="p-2 text-left border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('overtime.time')}</th>
                                  <th className="p-2 text-right border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('overtime.hours')}</th>
                                  <th className="p-2 text-left border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('overtime.notes')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {day.entries?.map((entry: any, entryIdx: number) => (
                                  <tr key={entryIdx} className="border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
                                    <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                                      {entry.project}
                                    </td>
                                    <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                                      {entry.workTypeLabel}
                                    </td>
                                    <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                                      {entry.startTime !== "-" && entry.endTime !== "-" 
                                        ? `${entry.startTime} - ${entry.endTime}`
                                        : "-"}
                                    </td>
                                    <td className="p-2 text-right border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 font-semibold">
                                      {entry.hours}h
                                    </td>
                                    <td className="p-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-xs">
                                      {entry.notes || "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        )}
        
        {!overtimeData && !overtimeLoading && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {t('overtime.clickToCalculate')}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserOvertimeView;
