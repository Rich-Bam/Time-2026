import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface AuthSectionProps {
  onLogin: (status: boolean) => void;
  setCurrentUser: (user: any) => void;
}

const AuthSection = ({ onLogin, setCurrentUser }: AuthSectionProps) => {
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ email: "", name: "", password: "" });
  const [registerLoading, setRegisterLoading] = useState(false);
  const { toast } = useToast();
  // Forgot password modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.email || !loginData.password) {
      toast({
        title: "Login Failed",
        description: "Please enter valid credentials",
        variant: "destructive",
      });
      return;
    }
    // Query Supabase users table for a user with this email
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", loginData.email)
      .single();
    if (error || !user) {
      toast({
        title: "Login Failed",
        description: "User not found",
        variant: "destructive",
      });
      return;
    }
    // Check if user is approved (for new accounts, admin must approve)
    if (user.approved === false) {
      toast({
        title: "Account Pending Approval",
        description: "Your account is waiting for admin approval. Please contact an administrator.",
        variant: "destructive",
      });
      return;
    }
    // Check password (plaintext for now)
    if (user.password !== loginData.password) {
      toast({
        title: "Login Mislukt",
        description: "Onjuist wachtwoord",
        variant: "destructive",
      });
      return;
    }
    
    // Save session to localStorage (14 days persistence)
    const sessionData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        approved: user.approved,
        must_change_password: user.must_change_password,
      },
      loginTime: new Date().toISOString(),
    };
    localStorage.setItem('bampro_user_session', JSON.stringify(sessionData));
    
    setCurrentUser(user);
    onLogin(true);
    toast({
      title: "Login Succesvol",
      description: `Welkom, ${user.name || user.email}! Je blijft ingelogd voor 14 dagen.`,
    });
  };

  // Simple create-user helper to verify Supabase connectivity
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerData.email || !registerData.password || !registerData.name) {
      toast({
        title: "Ontbrekende informatie",
        description: "Email, naam en wachtwoord zijn verplicht om een gebruiker aan te maken.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate email domain - only @bampro.nl allowed
    if (!registerData.email.toLowerCase().endsWith('@bampro.nl')) {
      toast({
        title: "Alleen BAMPRO Email Toegestaan",
        description: "Je kunt alleen een account aanmaken met een @bampro.nl email adres. Voor andere email adressen moet je door een admin worden uitgenodigd.",
        variant: "destructive",
        duration: 8000,
      });
      return;
    }
    
    // Validate password length
    if (registerData.password.length < 6) {
      toast({
        title: "Wachtwoord te kort",
        description: "Wachtwoord moet minimaal 6 tekens lang zijn.",
        variant: "destructive",
      });
      return;
    }
    
    setRegisterLoading(true);
    const { error } = await supabase.from("users").insert([
      {
        email: registerData.email,
        name: registerData.name,
        password: registerData.password,
        // These fields are used elsewhere in the app (Admin panel / password change)
        isAdmin: false,
        must_change_password: false,
        approved: false, // New users need admin approval
      },
    ]);
    setRegisterLoading(false);
    if (error) {
      toast({
        title: "Fout bij aanmaken gebruiker",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Account aangemaakt",
      description: "Je account is aangemaakt en wacht op goedkeuring van een administrator. Je kunt inloggen zodra een administrator je account heeft goedgekeurd.",
    });
    // Clear form
    setRegisterData({ email: "", name: "", password: "" });
  };

  // Handle password reset - send email via Supabase Auth
  const handleResetPassword = async () => {
    if (!resetEmail) {
      setResetMessage("Voer een email adres in.");
      return;
    }
    setResetLoading(true);
    setResetMessage("");
    
    // First check if user exists in our custom users table
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", resetEmail)
      .single();
    
    if (userError || !user) {
      setResetMessage("Gebruiker niet gevonden. Controleer je email adres.");
      setResetLoading(false);
      return;
    }
    
    // Get app URL for redirect (use the actual website URL, not Supabase URL)
    const appUrl = 'https://bampro-uren.nl'; // Or use window.location.origin for current domain
    
    // Use Supabase Auth's password reset - this sends email automatically!
    // Note: This only works if the user exists in Supabase Auth
    // Users invited via Edge Function will be in Auth, but direct-created users might not be
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${appUrl}/reset`, // Redirect to password reset page
    });
    
    if (resetError) {
      // If user doesn't exist in Supabase Auth, we need to use Edge Function
      console.log("User not in Supabase Auth, trying Edge Function...");
      
      // Try calling password-reset Edge Function (if it exists)
      // For now, show error but suggest contacting admin
      setResetMessage(
        "Kon geen password reset email versturen. " +
        "Als je account via email uitnodiging is aangemaakt, probeer het opnieuw. " +
        "Anders neem contact op met een administrator."
      );
      setResetLoading(false);
      return;
    }
    
    // Success - email sent!
    setResetMessage(
      "Password reset email is verstuurd! " +
      "Check je inbox (en spam folder) voor de reset link. " +
      "De link is 1 uur geldig."
    );
    setResetLoading(false);
    setShowResetModal(false); // Close modal after success
    setResetEmail(""); // Clear email
    
    toast({
      title: "Reset email verstuurd",
      description: `Een password reset link is verstuurd naar ${resetEmail}. Check je inbox.`,
    });
  };

  return (
    <div className="max-w-3xl mx-auto grid gap-8 md:grid-cols-2">
      {/* Login card */}
      <Card>
        <CardHeader className="text-center">
          <CardDescription>
            Login to start tracking time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="Enter your email"
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end">
              <Button variant="link" type="button" onClick={() => setShowResetModal(true)}>
                Forgot Password?
              </Button>
            </div>
            <Button type="submit" className="w-full">
              Login
            </Button>
          </form>
        </CardContent>
      </Card>
      {/* Create user card */}
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <User className="w-5 h-5 text-orange-500" />
            Account Aanmaken
          </CardTitle>
          <CardDescription>
            Alleen @bampro.nl email adressen kunnen een account aanmaken. Voor andere email adressen, vraag een admin om je uit te nodigen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-email">Email (@bampro.nl vereist)</Label>
              <Input
                id="register-email"
                type="email"
                placeholder="naam@bampro.nl"
                value={registerData.email}
                onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                required
              />
              {registerData.email && !registerData.email.toLowerCase().endsWith('@bampro.nl') && (
                <p className="text-xs text-red-500">
                  Alleen @bampro.nl email adressen kunnen een account aanmaken. Vraag een admin om je uit te nodigen voor andere email adressen.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-name">Name</Label>
              <Input
                id="register-name"
                type="text"
                placeholder="New User"
                value={registerData.name}
                onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password">Wachtwoord</Label>
              <Input
                id="register-password"
                type="password"
                placeholder="Kies een wachtwoord (minimaal 6 tekens)"
                value={registerData.password}
                onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                required
                minLength={6}
              />
              {registerData.password && registerData.password.length > 0 && registerData.password.length < 6 && (
                <p className="text-sm text-red-500">Wachtwoord moet minimaal 6 tekens lang zijn.</p>
              )}
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={registerLoading || (registerData.password && registerData.password.length < 6)}
            >
              {registerLoading ? "Aanmaken..." : "Gebruiker Aanmaken"}
            </Button>
          </form>
        </CardContent>
      </Card>
      {/* Reset Password Dialog */}
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wachtwoord Resetten</DialogTitle>
            <DialogDescription>Voer je email adres in om een wachtwoord reset link te ontvangen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="Enter your email"
              value={resetEmail}
              onChange={e => setResetEmail(e.target.value)}
              required
              disabled={resetLoading}
            />
            <Button onClick={handleResetPassword} disabled={resetLoading || !resetEmail} className="w-full">
              {resetLoading ? "Verzenden..." : "Verstuur Reset Link"}
            </Button>
            {resetMessage && (
              <div 
                className={`text-sm text-center mt-2 p-3 rounded ${
                  resetMessage.includes('verstuurd') || resetMessage.includes('inbox')
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {resetMessage}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuthSection;
