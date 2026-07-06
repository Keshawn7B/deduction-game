export type Animal =
  | 'Fox'
  | 'Dog'
  | 'Cat'
  | 'Bear'
  | 'Rabbit'
  | 'Penguin'
  | 'Lizard'
  | 'Owl'

export type Accessory =
  | 'Pirate'
  | 'Wizard'
  | 'Detective'
  | 'Crown'
  | 'Goggles'
  | 'Flowers'
  | 'Shades'
  | 'Explorer'
export type Disguise = Accessory

export type Location =
  | 'Beach'
  | 'Moon'
  | 'Castle'
  | 'Forest'
  | 'Museum'
  | 'Kitchen'
  | 'Volcano'
  | 'Library'

export type Card = {
  id: string
  animal: Animal
  disguise: Disguise
  location: Location
}

export type Guess = {
  animal: Animal
  disguise: Disguise
  location: Location
}

export type ClueResult = 'YES' | 'NO'

export type CardSetSize = 4 | 6 | 8
