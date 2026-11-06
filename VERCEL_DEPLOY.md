# Deployment note

This project is now configured for a Node.js-only runtime. Use a host that runs a persistent Node.js process and supports MySQL connectivity and writable media storage, or separately adapt the API to serverless functions. Set all required environment variables in the hosting dashboard. A static-only host cannot provide database login, payments, file uploads, or publishing on its own.
