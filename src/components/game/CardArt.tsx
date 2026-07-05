import type { Animal, Card, Disguise, Location } from '../../types/card'
import { LayeredCardArt } from './LayeredCardArt'

type CardArtProps = {
  animal: Animal
  disguise: Disguise
  location: Location
}

export function CardArt({ animal, disguise, location }: CardArtProps) {
  const card: Card = {
    id: `${animal}-${disguise}-${location}`,
    animal,
    disguise,
    location,
  }

  return <LayeredCardArt card={card} />
}
