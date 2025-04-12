'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SafeLinkProps {
  href: string;
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export function SafeLink({ href, className, children, onClick }: SafeLinkProps) {
  const router = useRouter();
  
  // Use a div instead of an anchor when children might contain another anchor
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    router.push(href);
    onClick?.(e as unknown as React.MouseEvent<HTMLAnchorElement>);
  };

  return (
    <div 
      onClick={handleClick}
      className={`cursor-pointer ${className || ''}`}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick(e as unknown as React.MouseEvent<HTMLDivElement>)}
    >
      {children}
    </div>
  );
} 