import { describe, expect, it } from 'vitest';
import {
  calculateInactiveDays,
  determineZombieStatus,
} from '../tasks/cleanupZombies';

describe('Ciclo de Vida y Limpieza de Organizaciones Zombis (cleanupZombies)', () => {
  const now = new Date('2026-07-01T12:00:00Z');

  it('calcula correctamente los días de inactividad', () => {
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

    expect(calculateInactiveDays(tenDaysAgo, now)).toBe(10);

    const zeroDays = new Date(now.getTime());

    expect(calculateInactiveDays(zeroDays, now)).toBe(0);
  });

  it('mantiene estado active si la inactividad es menor a 60 días', () => {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const status = determineZombieStatus(
      {
        lastActiveAt: thirtyDaysAgo,
        plan: 'free',
        status: 'active',
      },
      now,
    );

    expect(status).toBe('active');
  });

  it('pasa a dormant si la inactividad supera 60 días pero es menor a 90 días', () => {
    const seventyDaysAgo = new Date(now.getTime() - 70 * 24 * 60 * 60 * 1000);
    const status = determineZombieStatus(
      {
        lastActiveAt: seventyDaysAgo,
        plan: 'free',
        status: 'active',
      },
      now,
    );

    expect(status).toBe('dormant');
  });

  it('pasa a archived si la inactividad supera 90 días (revocación de tokens externos)', () => {
    const oneHundredDaysAgo = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
    const status = determineZombieStatus(
      {
        lastActiveAt: oneHundredDaysAgo,
        plan: 'free',
        status: 'dormant',
      },
      now,
    );

    expect(status).toBe('archived');
  });

  it('pasa a scheduled_for_deletion tras 180 días de inactividad continuada (RGPD compliance)', () => {
    const twoHundredDaysAgo = new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000);
    const status = determineZombieStatus(
      {
        lastActiveAt: twoHundredDaysAgo,
        plan: 'free',
        status: 'archived',
      },
      now,
    );

    expect(status).toBe('scheduled_for_deletion');
  });

  it('INDULTA y conserva intacta cualquier organización con isProtected: true', () => {
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const status = determineZombieStatus(
      {
        lastActiveAt: oneYearAgo,
        isProtected: true, // Cuenta protegida por el superadmin
        plan: 'free',
        status: 'active',
      },
      now,
    );

    expect(status).toBe('active');
  });

  it('INDULTA y conserva intacta cualquier organización en plan alpha_tester', () => {
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const status = determineZombieStatus(
      {
        lastActiveAt: oneYearAgo,
        plan: 'alpha_tester', // Cuentas de amigos en test
        status: 'active',
      },
      now,
    );

    expect(status).toBe('active');
  });
});
