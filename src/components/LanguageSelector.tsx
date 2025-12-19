import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-gray-600" />
      <Select value={language} onValueChange={(value: 'nl' | 'en' | 'es' | 'el' | 'ro' | 'pl') => setLanguage(value)}>
        <SelectTrigger className="w-[120px] h-8 border-gray-300">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="nl">🇳🇱 NL</SelectItem>
          <SelectItem value="en">🇬🇧 EN</SelectItem>
          <SelectItem value="es">🇪🇸 ES</SelectItem>
          <SelectItem value="el">🇬🇷 EL</SelectItem>
          <SelectItem value="ro">🇷🇴 RO</SelectItem>
          <SelectItem value="pl">🇵🇱 PL</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSelector;

