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
  const [capturedScreenshot, setCapturedScreenshot] = useState<Blob | null>(null); // Store captured screenshot

  const handleOpenDialog = async () => {
    // Capture screenshot immediately when button is clicked
    setIsCapturing(true);
    try {
      // Capture the entire page
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        scale: 1,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      });

      // Convert canvas directly to blob using toBlob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, "image/png", 1.0); // PNG format, quality 1.0 (max)
      });

      if (!blob || blob.size === 0) {
        toast({
          title: "Error",
          description: "Could not create screenshot.",
          variant: "destructive",
        });
        setIsCapturing(false);
        return;
      }

      // Verify blob contains PNG data by checking first bytes
      const blobSlice = blob.slice(0, 8);
      const signatureArrayBuffer = await blobSlice.arrayBuffer();
      const uint8Array = new Uint8Array(signatureArrayBuffer);
      const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]; // PNG file signature
      const isPNG = uint8Array.length >= 8 && uint8Array.every((byte, i) => byte === pngSignature[i]);

      if (!isPNG) {
        console.error("Blob does not contain valid PNG data!", { firstBytes: Array.from(uint8Array) });
        toast({
          title: "Error",
          description: "Screenshot data is invalid. Please try again.",
          variant: "destructive",
        });
        setIsCapturing(false);
        return;
      }

      // Ensure blob has correct type
      const typedBlob = blob.type === "image/png" 
        ? blob 
        : new Blob([blob], { type: "image/png" });

      // Store the captured screenshot
      setCapturedScreenshot(typedBlob);
      setIsCapturing(false);
      // Now show the dialog for description
      setShowDialog(true);
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

  const uploadScreenshot = async () => {
    if (!capturedScreenshot) {
      toast({
        title: "Error",
        description: "No screenshot available. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setIsCapturing(true);
    setShowDialog(false);
    try {
      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `screenshot-${currentUser.id}-${timestamp}.png`;

      // Verify the blob is valid PNG before upload
      const verifySlice = capturedScreenshot.slice(0, 8);
      const verifyArrayBuffer = await verifySlice.arrayBuffer();
      const verifyUint8 = new Uint8Array(verifyArrayBuffer);
      const pngSig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
      const isValidPNG = verifyUint8.length >= 8 && verifyUint8.every((byte, i) => byte === pngSig[i]);
      
      if (!isValidPNG) {
        console.error("ScreenshotButton: Blob is not valid PNG before upload!", { firstBytes: Array.from(verifyUint8) });
        toast({
          title: "Error",
          description: "Screenshot data is invalid. Please try again.",
          variant: "destructive",
        });
        setIsCapturing(false);
        setCapturedScreenshot(null);
        return;
      }

      // Convert Blob to ArrayBuffer to avoid multipart form-data wrapping
      // Supabase Storage may wrap File/Blob in FormData, causing it to be stored as multipart
      // ArrayBuffer ensures binary upload without FormData wrapping
      const arrayBuffer = await capturedScreenshot.arrayBuffer();

      // Use Supabase JS client with ArrayBuffer (avoids FormData wrapping)
      const uploadOptions = {
        contentType: "image/png", // Explicitly set
        cacheControl: "3600",
        upsert: false,
      };

      // Upload using ArrayBuffer (avoids FormData wrapping that causes multipart storage)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("screenshots")
        .upload(filename, arrayBuffer, uploadOptions);

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
      setCapturedScreenshot(null); // Clear captured screenshot
    } catch (error: any) {
      console.error("Screenshot capture/upload error:", error);
      toast({
        title: "Error",
        description: error.message || "Could not create or save screenshot.",
        variant: "destructive",
      });
    } finally {
      setIsCapturing(false);
    }
  };

  // Show button for all logged-in users
  if (!currentUser) {
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
              The screenshot has already been captured. Add a description of the problem (optional).
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
            <Button variant="outline" onClick={() => { 
              setShowDialog(false); 
              setDescription(""); 
              setCapturedScreenshot(null); // Clear captured screenshot on cancel
            }}>
              Cancel
            </Button>
            <Button onClick={uploadScreenshot} disabled={isCapturing}>
              {isCapturing ? "Uploading..." : "Save Bug Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ScreenshotButton;

