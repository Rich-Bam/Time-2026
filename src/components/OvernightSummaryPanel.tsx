import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Moon } from "lucide-react";
import { formatDateToYYYYMMDD } from "@/utils/dateUtils";

interface OvernightSummaryPanelProps {
  currentUser: any;
  weekStart: Date;
}

function getWeekDateRange(weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return {
    from: formatDateToYYYYMMDD(weekStart),
    to: formatDateToYYYYMMDD(weekEnd),
  };
}

const OvernightSummaryPanel = ({ currentUser, weekStart }: OvernightSummaryPanelProps) => {
  const { t } = useLanguage();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser || !weekStart) return;
    const fetchCount = async () => {
      setLoading(true);
      try {
        const { from, to } = getWeekDateRange(weekStart);
        const { data, error } = await supabase
          .from("overnight_stays")
          .select("date")
          .eq("user_id", currentUser.id)
          .gte("date", from)
          .lte("date", to);
        if (error) {
          console.warn("Error fetching overnight stays:", error);
          setCount(0);
          return;
        }
        setCount((data || []).length);
      } finally {
        setLoading(false);
      }
    };
    fetchCount();
  }, [currentUser, weekStart?.getTime()]);

  return (
    <div className="mb-4 p-3 sm:p-4 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Moon className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400" />
        <h3 className="text-sm sm:text-base font-semibold text-indigo-800 dark:text-indigo-200">
          {t("overtime.overnightTitle")} - {t("weekly.week")}
        </h3>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{t("overtime.overnightCount")}:</span>
        <span className="text-lg sm:text-xl font-bold text-indigo-700 dark:text-indigo-300">
          {loading ? "..." : count}
        </span>
      </div>
    </div>
  );
};

export default OvernightSummaryPanel;

