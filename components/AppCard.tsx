
import React, { useState } from 'react';
import { Edit2, Trash2, Loader2 } from 'lucide-react';
import { LauncherItem } from '../types';

interface AppCardProps {
  item: LauncherItem;
  lang: 'en' | 'zh';
  onEdit: (item: LauncherItem) => void;
  onDelete: (id: string) => void;
  isPreview?: boolean;
  onLaunch?: () => void;
}

const AppCard: React.FC<AppCardProps> = ({ item, lang, onEdit, onDelete, isPreview = false, onLaunch }) => {
  const [isLaunching, setIsLaunching] = useState(false);

  const handleLaunchClick = (e: React.MouseEvent) => {
    if (isPreview && onLaunch) {
      e.preventDefault();
      setIsLaunching(true);
      onLaunch();
      setTimeout(() => setIsLaunching(false), 2000);
    }
  };

  const renderIcon = (sizeClass: string, textClass: string) => {
    const hasIcon = item.icon && (item.icon.startsWith('data:') || item.icon.startsWith('http'));
    return (
      <div 
        className={`${sizeClass} rounded-2xl flex items-center justify-center text-white shadow-xl transition-transform group-hover:scale-110 overflow-hidden relative`}
        style={{ backgroundColor: item.color }}
      >
        {hasIcon ? (
          <img src={item.icon} alt={item.name} className="w-full h-full object-contain p-2" />
        ) : (
          <span className={`${textClass} font-bold`}>{item.name.charAt(0)}</span>
        )}
      </div>
    );
  };

  if (isPreview) {
    return (
      <div 
        onClick={handleLaunchClick}
        className="group relative bg-slate-900/40 rounded-2xl border border-slate-800/50 p-5 transition-all duration-300 cursor-pointer hover:border-blue-500/50 hover:bg-slate-800 hover:-translate-y-1 active:scale-95 shadow-lg hover:shadow-blue-500/10 flex flex-col items-center text-center"
      >
        {/* Launching Overlay */}
        {isLaunching && (
          <div className="absolute inset-0 z-10 bg-slate-900/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center animate-in fade-in duration-200">
            <Loader2 className="text-blue-500 animate-spin mb-2" size={24} />
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
              {lang === 'zh' ? '正在启动' : 'Launching'}
            </span>
          </div>
        )}

        {renderIcon("w-16 h-16 mb-4", "text-3xl")}

        <h3 className="text-base font-bold text-white mb-1 truncate w-full px-2">{item.name}</h3>
        
        {item.description && (
          <p className="text-[11px] text-slate-400 line-clamp-2 min-h-[32px] mb-3 px-2 leading-relaxed group-hover:text-slate-300 transition-colors">
            {item.description}
          </p>
        )}

        <div className="mt-auto">
          <span className="px-2 py-0.5 bg-slate-800/80 text-slate-500 rounded-md text-[9px] font-bold uppercase tracking-wider border border-slate-700/50 group-hover:text-blue-400 group-hover:border-blue-500/30 transition-colors">
            {item.category}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="group relative bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden transition-all duration-300 hover:border-slate-500"
    >
      <div 
        className="h-1.5 w-full" 
        style={{ backgroundColor: item.color }}
      />
      
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          {renderIcon("w-14 h-14", "text-2xl")}
          
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(item); }}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <h3 className="text-lg font-bold text-white mb-1 truncate">{item.name}</h3>
        <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px] mb-4 group-hover:text-slate-300 transition-colors">
          {item.description}
        </p>
        
        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-auto overflow-hidden">
          <span className="px-2 py-0.5 bg-slate-700 rounded-md font-bold uppercase tracking-wider text-slate-300 shrink-0">
            {item.category}
          </span>
          <span className="truncate flex-1 font-mono opacity-50">{item.exePath}</span>
        </div>
      </div>
    </div>
  );
};

export default AppCard;
