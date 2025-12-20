import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { hashPassword } from "@/utils/password";

interface ChangePasswordFormProps {
  currentUser: any;
  setCurrentUser: (user: any) => void;
}

const ChangePasswordForm = ({ currentUser, setCurrentUser }: ChangePasswordFormProps) => {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      toast({ 
        title: "Error", 
        description: "Please enter a password", 
        variant: "destructive" 
      });
      return;
    }
    
    if (password.length < 6) {
      toast({ 
        title: "Password too short", 
        description: "Password must be at least 6 characters long.", 
        variant: "destructive" 
      });
      return;
    }
    
    if (password !== confirm) {
      toast({ 
        title: "Error", 
        description: "Passwords do not match", 
        variant: "destructive" 
      });
      return;
    }
    
    setLoading(true);
    // Hash password before storing
    const hashedPassword = await hashPassword(password);
    const { error } = await supabase
      .from("users")
      .update({ password: hashedPassword, must_change_password: false })
      .eq("id", currentUser.id);
    setLoading(false);
    if (error) {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    } else {
      toast({ 
        title: "Password changed", 
        description: "You can now use your new password." 
      });
      setCurrentUser({ ...currentUser, must_change_password: false });
      setPassword("");
      setConfirm("");
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Change Password</h3>
      <form onSubmit={handleChangePassword} className="space-y-4">
        <div>
          <Label htmlFor="new-password">New Password</Label>
          <Input
            id="new-password"
            type="password"
            placeholder="Minimum 6 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {password && password.length > 0 && password.length < 6 && (
            <p className="text-xs text-red-500 mt-1">Password must be at least 6 characters long.</p>
          )}
        </div>
        <div>
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <Input
            id="confirm-password"
            type="password"
            placeholder="Confirm your password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            minLength={6}
          />
          {confirm && password !== confirm && (
            <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
          )}
        </div>
        <Button 
          type="submit" 
          className="w-full" 
          disabled={loading || !password || !confirm || password.length < 6 || password !== confirm}
        >
          {loading ? "Saving..." : "Change Password"}
        </Button>
      </form>
    </div>
  );
};

export default ChangePasswordForm; 