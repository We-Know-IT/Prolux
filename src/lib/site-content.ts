import { createClient } from '@/lib/supabase/client'

// All editable marketing-site content lives in one Supabase table,
// `site_content` (id text primary key, data jsonb). Each id below is one
// row. Admin edits it under /admin/content/*, and the public pages read
// it — falling back to the DEFAULT_* constants (today's hardcoded
// copy) whenever a row hasn't been saved yet, so nothing breaks before
// the first edit.

export interface HeroSlide {
  image_url: string
  label: string
  heading: string
  sub: string
}
export interface CategoryCard {
  name: string
  img: string
}
export interface WhyFeature {
  icon: string
  title: string
  desc: string
}
export interface ProCenterContent {
  eyebrow: string
  heading: string
  sub: string
  bullets: string[]
  ctaLabel: string
  badge: string
}
export interface BrandStoryContent {
  eyebrow: string
  heading: string
  paragraphs: string[]
  brand1: string
  brand2: string
}
export interface WhyContent {
  heading: string
  features: WhyFeature[]
}
export interface HomeContent {
  hero: HeroSlide[]
  categories: CategoryCard[]
  proCenter: ProCenterContent
  brandStory: BrandStoryContent
  why: WhyContent
  trust?: TrustItem[]   // missing in content saved before the strip was editable
}

// The promises shown in the bar under the menu and the strip under the hero.
export interface TrustItem { icon: string; title: string; sub: string }

export const DEFAULT_TRUST: TrustItem[] = [
  { icon: 'truck',   title: '1–2 dagars leverans',     sub: 'Snabb och säker frakt' },
  { icon: 'package', title: 'Fri frakt över 2 000 kr', sub: 'Till valfritt ombud' },
  { icon: 'star',    title: 'Professionell kvalitet',  sub: 'Virtus & Frescura' },
  { icon: 'phone',   title: 'Personlig säljare',       sub: 'Telefon & mail mån–fre' },
]

export const DEFAULT_HOME: HomeContent = {
  hero: [
    { image_url: 'https://fopshubqliboxgokbhnr.supabase.co/storage/v1/object/public/hero-images/hero-1.png', label: 'Kvalitetsgaranti från Italien', heading: 'Prolux Shine', sub: 'Premiumleverantör av italienska bilvårdsprodukter — skapade för proffs och entusiaster.' },
    { image_url: 'https://fopshubqliboxgokbhnr.supabase.co/storage/v1/object/public/hero-images/hero-2.png', label: 'Professionell bilvård', heading: 'Rätt teknik.\nRätt produkter.', sub: 'Komplett sortiment för handtvätt, maskinpolering och lackskydd.' },
    { image_url: 'https://fopshubqliboxgokbhnr.supabase.co/storage/v1/object/public/hero-images/hero-3.png', label: 'Fälg & Exteriör', heading: 'Rena fälgar.\nKlara resultat.', sub: 'Starka rengöringsmedel formulerade för professionella biltvättar och detailingföretag.' },
  ],
  categories: [
    { name: 'Exteriör',       img: 'https://fopshubqliboxgokbhnr.supabase.co/storage/v1/object/public/category-images/category-exterior.png' },
    { name: 'Interiör',       img: 'https://fopshubqliboxgokbhnr.supabase.co/storage/v1/object/public/category-images/category-interior.png' },
    { name: 'Polering',       img: 'https://fopshubqliboxgokbhnr.supabase.co/storage/v1/object/public/category-images/category-polering.png' },
    { name: 'Högtryckstvätt', img: 'https://fopshubqliboxgokbhnr.supabase.co/storage/v1/object/public/category-images/category-hoftryckstvatt.png' },
    { name: 'Torkdukar',      img: 'https://fopshubqliboxgokbhnr.supabase.co/storage/v1/object/public/category-images/category-torkdukar.png' },
    { name: 'Tillbehör',      img: 'https://fopshubqliboxgokbhnr.supabase.co/storage/v1/object/public/category-images/category-tillbehor.png' },
    { name: 'Paket',          img: 'https://fopshubqliboxgokbhnr.supabase.co/storage/v1/object/public/category-images/category-paket.png' },
    { name: 'Hemstäd',        img: 'https://fopshubqliboxgokbhnr.supabase.co/storage/v1/object/public/category-images/category-hemstad.png' },
  ],
  proCenter: {
    eyebrow: 'B2B Portal',
    heading: 'Pro Center – för företag & proffs',
    sub: 'Vi erbjuder förmånliga priser, snabba leveranser och personlig service för verkstäder, bilvårdare och återförsäljare.',
    bullets: ['Förmånliga villkor', 'Snabba leveranser', 'Dedikerad support', 'Prov & testprodukter'],
    ctaLabel: 'Bli företagskund',
    badge: 'ProLuxShine',
  },
  brandStory: {
    eyebrow: 'Exklusiva agenturer',
    heading: 'Italiensk passion & precision i varje droppe',
    paragraphs: [
      'ProLux Shine är stor distributör av de anrika varumärkena Virtus och Frescura. Frescura har i över 50 år lett utvecklingen av biologiskt nedbrytbara, pH-balanserade rengöringssystem för fordon över hela Europa.',
      'Tillsammans med Virtus avancerade polermedel och lackskydd erbjuder vi ett komplett system som tillgodoser bilvårdsförens extremaste krav på prestanda och finish.',
    ],
    brand1: 'FRESCURA',
    brand2: 'VIRTUS PRO',
  },
  why: {
    heading: 'Varför välja ProLux Shine?',
    features: [
      { icon: 'shield', title: 'Säker för alla ytor',   desc: 'Sammansättningarna ger extremt effektiva formuleringar utformade för att ge utmärkt skydd mot känsliga material.' },
      { icon: 'flask', title: 'pH-balanserat',          desc: 'Perfekt komponerat pH-värden som inte skadar lackytan, även vid hög koncentration.' },
      { icon: 'zap', title: 'Effektiv avfettning',     desc: 'Våra lättlösliga enskilda och kalklettnings löser på föroreningsrester med överväldigande kraft.' },
      { icon: 'trophy', title: 'Högsta kvalitet',         desc: 'Formulerat och tillverkat i Italien av ledande kemister med högsta certifieringar.' },
    ],
  },
}

