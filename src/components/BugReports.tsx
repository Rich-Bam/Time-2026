import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, ExternalLink, Calendar, User, FileText, Check } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

interface BugReportsProps {
  currentUser: any;  // Effective user (for view / view-as)
  realCurrentUser?: any;  // Actual logged-in user (for real-time notifications - only super admin gets them)
}

interface BugReport {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  filename: string;
  url: string;
  description: string | null;
  created_at: string;
  admin_viewed?: boolean;
  admin_comment?: string | null;
  admin_comment_at?: string | null;
}

const BugReports = ({ currentUser, realCurrentUser }: BugReportsProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<BugReport | null>(null);
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [reportToAccept, setReportToAccept] = useState<BugReport | null>(null);
  const [acceptComment, setAcceptComment] = useState("");
  const lastBugReportIdRef = useRef<string | null>(null);

  const SUPER_ADMIN_EMAIL = "r.blance@bampro.nl";
  const actualUser = realCurrentUser ?? currentUser;
  const isSuperAdmin = actualUser?.email === SUPER_ADMIN_EMAIL;
  const isAdminView = currentUser?.isAdmin || currentUser?.userType === "super_admin";

  // Fetch bug reports from screenshots table
  const fetchBugReports = async () => {
    setLoading(true);
    try {
      console.log("BugReports: Fetching bug reports from screenshots table...");
      let query = supabase.from("screenshots").select("*").order("created_at", { ascending: false });
      if (!isAdminView && currentUser?.id) {
        query = query.eq("user_id", currentUser.id);
      }
      const { data, error } = await query;

      if (error) {
        console.error("BugReports: Error fetching bug reports:", error);
        // Check if table doesn't exist
        if (error.message?.includes("does not exist") || error.message?.includes("relation")) {
          toast({
            title: "Table Not Found",
            description: "The 'screenshots' table does not exist. Please create it in Supabase.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: error.message || "Failed to load bug reports.",
            variant: "destructive",
          });
        }
        setBugReports([]);
      } else {
        console.log("BugReports: Successfully fetched bug reports:", data?.length || 0);
        setBugReports(data || []);
        // Update the ref with the latest bug report ID
        if (data && data.length > 0) {
          lastBugReportIdRef.current = data[0].id;
        }
        if (data && data.length === 0) {
          console.log("BugReports: No bug reports found in database");
        }
      }
    } catch (error: any) {
      console.error("BugReports: Exception fetching bug reports:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load bug reports.",
        variant: "destructive",
      });
      setBugReports([]);
    } finally {
      setLoading(false);
    }
  };

  // Real-time subscription for new bug reports (only for super admin)
  useEffect(() => {
    if (!isSuperAdmin) {
      console.log("BugReports: Not super admin, skipping real-time subscription");
      return;
    }

    console.log("BugReports: Setting up real-time subscription for super admin");

    // Initialize last bug report ID from current reports
    if (bugReports.length > 0 && !lastBugReportIdRef.current) {
      lastBugReportIdRef.current = bugReports[0].id;
    }

    const channel = supabase
      .channel('bug-reports-changes', {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'screenshots',
        },
        async (payload) => {
          console.log("BugReports: Real-time INSERT event received:", payload);
          const newReport = payload.new as BugReport;
          // Only show notification if:
          // 1. The report is not from the super admin themselves
          // 2. The report has not been viewed yet (admin_viewed is false or null)
          if (newReport.user_email !== SUPER_ADMIN_EMAIL && !newReport.admin_viewed) {
            console.log("BugReports: New unviewed bug report from", newReport.user_email);
            toast({
              title: "New Bug Report",
              description: `${newReport.user_name || newReport.user_email} heeft een nieuwe bug report ingediend${newReport.description ? `: ${newReport.description.substring(0, 50)}${newReport.description.length > 50 ? '...' : ''}` : ''}`,
              duration: 10000, // Show for 10 seconds
            });
            // Refresh the bug reports list
            await fetchBugReports();
          } else {
            console.log("BugReports: Bug report ignored (from super admin or already viewed)");
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'screenshots',
        },
        async (payload) => {
          console.log("BugReports: Real-time UPDATE event received:", payload);
          // Refresh the bug reports list when a report is updated (e.g., marked as viewed)
          await fetchBugReports();
        }
      )
      .subscribe((status) => {
        console.log("BugReports: Subscription status:", status);
        if (status === 'SUBSCRIBED') {
          console.log("BugReports: Successfully subscribed to real-time updates");
        } else if (status === 'CHANNEL_ERROR') {
          console.error("BugReports: Channel error, real-time may not be enabled");
          toast({
            title: "Real-time Error",
            description: "Real-time updates may not be enabled. Checking for new reports every 30 seconds...",
            variant: "destructive",
            duration: 5000,
          });
        }
      });

    // Fallback: Poll for new bug reports every 30 seconds if real-time doesn't work
    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from("screenshots")
          .select("id, created_at, admin_viewed, user_email")
          .order("created_at", { ascending: false })
          .limit(1);
        
        if (!error && data && data.length > 0) {
          const latestReport = data[0];
          const latestId = latestReport.id;
          if (latestId !== lastBugReportIdRef.current) {
            // Only show notification if not from super admin and not yet viewed
            if (latestReport.user_email !== SUPER_ADMIN_EMAIL && !latestReport.admin_viewed) {
              console.log("BugReports: New unviewed bug report detected via polling");
              // Fetch full details and show notification
              const { data: fullData } = await supabase
                .from("screenshots")
                .select("*")
                .eq("id", latestId)
                .single();
              
              if (fullData) {
                toast({
                  title: "New Bug Report",
                  description: `${fullData.user_name || fullData.user_email} heeft een nieuwe bug report ingediend${fullData.description ? `: ${fullData.description.substring(0, 50)}${fullData.description.length > 50 ? '...' : ''}` : ''}`,
                  duration: 10000,
                });
                await fetchBugReports();
                lastBugReportIdRef.current = latestId;
              }
            }
          }
        }
      } catch (error: any) {
        console.error("BugReports: Error polling for new reports:", error);
      }
    }, 30000); // Poll every 30 seconds

    return () => {
      console.log("BugReports: Cleaning up real-time subscription");
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [isSuperAdmin, toast]);

  // Fetch bug reports on mount and when user/view changes
  useEffect(() => {
    fetchBugReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminView, currentUser?.id]);

  const handleOpenAcceptDialog = (report: BugReport) => {
    setReportToAccept(report);
    setAcceptComment("");
    setAcceptDialogOpen(true);
  };

  const handleAcceptWithComment = async () => {
    if (!reportToAccept) return;
    const comment = acceptComment?.trim() || null;
    const now = comment ? new Date().toISOString() : null;
    try {
      const { error } = await supabase
        .from("screenshots")
        .update({
          admin_viewed: true,
          admin_comment: comment,
          admin_comment_at: now,
        })
        .eq("id", reportToAccept.id);

      if (error) {
        if (error.message?.includes("admin_viewed") || error.message?.includes("admin_comment") || error.message?.includes("column") || error.message?.includes("schema cache")) {
          toast({
            title: "Database Schema Error",
            description: "De benodigde kolommen bestaan nog niet. Voer het SQL script 'add_admin_comment_to_screenshots.sql' uit in Supabase SQL Editor.",
            variant: "destructive",
            duration: 15000,
          });
          return;
        }
        throw error;
      }

      setBugReports(bugReports.map(r =>
        r.id === reportToAccept.id
          ? { ...r, admin_viewed: true, admin_comment: comment, admin_comment_at: now }
          : r
      ));
      setAcceptDialogOpen(false);
      setReportToAccept(null);
      setAcceptComment("");

      toast({
        title: "Bug Report Accepted",
        description: comment ? t("bugReport.acceptedWithCommentToast") : "The bug report has been marked as viewed and will no longer show notifications.",
      });
    } catch (error: any) {
      console.error("Error accepting bug report:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept bug report.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!reportToDelete) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("screenshots")
        .remove([reportToDelete.filename]);

      if (storageError) {
        console.warn("Error deleting from storage:", storageError);
        // Continue anyway - might already be deleted
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("screenshots")
        .delete()
        .eq("id", reportToDelete.id);

      if (dbError) {
        throw dbError;
      }

      // Remove from local state
      setBugReports(bugReports.filter(r => r.id !== reportToDelete.id));
      setDeleteConfirmOpen(false);
      setReportToDelete(null);

      toast({
        title: "Bug Report Deleted",
        description: "The bug report has been successfully deleted.",
      });
    } catch (error: any) {
      console.error("Error deleting bug report:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete bug report.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleViewReport = (report: BugReport) => {
    setSelectedReport(report);
    setViewDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{isAdminView ? "Bug Reports" : t("bugReport.myReports")}</CardTitle>
          <CardDescription>
            {isAdminView ? t("View.manage") : t("bugReport.myReportsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">Loading bug reports...</div>
          ) : bugReports.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">No bug reports found.</div>
          ) : (
            <div className="space-y-4">
              {bugReports.map((report) => (
                <div
                  key={report.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800 dark:border-gray-700"
                >
                  <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-4`}>
                    <div className="flex-1">
                      {isAdminView && (
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {report.user_name || report.user_email}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {report.user_email}
                          </Badge>
                        </div>
                      )}
                      {report.description && (
                        <div className="flex items-start gap-2 mb-2">
                          <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-0.5" />
                          <p className="text-sm text-gray-700 dark:text-gray-300">{report.description}</p>
                        </div>
                      )}
                      {!isAdminView && (
                        <div className="mb-2">
                          <Badge
                            variant="outline"
                            className={report.admin_viewed
                              ? "border-green-200 dark:border-green-700 text-green-700 dark:text-green-300"
                              : "border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300"}
                          >
                            {report.admin_viewed ? t("bugReport.statusAccepted") : t("bugReport.statusPending")}
                          </Badge>
                        </div>
                      )}
                      {!isAdminView && report.admin_viewed && report.admin_comment && (
                        <div className="mt-2 p-3 rounded-md bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t("bugReport.adminFeedback")}</h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{report.admin_comment}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(report.created_at)}</span>
                      </div>
                    </div>
                    <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-2`}>
                      {!report.admin_viewed && isSuperAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAcceptDialog(report)}
                          className="border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/40"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          {t("share.accept") || "Accept"}
                        </Button>
                      )}
                      {report.admin_viewed && isSuperAdmin && (
                        <Badge variant="outline" className="text-xs border-green-200 dark:border-green-700 text-green-700 dark:text-green-300">
                          <Check className="h-3 w-3 mr-1" />
                          Accepted
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewReport(report)}
                        className="border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/40"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      {isAdminView && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReportToDelete(report);
                            setDeleteConfirmOpen(true);
                          }}
                          className="border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Report Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Bug Report Details</DialogTitle>
            <DialogDescription>
              Submitted by {selectedReport?.user_name || selectedReport?.user_email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedReport?.description && (
              <div>
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Description:</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">{selectedReport.description}</p>
              </div>
            )}
            {selectedReport?.admin_viewed && selectedReport?.admin_comment && (
              <div className="p-3 rounded-md bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">{t("bugReport.adminFeedback")}</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">{selectedReport.admin_comment}</p>
              </div>
            )}
            <div>
              <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Screenshot:</h4>
              {selectedReport?.url && (
                <img
                  src={selectedReport.url}
                  alt="Bug report screenshot"
                  className="max-w-full h-auto border rounded-lg"
                />
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Submitted: {selectedReport && formatDate(selectedReport.created_at)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              {t("common.close") || "Close"}
            </Button>
            {selectedReport?.url && (
              <Button
                variant="default"
                onClick={() => window.open(selectedReport.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept with Comment Dialog */}
      <Dialog open={acceptDialogOpen} onOpenChange={(open) => {
        setAcceptDialogOpen(open);
        if (!open) {
          setReportToAccept(null);
          setAcceptComment("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("bugReport.acceptWithComment")}</DialogTitle>
            <DialogDescription>
              {reportToAccept?.description ? (
                <span className="block mt-2 text-sm text-gray-600 dark:text-gray-400">{reportToAccept.description}</span>
              ) : (
                t("bugReport.adminComment")
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="accept-comment">{t("bugReport.adminComment")}</Label>
              <Textarea
                id="accept-comment"
                value={acceptComment}
                onChange={(e) => setAcceptComment(e.target.value)}
                placeholder={t("bugReport.adminCommentPlaceholder") || "Optional message for the reporter..."}
                className="mt-2 min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAcceptDialogOpen(false);
              setReportToAccept(null);
              setAcceptComment("");
            }}>
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button
              onClick={handleAcceptWithComment}
              className="border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/40"
            >
              <Check className="h-4 w-4 mr-2" />
              {t("share.accept") || "Accept"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bug Report</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this bug report? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BugReports;
