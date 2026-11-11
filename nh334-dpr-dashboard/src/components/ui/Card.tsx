import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hoverEffect?: boolean;
  glow?: 'emerald' | 'amber' | 'crimson' | 'cyan' | 'purple' | 'none';
  className?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({
  children,
  hoverEffect = false,
  glow = 'none',
  className = '',
  ...props
}, ref) => {
  const glowStyles = {
    none: 'border-white/10 shadow-lg shadow-black/40',
    emerald: 'border-emerald-500/40 shadow-[0_4px_25px_-4px_rgba(16,185,129,0.22)] ring-1 ring-emerald-500/20',
    amber: 'border-amber-500/40 shadow-[0_4px_25px_-4px_rgba(245,158,11,0.22)] ring-1 ring-amber-500/20',
    crimson: 'border-rose-500/40 shadow-[0_4px_25px_-4px_rgba(239,68,68,0.24)] ring-1 ring-rose-500/20',
    cyan: 'border-cyan-500/40 shadow-[0_4px_25px_-4px_rgba(6,182,212,0.22)] ring-1 ring-cyan-500/20',
    purple: 'border-purple-500/40 shadow-[0_4px_25px_-4px_rgba(168,85,247,0.22)] ring-1 ring-purple-500/20'
  };

  return (
    <div
      ref={ref}
      className={`relative rounded-2xl bg-[#13161D] backdrop-blur-md border border-white/10 overflow-hidden transition-all duration-300 ${
        hoverEffect ? 'hover:border-white/25 hover:shadow-2xl hover:-translate-y-0.5' : ''
      } ${glowStyles[glow]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});
Card.displayName = 'Card';

export const CardHeader: React.FC<{
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}> = ({ children, className = '', action }) => (
  <div className={`p-4 sm:p-5 pb-3 flex items-start justify-between gap-4 border-b border-white/[0.04] ${className}`}>
    <div className="space-y-1 min-w-0 flex-1">{children}</div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const CardTitle: React.FC<{
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}> = ({ children, className = '', icon }) => (
  <h3 className={`text-sm sm:text-base font-semibold tracking-tight text-slate-100 flex items-center gap-2 ${className}`}>
    {icon && <span className="text-cyan-400 shrink-0">{icon}</span>}
    <span>{children}</span>
  </h3>
);

export const CardDescription: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <p className={`text-xs text-slate-400 font-normal leading-relaxed ${className}`}>
    {children}
  </p>
);

export const CardContent: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`p-4 sm:p-5 ${className}`}>{children}</div>
);
