import { useEffect, useState } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { useSync } from '../../game/CloudSync.jsx'
import { AVATAR_OPTIONS, normalizeAvatar, randomAvatar } from '../../game/avatar.js'
import AvatarPortrait from '../AvatarPortrait.jsx'
import { Modal } from './Panel.jsx'

// "Your Captain": choose how you appear on the map and in the HUD.
// Changes preview live and are only kept when you press Save.
//
// New accounts are sent here automatically (useCaptainOnboarding): the editor opens as a
// "Create your Captain" step that can't be dismissed, and saving uploads the town (with the
// avatar) to the account straight away. Accounts made before avatars existed get the same
// one-time step on their next login.

/** Open the Captain editor for a logged-in player who hasn't designed their Captain yet. */
export function useCaptainOnboarding() {
  const { state } = useGame()
  const ui = useUI()
  const auth = useAuth()
  const sync = useSync()
  // wait until the account's save has been loaded or uploaded, so we ask about the right town
  const ready = auth.status === 'authed' && sync && !['off', 'loading'].includes(sync.status)
  const needed = ready && !state.avatarSet && !auth.loginOpen
  useEffect(() => {
    if (needed && ui.panel !== 'captain') { ui.setPlacing?.(null); ui.setPanel('captain') }
  }, [needed, ui.panel]) // eslint-disable-line react-hooks/exhaustive-deps
}

function Choice({ label, field, draft, set, swatch = false }) {
  return (
    <fieldset className="cap-field">
      <legend>{label}</legend>
      <div className={swatch ? 'cap-swatches' : 'cap-chips'}>
        {AVATAR_OPTIONS[field].map((o) => {
          const on = draft[field] === o.id
          return swatch ? (
            <button key={o.id} type="button" className={`cap-swatch${on ? ' is-on' : ''}`} style={{ background: o.id }}
              aria-pressed={on} aria-label={`${label}: ${o.label}`} title={o.label} onClick={() => set(field, o.id)} />
          ) : (
            <button key={o.id} type="button" className={`cap-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => set(field, o.id)}>
              {o.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function CaptainModal() {
  const { state, dispatch } = useGame()
  const ui = useUI()
  const auth = useAuth()
  // first time for a logged-in player: a welcome step that ends by saving
  const [welcome] = useState(() => auth.status === 'authed' && !state.avatarSet)
  const [draft, setDraft] = useState(() => normalizeAvatar(state.avatar))
  const set = (field, value) => setDraft((d) => normalizeAvatar({ ...d, [field]: value }))
  const close = () => ui.setPanel(null)
  const save = () => { dispatch({ type: 'SET_AVATAR', avatar: draft }); close() }

  return (
    <Modal
      title={welcome ? 'Create your Captain' : 'Your Captain'}
      kicker={welcome ? `Welcome aboard${auth.player?.username ? `, ${auth.player.username}` : ''}!` : 'How you appear in the sky'}
      onClose={close}
      dismissable={!welcome}
      size="lg"
      className="captain-modal"
      footer={
        <div className="row-btns cap-foot">
          <button type="button" className="btn-ghost" onClick={() => setDraft(randomAvatar())}>Surprise me</button>
          <button type="button" className="btn-gold" onClick={save}>{welcome ? 'Set sail' : 'Save Captain'}</button>
        </div>
      }
    >
      {welcome && <p className="cap-welcome">Your Captain is saved to your account, so they’ll be waiting on any device you log in from. You can change their look any time from the Captain button.</p>}
      <div className="captain-editor">
        <div className="cap-preview" data-tutorial="captain-preview">
          <AvatarPortrait avatar={draft} mode="full" animate size={150} label="Preview of your Captain" />
          <p className="cap-note">This is the Captain you walk around the islands with.</p>
        </div>
        <div className="cap-options">
          <Choice label="Body" field="body" draft={draft} set={set} />
          <Choice label="Skin tone" field="skin" draft={draft} set={set} swatch />
          <Choice label="Eyes" field="eyes" draft={draft} set={set} />
          <Choice label="Eye colour" field="eyeColor" draft={draft} set={set} swatch />
          <Choice label="Hair style" field="hairStyle" draft={draft} set={set} />
          <Choice label="Hair colour" field="hair" draft={draft} set={set} swatch />
          {draft.body === 'man' && <Choice label="Beard" field="beard" draft={draft} set={set} />}
          <Choice label="Outfit" field="outfit" draft={draft} set={set} />
          <Choice label="Outfit colour" field="top" draft={draft} set={set} swatch />
          <Choice label={draft.outfit === 'dress' ? 'Leggings colour' : 'Trousers colour'} field="bottom" draft={draft} set={set} swatch />
          <Choice label="Hat" field="hat" draft={draft} set={set} />
        </div>
      </div>
    </Modal>
  )
}
