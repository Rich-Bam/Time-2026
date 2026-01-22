import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { hashPassword, verifyPassword, isPasswordHashed } from "@/utils/password";
import { useLanguage } from "@/contexts/LanguageContext";

interface AuthSectionProps {
  onLogin: (status: boolean) => void;
  setCurrentUser: (user: any) => void;
}

// Feature flag: Set to true to enable account creation form
// TODO: Enable this in the future when account creation should be available
const ENABLE_ACCOUNT_CREATION = false;

const AuthSection = ({ onLogin, setCurrentUser }: AuthSectionProps) => {
  const { t } = useLanguage();
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registerData, setRegisterData] = useState({ email: "", name: "", password: "" });
  const [registerLoading, setRegisterLoading] = useState(false);
  const { toast } = useToast();
  // Forgot password modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  // Helper functions for offline mode
  const getOfflineUsers = (): any[] => {
    try {
      const stored = localStorage.getItem('bampro_offline_users');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const getOfflineUser = (email: string): any | null => {
    const users = getOfflineUsers();
    return users.find((u: any) => u.email.toLowerCase() === email.toLowerCase()) || null;
  };

  const setupOfflineTestUsers = () => {
    // Create default test users for offline mode
    const testUsers = [
      {
        id: 'offline-user-1',
        email: 'test@bampro.nl',
        name: 'Test User',
        password: 'test123', // Plaintext for easy testing
        isAdmin: false,
        must_change_password: false,
        approved: true,
        created_at: new Date().toISOString(),
        photo_url: null,
        phone_number: null,
        userType: null,
        weekly_view_option: null,
      },
      {
        id: 'offline-admin-1',
        email: 'admin@bampro.nl',
        name: 'Test Admin',
        password: 'admin123', // Plaintext for easy testing
        isAdmin: true,
        must_change_password: false,
        approved: true,
        created_at: new Date().toISOString(),
        photo_url: null,
        phone_number: null,
        userType: null,
        weekly_view_option: null,
      },
    ];
    localStorage.setItem('bampro_offline_users', JSON.stringify(testUsers));
    console.log('✅ Offline test users created. Use test@bampro.nl / test123 or admin@bampro.nl / admin123');
  };

  // Initialize offline test users if they don't exist
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('bampro_offline_users')) {
      setupOfflineTestUsers();
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.email || !loginData.password) {
      toast({
        title: t('auth.loginFailed'),
        description: t('auth.pleaseEnterCredentials'),
        variant: "destructive",
      });
      return;
    }
    
    // Query Supabase users table for a user with this email
    // Note: We need password for login verification, so we select it explicitly
    // Add retry logic for temporary network/API failures
    let user = null;
    let error = null;
    let lastError = null;
    let isNetworkError = false;
    
    // Retry up to 3 times with exponential backoff
    // Note: Login queries are not cached by service worker (NetworkOnly strategy)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { data, error: queryError } = await supabase
          .from("users")
          .select("id, email, name, password, isAdmin, must_change_password, approved, created_at, photo_url, phone_number, userType, weekly_view_option")
          .eq("email", loginData.email)
          .single();
        
        if (!queryError && data) {
          user = data;
          error = null;
          break; // Success, exit retry loop
        }
        
        lastError = queryError;
        
        // Log error details for debugging
        console.error(`Login attempt ${attempt} failed:`, {
          error: queryError,
          code: queryError?.code,
          message: queryError?.message,
          details: queryError?.details,
          hint: queryError?.hint,
          email: loginData.email,
        });
        
        // Don't retry on certain errors (e.g., user doesn't exist)
        if (queryError?.code === 'PGRST116' || queryError?.message?.includes('No rows')) {
          // User doesn't exist, no point retrying
          error = queryError;
          break;
        }
        
        // Check if it's a network error
        if (queryError?.message?.includes('network') || 
            queryError?.message?.includes('fetch') || 
            queryError?.message?.includes('Failed to fetch') ||
            !navigator.onLine) {
          isNetworkError = true;
        }
        
        // If not last attempt, wait before retry (exponential backoff)
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, attempt * 500)); // 500ms, 1000ms delays
        } else {
          error = queryError;
        }
      } catch (err: any) {
        // Catch network errors that might not be caught by Supabase
        if (err?.message?.includes('fetch') || err?.message?.includes('network') || !navigator.onLine) {
          isNetworkError = true;
          error = err;
          break;
        }
        error = err;
      }
    }
    
    // If network error, try offline mode
    if ((error || !user) && (isNetworkError || !navigator.onLine)) {
      console.log('🌐 Offline mode: Trying to login with offline users...');
      const offlineUser = getOfflineUser(loginData.email);
      
      if (offlineUser) {
        // Check password (offline users use plaintext passwords)
        if (offlineUser.password === loginData.password) {
          user = offlineUser;
          error = null;
          console.log('✅ Offline login successful');
        } else {
          toast({
            title: t('auth.loginFailed'),
            description: t('auth.incorrectPassword'),
            variant: "destructive",
          });
          return;
        }
      } else {
        toast({
          title: t('auth.loginFailed'),
          description: t('auth.userNotFound'),
          variant: "destructive",
        });
        return;
      }
    }
    
    // Handle errors with better error messages (only if not using offline mode)
    if ((error || !user) && !isNetworkError) {
      // Check for specific error types
      const errorMessage = error?.message || '';
      const errorCode = error?.code || '';
      
      // Different error messages for different error types
      let userMessage = t('auth.userNotFound');
      
      if (errorCode === 'PGRST116' || errorMessage.includes('No rows')) {
        // User truly doesn't exist
        userMessage = t('auth.userNotFound');
      } else if (errorCode === '406' || errorMessage.includes('Not Acceptable')) {
        // 406 error - API compatibility issue
        userMessage = 'API error. Probeer het opnieuw of ververs de pagina.';
        console.error('406 Error detected - this should be fixed with headers configuration');
      } else if (errorCode === '403' || errorMessage.includes('permission') || errorMessage.includes('RLS')) {
        // RLS policy blocking access
        userMessage = 'Toegang geweigerd. Neem contact op met een administrator.';
        console.error('RLS Policy blocking access:', error);
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        // Network error
        userMessage = 'Netwerkfout. Check je internetverbinding en probeer het opnieuw.';
      } else {
        // Generic error - log full details
        console.error('Login error details:', {
          error,
          code: errorCode,
          message: errorMessage,
          email: loginData.email,
        });
        userMessage = `Login fout: ${errorMessage || 'Onbekende fout'}. Probeer het opnieuw.`;
      }
      
      toast({
        title: t('auth.loginFailed'),
        description: userMessage,
        variant: "destructive",
      });
      return;
    }
    // Check if user is approved (for new accounts, admin must approve)
    if (user.approved === false) {
      toast({
        title: t('auth.accountPendingApproval'),
        description: t('auth.accountPendingApprovalText'),
        variant: "destructive",
      });
      return;
    }
    // Check password (supports both hashed and plaintext for migration)
    let passwordValid = false;
    if (user) {
      if (isPasswordHashed(user.password)) {
        // Password is hashed, verify using bcrypt
        passwordValid = await verifyPassword(loginData.password, user.password);
      } else {
        // Password is plaintext (legacy or offline), compare directly
        passwordValid = user.password === loginData.password;
        // Only try to hash and update if we're online and it's not an offline user
        if (passwordValid && navigator.onLine && !user.id?.startsWith('offline-')) {
          try {
            const hashedPassword = await hashPassword(loginData.password);
            await supabase
              .from("users")
              .update({ password: hashedPassword })
              .eq("id", user.id);
          } catch (err) {
            // Ignore errors when updating password (might be offline)
            console.warn('Could not update password hash:', err);
          }
        }
      }
    }
    
    if (!passwordValid) {
      toast({
        title: t('auth.loginFailed'),
        description: t('auth.incorrectPassword'),
        variant: "destructive",
      });
      return;
    }
    
    // Save session only if rememberMe is checked
    // If rememberMe is checked: 168 hours (7 days) in localStorage
    // If not checked: no session saved, user must login again each time
    if (rememberMe && user) {
      const sessionData = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
          approved: user.approved,
          must_change_password: user.must_change_password,
          photo_url: user.photo_url || null,
          phone_number: user.phone_number || null,
        },
        loginTime: new Date().toISOString(),
        rememberMe: true,
      };
      // Save to localStorage for 168 hours (7 days)
      localStorage.setItem('bampro_user_session', JSON.stringify(sessionData));
    } else {
      // Clear any existing session if user doesn't want to stay logged in
      localStorage.removeItem('bampro_user_session');
      sessionStorage.removeItem('bampro_user_session');
    }
    
    if (user) {
      setCurrentUser(user);
      onLogin(true);
      toast({
        title: t('auth.loginSuccessful'),
        description: rememberMe 
          ? t('auth.welcomeRememberMe', { name: user.name || user.email })
          : t('auth.welcome', { name: user.name || user.email }),
      });
    }
  };

  // Simple create-user helper to verify Supabase connectivity
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerData.email || !registerData.password || !registerData.name) {
      toast({
        title: t('auth.missingInformation'),
        description: t('auth.missingInformationText'),
        variant: "destructive",
      });
      return;
    }
    
    // Validate email domain - only @bampro.nl allowed
    if (!registerData.email.toLowerCase().endsWith('@bampro.nl')) {
      toast({
        title: t('auth.onlyBamproEmail'),
        description: t('auth.onlyBamproEmailText'),
        variant: "destructive",
        duration: 8000,
      });
      return;
    }
    
    // Validate password length
    if (registerData.password.length < 6) {
      toast({
        title: t('auth.passwordTooShort'),
        description: t('auth.passwordTooShortText'),
        variant: "destructive",
      });
      return;
    }
    
    setRegisterLoading(true);
    // Hash password before storing
    const hashedPassword = await hashPassword(registerData.password);
    const { error } = await supabase.from("users").insert([
      {
        email: registerData.email,
        name: registerData.name,
        password: hashedPassword, // Store hashed password
        // These fields are used elsewhere in the app (Admin panel / password change)
        isAdmin: false,
        must_change_password: false,
        approved: false, // New users need admin approval
      },
    ]);
    setRegisterLoading(false);
    if (error) {
      toast({
        title: t('auth.errorCreatingUser'),
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: t('auth.accountCreated'),
      description: t('auth.accountCreatedText'),
    });
    // Clear form
    setRegisterData({ email: "", name: "", password: "" });
  };

  // Handle password reset - send email via Supabase Auth
  const handleResetPassword = async () => {
    if (!resetEmail) {
      setResetMessage(t('auth.enterEmail'));
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
      setResetMessage(t('auth.userNotFoundReset'));
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
      // If user doesn't exist in Supabase Auth, try Edge Function
      console.log("User not in Supabase Auth, trying Edge Function...");
      
      try {
        // Try calling password-reset Edge Function
        console.log("🔵 Calling password-reset Edge Function for:", resetEmail);
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('password-reset', {
          body: { email: resetEmail },
        });

        console.log("🔵 Edge Function response:", { edgeData, edgeError });

        if (edgeError) {
          console.error("❌ Edge Function error:", edgeError);
          setResetMessage(
            t('auth.resetEmailError') + " " +
            t('auth.error') + ": " + (edgeError.message || t('auth.unknownError')) +
            ". " + t('auth.checkConsole')
          );
          setResetLoading(false);
          return;
        }

        if (!edgeData || !edgeData.success) {
          console.error("❌ Edge Function returned error:", edgeData);
          setResetMessage(
            t('auth.resetEmailError') + " " +
            t('auth.error') + ": " + (edgeData?.error || edgeData?.message || t('auth.unknownError')) +
            ". " + t('auth.checkConsole')
          );
          setResetLoading(false);
          return;
        }

        // Success via Edge Function
        setResetMessage(t('auth.resetEmailSuccess'));
        setResetLoading(false);
        setShowResetModal(false);
        setResetEmail("");
        
        toast({
          title: t('auth.resetEmailSent'),
          description: t('auth.resetEmailSentText', { email: resetEmail }),
        });
        return;
      } catch (edgeErr: any) {
        console.error("Edge Function exception:", edgeErr);
        setResetMessage(t('auth.resetEmailError'));
        setResetLoading(false);
        return;
      }
    }
    
    // Success - email sent!
    setResetMessage(t('auth.resetEmailSuccess'));
    setResetLoading(false);
    setShowResetModal(false); // Close modal after success
    setResetEmail(""); // Clear email
    
    toast({
      title: t('auth.resetEmailSent'),
      description: t('auth.resetEmailSentText', { email: resetEmail }),
    });
  };

  return (
    <div className="max-w-md mx-auto">
      {/* Login card */}
      <Card>
        <CardHeader className="text-center">
          <CardDescription>
            {t('auth.loginToStart')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">{t('auth.email')}</Label>
              <Input
                id="login-email"
                type="email"
                placeholder={t('auth.enterYourEmail')}
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">{t('auth.password')}</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t('auth.enterYourPassword')}
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onMouseDown={() => setShowPassword(true)}
                  onMouseUp={() => setShowPassword(false)}
                  onMouseLeave={() => setShowPassword(false)}
                  onTouchStart={() => setShowPassword(true)}
                  onTouchEnd={() => setShowPassword(false)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  aria-label={t('auth.holdToShowPassword')}
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <Label
                  htmlFor="remember-me"
                  className="text-sm font-normal cursor-pointer"
                >
                  {t('auth.stayLoggedIn')}
                </Label>
              </div>
              <Button variant="link" type="button" onClick={() => setShowResetModal(true)}>
                {t('auth.forgotPassword')}
              </Button>
            </div>
            <Button type="submit" className="w-full">
              {t('auth.login')}
            </Button>
          </form>
        </CardContent>
      </Card>
      {/* Create user card - Hidden for now, but code preserved for future use */}
      {/* To enable: Set ENABLE_ACCOUNT_CREATION to true at the top of this file */}
      {ENABLE_ACCOUNT_CREATION && (
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
      )}
      {/* Reset Password Dialog */}
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('auth.resetPassword')}</DialogTitle>
            <DialogDescription>{t('auth.resetPasswordDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reset-email">{t('auth.email')}</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder={t('auth.enterYourEmail')}
              value={resetEmail}
              onChange={e => setResetEmail(e.target.value)}
              required
              disabled={resetLoading}
            />
            <Button onClick={handleResetPassword} disabled={resetLoading || !resetEmail} className="w-full">
              {resetLoading ? t('auth.sending') : t('auth.sendResetLink')}
            </Button>
            {resetMessage && (
              <div 
                className={`text-sm text-center mt-2 p-3 rounded ${
                  resetMessage.includes(t('auth.resetEmailSuccess').substring(0, 10)) || 
                  resetMessage.includes('verstuurd') || 
                  resetMessage.includes('sent') ||
                  resetMessage.includes('enviado') ||
                  resetMessage.includes('αποστάλθηκε') ||
                  resetMessage.includes('trimis') ||
                  resetMessage.includes('wysłany') ||
                  resetMessage.includes('gönderildi') ||
                  resetMessage.includes('inbox')
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
