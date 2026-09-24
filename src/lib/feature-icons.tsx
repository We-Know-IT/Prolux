import { ShieldCheck, FlaskConical, Zap, Trophy, Droplets, Leaf, Sparkles, Truck, Award, Car, type LucideIcon } from 'lucide-react'

// Icons the "Varför välja ProLux Shine?" cards can use (chosen in admin).
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
}

// Content saved before icons replaced emojis still maps to an icon.
const LEGACY: Record<string, string> = { '🛡️': 'shield', '🛡': 'shield', '⚗️': 'flask', '⚗': 'flask', '⚡': 'zap', '🏆': 'trophy' }

export function featureIconKey(key: string | null | undefined): string | undefined {
  return key ? (FEATURE_ICONS[key] ? key : LEGACY[key.trim()]) : undefined
}

export function featureIcon(key: string | null | undefined): LucideIcon {
  const k = featureIconKey(key)
  return (k && FEATURE_ICONS[k]?.Icon) || Sparkles
}
