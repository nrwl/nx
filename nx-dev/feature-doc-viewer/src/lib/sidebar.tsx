import { DocumentMapItem } from '@nrwl/nx-dev/data-access-documents';

export interface SidebarProps {
  map: DocumentMapItem[];
  className?: string;
}

export function Sidebar(props: SidebarProps) {
  return (
    <nav id="navigation" className="font-medium text-base">
      <ul>
        <li className="mt-8">
          <h5 className="px-3 mb-3 lg:mb-3 uppercase tracking-wide font-semibold text-sm lg:text-xs text-gray-900">
            Getting Started
          </h5>
          <ul>
            <li>
              <a
                href="#"
                className="px-3 py-2 transition-colors duration-180 relative block text-blue-700"
              >
                <span className="rounded-md absolute inset-0 bg-blue-50"></span>
                <span className="relative">Why Nx?</span>
              </a>
            </li>
            <li>
              <a
                className="px-3 py-2 transition-colors duration-200 relative block hover:text-gray-900 text-gray-500"
                href="#"
              >
                <span className="rounded-md absolute inset-0 bg-blue-50 opacity-0"></span>
                <span className="relative">Release Notes</span>
              </a>
            </li>
          </ul>
        </li>
      </ul>
    </nav>
  );
}
