import React, { ReactNode } from 'react';
import * as heroIcons from '@heroicons/react/24/outline';

interface CardProps {
  title: string;
  description: string;
  url: string;
  icon?: string;
  children?: ReactNode;
}

export function Card({ title, description, url, icon, children }: CardProps) {
  const IconComponent =
    icon && heroIcons[icon as keyof typeof heroIcons]
      ? heroIcons[icon as keyof typeof heroIcons]
      : null;

  return (
    <a
      href={url}
      className="group flex flex-col rounded-lg border border-gray-200 bg-white p-6 
                 no-underline transition-colors duration-200 hover:bg-gray-50 
                 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
    >
      {IconComponent && (
        <div
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg 
                        bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
        >
          <IconComponent className="h-6 w-6" />
        </div>
      )}

      <h3
        className="mb-2 text-lg font-semibold text-gray-900 group-hover:text-blue-600 
                     dark:text-white dark:group-hover:text-blue-400"
      >
        {title}
      </h3>

      <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
        {description}
      </p>

      {children && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {children}
        </div>
      )}
    </a>
  );
}
