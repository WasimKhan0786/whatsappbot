# WhatsApp AI Automation Studio 🚀

Autonomous WhatsApp Bot powered by **Google Gemini AI**, **Baileys WebSocket Engine**, and **MongoDB Atlas**, featuring dynamic contact personas, authentic chat style cloning, and smart event scheduling.

![WhatsApp AI Studio](https://img.shields.io/badge/Gemini_AI-2.5_Flash-blue?style=for-the-badge&logo=google)
![WhatsApp Baileys](https://img.shields.io/badge/WhatsApp-Baileys_Web-25D366?style=for-the-badge&logo=whatsapp)
![React](https://img.shields.io/badge/React-Vite-61DAFB?style=for-the-badge&logo=react)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)

---

## ✨ Features

- **Direct QR Connect (No Meta Account Required)**: Seamless WhatsApp Web integration via Baileys WebSocket protocol.
- **Dynamic Contact Personas**: Automatically adapts conversation style based on relationship roles (Wife/Partner, Brother/Gym buddy, Elders/Formal, Work).
- **🧬 Chat Style Cloner & Linguistic Profiler**: Learns the user's authentic vocabulary, pet names, typing quirks (lowercase, double dots), and punctuation habits without leaking past conversation facts.
- **⏰ Smart Schedules & Event Auto-Replies**: Predefined priority replies during specific daily hours (e.g., Gym Workout 18:00–20:00, Night Sleep Mode 23:30–07:00, Birthday wishes).
- **📊 Real-time Quota & Failover Dashboard**: Live daily Gemini request limits monitor with auto-fallback to alternate models.
- **📱 100% Mobile-Friendly Dashboard**: Fully responsive dark glassmorphic UI built for smartphones, tablets, and desktop.
- **🛡️ VIP Whitelist Security**: Restricts auto-replies exclusively to whitelisted numbers.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js, `@whiskeysockets/baileys`, `@google/generative-ai`, Mongoose
- **Frontend**: React 18, Vite, Lucide Icons, Vanilla Glassmorphism CSS
- **Database**: MongoDB Atlas Cloud DB

---

## 🚀 Getting Started

### 1. Clone the repository:
```bash
git clone https://github.com/WasimKhan0786/whatsappbot.git
cd whatsappbot
```

### 2. Install dependencies:
```bash
# Install root, backend, and frontend dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### 3. Setup Environment Variables:
Create `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/whatsapp_bot?retryWrites=true&w=majority
GEMINI_API_KEY=your_google_gemini_api_key
```

### 4. Build & Run:
```bash
# Run both server & client in development:
npm run dev

# Or build client for production:
npm run build
npm start
```

---

## 🌐 24×7 Cloud Deployment (Railway)

1. Connect this repository to [Railway.app](https://railway.app).
2. In the **Variables** tab, add:
   - `PORT`: `5000`
   - `MONGODB_URI`: `<your_atlas_connection_url>`
   - `GEMINI_API_KEY`: `<your_gemini_api_key>`
   - `NODE_ENV`: `production`
3. Add a **Persistent Volume** with mount path `/app/server/auth_info_baileys`.
4. Generate a public domain and scan the QR code from your phone once!

---

## 📄 License
ISC
