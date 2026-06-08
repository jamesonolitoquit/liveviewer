interface JaoLogoProps {
  size?: number
  className?: string
}

export function JaoLogo({ size = 24, className = '' }: JaoLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="50" cy="20" r="6" />
      <circle cx="25" cy="45" r="5" />
      <circle cx="75" cy="45" r="5" />
      <circle cx="50" cy="70" r="7" />
      <circle cx="20" cy="80" r="4" />
      <circle cx="80" cy="80" r="4" />
      <line x1="44" y1="24" x2="29" y2="41" />
      <line x1="56" y1="24" x2="71" y2="41" />
      <line x1="30" y1="50" x2="45" y2="66" />
      <line x1="70" y1="50" x2="55" y2="66" />
      <line x1="24" y1="75" x2="44" y2="72" />
      <line x1="76" y1="75" x2="56" y2="72" />
      <line x1="50" y1="77" x2="50" y2="63" />
    </svg>
  )
}
