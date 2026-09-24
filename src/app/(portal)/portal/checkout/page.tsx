'use client'
import { useState, FormEvent } from 'react'
import { useCart } from '@/hooks/useCart'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { Tag, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface FormState {
  // Delivery
  deliveryName: string
  deliveryCompany: string
  deliveryAddress: string
  deliveryZip: string
  deliveryCity: string
  // Contact
  email: string
  phone: string
  reference: string
  // Extras
  notes: string
  campaignCode: string
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  background: 'var(--bg3)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text3)',
  textTransform: 'uppercase',
  letterSpacing: '.08em',
  display: 'block',
  marginBottom: 6,
}

export default function CheckoutPage() {
  const { items, subtotal, vatAmount, total, discount, campaignDiscount, campaignCode,
    applyCampaign, clearCampaign, clearCart, priceList } = useCart()
  const router = useRouter()

  const [form, setForm] = useState<FormState>({
    deliveryName: '',
    deliveryCompany: '',
    deliveryAddress: '',
    deliveryZip: '',
    deliveryCity: '',
    email: '',
    phone: '',
    reference: '',
    notes: '',
    campaignCode: '',
  })

  const [campaignInput, setCampaignInput] = useState('')
  const [campaignLoading, setCampaignLoading] = useState(false)
  const [campaignError, setCampaignError] = useState('')
  const [campaignSuccess, setCampaignSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  function set(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Campaign codes are checked by the database (place_order dry run); the
  // campaigns table is not readable by customers.
  async function handleCampaign() {
    if (!campaignInput.trim()) return
    setCampaignLoading(true)
    setCampaignError('')
    setCampaignSuccess('')
    const code = campaignInput.trim().toUpperCase()
    const { data, error } = await createClient().rpc('place_order', {
      p_items: items.map(i => ({ product_id: i.product.id, qty: i.qty })),
      p_campaign_code: code,
      p_dry_run: true,
    })
    setCampaignLoading(false)
    if (error || !data) {
      setCampaignError(error?.message || 'Ogiltig eller utgången kampanjkod.')
      return
    }
    applyCampaign((data as { discount: number }).discount, code)
    setCampaignSuccess(`${code} — ${fmt((data as { discount: number }).discount)} kr rabatt tillagd!`)
    setCampaignInput('')
  }

  function removeCampaign() {
    clearCampaign()
    setCampaignSuccess('')
    setCampaignError('')
    setCampaignInput('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (items.length === 0) return
    setSubmitting(true)
    setSubmitError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // Priced and saved by the database, like the webshop checkout.
    const { data: placed, error: placeError } = await supabase.rpc('place_order', {
      p_items: items.map(item => ({ product_id: item.product.id, qty: item.qty })),
      p_delivery: {
        company: form.deliveryCompany || form.deliveryName,
        contact_name: form.deliveryName,
        email: form.email || user.email,
        phone: form.phone,
        address: form.deliveryAddress,
        zip: form.deliveryZip,
        city: form.deliveryCity,
        reference: form.reference,
        message: form.notes,
      },
      p_campaign_code: campaignCode || null,
    })

    if (placeError || !placed) {
      setSubmitError(placeError?.message || 'Något gick fel vid orderläggning. Försök igen.')
      setSubmitting(false)
      return
    }

    clearCart()
    router.push('/portal/orders')
  }

  if (items.length === 0 && !submitting) {
    return (
      <div style={{ padding: '80px 48px', textAlign: 'center', color: 'var(--text3)' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--text)', marginBottom: 16 }}>
          Varukorgen är tom
        </div>
        <p style={{ marginBottom: 24, fontSize: 14 }}>
          Lägg till produkter i varukorgen innan du går till kassan.
        </p>
        <button
          onClick={() => router.push('/portal/catalog')}
          style={{
            padding: '12px 28px',
            background: 'var(--gold)',
            color: '#111',
            border: 'none',
            borderRadius: 8,
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Gå till produktkatalogen
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ padding: '48px 48px 32px', borderBottom: '1px solid var(--border)' }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--gold)',
            textTransform: 'uppercase',
            letterSpacing: '.1em',
            marginBottom: 14,
            display: 'block',
          }}
        >
          Kassa
        </span>
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '44px',
            fontWeight: 500,
            color: 'var(--text)',
            lineHeight: 1.1,
          }}
        >
          Slutför <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>beställning</em>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 380px',
          gap: 0,
          alignItems: 'start',
        }}
      >
        {/* Left: Forms */}
        <div style={{ padding: '40px 48px', borderRight: '1px solid var(--border)' }}>
          {/* Delivery */}
          <section style={{ marginBottom: 40 }}>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text2)',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                marginBottom: 20,
                paddingBottom: 12,
                borderBottom: '1px solid var(--border)',
              }}
            >
              Leveransuppgifter
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Namn *</label>
                <input
                  required
                  value={form.deliveryName}
                  onChange={e => set('deliveryName', e.target.value)}
                  style={inputStyle}
                  placeholder="För- och efternamn"
                />
              </div>
              <div>
                <label style={labelStyle}>Företag</label>
                <input
                  value={form.deliveryCompany}
                  onChange={e => set('deliveryCompany', e.target.value)}
                  style={inputStyle}
                  placeholder="Företagsnamn"
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Gatuadress *</label>
                <input
                  required
                  value={form.deliveryAddress}
                  onChange={e => set('deliveryAddress', e.target.value)}
                  style={inputStyle}
                  placeholder="Gatuadress"
                />
              </div>
              <div>
                <label style={labelStyle}>Postnummer *</label>
                <input
                  required
                  value={form.deliveryZip}
                  onChange={e => set('deliveryZip', e.target.value)}
                  style={inputStyle}
                  placeholder="123 45"
                />
              </div>
              <div>
                <label style={labelStyle}>Ort *</label>
                <input
                  required
                  value={form.deliveryCity}
                  onChange={e => set('deliveryCity', e.target.value)}
                  style={inputStyle}
                  placeholder="Stockholm"
                />
              </div>
            </div>
          </section>

          {/* Contact */}
          <section style={{ marginBottom: 40 }}>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text2)',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                marginBottom: 20,
                paddingBottom: 12,
                borderBottom: '1px solid var(--border)',
              }}
            >
              Kontaktuppgifter
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>E-post *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  style={inputStyle}
                  placeholder="namn@foretag.se"
                />
              </div>
              <div>
                <label style={labelStyle}>Telefon</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  style={inputStyle}
                  placeholder="070-000 00 00"
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Er referens / PO-nummer</label>
                <input
                  value={form.reference}
                  onChange={e => set('reference', e.target.value)}
                  style={inputStyle}
                  placeholder="t.ex. PO-12345 eller kontaktnamn"
                />
              </div>
            </div>
          </section>

          {/* Notes */}
          <section style={{ marginBottom: 40 }}>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text2)',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                marginBottom: 20,
                paddingBottom: 12,
                borderBottom: '1px solid var(--border)',
              }}
            >
              Övrigt
            </div>
            <label style={labelStyle}>Meddelande till oss</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }}
              placeholder="Särskilda instruktioner, önskad leveranstid, etc."
            />
          </section>

          {/* Campaign Code */}
          <section>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text2)',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                marginBottom: 20,
                paddingBottom: 12,
                borderBottom: '1px solid var(--border)',
              }}
            >
              Kampanjkod
            </div>
            {campaignCode ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  background: 'rgba(76,175,125,.08)',
                  border: '1px solid rgba(76,175,125,.2)',
                  borderRadius: 8,
                }}
              >
                <CheckCircle size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '13px', color: 'var(--green)' }}>
                  {campaignSuccess || `Kod "${campaignCode}" tillämpad`}
                </span>
                <button
                  type="button"
                  onClick={removeCampaign}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text3)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Tag
                      size={14}
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text3)',
                      }}
                    />
                    <input
                      value={campaignInput}
                      onChange={e => {
                        setCampaignInput(e.target.value.toUpperCase())
                        setCampaignError('')
                      }}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCampaign())}
                      style={{ ...inputStyle, paddingLeft: 36 }}
                      placeholder="KAMPANJKOD"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCampaign}
                    disabled={!campaignInput || campaignLoading}
                    style={{
                      padding: '0 20px',
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text2)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: campaignInput && !campaignLoading ? 'pointer' : 'not-allowed',
                      opacity: !campaignInput || campaignLoading ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {campaignLoading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                    Tillämpa
                  </button>
                </div>
                {campaignError && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 8,
                      fontSize: '12px',
                      color: '#E05252',
                    }}
                  >
                    <AlertCircle size={13} />
                    {campaignError}
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {/* Right: Order Summary */}
        <div style={{ padding: '40px 36px', position: 'sticky', top: 0 }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text2)',
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              marginBottom: 20,
              paddingBottom: 12,
              borderBottom: '1px solid var(--border)',
            }}
          >
            Ordersammanfattning
          </div>

          {/* Items */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginBottom: 20,
              maxHeight: 320,
              overflowY: 'auto',
            }}
          >
            {items.map(item => (
              <div
                key={item.product.id}
                style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: 'var(--bg3)',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  {item.product.image_url ? (
                    <img
                      src={item.product.image_url}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      alt=""
                    />
                  ) : (
                    '🧴'
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.product.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                    {item.qty} × {fmt(item.unitPrice)} kr
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    color: 'var(--text)',
                    flexShrink: 0,
                  }}
                >
                  {fmt(item.unitPrice * item.qty)} kr
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                color: 'var(--text3)',
                marginBottom: 6,
              }}
            >
              <span>Delsumma</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt(subtotal)} kr</span>
            </div>
            {discount > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  color: 'var(--green)',
                  marginBottom: 6,
                }}
              >
                <span>Prislistebesparingen</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>−{fmt(discount)} kr</span>
              </div>
            )}
            {campaignDiscount > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  color: 'var(--green)',
                  marginBottom: 6,
                }}
              >
                <span>Kampanjrabatt ({campaignCode})</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>−{fmt(campaignDiscount)} kr</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                color: 'var(--text3)',
                marginBottom: 6,
              }}
            >
              <span>Moms (25%)</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt(vatAmount)} kr</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 17,
                fontWeight: 600,
                color: 'var(--text)',
                borderTop: '1px solid rgba(255,255,255,.06)',
                paddingTop: 12,
                marginTop: 6,
              }}
            >
              <span>Totalt inkl. moms</span>
              <span
                style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--gold)' }}
              >
                {fmt(total)} kr
              </span>
            </div>
          </div>

          {/* Submit error */}
          {submitError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 14,
                padding: '10px 14px',
                background: 'rgba(224,82,82,.08)',
                border: '1px solid rgba(224,82,82,.2)',
                borderRadius: 8,
                fontSize: '13px',
                color: '#E05252',
              }}
            >
              <AlertCircle size={14} />
              {submitError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || items.length === 0}
            style={{
              width: '100%',
              padding: 15,
              marginTop: 20,
              background: 'var(--gold)',
              color: '#111',
              border: 'none',
              borderRadius: 8,
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: '.04em',
              cursor: submitting || items.length === 0 ? 'not-allowed' : 'pointer',
              opacity: submitting || items.length === 0 ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            {submitting && (
              <Loader2
                size={15}
                style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
              />
            )}
            {submitting ? 'Lägger beställning…' : 'Bekräfta beställning'}
          </button>
          <p style={{ fontSize: '11px', color: 'var(--text3)', textAlign: 'center', marginTop: 12 }}>
            Genom att bekräfta godkänner du våra leveransvillkor.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        textarea { resize: vertical; }
        input::placeholder, textarea::placeholder { color: var(--text3); opacity: 0.7; }
        input:focus, textarea:focus { border-color: rgba(232,184,75,.4) !important; }
      `}</style>
    </form>
  )
}
