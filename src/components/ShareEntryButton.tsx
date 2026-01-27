import React from 'react';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';

interface ShareEntryButtonProps {
  onClick: () => void;
  disabled?: boolean;
  hasEntries?: boolean;
}

const ShareEntryButton: React.FC<ShareEntryButtonProps> = ({ 
  onClick, 
  disabled = false,
  hasEntries = true 
}) => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  if (!hasEntries) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size={isMobile ? "icon" : "sm"}
      onClick={onClick}
      disabled={disabled}
      className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-2 sm:py-1.5"
      title={t('share.share')}
    >
      <Share2 className="h-4 w-4" />
      {!isMobile && <span className="ml-1.5 text-xs">{t('share.share')}</span>}
    </Button>
  );
};

export default ShareEntryButton;
