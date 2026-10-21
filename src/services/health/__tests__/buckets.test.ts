import { toBuckets } from '../buckets';

describe('toBuckets', () => {
  const start = '2026-10-20T23:00:00.000Z';

  it('places intervals into completed 10-minute buckets from the start', () => {
    expect(
      toBuckets(start, '2026-10-20T23:35:00.000Z', [
        { start: '2026-10-20T23:00:00.000Z', steps: 120 },
        { start: new Date('2026-10-20T23:20:00.000Z'), steps: 80.6 },
        { start: '2026-10-20T23:30:00.000Z', steps: 999 }, // bucket still in progress
        { start: '2026-10-20T22:50:00.000Z', steps: 50 }, // before the day
      ]),
    ).toEqual([120, 0, 81]);
  });

  it('returns nothing before the first bucket completes', () => {
    expect(toBuckets(start, '2026-10-20T23:09:59.000Z', [])).toEqual([]);
  });
});
