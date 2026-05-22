import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export function Input({ label, error, helper, id, className = '', ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={[
          'w-full rounded-lg px-3 py-2 text-sm text-gray-100 bg-surface-700',
          'border border-surface-500 focus:border-brand-500',
          'focus:outline-none focus:ring-2 focus:ring-brand-500/20',
          'placeholder:text-gray-500 transition-colors duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {helper && !error && <p className="text-xs text-gray-500">{helper}</p>}
    </div>
  );
}
