import React from 'react';
import { SkaterLogo } from './SkaterLogo';

interface WordmarkProps {
  iconSize?: 'sm' | 'md' | 'lg' | 'xl';
  textClassName?: string;
  lightClassName?: string;
  className?: string;
}

// Dark mode: the existing icon mark + "URBANFLOW" text, styled by the
// caller. Light mode: swaps to the single combined wordmark the user
// supplied (logo-light-wordmark.svg - real vector letterforms, text
// converted to outlines, so it renders identically everywhere with no
// font dependency) instead of trying to recolor the separate icon/text -
// both variants stay in the DOM and the `light:` custom variant (see
// index.css) just toggles which one is visible, so there's no theme
// check in JS here.
export const Wordmark: React.FC<WordmarkProps> = ({
  iconSize = 'md',
  textClassName = 'text-xl',
  lightClassName = 'h-7',
  className = '',
}) => (
  <div className={`flex items-center ${className}`}>
    <div className="light:hidden flex items-center gap-2 select-none">
      <SkaterLogo size={iconSize} />
      <h1 className={`font-black tracking-tighter text-white ${textClassName}`}>URBANFLOW</h1>
    </div>
    <img
      src="/logo-light-wordmark.svg"
      alt="UrbanFlow"
      className={`hidden light:block w-auto select-none ${lightClassName}`}
    />
  </div>
);
