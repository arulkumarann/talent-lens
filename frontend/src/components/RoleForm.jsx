import { useState, useEffect } from 'react'

export default function RoleForm({ onClose, onCreated, editRole }) {
    const [name, setName] = useState(editRole?.name || '')
    const [jd, setJd] = useState(editRole?.jd || '')
    const [ctc, setCtc] = useState(editRole?.ctc || '')
    const [positions, setPositions] = useState(editRole?.positions || 1)
    const [tallyLink, setTallyLink] = useState(editRole?.tally_link || '')
    const [tallyFormId, setTallyFormId] = useState(editRole?.tally_form_id || '')
    const [sheetUrl, setSheetUrl] = useState(editRole?.sheet_url || '')
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        setSubmitting(true)

        try {
            const res = await fetch('/api/devs/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    jd: jd.trim(),
                    ctc: ctc.trim(),
                    positions: parseInt(positions) || 1,
                    tally_link: tallyLink.trim(),
                    tally_form_id: tallyFormId.trim(),
                    sheet_url: sheetUrl.trim(),
                }),
            })
            const data = await res.json()
            if (data.id) {
                onCreated?.(data)
                onClose()
            }
        } catch (err) {
            console.error('Error creating role:', err)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="role-modal-overlay" onClick={onClose}>
            <div className="role-modal" onClick={(e) => e.stopPropagation()}>
                <div className="role-modal-header">
                    <h2>Add Role</h2>
                    <button className="role-modal-close" onClick={onClose}>×</button>
                </div>

                <form className="role-form" onSubmit={handleSubmit}>
                    <div className="role-field">
                        <label>Role Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Frontend Developer"
                            required
                        />
                    </div>

                    <div className="role-field">
                        <label>Job Description</label>
                        <textarea
                            value={jd}
                            onChange={(e) => setJd(e.target.value)}
                            placeholder="Describe the role requirements, responsibilities, tech stack..."
                            rows={4}
                        />
                    </div>

                    <div className="role-field-row">
                        <div className="role-field">
                            <label>CTC / Salary Range</label>
                            <input
                                type="text"
                                value={ctc}
                                onChange={(e) => setCtc(e.target.value)}
                                placeholder="e.g. 8-12 LPA"
                            />
                        </div>
                        <div className="role-field">
                            <label>Positions *</label>
                            <input
                                type="number"
                                min={1}
                                value={positions}
                                onChange={(e) => setPositions(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="role-field">
                        <label>Tally Form Link</label>
                        <input
                            type="text"
                            value={tallyLink}
                            onChange={(e) => setTallyLink(e.target.value)}
                            placeholder="https://tally.so/r/..."
                        />
                    </div>

                    <div className="role-field">
                        <label>Tally Form ID (for webhook matching)</label>
                        <input
                            type="text"
                            value={tallyFormId}
                            onChange={(e) => setTallyFormId(e.target.value)}
                            placeholder="e.g. VL0xey"
                        />
                    </div>

                    <div className="role-field">
                        <label>Google Sheet CSV URL (optional)</label>
                        <input
                            type="text"
                            value={sheetUrl}
                            onChange={(e) => setSheetUrl(e.target.value)}
                            placeholder="https://docs.google.com/spreadsheets/.../export?format=csv"
                        />
                    </div>

                    <button type="submit" className="role-submit-btn" disabled={submitting}>
                        {submitting ? 'Creating...' : 'Create Role'}
                    </button>
                </form>
            </div>
        </div>
    )
}
