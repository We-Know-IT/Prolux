import { ShieldCheck, FlaskConical, Zap, Trophy, Droplets, Leaf, Sparkles, Truck, Award, Car, Armchair, Wrench, Gem, Phone, Star, Package, type LucideIcon } from 'lucide-react'

// Icons for content edited in admin: the trust strip, the "Varför välja
// ProLux Shine?" cards and the guides. Stored as the key (e.g. 'shield').
export const FEATURE_ICONS: Record<string, { label: string; Icon: LucideIcon }> = {
  shield:   { label: 'Sköld',       Icon: ShieldCheck },
  flask:    { label: 'Kolv',        Icon: FlaskConical },
  zap:      { label: 'Blixt',       Icon: Zap },
  trophy:   { label: 'Pokal',       Icon: Trophy },
  droplets: { label: 'Droppar',     Icon: Droplets },
  leaf:     { label: 'Löv',         Icon: Leaf },
  sparkles: { label: 'Glans',       Icon: Sparkles },
  truck:    { label: 'Leverans',    Icon: Truck },
  award:    { label: 'Utmärkelse',  Icon: Award },
  car:      { label: 'Bil',         Icon: Car },
  armchair: { label: 'Interiör',    Icon: Armchair },
  wrench:   { label: 'Verktyg',     Icon: Wrench },
  gem:      { label: 'Ädelsten',    Icon: Gem },
  package:  { label: 'Paket',       Icon: Package },
  star:     { label: 'Stjärna',     Icon: Star },
  phone:    { label: 'Telefon',     Icon: Phone },
}

// Content saved before icons replaced emojis still maps to an icon.
const LEGACY: Record<string, string> = {
  '🛡️': 'shield', '🛡': 'shield', '⚗️': 'flask', '⚗': 'flask', '⚡': 'zap', '🏆': 'trophy',
  '🚗': 'car', '✨': 'sparkles', '🪑': 'armchair', '🔩': 'wrench', '🪣': 'droplets', '💎': 'gem',
}

export function featureIconKey(key: string | null | undefined): string | undefined {
  return key ? (FEATURE_ICONS[key] ? key : LEGACY[key.trim()]) : undefined
}

export function featureIcon(key: string | null | undefined): LucideIcon {
  const k = featureIconKey(key)
  return (k && FEATURE_ICONS[k]?.Icon) || Sparkles
}
