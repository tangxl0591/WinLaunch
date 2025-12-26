
import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Loader2, FolderOpen, Image as ImageIcon, Upload, Globe, ChevronDown } from 'lucide-react';
import { LauncherItem } from '../types';
import { suggestAppDetails } from '../services/geminiService';

const electron = (window as any).require ? (window as any).require('electron') : null;

interface ItemEditorProps {
  item?: LauncherItem;
  defaultType?: 'app' | 'web';
  isOpen: boolean;
  lang: 'en' | 'zh';
  existingCategories: string[];
  onClose: () => void;
  onSave: (item: LauncherItem) => void;
}

const translations = {
  en: {
    editApp: 'Edit Application',
    addApp: 'Add New Application',
    editWeb: 'Edit Website',
    addWeb: 'Add New Website',
    name: 'Name',
    namePlaceholderApp: 'e.g. Visual Studio Code',
    namePlaceholderWeb: 'e.g. Google Search',
    pathApp: 'Executable Path',
    pathWeb: 'Website URL',
    pathPlaceholderApp: 'C:\\Programs\\App\\app.exe',
    pathPlaceholderWeb: 'https://www.google.com',
    category: 'Category',
    customCategory: 'Custom Category',
    categoryPlaceholder: 'Select category...',
    themeColor: 'Theme Color',
    desc: 'Short Description',
    descPlaceholder: 'Brief description...',
    cancel: 'Cancel',
    save: 'Save Changes',
    create: 'Create Item',
    suggest: 'AI Info',
    browse: 'Browse File',
    fetchWebIcon: 'Fetch Icon',
    upload: 'Upload Image',
    iconPreview: 'Icon Preview',
    other: 'Add New Category...'
  },
  zh: {
    editApp: '编辑应用程序',
    addApp: '添加新应用程序',
    editWeb: '编辑网页',
    addWeb: '添加新网页',
    name: '名称',
    namePlaceholderApp: '例如：Visual Studio Code',
    namePlaceholderWeb: '例如：谷歌搜索',
    pathApp: '可执行文件路径',
    pathWeb: '网页链接',
    pathPlaceholderApp: 'C:\\Programs\\App\\app.exe',
    pathPlaceholderWeb: 'https://www.google.com',
    category: '所属类别',
    customCategory: '自定义类别名称',
    categoryPlaceholder: '选择类别...',
    themeColor: '主题颜色',
    desc: '简短描述',
    descPlaceholder: '应用的简要说明...',
    cancel: '取消',
    save: '保存更改',
    create: '创建项目',
    suggest: 'AI 补充',
    browse: '浏览文件',
    fetchWebIcon: '获取网站图标',
    upload: '上传图标',
    iconPreview: '图标预览',
    other: '添加新分类...'
  }
};

