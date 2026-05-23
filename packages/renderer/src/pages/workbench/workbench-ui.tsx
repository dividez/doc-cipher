import type { ReactNode } from 'react';
import { TipsButton } from '../../components/TipsButton.js';
import {
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Home,
  Settings,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import type { MaskingRule } from '@app/shared';
import { AppIcon } from '../../components/AppIcon.js';
import { Button, Card, Input, Label, cn } from '../../components/ui.js';
import type { ActiveView } from './types.js';
import { fileName } from './workbench-utils.js';
export function DevDebugPanel({
  open,
  pingResult,
  filePath,
  maskResult,
  onToggle,
  onPing,
  onSelectDocx,
  onSelectAndMask,
}: {
  open: boolean;
  pingResult: { message: string; time: string } | null;
  filePath: string | null;
  maskResult: { success: boolean; outputPath: string } | null;
  onToggle: () => void;
  onPing: () => void;
  onSelectDocx: () => void;
  onSelectAndMask: () => void;
}) {
  return (
    <section className="dev-debug">
      <button type="button" className="dev-debug-toggle" onClick={onToggle}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>开发调试</span>
      </button>
      {open && (
        <div className="dev-debug-body">
          <div className="dev-debug-actions">
            <Button type="button" variant="outline" onClick={onPing}>
              Ping Main
            </Button>
            <Button type="button" variant="outline" onClick={onSelectDocx}>
              选择 Word 文件
            </Button>
            <Button type="button" variant="outline" onClick={onSelectAndMask}>
              选择并脱敏（smoke）
            </Button>
          </div>
          <div className="dev-debug-output">
            {pingResult && (
              <p>
                ping: {pingResult.message} @ {pingResult.time}
              </p>
            )}
            {filePath && <p>file: {filePath}</p>}
            {maskResult && <p>output: {maskResult.outputPath}</p>}
            {!pingResult && !filePath && !maskResult && (
              <p className="dev-debug-empty">暂无调试输出</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function SidebarNav({
  activeView,
  onNavigate,
}: {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
}) {
  return (
    <nav className="sidebar-nav" aria-label="主导航">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <AppIcon size={22} />
        </div>
        <div>
          <h1>DocCipher</h1>
          <p>本地文档、内容脱敏工作台</p>
        </div>
      </div>
      <div className="nav-flow">
        <NavItem
          active={activeView === 'home'}
          icon={<Home size={16} />}
          label="工作台"
          onClick={() => onNavigate('home')}
        />
        <NavItem
          active={activeView === 'mask'}
          icon={<ShieldCheck size={16} />}
          label="脱敏"
          onClick={() => onNavigate('mask')}
        />
        <NavItem
          active={activeView === 'restore'}
          icon={<Undo2 size={16} />}
          label="还原"
          onClick={() => onNavigate('restore')}
        />
        <NavItem
          active={activeView === 'profiles'}
          icon={<Settings size={16} />}
          label="方案"
          onClick={() => onNavigate('profiles')}
        />
      </div>
      <div className="nav-secondary">
        <NavItem
          active={activeView === 'settings'}
          icon={<Settings size={14} />}
          label="设置"
          secondary
          onClick={() => onNavigate('settings')}
        />
      </div>
    </nav>
  );
}

export function NavItem({
  active,
  icon,
  label,
  secondary,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  secondary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn('nav-item', active && 'nav-item-active', secondary && 'nav-item-secondary')}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function RuleDetail({ rule }: { rule: MaskingRule }) {
  if (rule.type === 'regex') {
    return (
      <div className="rule-detail">
        <Label>匹配模式</Label>
        <code>{rule.pattern}</code>
        <Label>占位符</Label>
        <code>{rule.placeholder}</code>
      </div>
    );
  }
  if (rule.type === 'keyword') {
    return (
      <div className="rule-detail">
        <Label>关键词</Label>
        <code>{rule.keywords.join('、')}</code>
        <Label>占位符</Label>
        <code>{rule.placeholder}</code>
      </div>
    );
  }
  return (
    <div className="rule-detail">
      <Label>手动项</Label>
      <code>{rule.selections.length > 0 ? rule.selections.join('、') : '（暂无）'}</code>
      <Label>占位符</Label>
      <code>{rule.placeholder}</code>
    </div>
  );
}

export function PanelHero({
  title,
  description,
  tips,
}: {
  title: string;
  description?: string;
  tips?: ReactNode;
}) {
  return (
    <header className="panel-hero">
      <div className="panel-hero-title">
        <h2>{title}</h2>
        {tips ? <TipsButton label="脱敏任务说明">{tips}</TipsButton> : null}
      </div>
      {description ? <p>{description}</p> : null}
    </header>
  );
}

export function SectionHead({
  title,
  meta,
  tips,
}: {
  title: string;
  meta?: ReactNode;
  tips?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div className="section-head-title">
        <h3>{title}</h3>
        {tips ? <TipsButton label={`${title}说明`}>{tips}</TipsButton> : null}
      </div>
      {meta !== undefined && meta !== null ? <span className="section-meta">{meta}</span> : null}
    </div>
  );
}

export function PathField({
  label,
  value,
  onPick,
  placeholder,
}: {
  label: string;
  value: string;
  onPick: () => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <div className="path-field">
        <Input value={value} readOnly placeholder={placeholder} />
        <Button type="button" variant="outline" onClick={onPick} aria-label={`选择${label}`}>
          <FolderOpen size={16} />
        </Button>
      </div>
    </Field>
  );
}

export function Field({ label, children }: { label: ReactNode; children: React.ReactNode }) {
  return (
    <div className="field">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function ResultFile({ name }: { name: string }) {
  return (
    <div className="result-file-mini" title={name}>
      <Check size={12} />
      <span>{name}</span>
    </div>
  );
}

export function ResultFileRow({ path, onOpen }: { path: string; onOpen: () => void }) {
  return (
    <li>
      <Check size={14} className="result-check" />
      <span className="result-name" title={path}>
        {fileName(path)}
      </span>
      <button type="button" className="result-open" onClick={onOpen}>
        打开
      </button>
    </li>
  );
}
