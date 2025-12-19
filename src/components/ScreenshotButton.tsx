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
}

const ScreenshotButton = ({ currentUser }: ScreenshotButtonProps) => {
  const { toast } = useToast();
  const [isCapturing, setIsCapturing] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [description, setDescription] = useState("");

  const handleOpenDialog = () => {
    if (!currentUser?.isAdmin) {
      toast({
        title: "Geen toegang",
        description: "Alleen admins kunnen screenshots maken.",
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
            title: "Fout",
            description: "Kon screenshot niet maken.",
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
                title: "Storage Bucket Ontbreekt",
                description: "De 'screenshots' bucket bestaat nog niet. Maak deze aan in Supabase Dashboard → Storage.",
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
                title: "Database Tabel Ontbreekt",
                description: "De 'screenshots' tabel bestaat nog niet. Maak deze aan in Supabase Dashboard → SQL Editor.",
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
            title: "Screenshot Opgeslagen",
            description: "De screenshot is succesvol opgeslagen en is zichtbaar voor de super admin.",
          });
          setDescription(""); // Reset description
        } catch (error: any) {
          console.error("Screenshot upload error:", error);
          toast({
            title: "Fout bij Opslaan",
            description: error.message || "Kon screenshot niet opslaan.",
            variant: "destructive",
          });
        } finally {
          setIsCapturing(false);
        }
      }, "image/png");
    } catch (error: any) {
      console.error("Screenshot capture error:", error);
      toast({
        title: "Fout",
        description: error.message || "Kon screenshot niet maken.",
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
        size="sm"
        onClick={handleOpenDialog}
        disabled={isCapturing}
        className="border-orange-200 text-orange-700 hover:bg-orange-50"
        title="Maak een screenshot (voor bug reports)"
      >
        <Camera className="h-4 w-4 mr-2" />
        {isCapturing ? "Bezig..." : "Report Bug"}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bug Report Maken</DialogTitle>
            <DialogDescription>
              Voeg een beschrijving toe van het probleem (optioneel). De screenshot wordt automatisch gemaakt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="description">Beschrijving (optioneel)</Label>
              <Textarea
                id="description"
                placeholder="Beschrijf het probleem dat je ziet..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setDescription(""); }}>
              Annuleren
            </Button>
            <Button onClick={captureScreenshot} disabled={isCapturing}>
              {isCapturing ? "Bezig..." : "Screenshot Maken"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ScreenshotButton;

