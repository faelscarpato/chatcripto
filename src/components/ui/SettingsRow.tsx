import type { ReactNode } from 'react';

interface SettingsRowProps {
  title: string;
  description: string;
  icon?: ReactNode;
  end?: ReactNode;
}

export function SettingsRow({ title, description, icon, end }: SettingsRowProps) {
  return (
    <div className="settings-row">
      <div className="toolbar-row">
        {icon}
        <div className="settings-row__meta">
          <p className="settings-row__title">{title}</p>
          <p className="settings-row__description">{description}</p>
        </div>
      </div>
      {end}
    </div>
  );
}
