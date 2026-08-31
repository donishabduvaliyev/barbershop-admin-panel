import React, { useMemo } from 'react';
import { Input, Switch } from './ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_HOURS = { open: false, from: '09:00', to: '18:00' };

function hoursArrayToDayMap(workingHours = []) {
  const map = Object.fromEntries(DAYS.map((d) => [d, { ...DEFAULT_HOURS }]));
  for (const entry of workingHours) {
    for (const day of entry.days) {
      if (map[day]) map[day] = { open: true, from: entry.from, to: entry.to };
    }
  }
  return map;
}

function dayMapToHoursArray(dayMap) {
  return DAYS.filter((d) => dayMap[d].open).map((d) => ({ days: [d], from: dayMap[d].from, to: dayMap[d].to }));
}

// A day-by-day open/closed + time-range editor operating directly on the
// workingHours array shape shared by shops and staff members (see
// models/shopData.js's WorkingHoursSchema) — the caller just holds that
// array in state and passes it straight through, no separate day-map state
// needed on their end.
export default function WorkingHoursEditor({ value, onChange, compact = false }) {
  const dayMap = useMemo(() => hoursArrayToDayMap(value), [value]);

  const updateDay = (day, patch) => {
    onChange(dayMapToHoursArray({ ...dayMap, [day]: { ...dayMap[day], ...patch } }));
  };

  return (
    <div className="space-y-2">
      {DAYS.map((day) => (
        <div key={day} className="flex items-center gap-3 py-1">
          <div className={compact ? 'w-24 shrink-0' : 'w-28 shrink-0'}>
            <Switch checked={dayMap[day].open} onChange={(v) => updateDay(day, { open: v })} label={day.slice(0, 3)} />
          </div>
          {dayMap[day].open ? (
            <div className="flex items-center gap-2 flex-1">
              <Input type="time" value={dayMap[day].from} onChange={(e) => updateDay(day, { from: e.target.value })} className="!w-28" />
              <span className="text-text-faint text-sm">to</span>
              <Input type="time" value={dayMap[day].to} onChange={(e) => updateDay(day, { to: e.target.value })} className="!w-28" />
            </div>
          ) : (
            <span className="text-sm text-text-faint">Closed</span>
          )}
        </div>
      ))}
    </div>
  );
}
