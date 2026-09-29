import React from 'react';

interface SkaterLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const SkaterLogo: React.FC<SkaterLogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-7 h-7 rounded-lg',
    md: 'w-9 h-9 rounded-xl',
    lg: 'w-14 h-14 rounded-2xl',
    xl: 'w-24 h-24 rounded-3xl'
  };

  return (
    <img 
      src="/logo.png" 
      alt="UrbanFlow Logo" 
      className={`object-cover shadow-lg select-none shrink-0 ${sizeClasses[size]} ${className}`}
    />
  );
};
