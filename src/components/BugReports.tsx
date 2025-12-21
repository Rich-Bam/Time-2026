import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, ExternalLink, Calendar, User, FileText } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface BugReportsProps {
  currentUser: any;
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
}

const BugReports = ({ currentUser }: BugReportsProps) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<BugReport | null>(null);
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  // Fetch bug reports from screenshots table
  useEffect(() => {
    const fetchBugReports = async () => {
      setLoading(true);
      try {
        console.log("BugReports: Fetching bug reports from screenshots table...");
        const { data, error } = await supabase
          .from("screenshots")
          .select("*")
          .order("created_at", { ascending: false });

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

    fetchBugReports();
  }, [toast]);

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
          <CardTitle>Bug Reports</CardTitle>
          <CardDescription>View and manage bug reports submitted by users</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-sm text-gray-500">Loading bug reports...</div>
          ) : bugReports.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">No bug reports found.</div>
          ) : (
            <div className="space-y-4">
              {bugReports.map((report) => (
                <div
                  key={report.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                >
                  <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-4`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="font-semibold text-gray-900">
                          {report.user_name || report.user_email}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {report.user_email}
                        </Badge>
                      </div>
                      {report.description && (
                        <div className="flex items-start gap-2 mb-2">
                          <FileText className="h-4 w-4 text-gray-500 mt-0.5" />
                          <p className="text-sm text-gray-700">{report.description}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(report.created_at)}</span>
                      </div>
                    </div>
                    <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-2`}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewReport(report)}
                        className="border-blue-200 text-blue-700 hover:bg-blue-50"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReportToDelete(report);
                          setDeleteConfirmOpen(true);
                        }}
                        className="border-red-200 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
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
                <h4 className="font-semibold mb-2">Description:</h4>
                <p className="text-sm text-gray-700">{selectedReport.description}</p>
              </div>
            )}
            <div>
              <h4 className="font-semibold mb-2">Screenshot:</h4>
              {selectedReport?.url && (
                <img
                  src={selectedReport.url}
                  alt="Bug report screenshot"
                  className="max-w-full h-auto border rounded-lg"
                />
              )}
            </div>
            <div className="text-xs text-gray-500">
              Submitted: {selectedReport && formatDate(selectedReport.created_at)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
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
