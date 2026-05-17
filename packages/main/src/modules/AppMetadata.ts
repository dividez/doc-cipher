import { BUILD_INFO } from '@app/shared';
import { nativeImage } from 'electron';
import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import { resolveAppIconPath } from '../lib/app-icon.js';
import { APP_COPYRIGHT, APP_DISPLAY_NAME } from '../lib/app-metadata.js';

class AppMetadata implements AppModule {
  enable({ app }: ModuleContext): void {
    app.setName(APP_DISPLAY_NAME);

    const iconPath = resolveAppIconPath();
    const icon = iconPath ? nativeImage.createFromPath(iconPath) : undefined;

    app.setAboutPanelOptions({
      applicationName: APP_DISPLAY_NAME,
      applicationVersion: BUILD_INFO.version,
      version: BUILD_INFO.version,
      copyright: APP_COPYRIGHT,
      website: BUILD_INFO.repo,
      credits: `Build: ${BUILD_INFO.build}`,
      ...(icon && !icon.isEmpty() ? { icon } : {}),
    });
  }
}

export function appMetadata(...args: ConstructorParameters<typeof AppMetadata>) {
  return new AppMetadata(...args);
}
