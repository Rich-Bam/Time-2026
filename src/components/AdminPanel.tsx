import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Calendar } from "lucide-react";
import { hashPassword } from "@/utils/password";

interface AdminPanelProps {
  currentUser: any;
}

const AdminPanel = ({ currentUser }: AdminPanelProps) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
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
  const [reminderUserIds, setReminderUserIds] = useState<string[]>([]);
  const [reminderWeekNumber, setReminderWeekNumber] = useState<string>("");
  const [reminderYear, setReminderYear] = useState<string>(new Date().getFullYear().toString());
  const [timebuzzerSyncing, setTimebuzzerSyncing] = useState(false);
  const [timebuzzerSyncStartDate, setTimebuzzerSyncStartDate] = useState("");
  const [timebuzzerSyncEndDate, setTimebuzzerSyncEndDate] = useState("");

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

// Add user (with optional invite via Supabase Edge Function)
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast({ 
        title: "Ontbrekende informatie", 
        description: "Email en wachtwoord zijn verplicht", 
        variant: "destructive" 
      });
      return;
    }
    
    // Validate password length
    if (form.password.length < 6) {
      toast({ 
        title: "Wachtwoord te kort", 
        description: "Wachtwoord moet minimaal 6 tekens lang zijn.", 
        variant: "destructive" 
      });
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
      console.log("🔵 Calling supabase.functions.invoke('invite-user')...");
      
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: form.email,
          name: form.name || form.email,
          isAdmin: form.isAdmin,
        },
      });
      
      console.log("🔵 Edge Function response:", { data, error });
      console.log("🔵 Error details:", error ? {
        message: error.message,
        name: error.name,
        context: error.context,
        status: error.status,
        statusCode: error.statusCode,
        fullError: JSON.stringify(error, null, 2)
      } : "No error");

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
        const errorMsg = error.message || JSON.stringify(error);
        const errorStatus = error.status || error.statusCode;
        
        if (errorMsg.includes("404") || errorMsg.includes("not found") || errorStatus === 404) {
          toast({
            title: "⚠️ Edge Function niet gevonden (404)",
            description: "De 'invite-user' function is NIET gedeployed in Supabase. Open Supabase Dashboard → Edge Functions → Functions → Create 'invite-user' function. Gebruiker wordt nu aangemaakt zonder email.",
            variant: "destructive",
          });
        } else if (errorMsg.includes("401") || errorMsg.includes("403") || errorMsg.includes("unauthorized") || errorStatus === 401 || errorStatus === 403) {
          toast({
            title: "⚠️ Toegang geweigerd (401/403)",
            description: "Check of VITE_SUPABASE_ANON_KEY correct is in Netlify environment variables. Gebruiker wordt nu aangemaakt zonder email.",
            variant: "destructive",
          });
        } else if (errorMsg.includes("Failed to send") || errorMsg.includes("network") || errorMsg.includes("fetch")) {
          toast({
            title: "⚠️ Netwerkfout",
            description: `Kon Edge Function niet bereiken: ${errorMsg}\n\nCheck Supabase Dashboard → Edge Functions → Functions → invite-user bestaat\nGebruiker wordt nu aangemaakt zonder email.`,
            variant: "destructive",
          });
        } else {
          let errorMessage = errorMsg;
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
    // Hash password before storing
    const hashedPassword = await hashPassword(form.password);
    const { error: insertError } = await supabase.from("users").insert([
      {
        email: form.email,
        name: form.name || form.email,
        password: hashedPassword, // Store hashed password
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
    // Hash password before storing
    const hashedPassword = await hashPassword(resetPassword);
    const { error } = await supabase.from("users").update({ password: hashedPassword, must_change_password: true }).eq("id", userId);
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

  // Helper to get week date range from week number and year
  function getWeekDateRange(weekNumber: number, year: number) {
    try {
      const jan4 = new Date(year, 0, 4);
      const jan4Day = jan4.getDay() || 7;
      const daysToMonday = jan4Day === 1 ? 0 : 1 - jan4Day;
      const week1Monday = new Date(year, 0, 4 + daysToMonday);
      const weekMonday = new Date(week1Monday);
      weekMonday.setDate(week1Monday.getDate() + (weekNumber - 1) * 7);
      const weekSunday = new Date(weekMonday);
      weekSunday.setDate(weekMonday.getDate() + 6);
      return {
        from: weekMonday.toISOString().split('T')[0],
        to: weekSunday.toISOString().split('T')[0]
      };
    } catch (error) {
      console.error("Error calculating week date range:", error);
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(today.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        from: monday.toISOString().split('T')[0],
        to: sunday.toISOString().split('T')[0]
      };
    }
  }

  // Toggle user selection for reminders
  const toggleReminderUser = (userId: string) => {
    setReminderUserIds(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Send reminder to selected users
  const handleSendReminder = async () => {
    if (reminderUserIds.length === 0 || !reminderWeekNumber || !reminderYear) {
      toast({
        title: "Missing Information",
        description: "Please select at least one user, week number, and year",
        variant: "destructive",
      });
      return;
    }

    const weekNum = parseInt(reminderWeekNumber);
    const year = parseInt(reminderYear);
    
    if (isNaN(weekNum) || weekNum < 1 || weekNum > 53) {
      toast({
        title: "Invalid Week Number",
        description: "Week number must be between 1 and 53",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(year) || year < 2020 || year > 2100) {
      toast({
        title: "Invalid Year",
        description: "Please enter a valid year",
        variant: "destructive",
      });
      return;
    }

    // Create reminders for all selected users
    const remindersToInsert = reminderUserIds.map(userId => {
      const user = users.find(u => u.id.toString() === userId);
      const userName = user?.name || user?.email || "User";
      return {
        user_id: userId.toString(),
        week_number: weekNum,
        year: year,
        message: `Please fill in your hours for week ${weekNum} of ${year}.`,
        created_by: currentUser?.id ? currentUser.id.toString() : null,
      };
    });

    console.log("Inserting reminders:", remindersToInsert);

    // Insert reminders into database
    const { data: insertedReminders, error } = await supabase
      .from("reminders")
      .insert(remindersToInsert)
      .select();

    console.log("Reminder insert result:", { insertedReminders, error });

    if (error) {
      console.error("Error inserting reminders:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const userNames = reminderUserIds.map(userId => {
      const user = users.find(u => u.id.toString() === userId);
      return user?.name || user?.email || "User";
    }).join(", ");

    toast({
      title: "Reminders Sent",
      description: `Reminders sent to ${reminderUserIds.length} user(s): ${userNames} for week ${weekNum} of ${year}.`,
    });

    // Reset form
    setReminderUserIds([]);
    setReminderWeekNumber("");
    setReminderYear(new Date().getFullYear().toString());
  };

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

  // Timebuzzer Sync
  const handleTimebuzzerSync = async () => {
    if (!timebuzzerSyncStartDate || !timebuzzerSyncEndDate) {
      toast({
        title: "Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    setTimebuzzerSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('timebuzzer-sync', {
        body: {
          action: 'sync-to-timesheet',
          startDate: timebuzzerSyncStartDate,
          endDate: timebuzzerSyncEndDate,
        },
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast({
          title: "Sync Successful",
          description: `Synced ${data.inserted || 0} time entries from Timebuzzer`,
        });
        
        // Reset dates
        setTimebuzzerSyncStartDate("");
        setTimebuzzerSyncEndDate("");
      } else {
        throw new Error(data.error || "Sync failed");
      }
    } catch (error: any) {
      toast({
        title: "Sync Error",
        description: error.message || "Failed to sync Timebuzzer data",
        variant: "destructive",
      });
    } finally {
      setTimebuzzerSyncing(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-8 bg-white rounded shadow w-full max-w-full">
      <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Admin Panel</h2>
      
      <div className="mb-6 sm:mb-8">
        <h3 className="text-base sm:text-lg font-semibold mb-2">Add User</h3>
        <form onSubmit={handleAddUser} className={`flex ${isMobile ? 'flex-col' : 'flex-row flex-wrap'} gap-3 sm:gap-4 ${isMobile ? '' : 'items-end'} w-full`}>
          <div className={isMobile ? 'w-full' : ''}>
            <Label className="text-sm">Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className="h-10 sm:h-9" />
          </div>
          <div className={isMobile ? 'w-full' : ''}>
            <Label className="text-sm">Name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-10 sm:h-9" />
          </div>
          <div className={isMobile ? 'w-full' : ''}>
            <Label className="text-sm">Password</Label>
            <Input 
              type="password" 
              value={form.password} 
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} 
              required 
              minLength={6}
              placeholder="Min. 6 characters"
              className="h-10 sm:h-9"
            />
            {form.password && form.password.length > 0 && form.password.length < 6 && (
              <p className="text-xs text-red-500 mt-1">Password must be at least 6 characters.</p>
            )}
          </div>
          <div className={`flex items-center gap-2 ${isMobile ? 'w-full' : ''}`}>
            <input type="checkbox" id="isAdmin" checked={form.isAdmin} onChange={e => setForm(f => ({ ...f, isAdmin: e.target.checked }))} className="h-4 w-4" />
            <Label htmlFor="isAdmin" className="text-sm">Admin</Label>
          </div>
          <div className={`flex items-center gap-2 ${isMobile ? 'w-full' : ''}`}>
            <input type="checkbox" id="must_change_password" checked={form.must_change_password} onChange={e => setForm(f => ({ ...f, must_change_password: e.target.checked }))} className="h-4 w-4" />
            <Label htmlFor="must_change_password" className="text-sm">Must change password</Label>
          </div>
          <Button type="submit" className={`${isMobile ? 'w-full' : ''} h-10 sm:h-9`} size={isMobile ? "lg" : "default"}>Add User</Button>
        </form>
      </div>
      
      {/* Send Reminder Section */}
      <div className="mb-6 sm:mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-base sm:text-lg font-semibold mb-3 text-blue-800">Send Timesheet Reminder</h3>
        <p className="text-xs sm:text-sm text-blue-700 mb-4">Select one or more users to send a reminder to fill in their hours for a specific week.</p>
        <div className="mb-4">
          <Label className="text-sm font-semibold mb-2 block">Select Users</Label>
          <div className="max-h-48 overflow-y-auto border rounded-lg p-3 bg-white">
            {users.length === 0 ? (
              <p className="text-sm text-gray-500">No users available</p>
            ) : (
              <div className="space-y-2">
                {users.map(user => (
                  <div key={user.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`reminder-user-${user.id}`}
                      checked={reminderUserIds.includes(user.id.toString())}
                      onChange={() => toggleReminderUser(user.id.toString())}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`reminder-user-${user.id}`} className="text-sm cursor-pointer">
                      {user.name || user.email} {user.isAdmin && <span className="text-xs text-blue-600">(Admin)</span>}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>
          {reminderUserIds.length > 0 && (
            <p className="text-xs text-blue-600 mt-2">{reminderUserIds.length} user(s) selected</p>
          )}
        </div>
        <div className={`flex ${isMobile ? 'flex-col' : 'flex-row flex-wrap'} gap-3 sm:gap-4 ${isMobile ? '' : 'items-end'} w-full`}>
          <div className={isMobile ? 'w-full' : ''}>
            <Label className="text-sm">Week Number</Label>
            <Input 
              type="number" 
              value={reminderWeekNumber} 
              onChange={e => setReminderWeekNumber(e.target.value)} 
              placeholder="e.g. 51"
              min="1"
              max="53"
              className="h-10 sm:h-9"
            />
          </div>
          <div className={isMobile ? 'w-full' : ''}>
            <Label className="text-sm">Year</Label>
            <Input 
              type="number" 
              value={reminderYear} 
              onChange={e => setReminderYear(e.target.value)} 
              placeholder="2025"
              min="2020"
              max="2100"
              className="h-10 sm:h-9"
            />
          </div>
          <Button 
            onClick={handleSendReminder}
            className={`${isMobile ? 'w-full' : ''} h-10 sm:h-9 bg-blue-600 hover:bg-blue-700`}
            size={isMobile ? "lg" : "default"}
            disabled={reminderUserIds.length === 0 || !reminderWeekNumber || !reminderYear}
          >
            Send Reminder{reminderUserIds.length > 0 ? ` (${reminderUserIds.length})` : ''}
          </Button>
        </div>
      </div>
      
      {/* Pending Users Section */}
      {users.filter(u => u.approved === false).length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold mb-2 text-orange-600">Pending Approval</h3>
          {isMobile ? (
            <div className="space-y-3">
              {users.filter(u => u.approved === false).map(user => (
                <div key={user.id} className="border rounded-lg p-3 bg-orange-50">
                  <div className="mb-2">
                    <div className="font-semibold text-sm">{user.email}</div>
                    <div className="text-xs text-gray-600">{user.name || "-"}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" onClick={() => handleApproveUser(user.id, user.email)} className="flex-1 h-9">
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteUser(user.id, user.email)}
                      className="flex-1 h-9"
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
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
          )}
        </div>
      )}
      <div>
        <h3 className="text-base sm:text-lg font-semibold mb-2">Existing Users</h3>
        {loading ? (
          <div className="text-sm">Loading...</div>
        ) : isMobile ? (
          /* Mobile: Card Layout */
          <div className="space-y-3">
            {users.filter(u => u.approved !== false).map(user => (
              <div key={user.id} className="border rounded-lg p-3 bg-gray-50">
                <div className="mb-3">
                  <div className="font-semibold text-sm mb-1">
                    {user.email}
                    {user.email === SUPER_ADMIN_EMAIL && <span className="ml-2 px-2 py-0.5 text-xs bg-orange-200 text-orange-800 rounded">Super Admin</span>}
                  </div>
                  <div className="text-xs text-gray-600">{user.name}</div>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Admin:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!user.isAdmin}
                        disabled={user.email === SUPER_ADMIN_EMAIL}
                        onChange={(e) => handleToggleAdmin(user.id, user.email, e.target.checked)}
                        className="h-3 w-3"
                      />
                      <span>{user.isAdmin ? "Yes" : "No"}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Approved:</span>
                    <span>{user.approved !== false ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Must Change Password:</span>
                    <span>{user.must_change_password ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Days Off Left:</span>
                    <span className="font-semibold">{(totalDaysOff - ((daysOffMap[user.id] || 0) / 8)).toFixed(2)} / {totalDaysOff}</span>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {resetUserId === user.id ? (
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="New password"
                        value={resetPassword}
                        onChange={e => setResetPassword(e.target.value)}
                        className="h-9 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleResetPassword(user.id)} className="flex-1 h-9">Save</Button>
                        <Button size="sm" variant="outline" onClick={() => { setResetUserId(null); setResetPassword(""); }} className="flex-1 h-9">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setResetUserId(user.id)} className="flex-1 h-9 text-xs">Reset Password</Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        disabled={user.id === currentUser.id || user.email === SUPER_ADMIN_EMAIL}
                        className="flex-1 h-9 text-xs"
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Input
                      type="number"
                      min="0.25"
                      step="0.25"
                      placeholder="Hours"
                      value={daysOffInput[user.id] || ""}
                      onChange={e => setDaysOffInput(prev => ({ ...prev, [user.id]: e.target.value }))}
                      className="h-9 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAddOrDeductDaysOff(user.id, -Math.abs(parseFloat(daysOffInput[user.id] || "0")))} className="flex-1 h-9 text-xs">
                        Add
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleAddOrDeductDaysOff(user.id, Math.abs(parseFloat(daysOffInput[user.id] || "0")))} className="flex-1 h-9 text-xs">
                        Deduct
                      </Button>
                    </div>
                    <span className="text-xs text-gray-500">(1 day = 8 hours)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop: Table Layout */
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
                            className="h-8"
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
                          className="h-8"
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
        <div className="mt-6 sm:mt-8 mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-orange-600">⚠️ Weeks to Review</h3>
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
                  <div key={`${cw.user_id}-${cw.week_start_date}`} className="border rounded-lg p-3 sm:p-4 bg-orange-50 shadow">
                    <div className={`flex ${isMobile ? 'flex-col' : 'flex-row sm:items-center sm:justify-between'} gap-3 sm:gap-4 mb-3 sm:mb-4`}>
                      <div>
                        <div className="font-semibold text-base sm:text-lg">
                          {user?.name || user?.email || 'Unknown user'} - Week {weekNum}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600">
                          {weekStart.toLocaleDateString('en-US')} - {weekEnd.toLocaleDateString('en-US')}
                        </div>
                        <div className="text-xs sm:text-sm font-medium mt-1">
                          Total: {totalHours.toFixed(2)} hours ({weekEntries.length} entries)
                        </div>
                      </div>
                      <div className={`flex ${isMobile ? 'flex-col' : 'flex-wrap'} gap-2`}>
                        <Button
                          size={isMobile ? "sm" : "sm"}
                          variant="default"
                          className={`${isMobile ? 'w-full' : ''} bg-green-600 hover:bg-green-700 h-9 sm:h-8`}
                          onClick={() => handleApproveWeek(cw.user_id, cw.week_start_date)}
                        >
                          ✓ Approve
                        </Button>
                        <Button
                          size={isMobile ? "sm" : "sm"}
                          variant="destructive"
                          className={`${isMobile ? 'w-full' : ''} h-9 sm:h-8`}
                          onClick={() => handleRejectWeek(cw.user_id, cw.week_start_date)}
                        >
                          ✗ Reject
                        </Button>
                        <Button
                          size={isMobile ? "sm" : "sm"}
                          variant="outline"
                          className={`${isMobile ? 'w-full' : ''} border-orange-600 text-orange-600 hover:bg-orange-100 h-9 sm:h-8`}
                          onClick={() => handleUnlockWeek(cw.user_id, cw.week_start_date)}
                        >
                          🔓 Unlock
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
      {/* All Confirmed Weeks Section */}
      <div className="mt-8 sm:mt-12">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-green-600">✓ All Confirmed Weeks</h3>
        <div className="space-y-3">
          {users.map(user => {
            const userConfirmedWeeks = confirmedWeeks.filter(
              cw => cw.user_id === user.id && cw.confirmed
            );
            
            if (userConfirmedWeeks.length === 0) {
              return null;
            }
            
            return (
              <div key={user.id} className="border rounded-lg p-3 sm:p-4 bg-white shadow">
                <div className="font-semibold text-base sm:text-lg mb-3">
                  {user.name || user.email}
                </div>
                <div className="space-y-2">
                  {userConfirmedWeeks.map((cw) => {
                    const weekStart = new Date(cw.week_start_date);
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    const weekNum = getISOWeek(cw.week_start_date);
                    const weekEntries = allEntries.filter(
                      e => e.user_id === cw.user_id && 
                      e.date >= cw.week_start_date && 
                      e.date <= weekEnd.toISOString().split('T')[0]
                    );
                    const totalHours = weekEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);
                    
                    return (
                      <div key={`${cw.user_id}-${cw.week_start_date}`} className="border rounded p-2 bg-gray-50">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <div className="font-medium text-sm sm:text-base">
                              Week {weekNum} ({weekStart.toLocaleDateString('en-US')} - {weekEnd.toLocaleDateString('en-US')})
                            </div>
                            <div className="text-xs sm:text-sm text-gray-600">
                              Total: {totalHours.toFixed(2)} hours ({weekEntries.length} entries)
                            </div>
                            <div className="text-xs sm:text-sm mt-1">
                              Status: {cw.admin_approved ? (
                                <span className="text-green-600 font-semibold">✓ Approved</span>
                              ) : cw.admin_reviewed ? (
                                <span className="text-red-600 font-semibold">✗ Rejected</span>
                              ) : (
                                <span className="text-orange-600 font-semibold">⏳ Pending Review</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {!cw.admin_approved && (
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700 h-8"
                                onClick={() => handleApproveWeek(cw.user_id, cw.week_start_date)}
                              >
                                ✓ Approve
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-orange-600 text-orange-600 hover:bg-orange-100 h-8"
                              onClick={() => handleUnlockWeek(cw.user_id, cw.week_start_date)}
                            >
                              🔓 Unlock
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {confirmedWeeks.filter(cw => cw.confirmed).length === 0 && (
            <div className="text-gray-400 text-center italic p-6 border rounded-lg bg-gray-50">
              No confirmed weeks yet.
            </div>
          )}
        </div>
      </div>
      
      {/* Below user table: User Weekly Entries Accordion */}
      <div className="mt-8 sm:mt-12">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">View User Weekly Entries</h3>
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

      {/* Timebuzzer Sync Section */}
      <div className="mb-6 sm:mb-8 p-4 bg-green-50 border border-green-200 rounded-lg">
        <h3 className="text-base sm:text-lg font-semibold mb-3 text-green-800">Timebuzzer Integration</h3>
        <p className="text-xs sm:text-sm text-green-700 mb-4">
          Sync time entries from Timebuzzer to your timesheet. Make sure users and projects are mapped in the database first.
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Start Date</Label>
              <Input
                type="date"
                value={timebuzzerSyncStartDate}
                onChange={(e) => setTimebuzzerSyncStartDate(e.target.value)}
                className="h-10 sm:h-9"
                disabled={timebuzzerSyncing}
              />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">End Date</Label>
              <Input
                type="date"
                value={timebuzzerSyncEndDate}
                onChange={(e) => setTimebuzzerSyncEndDate(e.target.value)}
                className="h-10 sm:h-9"
                disabled={timebuzzerSyncing}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleTimebuzzerSync}
              disabled={timebuzzerSyncing || !timebuzzerSyncStartDate || !timebuzzerSyncEndDate}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
            >
              {timebuzzerSyncing ? "Syncing..." : "Sync from Timebuzzer"}
            </Button>
            <Button
              onClick={async () => {
                setTimebuzzerSyncing(true);
                try {
                  console.log('Testing Timebuzzer API...');
                  const { data, error } = await supabase.functions.invoke('timebuzzer-sync', {
                    body: { action: 'test-api' },
                  });
                  
                  console.log('Response:', { data, error });
                  
                  if (error) {
                    console.error('Error details:', error);
                    throw error;
                  }
                  
                  if (data?.success) {
                    console.log('Timebuzzer API Test Response:', data);
                    toast({
                      title: "API Test Successful",
                      description: `Status: ${data.status || 'OK'}. Check console for full response.`,
                    });
                  } else {
                    console.error('API test failed:', data);
                    toast({
                      title: "API Test Failed",
                      description: data?.error || 'Unknown error. Check console.',
                      variant: "destructive",
                    });
                  }
                } catch (error: any) {
                  console.error('Test API Error:', error);
                  toast({
                    title: "Test Error",
                    description: error.message || 'Failed to send a request to the Edge Function',
                    variant: "destructive",
                  });
                } finally {
                  setTimebuzzerSyncing(false);
                }
              }}
              disabled={timebuzzerSyncing}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Test API
            </Button>
          </div>
          <p className="text-xs text-green-600">
            Note: Users and projects must be mapped with Timebuzzer IDs in the database before syncing.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel; 