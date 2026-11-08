import { useState } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { AVATAR_OPTIONS, normalizeAvatar, randomAvatar } from '../../game/avatar.js'
import AvatarPortrait from '../AvatarPortrait.jsx'
import { Modal } from './Panel.jsx'

// "Your Captain": choose how you appear on the map and in the HUD.
// Changes preview live and are only kept when you press Save.

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
  const [draft, setDraft] = useState(() => normalizeAvatar(state.avatar))
  const set = (field, value) => setDraft((d) => normalizeAvatar({ ...d, [field]: value }))
  const close = () => ui.setPanel(null)
  const save = () => { dispatch({ type: 'SET_AVATAR', avatar: draft }); close() }

  return (
    <Modal
      title="Your Captain"
      kicker="How you appear in the sky"
      onClose={close}
      size="lg"
      className="captain-modal"
      footer={
        <div className="row-btns cap-foot">
          <button type="button" className="btn-ghost" onClick={() => setDraft(randomAvatar())}>Surprise me</button>
          <button type="button" className="btn-gold" onClick={save}>Save Captain</button>
        </div>
      }
    >
      <div className="captain-editor">
        <div className="cap-preview">
          <AvatarPortrait avatar={draft} mode="full" animate size={150} label="Preview of your Captain" />
          <p className="cap-note">This is the Captain you walk around the islands with.</p>
        </div>
        <div className="cap-options">
          <Choice label="Body" field="body" draft={draft} set={set} />
          <Choice label="Skin tone" field="skin" draft={draft} set={set} swatch />
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
