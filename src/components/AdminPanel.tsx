import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { User, Calendar } from "lucide-react";

interface AdminPanelProps {
  currentUser: any;
}

const AdminPanel = ({ currentUser }: AdminPanelProps) => {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    isAdmin: false,
    must_change_password: true,
  });
  const [resetPassword, setResetPassword] = useState("");
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [daysOffMap, setDaysOffMap] = useState<Record<string, number>>({});
  const [daysOffInput, setDaysOffInput] = useState<Record<string, string>>({});
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});
  const [confirmedWeeks, setConfirmedWeeks] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("users").select("id, email, name, isAdmin, must_change_password, approved");
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line
  }, []);

  // Build users map for quick lookup
  useEffect(() => {
    const map: Record<string, any> = {};
    users.forEach(u => { map[u.id] = u; });
    setUsersMap(map);
  }, [users]);

  // Fetch confirmed weeks that need admin review
  useEffect(() => {
    const fetchConfirmedWeeks = async () => {
      const { data } = await supabase
        .from('confirmed_weeks')
        .select('*')
        .eq('confirmed', true)
        .order('week_start_date', { ascending: false });
      setConfirmedWeeks(data || []);
    };
    fetchConfirmedWeeks();
    // Refresh every 30 seconds to catch new confirmations
    const interval = setInterval(fetchConfirmedWeeks, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch days off for all users
  useEffect(() => {
    const fetchDaysOff = async () => {
      const currentYear = new Date().getFullYear();
      const fromDate = `${currentYear}-01-01`;
      const toDate = `${currentYear}-12-31`;
      const { data, error } = await supabase
        .from("timesheet")
        .select("user_id, hours, description")
        .eq("description", "31")
        .gte("date", fromDate)
        .lte("date", toDate);
      if (data) {
        const map: Record<string, number> = {};
        data.forEach(e => {
          map[e.user_id] = (map[e.user_id] || 0) + (parseFloat(e.hours) || 0);
        });
        setDaysOffMap(map);
      }
    };
    fetchDaysOff();
  }, [users]);

  // Fetch all timesheet entries for all users
  useEffect(() => {
    const fetchAllEntries = async () => {
      const { data: entries } = await supabase
        .from("timesheet")
        .select("*, projects(name)")
        .order("date", { ascending: false });
      setAllEntries(entries || []);
      // Build project id->name map
      const { data: projects } = await supabase.from("projects").select("id, name");
      const map: Record<string, string> = {};
      (projects || []).forEach((p: any) => { map[p.id] = p.name; });
      setProjectsMap(map);
    };
    fetchAllEntries();
  }, [users]);

  // Test Edge Function directly - using Supabase client to avoid CORS issues
  const testEdgeFunction = async () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    console.log("🧪 Testing Edge Function...");
    console.log("  Supabase URL:", supabaseUrl || "❌ MISSING!");
    console.log("  Anon Key:", anonKey ? "✅ Set (length: " + anonKey.length + ")" : "❌ MISSING!");
    
    if (!supabaseUrl || !anonKey) {
      toast({
        title: "❌ Configuratie Fout",
        description: `Environment variabelen ontbreken! URL: ${supabaseUrl ? "✅" : "❌"}, Key: ${anonKey ? "✅" : "❌"}. Check Netlify environment variables.`,
        variant: "destructive",
      });
      return;
    }
    
    const testEmail = `test-${Date.now()}@example.com`;
    
    console.log("🧪 Using Supabase client to call Edge Function");
    console.log("🧪 Test email:", testEmail);
    
    try {
      toast({
        title: "🧪 Testing...",
        description: `Testing Edge Function via Supabase client...`,
      });
      
      // Use Supabase client's functions.invoke() method - this handles auth and CORS automatically
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: testEmail,
          name: "Test User",
          isAdmin: false,
        },
      });
      
      console.log("🧪 Supabase client response:", { data, error });
      
      if (error) {
        console.error("🧪 Error from Supabase client:", error);
        
        // Check for specific error types
        if (error.message?.includes("404") || error.message?.includes("not found")) {
          toast({
            title: "❌ Edge Function niet gevonden (404)",
            description: "De 'invite-user' function bestaat NIET in Supabase. Ga naar Supabase Dashboard → Edge Functions → Create 'invite-user' function.",
            variant: "destructive",
          });
        } else if (error.message?.includes("401") || error.message?.includes("403") || error.message?.includes("unauthorized")) {
          toast({
            title: "❌ Toegang geweigerd (401/403)",
            description: "Check of VITE_SUPABASE_ANON_KEY correct is in Netlify environment variables.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "❌ Edge Function Error",
            description: error.message || JSON.stringify(error),
            variant: "destructive",
          });
        }
      } else if (data?.success) {
        toast({
          title: "✅ Edge Function werkt!",
          description: `Test email verstuurd naar ${testEmail}. Check Supabase Auth → Users.`,
        });
      } else {
        toast({
          title: "⚠️ Onverwachte response",
          description: JSON.stringify(data),
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("🧪 Test Error:", err);
      console.error("🧪 Error details:", {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
      
      let errorMessage = err.message || "Unknown error";
      
      if (err.name === "AbortError") {
        errorMessage = "Timeout: Edge Function reageert niet binnen 10 seconden. Check of de function gedeployed is.";
      } else if (err.message?.includes("Failed to fetch") || err.message?.includes("network")) {
        errorMessage = "Kon Edge Function niet bereiken. Mogelijke oorzaken:\n1. Edge Function bestaat niet (404)\n2. CORS probleem\n3. Netwerk probleem\n\nCheck Supabase Dashboard → Edge Functions → Functions → Logs";
      }
      
      toast({
        title: "❌ Network Error",
        description: errorMessage + "\n\nDruk F12 → Console voor meer details.",
        variant: "destructive",
        duration: 10000, // Show for 10 seconds
      });
    }
  };

  // Add user (with optional invite via Supabase Edge Function)
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast({ title: "Missing info", description: "Email and password required", variant: "destructive" });
      return;
    }
    
    // Debug: Check environment variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    console.log("🔍 DEBUG INFO:");
    console.log("  Supabase URL:", supabaseUrl || "❌ MISSING!");
    console.log("  Anon Key:", anonKey ? "✅ Set" : "❌ MISSING!");
    
    if (!supabaseUrl || !anonKey) {
      toast({
        title: "❌ Configuratie Fout",
        description: `Environment variabelen ontbreken! URL: ${supabaseUrl ? "✅" : "❌"}, Key: ${anonKey ? "✅" : "❌"}. Check .env.local of Netlify settings.`,
        variant: "destructive",
      });
      // Continue with fallback anyway
    }
    
    // First try Edge Function for email invite - using Supabase client to avoid CORS issues
    try {
      console.log("🔵 Calling Edge Function via Supabase client...");
      console.log("🔵 Email:", form.email);
      console.log("🔵 Name:", form.name || form.email);
      console.log("🔵 IsAdmin:", form.isAdmin);
      
      // Use Supabase client's functions.invoke() method - this handles auth and CORS automatically
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: form.email,
          name: form.name || form.email,
          isAdmin: form.isAdmin,
        },
      });
      
      console.log("🔵 Edge Function response:", { data, error });

      if (!error && data?.success) {
        console.log("✅ Edge Function success:", data);
        toast({
          title: "Uitnodiging verstuurd",
          description: `Een uitnodigingsemail is verstuurd naar ${form.email}. Check je inbox (en spam folder) voor de uitnodigingslink.`,
        });
        setForm({ email: "", name: "", password: "", isAdmin: false, must_change_password: true });
        fetchUsers();
        return;
      }
      
      // If Edge Function fails, show error and try direct user creation
      console.error("❌ Edge Function failed:", { data, error });
      
      // Show specific error to user
      if (error) {
        if (error.message?.includes("404") || error.message?.includes("not found")) {
          toast({
            title: "⚠️ Edge Function niet gevonden (404)",
            description: "De 'invite-user' function is NIET gedeployed in Supabase. Open Supabase Dashboard → Edge Functions → Functions → Create 'invite-user' function. Gebruiker wordt nu aangemaakt zonder email.",
            variant: "destructive",
          });
        } else if (error.message?.includes("401") || error.message?.includes("403") || error.message?.includes("unauthorized")) {
          toast({
            title: "⚠️ Toegang geweigerd (401/403)",
            description: "Check of VITE_SUPABASE_ANON_KEY correct is in Netlify environment variables. Gebruiker wordt nu aangemaakt zonder email.",
            variant: "destructive",
          });
        } else {
          let errorMessage = error.message || JSON.stringify(error);
          if (errorMessage.includes("already registered") || errorMessage.includes("already exists")) {
            errorMessage = "Dit email adres is al geregistreerd in Supabase Auth.";
          } else if (errorMessage.includes("email service") || errorMessage.includes("email")) {
            errorMessage = "Supabase email service probleem. Check Authentication → Email Templates.";
          }
          toast({
            title: "⚠️ Email kon niet worden verstuurd",
            description: `${errorMessage}. Druk F12 → Console voor details. Gebruiker wordt nu aangemaakt zonder email.`,
            variant: "destructive",
          });
        }
      } else if (data?.error) {
        let errorMessage = data.error;
        if (errorMessage.includes("already registered") || errorMessage.includes("already exists")) {
          errorMessage = "Dit email adres is al geregistreerd in Supabase Auth.";
        } else if (errorMessage.includes("email service") || errorMessage.includes("email")) {
          errorMessage = "Supabase email service probleem. Check Authentication → Email Templates.";
        }
        toast({
          title: "⚠️ Email kon niet worden verstuurd",
          description: `${errorMessage}. Druk F12 → Console voor details. Gebruiker wordt nu aangemaakt zonder email.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "⚠️ Edge Function Error",
          description: `Onverwachte response: ${JSON.stringify(data)}. Druk F12 → Console voor details. Gebruiker wordt nu aangemaakt zonder email.`,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("❌ Edge Function network error, falling back:", err);
      let errorMessage = err.message || "Unknown error";
      if (err.message?.includes("Failed to fetch") || err.message?.includes("network")) {
        errorMessage = "Kon Edge Function niet bereiken. Check of de function gedeployed is in Supabase Dashboard → Edge Functions → Functions.";
      }
      toast({
        title: "⚠️ Netwerkfout",
        description: `${errorMessage}. Gebruiker wordt nu aangemaakt zonder email.`,
        variant: "destructive",
      });
    }
    
    // Fallback: create user directly (no email sent)
    const { error: insertError } = await supabase.from("users").insert([
      {
        email: form.email,
        name: form.name || form.email,
        password: form.password,
        isAdmin: form.isAdmin,
        must_change_password: form.must_change_password,
        approved: true, // Admins can create users directly, so they're auto-approved
      },
    ]);
    
    if (insertError) {
      toast({
        title: "Fout bij aanmaken gebruiker",
        description: insertError.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Gebruiker aangemaakt",
        description: `${form.email} is aangemaakt. Let op: er is geen email verstuurd. De gebruiker kan direct inloggen met het wachtwoord.`,
        variant: "default",
      });
      setForm({ email: "", name: "", password: "", isAdmin: false, must_change_password: true });
      fetchUsers();
    }
  };

  // Reset password
  const handleResetPassword = async (userId: string) => {
    if (!resetPassword) {
      toast({ title: "Missing password", description: "Enter a new password", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("users").update({ password: resetPassword, must_change_password: true }).eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password reset", description: "User must change password on next login" });
      setResetPassword("");
      setResetUserId(null);
      fetchUsers();
    }
  };

  const SUPER_ADMIN_EMAIL = "r.blance@bampro.nl";
  // Toggle admin flag for an existing user
  const handleToggleAdmin = async (userId: string, userEmail: string, makeAdmin: boolean) => {
    if (userEmail === SUPER_ADMIN_EMAIL && !makeAdmin) {
      toast({
        title: "Action not allowed",
        description: "You cannot remove admin rights from the super admin.",
        variant: "destructive",
      });
      return;
    }
    if (userId === currentUser.id && !makeAdmin) {
      toast({
        title: "Action not allowed",
        description: "You cannot remove your own admin rights.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.from("users").update({ isAdmin: makeAdmin }).eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Admin status updated",
        description: `${userEmail} is now ${makeAdmin ? "an admin" : "a regular user"}.`,
      });
      fetchUsers();
    }
  };

  // Approve pending user
  const handleApproveUser = async (userId: string, userEmail: string) => {
    const { error } = await supabase.from("users").update({ approved: true }).eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "User Approved",
        description: `${userEmail} can now log in.`,
      });
      fetchUsers();
    }
  };

  // Delete user
  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (userEmail === SUPER_ADMIN_EMAIL) {
      toast({ title: "Action not allowed", description: "You cannot delete the super admin.", variant: "destructive" });
      return;
    }
    if (userId === currentUser.id) {
      toast({ title: "Action not allowed", description: "You cannot delete your own account.", variant: "destructive" });
      return;
    }
    const confirmText = window.prompt(`Type DELETE to confirm deletion of user ${userEmail}`);
    if (confirmText !== "DELETE") {
      toast({ title: "Cancelled", description: "User was not deleted." });
      return;
    }
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "User deleted" });
      fetchUsers();
    }
  };

  const totalDaysOff = 25;

  const handleAddOrDeductDaysOff = async (userId: string, hours: number) => {
    if (!hours) return;
    // Add: insert a new timesheet entry with +hours
    // Deduct: insert a new timesheet entry with -hours
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from("timesheet").insert([
      {
        user_id: userId,
        project_id: null,
        date: today,
        hours: hours,
        description: "31",
      },
    ]);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: hours > 0 ? "Day(s) Off Added" : "Day(s) Off Deducted", description: `User ${userId} now has updated days off.` });
      setDaysOffInput((prev) => ({ ...prev, [userId]: "" }));
      // Refresh days off map
      const currentYear = new Date().getFullYear();
      const fromDate = `${currentYear}-01-01`;
      const toDate = `${currentYear}-12-31`;
      const { data } = await supabase
        .from("timesheet")
        .select("user_id, hours, description")
        .eq("description", "31")
        .gte("date", fromDate)
        .lte("date", toDate);
      if (data) {
        const map: Record<string, number> = {};
        data.forEach(e => {
          map[e.user_id] = (map[e.user_id] || 0) + (parseFloat(e.hours) || 0);
        });
        setDaysOffMap(map);
      }
    }
  };

  function getISOWeek(dateStr: string) {
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    return (
      date.getFullYear() + "-W" +
      String(1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)).padStart(2, '0')
    );
  }

  // Handle admin actions on confirmed weeks
  const handleApproveWeek = async (userId: string, weekStartDate: string) => {
    const { error } = await supabase
      .from('confirmed_weeks')
      .update({ admin_approved: true, admin_reviewed: true })
      .eq('user_id', userId)
      .eq('week_start_date', weekStartDate);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Week Goedgekeurd", description: "De week is goedgekeurd door admin." });
      // Refresh confirmed weeks
      const { data } = await supabase
        .from('confirmed_weeks')
        .select('*')
        .eq('confirmed', true)
        .order('week_start_date', { ascending: false });
      setConfirmedWeeks(data || []);
    }
  };

  const handleRejectWeek = async (userId: string, weekStartDate: string) => {
    const { error } = await supabase
      .from('confirmed_weeks')
      .update({ admin_approved: false, admin_reviewed: true })
      .eq('user_id', userId)
      .eq('week_start_date', weekStartDate);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Week Afgekeurd", description: "De week is afgekeurd door admin." });
      // Refresh confirmed weeks
      const { data } = await supabase
        .from('confirmed_weeks')
        .select('*')
        .eq('confirmed', true)
        .order('week_start_date', { ascending: false });
      setConfirmedWeeks(data || []);
    }
  };

  const handleUnlockWeek = async (userId: string, weekStartDate: string) => {
    const { error } = await supabase
      .from('confirmed_weeks')
      .update({ confirmed: false, admin_approved: false, admin_reviewed: false })
      .eq('user_id', userId)
      .eq('week_start_date', weekStartDate);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ 
        title: "Week Teruggezet", 
        description: "De week is teruggezet. De gebruiker kan de uren nu opnieuw aanpassen." 
      });
      // Refresh confirmed weeks
      const { data } = await supabase
        .from('confirmed_weeks')
        .select('*')
        .eq('confirmed', true)
        .order('week_start_date', { ascending: false });
      setConfirmedWeeks(data || []);
    }
  };

  return (
    <div className="p-4 sm:p-8 bg-white rounded shadow w-full max-w-full">
      <h2 className="text-2xl font-bold mb-4">Admin Panel</h2>
      
      {/* Debug: Test Edge Function */}
      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-yellow-800">🔍 Edge Function Test</p>
            <p className="text-xs text-yellow-700">Test of de invite-user function werkt zonder een user aan te maken</p>
          </div>
          <Button onClick={testEdgeFunction} variant="outline" size="sm">
            Test Edge Function
          </Button>
        </div>
      </div>
      
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Add User</h3>
        <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 items-end w-full">
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isAdmin" checked={form.isAdmin} onChange={e => setForm(f => ({ ...f, isAdmin: e.target.checked }))} />
            <Label htmlFor="isAdmin">Admin</Label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="must_change_password" checked={form.must_change_password} onChange={e => setForm(f => ({ ...f, must_change_password: e.target.checked }))} />
            <Label htmlFor="must_change_password">Must change password</Label>
          </div>
          <Button type="submit">Add User</Button>
        </form>
      </div>
      {/* Pending Users Section */}
      {users.filter(u => u.approved === false).length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2 text-orange-600">Pending Approval</h3>
          <div className="overflow-x-auto w-full">
            <table className="min-w-full border mt-2 text-sm">
              <thead>
                <tr className="bg-orange-100">
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => u.approved === false).map(user => (
                  <tr key={user.id} className="border-t">
                    <td className="p-2">{user.email}</td>
                    <td className="p-2">{user.name || "-"}</td>
                    <td className="p-2">
                      <Button size="sm" variant="default" onClick={() => handleApproveUser(user.id, user.email)}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="ml-2"
                        onClick={() => handleDeleteUser(user.id, user.email)}
                      >
                        Reject
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div>
        <h3 className="text-lg font-semibold mb-2">Existing Users</h3>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="min-w-full border mt-2 text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Admin</th>
                  <th className="p-2 text-left">Approved</th>
                  <th className="p-2 text-left">Must Change Password</th>
                  <th className="p-2 text-left">Days Off Left</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => u.approved !== false).map(user => (
                  <tr key={user.id} className="border-t">
                    <td className="p-2">{user.email}{user.email === SUPER_ADMIN_EMAIL && <span className="ml-2 px-2 py-1 text-xs bg-orange-200 text-orange-800 rounded">Super Admin</span>}</td>
                    <td className="p-2">{user.name}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!user.isAdmin}
                          disabled={user.email === SUPER_ADMIN_EMAIL}
                          onChange={(e) => handleToggleAdmin(user.id, user.email, e.target.checked)}
                        />
                        <span>{user.isAdmin ? "Yes" : "No"}</span>
                      </div>
                    </td>
                    <td className="p-2">{user.approved !== false ? "Yes" : "No"}</td>
                    <td className="p-2">{user.must_change_password ? "Yes" : "No"}</td>
                    <td className="p-2">{(totalDaysOff - ((daysOffMap[user.id] || 0) / 8)).toFixed(2)} / {totalDaysOff}</td>
                    <td className="p-2">
                      {resetUserId === user.id ? (
                        <div className="flex gap-2 items-center">
                          <Input
                            type="text"
                            placeholder="New password"
                            value={resetPassword}
                            onChange={e => setResetPassword(e.target.value)}
                          />
                          <Button size="sm" onClick={() => handleResetPassword(user.id)}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => { setResetUserId(null); setResetPassword(""); }}>Cancel</Button>
                        </div>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setResetUserId(user.id)}>Reset Password</Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="ml-2"
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            disabled={user.id === currentUser.id || user.email === SUPER_ADMIN_EMAIL}
                            title={user.id === currentUser.id ? "You cannot delete your own account." : user.email === SUPER_ADMIN_EMAIL ? "You cannot delete the super admin." : "Delete user"}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 mt-2">
                        <Input
                          type="number"
                          min="0.25"
                          step="0.25"
                          placeholder="Hours"
                          value={daysOffInput[user.id] || ""}
                          onChange={e => setDaysOffInput(prev => ({ ...prev, [user.id]: e.target.value }))}
                          style={{ width: 70 }}
                        />
                        <Button size="sm" onClick={() => handleAddOrDeductDaysOff(user.id, -Math.abs(parseFloat(daysOffInput[user.id] || "0")))}>
                          Add
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleAddOrDeductDaysOff(user.id, Math.abs(parseFloat(daysOffInput[user.id] || "0")))}>
                          Deduct
                        </Button>
                      </div>
                      <span className="text-xs text-gray-500">(1 day = 8 hours)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Pending Week Confirmations Section */}
      {confirmedWeeks.filter(cw => !cw.admin_reviewed || !cw.admin_approved).length > 0 && (
        <div className="mt-8 mb-8">
          <h3 className="text-lg font-semibold mb-4 text-orange-600">⚠️ Te Controleren Weken</h3>
          <div className="space-y-4">
            {confirmedWeeks
              .filter(cw => !cw.admin_reviewed || !cw.admin_approved)
              .map((cw) => {
                const weekStart = new Date(cw.week_start_date);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                const weekNum = getISOWeek(cw.week_start_date);
                const user = usersMap[cw.user_id];
                const weekEntries = allEntries.filter(
                  e => e.user_id === cw.user_id && 
                  e.date >= cw.week_start_date && 
                  e.date <= weekEnd.toISOString().split('T')[0]
                );
                const totalHours = weekEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);
                
                return (
                  <div key={`${cw.user_id}-${cw.week_start_date}`} className="border rounded-lg p-4 bg-orange-50 shadow">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                      <div>
                        <div className="font-semibold text-lg">
                          {user?.name || user?.email || 'Onbekende gebruiker'} - Week {weekNum}
                        </div>
                        <div className="text-sm text-gray-600">
                          {weekStart.toLocaleDateString('nl-NL')} - {weekEnd.toLocaleDateString('nl-NL')}
                        </div>
                        <div className="text-sm font-medium mt-1">
                          Totaal: {totalHours.toFixed(2)} uur ({weekEntries.length} entries)
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApproveWeek(cw.user_id, cw.week_start_date)}
                        >
                          ✓ Goedkeuren
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectWeek(cw.user_id, cw.week_start_date)}
                        >
                          ✗ Afkeuren
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-orange-600 text-orange-600 hover:bg-orange-100"
                          onClick={() => handleUnlockWeek(cw.user_id, cw.week_start_date)}
                        >
                          🔓 Terugzetten (Unlock)
                        </Button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border rounded">
                        <thead className="bg-white">
                          <tr>
                            <th className="p-2 border">Datum</th>
                            <th className="p-2 border">Project</th>
                            <th className="p-2 border">Uren</th>
                            <th className="p-2 border">Werk Type</th>
                            <th className="p-2 border">Tijd</th>
                          </tr>
                        </thead>
                        <tbody>
                          {weekEntries.map((entry, idx) => (
                            <tr key={entry.id || idx} className="border-t">
                              <td className="p-2 border">{entry.date}</td>
                              <td className="p-2 border">{entry.projects?.name || projectsMap[entry.project_id] || entry.project || "-"}</td>
                              <td className="p-2 border">{entry.hours}</td>
                              <td className="p-2 border">{entry.description}</td>
                              <td className="p-2 border">{entry.startTime && entry.endTime ? `${entry.startTime} - ${entry.endTime}` : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
      {/* Below user table: User Weekly Entries Accordion */}
      <div className="mt-12">
        <h3 className="text-lg font-semibold mb-4">View User Weekly Entries</h3>
        <Accordion type="multiple" className="w-full">
          {users.map(user => {
            // Group this user's entries by week
            const userEntries = allEntries.filter(e => e.user_id === user.id);
            const weeks: Record<string, any[]> = {};
            userEntries.forEach(e => {
              const week = getISOWeek(e.date);
              if (!weeks[week]) weeks[week] = [];
              weeks[week].push(e);
            });
            // Sort weeks descending (most recent first)
            const weekKeys = Object.keys(weeks).sort((a, b) => b.localeCompare(a));
            return (
              <AccordionItem key={user.id} value={user.id} className="border rounded-lg mb-4 shadow bg-white">
                <AccordionTrigger className="px-4 py-3 font-medium bg-gray-50 flex items-center gap-2">
                  <User className="h-6 w-6 text-orange-600" />
                  <span className="text-base font-semibold">{user.name || user.email}</span>
                </AccordionTrigger>
                <AccordionContent className="bg-white">
                  <Accordion type="multiple">
                    {weekKeys.length === 0 ? (
                      <div className="p-6 text-gray-400 text-center italic">No entries found for this user.</div>
                    ) : (
                      weekKeys.map(week => (
                        <AccordionItem key={week} value={week} className="border rounded mb-3 shadow-sm bg-orange-50">
                          <AccordionTrigger className="px-4 py-2 font-semibold flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-orange-500" />
                            <span>{week}</span>
                          </AccordionTrigger>
                          <AccordionContent className="bg-white rounded-b-lg">
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm border rounded-lg shadow-sm">
                                <thead className="sticky top-0 bg-orange-100 z-10">
                                  <tr>
                                    <th className="p-2 border">Date</th>
                                    <th className="p-2 border">Project</th>
                                    <th className="p-2 border">Hours</th>
                                    <th className="p-2 border">Work Type</th>
                                    <th className="p-2 border">Description</th>
                                    <th className="p-1 border">Start - End</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {weeks[week].map((entry, idx) => (
                                    <tr key={entry.id || idx} className="border-t hover:bg-orange-50 transition-colors">
                                      <td className="p-2 border whitespace-nowrap">{entry.date}</td>
                                      <td className="p-2 border">{entry.projects?.name || projectsMap[entry.project_id] || entry.project || "-"}</td>
                                      <td className="p-2 border">{entry.hours}</td>
                                      <td className="p-2 border">{entry.description}</td>
                                      <td className="p-2 border">{entry.notes || ""}</td>
                                      <td className="p-1 border">{entry.startTime && entry.endTime ? `${entry.startTime} - ${entry.endTime}` : '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))
                    )}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
};

export default AdminPanel; 