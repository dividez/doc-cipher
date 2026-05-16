import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/app.css';
import { WorkbenchPage } from './pages/WorkbenchPage';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <WorkbenchPage />
  </React.StrictMode>,
);
