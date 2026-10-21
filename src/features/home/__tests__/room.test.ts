import { bodyInSky, skyColor } from '../Room';

describe('room window (PRD F2: lighting follows local time)', () => {
  it('shows the sun by day, highest at noon, and the moon at night', () => {
    expect(bodyInSky(6)).toMatchObject({ sun: true, x: 0.1 });
    expect(bodyInSky(12).y).toBeCloseTo(0.2);
    expect(bodyInSky(17.9).sun).toBe(true);
    expect(bodyInSky(0)).toMatchObject({ sun: false });
    expect(bodyInSky(0).y).toBeCloseTo(0.2);
  });

  it('colours the sky for dawn, day, dusk and night', () => {
    expect(new Set([6, 12, 18, 23].map(skyColor)).size).toBe(4);
    expect(skyColor(3)).toBe(skyColor(23));
  });
});
