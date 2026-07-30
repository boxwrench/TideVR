import {
  WATER_ABILITIES,
  type WaterAbility,
} from '../game/abilities'

interface AbilityBarProps {
  readonly activeAbility: WaterAbility
  readonly onSelectAbility: (ability: WaterAbility) => void
}
export function AbilityBar({
  activeAbility,
  onSelectAbility,
}: AbilityBarProps) {
  return (
    <div className="ability-bar overlay-panel" role="toolbar" aria-label="Water abilities">
      {WATER_ABILITIES.map((ability) => {
        const active = ability.id === activeAbility.id
        return (
          <button
            key={ability.id}
            type="button"
            className={`ability-button${active ? ' active' : ''}`}
            style={{
              '--ability-color': ability.color,
            } as React.CSSProperties}
            onClick={() => onSelectAbility(ability)}
            aria-pressed={active}
          >
            <span className="ability-key">{ability.key}</span>
            <span className="ability-copy">
              <strong>{ability.name}</strong>
              <small>{ability.castingStyle}</small>
            </span>
          </button>
        )
      })}
    </div>
  )
}
