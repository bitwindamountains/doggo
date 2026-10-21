import { dailySchedule, highestRung, rungThreshold } from '../rungs';

describe('Screen Time helpers (M6)', () => {
  it('schedules from wake time to one minute before the next wake time', () => {
    expect(dailySchedule('07:00')).toEqual({
      intervalStart: { hour: 7, minute: 0 },
      intervalEnd: { hour: 6, minute: 59 },
      repeats: true,
    });
    expect(dailySchedule('00:00').intervalEnd).toEqual({ hour: 23, minute: 59 });
  });

  it('uses the engine thresholds 45 / 60 / 120 minutes', () => {
    expect([1, 2, 3].map((r) => rungThreshold(r as 1 | 2 | 3))).toEqual([
      { hour: 0, minute: 45 },
      { hour: 1, minute: 0 },
      { hour: 2, minute: 0 },
    ]);
  });

  it('reads the highest rung that fired today and ignores yesterday and other events', () => {
    const dayStart = '2026-10-20T23:00:00.000Z';
    const at = (iso: string) => new Date(iso);
    expect(
      highestRung(
        [
          {
            callbackName: 'eventDidReachThreshold',
            eventName: 'rung3',
            lastCalledAt: at('2026-10-20T12:00:00Z'),
          },
          {
            callbackName: 'eventDidReachThreshold',
            eventName: 'rung1',
            lastCalledAt: at('2026-10-21T01:00:00Z'),
          },
          {
            callbackName: 'eventDidReachThreshold',
            eventName: 'rung2',
            lastCalledAt: at('2026-10-21T01:20:00Z'),
          },
          { callbackName: 'intervalDidStart', lastCalledAt: at('2026-10-21T02:00:00Z') },
          {
            callbackName: 'eventDidReachThreshold',
            eventName: 'other',
            lastCalledAt: at('2026-10-21T03:00:00Z'),
          },
        ],
        dayStart,
      ),
    ).toEqual({ rung: 2, firedAt: '2026-10-21T01:20:00.000Z' });
    expect(highestRung([], dayStart)).toBeNull();
  });
});
