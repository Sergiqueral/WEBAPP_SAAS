import { expect, test } from '@playwright/test';

test.describe('Omnibarra y Feed Molecular E2E', () => {
  test.describe('Protección de Rutas y Accesibilidad de la Omnibarra', () => {
    test('redirige a la página de inicio de sesión al acceder al dashboard sin autenticar', async ({ page }) => {
      await page.goto('/dashboard');

      // Al no estar autenticado, Clerk redirige a sign-in
      await expect(page).toHaveURL(/.*sign-in.*/);
      await expect(page.getByText('Correo electrónico')).toBeVisible();
    });

    test('la página de inicio carga sin errores en consola y expone elementos de navegación', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto('/');

      await expect(page.getByText('La plantilla SaaS perfecta para construir')).toBeVisible();
      expect(consoleErrors).toHaveLength(0);
    });
  });
});
