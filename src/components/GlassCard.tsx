/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  accent?: boolean;
  id?: string;
}

export default function GlassCard({
  children,
  className = '',
  onClick,
  accent = false,
  id
}: GlassCardProps) {
  return (
    <div
      id={id}
      onClick={onClick}
      className={`glassmorphism rounded-2xl p-5 ${
        onClick ? 'cursor-pointer glassmorphism-hover' : ''
      } ${accent ? 'border-l-4 border-l-indigo-500' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