const ItemEditor: React.FC<ItemEditorProps> = ({ item, defaultType = 'app', isOpen, lang, existingCategories, onClose, onSave }) => {
  const [formData, setFormData] = useState<Omit<LauncherItem, 'id'>>({
    name: '',
    exePath: '',
    description: '',
    icon: '',
    category: 'Other',
    color: '#3b82f6',
    itemType: 'app'
  });
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [iconLoading, setIconLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];

  // Use only existing categories passed from App (source of truth is categories.json)
  const allCategories = Array.from(new Set([...existingCategories])).sort();

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        exePath: item.exePath,
        description: item.description,
        icon: item.icon,
        category: item.category,
        color: item.color,
        itemType: item.itemType || 'app'
      });
      setIsCustomCategory(!allCategories.includes(item.category));
    } else {
      const initialCat = defaultType === 'web' ? 'Web' : 'Other';
      setFormData({
        name: '',
        exePath: '',
        description: '',
        icon: '',
        category: initialCat,
        color: defaultType === 'web' ? '#10b981' : '#3b82f6',
        itemType: defaultType
      });
      setIsCustomCategory(false);
    }
  }, [item, isOpen, defaultType, existingCategories]);

  const handleSuggest = async () => {
    if (!formData.name) return;
    setLoading(true);
    const suggestion = await suggestAppDetails(formData.name);
    if (suggestion) {
      const newCat = suggestion.category || formData.category;
      setFormData(prev => ({
        ...prev,
        description: suggestion.description || prev.description,
        color: suggestion.color || prev.color,
        category: newCat
      }));
      if (!allCategories.includes(newCat)) {
        setIsCustomCategory(true);
      }
    }
    setLoading(false);
  };

  const handleBrowse = async () => {
    if (electron && formData.itemType === 'app') {
      const filePath = await electron.ipcRenderer.invoke('open-file-dialog');
      if (filePath) {
        setFormData(prev => ({ ...prev, exePath: filePath }));
        setIconLoading(true);
        const iconData = await electron.ipcRenderer.invoke('get-file-icon', filePath);
        if (iconData) setFormData(prev => ({ ...prev, icon: iconData }));
        setIconLoading(false);
        if (!formData.name) {
          const fileName = filePath.split(/[\\/]/).pop()?.replace(/\.(exe|lnk|bat|cmd)$/i, '');
          if (fileName) setFormData(prev => ({ ...prev, name: fileName }));
        }
      }
    }
  };

  const fetchFavicon = async () => {
    let url = formData.exePath.trim();
    if (!url) return;
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
      setFormData(prev => ({ ...prev, exePath: url }));
    }

    setIconLoading(true);
    try {
      if (electron) {
        const result = await electron.ipcRenderer.invoke('fetch-url-info', url);
        if (result && result.icon) {
          setFormData(prev => ({ 
            ...prev, 
            icon: result.icon,
            color: result.themeColor || prev.color
          }));
        } else {
          throw new Error('Fetch failed');
        }
      }
    } catch (e) {
      alert(lang === 'zh' ? '获取网站图标失败，请确认链接有效' : 'Failed to fetch icon. Ensure the URL is valid.');
    } finally {
      setIconLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData(prev => ({ ...prev, icon: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  const isWeb = formData.itemType === 'web';
  const modalTitle = item ? (isWeb ? t.editWeb : t.editApp) : (isWeb ? t.addWeb : t.addApp);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            {isWeb ? <Globe className="text-blue-400" size={24} /> : <ImageIcon className="text-emerald-400" size={24} />}
            <h2 className="text-xl font-bold text-white">{modalTitle}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="space-y-4 w-full md:w-32 flex-shrink-0">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider text-center">{t.iconPreview}</label>
              <div 
                className="w-32 h-32 rounded-3xl flex items-center justify-center shadow-2xl border-4 border-slate-800 overflow-hidden mx-auto transition-all group relative"
                style={{ backgroundColor: formData.color }}
              >
                {iconLoading ? (
                  <Loader2 className="animate-spin text-white/50" size={32} />
                ) : formData.icon ? (
                  <img src={formData.icon} alt="icon" className="w-full h-full object-contain p-4" />
                ) : (
                  <span className="text-5xl font-bold text-white/90">{formData.name ? formData.name.charAt(0) : (isWeb ? <Globe size={48} className="opacity-20" /> : <ImageIcon size={48} className="opacity-20" />)}</span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                   <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-white/20 rounded-full hover:bg-white/40 text-white">
                      <Upload size={20} />
                   </button>
                </div>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="w-full text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-slate-700">
                <Upload size={12} /> {t.upload}
              </button>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
            </div>

            <div className="flex-1 space-y-5 w-full">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">{t.name}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder={isWeb ? t.namePlaceholderWeb : t.namePlaceholderApp}
                  />
                  <button
                    onClick={handleSuggest}
                    disabled={loading || !formData.name}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 rounded-xl transition-all flex items-center gap-2 text-xs font-bold shrink-0"
                  >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                    {t.suggest}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">{isWeb ? t.pathWeb : t.pathApp}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.exePath}
                    onChange={(e) => setFormData({ ...formData, exePath: e.target.value })}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder={isWeb ? t.pathPlaceholderWeb : t.pathPlaceholderApp}
                  />
                  {isWeb ? (
                    <button
                      onClick={fetchFavicon}
                      disabled={iconLoading || !formData.exePath}
                      className="bg-slate-700 hover:bg-slate-600 text-white px-4 rounded-xl transition-all flex items-center gap-2 text-xs font-bold border border-slate-600 shrink-0 disabled:opacity-50"
                    >
                      {iconLoading ? <Loader2 className="animate-spin" size={16} /> : <Globe size={16} />}
                      {t.fetchWebIcon}
                    </button>
                  ) : (
                    <button
                      onClick={handleBrowse}
                      className="bg-slate-700 hover:bg-slate-600 text-white px-4 rounded-xl transition-all flex items-center gap-2 text-xs font-bold border border-slate-600 shrink-0"
                    >
                      <FolderOpen size={16} />
                      {t.browse}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">{t.category}</label>
                  {!isCustomCategory ? (
                    <div className="relative">
                      <select
                        value={formData.category}
                        onChange={(e) => {
                          if (e.target.value === 'CUSTOM') {
                            setIsCustomCategory(true);
                            setFormData({ ...formData, category: '' });
                          } else {
                            setFormData({ ...formData, category: e.target.value });
                          }
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm appearance-none cursor-pointer pr-10"
                      >
                        {allCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="CUSTOM" className="text-blue-400 font-bold border-t border-slate-700">+ {t.other}</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        autoFocus
                        type="text"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full bg-slate-800 border border-blue-500/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                        placeholder={t.customCategory}
                      />
                      <button 
                        onClick={() => {
                          setIsCustomCategory(false);
                          setFormData({ ...formData, category: 'Other' });
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">{t.themeColor}</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="h-10 w-12 bg-slate-800 border border-slate-700 rounded-xl cursor-pointer p-1"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">{t.desc}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
              placeholder={t.descPlaceholder}
            />
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition-colors font-medium text-sm">{t.cancel}</button>
          <button
            onClick={() => onSave({ ...formData, id: item?.id || crypto.randomUUID() })}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/40 active:scale-95"
          >
            {item ? t.save : t.create}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemEditor;
