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
        title: "Fout", 
        description: "Voer een wachtwoord in", 
        variant: "destructive" 
      });
      return;
    }
    
    if (password.length < 6) {
      toast({ 
        title: "Wachtwoord te kort", 
        description: "Wachtwoord moet minimaal 6 tekens lang zijn.", 
        variant: "destructive" 
      });
      return;
    }
    
    if (password !== confirm) {
      toast({ 
        title: "Fout", 
        description: "Wachtwoorden komen niet overeen", 
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
        title: "Fout", 
        description: error.message, 
        variant: "destructive" 
      });
    } else {
      toast({ 
        title: "Wachtwoord gewijzigd", 
        description: "Je kunt nu je nieuwe wachtwoord gebruiken." 
      });
      setCurrentUser({ ...currentUser, must_change_password: false });
      setPassword("");
      setConfirm("");
    }
  };

  return (
    <div className="bg-white p-8 rounded shadow w-full max-w-md">
      <h2 className="text-xl font-bold mb-4">Wachtwoord Wijzigen</h2>
      <form onSubmit={handleChangePassword} className="space-y-4">
        <div>
          <Label htmlFor="new-password">Nieuw Wachtwoord</Label>
          <Input
            id="new-password"
            type="password"
            placeholder="Minimaal 6 tekens"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {password && password.length > 0 && password.length < 6 && (
            <p className="text-xs text-red-500 mt-1">Wachtwoord moet minimaal 6 tekens lang zijn.</p>
          )}
        </div>
        <div>
          <Label htmlFor="confirm-password">Bevestig Wachtwoord</Label>
          <Input
            id="confirm-password"
            type="password"
            placeholder="Bevestig je wachtwoord"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            minLength={6}
          />
          {confirm && password !== confirm && (
            <p className="text-xs text-red-500 mt-1">Wachtwoorden komen niet overeen.</p>
          )}
        </div>
        <Button 
          type="submit" 
          className="w-full" 
          disabled={loading || !password || !confirm || password.length < 6 || password !== confirm}
        >
          {loading ? "Opslaan..." : "Wachtwoord Wijzigen"}
        </Button>
      </form>
    </div>
  );
};

export default ChangePasswordForm; 