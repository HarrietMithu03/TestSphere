# TestSphere

> **Real-Time Application Testing & Intelligent Bug Reporting Platform**

TestSphere is a full-stack platform that empowers development teams and QA testers to collaborate on testing campaigns. Developers create campaigns, generate invitation codes, and define structured test suites; testers join campaigns, record test case executions with pass/fail/blocked outcomes, and submit bug reports with screenshots, explainable priority scoring, and instant duplicate detection.

---

## Architecture Overview

```
TestSphere/
├── package.json              # Root project scripts (concurrent execution)
├── .gitignore                # Production & secrets ignore rules
├── .env.example              # Root environment template
├── README.md                 # Project documentation
│
├── server/                   # Backend (Node.js & Express)
│   ├── .env.example          # Server environment template
│   ├── .env                  # Server local configuration (not committed)
│   ├── package.json          # Express, Mongoose, Socket.IO, CORS, Morgan
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js         # Mongoose connection & status helper
│   │   │   └── env.js        # Centralized environment loader
│   │   ├── middleware/
│   │   │   └── errorHandler.js # Centralized 404 & error handling
│   │   ├── routes/
│   │   │   └── healthRoutes.js # /api/health and /api/health/ping
│   │   ├── socket/
│   │   │   └── index.js      # Socket.IO gateway & lifecycle events
│   │   ├── app.js            # Express application setup
│   │   └── server.js         # HTTP server & graceful shutdown
│   └── uploads/              # Storage directory for bug screenshots (.gitkeep)
│
└── client/                   # Frontend (React 18 & Vite 6)
    ├── .env.example          # Client environment template
    ├── .env                  # Client local configuration (not committed)
    ├── package.json          # React, Vite, React Router, Lucide, Socket.IO
    ├── vite.config.js        # Vite build & dev server config (port 5173)
    ├── index.html            # HTML entry point with Inter & Outfit fonts
    └── src/
        ├── components/
        │   ├── common/       # StatusBadge, Card, Navbar
        │   └── layout/       # App layout with live WebSocket indicators
        ├── pages/            # DashboardHome, NotFound
        ├── services/         # REST API & Socket.IO service helpers
        ├── styles/           # CSS design tokens & SaaS stylesheet
        ├── App.jsx           # React Router configuration
        └── main.jsx          # React DOM entry point
```

---

## Prerequisites

1. **Node.js**: v20+ recommended (Current tested: `v24.14.1`)
2. **npm**: v10+ (Current tested: `11.11.0`)
3. **MongoDB**: Local Community Edition running on `127.0.0.1:27017` or MongoDB Atlas connection string.

---

## Configuration

Both `server` and `client` maintain their own environment configurations:

### Server (`server/.env`)
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/testsphere
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=your_dev_secret_key_here
JWT_EXPIRES_IN=7d
```

### Client (`client/.env`)
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## Installation & Startup

### 1. Install Dependencies
Run the following from the root directory (`D:\project\TestSphere`):
```bash
npm run install:all
```
*(Or install in each directory individually: `npm install`, `cd server && npm install`, `cd client && npm install`)*

### 2. Start Both Services in Development
Run both the backend (port 5000) and frontend (port 5173) together:
```bash
npm run dev
```

### 3. Individual Startup Commands
- **Backend only**:
  ```bash
  npm run dev:server
  ```
- **Frontend only**:
  ```bash
  npm run dev:client
  ```

---

## Verification & Health Check

### REST Health Endpoint
Access: `http://localhost:5000/api/health`

Sample response:
```json
{
  "success": true,
  "status": "healthy",
  "service": "TestSphere API & Real-Time Gateway",
  "version": "1.0.0 (Phase 1)",
  "uptimeSeconds": 15,
  "timestamp": "2026-10-27T07:15:00.000Z",
  "environment": "development",
  "components": {
    "database": {
      "status": "connected",
      "isHealthy": true
    },
    "realtime": {
      "status": "active",
      "transport": ["websocket", "polling"]
    }
  }
}
```

### Real-Time Gateway Verification
The frontend includes an interactive **"Run Live Benchmark"** button that tests:
1. REST API latency (`GET /api/health/ping`).
2. MongoDB connectivity state via the health service.
3. Socket.IO bidirectional round-trip latency (`system:ping` $\rightarrow$ `system:pong`).

---

### Authentication REST Endpoints (Phase 2)
- `POST /api/auth/register` — Create account with role (`developer` | `tester`) and password hashing
- `POST /api/auth/login` — Sign in and receive signed JWT token
- `GET /api/auth/me` — Protected endpoint returning current user profile via `Authorization: Bearer <token>`

---

## Phased Implementation Roadmap

- [x] **Phase 1: Project Scaffolding & Server Foundation**
- [x] **Phase 2: Authentication & Role-Based Access Control (RBAC)**
- [ ] **Phase 3: Testing Campaigns & Invitation System**
- [ ] **Phase 4: Test Case Management & Execution Engine**
- [ ] **Phase 5: Intelligent Bug Reporting, Duplicate Detection & Retest Lifecycle**
- [ ] **Phase 6: Real-Time Live Sync & Analytics Dashboard**
- [ ] **Phase 7: End-to-End Testing, UI Polish & Verification**
