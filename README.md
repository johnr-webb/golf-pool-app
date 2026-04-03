# Golf Pool App

A web app for running golf tournament pools. Players join a pool, pick one golfer from each odds tier (favorite, contender, longshot), and compete on a live leaderboard driven by real tournament scores.

Built for the Masters Tournament (and any major), with Firebase on the backend and a React + Tailwind frontend.

---

## How It Works

1. Someone **creates a pool** and shares the 6-character invite code
2. Members **join the pool** and pick 3 golfers — one from each bucket
3. Picks **lock** at a configurable time (typically first tee shot)
4. The **leaderboard** ranks players by the combined score of their 3 golfers (lowest wins)

---

## Tech Stack

| Layer      | Technology                               |
| ---------- | ---------------------------------------- |
| Frontend   | React 19, TypeScript, Vite               |
| Styling    | Tailwind CSS v4                          |
| Routing    | React Router v7                          |
| State      | Zustand v5                               |
| Auth       | Firebase Authentication (email/password) |
| Database   | Cloud Firestore                          |
| Backend    | Firebase Cloud Functions (Node.js)       |
| Score Data | RapidAPI — `golf-leaderboard-data`       |
| Hosting    | Firebase Hosting                         |
| CI/CD      | GitHub Actions                           |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project (Blaze plan for Cloud Functions)
- A [RapidAPI](https://rapidapi.com) key for `golf-leaderboard-data` _(optional — falls back to mock data)_

### Local Development

```bash
# 1. Install dependencies
npm install
cd functions && npm install && cd ..

# 2. Set environment variables
cp .env.example .env
# Fill in your Firebase config values

# 3. Start the dev server
npm run dev

# 4. (Optional) Run Firebase emulators
firebase emulators:start
```

The app will be available at `http://localhost:5173`.

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

For the Cloud Function, set the RapidAPI key:

```bash
firebase functions:config:set rapidapi.key="YOUR_KEY"
```

---

## Project Structure

```
golf-pool-app/
├── src/
│   ├── pages/          # Route-level page components
│   ├── components/     # Reusable UI components
│   ├── hooks/          # Custom React hooks
│   ├── services/       # Firebase + scoring logic
│   ├── context/        # Auth context (React Context API)
│   ├── data/           # Static golfer data & mock scores
│   └── types/          # Shared TypeScript interfaces
├── functions/
│   └── src/
│       ├── index.ts    # Cloud Function: fetchScores
│       └── golfApi.ts  # RapidAPI integration
├── firestore.rules     # Firestore security rules
└── firebase.json       # Firebase configuration
```

---

## Documentation

| Doc                                  | Description                                |
| ------------------------------------ | ------------------------------------------ |
| [Architecture](docs/architecture.md) | System design, data flow, component tree   |
| [Data Model](docs/data-model.md)     | Firestore collections and TypeScript types |
| [Scoring](docs/scoring.md)           | How picks, buckets, and scores work        |
| [Deployment](docs/deployment.md)     | Firebase deploy & CI/CD setup              |

---

## Scripts

```bash
npm run dev        # Start Vite dev server
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint
npm run preview    # Preview production build locally
```

---

## Deployment

Push to `main` → GitHub Actions builds and deploys to Firebase Hosting automatically.

See [docs/deployment.md](docs/deployment.md) for full setup instructions.

````

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
````
