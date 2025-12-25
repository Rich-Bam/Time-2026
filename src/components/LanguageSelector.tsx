import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-0.5 sm:gap-1 md:gap-1.5 lg:gap-2">
      <Globe className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4 text-gray-600" />
      <Select value={language} onValueChange={(value: 'nl' | 'en' | 'es' | 'el' | 'ro' | 'pl' | 'tr') => setLanguage(value)}>
        <SelectTrigger className="w-[60px] sm:w-[70px] md:w-[80px] lg:w-[100px] h-5 sm:h-6 md:h-7 lg:h-8 border-gray-300 text-[9px] sm:text-[10px] md:text-xs lg:text-sm px-1 sm:px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="nl">🇳🇱 NL</SelectItem>
          <SelectItem value="en">🇬🇧 EN</SelectItem>
          <SelectItem value="es">🇪🇸 ES</SelectItem>
          <SelectItem value="el">🇬🇷 EL</SelectItem>
          <SelectItem value="ro">🇷🇴 RO</SelectItem>
          <SelectItem value="pl">🇵🇱 PL</SelectItem>
          <SelectItem value="tr">🇹🇷 TR</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSelector;

