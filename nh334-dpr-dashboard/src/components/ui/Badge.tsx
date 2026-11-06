import React from 'react';

export type BadgeVariant = 'emerald' | 'amber' | 'crimson' | 'cyan' | 'neutral' | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'xs' | 'sm' | 'md';
  pulse?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'emerald',
  size = 'sm',
  pulse = false,
  className = '',
  icon
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    emerald: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-950/60 text-amber-300 border-amber-500/30',
    crimson: 'bg-rose-950/60 text-rose-300 border-rose-500/30',
    cyan: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30',
    neutral: 'bg-slate-800/60 text-slate-300 border-slate-700/40',
    purple: 'bg-purple-950/60 text-purple-300 border-purple-500/30'
  };

  const dotColors: Record<BadgeVariant, string> = {
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    crimson: 'bg-rose-400',
    cyan: 'bg-cyan-400',
    neutral: 'bg-slate-400',
    purple: 'bg-purple-400'
  };

  const sizeStyles = {
    xs: 'text-[10px] px-1.5 py-0.5 rounded',
    sm: 'text-xs px-2.5 py-0.5 rounded-md font-medium',
    md: 'text-sm px-3 py-1 rounded-lg font-medium'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 border backdrop-blur-sm transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColors[variant]}`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${dotColors[variant]}`}
          />
        </span>
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
