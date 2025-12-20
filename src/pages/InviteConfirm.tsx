import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { hashPassword } from "@/utils/password";

const InviteConfirm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    
    if (!newPassword || newPassword.length < 6) {
      setMessage("Wachtwoord moet minimaal 6 tekens lang zijn.");
      setLoading(false);
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setMessage("Wachtwoorden komen niet overeen.");
      setLoading(false);
      return;
    }
    
    if (!accessToken) {
      setMessage("Ontbrekende of ongeldige toegangstoken.");
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
        setMessage("Sessie fout: " + sessionError.message);
        setLoading(false);
        return;
      }
      
      // Update password in Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) {
        setMessage("Fout bij het instellen van wachtwoord: " + authError.message);
        setLoading(false);
        return;
      }
      
      // Also update password in custom users table if user exists
      if (sessionData?.user?.email) {
        // Hash password before storing
        const hashedPassword = await hashPassword(newPassword);
        const { error: dbError } = await supabase
          .from("users")
          .update({ 
            password: hashedPassword, // Store hashed password
            must_change_password: false 
          })
          .eq("email", sessionData.user.email);
        
        if (dbError) {
          console.warn("Could not update password in users table:", dbError);
          // Don't fail if this errors - auth password is already set
        }
      }
      
      // Success!
      toast({
        title: "Account geactiveerd!",
        description: "Je wachtwoord is ingesteld. Je kunt nu inloggen.",
      });
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate("/");
      }, 2000);
      
      setMessage("Wachtwoord succesvol ingesteld! Je wordt doorgestuurd naar de login pagina...");
    } catch (error: any) {
      setMessage("Fout: " + (error.message || "Onbekende fout"));
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
            Welkom bij BAMPRO MARINE!
          </CardTitle>
          <CardDescription>
            Stel je wachtwoord in om je account te activeren
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accessToken ? (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Wachtwoord</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Kies een wachtwoord (minimaal 6 tekens)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Bevestig wachtwoord</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Bevestig je wachtwoord"
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
                {loading ? "Bezig..." : "Account activeren"}
              </Button>
              {message && (
                <div 
                  className={`text-sm text-center mt-2 p-3 rounded ${
                    message.includes('succesvol') || message.includes('doorgestuurd')
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {message}
                </div>
              )}
            </form>
          ) : (
            <div className="text-center text-red-500 p-4 bg-red-50 rounded border border-red-200">
              Ontbrekende of ongeldige activatielink. Controleer of je de volledige link uit de email hebt gebruikt.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteConfirm;


