import Image from 'next/image'

export function Wordmark({ size = 40 }: { size?: number }) {
  return (
    <span className="flex items-center gap-3">
      <Image src="/brand/logo.svg" width={size} height={size} alt="" priority />
      <span className="font-display leading-none tracking-[0.14em] text-ink">
        <span className="block text-[1.05rem]">DENIKS20</span>
        <span className="mt-1 block text-[0.62rem] tracking-[0.34em] text-muted">STITCHES</span>
      </span>
    </span>
  )
}
