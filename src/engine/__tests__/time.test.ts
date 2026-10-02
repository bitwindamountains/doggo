import { HOUR_MS } from '../constants';
import {
  addDays,
  dayKeyAt,
  dayWindow,
  formatHHmm,
  inQuietHours,
  isAsleepAt,
  localHours,
  parseHHmm,
  scheduleFor,
  toISO,
  toMs,
  wakingFraction,
  walkCheckAt,
  weekdayOf,
  zonedInstant,
} from '../time';
import { DAY, prefs } from './helpers';

const manila = (day: string, hhmm: string) => zonedInstant(day, parseHHmm(hhmm), 'Asia/Manila');

describe('HH:mm helpers', () => {
  it('parses and formats', () => {
    expect(parseHHmm('07:30')).toBe(450);
    expect(formatHHmm(450)).toBe('07:30');
    expect(formatHHmm(1440 + 75)).toBe('01:15');
    expect(formatHHmm(-30)).toBe('23:30');
  });

  it('rejects malformed times and timestamps', () => {
    expect(() => parseHHmm('7:30')).toThrow();
    expect(() => parseHHmm('24:00')).toThrow();
    expect(() => toMs('not a date')).toThrow();
  });

  it('does calendar arithmetic on day keys', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(weekdayOf('2026-10-05')).toBe(1); // Monday
    expect(weekdayOf('2026-10-10')).toBe(6); // Saturday
  });
});

describe('day window', () => {
  it('runs from wake to next wake with bedtime the same evening', () => {
    const w = dayWindow(DAY, prefs());
    expect(toISO(w.start)).toBe('2026-10-04T23:00:00.000Z'); // 07:00 Manila
    expect(w.bedAt - w.start).toBe(16 * HOUR_MS);
    expect(w.end - w.start).toBe(24 * HOUR_MS);
  });

  it('supports night shift: wake 15:00, bed 07:00 next morning', () => {
    const p = prefs({ wakeTime: '15:00', bedTime: '07:00' });
    const w = dayWindow('2026-10-02', p);
    expect(w.start).toBe(manila('2026-10-02', '15:00'));
    expect(w.bedAt).toBe(manila('2026-10-03', '07:00'));
    expect(w.end).toBe(manila('2026-10-03', '15:00'));
    expect(dayKeyAt(manila('2026-10-03', '05:00'), p)).toBe('2026-10-02');
    expect(dayKeyAt(manila('2026-10-03', '15:00'), p)).toBe('2026-10-03');
    expect(isAsleepAt(manila('2026-10-03', '10:00'), w)).toBe(true);
    expect(isAsleepAt(manila('2026-10-03', '06:59'), w)).toBe(false);
  });

  it('assigns the hours before wake time to the previous day', () => {
    const p = prefs();
    expect(dayKeyAt(manila(DAY, '06:59'), p)).toBe('2026-10-04');
    expect(dayKeyAt(manila(DAY, '07:00'), p)).toBe(DAY);
  });

  it('uses the weekend schedule when the day starts on Saturday or Sunday', () => {
    const p = prefs({ weekendWakeTime: '09:00', weekendBedTime: '01:00' });
    expect(scheduleFor('2026-10-10', p)).toEqual({ wake: 540, bed: 60 });
    expect(scheduleFor('2026-10-09', p)).toEqual({ wake: 420, bed: 1380 });
    // Friday's day lasts until Saturday's later wake time.
    const friday = dayWindow('2026-10-09', p);
    expect(friday.end).toBe(manila('2026-10-10', '09:00'));
    const saturday = dayWindow('2026-10-10', p);
    expect(saturday.bedAt).toBe(manila('2026-10-11', '01:00'));
  });

  it('follows the user timezone, including DST', () => {
    const p = prefs({ timezone: 'America/New_York' });
    // 2026-11-01 is the US DST change; the day is 25 hours long.
    const w = dayWindow('2026-10-31', p);
    expect(toISO(w.start)).toBe('2026-10-31T11:00:00.000Z');
    expect(w.end - w.start).toBe(25 * HOUR_MS);
  });

  it('computes waking fraction, clamped', () => {
    const w = dayWindow(DAY, prefs());
    expect(wakingFraction(w.start, w)).toBe(0);
    expect(wakingFraction(manila(DAY, '15:00'), w)).toBe(0.5);
    expect(wakingFraction(w.bedAt + HOUR_MS, w)).toBe(1);
    expect(wakingFraction(w.start - HOUR_MS, w)).toBe(0);
    expect(wakingFraction(0, { ...w, bedAt: w.start })).toBe(1);
  });

  it('gives local time of day for lighting', () => {
    expect(localHours(manila(DAY, '14:30'), 'Asia/Manila')).toBe(14.5);
  });
});

describe('quiet hours', () => {
  it('handles same-day and overnight ranges, end exclusive', () => {
    const p = prefs({
      quietHours: [
        { start: '09:00', end: '12:00' },
        { start: '22:00', end: '06:00' },
        { start: '15:00', end: '15:00' },
      ],
    });
    expect(inQuietHours(manila(DAY, '09:00'), p)).toBe(true);
    expect(inQuietHours(manila(DAY, '11:59'), p)).toBe(true);
    expect(inQuietHours(manila(DAY, '12:00'), p)).toBe(false);
    expect(inQuietHours(manila(DAY, '23:30'), p)).toBe(true);
    expect(inQuietHours(manila(DAY, '05:00'), p)).toBe(true);
    expect(inQuietHours(manila(DAY, '15:00'), p)).toBe(false);
    expect(inQuietHours(manila(DAY, '10:00'), prefs())).toBe(false);
  });
});

describe('walk check time (§6.1)', () => {
  it('is wake + 45% of the waking day rounded down to the half hour', () => {
    expect(walkCheckAt(dayWindow(DAY, prefs()), prefs())).toBe(manila(DAY, '14:00'));
    const night = prefs({ wakeTime: '15:00', bedTime: '07:00' });
    expect(walkCheckAt(dayWindow(DAY, night), night)).toBe(manila(DAY, '22:00'));
  });

  it('rounds on the local clock in half-hour-offset timezones', () => {
    const p = prefs({ timezone: 'Asia/Kolkata', wakeTime: '06:45', bedTime: '22:15' });
    const w = dayWindow(DAY, p);
    // 06:45 + 0.45 × 15.5 h = 13:43.5 → 13:30 local
    expect(walkCheckAt(w, p)).toBe(zonedInstant(DAY, parseHHmm('13:30'), 'Asia/Kolkata'));
  });

  it('uses the user setting when given, even after midnight', () => {
    const p = prefs({ walkCheckTime: '16:30' });
    expect(walkCheckAt(dayWindow(DAY, p), p)).toBe(manila(DAY, '16:30'));
    const night = prefs({ wakeTime: '15:00', bedTime: '07:00', walkCheckTime: '01:00' });
    expect(walkCheckAt(dayWindow(DAY, night), night)).toBe(manila(addDays(DAY, 1), '01:00'));
  });
});
