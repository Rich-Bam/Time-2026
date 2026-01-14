import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { BarChart3 } from "lucide-react";
import { formatDateToYYYYMMDD } from "@/utils/dateUtils";

interface OvertimeSummaryPanelProps {
  currentUser: any;
  weekStart: Date; // The start date of the week being viewed
}

// Helper to get week date range from week start date
function getWeekDateRange(weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return {
    from: formatDateToYYYYMMDD(weekStart),
    to: formatDateToYYYYMMDD(weekEnd)
  };
}

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

const OvertimeSummaryPanel = ({ currentUser, weekStart }: OvertimeSummaryPanelProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [overtimeData, setOvertimeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser || !weekStart) return;
    calculateOvertime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, weekStart?.getTime()]);

  const calculateOvertime = async () => {
    if (!currentUser || !weekStart) return;
    
    setLoading(true);
    try {
      const { from, to } = getWeekDateRange(weekStart);

      // Build query - only for current user and the specific week being viewed
      const { data, error } = await supabase
        .from("timesheet")
        .select("user_id, date, hours, description")
        .eq("user_id", currentUser.id)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true });

      if (error) {
        console.error("Error fetching overtime data:", error);
        setOvertimeData(null);
        setLoading(false);
        return;
      }

      // Group entries by date
      const dateMap: Record<string, { totalHours: number }> = {};
      
      (data || []).forEach((entry: any) => {
        const date = entry.date;
        
        if (!dateMap[date]) {
          dateMap[date] = { totalHours: 0 };
        }
        
        // Only count work hours (not day off, sick, etc.)
        // Work types 10-29 and 100 are work hours
        const workType = parseInt(entry.description || "0");
        if ((workType >= 10 && workType <= 29) || workType === 100) {
          const hours = parseFloat(entry.hours || 0);
          dateMap[date].totalHours += hours;
        }
      });

      // Calculate overtime per day with percentage breakdown
      let totalOvertime = 0;
      let totalHours125 = 0;
      let totalHours150 = 0;
      let totalHours200 = 0;
      
      Object.keys(dateMap).forEach(date => {
        const dayData = dateMap[date];
        const totalHours = dayData.totalHours;
        
        // Get day of week (0 = Sunday, 6 = Saturday)
        const dateObj = new Date(date);
        const dayOfWeek = dateObj.getDay();
        const isSaturday = dayOfWeek === 6;
        const isSunday = dayOfWeek === 0;
        
        let overtime = 0;
        let hours125 = 0;
        let hours150 = 0;
        let hours200 = 0;
        
        if (isSunday) {
          // Sunday: ALL hours are 200%
          overtime = totalHours;
          hours200 = totalHours;
        } else if (isSaturday) {
          // Saturday: ALL hours are 150%
          overtime = totalHours;
          hours150 = totalHours;
        } else {
          // Weekday (Monday-Friday): calculate percentage breakdown
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
        
        totalOvertime += overtime;
        totalHours125 += hours125;
        totalHours150 += hours150;
        totalHours200 += hours200;
      });
      
      setOvertimeData({
        totalOvertime: totalOvertime.toFixed(2),
        totalHours125: totalHours125.toFixed(2),
        totalHours150: totalHours150.toFixed(2),
        totalHours200: totalHours200.toFixed(2),
      });
    } catch (error: any) {
      console.error("Error calculating overtime:", error);
      setOvertimeData(null);
    } finally {
      setLoading(false);
    }
  };

  // Show panel even if loading or no overtime (display 0h)
  const displayData = overtimeData || {
    totalOvertime: "0.00",
    totalHours125: "0.00",
    totalHours150: "0.00",
    totalHours200: "0.00",
  };

  return (
    <div className="mb-4 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-sm sm:text-base font-semibold text-blue-800 dark:text-blue-200">
          {t('overtime.title')} - {t('weekly.week')}
        </h3>
      </div>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{t('overtime.totalOvertime')}:</span>
          <span className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">
            {loading ? "..." : `${displayData.totalOvertime}h`}
          </span>
        </div>
        
        {!loading && (
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {parseFloat(displayData.totalHours125 || "0") > 0 && (
              <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded px-2 py-1">
                <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">125%:</span>
                <span className="text-xs sm:text-sm font-bold text-orange-700 dark:text-orange-300">{displayData.totalHours125}h</span>
              </div>
            )}
            {parseFloat(displayData.totalHours150 || "0") > 0 && (
              <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded px-2 py-1">
                <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">150%:</span>
                <span className="text-xs sm:text-sm font-bold text-yellow-700 dark:text-yellow-300">{displayData.totalHours150}h</span>
              </div>
            )}
            {parseFloat(displayData.totalHours200 || "0") > 0 && (
              <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-2 py-1">
                <span className="text-xs font-semibold text-red-600 dark:text-red-400">200%:</span>
                <span className="text-xs sm:text-sm font-bold text-red-700 dark:text-red-300">{displayData.totalHours200}h</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OvertimeSummaryPanel;
