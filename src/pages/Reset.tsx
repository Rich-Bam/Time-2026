import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { hashPassword } from "@/utils/password";

const Reset = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [passwordReset, setPasswordReset] = useState(false);

  // Try to get access_token and refresh_token from query or hash
  useEffect(() => {
    let token = searchParams.get("access_token");
    let refresh = searchParams.get("refresh_token");
    
    if (!token && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      token = hashParams.get("access_token");
      refresh = hashParams.get("refresh_token");
    }
    setAccessToken(token);
    setRefreshToken(refresh);
  }, [searchParams]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    
    if (!newPassword || newPassword.length < 6) {
      setMessage("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      setLoading(false);
      return;
    }
    
    if (!accessToken) {
      setMessage("Missing or invalid access token.");
      setLoading(false);
      return;
    }
    
    try {
      // Set the session with the access token so updateUser works
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || accessToken, // Use refresh token if available
      });
      
      if (sessionError) {
        setMessage("Session error: " + sessionError.message);
        setLoading(false);
        return;
      }
      
      // Update password in Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) {
        // Handle specific error: password same as old password
        if (authError.message?.includes("should be different from the old password") || 
            authError.message?.includes("same as the old password")) {
          setMessage("The new password must be different from your current password. Please choose a different password.");
        } else {
          setMessage("Error setting password: " + authError.message);
        }
        setLoading(false);
        return;
      }
      
      // IMPORTANT: Also update password in custom users table (required for login)
      // The login code uses the custom users table, not Supabase Auth
      // Use edge function to bypass RLS policies
      if (sessionData?.user?.email) {
        // Hash password before storing
        const hashedPassword = await hashPassword(newPassword);
        
        // Call edge function to update password in users table (bypasses RLS)
        try {
          const { data: updateData, error: updateError } = await supabase.functions.invoke('update-password', {
            body: {
              email: sessionData.user.email,
              password: hashedPassword,
            },
          });
          
          if (updateError || !updateData?.success) {
            console.error("❌ Edge function failed to update password:", updateError, updateData);
            setMessage("Error: Could not update password in database. Error: " + (updateError?.message || updateData?.error || "Unknown error") + ". The update-password edge function may need to be deployed.");
            setLoading(false);
            return;
          }
          
          console.log("✅ Password updated in both Auth and users table via edge function");
        } catch (fetchError: any) {
          console.error("❌ Failed to call update-password edge function:", fetchError);
          setMessage("Error: Could not call update-password edge function. Error: " + fetchError.message + ". The function must be deployed in Supabase Dashboard → Edge Functions.");
          setLoading(false);
          return;
        }
      }
      
      // Success!
      setPasswordReset(true);
      setMessage("Password successfully set! You can now log in with your new password.");
      
      toast({
        title: "Password Set!",
        description: "Your password has been successfully set. You can now log in.",
      });
    } catch (error: any) {
      setMessage("Error: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mb-4">
            <img 
              src="/bampro-marine-logo.jpg" 
              alt="BAMPRO MARINE" 
              className="h-16 mx-auto object-contain"
            />
          </div>
          <CardTitle className="text-2xl text-orange-600">
            Set Your Password
          </CardTitle>
          <CardDescription>
            {passwordReset ? "Your password has been successfully changed" : "Set up your password to activate your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accessToken ? (
            passwordReset ? (
              <div className="space-y-4">
                <div className="text-center p-4 bg-green-50 text-green-700 border border-green-200 rounded">
                  <p className="font-semibold mb-2">✅ Password successfully set!</p>
                  <p className="text-sm">You can now log in with your new password.</p>
                </div>
                <Link to="/">
                  <Button className="w-full bg-orange-600 hover:bg-orange-700">
                    Go to Login Screen
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Enter new password (minimum 6 characters)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-orange-600 hover:bg-orange-700" 
                  disabled={loading || !newPassword || !confirmPassword}
                >
                  {loading ? "Setting Password..." : "Set Password"}
                </Button>
                {message && (
                  <div 
                    className={`text-sm text-center mt-2 p-3 rounded ${
                      message.includes('successfully') || message.includes('success')
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {message}
                  </div>
                )}
              </form>
            )
          ) : (
            <div className="text-center text-red-500 p-4 bg-red-50 rounded border border-red-200">
              Missing or invalid reset link. Please check that you have used the complete link from the email.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reset; 