# ChatApp

A real-time WhatsApp-style chat app with 1-on-1 messaging, group chats, media sharing, and voice/video calls.

## Stack
- **Backend** — Node.js, Express, Socket.IO, MongoDB Atlas, Cloudinary
- **Frontend** — React 18, Socket.IO client, WebRTC
- **Deploy** — Vercel (backend + frontend), MongoDB Atlas (database)

## Local Setup

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/chatapp.git
cd chatapp
```

### 2. Backend setup
```bash
cd backend
npm install
cp .env.example .env
# Fill in your .env values (MongoDB Atlas, JWT, Cloudinary)
npm run dev
```

### 3. Frontend setup
```bash
cd frontend
npm install
cp .env.example .env
# Set REACT_APP_API_URL=http://localhost:5000
npm start
```

## Deploy

See `DEPLOY.md` for full Vercel + MongoDB Atlas deployment guide.