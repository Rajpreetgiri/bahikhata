import {
  ShoppingCart,
  Leaf,
  Utensils,
  Pill,
  Shirt,
  Smartphone,
  Wrench,
  Droplets,
  Car,
  Briefcase,
  CakeSlice,
  FlaskConical,
  Sprout,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface CategoryConfig {
  id: string;
  label: string;
  Icon: LucideIcon;
  color: string;      // Tailwind text-color class for the icon
  bgColor: string;    // Tailwind bg-color class for icon container
}

export const CATEGORY_CONFIG: CategoryConfig[] = [
  { id: 'kirana',        label: 'Kirana Store',         Icon: ShoppingCart,  color: 'text-amber-600',   bgColor: 'bg-amber-50'  },
  { id: 'grocery',       label: 'Grocery / Sabzi',      Icon: Leaf,          color: 'text-green-600',   bgColor: 'bg-green-50'  },
  { id: 'restaurant',    label: 'Restaurant / Dhaba',   Icon: Utensils,      color: 'text-orange-600',  bgColor: 'bg-orange-50' },
  { id: 'pharmacy',      label: 'Pharmacy / Medical',   Icon: Pill,          color: 'text-red-600',     bgColor: 'bg-red-50'    },
  { id: 'cloth',         label: 'Cloth / Garments',     Icon: Shirt,         color: 'text-pink-600',    bgColor: 'bg-pink-50'   },
  { id: 'electronics',   label: 'Electronics',          Icon: Smartphone,    color: 'text-blue-600',    bgColor: 'bg-blue-50'   },
  { id: 'hardware',      label: 'Hardware / Tools',     Icon: Wrench,        color: 'text-zinc-600',    bgColor: 'bg-zinc-100'  },
  { id: 'dairy',         label: 'Dairy / Milk',         Icon: Droplets,      color: 'text-sky-600',     bgColor: 'bg-sky-50'    },
  { id: 'automobile',    label: 'Automobile',           Icon: Car,           color: 'text-slate-600',   bgColor: 'bg-slate-100' },
  { id: 'professional',  label: 'Professional',         Icon: Briefcase,     color: 'text-indigo-600',  bgColor: 'bg-indigo-50' },
  { id: 'pastry',        label: 'Pastry / Bakery',      Icon: CakeSlice,     color: 'text-rose-600',    bgColor: 'bg-rose-50'   },
  { id: 'seeds_chemical',label: 'Seeds / Chemical',     Icon: Sprout,        color: 'text-lime-700',    bgColor: 'bg-lime-50'   },
  { id: 'other',         label: 'Other',                Icon: Sparkles,      color: 'text-purple-600',  bgColor: 'bg-purple-50' },
];

export function getCategoryConfig(id?: string): CategoryConfig | undefined {
  return CATEGORY_CONFIG.find((c) => c.id === id);
}
