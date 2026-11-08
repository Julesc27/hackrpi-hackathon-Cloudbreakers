import { useGame } from '../../game/GameContext.jsx'
import { BACKPACK_RESOURCES, backpackCapacity, backpackUsed, storageDepots } from '../../game/engine.js'
import { RESOURCES } from '../../game/data.js'
import { RES_ICON } from '../icons.jsx'
import '../../styles/storage.css'

export default function Backpack() {
  const { state, dispatch, player } = useGame()
  const used = backpackUsed(state), capacity = backpackCapacity(state)
  const away = !storageDepots(state).some(depot => depot.island === player.current.avatar?.isl)
  return <>
    <div className="backpack-summary" data-tutorial="backpack-summary"><strong>{used} / {capacity} items carried</strong><span className="muted">Shared carrying space</span></div>
    <progress className="backpack-capacity" aria-label="Backpack space" max={capacity} value={used} />
    <p className="muted small">Build, upgrade and repair using carried materials first, then Town Storage. Deposit spare supplies at the workshop or a connected storage house to free backpack space.</p>
    {used >= capacity && <p className="backpack-full" role="status">Backpack full. Build with carried materials or deposit supplies to make room.</p>}
    <table className="table backpack-table"><thead><tr><th>Carried supplies</th><th>Amount</th></tr></thead><tbody>
      {BACKPACK_RESOURCES.map(key => { const Icon = RES_ICON[key]; return <tr key={key}><td><Icon size={18} /> {RESOURCES[key].label}</td><td>{state.backpack?.[key] || 0}</td></tr> })}
    </tbody></table>
    {!used && <p className="muted">Your backpack is empty. Gather supplies on an island to fill it.</p>}
    <div className="backpack-deposit"><button className="btn-gold" data-tutorial="backpack-deposit-btn" disabled={!used} onClick={() => dispatch({ type: 'DEPOSIT_BACKPACK' })}>{away ? 'Return & deposit all' : 'Deposit All'}</button>
      <p className="muted small">Your captain walks to a nearby connected storage point and unloads everything. Depositing uses no supplies and doesn’t advance the town.</p></div>
    <p className="muted small">Food, water, energy and coins go straight to town storage. Storehouses increase your town’s food, water and energy capacity.</p>
  </>
}
