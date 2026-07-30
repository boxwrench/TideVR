export type AbilityId = 'swell' | 'current' | 'vortex'

export interface WaterAbility {
  readonly id: AbilityId
  readonly name: string
  readonly key: string
  readonly color: string
  readonly castingStyle: string
  readonly waterEffect: string
  readonly movementUse: string
  readonly radius: number
}
export const WATER_ABILITIES = [
  {
    id: 'swell',
    name: 'Swell',
    key: '1',
    color: '#73e6ff',
    castingStyle: 'Hold to charge, release',
    waterEffect: 'Traveling wave',
    movementUse: 'Surf, climb, jump',
    radius: 4.5,
  },
  {
    id: 'current',
    name: 'Current',
    key: '2',
    color: '#58ffc8',
    castingStyle: 'Hold and paint',
    waterEffect: 'Directional flow ribbon',
    movementUse: 'Accelerate, redirect',
    radius: 2.6,
  },
  {
    id: 'vortex',
    name: 'Vortex',
    key: '3',
    color: '#c48cff',
    castingStyle: 'Aim and tap',
    waterEffect: 'Rotating depression',
    movementUse: 'Turn, pull, slingshot',
    radius: 6,
  },
] as const satisfies ReadonlyArray<WaterAbility>

export function findAbility(id: AbilityId): WaterAbility {
  const ability = WATER_ABILITIES.find((candidate) => candidate.id === id)
  if (ability === undefined) {
    throw new Error(`Unknown water ability: ${id}`)
  }
  return ability
}
