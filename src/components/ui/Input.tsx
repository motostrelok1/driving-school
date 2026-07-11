import { cn } from '@/utils/cn'
import type { InputHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: ReactNode
}

export function Input({ label, error, icon, className, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label ? (
        <label className="mb-1.5 block text-sm font-medium text-primary">
          {label}
          {props.required ? <span className="ml-1 text-danger">*</span> : null}
        </label>
      ) : null}
      <div className="relative">
        {icon ? (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        ) : null}
        <input
          className={cn(
            'flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-danger focus-visible:ring-danger',
            icon && 'pl-10',
            className
          )}
          {...props}
        />
      </div>
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  )
}
