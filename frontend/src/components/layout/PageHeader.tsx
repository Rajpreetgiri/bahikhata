import { ArrowLeft, LucideIcon } from 'lucide-react';

const HEADER_PADDING_TOP = 'pt-4 md:pt-6';

export interface PageHeaderAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

interface PageHeaderProps {
  title: string;
  /** Optional back navigation. Pass onBack to show back button. */
  onBack?: () => void;
  /** Optional primary action (e.g. New, Add). Rendered with consistent size. */
  action?: PageHeaderAction;
  /** Optional right-side node (e.g. status badge). Shown after action. */
  right?: React.ReactNode;
  /** Extra class for the header container. */
  className?: string;
  /** If true, use safe area top padding (for pages that need status bar clearance on mobile). */
  safeTop?: boolean;
  /** Optional node below title (e.g. search, tabs). Not part of the "bar" — use for page-specific content. */
  children?: React.ReactNode;
}

/** Reusable page header: consistent padding, safe area, and primary action button size. */
export default function PageHeader({ title, onBack, action, right, className = '', safeTop = true, children }: PageHeaderProps) {
  return (
    <div
      className={`bg-white border-b border-gray-100 ${HEADER_PADDING_TOP} pb-4 ${className}`}
    >
      <div className="px-4 md:px-6 flex items-center justify-between gap-3 min-h-10">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex-shrink-0 p-2 rounded-xl hover:bg-gray-100 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900 truncate">{title}</h1>
        </div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.disabled || action.loading}
            className="flex-shrink-0 flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {action.loading ? (
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : action.icon ? (
              <action.icon size={18} />
            ) : null}
            <span className="truncate">{action.label}</span>
          </button>
        )}
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
      {children ? <div className="px-4 md:px-6 mt-3">{children}</div> : null}
    </div>
  );
}
