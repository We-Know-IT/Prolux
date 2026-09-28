import { fmt } from '@/lib/utils'
import { withVat } from '@/lib/pricing'

// The incl. VAT amount under a price shown excl. VAT (admin and CRM).
export default function IncVat({ net, total }: { net: number; total?: number | null }) {
  return (
    <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
      {fmt(total ?? withVat(net))} kr inkl. moms
    </span>
  )
}
