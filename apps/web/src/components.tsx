import type { ComponentType, ReactNode } from 'react';
import { GraduationCap, House, Robot, User, UsersThree } from '@phosphor-icons/react';
import type { NavKey } from './types';

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="section-title"><h2>{children}</h2>{action}</div>;
}

export function Segmented<T extends string>({ options, value, onChange }: { options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <div className="segmented">{options.map(option => <button key={option.value} className={option.value === value ? 'active' : ''} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}

const navItems: { key: NavKey; label: string; icon: ComponentType<{ size?: number; weight?: 'regular' | 'fill' }> }[] = [
  { key: 'home', label: 'Главная', icon: House },
  { key: 'academy', label: 'Обучение', icon: GraduationCap },
  { key: 'mentor', label: 'Помощник', icon: Robot },
  { key: 'people', label: 'Люди', icon: UsersThree },
  { key: 'profile', label: 'Профиль', icon: User },
];

export function BottomNav({ active, onChange }: { active: NavKey; onChange: (key: NavKey) => void }) {
  return <nav className="bottom-nav" aria-label="Главная навигация">{navItems.map(item => {
    const Icon = item.icon;
    return <button key={item.key} className={active === item.key ? 'active' : ''} onClick={() => onChange(item.key)} aria-current={active === item.key ? 'page' : undefined}>
      <Icon size={22} weight={active === item.key ? 'fill' : 'regular'} /><span>{item.label}</span>
    </button>;
  })}</nav>;
}

export function ScreenHeader({ section, title, italic }: { section: string; title: string; italic?: string }) {
  return <header className="screen-header"><span className="brand">BAI.PROD</span><span className="route-label">→ {section}</span><h1>{title} {italic ? <em>{italic}</em> : null}</h1></header>;
}

export function Toast({ message }: { message: string }) {
  return <div className="toast" role="status">{message}</div>;
}
