import React from 'react';

/**
 * Option 2: Borderless Glow Pill with Semantic Micro-Dot (Apple Wallet & Raycast Style)
 * Sleek, ultra-clean micro-pill with 100% borderless translucent background and optional glowing dot.
 */
export function Badge({
  children,
  variant = 'emerald',
  size = 'sm',
  dot = false,
  pulse = false,
  icon = null,
  className = '',
  ...props
}) {
  const variantStyles = {
    emerald: 'bg-emerald-500/12 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400',
    amber: 'bg-amber-500/12 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400',
    rose: 'bg-rose-500/12 text-rose-600 dark:bg-rose-400/10 dark:text-rose-400',
    indigo: 'bg-indigo-500/12 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400',
    sky: 'bg-sky-500/12 text-sky-600 dark:bg-sky-400/10 dark:text-sky-400',
    neutral: 'bg-surface-layer2 text-text-secondary',
  };

  const dotStyles = {
    emerald: 'bg-wealth-emerald shadow-[0_0_6px_rgba(16,185,129,0.4)]',
    amber: 'bg-bullion-amber shadow-[0_0_6px_rgba(245,158,11,0.4)]',
    rose: 'bg-liability-rose shadow-[0_0_6px_rgba(244,63,94,0.4)]',
    indigo: 'bg-primary-accent shadow-[0_0_6px_rgba(99,102,241,0.4)]',
    sky: 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.4)]',
    neutral: 'bg-text-secondary',
  };

  const sizeStyles = {
    xs: 'text-typ-micro px-2 py-0.5',
    sm: 'text-typ-caption px-2.5 py-0.5',
    md: 'text-typ-label px-3 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold tracking-tight whitespace-nowrap shrink-0 transition-colors select-none ${variantStyles[variant] || variantStyles.emerald} ${sizeStyles[size] || sizeStyles.sm} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyles[variant] || dotStyles.emerald} ${pulse ? 'animate-pulse' : ''}`}
        />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
}

export default Badge;
