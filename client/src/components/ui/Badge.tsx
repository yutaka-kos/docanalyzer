import type { ReactNode } from 'react';

export function Badge({ children, color = 'blue' }: { children: ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border ${colors[color] || colors.blue}`}>
      {children}
    </span>
  );
}
