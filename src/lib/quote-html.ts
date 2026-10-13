// The quote as e-mail HTML that matches the PDF: tables and inline styles only
// (what Gmail and Outlook render), pictures from their web addresses.
import type { QuotePdfInput } from '@/lib/quote-pdf'

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!))
const kr = (n: number) => `${Math.round(n || 0).toLocaleString('sv-SE')}&nbsp;kr`
const short = (s: string, max = 150) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length <= max ? t : t.slice(0, max).replace(/\s+\S*$/, '') + '…' }

export function buildQuoteHtml(q: QuotePdfInput & { logoUrl: string; pdfUrl?: string | null }): { html: string; text: string } {
  const c = q.customer
  const d = new Date(q.date), valid = new Date(d.getTime() + 30 * 86_400_000)
  const lineSum = q.items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const discount = lineSum - q.subtotal >= 1 ? lineSum - q.subtotal : 0
  const first = c.contact_name ? c.contact_name.split(' ')[0] : ''
  const font = "font-family:Helvetica,Arial,sans-serif;"
  const rows = q.items.map((it, i) => `
    <tr style="background:${i % 2 ? '#ffffff' : '#fbfaf7'}">
      <td style="padding:12px 10px;width:76px;vertical-align:middle">
        <div style="width:72px;height:72px;background:#fff;border:1px solid #e8e6e0;border-radius:8px;text-align:center;line-height:72px">
          ${it.imageUrl ? `<img src="${esc(it.imageUrl)}" alt="" width="64" style="max-width:64px;max-height:64px;vertical-align:middle">` : ''}
        </div>
      </td>
      <td style="padding:12px 10px;vertical-align:middle;${font}">
        ${it.brand ? `<div style="font-size:10px;font-weight:bold;letter-spacing:1px;color:#C8971A;text-transform:uppercase">${esc(it.brand)}</div>` : ''}
        <div style="font-size:15px;font-weight:bold;color:#111">${esc(it.name)}</div>
        ${it.description ? `<div style="font-size:12px;color:#6e6e6e;margin-top:3px">${esc(short(it.description))}</div>` : ''}
        <div style="font-size:11px;color:#6e6e6e;margin-top:3px">${[it.sku ? `Art.nr ${esc(it.sku)}` : '', it.delivery === 'car' ? 'Levereras direkt' : ''].filter(Boolean).join(' · ')}</div>
      </td>
      <td style="padding:12px 10px;text-align:right;white-space:nowrap;font-size:14px;color:#111;${font}">${it.qty}&nbsp;st</td>
      <td style="padding:12px 10px;text-align:right;white-space:nowrap;font-size:14px;color:#111;${font}">
        ${it.listPrice && it.listPrice > it.unitPrice ? `<div style="font-size:11px;color:#a0a0a0;text-decoration:line-through">${kr(it.listPrice)}</div>` : ''}${kr(it.unitPrice)}
      </td>
      <td style="padding:12px 10px;text-align:right;white-space:nowrap;font-size:14px;font-weight:bold;color:#111;${font}">${kr(it.qty * it.unitPrice)}</td>
    </tr>`).join('')
  const total = (label: string, value: string, strong = false) => `
    <tr><td style="padding:4px 14px;font-size:${strong ? 16 : 13}px;${strong ? 'font-weight:bold;' : ''}color:#111;${font}">${label}</td>
        <td style="padding:4px 14px;text-align:right;white-space:nowrap;font-size:${strong ? 18 : 13}px;${strong ? 'font-weight:bold;color:#C8971A;' : 'color:#111;'}${font}">${value}</td></tr>`

  const html = `
<div style="background:#f3f1ec;padding:20px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:660px;margin:0 auto;background:#ffffff;border-collapse:collapse;${font}">
  <tr><td style="background:#0F1115;padding:22px 26px;border-bottom:3px solid #C8971A">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><img src="${esc(q.logoUrl)}" alt="ProLux Shine" height="34" style="display:block;height:34px"></td>
      <td style="text-align:right;${font}">
        <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#E8B84B">OFFERT</div>
        <div style="font-size:24px;font-weight:bold;color:#ffffff">#${q.orderNr}</div>
        <div style="font-size:11px;color:#c8c8c8">${d.toLocaleDateString('sv-SE')} · giltig till ${valid.toLocaleDateString('sv-SE')}</div>
      </td></tr></table>
  </td></tr>
  <tr><td style="padding:24px 26px 6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:top;${font}">
        <div style="font-size:10px;font-weight:bold;letter-spacing:1px;color:#6e6e6e">OFFERT TILL</div>
        <div style="font-size:16px;font-weight:bold;color:#111;margin-top:4px">${esc(c.company)}</div>
        <div style="font-size:13px;color:#3c3c3c;line-height:1.6">${[c.contact_name, [c.address, [c.postal_code, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', '), c.org_nr ? `Org.nr ${c.org_nr}` : ''].filter(Boolean).map(esc).join('<br>')}</div>
      </td>
      <td style="vertical-align:top;width:220px">
        <div style="background:#f6f4ef;border-radius:8px;padding:12px 14px;${font}">
          <div style="font-size:10px;font-weight:bold;letter-spacing:1px;color:#6e6e6e">DIN KONTAKTPERSON</div>
          <div style="font-size:15px;font-weight:bold;color:#111;margin-top:4px">${esc(q.seller || 'ProLuxShine')}</div>
          <div style="font-size:12px;color:#3c3c3c;line-height:1.6">${esc(q.sellerEmail || q.contact.email)}<br>${esc(q.contact.phone)}</div>
        </div>
      </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 26px 8px;${font}">
    <div style="font-size:16px;font-weight:bold;color:#111">Hej${first ? ' ' + esc(first) : ''}!</div>
    <div style="font-size:14px;color:#3c3c3c;line-height:1.6;margin-top:6px">Tack för ett trevligt möte. Här är offerten på produkterna vi pratade om – med era priser. Hör av dig om du vill ändra något, annars lägger vi ordern direkt när du svarar.</div>
  </td></tr>
  <tr><td style="padding:8px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      <tr><td></td>
        <td style="padding:6px 10px;font-size:10px;font-weight:bold;letter-spacing:1px;color:#6e6e6e;${font}">PRODUKT</td>
        <td style="padding:6px 10px;font-size:10px;font-weight:bold;letter-spacing:1px;color:#6e6e6e;text-align:right;${font}">ANTAL</td>
        <td style="padding:6px 10px;font-size:10px;font-weight:bold;letter-spacing:1px;color:#6e6e6e;text-align:right;${font}">À-PRIS</td>
        <td style="padding:6px 10px;font-size:10px;font-weight:bold;letter-spacing:1px;color:#6e6e6e;text-align:right;${font}">SUMMA</td></tr>
      ${rows}
    </table>
  </td></tr>
  <tr><td style="padding:12px 26px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:top;font-size:12px;color:#3c3c3c;line-height:1.7;${font}">
        <div style="font-size:10px;font-weight:bold;letter-spacing:1px;color:#6e6e6e">VILLKOR</div>
        Offerten gäller i 30 dagar.<br>Betalning mot faktura, 30 dagar netto.<br>Leverans 1–2 arbetsdagar, fri frakt från 2&nbsp;000&nbsp;kr.
      </td>
      <td style="vertical-align:top;width:290px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ef;border-radius:8px;padding:8px 0">
          ${discount ? total('Varor exkl. moms', kr(lineSum)) + total('Rabatt', '−' + kr(discount)) : ''}
          ${total('Summa exkl. moms', kr(q.subtotal))}
          ${total('Moms 25 %', kr(q.vat))}
          <tr><td colspan="2" style="padding:4px 14px"><div style="border-top:2px solid #C8971A"></div></td></tr>
          ${total('Totalt inkl. moms', kr(q.total), true)}
        </table>
      </td></tr></table>
  </td></tr>
  ${q.pdfUrl ? `<tr><td style="padding:8px 26px 4px;${font}"><a href="${esc(q.pdfUrl)}" style="display:inline-block;background:#E8B84B;color:#111;font-weight:bold;font-size:14px;padding:11px 20px;border-radius:8px;text-decoration:none">Öppna offerten som PDF</a></td></tr>` : ''}
  <tr><td style="padding:18px 26px 22px;border-top:1px solid #ece9e2;font-size:12px;color:#6e6e6e;${font}">
    Svara på det här mejlet så lägger vi ordern.<br>
    <b style="color:#111">ProLuxShine</b> · ${esc(q.contact.phone)} · ${esc(q.contact.email)} · Officiell distributör av Frescura och Virtus
  </td></tr>
</table>
</div>`

  const text = [
    `Hej${first ? ' ' + first : ''}!`, '',
    `Här är offert #${q.orderNr} från ProLuxShine (giltig till ${valid.toLocaleDateString('sv-SE')}):`, '',
    ...q.items.map(it => `• ${it.name} — ${it.qty} st × ${Math.round(it.unitPrice)} kr = ${Math.round(it.qty * it.unitPrice)} kr`), '',
    ...(discount ? [`Rabatt: −${Math.round(discount)} kr`] : []),
    `Summa exkl. moms: ${Math.round(q.subtotal)} kr`, `Moms 25 %: ${Math.round(q.vat)} kr`, `Totalt inkl. moms: ${Math.round(q.total)} kr`,
    ...(q.pdfUrl ? ['', `Offerten som PDF: ${q.pdfUrl}`] : []), '',
    'Svara på det här mejlet så lägger vi ordern.', '', 'Med vänliga hälsningar,', q.seller || 'ProLuxShine',
  ].join('\n')
  return { html, text }
}