export const TAG_COLORS: Record<string, string> = {
  Nybörjare:  '#4CAF7D',
  Mellansteg: '#E8B84B',
  Avancerad:  '#4A8FD4',
  Tips:       '#9BA0AB',
}

export interface GuideItem {
  id: string
  title: string
  category: string
  desc: string
  emoji: string   // icon key, see lib/feature-icons (named emoji for older content)
  readTime: string
  tag: string
}
export interface GuidesContent {
  items: GuideItem[]
}

export const DEFAULT_GUIDES: GuidesContent = {
  items: [
    { id: '1', title: 'Så tvättar du bilen på rätt sätt',            category: 'Tvätt',      desc: 'Lär dig grunderna i biltvätt – rätt teknik, rätt produkter och i rätt ordning. Undvik swirl-märken och skydda lacken.',                     emoji: 'car', readTime: '5 min',  tag: 'Nybörjare' },
    { id: '2', title: 'Polering – välj rätt pad och polermedel',     category: 'Polering',   desc: 'En komplett guide till maskinpolering. Vi går igenom skillnaderna mellan cutting, polishing och finishing pads.',                             emoji: 'sparkles', readTime: '8 min',  tag: 'Avancerad' },
    { id: '3', title: 'Interiörrengöring som gör skillnad',          category: 'Interiör',   desc: 'Steg för steg: hur du rengör instrumentbräda, knappar, säten och mattor till showroom-standard.',                                            emoji: 'armchair', readTime: '6 min',  tag: 'Nybörjare' },
    { id: '4', title: 'Lackskydd – så håller det längre',            category: 'Lackskydd',  desc: 'Vax, sealant eller keramiskt skydd? Vi förklarar skillnaderna och hjälper dig välja rätt för din situation.',                                emoji: 'shield', readTime: '7 min',  tag: 'Mellansteg' },
    { id: '5', title: 'Fälgrengöring utan att skada lacken',         category: 'Fälgar',     desc: 'Bromsdamm och smuts sätter sig hårt på fälgar. Lär dig rätt teknik och produkter för att tvätta säkert.',                                    emoji: 'wrench', readTime: '4 min',  tag: 'Nybörjare' },
    { id: '6', title: 'Avfettning innan polering',                   category: 'Polering',   desc: 'Varför du alltid måste avfetta lacken ordentligt innan du polerar – och vilka produkter vi rekommenderar.',                                  emoji: 'flask', readTime: '3 min',  tag: 'Tips' },
    { id: '7', title: 'Tvåhinkmetoden – minska risken för repor',    category: 'Tvätt',      desc: 'Tvåhinkmetoden är standard hos proffs. Så här fungerar det och varför du bör börja använda den direkt.',                                    emoji: 'droplets', readTime: '4 min',  tag: 'Tips' },
    { id: '8', title: 'Keramiskt lackskydd – komplett guide',        category: 'Lackskydd',  desc: 'Allt du behöver veta om keramiska beläggningar: förberedelse, applicering, härdning och skötsel.',                                          emoji: 'gem', readTime: '12 min', tag: 'Avancerad' },
  ],
}

