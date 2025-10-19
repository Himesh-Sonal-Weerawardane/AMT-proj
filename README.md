# AMT-proj
Assignment Moderation Tool for IT Project Created on 8th August 2025.

This is a web-based moderation and marking system for Admins and Markers, built with HTML, CSS, JavaScript, Node.js/Express, and Supabase.
This website allows admins to upload assignments and rubrics, manage marking workflows, and track marker progress. Markers can submit marks and receive feedback through the system.

## Folder Structure:
- frontend/         # Client-side HTML, CSS, JS
  -   index.html    # Login page
  -   /admin        # Admin pages
  -   /marker       # Marker pages
  -   /login-pages  # Login pages other than index.html (Forgot and Reset Password Pages)
  -   /css          # Styles
  -   /images       # Icons
  -   /js           # Frontend scripts
- server.js         # Backend entry point
- /routes/          # API routes
- package.json      # To specify which node.js/Express files to set up (For deployment)
- package-lock.json # To specify which node.js/Express files to set up (For deployment)
- .env              # Environment variables (not committed)
- /node_modules     # Node.js/Express modules (not committed)
- .gitignore        # Ignored files

## Prerequisites:
- Node.js
- Git
- Supabase account for database and auth
- Optional: VSCode extensions for HTML/CSS/JS

## Setup Instructions:
- Clone the repo.
  - $ git clone https://github.com/yourusername/AMT-proj.git
  - $ cd AMT-proj
- Install dependencies (more information on the confluence webpage).
- Set up .env with Supabase credentials.
- Run locally: $ npm start
- Open localhost:3000 in a browser.

Note: Detailed documentation is available on Confluence.