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
    // Check password (plaintext for now)
    if (user.password !== loginData.password) {
      toast({
        title: "Login Failed",
        description: "Incorrect password",
        variant: "destructive",
      });
      return;
    }
    setCurrentUser(user);
    onLogin(true);
    toast({
      title: "Login Successful",
      description: `Welcome, ${user.name || user.email}!`,
    });
  };

  // Simple create-user helper to verify Supabase connectivity
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerData.email || !registerData.password || !registerData.name) {
      toast({
        title: "Missing information",
        description: "Email, name and password are required to create a user.",
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
      },
    ]);
    setRegisterLoading(false);
    if (error) {
      toast({
        title: "Failed to create user",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "User created",
      description: "You can now log in with this email and password.",
    });
    // Convenience: prefill login form with the new user's credentials
    setLoginData({ email: registerData.email, password: registerData.password });
    setRegisterData({ email: "", name: "", password: "" });
  };

  // Handle password reset
  const handleResetPassword = async () => {
    if (!resetEmail) {
      setResetMessage("Please enter an email address.");
      return;
    }
    setResetLoading(true);
    setResetMessage("");
    
    // Check if user exists in our custom users table
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", resetEmail)
      .single();
    
    if (userError || !user) {
      setResetMessage("User not found. Please check your email address.");
      setResetLoading(false);
      return;
    }
    
    // Generate a temporary random password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
    
    // Update password in database
    const { error: updateError } = await supabase
      .from("users")
      .update({ 
        password: tempPassword,
        must_change_password: true 
      })
      .eq("id", user.id);
    
    if (updateError) {
      setResetMessage(`Error: ${updateError.message}`);
      setResetLoading(false);
      return;
    }
    
    // For now, show the temporary password (in production, you'd send this via email)
    setResetMessage(`Password reset! Your temporary password is: ${tempPassword}. Please change it after logging in.`);
    setResetLoading(false);
    
    // Note: In production, you should send this via email using a Supabase Edge Function
    // For now, we're showing it directly (not secure, but functional for testing)
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
            Create User
          </CardTitle>
          <CardDescription>Quickly add a user to verify Supabase is connected.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-email">Email</Label>
              <Input
                id="register-email"
                type="email"
                placeholder="newuser@example.com"
                value={registerData.email}
                onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                required
              />
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
              <Label htmlFor="register-password">Password</Label>
              <Input
                id="register-password"
                type="password"
                placeholder="Choose a password"
                value={registerData.password}
                onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={registerLoading}>
              {registerLoading ? "Creating..." : "Create User"}
            </Button>
          </form>
        </CardContent>
      </Card>
      {/* Reset Password Dialog */}
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Enter your email to receive a password reset link.</DialogDescription>
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
              {resetLoading ? "Sending..." : "Send Reset Link"}
            </Button>
            {resetMessage && (
              <div className="text-sm text-center mt-2" style={{ color: resetMessage.includes('sent') ? 'green' : 'red' }}>
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
