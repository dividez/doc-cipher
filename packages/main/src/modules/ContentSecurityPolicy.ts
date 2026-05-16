import type {AppModule} from '../AppModule.js';
import type {ModuleContext} from '../ModuleContext.js';

export class ContentSecurityPolicy implements AppModule {
  enable({app}: ModuleContext): void {
    app.on('web-contents-created', (_, contents) => {
      contents.session.webRequest.onHeadersReceived((details, callback) => {
        const devPolicy = [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "font-src 'self' data:",
          "connect-src 'self' ws: http://localhost:* http://127.0.0.1:*",
          "object-src 'none'",
          "base-uri 'self'",
        ].join('; ');
        const productionPolicy = [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "font-src 'self' data:",
          "connect-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
        ].join('; ');

        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [import.meta.env.DEV ? devPolicy : productionPolicy],
          },
        });
      });
    });
  }
}

export function applyContentSecurityPolicy() {
  return new ContentSecurityPolicy();
}
