import { test, expect } from '@playwright/test';
import { openAuthorized } from './harness.mjs';

test('unsaved attendance activates the browser beforeunload guard', async ({ page }) => {
  const harness = await openAuthorized(page);

  const clean = await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    return {
      dispatched: window.dispatchEvent(event),
      defaultPrevented: event.defaultPrevented
    };
  });
  expect(clean).toEqual({ dispatched: true, defaultPrevented: false });

  await page.locator('select.status').first().selectOption('present');

  const dirty = await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    return {
      dispatched: window.dispatchEvent(event),
      defaultPrevented: event.defaultPrevented
    };
  });
  expect(dirty).toEqual({ dispatched: false, defaultPrevented: true });

  await harness.expectNoProductionRequests();
});

test('generic data-close wiring closes every student movement dialog', async ({ page }) => {
  const harness = await openAuthorized(page);

  for (const id of ['transferInDialog', 'transferOutDialog', 'moveClassDialog']) {
    const dialog = page.locator('#' + id);
    await dialog.evaluate(element => element.showModal());
    await expect(dialog).toBeVisible();

    await page.locator(`[data-close="${id}"]`).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => dialog.evaluate(element => element.open)).toBe(false);
  }

  await harness.expectNoProductionRequests();
});
