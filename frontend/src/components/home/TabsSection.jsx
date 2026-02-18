import { Flame, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const TabsSection = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border/50">
      {/* Tabs */}
      <div className="flex items-center gap-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 pb-2 text-base font-medium transition-all duration-200 relative ${
              activeTab === tab.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon === 'fire' && (
              <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
            )}
            <span>{tab.name}</span>
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cta rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* View All */}
      <Button 
        variant="ghost" 
        className="text-primary hover:text-primary-glow hover:bg-transparent font-medium flex items-center gap-1"
      >
        View All
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default TabsSection;
