import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Camera, Image as ImageIcon, Trash2, RefreshCw } from "lucide-react";

interface BugReportsProps {
  currentUser: any;
}

const BugReports = ({ currentUser }: BugReportsProps) => {
  const { toast } = useToast();
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [loadingScreenshots, setLoadingScreenshots] = useState(false);

  const SUPER_ADMIN_EMAIL = "r.blance@bampro.nl";
  const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL;
  
  // Debug logging
  React.useEffect(() => {
    console.log("BugReports: currentUser:", currentUser);
    console.log("BugReports: isSuperAdmin:", isSuperAdmin);
    console.log("BugReports: currentUser?.email:", currentUser?.email);
    console.log("BugReports: SUPER_ADMIN_EMAIL:", SUPER_ADMIN_EMAIL);
  }, [currentUser, isSuperAdmin]);

  // Fetch screenshots
  const fetchScreenshots = async () => {
    if (!isSuperAdmin) {
      console.log("BugReports: Not super admin, skipping fetch");
      return;
    }
    console.log("BugReports: Fetching screenshots...");
    console.log("BugReports: Current user email:", currentUser?.email);
    setLoadingScreenshots(true);
    
    // Try to fetch screenshots
    const { data, error, count } = await supabase
      .from("screenshots")
      .select("*", { count: 'exact' })
      .order("created_at", { ascending: false })
      .limit(100); // Show last 100 screenshots
      
    console.log("BugReports: Query result:", { data, error, count });
    
    if (error) {
      console.error("Error fetching screenshots:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      if (!error.message.includes("does not exist")) {
        toast({ 
          title: "Error Fetching Screenshots", 
          description: error.message || "Could not fetch screenshots. Check browser console (F12) for details.",
          variant: "destructive" 
        });
      }
    } else {
      console.log("BugReports: Fetched screenshots:", data?.length || 0, "screenshots");
      console.log("BugReports: Screenshot data:", data);
      setScreenshots(data || []);
      if (data && data.length > 0) {
        toast({
          title: "Screenshots Loaded",
          description: `${data.length} bug report(s) found.`,
        });
      }
    }
    setLoadingScreenshots(false);
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchScreenshots();
      // Refresh every 30 seconds to catch new screenshots
      const interval = setInterval(fetchScreenshots, 30000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center text-red-600 font-semibold">
        You do not have access to this page. Only the super admin can view bug reports.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 bg-white rounded shadow w-full max-w-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Camera className="h-6 w-6 text-orange-600" />
            Bug Reports
          </h2>
          <p className="text-gray-600 mt-2">
            Screenshots made by admins to report bugs.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchScreenshots}
          disabled={loadingScreenshots}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loadingScreenshots ? 'animate-spin' : ''}`} />
          {loadingScreenshots ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {loadingScreenshots ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : screenshots.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border rounded-lg bg-gray-50">
          <ImageIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p className="font-semibold">No bug reports received yet.</p>
          <p className="text-sm mt-1">Admins can create bug reports using the "Report Bug" button in the header.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {screenshots.map((screenshot) => (
            <div key={screenshot.id} className="border rounded-lg p-4 bg-white shadow hover:shadow-lg transition-shadow">
              <div className="mb-2">
                <div className="text-sm font-semibold text-gray-700">
                  {screenshot.user_name || screenshot.user_email}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(screenshot.created_at).toLocaleString('en-US')}
                </div>
              </div>
              {screenshot.description && (
                <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded text-sm text-gray-700">
                  <div className="font-semibold text-orange-800 mb-1">Description:</div>
                  <div className="text-gray-700 whitespace-pre-wrap">{screenshot.description}</div>
                </div>
              )}
              <div className="mb-3">
                <a
                  href={screenshot.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img
                    src={screenshot.url}
                    alt={`Screenshot from ${screenshot.user_name || screenshot.user_email}`}
                    className="w-full h-auto rounded border cursor-pointer hover:opacity-90 transition-opacity"
                    loading="lazy"
                  />
                </a>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(screenshot.url, '_blank')}
                  className="flex-1"
                >
                  Open Full
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    if (confirm(`Are you sure you want to delete this bug report?`)) {
                      // Delete from storage
                      const { error: storageError } = await supabase.storage
                        .from("screenshots")
                        .remove([screenshot.filename]);
                      
                      // Delete from database
                      const { error: dbError } = await supabase
                        .from("screenshots")
                        .delete()
                        .eq("id", screenshot.id);
                      
                      if (storageError || dbError) {
                        toast({
                          title: "Error",
                          description: storageError?.message || dbError?.message || "Could not delete bug report",
                          variant: "destructive",
                        });
                      } else {
                        toast({ title: "Bug Report Deleted" });
                        fetchScreenshots();
                      }
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BugReports;

