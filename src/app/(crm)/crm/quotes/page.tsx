'use client'
import { LeadsPanel, QuotesPanel, DraftsPanel, FollowUpPanel } from '@/components/crm/LeadsAndQuotes'

// Offers and leads in one place: what to follow up, open quotes, leads with
// notes and saved carts. Every row opens straight into the order/quote.
export default function QuotesAndLeadsPage() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px 80px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Offerter & leads</h1>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text2)' }}>Öppna offerter, leads med anteckningar och sparade varukorgar – ett klick öppnar dem.</p>
      <div style={{ marginBottom: 20 }}><FollowUpPanel /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, alignItems: 'start' }}>
        <QuotesPanel limit={40} />
        <LeadsPanel limit={40} />
        <DraftsPanel limit={40} />
      </div>
    </div>
  )
}
