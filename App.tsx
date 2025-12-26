
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import AppCard from './components/AppCard';
import ItemEditor from './components/ItemEditor';
import { LauncherItem, ViewMode, DEFAULT_CATEGORIES } from './types';
import { Search, Monitor, Rocket, Languages, FolderTree, Globe, Plus, Cpu, Filter, Clock } from 'lucide-react';

const electron = (window as any).require ? (window as any).require('electron') : null;

const translations = {
  en: {
    title: 'WinLaunch Studio',
    search: 'Filter items...',
    platform: 'Platform: Windows',
    designTitle: 'Management Center',
    addNew: 'Add New Project',
    noApps: 'No items found',
    noAppsSub: 'Try searching for something else or add your first item.',
    itemsCount: 'Items',
    version: 'Version',
    powered: 'Powered by WinLaunch Engine',
    confirmDelete: 'Are you sure?',
    allCategories: 'All Categories',
    chooseType: 'Choose Item Type',
    appType: 'Application',
    webType: 'Website',
    appDesc: 'Select an EXE file',
    webDesc: 'Web link or URL',
    filterBy: 'Filter by Category'
  },
  zh: {
    title: 'WinLaunch 工作台',
    search: '过滤项目...',
    platform: '平台: Windows',
    designTitle: '管理中心',
    addNew: '添加新项目',
    noApps: '未发现项目',
    noAppsSub: '尝试搜索其他内容或添加您的第一个项目。',
    itemsCount: '项目数',
    version: '版本',
    powered: '由 WinLaunch 引擎驱动',
    confirmDelete: '确定删除吗？',
    allCategories: '所有分类',
    chooseType: '选择项目类型',
    appType: '本地应用',
    webType: '互联网页',
    appDesc: '通过文件管理器选择应用',
    webDesc: '网页链接或在线地址',
    filterBy: '按分类过滤'
  }
};

