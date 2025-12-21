
import React from 'react';
import { LayoutDashboard, Settings, MonitorPlay, FolderTree, Hash } from 'lucide-react';
import { ViewMode } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  setView: (view: ViewMode) => void;
  lang: 'en' | 'zh';
  categories: string[];
  filterCategory: string;
  setFilterCategory: (cat: string) => void;
}

const translations = {
  en: {
    design: 'Manager',
    preview: 'Launcher',
    workspace: 'Workspace',
    defaultProj: 'Default Project',
    categories: 'Categories',
    all: 'All Categories'
  },
  zh: {
    design: '管理中心',
    preview: '启动器',
    workspace: '工作空间',
    defaultProj: '默认项目',
    categories: '分类目录',
    all: '所有分类'
  }
};

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  setView, 
  lang, 
  categories, 
  filterCategory, 
  setFilterCategory 
}) => {
  const t = translations[lang];

  const navItems = [
    { id: 'preview', label: t.preview, icon: MonitorPlay },
    { id: 'design', label: t.design, icon: LayoutDashboard },
  ];

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0">
      <div className="p-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent flex items-center gap-2">
          <Settings className="text-blue-500" /> WinLaunch
        </h1>
      </div>

      <nav className="px-4 space-y-2 mt-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id as ViewMode)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              currentView === item.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="px-6 mt-8 mb-4">
        <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">
          <FolderTree size={12} className="text-blue-500" />
          {t.categories}
        </div>
      </div>

      <div className="flex-1 px-4 overflow-y-auto custom-scrollbar space-y-1">
        <button
          onClick={() => setFilterCategory('all')}
          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${
            filterCategory === 'all'
              ? 'bg-slate-800 text-blue-400 font-bold border border-blue-500/20'
              : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
          }`}
        >
          <Hash size={14} className={filterCategory === 'all' ? 'text-blue-400' : 'text-slate-600'} />
          {t.all}
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all truncate ${
              filterCategory === cat
                ? 'bg-slate-800 text-blue-400 font-bold border border-blue-500/20'
                : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
            }`}
          >
            <Hash size={14} className={filterCategory === cat ? 'text-blue-400' : 'text-slate-600'} />
            <span className="truncate">{cat}</span>
          </button>
        ))}
      </div>

      <div className="p-4 mt-auto">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">{t.workspace}</p>
          <p className="text-sm font-medium text-slate-300">{t.defaultProj}</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
