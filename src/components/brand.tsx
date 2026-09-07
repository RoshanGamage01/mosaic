import { cn } from "@/lib/utils";

export function MosaicMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={cn("size-8", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="9" fill="url(#mosaic-gradient)" />
      <rect x="7" y="16" width="4.5" height="9" rx="2.25" fill="white" fillOpacity="0.95" />
      <rect x="13.75" y="11" width="4.5" height="14" rx="2.25" fill="white" fillOpacity="0.8" />
      <rect x="20.5" y="7" width="4.5" height="18" rx="2.25" fill="white" fillOpacity="0.65" />
      <defs>
        <linearGradient id="mosaic-gradient" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#6366F1" />
          <stop offset="0.55" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Wordmark({ className, subtitle = "for your operation" }: { className?: string; subtitle?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <MosaicMark />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight">Mosaic</span>
        <span className="truncate text-[11px] font-medium text-muted-foreground">{subtitle}</span>
      </span>
    </span>
  );
}
