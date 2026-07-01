export interface PhaseGateBannerProps {
  phase: 'configuration' | 'provisioning'
  className?: string
}

const GATE_MESSAGES: Record<PhaseGateBannerProps['phase'], string> = {
  configuration:
    'Data Integrity Validation must be signed off before Configuration can begin.',
  provisioning:
    'All Configuration tasks must be complete before Provisioning can begin.',
}

/** Amber warning banner shown above a gated (locked) phase's tasks. */
export function PhaseGateBanner({ phase }: PhaseGateBannerProps) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-l-[3px] border-warning-border border-l-warning bg-warning-subtle px-4 py-3">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-px shrink-0 text-warning"
        aria-hidden="true"
      >
        <path d="M8 1.5L15 14H1z" />
        <path d="M8 6.5v3.5" />
        <path d="M8 12h.01" />
      </svg>
      <p className="text-[12.5px] font-medium leading-snug text-warning-strong">
        {GATE_MESSAGES[phase]}
      </p>
    </div>
  )
}
