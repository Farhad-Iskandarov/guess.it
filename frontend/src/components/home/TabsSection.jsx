import { Flame, ChevronRight, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const TabsSection = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="flex items-center justify-between py-3 sm:py-4 border-b border-border/50 gap-2">
      {/* Tabs — scrollable on mobile */}
      <div className="flex items-center gap-3 sm:gap-5 md:gap-6 overflow-x-auto scrollbar-hide min-w-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            data-testid={`tab-${tab.id}`}
            className={`flex items-center gap-1 sm:gap-2 pb-2 text-sm sm:text-base font-medium transition-all duration-200 relative whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon === 'fire' && (
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 fill-orange-500" />
            )}
            {tab.icon === 'heart' && (
              <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTab === tab.id ? 'text-red-500 fill-red-500' : 'text-red-400'}`} />
            )}
            <span>{tab.name}</span>
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cta rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* View All — hidden on very small screens */}
      <Button 
        variant="ghost" 
        className="text-primary hover:text-primary-glow hover:bg-transparent font-medium flex items-center gap-1 flex-shrink-0 hidden sm:flex text-sm"
      >
        View All
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default TabsSection;
