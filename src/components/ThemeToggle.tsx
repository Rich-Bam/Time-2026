import React from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface ThemeToggleProps {
  currentUser?: any;
}

const SUPER_ADMIN_EMAIL = "r.blance@bampro.nl";

const ThemeToggle = ({ currentUser }: ThemeToggleProps) => {
  const { theme, toggleTheme } = useTheme();
  
  // Only show theme toggle for super admin
  const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL;
  
  if (!isSuperAdmin) {
    return null; // Don't render for non-super admin users
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 p-0 border-gray-300 dark:border-gray-600"
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'light' ? (
        <Moon className="h-3 w-3 sm:h-3.5 sm:h-3.5 md:h-4 md:w-4 text-gray-600 dark:text-gray-300" />
      ) : (
        <Sun className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-gray-600 dark:text-gray-300" />
      )}
    </Button>
  );
};

export default ThemeToggle;

