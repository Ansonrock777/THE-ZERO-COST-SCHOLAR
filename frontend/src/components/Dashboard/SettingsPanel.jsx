import { X } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function SettingsPanel({ open, settings, onChange, onClose }) {
  if (!open) return null
  return <div className='modal-backdrop' role='presentation' onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className='settings-panel' role='dialog' aria-modal='true' aria-labelledby='settings-title'>
      <header><div><span className='workspace-kicker'>Preferences</span><h2 id='settings-title'>Reader settings</h2></div><button className='icon-button' aria-label='Close settings' onClick={onClose}><X size={17} /></button></header>
      <label>Citation placement<select value={settings.citationPlacement} onChange={event => onChange({ ...settings, citationPlacement: event.target.value })}><option value='inline'>Inline markers</option><option value='footnotes'>Footnotes</option></select></label>
      <label>Answer style<select value={settings.answerStyle || 'balanced'} onChange={event => onChange({ ...settings, answerStyle: event.target.value })}><option value='concise'>Concise</option><option value='balanced'>Balanced</option><option value='academic'>Academic</option></select></label>
      <p>Retrieval always uses hybrid semantic + BM25 search. Advanced tuning remains visible in the developer dashboard.</p>
      <Link to='/developer' onClick={onClose}>Open developer dashboard</Link>
    </section>
  </div>
}
