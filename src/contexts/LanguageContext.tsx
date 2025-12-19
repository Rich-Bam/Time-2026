import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'nl' | 'en' | 'es' | 'el' | 'ro' | 'pl';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translation keys
const translations: Record<Language, Record<string, string>> = {
  nl: {
    // Navigation
    'nav.weekly': 'Weekly Entry',
    'nav.projects': 'Projects',
    'nav.export': 'Export',
    'nav.admin': 'Admin',
    'nav.reportBug': 'Report Bug',
    'nav.overview': 'Overview',
    'nav.welcome': 'Welkom',
    'nav.logout': 'Logout',
    
    // Project Management
    'project.addNew': 'Nieuw Project Toevoegen',
    'project.create': 'Maak een nieuw project voor urenregistratie',
    'project.name': 'Project Naam',
    'project.namePlaceholder': 'Voer project naam in',
    'project.client': 'Klant',
    'project.clientPlaceholder': 'Klant naam',
    'project.description': 'Beschrijving',
    'project.descriptionPlaceholder': 'Project beschrijving...',
    'project.createButton': 'Project Aanmaken',
    'project.active': 'Actieve Projecten',
    'project.manage': 'Beheer en volg je projecten',
    'project.viewDetails': 'Details Bekijken',
    'project.close': 'Sluiten',
    'project.reopen': 'Heropen',
    'project.delete': 'Verwijder',
    'project.deleteConfirm': 'Project Verwijderen',
    'project.deleteConfirmText': 'Weet je zeker dat je "{name}" wilt verwijderen? Alle gerelateerde timesheet entries worden ook verwijderd. Deze actie kan niet ongedaan worden gemaakt.',
    'project.cancel': 'Annuleren',
    'project.deleted': 'Project Verwijderd',
    'project.deletedText': '{name} is succesvol verwijderd. Alle gerelateerde timesheet entries zijn ook verwijderd.',
    'project.closed': 'Project Gesloten',
    'project.reopened': 'Project Heropend',
    'project.closedText': '{name} is gesloten. Er kunnen geen uren meer aan toegevoegd worden.',
    'project.reopenedText': '{name} is heropend. Er kunnen weer uren aan toegevoegd worden.',
    'project.status.active': 'Actief',
    'project.status.closed': 'Gesloten',
    'project.status.completed': 'Voltooid',
    'project.status.onHold': 'In Wacht',
    'project.hoursLogged': '{hours}h gelogd',
    'project.members': 'leden',
    'project.details': 'Project Details: {name}',
    'project.allEntries': 'Alle tijd entries voor dit project',
    'project.noEntries': 'Nog geen tijd entries.',
    
    // Weekly Entry
    'weekly.workType': 'Werk Type',
    'weekly.project': 'Project',
    'weekly.hours': 'Uren',
    'weekly.lunch': 'Lunch',
    'weekly.startTime': 'Start Tijd',
    'weekly.endTime': 'Eind Tijd',
    'weekly.submit': 'Verzenden',
    'weekly.submitAll': 'Verzend Alle Dagen',
    'weekly.submitDay': 'Verzend Dag',
    'weekly.add': 'Toevoegen',
    'weekly.confirmed': 'Deze week is bevestigd. Je kunt geen wijzigingen meer aanbrengen tot een admin dit heeft goedgekeurd of teruggezet.',
    
    // Export
    'export.title': 'Export Timesheet Data',
    'export.description': 'Export timesheet data naar Excel voor rapportage en analyse',
    'export.selectUser': 'Selecteer Gebruiker (optioneel)',
    'export.allUsers': 'Alle gebruikers',
    'export.selectUserHelp': 'Laat leeg om alle gebruikers te exporteren, of selecteer een specifieke gebruiker.',
    'export.allData': 'Export All Data',
    'export.dateRange': 'Export Datumbereik',
    'export.weekNumber': 'Export Week Nummer',
    'export.perUser': 'Export Per Gebruiker',
    'export.selectPeriod': 'Selecteer Periode',
    'export.selectDay': 'Selecteer Dag',
    'export.selectWeek': 'Selecteer Week (elke dag in de week)',
    'export.selectMonth': 'Selecteer Maand (elke dag in de maand)',
    'export.selectYear': 'Selecteer Jaar (elke dag in het jaar)',
    'export.exporting': 'Exporteren...',
    'export.day': 'Dag',
    'export.week': 'Week',
    'export.month': 'Maand',
    'export.year': 'Jaar',
    'export.note': 'Let op:',
    'export.adminNote': 'Admins kunnen alle data exporteren, een datumbereik selecteren, of per gebruiker exporteren. Selecteer een gebruiker om alleen die gebruiker te exporteren, of laat leeg voor alle gebruikers.',
    'export.userNote': 'Selecteer een periode en datum om je uren te exporteren naar Excel.',
    'export.weekPlaceholder': 'Week',
    'export.yearPlaceholder': 'Jaar',
    
    // Weekly Entry
    'weekly.viewMode.cards': 'Kaarten',
    'weekly.viewMode.overview': 'Overzicht',
    'weekly.daysOff': 'Vrije Dagen Over',
    'weekly.confirmWeek': 'Week Bevestigen',
    'weekly.confirmWeekText': 'Weet je zeker dat je deze week wilt bevestigen? Na bevestiging kun je als niet-admin geen wijzigingen meer aanbrengen.',
    'weekly.weekConfirmed': 'Week Bevestigd',
    'weekly.weekConfirmedText': 'Deze week is bevestigd en kan niet meer worden gewijzigd.',
    'weekly.type': 'Type',
    'weekly.projectPlaceholder': 'Project',
    
    // Admin Panel
    'admin.title': 'Admin Panel',
    'admin.addUser': 'Gebruiker Toevoegen',
    'admin.email': 'Email',
    'admin.name': 'Naam',
    'admin.password': 'Wachtwoord',
    'admin.isAdmin': 'Admin',
    'admin.mustChangePassword': 'Moet wachtwoord wijzigen',
    'admin.createUser': 'Gebruiker Aanmaken',
    'admin.allUsers': 'Alle Gebruikers',
    'admin.pendingApproval': 'Wachtend op Goedkeuring',
    'admin.approve': 'Goedkeuren',
    'admin.reject': 'Afwijzen',
    'admin.resetPassword': 'Reset Wachtwoord',
    'admin.daysOff': 'Vrije Dagen',
    'admin.confirmedWeeks': 'Bevestigde Weken',
    'admin.approveWeek': 'Goedkeuren',
    'admin.reopenWeek': 'Heropen',
    
    // Common
    'common.loading': 'Laden...',
    'common.error': 'Fout',
    'common.success': 'Succes',
    'common.cancel': 'Annuleren',
    'common.close': 'Sluiten',
    'common.save': 'Opslaan',
    'common.delete': 'Verwijderen',
    'common.edit': 'Bewerken',
    'common.confirm': 'Bevestigen',
  },
  en: {
    // Navigation
    'nav.weekly': 'Weekly Entry',
    'nav.projects': 'Projects',
    'nav.export': 'Export',
    'nav.admin': 'Admin',
    'nav.reportBug': 'Report Bug',
    'nav.overview': 'Overview',
    'nav.welcome': 'Welcome',
    'nav.logout': 'Logout',
    
    // Project Management
    'project.addNew': 'Add New Project',
    'project.create': 'Create a new project for time tracking',
    'project.name': 'Project Name',
    'project.namePlaceholder': 'Enter project name',
    'project.client': 'Client',
    'project.clientPlaceholder': 'Client name',
    'project.description': 'Description',
    'project.descriptionPlaceholder': 'Project description...',
    'project.createButton': 'Create Project',
    'project.active': 'Active Projects',
    'project.manage': 'Manage and track your projects',
    'project.viewDetails': 'View Details',
    'project.close': 'Close',
    'project.reopen': 'Reopen',
    'project.delete': 'Delete',
    'project.deleteConfirm': 'Delete Project',
    'project.deleteConfirmText': 'Are you sure you want to delete "{name}"? All related timesheet entries will also be deleted. This action cannot be undone.',
    'project.cancel': 'Cancel',
    'project.deleted': 'Project Deleted',
    'project.deletedText': '{name} has been successfully deleted. All related timesheet entries have also been deleted.',
    'project.closed': 'Project Closed',
    'project.reopened': 'Project Reopened',
    'project.closedText': '{name} has been closed. No more hours can be added to it.',
    'project.reopenedText': '{name} has been reopened. Hours can be added to it again.',
    'project.status.active': 'Active',
    'project.status.closed': 'Closed',
    'project.status.completed': 'Completed',
    'project.status.onHold': 'On Hold',
    'project.hoursLogged': '{hours}h logged',
    'project.members': 'members',
    'project.details': 'Project Details: {name}',
    'project.allEntries': 'All time entries for this project',
    'project.noEntries': 'No time entries yet.',
    
    // Weekly Entry
    'weekly.workType': 'Work Type',
    'weekly.project': 'Project',
    'weekly.hours': 'Hours',
    'weekly.lunch': 'Lunch',
    'weekly.startTime': 'Start Time',
    'weekly.endTime': 'End Time',
    'weekly.submit': 'Submit',
    'weekly.submitAll': 'Submit All Days',
    'weekly.submitDay': 'Submit Day',
    'weekly.add': 'Add',
    'weekly.confirmed': 'This week is confirmed. You cannot make any changes until an admin has approved or reset it.',
    
    // Export
    'export.title': 'Export Timesheet Data',
    'export.description': 'Export timesheet data to Excel for reporting and analysis',
    'export.selectUser': 'Select User (optional)',
    'export.allUsers': 'All users',
    'export.selectUserHelp': 'Leave empty to export all users, or select a specific user.',
    'export.allData': 'Export All Data',
    'export.dateRange': 'Export Date Range',
    'export.weekNumber': 'Export Week Number',
    'export.perUser': 'Export Per User',
    'export.selectPeriod': 'Select Period',
    'export.selectDay': 'Select Day',
    'export.selectWeek': 'Select Week (every day in the week)',
    'export.selectMonth': 'Select Month (every day in the month)',
    'export.selectYear': 'Select Year (every day in the year)',
    'export.exporting': 'Exporting...',
    'export.day': 'Day',
    'export.week': 'Week',
    'export.month': 'Month',
    'export.year': 'Year',
    'export.note': 'Note:',
    'export.adminNote': 'Admins can export all data, select a date range, or export per user. Select a user to export only that user, or leave empty for all users.',
    'export.userNote': 'Select a period and date to export your hours to Excel.',
    'export.weekPlaceholder': 'Week',
    'export.yearPlaceholder': 'Year',
    
    // Weekly Entry
    'weekly.viewMode.cards': 'Cards',
    'weekly.viewMode.overview': 'Overview',
    'weekly.daysOff': 'Days Off Remaining',
    'weekly.confirmWeek': 'Confirm Week',
    'weekly.confirmWeekText': 'Are you sure you want to confirm this week? After confirmation, you cannot make changes as a non-admin.',
    'weekly.weekConfirmed': 'Week Confirmed',
    'weekly.weekConfirmedText': 'This week is confirmed and cannot be changed anymore.',
    'weekly.type': 'Type',
    'weekly.projectPlaceholder': 'Project',
    
    // Admin Panel
    'admin.title': 'Admin Panel',
    'admin.addUser': 'Add User',
    'admin.email': 'Email',
    'admin.name': 'Name',
    'admin.password': 'Password',
    'admin.isAdmin': 'Admin',
    'admin.mustChangePassword': 'Must change password',
    'admin.createUser': 'Create User',
    'admin.allUsers': 'All Users',
    'admin.pendingApproval': 'Pending Approval',
    'admin.approve': 'Approve',
    'admin.reject': 'Reject',
    'admin.resetPassword': 'Reset Password',
    'admin.daysOff': 'Days Off',
    'admin.confirmedWeeks': 'Confirmed Weeks',
    'admin.approveWeek': 'Approve',
    'admin.reopenWeek': 'Reopen',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.confirm': 'Confirm',
  },
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // Load from localStorage or default to Dutch
    const saved = localStorage.getItem('bampro_language');
    return (saved === 'nl' || saved === 'en' || saved === 'es' || saved === 'el' || saved === 'ro' || saved === 'pl') ? saved : 'nl';
  });

  useEffect(() => {
    // Save to localStorage when language changes
    localStorage.setItem('bampro_language', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    let translation = translations[language][key] || key;
    
    // Replace parameters like {name} with actual values
    if (params) {
      Object.keys(params).forEach(param => {
        translation = translation.replace(`{${param}}`, String(params[param]));
      });
    }
    
    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

