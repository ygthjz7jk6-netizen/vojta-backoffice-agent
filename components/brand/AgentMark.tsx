import { cn } from '@/lib/utils'

export function AgentMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'agent-mark relative inline-flex shrink-0 items-center justify-center',
        className
      )}
    >
      <span className="agent-eye left-[31%]" />
      <span className="agent-eye right-[31%]" />
    </span>
  )
}
