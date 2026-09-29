-- Om oss: Virtus and Frescura texts from the brands' own sites (translated).
-- Run once in the Supabase SQL Editor. Safe to run again.
-- Replaces tagline, description and bullet points of the two brand cards in
-- the saved Om oss content; the card photos and everything else are kept.

update site_content s
   set data = jsonb_set(s.data, '{brands}', (
         select jsonb_agg(case lower(trim(b ->> 'name'))
                            when 'virtus'   then b || '{"tagline": "Italiensk nanoteknologi sedan 1957", "desc": "Virtus tillverkas av italienska Allchem, som sedan 1957 forskar fram och producerar professionella produkter för lackering, detailing och nanoteknologi. Med över 65 år i branschen används Virtus av proffs över hela världen. Nanopartiklarna i polermedlen ger ett hologramfritt resultat — med stor hänsyn till miljön.", "items": ["Polering utan hologram", "Nanoteknologiskt lackskydd", "Professionell detailing", "Miljöanpassade formler"]}'::jsonb
                            when 'frescura' then b || '{"tagline": "For car loving people", "desc": "Frescura har skrivit historia inom bilvårdsprodukter i Italien och har i över femtio år varit ledande i branschen. Sortimentet ligger alltid i marknadens topp när det gäller innovation och kvalitet — ofta ett steg före bilvärldens nya krav. Framgångsreceptet har exporterats till de viktigaste marknaderna utomlands och gjort Frescura till en självklar referens för proffsen, med fortsatta satsningar på nya produkter och tjänster.", "items": ["Tvätt & förtvätt", "Fälg- och däckvård", "Vax & glans", "Glas, interiör & vinter"]}'::jsonb
                            else b end
                          order by ord)
           from jsonb_array_elements(s.data -> 'brands') with ordinality as t(b, ord))),
       updated_at = now()
 where s.id = 'om_oss' and jsonb_typeof(s.data -> 'brands') = 'array';
