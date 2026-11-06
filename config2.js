/* SPP runtime configuration. Set API_BASE_URL to your backend origin.
   The admin/API health indicator turns green only when API_HEALTH_PATH returns
   HTTP 2xx and JSON {\"status\":\"ok\"} (or {\"healthy\":true}).
   Do not put API secrets or private tokens in this frontend file. */
window.SPP_CONFIG = Object.freeze({
  API_BASE_URL: '',             // Blank = same-origin API. Use a full URL only when the API is hosted separately.
  API_HEALTH_PATH: '/api/health',
  ADMIN_NAME: 'Engr. Deevinite Ohimaime',
  ADMIN_ROLE: 'Administrator',
  HEALTH_CHECK_INTERVAL_MS: 30000
});

