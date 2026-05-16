import type { ElectronApplication, JSHandle } from 'playwright';
import { _electron as electron } from 'playwright';
import { expect, test as base } from '@playwright/test';
import type { BrowserWindow } from 'electron';
import { globSync } from 'glob';
import { platform } from 'node:process';

process.env.PLAYWRIGHT_TEST = 'true';

type TestFixtures = {
  electronApp: ElectronApplication;
};

const test = base.extend<TestFixtures>({
  electronApp: [
    async ({}, use) => {
      let executablePattern = 'dist/*/doccipher{,.*}';
      if (platform === 'darwin') {
        executablePattern += '/Contents/*/DocCipher';
      }

      const [executablePath] = globSync(executablePattern);
      if (!executablePath) {
        throw new Error('App executable path not found');
      }

      const electronApp = await electron.launch({
        executablePath,
        args: ['--no-sandbox'],
      });

      await use(electronApp);
      await electronApp.close();
    },
    { scope: 'worker', auto: true } as any,
  ],

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('load');
    await use(page);
  },
});

test('main window is visible and loads DocCipher workbench', async ({ electronApp, page }) => {
  const window: JSHandle<BrowserWindow> = await electronApp.browserWindow(page);
  const windowState = await window.evaluate((mainWindow) => ({
    isVisible: mainWindow.isVisible(),
    isDevToolsOpened: mainWindow.webContents.isDevToolsOpened(),
    isCrashed: mainWindow.webContents.isCrashed(),
  }));

  expect(windowState.isCrashed).toEqual(false);
  expect(windowState.isVisible).toEqual(true);
  expect(windowState.isDevToolsOpened).toEqual(false);
  await expect(page.getByText('DocCipher')).toBeVisible();
  await expect(page.getByRole('tab', { name: /脱敏/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /还原/ })).toBeVisible();
});

test('preload exposes localApi only', async ({ page }) => {
  await expect
    .poll(async () => await page.evaluate(() => typeof (window as any).localApi))
    .toBe('object');
  await expect
    .poll(async () => await page.evaluate(() => typeof (window as any).localApi.maskDocx))
    .toBe('function');
});
