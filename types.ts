
export interface LauncherItem {
  id: string;
  name: string;
  exePath: string; // Used for URL if type is 'web'
  description: string;
  icon: string;
  category: string;
  color: string;
  itemType?: 'app' | 'web';
}

export interface LauncherDB {
  items: LauncherItem[];
  categories: string[];
  lastUpdated: string;
}

export type ViewMode = 'design' | 'preview';

export const DEFAULT_CATEGORIES = [
  'Tools',
  'Games',
  'Development',
  'Office',
  'System',
  'Social',
  'Web',
  'Other'
];
