import { assertEquals } from 'jsr:@std/assert@1'
import { toLead, parseForm, noteFor } from './lib.ts'

Deno.test('Fluent Forms JSON with name parts', () => {
  const l = toLead({ names: { first_name: 'Anna', last_name: 'Berg' }, email: 'Anna@Bilvard.se', phone: '070-1', company_name: 'Bilvård AB', message: 'Vill bli återförsäljare', _wp_http_referer: '/kontakt', __fluent_form_embded_post_id: '12', form_name: 'Kontakt' })
  assertEquals([l.name, l.email, l.phone, l.company, l.message, l.form], ['Anna Berg', 'anna@bilvard.se', '070-1', 'Bilvård AB', 'Vill bli återförsäljare', 'Kontakt'])
  assertEquals(l.other, [])
})

Deno.test('Elementor form-encoded with labels', () => {
  const body = 'form[name]=Återförsäljare&fields[name][id]=name&fields[name][title]=Namn&fields[name][value]=Kim&fields[email][title]=E-post&fields[email][value]=kim@x.se&fields[f1][title]=Företag&fields[f1][value]=Glans AB&fields[f2][title]=Antal anställda&fields[f2][value]=5&fields[msg][title]=Meddelande&fields[msg][value]=Hej'
  const l = toLead(parseForm(body))
  assertEquals([l.name, l.email, l.company, l.message, l.form], ['Kim', 'kim@x.se', 'Glans AB', 'Hej', 'Återförsäljare'])
  assertEquals(l.other, [['Antal anställda', '5']])
  const n = noteFor(l)
  assertEquals(n.includes('Antal anställda: 5') && n.includes('formuläret "Återförsäljare"'), true)
})

Deno.test('Elementor simple (no advanced data)', () => {
  const l = toLead(parseForm('Namn=Ali&E-post=ali%40t.se&Telefon=0701&Ort=Malmö&Ditt+meddelande=Pris%3F'))
  assertEquals([l.name, l.email, l.phone, l.city, l.message], ['Ali', 'ali@t.se', '0701', 'Malmö', 'Pris?'])
})
