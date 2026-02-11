
import React from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ text, children, position = 'top' }) => {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative group/tooltip flex items-center">
      {children}
      <div className={`absolute ${positionClasses[position]} hidden group-hover/tooltip:block z-50 w-max max-w-xs`}>
        <div className="bg-slate-900 text-slate-200 text-xs px-3 py-1.5 rounded shadow-xl border border-slate-700 animate-in fade-in zoom-in duration-200">
          {text}
          {/* Seta do tooltip */}
          <div className={`absolute w-2 h-2 bg-slate-900 border-b border-r border-slate-700 transform rotate-45 
            ${position === 'top' ? '-bottom-1 left-1/2 -translate-x-1/2 border-t-0 border-l-0' : ''}
            ${position === 'bottom' ? '-top-1 left-1/2 -translate-x-1/2 border-b-0 border-r-0 bg-slate-900' : ''}
            ${position === 'left' ? 'top-1/2 -right-1 -translate-y-1/2 border-b-0 border-l-0' : ''}
            ${position === 'right' ? 'top-1/2 -left-1 -translate-y-1/2 border-t-0 border-r-0' : ''}
          `}></div>
        </div>
      </div>
    </div>
  );
};
