import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron';
import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';

function sendNavigate(view: string): void {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  window?.webContents.send('app:navigate', view);
}

function buildMenuTemplate(appName: string): MenuItemConstructorOptions[] {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: appName,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              {
                label: '设置…',
                accelerator: 'CmdOrCtrl+,',
                click: () => sendNavigate('settings'),
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          } as MenuItemConstructorOptions,
        ]
      : []),
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ];

  if (!isMac) {
    template.push({
      label: '文件',
      submenu: [
        {
          label: '设置',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendNavigate('settings'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  return template;
}

class ApplicationMenu implements AppModule {
  async enable({ app }: ModuleContext): Promise<void> {
    await app.whenReady();
    const menu = Menu.buildFromTemplate(buildMenuTemplate(app.name));
    Menu.setApplicationMenu(menu);
  }
}

export function applicationMenu(...args: ConstructorParameters<typeof ApplicationMenu>) {
  return new ApplicationMenu(...args);
}
