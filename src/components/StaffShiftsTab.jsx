import React, { useCallback, useEffect, useState } from 'react';
import {
  PlusIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/AuthContext';
import { useToast } from './ToastProvider';
import { Card, Button, Field, Input, EmptyState } from './ui';
import Modal from './Modal';
import { TableRowSkeleton } from './Skeleton';

const toLocalDateKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const SHIFT_BADGE = {
  scheduled: 'bg-warning/15 text-warning border-warning/30',
  active: 'bg-success/15 text-success border-success/30',
  completed: 'bg-info/15 text-info border-info/30',
  absent: 'bg-danger/15 text-danger border-danger/30',
};

export default function StaffShiftsTab({ staff = [] }) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const { showToast } = useToast();

  const [date, setDate] = useState(() => toLocalDateKey());
  const [shifts, setShifts] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ staffId: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const loadShifts = useCallback(async () => {
    try {
      const res = await api.get(`/admin/staff/shifts?date=${date}`);
      setShifts(res.shifts || []);
    } catch (err) {
      showToast(err.message || t('staff.shiftsLoadError', 'Failed to load shifts'), 'error');
    }
  }, [api, date, showToast, t]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const staffMap = new Map(staff.map((s) => [String(s._id), s]));

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!form.staffId) {
      showToast(t('staff.selectStaffRequired', 'Please select a team member'), 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/staff/shifts', {
        staffId: form.staffId,
        date,
        notes: form.notes.trim(),
      });
      showToast(t('staff.shiftScheduled', 'Shift scheduled'));
      setModalOpen(false);
      setForm({ staffId: '', notes: '' });
      await loadShifts();
    } catch (err) {
      showToast(err.message || t('staff.toastSaveError', 'Failed to schedule shift'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (shift, action) => {
    setBusyId(shift._id);
    try {
      if (action === 'clock-in') {
        await api.patch(`/admin/staff/shifts/${shift._id}/clock-in`, {});
        showToast(t('staff.clockedInToast', 'Clocked in'));
      } else if (action === 'clock-out') {
        await api.patch(`/admin/staff/shifts/${shift._id}/clock-out`, {});
        showToast(t('staff.clockedOutToast', 'Clocked out'));
      } else if (action === 'absent') {
        await api.patch(`/admin/staff/shifts/${shift._id}`, { status: 'absent' });
        showToast(t('staff.markedAbsentToast', 'Marked absent'));
      } else if (action === 'delete') {
        await api.delete(`/admin/staff/shifts/${shift._id}`);
        showToast(t('staff.shiftDeletedToast', 'Shift removed'));
      }
      await loadShifts();
    } catch (err) {
      showToast(err.message || t('staff.toastSaveError', 'Action failed'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const scheduleFullTeam = async () => {
    if (staff.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        staff.map((member) =>
          api.post('/admin/staff/shifts', { staffId: member._id, date })
        )
      );
      showToast(t('staff.fullTeamScheduled', 'Full team scheduled'));
      await loadShifts();
    } catch (err) {
      showToast(err.message || t('staff.toastSaveError', 'Failed to schedule shifts'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto tabular-nums"
          />
          <Button variant="ghost" onClick={() => setDate(toLocalDateKey())} className="text-xs px-3 py-2">
            {t('common.today', 'Today')}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {staff.length > 1 && (shifts?.length || 0) < staff.length && (
            <Button variant="subtle" onClick={scheduleFullTeam} disabled={saving} className="text-xs">
              {t('staff.scheduleAllBtn', 'Schedule Full Team')}
            </Button>
          )}
          <Button
            onClick={() => {
              setForm({ staffId: staff[0]?._id || '', notes: '' });
              setModalOpen(true);
            }}
            disabled={staff.length === 0}
          >
            <PlusIcon className="w-4 h-4" />
            {t('staff.scheduleShiftBtn', 'Schedule Shift')}
          </Button>
        </div>
      </div>

      {/* Shift List */}
      {shifts === null ? (
        <Card className="p-4 space-y-3">
          <TableRowSkeleton />
          <TableRowSkeleton />
        </Card>
      ) : shifts.length === 0 ? (
        <Card>
          <EmptyState
            icon="🗓️"
            title={t('staff.noShiftsTitle', 'No shifts scheduled for this date')}
            description={t('staff.noShiftsDesc', 'Schedule team members to track clock-in, clock-out, and attendance.')}
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {shifts.map((shift) => {
            const member = staffMap.get(String(shift.staffId));
            const isBusy = busyId === shift._id;
            return (
              <Card key={shift._id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {member?.photo ? (
                    <img src={member.photo} alt={member.name} className="w-10 h-10 rounded-full object-cover shrink-0 border border-border" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center font-semibold text-text-muted shrink-0">
                      {(member?.name || 'S').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-text truncate">{member?.name || 'Master'}</p>
                      <span
                        className={clsx(
                          'text-[11px] font-semibold px-2 py-0.5 rounded-full border uppercase',
                          SHIFT_BADGE[shift.status] || 'bg-surface-3 text-text-muted border-border'
                        )}
                      >
                        {t(`staff.shiftStatus_${shift.status}`, shift.status)}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted tabular-nums">
                      {t('staff.clockInLabel', 'In')}: {formatTime(shift.clockIn)} · {t('staff.clockOutLabel', 'Out')}: {formatTime(shift.clockOut)}
                      {shift.notes ? ` · ${shift.notes}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {(shift.status === 'scheduled' || shift.status === 'absent') && (
                    <Button
                      variant="primary"
                      disabled={isBusy}
                      onClick={() => handleAction(shift, 'clock-in')}
                      className="text-xs px-3 py-2 min-h-[38px]"
                    >
                      <ClockIcon className="w-4 h-4" />
                      {t('staff.clockInBtn', 'Clock In')}
                    </Button>
                  )}
                  {shift.status === 'active' && (
                    <Button
                      variant="subtle"
                      disabled={isBusy}
                      onClick={() => handleAction(shift, 'clock-out')}
                      className="text-xs px-3 py-2 min-h-[38px]"
                    >
                      <CheckCircleIcon className="w-4 h-4 text-success" />
                      {t('staff.clockOutBtn', 'Clock Out')}
                    </Button>
                  )}
                  {shift.status === 'scheduled' && (
                    <Button
                      variant="ghost"
                      disabled={isBusy}
                      onClick={() => handleAction(shift, 'absent')}
                      className="text-xs px-2.5 py-2 min-h-[38px]"
                      title={t('staff.markAbsentBtn', 'Mark Absent')}
                    >
                      <XCircleIcon className="w-4 h-4 text-danger" />
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    disabled={isBusy}
                    onClick={() => handleAction(shift, 'delete')}
                    className="text-xs px-2.5 py-2 min-h-[38px]"
                    title={t('common.delete', 'Delete')}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Schedule Shift Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('staff.scheduleShiftBtn', 'Schedule Shift')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
            <Button disabled={saving} onClick={handleSchedule}>
              {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
            </Button>
          </>
        )}
      >
        <form onSubmit={handleSchedule} className="space-y-4">
          <Field label={t('staff.memberLabel', 'Team Member')}>
            <select
              value={form.staffId}
              onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
              required
            >
              {staff.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </Field>

          <Field label={t('staff.shiftNotesLabel', 'Shift Notes (optional)')}>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t('staff.shiftNotesPlaceholder', 'Morning shift 09:00-18:00')}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
