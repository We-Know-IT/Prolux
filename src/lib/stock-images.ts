// Free photos from Pexels (pexels.com/license: free for commercial use, no
// attribution needed), used until ProLux uploads its own pictures in
// "Redigera sida". Each one can be replaced there.
const pexels = (id: number, w = 1200) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`

export const STOCK = {
  foamBlackCar: pexels(6873191, 1600),    // black car covered in foam, indoor wash
  cleanBlackCar: pexels(6872163, 1600),   // clean black car in a studio
  spongeFoam: pexels(6873088),            // hand washing with sponge and foam
  polishBlack: pexels(5233259),           // machine polishing a black bonnet
  polishRed: pexels(5233262),             // polishing red paint
  interiorSeat: pexels(5233285),          // vacuuming a car seat
  glossDroplets: pexels(6873177),         // water beading on glossy paint
  wheelFoam: pexels(5693651),             // wheel covered in foam
}

// A picture for a guide card by its category (when the guide has none of its own).
export function guideStockImage(category: string): string {
  const c = category.toLowerCase()
  if (/interi/.test(c)) return STOCK.interiorSeat
  if (/f[äa]lg|d[äa]ck/.test(c)) return STOCK.wheelFoam
  if (/skydd|coat|vax/.test(c)) return STOCK.glossDroplets
  if (/poler|avfett/.test(c)) return STOCK.polishBlack
  return STOCK.spongeFoam
}
