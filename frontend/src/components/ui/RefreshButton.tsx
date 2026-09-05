'use client';

import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface RefreshButtonProps {
  onRefresh: () => void | Promise<unknown>;
  className?: string;
  size?: 'sm' | 'md';
}

export function RefreshButton({ onRefresh, className = '', size = 'md' }: RefreshButtonProps) {
  const [spinning, setSpinning] = useState(false);

  const handleClick = async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setSpinning(false), 350);
    }
  };

  const sizeClass = size === 'sm' ? 'p-2' : 'p-2.5';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={spinning}
      aria-label="Refresh"
      aria-busy={spinning}
      className={`${sizeClass} bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <RefreshCw className={`w-4 h-4 text-slate-300 ${spinning ? 'animate-spin' : ''}`} />
    </button>
  );
}
