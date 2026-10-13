import type { GuideStep } from './GuideTour'

export const ADMIN_GUIDE: GuideStep[] = [
  { title: 'Välkommen till ProLuxShine admin', body: 'En snabb rundtur på en minut. Du kan alltid starta den igen med frågetecknet uppe till höger.' },
  { target: '.admin-desktop-nav a[href="/admin/dashboard"]', title: 'Översikt', body: 'Dagens läge: Följ upp (offerter och varukorgar som legat orörda), leads med anteckningar, öppna offerter, sparade varukorgar, försäljning och budget.' },
  { target: '.admin-desktop-nav a[href="/admin/orders"]', title: 'Ordrar', body: 'Alla ordrar från webbshoppen och säljarna. Klicka på en order för att bekräfta den eller skicka med spårningsnummer. + Ny order öppnar produktkatalogen.' },
  { target: '.admin-desktop-nav a[href="/admin/customers"]', title: 'Kunder', body: 'Kundregistret: prislista (A/B/C), kundansvarig säljare, kontaktuppgifter och födelsedagar för utskick.' },
  { target: '.admin-desktop-nav a[href="/admin/products"]', title: 'Produkter', body: 'Priser, bilder och lager. Klicka på en produkt för att ändra den, eller importera många på en gång från Excel/CSV.' },
  { target: '.admin-desktop-nav a[href="/admin/content"]', title: 'Innehåll', body: 'Texter och bilder på webbplatsen. Snabbast är att öppna webbshoppen och klicka på "Redigera sida".' },
  { target: '.admin-desktop-nav a[href="/admin/campaigns"]', title: 'Kampanjer', body: 'Rabattkoder som kunderna kan använda i kassan, med giltighetstid och max antal användningar.' },
  { target: '.admin-desktop-nav a[href="/admin/staff"]', title: 'Team', body: 'Lägg till säljare och administratörer. Varje ny person får ett eget startlösenord som visas en gång.' },
  { target: '.admin-desktop-nav a[href="/admin/integrations"]', title: 'Integrationer', body: 'Kopplingen till Visma: fakturor skapas när ordrar bekräftas, och betalningar syns på ordern.' },
  { target: '.admin-desktop-nav a[href="/crm/dashboard"]', title: 'CRM', body: 'Säljverktyget. Inne i CRM visas en egen meny: Ny order, Ordrar, Pipeline, Kunder, Bilen, Kalender och Anteckningar.' },
  { target: '[data-tour="cart"]', title: 'Varukorgen', body: 'Ordern du jobbar med. Den sparas automatiskt som utkast, så du kan visa kunden något annat och fortsätta senare.' },
  { target: '[data-tour="bell"]', title: 'Nya ordrar', body: 'Klockan lyser och räknar upp när en ny order kommer in. Förfrågningar från webben visas som en notis.' },
  { target: '[data-tour="webshop"]', title: 'Webbshoppen', body: 'Öppnar webbshoppen inloggad. Där kan du redigera texter och bilder direkt på sidan.' },
  { target: '[data-tour="help"]', title: 'Klart!', body: 'Frågetecknet startar guiden igen när du vill.' },
]

export const CRM_GUIDE: GuideStep[] = [
  { title: 'Välkommen till ProLuxShine CRM', body: 'En snabb rundtur på en minut. Du kan alltid starta den igen med frågetecknet uppe till höger.' },
  { target: '.crm-desktop-nav a[href="/crm/dashboard"]', title: 'Översikt', body: 'Din budget, Följ upp (offerter och varukorgar som legat orörda), leads med anteckningar och sparade varukorgar. Ett klick öppnar offerten.' },
  { target: '.crm-desktop-nav a[href="/crm/orders"]', title: 'Ny order', body: 'Produktkatalogen med stora bilder. Kund är valfritt – lägg i varukorgen och välj eller skapa kunden i kassan. Utan kund sparas ordern som utkast.' },
  { target: '[data-tour="cart"]', title: 'Varukorgen', body: 'Visar ordern utan att lämna katalogen: ändra antal, ta bort rader och gå till kassan. Den sparas automatiskt som utkast.' },
  { target: '.crm-desktop-nav a[href="/crm/orders?view=history"]', title: 'Ordrar', body: 'Alla ordrar, utkast och offerter. I kassan väljer du per rad Bilen, Frakt eller Dela, sätter rabatt i procent och sparar som lead, mejlar offerten som PDF eller lägger ordern.' },
  { target: '.crm-desktop-nav a[href="/crm/pipeline"]', title: 'Pipeline', body: 'Affärerna från Prospekt till Vunnen. Offerter du sparar som lead hamnar under Offert – Öppna offert tar dig direkt till den.' },
  { target: '.crm-desktop-nav a[href="/crm/customers"]', title: 'Kunder', body: 'Kundkortet: fast info, senaste köp med bilder, rekommendationer och Sälj igen.' },
  { target: '.crm-desktop-nav a[href="/crm/car"]', title: 'Bilen', body: 'Det du har i bilen. Lasta från lagret här – det du säljer "från bilen" dras av automatiskt.' },
  { target: '.crm-desktop-nav a[href="/crm/calendar"]', title: 'Kalender', body: 'Möten, samtal och påminnelser. Klicka på en aktivitet för att ändra den.' },
  { target: '[data-tour="help"]', title: 'Klart!', body: 'Frågetecknet startar guiden igen när du vill.' },
]
