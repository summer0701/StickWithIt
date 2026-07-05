import type { ButtonHTMLAttributes, CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';

type PolymorphicProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  children?: ReactNode;
  type?: 'button' | 'submit' | 'reset';
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function GlassContainer({ as: Component = 'main', className, children, ...props }: PolymorphicProps) {
  return (
    <Component className={classNames('ds-screen', className)} {...props}>
      {children}
    </Component>
  );
}

export function AppCard({ as: Component = 'section', className, children, ...props }: PolymorphicProps) {
  return (
    <Component className={classNames('ds-card', className)} {...props}>
      {children}
    </Component>
  );
}

export function SectionHeader({
  icon,
  title,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={classNames('ds-section-header', className)}>
      <div>
        {icon}
        <strong>{title}</strong>
      </div>
      {action}
    </header>
  );
}

export function PrimaryButton({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={classNames('ds-button ds-button-primary', className)} type="button" {...props}>
      {children}
    </button>
  );
}

export function SecondaryButton({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={classNames('ds-button ds-button-secondary', className)} type="button" {...props}>
      {children}
    </button>
  );
}

export const GradientButton = PrimaryButton;

export function ProgressCard({
  label,
  value,
  caption,
  percent,
  className,
}: {
  label?: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  percent: number;
  className?: string;
}) {
  const bounded = Math.min(100, Math.max(0, percent));
  return (
    <AppCard className={classNames('ds-progress-card', className)}>
      {label && <span>{label}</span>}
      <strong>{value}</strong>
      <div className="ds-progress-track" aria-label={`${bounded}%`}>
        <i style={{ width: `${bounded}%` } as CSSProperties} />
      </div>
      {caption}
    </AppCard>
  );
}

export function StatCard({
  label,
  value,
  detail,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <AppCard as="article" className={classNames('ds-stat-card', className)}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </AppCard>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={classNames('ds-empty-state', className)}>
      {icon && <span>{icon}</span>}
      <strong>{title}</strong>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

export function ListTile({ as: Component = 'div', className, children, ...props }: PolymorphicProps) {
  return (
    <Component className={classNames('ds-list-tile', className)} {...props}>
      {children}
    </Component>
  );
}
