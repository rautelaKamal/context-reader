'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

/**
 * Tabs with the WAI-ARIA tab pattern: one tab stop, arrow keys move between
 * tabs, Home and End jump to the ends. Every panel is rendered so the real
 * answers are in the HTML; inactive ones are hidden.
 */
export function DemoTabs({ tabs }: { tabs: { id: string; label: string; panel: ReactNode }[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (to: number) => {
    const i = (to + tabs.length) % tabs.length;
    setActive(i);
    refs.current[i]?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: tabs.length - 1 };
    if (e.key in keys) { e.preventDefault(); move(keys[e.key]); }
  };
  return (
    <div className="demo">
      <div className="tabs" role="tablist" aria-label="Example passages" onKeyDown={onKey}>
        {tabs.map((t, i) => (
          <button key={t.id} ref={(el) => { refs.current[i] = el; }} type="button" role="tab"
            id={`tab-${t.id}`} aria-controls={`panel-${t.id}`} aria-selected={i === active}
            tabIndex={i === active ? 0 : -1} className="tab" onClick={() => setActive(i)}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`}
          hidden={i !== active} tabIndex={0} className="panel">
          {t.panel}
        </div>
      ))}
    </div>
  );
}
