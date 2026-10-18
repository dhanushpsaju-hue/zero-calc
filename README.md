# ZeroCalc – Advanced Scientific Calculator

Stack: HTML5, CSS3, JavaScript, Node.js, Express.js, MongoDB Atlas, JWT, bcrypt.
Deploy: Render (backend) and Vercel (frontend). Version control: GitHub.

## Folder layout
backend/   Express REST API (routes -> auth middleware -> models)
frontend/  index.html, style.css, script.js (no build step)

## Run locally
1. Create a free MongoDB Atlas cluster. Copy its connection string.
   In Atlas, add your IP under Network Access and create a database user.
2. Backend:
   cd backend
   npm install
   copy .env.example to .env (Mac/Linux: cp .env.example .env), then fill in MONGO_URI and JWT_SECRET
   npm run dev
   Check http://localhost:5000/api/health shows {"ok":true}
3. Frontend: open frontend/ in VS Code and click "Go Live" (Live Server extension).
   Set CLIENT_URL in .env to the address Live Server shows (for example http://127.0.0.1:5500).

## API
POST /api/auth/signup | /login | /guest      GET /api/auth/me
GET/POST /api/history   DELETE /api/history/:id   DELETE /api/history   (registered users only)
GET /api/currency       (server caches provider rates for 1 hour)

## Deploy
Backend on Render: New Web Service from your GitHub repo, root directory "backend",
build command "npm install", start command "npm start".
Add env vars MONGO_URI, JWT_SECRET, CLIENT_URL (your Vercel URL).
Frontend on Vercel: import the repo, set root directory to "frontend", framework "Other".
Then edit the API constant at the top of frontend/script.js to your Render URL.
