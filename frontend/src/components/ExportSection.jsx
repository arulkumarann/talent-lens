import API_BASE from '../config'

export default function ExportSection({ profiles, statuses, keyword }) {
    const exportJSON = () => {
        if (profiles.length === 0) return
        const exportData = profiles.map((p) => ({
            ...p,
            talent_lens_status: statuses[p.original_data?.username] || 'selected',
        }))
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json',
        })
        downloadBlob(blob, `talentlens_${keyword || 'export'}.json`)
    }

    const exportCSV = () => {
        if (profiles.length === 0) return
        const url = keyword
            ? `${API_BASE}/api/export?format=csv&keyword=${encodeURIComponent(keyword)}`
            : `${API_BASE}/api/export?format=csv`
        window.open(url, '_blank')
    }

    const downloadBlob = (blob, filename) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className="export-section">
            <button className="export-link" onClick={exportJSON}>
                export json
            </button>
            <button className="export-link" onClick={exportCSV}>
                export csv
            </button>
        </div>
    )
}
