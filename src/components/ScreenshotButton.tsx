import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import html2canvas from "html2canvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ScreenshotButtonProps {
  currentUser: any;
  floating?: boolean; // If true, renders as a floating button
}

const ScreenshotButton = ({ currentUser, floating = false }: ScreenshotButtonProps) => {
  const { toast } = useToast();
  const [isCapturing, setIsCapturing] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [description, setDescription] = useState("");

  const handleOpenDialog = () => {
    if (!currentUser?.isAdmin) {
      toast({
        title: "No Access",
        description: "Only admins can create bug reports.",
        variant: "destructive",
      });
      return;
    }
    setShowDialog(true);
  };

  const captureScreenshot = async () => {
    setIsCapturing(true);
    setShowDialog(false);
    try {
      // Capture the entire page
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        scale: 1,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      });

      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast({
            title: "Error",
            description: "Could not create screenshot.",
            variant: "destructive",
          });
          setIsCapturing(false);
          return;
        }

        try {
          // Generate unique filename
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const filename = `screenshot-${currentUser.id}-${timestamp}.png`;

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("screenshots")
            .upload(filename, blob, {
              contentType: "image/png",
              upsert: false,
            });

          if (uploadError) {
            // If bucket doesn't exist, create it first (this will fail but we'll handle it)
            if (uploadError.message.includes("Bucket not found")) {
              toast({
                title: "Storage Bucket Missing",
                description: "The 'screenshots' bucket does not exist. Create it in Supabase Dashboard → Storage.",
                variant: "destructive",
              });
              setIsCapturing(false);
              return;
            }
            throw uploadError;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("screenshots")
            .getPublicUrl(filename);

          // Save metadata to database
          const screenshotData = {
            user_id: currentUser.id,
            user_email: currentUser.email,
            user_name: currentUser.name,
            filename: filename,
            storage_path: uploadData.path,
            url: urlData.publicUrl,
            description: description.trim() || null,
            created_at: new Date().toISOString(),
          };
          console.log("ScreenshotButton: Saving to database:", screenshotData);
          
          const { data: insertedData, error: dbError } = await supabase.from("screenshots").insert(screenshotData).select();

          if (dbError) {
            console.error("ScreenshotButton: Database error:", dbError);
            // If table doesn't exist, show helpful message
            if (dbError.message.includes("relation") && dbError.message.includes("does not exist")) {
              toast({
                title: "Database Table Missing",
                description: "The 'screenshots' table does not exist. Create it in Supabase Dashboard → SQL Editor.",
                variant: "destructive",
              });
            } else {
              throw dbError;
            }
            setIsCapturing(false);
            return;
          }

          console.log("ScreenshotButton: Successfully saved screenshot:", insertedData);
          toast({
            title: "Screenshot Saved",
            description: "The screenshot has been successfully saved and is visible to the super admin.",
          });
          setDescription(""); // Reset description
        } catch (error: any) {
          console.error("Screenshot upload error:", error);
          toast({
            title: "Error Saving",
            description: error.message || "Could not save screenshot.",
            variant: "destructive",
          });
        } finally {
          setIsCapturing(false);
        }
      }, "image/png");
    } catch (error: any) {
      console.error("Screenshot capture error:", error);
      toast({
        title: "Error",
        description: error.message || "Could not create screenshot.",
        variant: "destructive",
      });
      setIsCapturing(false);
    }
  };

  // Always show button for debugging - will check admin status on click
  // Remove this check if you want button always visible
  if (!currentUser?.isAdmin) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size={floating ? "default" : "sm"}
        onClick={handleOpenDialog}
        disabled={isCapturing}
        className={floating 
          ? "border-orange-200 text-orange-700 hover:bg-orange-50 shadow-lg hover:shadow-xl transition-shadow" 
          : "border-orange-200 text-orange-700 hover:bg-orange-50"}
        title="Make a screenshot (for bug reports)"
      >
        <Camera className={`${floating ? "h-5 w-5" : "h-4 w-4"} mr-2`} />
        {isCapturing ? "Processing..." : "Report Bug"}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Bug Report</DialogTitle>
            <DialogDescription>
              Add a description of the problem (optional). The screenshot will be taken automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe the problem you see..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setDescription(""); }}>
              Cancel
            </Button>
            <Button onClick={captureScreenshot} disabled={isCapturing}>
              {isCapturing ? "Processing..." : "Take Screenshot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ScreenshotButton;

