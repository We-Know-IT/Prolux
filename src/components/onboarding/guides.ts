import type { GuideStep } from './GuideTour'

export const ADMIN_GUIDE: GuideStep[] = [
  { title: 'Välkommen till ProLuxShine admin', body: 'En snabb rundtur på en minut. Du kan alltid starta den igen med frågetecknet uppe till höger.' },
  { target: '.admin-desktop-nav a[href="/admin/dashboard"]', title: 'Översikt', body: 'Försäljning, budget per säljare, lagerstatus och kommande aktiviteter i kalendern — dagens läge på ett ställe.' },
  { target: '.admin-desktop-nav a[href="/admin/orders"]', title: 'Ordrar', body: 'Alla ordrar från webbshoppen och säljarna. Klicka på en order för att bekräfta den, skicka med spårningsnummer eller öppna en offert och lägga ordern.' },
  { target: '.admin-desktop-nav a[href="/admin/customers"]', title: 'Kunder', body: 'Kundregistret: prislista (A/B/C), kundansvarig säljare, kontaktuppgifter och födelsedagar för utskick.' },
  { target: '.admin-desktop-nav a[href="/admin/products"]', title: 'Produkter', body: 'Priser, bilder och lager. Lagret räknas ned automatiskt när en order läggs med frakt.' },
  { target: '.admin-desktop-nav a[href="/admin/content"]', title: 'Innehåll', body: 'Texter och bilder på webbplatsen. Snabbast är att öppna webbshoppen och klicka på "Redigera sida".' },
  { target: '.admin-desktop-nav a[href="/admin/campaigns"]', title: 'Kampanjer', body: 'Rabattkoder som kunderna kan använda i kassan, med giltighetstid och max antal användningar.' },
  { target: '.admin-desktop-nav a[href="/admin/staff"]', title: 'Team', body: 'Lägg till säljare och administratörer. Varje ny person får ett eget startlösenord som visas en gång.' },
  { target: '.admin-desktop-nav a[href="/crm/dashboard"]', title: 'CRM', body: 'Säljverktyget: pipeline med affärer, kundkort, lägga order hos kunden (från bilen eller med frakt), offerter och kalender.' },
  { target: '[data-tour="bell"]', title: 'Nya ordrar', body: 'Klockan lyser och räknar upp när en ny order kommer in. Förfrågningar från webben visas som en notis.' },
  { target: '[data-tour="webshop"]', title: 'Webbshoppen', body: 'Öppnar webbshoppen inloggad. Där kan du redigera texter och bilder direkt på sidan.' },
  { target: '[data-tour="help"]', title: 'Klart!', body: 'Frågetecknet startar guiden igen när du vill.' },
]

export const CRM_GUIDE: GuideStep[] = [
  { title: 'Välkommen till ProLuxShine CRM', body: 'En snabb rundtur på en minut. Du kan alltid starta den igen med frågetecknet uppe till höger.' },
  { target: '.crm-desktop-nav a[href="/crm/dashboard"]', title: 'Översikt', body: 'Din budget för månaden, dina affärer, påminnelser och kalender. Ordrar som tilldelas dig dyker upp som en notis.' },
  { target: '.crm-desktop-nav a[href="/crm/pipeline"]', title: 'Pipeline', body: 'Dina affärer från Prospekt till Vunnen. Dra korten mellan kolumnerna. Förfrågningar från webbplatsen hamnar här, märkta "Från webben".' },
  { target: '.crm-desktop-nav a[href="/crm/customers"]', title: 'Kunder', body: 'Kundkort med historik, anteckningar och påminnelser. Härifrån kan du mejla offert eller starta en order för kunden.' },
  { target: '.crm-desktop-nav a[href="/crm/orders"]', title: 'Ordrar', body: 'Lägg order hos kunden. Välj per rad om varan lämnas från bilen eller skickas med frakt. Spara som utkast, mejla en offert eller lägg ordern direkt.' },
  { target: '.crm-desktop-nav a[href="/crm/calendar"]', title: 'Kalender', body: 'Möten, samtal och påminnelser. Klicka på en aktivitet för att ändra den.' },
  { target: '.crm-desktop-nav a[href="/crm/notes"]', title: 'Anteckningar', body: 'Snabba anteckningar om kunder och affärer.' },
  { target: '[data-tour="webshop"]', title: 'Webbshoppen', body: 'Öppnar webbshoppen om du vill visa kunden sortimentet.' },
  { target: '[data-tour="help"]', title: 'Klart!', body: 'Frågetecknet startar guiden igen när du vill.' },
]
