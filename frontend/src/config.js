// Central API base URL — reads from VITE_API_URL env variable.
// Local dev: empty string (Vite proxy handles /api).
// Production (Vercel): set VITE_API_URL to your Render backend URL.
const API_BASE = import.meta.env.VITE_API_URL || '';

export default API_BASE;
