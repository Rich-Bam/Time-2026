import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const Reset = () => {
  const [searchParams] = useSearchParams();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Try to get access_token from query or hash
  useEffect(() => {
    let token = searchParams.get("access_token");
    if (!token && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      token = hashParams.get("access_token");
    }
    setAccessToken(token);
  }, [searchParams]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    if (!accessToken) {
      setMessage("Missing or invalid access token.");
      setLoading(false);
      return;
    }
    // Set the session with the access token so updateUser works
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: accessToken, // Not used, but required by type
    });
    if (sessionError) {
      setMessage("Session error: " + sessionError.message);
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Password has been reset! You can now log in with your new password.");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Set a New Password</CardTitle>
          <CardDescription>Enter your new password below.</CardDescription>
        </CardHeader>
        <CardContent>
          {accessToken ? (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !newPassword}>
                {loading ? "Resetting..." : "Reset Password"}
              </Button>
              {message && (
                <div className="text-sm text-center mt-2" style={{ color: message.includes('reset') ? 'green' : 'red' }}>
                  {message}
                </div>
              )}
            </form>
          ) : (
            <div className="text-center text-red-500">Missing or invalid reset token.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reset; 