import { assertEquals } from 'jsr:@std/assert@1'
import { normalizeOrgNr, parseOrganisation } from './lib.ts'

Deno.test('normalizes organisation numbers', () => {
  assertEquals(normalizeOrgNr('556677-8899'), '5566778899')
  assertEquals(normalizeOrgNr('16556677-8899'), '5566778899')
  assertEquals(normalizeOrgNr('5566'), null)
})

Deno.test('reads name and postal address', () => {
  const body = {
    organisationer: [{
      organisationsidentitet: { identitetsbeteckning: '5566778899' },
      organisationsnamn: { organisationsnamnLista: [{ namn: 'Biltvätt Norr AB', organisationsnamntyp: { kod: 'FORETAGSNAMN' } }] },
      postadressOrganisation: { postadress: { utdelningsadress: 'Industrigatan 4', postnummer: '41104', postort: 'GÖTEBORG', land: 'Sverige' } },
    }],
  }
  assertEquals(parseOrganisation(body, '5566778899'), {
    org_nr: '556677-8899', company: 'Biltvätt Norr AB', address: 'Industrigatan 4', postal_code: '411 04', city: 'Göteborg',
  })
})

Deno.test('no organisation → null', () => {
  assertEquals(parseOrganisation({ organisationer: [] }, '5566778899'), null)
})