const App: React.FC = () => {
  const [lang, setLang] = useState<'en' | 'zh'>('zh');
  const [items, setItems] = useState<LauncherItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<ViewMode>('preview');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LauncherItem | undefined>();
  const [editorType, setEditorType] = useState<'app' | 'web'>('app');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [now, setNow] = useState(new Date());

  const t = translations[lang];

  // Clock effect
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format Date and Time
  const formattedDate = useMemo(() => {
    return now.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  }, [now, lang]);

  const formattedTime = useMemo(() => {
    return now.toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }, [now, lang]);

  // Load Initial Data from File System
  useEffect(() => {
    const init = async () => {
      const savedLang = localStorage.getItem('winlaunch_lang') as 'en' | 'zh';
      if (savedLang) setLang(savedLang);

      if (electron) {
        const loadedItems = await electron.ipcRenderer.invoke('load-storage-file', 'items');
        const loadedCategories = await electron.ipcRenderer.invoke('load-storage-file', 'categories');
        
        if (loadedItems) {
          setItems(loadedItems);
        }

        // Strictly load categories from JSON. If missing, use defaults and save them.
        if (loadedCategories && Array.isArray(loadedCategories) && loadedCategories.length > 0) {
          setCategories(loadedCategories.sort());
        } else {
          setCategories(DEFAULT_CATEGORIES.sort());
          await electron.ipcRenderer.invoke('save-storage-file', { 
            fileName: 'categories', 
            data: DEFAULT_CATEGORIES.sort() 
          });
        }
      } else {
        // Mock data for web preview
        setCategories(DEFAULT_CATEGORIES);
      }
    };
    init();
  }, []);

  const persist = useCallback(async (newItems: LauncherItem[], newCats: string[]) => {
    if (electron) {
      await electron.ipcRenderer.invoke('save-storage-file', { fileName: 'items', data: newItems });
      await electron.ipcRenderer.invoke('save-storage-file', { fileName: 'categories', data: newCats });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('winlaunch_lang', lang);
  }, [lang]);

  const handleSaveItem = (item: LauncherItem) => {
    let newItems: LauncherItem[];
    const exists = items.find(i => i.id === item.id);
    if (exists) {
      newItems = items.map(i => i.id === item.id ? item : i);
    } else {
      newItems = [...items, item];
    }
    
    let newCats = [...categories];
    if (item.category && !categories.includes(item.category)) {
      newCats = [...categories, item.category].sort();
    }

    setItems(newItems);
    setCategories(newCats);
    persist(newItems, newCats);
    setIsEditorOpen(false);
    setEditingItem(undefined);
  };

  const handleDeleteItem = (id: string) => {
    if (confirm(t.confirmDelete)) {
      const newItems = items.filter(i => i.id !== id);
      setItems(newItems);
      persist(newItems, categories);
    }
  };

  const handleLaunch = (item: LauncherItem) => {
    if (electron) {
      if (item.itemType === 'web') {
        electron.ipcRenderer.send('launch-link', item.exePath);
      } else {
        electron.ipcRenderer.send('launch-app', item.exePath);
      }
    } else {
      alert(`Simulation: Launching ${item.name}`);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesFilter;
  });

  const groupedItems = useMemo(() => {
    const groups: Record<string, LauncherItem[]> = {};
    filteredItems.forEach(item => {
      const cat = item.category || (lang === 'zh' ? '未分类' : 'Uncategorized');
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredItems, lang]);

  const activeCategories = useMemo(() => {
    return Object.keys(groupedItems).sort((a, b) => {
      if (a === 'Web') return -1;
      if (b === 'Web') return 1;
      return a.localeCompare(b);
    });
  }, [groupedItems]);

  const handleAddNewClick = () => {
    setIsTypePickerOpen(true);
  };

  const startAddFlow = async (type: 'app' | 'web') => {
    setIsTypePickerOpen(false);
    
    if (type === 'app' && electron) {
      const filePath = await electron.ipcRenderer.invoke('open-file-dialog');
      if (filePath) {
        const iconData = await electron.ipcRenderer.invoke('get-file-icon', filePath);
        const fileName = filePath.split(/[\\/]/).pop()?.replace(/\.(exe|lnk|bat|cmd)$/i, '');
        
        const tempItem: LauncherItem = {
          id: crypto.randomUUID(),
          name: fileName || '',
          exePath: filePath,
          description: '',
          icon: iconData || '',
          category: 'Other',
          color: '#3b82f6',
          itemType: 'app'
        };
        
        setEditingItem(tempItem);
        setEditorType('app');
        setIsEditorOpen(true);
      }
    } else {
      setEditorType(type);
      setEditingItem(undefined);
      setIsEditorOpen(true);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar 
        currentView={currentView} 
        setView={setCurrentView} 
        lang={lang}
        categories={categories}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        formattedTime={formattedTime}
        formattedDate={formattedDate}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-8 flex items-center justify-between z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder={t.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-full pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>
          
          <div className="hidden lg:flex flex-col items-center flex-1">
            <div className="flex items-center gap-2 text-white font-mono text-sm tracking-[0.2em] font-bold">
              <Clock size={14} className="text-blue-500" />
              {formattedTime}
            </div>
            <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{formattedDate}</div>
          </div>

          <div className="flex items-center gap-6 flex-1 justify-end">
            <button 
              onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors border border-slate-700"
            >
              <Languages size={14} />
              {lang === 'en' ? '简体中文' : 'English'}
            </button>
            <div className="flex items-center gap-2 text-slate-400">
              <Monitor size={18} />
              <span className="text-xs font-medium">{t.platform}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {currentView === 'design' && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="mb-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-1 tracking-tight">{t.designTitle}</h2>
                  </div>
                </div>
                
                <div className="h-px bg-slate-800/60 w-full mb-6" />

                <div className="flex flex-col gap-4 mb-10">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Filter size={14} className="text-blue-500" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{t.filterBy}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button 
                      onClick={() => setFilterCategory('all')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${filterCategory === 'all' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'}`}
                    >
                      {t.allCategories}
                    </button>
                    {categories.map(cat => (
                      <button 
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${filterCategory === cat ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <button 
                  onClick={handleAddNewClick}
                  className="group border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-8 text-slate-500 hover:text-slate-300 hover:border-blue-500/50 transition-all hover:bg-blue-500/5 min-h-[200px]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 group-hover:bg-blue-600/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Plus size={24} className="group-hover:text-blue-400" />
                  </div>
                  <span className="font-bold text-sm tracking-wide">{t.addNew}</span>
                </button>
                {filteredItems.map(item => (
                  <AppCard 
                    key={item.id} 
                    item={item} 
                    lang={lang}
                    onEdit={(it) => {
                      setEditingItem(it);
                      setEditorType(it.itemType || 'app');
                      setIsEditorOpen(true);
                    }}
                    onDelete={handleDeleteItem}
                  />
                ))}
              </div>
            </div>
          )}

          {currentView === 'preview' && (
            <div className="animate-in fade-in duration-500 space-y-10">
              {activeCategories.length > 0 ? (
                activeCategories.map(cat => (
                  <section key={cat} className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-800/50 pb-3">
                      <FolderTree className="text-blue-500" size={18} />
                      <h3 className="text-sm font-bold text-slate-300 tracking-[0.1em] uppercase">{cat}</h3>
                      <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                        {groupedItems[cat] ? groupedItems[cat].length : 0}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                      {groupedItems[cat] && groupedItems[cat].map(item => (
                        <AppCard 
                          key={item.id} 
                          item={item} 
                          lang={lang}
                          onEdit={() => {}} 
                          onDelete={() => {}} 
                          isPreview 
                          onLaunch={() => handleLaunch(item)}
                        />
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="text-center py-24 bg-slate-900/30 rounded-3xl border border-slate-800/50">
                  <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Search className="text-slate-600" size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-300">{t.noApps}</h3>
                  <p className="text-slate-500 mt-2">{t.noAppsSub}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="h-8 bg-slate-900 border-t border-slate-800 px-4 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex gap-4">
            <span>{t.itemsCount}: {items.length}</span>
            <span>{t.version}: 1.0.0-beta</span>
          </div>
          <div>{t.powered}</div>
        </footer>
      </main>

      {isTypePickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold text-white tracking-tight">{t.chooseType}</h3>
                <button onClick={() => setIsTypePickerOpen(false)} className="text-slate-500 hover:text-white transition-colors bg-slate-800 p-2 rounded-full">
                  <Plus className="rotate-45" size={20} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={() => startAddFlow('app')}
                  className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group"
                >
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-xl">
                    <Cpu size={32} />
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-white text-lg">{t.appType}</div>
                    <div className="text-slate-500 text-xs mt-1">{t.appDesc}</div>
                  </div>
                </button>

                <button 
                  onClick={() => startAddFlow('web')}
                  className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-slate-800/50 border border-slate-700 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
                >
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all shadow-xl">
                    <Globe size={32} />
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-white text-lg">{t.webType}</div>
                    <div className="text-slate-500 text-xs mt-1">{t.webDesc}</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ItemEditor 
        isOpen={isEditorOpen}
        item={editingItem}
        defaultType={editorType}
        lang={lang}
        existingCategories={categories}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveItem}
      />
    </div>
  );
};

export default App;
