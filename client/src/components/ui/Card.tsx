import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  animate?: boolean;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  style?: React.CSSProperties;
  id?: string;
}

const paddingMap = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({ children, padding = 'md', className = '', animate = true, onClick, style, id }: CardProps) {
  const cls = [
    'bg-surface-800 border border-surface-600 rounded-xl shadow-sm',
    paddingMap[padding],
    className,
  ].filter(Boolean).join(' ');

  if (!animate) {
    return <div className={cls} onClick={onClick} style={style} id={id}>{children}</div>;
  }

  return (
    <motion.div
      className={cls}
      onClick={onClick}
      style={style}
      id={id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
