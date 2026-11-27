import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  /** Buttons and filters on the right of the title. */
  children?: ReactNode;
}

const PageHeader = ({ title, children }: PageHeaderProps) => (
  <div className="page-h">
    <h1>{title}</h1>
    {children && <div className="acts">{children}</div>}
  </div>
);

export default PageHeader;
