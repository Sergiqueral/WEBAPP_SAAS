import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_THROTTLE_MS,
  shouldTouchActivity,
} from '../server/activityTracker';

describe('Monitor de Actividad de Organizaciones (activityTracker)', () => {
  const baseTime = new Date('2026-06-01T12:00:00Z');

  it('indica que se debe registrar actividad si nunca se ha registrado antes (null / undefined)', () => {
    expect(shouldTouchActivity(null, baseTime)).toBe(true);
    expect(shouldTouchActivity(undefined, baseTime)).toBe(true);
  });

  it('NO registra actividad si la última marca fue hace menos de 24 horas (Throttling activo)', () => {
    // Hace 5 minutos
    const fiveMinutesAgo = new Date(baseTime.getTime() - 5 * 60 * 1000);

    expect(shouldTouchActivity(fiveMinutesAgo, baseTime)).toBe(false);

    // Hace 12 horas
    const twelveHoursAgo = new Date(baseTime.getTime() - 12 * 60 * 60 * 1000);

    expect(shouldTouchActivity(twelveHoursAgo, baseTime)).toBe(false);

    // Hace 23 horas y 59 minutos
    const almostOneDay = new Date(baseTime.getTime() - (24 * 60 * 60 * 1000 - 1000));

    expect(shouldTouchActivity(almostOneDay, baseTime)).toBe(false);
  });

  it('SÍ registra actividad una vez transcurridas 24 horas o más', () => {
    // Exactamente 24 horas
    const exactlyOneDayAgo = new Date(baseTime.getTime() - ACTIVITY_THROTTLE_MS);

    expect(shouldTouchActivity(exactlyOneDayAgo, baseTime)).toBe(true);

    // Hace 3 días
    const threeDaysAgo = new Date(baseTime.getTime() - 3 * ACTIVITY_THROTTLE_MS);

    expect(shouldTouchActivity(threeDaysAgo, baseTime)).toBe(true);
  });

  it('permite umbrales personalizados si se especifica', () => {
    const customThresholdMs = 60 * 1000; // 1 minuto
    const twoMinutesAgo = new Date(baseTime.getTime() - 2 * 60 * 1000);

    expect(shouldTouchActivity(twoMinutesAgo, baseTime, customThresholdMs)).toBe(true);
  });
});