export interface BrandBlock {
  name: string
  tagline: string
  desc: string
  items: string[]
  img: string
}
export interface OmOssContent {
  hero: { label: string; heading: string; sub: string }
  historia: { heading: string; paragraphs: string[]; punkter: string[] }
  stats: { value: string; label: string; sub: string }[]
  brands: BrandBlock[]
  cta: { heading: string; sub: string }
}

export const DEFAULT_OM_OSS: OmOssContent = {
  hero: {
    label: 'Om oss',
    heading: 'Professionell bilvård,\ndirekt från källan',
    sub: 'ProLuxShine är Sveriges exklusiva importör av Virtus och Frescura — två av Italiens ledande varumärken för professionell bilvård.',
  },
  historia: {
    heading: 'Grundat av proffs,\nför proffs',
    paragraphs: [
      'ProLuxShine grundades med en enkel idé: att ge svenska bilverkstäder, bilvårdare och detailers tillgång till samma produkter som proffsen i Europa använder.',
      'Genom exklusiva avtal med Virtus och Frescura kan vi erbjuda produkter av högsta kvalitet till konkurrenskraftiga B2B-priser — med personlig service och snabba leveranser som standard.',
    ],
    punkter: [
      'Exklusiv importör av Virtus & Frescura i Sverige',
      'Personlig säljare för varje kund',
      'Prislista A, B eller C — anpassat för din volym',
      '1–2 dagars leveranstid på hela sortimentet',
    ],
  },
  stats: [
    { value: '240+', label: 'Aktiva B2B-kunder', sub: 'i Sverige och Norden' },
    { value: '50+',  label: 'Produkter',         sub: 'från Virtus & Frescura' },
    { value: '2',    label: 'Varumärken',         sub: 'Italiens bästa' },
    { value: '40%',  label: 'Max B2B-rabatt',     sub: 'för A-kunder' },
  ],
  brands: [
    {
      name: 'Virtus',
      tagline: 'Precision utan kompromiss',
      desc: 'Virtus representerar det absolut bästa inom professionell bilvård — keramiska beläggningar, enzymrengöring och detailingprodukter för de som kräver perfektion i varje detalj.',
      items: ['Keramisk coating', 'Enzymbaserade tvättmedel', 'Professionella polish & kompositioner', 'Lackskydd & glansmedel'],
      img: 'https://proluxshine.com/wp-content/uploads/2025/11/df6ba40f-5d3d-4c32-8cfd-55f9c68de3e7.png',
    },
    {
      name: 'Frescura',
      tagline: 'Effektivitet i varje droppe',
      desc: 'Frescura är valet för de som jobbar med höga volymer och kräver konsekvent professionell kvalitet dag efter dag. Kostnadseffektiva lösningar utan att kompromissa med resultatet.',
      items: ['Alkaliska avfettningsmedel', 'pH-neutrala bilvårdsprodukter', 'Fälg- och däckvård', 'Interiör- & exteriörrengöring'],
      img: 'https://proluxshine.com/wp-content/uploads/2025/11/a7ffd562-2bb4-4699-aaeb-ce4da03ba0ac.png',
    },
  ],
  cta: {
    heading: 'Redo att komma igång?',
    sub: 'Logga in på din portal eller kontakta oss för att diskutera ett B2B-avtal.',
  },
}

export interface ContactContent {
  phone: string
  email: string
  address: string
  hours: string
}

export const DEFAULT_CONTACT: ContactContent = {
  phone: '+46 (0)8 123 456 78',
  email: 'info@proluxshine.com',
  address: 'Stockholm, Sverige',
  hours: 'Mån–fre 08–17',
}

export async function getSiteContent<T>(id: string, fallback: T): Promise<T> {
  const supabase = createClient()
  const { data } = await supabase.from('site_content').select('data').eq('id', id).maybeSingle()
  return data?.data ?? fallback
}

export async function saveSiteContent(id: string, data: unknown) {
  const supabase = createClient()
  return supabase.from('site_content').upsert({ id, data, updated_at: new Date().toISOString() })
}
