'use client';

import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';

type ActionButtonVariant =
  | 'primary'
  | 'purple'
  | 'green'
  | 'danger'
  | 'danger-outline'
  | 'secondary'
  | 'ghost';

interface ActionButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  onClick?: () => void | Promise<unknown>;
  /** External loading state (e.g. parent tracks action by id) */
  loading?: boolean;
  variant?: ActionButtonVariant;
  size?: 'sm' | 'md';
}

const variantStyles: Record<ActionButtonVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white',
  purple: 'bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white',
  green: 'bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white',
  danger: 'bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white',
  'danger-outline':
    'bg-red-600/20 border border-red-600/50 hover:bg-red-600/40 text-red-400 disabled:opacity-50',
  secondary: 'bg-slate-800 border border-white/10 hover:bg-slate-700 text-white disabled:opacity-50',
  ghost: 'bg-transparent hover:bg-white/5 text-slate-400 hover:text-white disabled:opacity-50',
};

const sizeStyles = {
  sm: 'py-1.5 px-3.5 text-xs',
  md: 'py-2.5 px-4 text-xs',
};

export function ButtonSpinner({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin shrink-0`} />;
}

export function ActionButton({
  onClick,
  loading: externalLoading = false,
  disabled,
  children,
  variant = 'primary',
  size = 'sm',
  className = '',
  type = 'button',
  ...props
}: ActionButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = externalLoading || internalLoading;

  const handleClick = useCallback(async () => {
    if (loading || disabled || !onClick) return;
    setInternalLoading(true);
    try {
      await onClick();
    } finally {
      setInternalLoading(false);
    }
  }, [onClick, loading, disabled]);

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled || loading}
      className={`rounded-lg font-bold transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-1.5 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {loading && <ButtonSpinner />}
      {children}
    </button>
  );
}
