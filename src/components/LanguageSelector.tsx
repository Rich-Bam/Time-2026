import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-gray-600" />
      <Select value={language} onValueChange={(value: 'nl' | 'en') => setLanguage(value)}>
        <SelectTrigger className="w-[100px] h-8 border-gray-300">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="nl">🇳🇱 NL</SelectItem>
          <SelectItem value="en">🇬🇧 EN</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSelector;

