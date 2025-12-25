import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const SUPER_ADMIN_EMAIL = "r.blance@bampro.nl";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Check if current user is super admin
  const getIsSuperAdmin = (): boolean => {
    if (typeof window !== 'undefined') {
      const currentUser = (window as any).__currentUser;
      return currentUser?.email === SUPER_ADMIN_EMAIL;
    }
    return false;
  };

  // Get theme from localStorage or default to light
  // Only allow dark mode for super admin
  const [theme, setThemeState] = useState<Theme>(() => {
    const isSuperAdmin = getIsSuperAdmin();
    
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bampro_theme');
      
      // If not super admin, always use light mode
      if (!isSuperAdmin) {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add('light');
        return 'light';
      }
      
      // Super admin can use saved theme
      if (saved === 'dark' || saved === 'light') {
        // Apply immediately to prevent flash
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(saved);
        return saved as Theme;
      }
      // Check system preference for super admin only
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add('dark');
        return 'dark';
      }
    }
    return 'light';
  });

  // Apply theme to document and check user permissions
  useEffect(() => {
    const checkAndApplyTheme = () => {
      const isSuperAdmin = getIsSuperAdmin();
      const root = window.document.documentElement;
      
      // If not super admin, force light mode
      if (!isSuperAdmin) {
        root.classList.remove('light', 'dark');
        root.classList.add('light');
        setThemeState('light');
        localStorage.setItem('bampro_theme', 'light');
        return;
      }
      
      // Super admin can use their preferred theme
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
      
      // Also update localStorage
      localStorage.setItem('bampro_theme', theme);
    };
    
    checkAndApplyTheme();
    
    // Check periodically in case user logs in/out
    const interval = setInterval(checkAndApplyTheme, 1000);
    
    return () => clearInterval(interval);
  }, [theme]);

  // Save theme preference to localStorage (only for super admin)
  const setTheme = (newTheme: Theme) => {
    const isSuperAdmin = getIsSuperAdmin();
    if (!isSuperAdmin) {
      // Non-super admin users can't change theme
      return;
    }
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    const isSuperAdmin = getIsSuperAdmin();
    if (!isSuperAdmin) {
      // Non-super admin users can't toggle theme
      return;
    }
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

