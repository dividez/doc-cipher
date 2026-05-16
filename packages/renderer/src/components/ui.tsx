import type {ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes} from 'react';

type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function Button({
  className,
  variant = 'default',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {variant?: Variant}) {
  return <button className={cn('ui-button', `ui-button-${variant}`, className)} {...props} />;
}

export function Input({className, ...props}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('ui-input', className)} {...props} />;
}

export function Textarea({className, ...props}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('ui-textarea', className)} {...props} />;
}

export function Label({className, ...props}: HTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('ui-label', className)} {...props} />;
}

export function Card({className, ...props}: HTMLAttributes<HTMLDivElement>) {
  return <section className={cn('ui-card', className)} {...props} />;
}

export function Badge({
  className,
  variant = 'secondary',
  ...props
}: HTMLAttributes<HTMLSpanElement> & {variant?: 'default' | 'secondary' | 'success'}) {
  return <span className={cn('ui-badge', `ui-badge-${variant}`, className)} {...props} />;
}

export function Alert({className, ...props}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui-alert', className)} {...props} />;
}
