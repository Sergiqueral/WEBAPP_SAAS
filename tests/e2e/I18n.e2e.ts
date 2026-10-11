import { expect, test } from '@playwright/test';

test.describe('I18n', () => {
  test.describe('Language Switching', () => {
    test('should switch language from Spanish to French using dropdown and verify text on the homepage', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByText('La plantilla SaaS perfecta para construir')).toBeVisible();

      await page.getByRole('button', { name: 'Cambiar idioma' }).click();
      await page.getByText('Français').click();

      await expect(page.getByText('Le parfait SaaS template pour construire')).toBeVisible();
    });

    test('should switch language from Spanish to French using URL and verify text on the sign-in page', async ({ page }) => {
      await page.goto('/sign-in');

      await expect(page.getByText('Correo electrónico')).toBeVisible();

      await page.goto('/fr/sign-in');

      await expect(page.getByText('Adresse e-mail')).toBeVisible();
    });
  });
});
