import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { hashPassword } from "@/utils/password";
import { User, Camera, Phone, Save, X, Download } from "lucide-react";
import { usePWAInstall } from "@/components/InstallPWA";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ProfileProps {
  currentUser: any;
  setCurrentUser: (user: any) => void;
}

const Profile = ({ currentUser, setCurrentUser }: ProfileProps) => {
  const { toast } = useToast();
  const { canInstall, handleInstall } = usePWAInstall();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect device type for better instructions
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isDesktop = !isIOS && !isAndroid;

  const handleInstallClick = async () => {
    const promptShown = await handleInstall();
    // If no native prompt was shown, show our instructions dialog
    if (!promptShown) {
      setShowInstallDialog(true);
    }
  };

  // Load user data
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || "");
      setEmail(currentUser.email || "");
      setPhoneNumber(currentUser.phone_number || "");
      setPhotoUrl(currentUser.photo_url || "");
    }
  }, [currentUser]);

  // Load user data from database to get latest values
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser?.id) return;
      
      const { data, error } = await supabase
        .from("users")
        .select("name, email, phone_number, photo_url")
        .eq("id", currentUser.id)
        .single();

      if (data && !error) {
        setName(data.name || "");
        setEmail(data.email || "");
        setPhoneNumber(data.phone_number || "");
        setPhotoUrl(data.photo_url || "");
      }
    };

    loadUserData();
  }, [currentUser?.id]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingPhoto(true);

    try {
      // Delete old photo if exists
      if (photoUrl) {
        try {
          // Extract the path from the full URL
          const urlParts = photoUrl.split('/');
          const pathIndex = urlParts.findIndex(part => part === 'profile-photos');
          if (pathIndex !== -1 && pathIndex < urlParts.length - 1) {
            // Get the path after 'profile-photos'
            const pathAfterBucket = urlParts.slice(pathIndex + 1).join('/');
            await supabase.storage
              .from("profile-photos")
              .remove([pathAfterBucket]);
          }
        } catch (err) {
          console.log("Could not delete old photo:", err);
        }
      }

      // Generate unique filename with user ID prefix to ensure it's user-specific
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${currentUser.id}/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        // If bucket doesn't exist, show helpful error
        if (uploadError.message.includes("Bucket not found")) {
          toast({
            title: "Storage bucket missing",
            description: "The 'profile-photos' bucket doesn't exist. Please create it in Supabase Dashboard → Storage.",
            variant: "destructive",
          });
          setUploadingPhoto(false);
          return;
        }
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(filePath);

      // Update user record with photo URL
      const { error: updateError } = await supabase
        .from("users")
        .update({ photo_url: urlData.publicUrl })
        .eq("id", currentUser.id);

      if (updateError) {
        throw updateError;
      }

      setPhotoUrl(urlData.publicUrl);
      setCurrentUser({ ...currentUser, photo_url: urlData.publicUrl });
      
      toast({
        title: "Photo uploaded",
        description: "Your profile photo has been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = async () => {
    if (!photoUrl) return;

    try {
      // Delete from storage - extract path from URL
      const urlParts = photoUrl.split('/');
      const pathIndex = urlParts.findIndex(part => part === 'profile-photos');
      if (pathIndex !== -1 && pathIndex < urlParts.length - 1) {
        // Get the path after 'profile-photos'
        const pathAfterBucket = urlParts.slice(pathIndex + 1).join('/');
        await supabase.storage
          .from("profile-photos")
          .remove([pathAfterBucket]);
      }

      // Update user record
      const { error } = await supabase
        .from("users")
        .update({ photo_url: null })
        .eq("id", currentUser.id);

      if (error) throw error;

      setPhotoUrl("");
      setCurrentUser({ ...currentUser, photo_url: null });
      
      toast({
        title: "Photo removed",
        description: "Your profile photo has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove photo. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updates: any = {
        name: name.trim(),
        phone_number: phoneNumber.trim() || null,
      };

      // Update password if provided
      if (password) {
        if (password.length < 6) {
          toast({
            title: "Password too short",
            description: "Password must be at least 6 characters long.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          toast({
            title: "Passwords do not match",
            description: "Please make sure both password fields match.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const hashedPassword = await hashPassword(password);
        updates.password = hashedPassword;
        updates.must_change_password = false;
      }

      const { error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", currentUser.id);

      if (error) throw error;

      // Update local user state
      const updatedUser = {
        ...currentUser,
        name: updates.name,
        phone_number: updates.phone_number,
        must_change_password: updates.must_change_password || currentUser.must_change_password,
      };
      setCurrentUser(updatedUser);

      // Clear password fields
      setPassword("");
      setConfirmPassword("");

      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Settings
          </CardTitle>
          <CardDescription>
            Manage your profile information, photo, and password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Profile Photo Section */}
            <div className="space-y-4">
              <Label>Profile Photo</Label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300">
                      <User className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="photo-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="w-fit"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {uploadingPhoto ? "Uploading..." : photoUrl ? "Change Photo" : "Upload Photo"}
                  </Button>
                  {photoUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemovePhoto}
                      className="w-fit text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remove Photo
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Name Section */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>

            {/* Email Section (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500">Email cannot be changed. Contact an administrator if you need to change your email.</p>
            </div>

            {/* Phone Number Section */}
            <div className="space-y-2">
              <Label htmlFor="phone">
                <Phone className="h-4 w-4 inline mr-1" />
                Mobile Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+31 6 12345678"
              />
              <p className="text-xs text-gray-500">Optional: Add your mobile phone number</p>
            </div>

            {/* Password Section */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Change Password</h3>
              <p className="text-sm text-gray-500">Leave blank if you don't want to change your password</p>
              
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  minLength={6}
                />
                {password && password.length > 0 && password.length < 6 && (
                  <p className="text-xs text-red-500">Password must be at least 6 characters long.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  minLength={6}
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-500">Passwords do not match.</p>
                )}
              </div>
            </div>

            {/* Install App Section */}
            {canInstall && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold">Install App</h3>
                <p className="text-sm text-gray-500">
                  Install BAMPRO Uren on your device for quick access and offline functionality.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleInstallClick}
                  className="w-full sm:w-auto border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Install App on Device
                </Button>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={loading || !name.trim()}
                className="min-w-[120px]"
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Install Instructions Dialog */}
      <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-orange-600" />
              Install BAMPRO Uren App
            </DialogTitle>
            <DialogDescription>
              Follow these steps to install the app on your device:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isIOS ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-orange-600 dark:text-orange-400 font-semibold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Tap the Share button</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Look for the share icon (square with arrow pointing up) in Safari's toolbar
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-orange-600 dark:text-orange-400 font-semibold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Select "Add to Home Screen"</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Scroll down in the share menu and tap "Add to Home Screen"
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-orange-600 dark:text-orange-400 font-semibold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Confirm installation</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Tap "Add" in the top right corner. The app will appear on your home screen.
                    </p>
                  </div>
                </div>
              </div>
            ) : isAndroid ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-orange-600 dark:text-orange-400 font-semibold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Open browser menu</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Tap the three dots (⋮) in the top right corner of Chrome or Edge
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-orange-600 dark:text-orange-400 font-semibold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Select "Add to Home screen" or "Install app"</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Look for "Add to Home screen" or "Install app" in the menu
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-orange-600 dark:text-orange-400 font-semibold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Confirm installation</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Tap "Install" or "Add" to confirm. The app will appear on your home screen.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-orange-600 dark:text-orange-400 font-semibold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Look for the install icon</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      In Chrome or Edge, look for an install icon (⊕) in the address bar
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-orange-600 dark:text-orange-400 font-semibold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Or use the browser menu</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Go to Menu (⋮) → "Install BAMPRO Uren" or "Apps" → "Install this site as an app"
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-orange-600 dark:text-orange-400 font-semibold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Confirm installation</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Click "Install" in the popup. The app will open in its own window.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="pt-4 border-t">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                After installation, you can access the app from your home screen or app launcher.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setShowInstallDialog(false)}>
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;

