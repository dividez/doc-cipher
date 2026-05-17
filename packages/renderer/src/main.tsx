import React from 'react';
import ReactDOM from 'react-dom/client';
import { appIconUrl } from './lib/app-icon-url';
import './styles/app.css';
import { WorkbenchPage } from './pages/WorkbenchPage';

const favicon =
  document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.createElement('link');
favicon.rel = 'icon';
favicon.type = 'image/png';
favicon.href = appIconUrl;
if (!favicon.parentElement) {
  document.head.appendChild(favicon);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <WorkbenchPage />
  </React.StrictMode>,
);
