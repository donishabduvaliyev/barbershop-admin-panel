import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useAuth } from '../lib/AuthContext';
import { Card, EmptyState } from './ui';
import { Skeleton } from './Skeleton';
import ManualBookingModal from './ManualBookingModal';
import StatusBadge from './StatusBadge';
import Modal from './Modal';

const pad = (n) => String(n).padStart(2, '0');
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toDateKey(date) {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  return `${y}-${m}-${d}`;
}

// Mirrors the backend's utils/bookingTime.js multi-range day logic — a day
// can have more than one {from,to} entry (a lunch break), so every entry
// covering the day must be checked, not just the first.
function isHourOpen(workingHours, dayName, hour) {
  const schedules = (workingHours || []).filter((wh) => wh.days.includes(dayName));
  return schedules.some((s) => {
    const [from] = s.from.split(':').map(Number);
    const [to] = s.to.split(':').map(Number);
    return hour >= from && hour < to;
  });
}

const SOURCE_ICON = { bot: '🤖', phone: '📞', 'walk-in': '🚶' };

export default function ScheduleCalendar({ shop }) {
  const { t, i18n } = useTranslation();
  const { api } = useAuth();

  const [selectedDate, setSelectedDate] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookingModal, setBookingModal] = useState(null); // { staffId, hour } | null
  const [detailBooking, setDetailBooking] = useState(null);

  const dateKey = toDateKey(selectedDate);
  const dayName = WEEKDAY_NAMES[selectedDate.getDay()];

  const load = () => {
    setLoading(true);
    api.get(`/admin/shop/schedule?date=${dateKey}`).then(setSchedule).finally(() => setLoading(false));
  };
  useEffect(load, [dateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const dates = useMemo(() => [...Array(14)].map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  }), []);

  const hours = useMemo(() => {
    if (!schedule?.workingHours) return [];
    const todays = schedule.workingHours.filter((wh) => wh.days.includes(dayName));
    if (todays.length === 0) return [];
    const min = Math.min(...todays.map((s) => Number(s.from.split(':')[0])));
    const max = Math.max(...todays.map((s) => Number(s.to.split(':')[0])));
    const list = [];
    for (let h = min; h < max; h++) list.push(h);
    return list;
  }, [schedule, dayName]);

  const findBookingAt = (bookings, hour) => bookings?.find((b) => b.hour === hour);

  const openBookingSlot = (staffId, hour) => setBookingModal({ staffId, hour });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {dates.map((d) => (
          <button
            key={d.toISOString()}
            onClick={() => setSelectedDate(d)}
            className={clsx(
              'px-3 py-2 rounded-lg border text-xs font-medium whitespace-nowrap text-center min-w-[60px] transition-all',
              d.toDateString() === selectedDate.toDateString() ? 'bg-accent text-black border-accent' : 'bg-surface text-text-muted border-border-soft'
            )}
          >
            <div>{d.toLocaleDateString(i18n.language, { weekday: 'short' })}</div>
            <div>{d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : hours.length === 0 ? (
        <EmptyState icon="🌙" title={t('appointments.calendar.closedTitle')} description={t('appointments.calendar.closedDesc')} />
      ) : (
        <Card className="overflow-x-auto">
          <div className="min-w-[560px]">
            {/* Header row: one column per staff member, or one pooled column */}
            <div className="grid border-b border-border-soft" style={{ gridTemplateColumns: `56px repeat(${Math.max(schedule.staff?.length || 1, 1)}, 1fr)` }}>
              <div />
              {schedule.staff?.length > 0 ? schedule.staff.map((s) => (
                <div key={s.id} className="px-2 py-3 text-center">
                  <div className="w-8 h-8 mx-auto rounded-full bg-surface-3 flex items-center justify-center text-xs font-semibold text-text-muted overflow-hidden mb-1">
                    {s.photo ? <img src={s.photo} alt="" className="w-full h-full object-cover" /> : s.name?.slice(0, 1).toUpperCase()}
                  </div>
                  <p className="text-xs font-medium text-text truncate">{s.name}</p>
                  {(s.isOffToday || (schedule.isToday && !s.isAvailableNow)) && (
                    <p className="text-[10px] text-danger mt-0.5">{s.isOffToday ? t('staff.offToday') : t('staff.unavailableNow')}</p>
                  )}
                </div>
              )) : (
                <div className="px-2 py-3 text-center">
                  <p className="text-xs font-medium text-text">{t('appointments.calendar.pool', { capacity: schedule.capacity })}</p>
                </div>
              )}
            </div>

            {hours.map((hour) => {
              const staffOpen = schedule.staff?.length > 0
                ? schedule.staff.map((s) => isHourOpen(s.workingHours || schedule.workingHours, dayName, hour))
                : [true];
              return (
                <div key={hour} className="grid border-b border-border-soft last:border-0" style={{ gridTemplateColumns: `56px repeat(${Math.max(schedule.staff?.length || 1, 1)}, 1fr)` }}>
                  <div className="px-2 py-3 text-xs text-text-faint text-right">{pad(hour)}:00</div>
                  {schedule.staff?.length > 0 ? schedule.staff.map((s, i) => {
                    const booking = findBookingAt(s.bookings, hour);
                    const closed = !staffOpen[i] || s.isOffToday || (schedule.isToday && !s.isAvailableNow);
                    return (
                      <button
                        key={s.id}
                        disabled={closed && !booking}
                        onClick={() => (booking ? setDetailBooking(booking) : openBookingSlot(s.id, hour))}
                        className={clsx(
                          'm-0.5 rounded-lg text-[11px] font-medium px-1.5 py-2.5 transition-colors text-left',
                          booking
                            ? (booking.status === 'confirmed' ? 'bg-success/15 text-success hover:bg-success/25' : 'bg-warning/15 text-warning hover:bg-warning/25')
                            : closed ? 'bg-surface-2/40 text-text-faint cursor-not-allowed' : 'bg-surface-2 text-text-faint hover:bg-accent/10 hover:text-accent'
                        )}
                      >
                        {booking ? (
                          <span className="truncate block">{SOURCE_ICON[booking.source] || ''} {booking.userName}</span>
                        ) : closed ? '—' : '+'}
                      </button>
                    );
                  }) : (
                    <button
                      onClick={() => openBookingSlot(null, hour)}
                      className="m-0.5 rounded-lg text-[11px] font-medium px-1.5 py-2.5 bg-surface-2 text-text-faint hover:bg-accent/10 hover:text-accent transition-colors text-left"
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })}

            {schedule.unassignedBookings?.length > 0 && (
              <div className="p-3 border-t border-border-soft">
                <p className="text-xs font-medium text-text-muted mb-2">{t('appointments.calendar.unassigned')}</p>
                <div className="flex flex-wrap gap-2">
                  {schedule.unassignedBookings.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setDetailBooking(b)}
                      className="px-2.5 py-1.5 rounded-lg bg-warning/15 text-warning text-xs font-medium"
                    >
                      {pad(b.hour)}:00 · {b.userName}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <ManualBookingModal
        open={!!bookingModal}
        onClose={() => setBookingModal(null)}
        onCreated={load}
        shop={shop}
        presetDate={selectedDate}
        presetHour={bookingModal?.hour}
        presetStaffId={bookingModal?.staffId}
      />

      <Modal
        open={!!detailBooking}
        onClose={() => setDetailBooking(null)}
        title={detailBooking?.userName}
      >
        {detailBooking && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-text-muted">{t('appointments.manual.service')}</span><span className="text-text">{detailBooking.serviceName || '—'}</span></div>
            <div className="flex items-center justify-between"><span className="text-text-muted">{t('common.phoneNumber')}</span><span className="text-text">{detailBooking.userNumber}</span></div>
            <div className="flex items-center justify-between"><span className="text-text-muted">{t('appointments.manual.time')}</span><span className="text-text">{pad(detailBooking.hour)}:00</span></div>
            <div className="flex items-center justify-between"><span className="text-text-muted">{t('appointments.colSource')}</span><span className="text-text">{SOURCE_ICON[detailBooking.source]} {t(`appointments.source.${detailBooking.source === 'walk-in' ? 'walkIn' : detailBooking.source}`)}</span></div>
            <div className="flex items-center justify-between"><span className="text-text-muted">{t('common.status')}</span><StatusBadge status={detailBooking.status} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
