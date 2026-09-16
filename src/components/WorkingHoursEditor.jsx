import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Switch } from './ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_HOURS = { open: false, from: '09:00', to: '18:00', hasBreak: false, breakFrom: '13:00', breakTo: '14:00' };

// A day can have ONE entry ({days, from, to}) or TWO for the same day — the
// second one is a lunch break (see utils/bookingTime.js's scheduleForDay,
// which checks every entry matching a day, not just the first). Two
// entries for a day are reduced back to one open/close range plus a break
// range in between; a single entry has no break.
function hoursArrayToDayMap(workingHours = []) {
  const map = Object.fromEntries(DAYS.map((d) => [d, { ...DEFAULT_HOURS }]));
  const byDay = {};
  for (const entry of workingHours) {
    for (const day of entry.days) {
      if (!map[day]) continue;
      (byDay[day] ||= []).push(entry);
    }
  }
  for (const day of DAYS) {
    const entries = (byDay[day] || []).slice().sort((a, b) => a.from.localeCompare(b.from));
    if (entries.length === 0) continue;
    if (entries.length === 1) {
      map[day] = { open: true, from: entries[0].from, to: entries[0].to, hasBreak: false, breakFrom: DEFAULT_HOURS.breakFrom, breakTo: DEFAULT_HOURS.breakTo };
    } else {
      // Two-or-more entries: treat the earliest start and latest end as the
      // day's overall span, and the gap between the first and second as the
      // break (a third+ entry for the same day isn't representable in this
      // UI — only the first two are used).
      const first = entries[0];
      const second = entries[1];
      map[day] = { open: true, from: first.from, to: entries[entries.length - 1].to, hasBreak: true, breakFrom: first.to, breakTo: second.from };
    }
  }
  return map;
}

function dayMapToHoursArray(dayMap) {
  const result = [];
  for (const d of DAYS) {
    const day = dayMap[d];
    if (!day.open) continue;
    if (day.hasBreak) {
      result.push({ days: [d], from: day.from, to: day.breakFrom });
      result.push({ days: [d], from: day.breakTo, to: day.to });
    } else {
      result.push({ days: [d], from: day.from, to: day.to });
    }
  }
  return result;
}

// A day-by-day open/closed + time-range editor operating directly on the
// workingHours array shape shared by shops and staff members (see
// models/shopData.js's WorkingHoursSchema) — the caller just holds that
// array in state and passes it straight through, no separate day-map state
// needed on their end.
export default function WorkingHoursEditor({ value, onChange, compact = false }) {
  const { t } = useTranslation();
  const dayMap = useMemo(() => hoursArrayToDayMap(value), [value]);

  const updateDay = (day, patch) => {
    onChange(dayMapToHoursArray({ ...dayMap, [day]: { ...dayMap[day], ...patch } }));
  };

  return (
    <div className="space-y-2">
      {DAYS.map((day) => (
        <div key={day} className="py-1.5 border-b border-border-soft/60 last:border-0">
          <div className="flex items-center gap-3">
            <div className={compact ? 'w-24 shrink-0' : 'w-28 shrink-0'}>
              <Switch checked={dayMap[day].open} onChange={(v) => updateDay(day, { open: v })} label={t(`common.daysShort.${day}`)} />
            </div>
            {dayMap[day].open ? (
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                <Input type="time" value={dayMap[day].from} onChange={(e) => updateDay(day, { from: e.target.value })} className="!w-28" />
                <span className="text-text-faint text-sm">{t('common.to')}</span>
                <Input type="time" value={dayMap[day].to} onChange={(e) => updateDay(day, { to: e.target.value })} className="!w-28" />
              </div>
            ) : (
              <span className="text-sm text-text-faint">{t('common.closed')}</span>
            )}
          </div>
          {dayMap[day].open && (
            <div className="flex items-center gap-3 mt-1.5 pl-0" style={{ paddingLeft: compact ? '6.5rem' : '7.5rem' }}>
              <label className="flex items-center gap-1.5 text-xs text-text-faint shrink-0">
                <input type="checkbox" checked={dayMap[day].hasBreak} onChange={(e) => updateDay(day, { hasBreak: e.target.checked })} className="accent-accent" />
                {t('staff.lunchBreak')}
              </label>
              {dayMap[day].hasBreak && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Input type="time" value={dayMap[day].breakFrom} onChange={(e) => updateDay(day, { breakFrom: e.target.value })} className="!w-24 !py-1.5 !text-xs" />
                  <span className="text-text-faint text-xs">{t('common.to')}</span>
                  <Input type="time" value={dayMap[day].breakTo} onChange={(e) => updateDay(day, { breakTo: e.target.value })} className="!w-24 !py-1.5 !text-xs" />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
