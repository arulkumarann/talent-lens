export default function ExportSection({ profiles, statuses }) {
    const exportJSON = () => {
        if (profiles.length === 0) return
        const exportData = profiles.map((p) => ({
            ...p,
            talent_lens_status: statuses[p.original_data?.username] || 'selected',
        }))
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json',
        })
        downloadBlob(blob, 'talentlens_export.json')
    }

    const exportCSV = () => {
        if (profiles.length === 0) return
        window.open('/api/export?format=csv', '_blank')
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
