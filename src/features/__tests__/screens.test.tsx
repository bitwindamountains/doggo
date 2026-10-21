import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { t } from '@/copy';
import { eventsRepo, prefsRepo, dogRepo } from '@/data';
import { CheckinScreen } from '@/features/checkin/CheckinScreen';
import { needsSupport } from '@/features/checkin/support';
import { HomeScreen } from '@/features/home/HomeScreen';
import { PermissionsScreen } from '@/features/onboarding/screens';
import { useDraft, DEFAULT_DRAFT, isValidName, shiftTime } from '@/features/onboarding/draft';
import { WalkScreen } from '@/features/walk/WalkScreen';
import { ProgressScreen } from '@/features/progress/ProgressScreen';
import { DataScreen } from '@/features/settings/DataScreen';
import { useDogStore } from '@/store/dogStore';

import { renderWith, router, setClock } from './helpers';

beforeEach(() => jest.clearAllMocks());

describe('Home (PRD F2, F4, F8)', () => {
  it('describes the dog for screen readers and offers the leash action in the afternoon', async () => {
    await renderWith(<HomeScreen />, { at: '14:30' });
    expect(
      await screen.findByLabelText('Biscuit is holding the leash and looking at you'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText("Let's walk"));
    expect(router.push).toHaveBeenCalledWith('/walk');
  });

  it('pets the dog and logs water through stored events', async () => {
    const { db } = await renderWith(<HomeScreen />, { at: '10:00' });
    await fireEvent.press(await screen.findByTestId('dog'));
    await fireEvent.press(screen.getByText('Log water'));
    await waitFor(() => {
      const types = eventsRepo
        .between(db, '2026-10-20T00:00:00.000Z', '2026-10-22T00:00:00.000Z')
        .map((e) => e.type);
      expect(types.filter((t) => t === 'pet').length).toBeGreaterThanOrEqual(2); // persona pet + tap
      expect(types).toContain('water_logged');
    });
  });

  it('shows a sleeping dog and a quiet goodnight after bedtime', async () => {
    await renderWith(<HomeScreen />, { at: '23:30' });
    expect(await screen.findByText('Goodnight')).toBeTruthy();
    expect(screen.getByLabelText('Biscuit is asleep')).toBeTruthy();
    expect(screen.queryByText('Start walk')).toBeNull();
  });
});

describe('Walk (PRD F4)', () => {
  it('a manual walk is stored with the steps health saw', async () => {
    const { db } = await renderWith(<WalkScreen />, { at: '17:30' });
    await fireEvent.press(screen.getByText('Start'));
    setClock('17:50');
    await fireEvent.press(await screen.findByText('Finish walk'));
    expect(await screen.findByText('Biscuit loved that walk!')).toBeTruthy();
    const walk = eventsRepo.lastOfType(db, 'walk_ended', '2026-10-22T00:00:00.000Z');
    expect(walk?.payload.start.slice(0, 16)).toBe('2026-10-21T09:30');
    expect(walk?.payload.steps).toBe(1600);
  });
});

describe('Greetings (PRD F3): none / small / big', () => {
  it.each([
    ['none', 10],
    ['small', 60],
    ['big', 60 * 24 * 7],
  ])('%s greeting', async (level, minutesAway) => {
    await renderWith(<HomeScreen />, {
      at: '08:30',
      seed: (db, now) =>
        eventsRepo.add(
          db,
          'app_opened',
          new Date(Date.parse(now) - minutesAway * 60_000).toISOString(),
          null,
        ),
    });
    const output = useDogStore.getState().output;
    expect(output?.state.greeting).toBe(level);
    const line = t(output?.lineKey ?? '', { name: 'Biscuit' });
    expect(screen.getByText(line)).toBeTruthy();
    expect({ level, line }).toMatchSnapshot();
  });
});

describe('Check-in (PRD F9)', () => {
  it('a low mood brings the dog over and offers breathing', async () => {
    const { db } = await renderWith(<CheckinScreen />, { at: '20:00' });
    await fireEvent.press(screen.getByLabelText('Low'));
    await fireEvent.changeText(screen.getByLabelText('Note (stays on this phone)'), 'long day');
    await fireEvent.press(screen.getByText('Tell Biscuit'));
    expect(await screen.findByText('Biscuit came over and rested their head on you.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Breathe together'));
    expect(screen.getByText('Breathe in')).toBeTruthy();
    const mood = eventsRepo.lastOfType(db, 'mood_checkin', '2026-10-22T00:00:00.000Z');
    expect(mood?.payload).toEqual({ mood: 2, note: 'long day' });
  });

  it('suggests support after 3 low check-ins out of the last 5', async () => {
    const { db } = await renderWith(<CheckinScreen />, { at: '20:00' });
    const now = '2026-10-21T12:00:00.000Z';
    [4, 2, 5, 1].forEach((mood, i) =>
      eventsRepo.add(db, 'mood_checkin', `2026-10-1${5 + i}T12:00:00.000Z`, { mood: mood as 1 }),
    );
    expect(needsSupport(db, now)).toBe(false);
    eventsRepo.add(db, 'mood_checkin', '2026-10-20T12:00:00.000Z', { mood: 2 });
    expect(needsSupport(db, now)).toBe(true);
  });
});

describe('Onboarding (PRD F1)', () => {
  it('validates names and wraps times', () => {
    expect(isValidName('  ')).toBe(false);
    expect(isValidName('Biscuit')).toBe(true);
    expect(isValidName('x'.repeat(25))).toBe(false);
    expect(shiftTime('23:30', 30)).toBe('00:00');
    expect(shiftTime('00:00', -30)).toBe('23:30');
  });

  it('a user who allows nothing still gets a dog', async () => {
    useDraft.setState({ ...DEFAULT_DRAFT, name: ' Choco ', breed: 'golden' });
    const { db } = await renderWith(<PermissionsScreen />, {
      persona: 'no-permissions',
      onboard: false,
    });
    await fireEvent.press(await screen.findByText('Bring Choco home'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(dogRepo.get(db)).toMatchObject({ name: 'Choco', breed: 'golden', bondPoints: 0 });
    expect(prefsRepo.get(db)).toMatchObject({ nudgesPerDay: 3, screenTimeEnabled: false });
    expect(useDogStore.getState().output?.state.request).not.toBe('leash');
  });
});

describe('Progress (PRD F10) and Your data (F13)', () => {
  it('shows totals and never a streak', async () => {
    await renderWith(<ProgressScreen />);
    expect(await screen.findByLabelText('Good days: 20')).toBeTruthy();
    expect(screen.queryByText(/streak/i)).toBeNull();
  });

  it('delete all clears the phone and returns to onboarding', async () => {
    const { db } = await renderWith(<DataScreen />);
    await fireEvent.press(screen.getByText('Delete all data'));
    await fireEvent.press(screen.getByText('Delete everything'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/welcome'));
    expect(dogRepo.get(db)).toBeNull();
    expect(useDogStore.getState().dog).toBeNull();
  });
});
