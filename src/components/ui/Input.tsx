import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, icon, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label className="text-xs text-slate-400 flex items-center gap-1.5">
            {icon}
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-all text-white ${className}`}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
