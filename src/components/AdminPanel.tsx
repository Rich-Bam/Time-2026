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
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";

interface AdminPanelProps {
  currentUser: any;
}

const AdminPanel = ({ currentUser }: AdminPanelProps) => {
  const { t } = useLanguage();
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
  // Helper function to get ISO week number
  const getISOWeekNumber = (date: Date) => {
    const tempDate = new Date(date.getTime());
    tempDate.setHours(0, 0, 0, 0);
    tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
    const week1 = new Date(tempDate.getFullYear(), 0, 4);
    return (
      1 +
      Math.round(
        ((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
      )
    );
  };

  const [timebuzzerSyncWeekNumber, setTimebuzzerSyncWeekNumber] = useState<number>(() => {
    // Get current ISO week number
    const today = new Date();
    return getISOWeekNumber(today);
  });
  const [timebuzzerSyncYear, setTimebuzzerSyncYear] = useState<number>(new Date().getFullYear());
  const [timebuzzerTestResult, setTimebuzzerTestResult] = useState<any>(null);
  const [timebuzzerActivities, setTimebuzzerActivities] = useState<any[]>([]);
  const [selectedActivityIds, setSelectedActivityIds] = useState<Set<number>>(new Set());
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedTimebuzzerUserId, setSelectedTimebuzzerUserId] = useState<string>(""); // For testing Timebuzzer per user
  
  // Fetch projects for mapping
  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase.from("projects").select("id, name, timebuzzer_project_id");
      if (data) {
        setProjects(data);
      }
    };
    fetchProjects();
  }, []);

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("users").select("id, email, name, isAdmin, must_change_password, approved, can_use_timebuzzer, timebuzzer_user_id");
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

  // Toggle Timebuzzer access for a user (only super admin can do this)
  const handleToggleTimebuzzer = async (userId: string, userEmail: string, canUse: boolean) => {
    if (currentUser.email !== SUPER_ADMIN_EMAIL) {
      toast({
        title: "Action not allowed",
        description: "Only the super admin can manage Timebuzzer access.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.from("users").update({ can_use_timebuzzer: canUse }).eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Timebuzzer access updated",
        description: `${userEmail} ${canUse ? "can now" : "can no longer"} use Timebuzzer integration.`,
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
    <div className="p-3 sm:p-4 md:p-8 bg-white dark:bg-gray-800 rounded shadow w-full max-w-full">
      <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">{t('admin.title')}</h2>
      
      <div className="mb-6 sm:mb-8">
        <h3 className="text-base sm:text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('admin.addUser')}</h3>
        <form onSubmit={handleAddUser} className={`flex ${isMobile ? 'flex-col' : 'flex-row flex-wrap'} gap-3 sm:gap-4 ${isMobile ? '' : 'items-end'} w-full`}>
          <div className={isMobile ? 'w-full' : ''}>
            <Label className="text-sm">{t('admin.email')}</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className="h-10 sm:h-9" />
          </div>
          <div className={isMobile ? 'w-full' : ''}>
            <Label className="text-sm">{t('admin.name')}</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-10 sm:h-9" />
          </div>
          <div className={isMobile ? 'w-full' : ''}>
            <Label className="text-sm">{t('admin.password')}</Label>
            <Input 
              type="password" 
              value={form.password} 
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} 
              required 
              minLength={6}
              placeholder={t('admin.passwordPlaceholder')}
              className="h-10 sm:h-9"
            />
            {form.password && form.password.length > 0 && form.password.length < 6 && (
              <p className="text-xs text-red-500 mt-1">{t('admin.passwordMinLength')}</p>
            )}
          </div>
          <div className={`flex items-center gap-2 ${isMobile ? 'w-full' : ''}`}>
            <input type="checkbox" id="isAdmin" checked={form.isAdmin} onChange={e => setForm(f => ({ ...f, isAdmin: e.target.checked }))} className="h-4 w-4" />
            <Label htmlFor="isAdmin" className="text-sm">{t('admin.isAdmin')}</Label>
          </div>
          <div className={`flex items-center gap-2 ${isMobile ? 'w-full' : ''}`}>
            <input type="checkbox" id="must_change_password" checked={form.must_change_password} onChange={e => setForm(f => ({ ...f, must_change_password: e.target.checked }))} className="h-4 w-4" />
            <Label htmlFor="must_change_password" className="text-sm">{t('admin.mustChangePassword')}</Label>
          </div>
          <Button type="submit" className={`${isMobile ? 'w-full' : ''} h-10 sm:h-9`} size={isMobile ? "lg" : "default"}>{t('admin.createUser')}</Button>
        </form>
      </div>
      
      {/* Send Reminder Section */}
      <div className="mb-6 sm:mb-8 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-base sm:text-lg font-semibold mb-3 text-blue-800 dark:text-blue-200">{t('admin.sendReminder')}</h3>
        <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 mb-4">{t('admin.sendReminderDescription')}</p>
        <div className="mb-4">
          <Label className="text-sm font-semibold mb-2 block">{t('admin.selectUsers')}</Label>
          <div className="max-h-48 overflow-y-auto border rounded-lg p-3 bg-white dark:bg-gray-700">
            {users.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.noUsers')}</p>
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
                    <Label htmlFor={`reminder-user-${user.id}`} className="text-sm cursor-pointer text-gray-900 dark:text-gray-100">
                      {user.name || user.email} {user.isAdmin && <span className="text-xs text-blue-600 dark:text-blue-400">(Admin)</span>}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>
          {reminderUserIds.length > 0 && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">{reminderUserIds.length} user(s) selected</p>
          )}
        </div>
        <div className={`flex ${isMobile ? 'flex-col' : 'flex-row flex-wrap'} gap-3 sm:gap-4 ${isMobile ? '' : 'items-end'} w-full`}>
          <div className={isMobile ? 'w-full' : ''}>
            <Label className="text-sm">{t('admin.weekNumber')}</Label>
            <Input 
              type="number" 
              value={reminderWeekNumber} 
              onChange={e => setReminderWeekNumber(e.target.value)} 
              placeholder={t('admin.weekNumberPlaceholder')}
              min="1"
              max="53"
              className="h-10 sm:h-9"
            />
          </div>
          <div className={isMobile ? 'w-full' : ''}>
            <Label className="text-sm">{t('admin.year')}</Label>
            <Input 
              type="number" 
              value={reminderYear} 
              onChange={e => setReminderYear(e.target.value)} 
              placeholder={t('admin.yearPlaceholder')}
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
            {t('admin.sendReminderButton')}{reminderUserIds.length > 0 ? ` (${reminderUserIds.length})` : ''}
          </Button>
        </div>
      </div>
      
      {/* Pending Users Section */}
      {users.filter(u => u.approved === false).length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold mb-2 text-orange-600 dark:text-orange-400">{t('admin.pendingApproval')}</h3>
          {isMobile ? (
            <div className="space-y-3">
              {users.filter(u => u.approved === false).map(user => (
                <div key={user.id} className="border rounded-lg p-3 bg-orange-50 dark:bg-orange-900/30">
                  <div className="mb-2">
                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{user.email}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">{user.name || "-"}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" onClick={() => handleApproveUser(user.id, user.email)} className="flex-1 h-9">
                      {t('admin.approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteUser(user.id, user.email)}
                      className="flex-1 h-9"
                    >
                      {t('admin.reject')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="min-w-full border mt-2 text-sm">
                <thead>
                  <tr className="bg-orange-100 dark:bg-orange-900/30">
                    <th className="p-2 text-left text-gray-900 dark:text-gray-100">{t('admin.email')}</th>
                    <th className="p-2 text-left text-gray-900 dark:text-gray-100">{t('admin.name')}</th>
                    <th className="p-2 text-left text-gray-900 dark:text-gray-100">{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => u.approved === false).map(user => (
                    <tr key={user.id} className="border-t dark:border-gray-700">
                      <td className="p-2 text-gray-900 dark:text-gray-100">{user.email}</td>
                      <td className="p-2 text-gray-900 dark:text-gray-100">{user.name || "-"}</td>
                      <td className="p-2">
                        <Button size="sm" variant="default" onClick={() => handleApproveUser(user.id, user.email)}>
                          {t('admin.approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="ml-2"
                          onClick={() => handleDeleteUser(user.id, user.email)}
                        >
                          {t('admin.reject')}
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
        <h3 className="text-base sm:text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('admin.existingUsers')}</h3>
        {loading ? (
          <div className="text-sm">{t('common.loading')}</div>
        ) : isMobile ? (
          /* Mobile: Card Layout */
          <div className="space-y-3">
            {users.filter(u => u.approved !== false).map(user => (
              <div key={user.id} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-700">
                <div className="mb-3">
                  <div className="font-semibold text-sm mb-1 text-gray-900 dark:text-gray-100">
                    {user.email}
                    {user.email === SUPER_ADMIN_EMAIL && <span className="ml-2 px-2 py-0.5 text-xs bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 rounded">Super Admin</span>}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{user.name}</div>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('admin.isAdmin')}:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!user.isAdmin}
                        disabled={user.email === SUPER_ADMIN_EMAIL}
                        onChange={(e) => handleToggleAdmin(user.id, user.email, e.target.checked)}
                        className="h-3 w-3"
                      />
                      <span>{user.isAdmin ? "Ja" : "Nee"}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('admin.approved')}:</span>
                    <span className="text-gray-900 dark:text-gray-100">{user.approved !== false ? "Ja" : "Nee"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('admin.mustChangePassword')}:</span>
                    <span className="text-gray-900 dark:text-gray-100">{user.must_change_password ? "Ja" : "Nee"}</span>
                  </div>
                  {currentUser.email === SUPER_ADMIN_EMAIL && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Timebuzzer:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!user.can_use_timebuzzer}
                          onChange={(e) => handleToggleTimebuzzer(user.id, user.email, e.target.checked)}
                          className="h-3 w-3"
                        />
                        <span>{user.can_use_timebuzzer ? "Ja" : "Nee"}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('admin.daysOffLeft')}:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{(totalDaysOff - ((daysOffMap[user.id] || 0) / 8)).toFixed(2)} / {totalDaysOff}</span>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {resetUserId === user.id ? (
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="Nieuw wachtwoord"
                        value={resetPassword}
                        onChange={e => setResetPassword(e.target.value)}
                        className="h-9 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleResetPassword(user.id)} className="flex-1 h-9">{t('common.save')}</Button>
                        <Button size="sm" variant="outline" onClick={() => { setResetUserId(null); setResetPassword(""); }} className="flex-1 h-9">{t('common.cancel')}</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setResetUserId(user.id)} className="flex-1 h-9 text-xs">{t('admin.resetPassword')}</Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        disabled={user.id === currentUser.id || user.email === SUPER_ADMIN_EMAIL}
                        className="flex-1 h-9 text-xs"
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Input
                      type="number"
                      min="0.25"
                      step="0.25"
                      placeholder="Uren"
                      value={daysOffInput[user.id] || ""}
                      onChange={e => setDaysOffInput(prev => ({ ...prev, [user.id]: e.target.value }))}
                      className="h-9 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAddOrDeductDaysOff(user.id, -Math.abs(parseFloat(daysOffInput[user.id] || "0")))} className="flex-1 h-9 text-xs">
                        Toevoegen
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleAddOrDeductDaysOff(user.id, Math.abs(parseFloat(daysOffInput[user.id] || "0")))} className="flex-1 h-9 text-xs">
                        Aftrekken
                      </Button>
                    </div>
                    <span className="text-xs text-gray-500">(1 dag = 8 uren)</span>
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
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="p-2 text-left text-gray-900 dark:text-gray-100">{t('admin.email')}</th>
                  <th className="p-2 text-left text-gray-900 dark:text-gray-100">{t('admin.name')}</th>
                  <th className="p-2 text-left text-gray-900 dark:text-gray-100">{t('admin.isAdmin')}</th>
                  <th className="p-2 text-left text-gray-900 dark:text-gray-100">{t('admin.approved')}</th>
                  <th className="p-2 text-left text-gray-900 dark:text-gray-100">{t('admin.mustChangePassword')}</th>
                  {currentUser.email === SUPER_ADMIN_EMAIL && (
                    <th className="p-2 text-left text-gray-900 dark:text-gray-100">Timebuzzer</th>
                  )}
                  <th className="p-2 text-left text-gray-900 dark:text-gray-100">{t('admin.daysOffLeft')}</th>
                  <th className="p-2 text-left text-gray-900 dark:text-gray-100">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => u.approved !== false).map(user => (
                  <tr key={user.id} className="border-t dark:border-gray-700">
                    <td className="p-2 text-gray-900 dark:text-gray-100">{user.email}{user.email === SUPER_ADMIN_EMAIL && <span className="ml-2 px-2 py-1 text-xs bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 rounded">Super Admin</span>}</td>
                    <td className="p-2 text-gray-900 dark:text-gray-100">{user.name}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!user.isAdmin}
                          disabled={user.email === SUPER_ADMIN_EMAIL}
                          onChange={(e) => handleToggleAdmin(user.id, user.email, e.target.checked)}
                        />
                        <span className="text-gray-900 dark:text-gray-100">{user.isAdmin ? "Ja" : "Nee"}</span>
                      </div>
                    </td>
                    <td className="p-2 text-gray-900 dark:text-gray-100">{user.approved !== false ? "Ja" : "Nee"}</td>
                    <td className="p-2 text-gray-900 dark:text-gray-100">{user.must_change_password ? "Ja" : "Nee"}</td>
                    {currentUser.email === SUPER_ADMIN_EMAIL && (
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!user.can_use_timebuzzer}
                            onChange={(e) => handleToggleTimebuzzer(user.id, user.email, e.target.checked)}
                            className="h-4 w-4"
                          />
                          <span className="text-gray-900 dark:text-gray-100">{user.can_use_timebuzzer ? "Ja" : "Nee"}</span>
                        </div>
                      </td>
                    )}
                    <td className="p-2 text-gray-900 dark:text-gray-100">{(totalDaysOff - ((daysOffMap[user.id] || 0) / 8)).toFixed(2)} / {totalDaysOff}</td>
                    <td className="p-2">
                      {resetUserId === user.id ? (
                        <div className="flex gap-2 items-center">
                          <Input
                            type="text"
                            placeholder="Nieuw wachtwoord"
                            value={resetPassword}
                            onChange={e => setResetPassword(e.target.value)}
                            className="h-8"
                          />
                          <Button size="sm" onClick={() => handleResetPassword(user.id)}>{t('common.save')}</Button>
                          <Button size="sm" variant="outline" onClick={() => { setResetUserId(null); setResetPassword(""); }}>{t('common.cancel')}</Button>
                        </div>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setResetUserId(user.id)}>{t('admin.resetPassword')}</Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="ml-2"
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            disabled={user.id === currentUser.id || user.email === SUPER_ADMIN_EMAIL}
                            title={user.id === currentUser.id ? "Je kunt je eigen account niet verwijderen." : user.email === SUPER_ADMIN_EMAIL ? "Je kunt de super admin niet verwijderen." : "Verwijder gebruiker"}
                          >
                            {t('common.delete')}
                          </Button>
                        </>
                      )}
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 mt-2">
                        <Input
                          type="number"
                          min="0.25"
                          step="0.25"
                          placeholder="Uren"
                          value={daysOffInput[user.id] || ""}
                          onChange={e => setDaysOffInput(prev => ({ ...prev, [user.id]: e.target.value }))}
                          style={{ width: 70 }}
                          className="h-8"
                        />
                        <Button size="sm" onClick={() => handleAddOrDeductDaysOff(user.id, -Math.abs(parseFloat(daysOffInput[user.id] || "0")))}>
                          Toevoegen
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleAddOrDeductDaysOff(user.id, Math.abs(parseFloat(daysOffInput[user.id] || "0")))}>
                          Aftrekken
                        </Button>
                      </div>
                      <span className="text-xs text-gray-500">(1 dag = 8 uren)</span>
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
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-orange-600">⚠️ {t('admin.weeksToReview')}</h3>
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
                          {user?.name || user?.email || t('admin.unknownUser')} - {t('admin.week')} {weekNum}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600">
                          {weekStart.toLocaleDateString('nl-NL')} - {weekEnd.toLocaleDateString('nl-NL')}
                        </div>
                        <div className="text-xs sm:text-sm font-medium mt-1">
                          {t('admin.total')}: {totalHours.toFixed(2)} {t('admin.hoursLower')} ({weekEntries.length} {t('admin.entries')})
                        </div>
                      </div>
                      <div className={`flex ${isMobile ? 'flex-col' : 'flex-wrap'} gap-2`}>
                        <Button
                          size={isMobile ? "sm" : "sm"}
                          variant="default"
                          className={`${isMobile ? 'w-full' : ''} bg-green-600 hover:bg-green-700 h-9 sm:h-8`}
                          onClick={() => handleApproveWeek(cw.user_id, cw.week_start_date)}
                        >
                          {t('admin.approveButton')}
                        </Button>
                        <Button
                          size={isMobile ? "sm" : "sm"}
                          variant="destructive"
                          className={`${isMobile ? 'w-full' : ''} h-9 sm:h-8`}
                          onClick={() => handleRejectWeek(cw.user_id, cw.week_start_date)}
                        >
                          {t('admin.rejectButton')}
                        </Button>
                        <Button
                          size={isMobile ? "sm" : "sm"}
                          variant="outline"
                          className={`${isMobile ? 'w-full' : ''} border-orange-600 text-orange-600 hover:bg-orange-100 h-9 sm:h-8`}
                          onClick={() => handleUnlockWeek(cw.user_id, cw.week_start_date)}
                        >
                          {t('admin.unlockButton')}
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
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-green-600">{t('admin.allConfirmedWeeks')}</h3>
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
                    const weekNum = getISOWeekNumber(weekStart);
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
                              {t('admin.week')} {weekNum} ({weekStart.toLocaleDateString('nl-NL')} - {weekEnd.toLocaleDateString('nl-NL')})
                            </div>
                            <div className="text-xs sm:text-sm text-gray-600">
                              {t('admin.total')}: {totalHours.toFixed(2)} {t('admin.hoursLower')} ({weekEntries.length} {t('admin.entries')})
                            </div>
                            <div className="text-xs sm:text-sm mt-1">
                              {t('admin.status')}: {cw.admin_approved ? (
                                <span className="text-green-600 font-semibold">{t('admin.approvedStatus')}</span>
                              ) : cw.admin_reviewed ? (
                                <span className="text-red-600 font-semibold">{t('admin.rejectedStatus')}</span>
                              ) : (
                                <span className="text-orange-600 font-semibold">{t('admin.pendingReviewStatus')}</span>
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
                                {t('admin.approveButton')}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-orange-600 text-orange-600 hover:bg-orange-100 h-8"
                              onClick={() => handleUnlockWeek(cw.user_id, cw.week_start_date)}
                            >
                              {t('admin.unlockButton')}
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
              {t('admin.noConfirmedWeeks')}
            </div>
          )}
        </div>
      </div>
      
      {/* Below user table: User Weekly Entries Accordion */}
      <div className="mt-8 sm:mt-12">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">{t('admin.viewUserWeeklyEntries')}</h3>
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
                      <div className="p-6 text-gray-400 text-center italic">{t('admin.noEntriesForUser')}</div>
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
                                    <th className="p-2 border">{t('admin.date')}</th>
                                    <th className="p-2 border">{t('weekly.project')}</th>
                                    <th className="p-2 border">{t('weekly.hours')}</th>
                                    <th className="p-2 border">{t('admin.workType')}</th>
                                    <th className="p-2 border">Beschrijving</th>
                                    <th className="p-1 border">Start - Eind</th>
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
      <div className="mb-6 sm:mb-8 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
        <h3 className="text-base sm:text-lg font-semibold mb-3 text-green-800">Timebuzzer Integration</h3>
        <p className="text-xs sm:text-sm text-green-700 mb-4">
          Sync time entries from Timebuzzer to your timesheet. Make sure users and projects are mapped in the database first.
        </p>
        
        {/* Mapping Helper Section */}
        {timebuzzerTestResult && timebuzzerTestResult.success && timebuzzerTestResult.data && timebuzzerTestResult.data.activities && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="text-sm font-semibold text-yellow-800 mb-2">⚠️ Mapping Required</h4>
            <p className="text-xs text-yellow-700 mb-2">
              Activities worden overgeslagen omdat user- of projectmappings ontbreken. Gebruik de Test API om de Timebuzzer IDs te zien, en voeg ze toe aan de database:
            </p>
            <div className="text-xs text-yellow-700 space-y-1">
              <div><strong>Voor Users:</strong> UPDATE users SET timebuzzer_user_id = 'ID' WHERE email = 'email';</div>
              <div><strong>Voor Projects:</strong> UPDATE projects SET timebuzzer_project_id = 'ID' WHERE name = 'name';</div>
            </div>
            {timebuzzerTestResult.data.activities.length > 0 && (
              <div className="mt-2 text-xs">
                <div className="font-medium">Gevonden in Test API:</div>
                <div className="mt-1 space-y-1">
                  {Array.from(new Set(timebuzzerTestResult.data.activities.map((a: any) => a.userId))).map((userId: any) => (
                    <div key={userId}>User ID: {userId} - {timebuzzerTestResult.data.activities.find((a: any) => a.userId === userId)?.userName || 'Unknown'}</div>
                  ))}
                  {Array.from(new Set(timebuzzerTestResult.data.activities.flatMap((a: any) => a.tiles || []))).map((tileId: any) => (
                    <div key={tileId}>Tile ID: {tileId} - {timebuzzerTestResult.data.activities.find((a: any) => a.tiles?.includes(tileId))?.tileNames?.[0] || 'Unknown'}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Week Number</Label>
              <Input
                type="number"
                min="1"
                max="53"
                value={timebuzzerSyncWeekNumber}
                onChange={(e) => setTimebuzzerSyncWeekNumber(parseInt(e.target.value) || 1)}
                className="h-10 sm:h-9"
                disabled={timebuzzerSyncing}
                placeholder="e.g. 51"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">Year</Label>
              <Input
                type="number"
                min="2020"
                max="2100"
                value={timebuzzerSyncYear}
                onChange={(e) => setTimebuzzerSyncYear(parseInt(e.target.value) || new Date().getFullYear())}
                className="h-10 sm:h-9"
                disabled={timebuzzerSyncing}
                placeholder="e.g. 2025"
              />
            </div>
          </div>
          {timebuzzerSyncWeekNumber && timebuzzerSyncYear && (
            <div className="text-xs text-green-600 bg-green-100 p-2 rounded">
              <span className="font-medium">Week {timebuzzerSyncWeekNumber}, {timebuzzerSyncYear}:</span> {
                (() => {
                  const range = getWeekDateRange(timebuzzerSyncWeekNumber, timebuzzerSyncYear);
                  const fromDate = new Date(range.from);
                  const toDate = new Date(range.to);
                  return `${fromDate.toLocaleDateString('nl-NL')} - ${toDate.toLocaleDateString('nl-NL')}`;
                })()
              }
            </div>
          )}
          {/* User selection for Timebuzzer testing */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Filter by User (Optional)</Label>
            <Select
              value={selectedTimebuzzerUserId || "all"}
              onValueChange={(value) => {
                console.log('User selection changed:', value);
                setSelectedTimebuzzerUserId(value === "all" ? "" : value);
              }}
            >
              <SelectTrigger className="h-10 sm:h-9">
                <SelectValue placeholder="All users (default)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users (default)</SelectItem>
                {users
                  .filter((u: any) => u.timebuzzer_user_id) // Only show users with Timebuzzer mapping
                  .map((user: any) => (
                    <SelectItem key={user.id} value={user.timebuzzer_user_id}>
                      {user.name || user.email} ({user.timebuzzer_user_id})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Select a user to test Timebuzzer API for that specific user only. Leave empty to test for all users.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                if (!timebuzzerSyncWeekNumber || !timebuzzerSyncYear) {
                  toast({
                    title: "Error",
                    description: "Please select a week number and year",
                    variant: "destructive",
                  });
                  return;
                }
                
                setLoadingActivities(true);
                setTimebuzzerActivities([]);
                setSelectedActivityIds(new Set());
                
                try {
                  // Calculate date range from week number
                  const dateRange = getWeekDateRange(timebuzzerSyncWeekNumber, timebuzzerSyncYear);
                  
                  console.log(`Fetching Timebuzzer activities for week ${timebuzzerSyncWeekNumber}, ${timebuzzerSyncYear}`);
                  if (selectedTimebuzzerUserId) {
                    console.log(`Filtering by Timebuzzer user ID: ${selectedTimebuzzerUserId}`);
                  }
                  console.log(`Date range: ${dateRange.from} to ${dateRange.to}`);
                  
                  // Fetch activities without syncing
                  const requestBody: any = {
                    action: 'fetch-activities',
                    startDate: dateRange.from,
                    endDate: dateRange.to,
                  };
                  if (selectedTimebuzzerUserId && selectedTimebuzzerUserId !== 'all') {
                    requestBody.userId = selectedTimebuzzerUserId;
                  }
                  
                  console.log('Fetch activities request:', requestBody);
                  const { data, error } = await supabase.functions.invoke('timebuzzer-sync', {
                    body: requestBody,
                  });
                  
                  console.log('Fetch activities response:', { data, error });
                  if (data && data.activities) {
                    console.log(`Received ${data.activities.length} activities`);
                    if (selectedTimebuzzerUserId && selectedTimebuzzerUserId !== 'all' && data.activities.length === 0) {
                      console.warn(`No activities found for user ${selectedTimebuzzerUserId} in week ${timebuzzerSyncWeekNumber}, ${timebuzzerSyncYear}`);
                    }
                  }
                  
                  if (error) {
                    console.error('Fetch error:', error);
                    toast({
                      title: "Error",
                      description: error.message || 'Failed to fetch activities from Timebuzzer',
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  if (data && data.success) {
                    if (data.activities && data.activities.length > 0) {
                      setTimebuzzerActivities(data.activities);
                      // Select all by default
                      setSelectedActivityIds(new Set(data.activities.map((a: any) => a.id)));
                      
                      // Check if we have mappings by looking at user and tile IDs in activities
                      const uniqueUserIds = new Set(data.activities.map((a: any) => a.userId));
                      const uniqueTileIds = new Set(data.activities.flatMap((a: any) => a.tiles || []));
                      
                      toast({
                        title: "Activities Loaded",
                        description: `Found ${data.activities.length} activities. Select which ones to add to weekly entries.${uniqueUserIds.size > 0 || uniqueTileIds.size > 0 ? ' Make sure users and projects are mapped in the database.' : ''}`,
                      });
                    } else {
                      // No activities found
                      let description = 'No activities found for this week';
                      if (selectedTimebuzzerUserId && selectedTimebuzzerUserId !== 'all') {
                        description = `No activities found for user ${selectedTimebuzzerUserId} in week ${timebuzzerSyncWeekNumber}, ${timebuzzerSyncYear}. `;
                        description += 'This could mean: (1) The user has no activities in this date range, (2) The API key doesn\'t have access to this user\'s activities, or (3) The userId mapping is incorrect.';
                        if (data.availableUserIds && Array.isArray(data.availableUserIds) && data.availableUserIds.length > 0) {
                          description += ` Available user IDs in this date range: ${data.availableUserIds.join(', ')}`;
                        }
                      }
                      toast({
                        title: "No Activities",
                        description: description,
                        variant: "default",
                      });
                      setTimebuzzerActivities([]);
                    }
                  } else {
                    toast({
                      title: "Error",
                      description: data?.error || 'Failed to fetch activities from Timebuzzer',
                      variant: "destructive",
                    });
                    setTimebuzzerActivities([]);
                  }
                } catch (error: any) {
                  console.error('Fetch error:', error);
                  toast({
                    title: "Error",
                    description: error.message || 'Failed to fetch activities from Timebuzzer',
                    variant: "destructive",
                  });
                } finally {
                  setLoadingActivities(false);
                }
              }}
              disabled={loadingActivities || !timebuzzerSyncWeekNumber || !timebuzzerSyncYear}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
            >
              {loadingActivities ? "Loading..." : "Load Activities from Timebuzzer"}
            </Button>
            <Button
              onClick={async () => {
                setTimebuzzerSyncing(true);
                try {
                  console.log('Testing Timebuzzer API...');
                  if (selectedTimebuzzerUserId) {
                    console.log(`Filtering by Timebuzzer user ID: ${selectedTimebuzzerUserId}`);
                  }
                  const { data, error } = await supabase.functions.invoke('timebuzzer-sync', {
                    body: { 
                      action: 'test-api',
                      userId: selectedTimebuzzerUserId || undefined, // Include userId if selected
                    },
                  });
                  
                  console.log('Response:', { data, error });
                  console.log('Error details:', error ? {
                    message: error.message,
                    name: error.name,
                    context: error.context,
                    status: (error as any).status,
                    statusCode: (error as any).statusCode,
                    fullError: JSON.stringify(error, null, 2)
                  } : "No error");
                  
                  // Check if there's an error from Supabase invoke
                  // Note: Even when there's an error, data might contain the response body
                  if (error) {
                    console.error('Error details:', error);
                    // Try to extract error message from multiple sources
                    let errorMessage = 'Failed to send a request to the Edge Function';
                    let foundError = false;
                    
                    // First, check if data contains the error response (Supabase sometimes puts it there even with error)
                    if (data && typeof data === 'object') {
                      if ('error' in data && (data as any).error) {
                        errorMessage = (data as any).error;
                        // Add suggestion if available
                        if ((data as any).suggestion) {
                          errorMessage += '\n\n' + (data as any).suggestion;
                        }
                        foundError = true;
                      } else if ('message' in data && (data as any).message) {
                        errorMessage = (data as any).message;
                        if ((data as any).suggestion) {
                          errorMessage += '\n\n' + (data as any).suggestion;
                        }
                        foundError = true;
                      }
                    }
                    
                    // If we don't have a good error message yet, try to fetch it directly
                    // This is especially important for 500 errors where Supabase might not parse the response
                    if (!foundError) {
                      try {
                        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                        if (supabaseUrl && supabaseKey) {
                          console.log('Fetching error details directly from Edge Function...');
                          const response = await fetch(`${supabaseUrl}/functions/v1/timebuzzer-sync`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${supabaseKey}`,
                            },
                            body: JSON.stringify({ action: 'test-api' }),
                          });
                          
                          const responseText = await response.text();
                          console.log('Direct fetch response status:', response.status);
                          console.log('Direct fetch response body:', responseText);
                          
                          // Always try to parse the response, even if status is not 200
                          if (responseText) {
                            try {
                              const responseData = JSON.parse(responseText);
                              if (responseData.error) {
                                errorMessage = responseData.error;
                                // Add suggestion if available
                                if (responseData.suggestion) {
                                  errorMessage += '\n\n' + responseData.suggestion;
                                }
                                foundError = true;
                              } else if (responseData.message) {
                                errorMessage = responseData.message;
                                if (responseData.suggestion) {
                                  errorMessage += '\n\n' + responseData.suggestion;
                                }
                                foundError = true;
                              } else if (typeof responseData === 'string') {
                                errorMessage = responseData;
                                foundError = true;
                              }
                            } catch (e) {
                              // If not JSON, use the text as error message
                              errorMessage = responseText.substring(0, 200); // Limit length
                              foundError = true;
                            }
                          }
                        }
                      } catch (fetchError) {
                        console.error('Failed to fetch error details:', fetchError);
                        // Keep the default error message
                      }
                    }
                    
                    // Fallback: try error.message (if it's not the generic one)
                    if (!foundError && error.message && error.message !== 'Edge Function returned a non-2xx status code') {
                      errorMessage = error.message;
                      foundError = true;
                    }
                    
                    // Fallback: try error.context (sometimes the response body is here)
                    if (!foundError && (error as any).context) {
                      try {
                        const context = typeof (error as any).context === 'string' 
                          ? JSON.parse((error as any).context) 
                          : (error as any).context;
                        if (context.error) {
                          errorMessage = context.error;
                          foundError = true;
                        } else if (context.message) {
                          errorMessage = context.message;
                          foundError = true;
                        }
                      } catch (e) {
                        // If parsing fails, use context as string
                        errorMessage = String((error as any).context).substring(0, 200);
                        foundError = true;
                      }
                    }
                    
                    toast({
                      title: "Test Error",
                      description: errorMessage,
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Check if the response indicates failure (even with 200 status)
                  if (data && typeof data === 'object' && 'success' in data) {
                    if (data.success) {
                      console.log('Timebuzzer API Test Response:', data);
                      setTimebuzzerTestResult(data);
                      
                      // Show detailed success message
                      const activityCount = data.count || 0;
                      const totalCount = data.totalCount || 0;
                      const message = totalCount > 0 
                        ? `✅ Success! Found ${activityCount} activities (of ${totalCount} total)`
                        : `✅ Success! API connection working. ${activityCount} activities returned.`;
                      
                      toast({
                        title: "API Test Successful",
                        description: message,
                      });
                    } else {
                      console.error('API test failed:', data);
                      setTimebuzzerTestResult(null);
                      toast({
                        title: "API Test Failed",
                        description: (data as any)?.error || 'Unknown error. Check console.',
                        variant: "destructive",
                      });
                    }
                  } else {
                    // Unexpected response format
                    console.error('Unexpected response format:', data);
                    setTimebuzzerTestResult(null);
                    toast({
                      title: "API Test Failed",
                      description: 'Unexpected response from server. Check console.',
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
          
          {/* Activities Selection Section */}
          {timebuzzerActivities.length > 0 && (
            <div className="mt-4 p-4 bg-white border border-green-300 rounded-lg">
              {/* Warning if mappings might be missing */}
              {(() => {
                const uniqueUserIds = new Set(timebuzzerActivities.map((a: any) => a.userId));
                const uniqueTileIds = new Set(timebuzzerActivities.flatMap((a: any) => a.tiles || []));
                const unmappedTileIds = Array.from(uniqueTileIds).filter(tileId => 
                  !projects.some(p => String(p.timebuzzer_project_id) === String(tileId))
                );
                const unmappedUserIds = Array.from(uniqueUserIds).filter(userId => 
                  !users.some(u => String(u.timebuzzer_user_id) === String(userId))
                );
                
                return (
                  <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                    <strong>⚠️ Mapping Required:</strong>
                    {unmappedUserIds.length > 0 && (
                      <div className="mt-2">
                        <div className="font-medium mb-1">Missing User Mappings ({unmappedUserIds.length}):</div>
                        <div className="space-y-1">
                          {unmappedUserIds.map(userId => {
                            const activity = timebuzzerActivities.find((a: any) => a.userId === userId);
                            return (
                              <div key={userId} className="bg-yellow-100 p-2 rounded">
                                <div>User ID: <strong>{userId}</strong> - {activity?.userName || 'Unknown'}</div>
                                <div className="text-xs mt-1">
                                  SQL: <code className="bg-white px-1 rounded">UPDATE users SET timebuzzer_user_id = '{userId}' WHERE email = 'EMAIL_HERE';</code>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {unmappedTileIds.length > 0 && (
                      <div className="mt-2">
                        <div className="font-medium mb-1">Missing Project Mappings ({unmappedTileIds.length}):</div>
                        <div className="space-y-1">
                          {unmappedTileIds.map(tileId => {
                            const activity = timebuzzerActivities.find((a: any) => a.tiles?.includes(tileId));
                            const tileName = activity?.tileNames?.find((name: string, idx: number) => 
                              activity.tiles?.[idx] === tileId
                            ) || `Tile ${tileId}`;
                            return (
                              <div key={tileId} className="bg-yellow-100 p-2 rounded">
                                <div>Tile ID: <strong>{tileId}</strong> - {tileName}</div>
                                <div className="text-xs mt-1">
                                  SQL: <code className="bg-white px-1 rounded">UPDATE projects SET timebuzzer_project_id = '{tileId}' WHERE name = 'PROJECT_NAME_HERE';</code>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {unmappedUserIds.length === 0 && unmappedTileIds.length === 0 && (
                      <div className="mt-1 text-green-700">
                        ✅ All required mappings are set! You can now add activities.
                      </div>
                    )}
                  </div>
                );
              })()}
              
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-green-800">
                  Select Activities to Add ({selectedActivityIds.size} of {timebuzzerActivities.length} selected)
                </h4>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedActivityIds(new Set(timebuzzerActivities.map((a: any) => a.id)));
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedActivityIds(new Set());
                    }}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
              
              <div className="max-h-96 overflow-y-auto space-y-2 mb-4">
                {timebuzzerActivities.map((activity: any) => {
                  const isSelected = selectedActivityIds.has(activity.id);
                  let duration = 0;
                  if (activity.startDate && activity.endDate) {
                    const start = new Date(activity.startDate);
                    const end = new Date(activity.endDate);
                    duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                  }
                  
                  // Check if this activity might be skipped (no mappings visible)
                  // Note: We can't check the actual mappings from frontend, but we can show a warning
                  const hasUser = activity.userId !== undefined;
                  const hasTiles = activity.tiles && activity.tiles.length > 0;
                  
                  return (
                    <div
                      key={activity.id}
                      className={`p-3 rounded border-2 transition-colors ${
                        isSelected
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      {(!hasUser || !hasTiles) && (
                        <div className="mb-2 text-xs text-yellow-600 bg-yellow-100 p-1 rounded">
                          ⚠️ This activity might be skipped: {!hasUser ? 'Missing user ID' : ''} {!hasTiles ? 'Missing project tiles' : ''}
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedActivityIds);
                            if (checked) {
                              newSet.add(activity.id);
                            } else {
                              newSet.delete(activity.id);
                            }
                            setSelectedActivityIds(newSet);
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1 text-sm">
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div>
                              <span className="font-medium">Date:</span>{' '}
                              {activity.startDate
                                ? new Date(activity.startDate).toLocaleDateString('nl-NL')
                                : 'N/A'}
                            </div>
                            <div>
                              <span className="font-medium">Duration:</span>{' '}
                              {Math.round(duration * 100) / 100} hours
                            </div>
                          </div>
                          {activity.userName && (
                            <div>
                              <span className="font-medium">User:</span> {activity.userName}
                            </div>
                          )}
                          {activity.tileNames && activity.tileNames.length > 0 && (
                            <div>
                              <span className="font-medium">Projects:</span>{' '}
                              {activity.tileNames.join(' → ')}
                            </div>
                          )}
                          {activity.note && (
                            <div className="mt-1 text-xs text-gray-600">
                              <span className="font-medium">Note:</span> {activity.note}
                            </div>
                          )}
                          <div className="mt-1 text-xs text-gray-500">
                            Time: {activity.startDate ? new Date(activity.startDate).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : ''} - {activity.endDate ? new Date(activity.endDate).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <Button
                onClick={async () => {
                  if (selectedActivityIds.size === 0) {
                    toast({
                      title: "No Selection",
                      description: "Please select at least one activity to add",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  setTimebuzzerSyncing(true);
                  try {
                    const dateRange = getWeekDateRange(timebuzzerSyncWeekNumber, timebuzzerSyncYear);
                    const selectedActivities = timebuzzerActivities.filter((a: any) =>
                      selectedActivityIds.has(a.id)
                    );
                    
                    // Sync only selected activities
                    const { data, error } = await supabase.functions.invoke('timebuzzer-sync', {
                      body: {
                        action: 'sync-selected-activities',
                        activities: selectedActivities,
                        startDate: dateRange.from,
                        endDate: dateRange.to,
                      },
                    });
                    
                    if (error) {
                      toast({
                        title: "Sync Error",
                        description: error.message || 'Failed to sync selected activities',
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    if (data && data.success) {
                      const inserted = data.inserted || 0;
                      const skipped = data.skipped || 0;
                      const total = data.total || 0;
                      
                      if (inserted > 0) {
                        const projectsCreated = data.projectsCreated || 0;
                        let message = `Added ${inserted} activities to weekly entries`;
                        if (projectsCreated > 0) {
                          message += ` (${projectsCreated} project${projectsCreated > 1 ? 's' : ''} automatically created)`;
                        }
                        if (skipped > 0) {
                          message += ` (${skipped} skipped)`;
                        }
                        
                        toast({
                          title: "Sync Successful",
                          description: message,
                        });
                        // Clear selection and activities
                        setTimebuzzerActivities([]);
                        setSelectedActivityIds(new Set());
                        // Refresh projects list
                        const { data: updatedProjects } = await supabase.from("projects").select("id, name, timebuzzer_project_id");
                        if (updatedProjects) {
                          setProjects(updatedProjects);
                        }
                      } else {
                        // All were skipped - show detailed message
                        let message = `No activities were added. ${skipped} activities were skipped.`;
                        if (data.skipReasons && data.skipReasons.length > 0) {
                          const reasons = data.skipReasons.slice(0, 3).map((r: any) => r.reason).join('; ');
                          message += ` Reasons: ${reasons}`;
                        }
                        if (data.userMappingsFound === 0) {
                          message += ' No user mappings found. Please map users first.';
                        }
                        if (data.projectMappingsFound === 0) {
                          message += ' No project mappings found. Please map projects first.';
                        }
                        
                        toast({
                          title: "No Activities Added",
                          description: message,
                          variant: "destructive",
                        });
                      }
                    } else {
                      toast({
                        title: "Sync Failed",
                        description: data?.error || 'Unknown error occurred',
                        variant: "destructive",
                      });
                    }
                  } catch (error: any) {
                    console.error('Sync error:', error);
                    toast({
                      title: "Sync Error",
                      description: error.message || 'Failed to sync selected activities',
                      variant: "destructive",
                    });
                  } finally {
                    setTimebuzzerSyncing(false);
                  }
                }}
                disabled={timebuzzerSyncing || selectedActivityIds.size === 0}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {timebuzzerSyncing
                  ? `Adding ${selectedActivityIds.size} activities...`
                  : `Add ${selectedActivityIds.size} Selected Activities to Weekly Entries`}
              </Button>
            </div>
          )}
          
          {/* Test Results Display */}
          {timebuzzerTestResult && timebuzzerTestResult.success && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-green-800">✅ API Test Results</h4>
                <button
                  onClick={() => setTimebuzzerTestResult(null)}
                  className="text-xs text-green-600 hover:text-green-800 underline"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Status:</span> {timebuzzerTestResult.status || 'OK'}
                </div>
                {timebuzzerTestResult.totalCount !== undefined && (
                  <div>
                    <span className="font-medium">Total Activities in Timebuzzer:</span> {timebuzzerTestResult.totalCount}
                  </div>
                )}
                {timebuzzerTestResult.count !== undefined && (
                  <div>
                    <span className="font-medium">Activities Returned:</span> {timebuzzerTestResult.count}
                  </div>
                )}
                {timebuzzerTestResult.totalDuration !== undefined && (
                  <div>
                    <span className="font-medium">Total Duration:</span> {Math.round(timebuzzerTestResult.totalDuration / 3600000 * 100) / 100} hours
                  </div>
                )}
                {timebuzzerTestResult.usersFetched !== undefined && (
                  <div>
                    <span className="font-medium">Users Loaded:</span> {timebuzzerTestResult.usersFetched}
                  </div>
                )}
                {timebuzzerTestResult.tilesFetched !== undefined && (
                  <div>
                    <span className="font-medium">Projects Loaded:</span> {timebuzzerTestResult.tilesFetched}
                  </div>
                )}
                
                {/* Show sample activities */}
                {timebuzzerTestResult.data && timebuzzerTestResult.data.activities && 
                 Array.isArray(timebuzzerTestResult.data.activities) && 
                 timebuzzerTestResult.data.activities.length > 0 && (
                  <div className="mt-3">
                    <span className="font-medium">Sample Activities (first 3):</span>
                    <div className="mt-2 space-y-2">
                      {timebuzzerTestResult.data.activities.slice(0, 3).map((activity: any, idx: number) => {
                        // Calculate duration
                        let duration = '';
                        if (activity.startDate && activity.endDate) {
                          const start = new Date(activity.startDate);
                          const end = new Date(activity.endDate);
                          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                          duration = `${Math.round(hours * 100) / 100} hours`;
                        }
                        
                        return (
                          <div key={idx} className="p-2 bg-white rounded border border-green-200 text-xs">
                            <div className="grid grid-cols-2 gap-2">
                              <div><span className="font-medium">ID:</span> {activity.id}</div>
                              {duration && (
                                <div><span className="font-medium">Duration:</span> {duration}</div>
                              )}
                            </div>
                            {activity.userName && (
                              <div><span className="font-medium">User:</span> {activity.userName} {activity.userEmail && `(${activity.userEmail})`}</div>
                            )}
                            {!activity.userName && activity.userId && (
                              <div><span className="font-medium">User ID:</span> {activity.userId}</div>
                            )}
                            {activity.tileNames && activity.tileNames.length > 0 && (
                              <div><span className="font-medium">Projects:</span> {activity.tileNames.join(' → ')}</div>
                            )}
                            {!activity.tileNames && activity.tiles && activity.tiles.length > 0 && (
                              <div><span className="font-medium">Tile IDs:</span> {activity.tiles.join(', ')}</div>
                            )}
                            {activity.startDate && (
                              <div><span className="font-medium">Start:</span> {new Date(activity.startDate).toLocaleString()}</div>
                            )}
                            {activity.endDate && (
                              <div><span className="font-medium">End:</span> {new Date(activity.endDate).toLocaleString()}</div>
                            )}
                            {activity.note && (
                              <div><span className="font-medium">Note:</span> {activity.note.substring(0, 100)}{activity.note.length > 100 ? '...' : ''}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel; 