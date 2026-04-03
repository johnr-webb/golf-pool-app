# Deployment

## Prerequisites

- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project created at [console.firebase.google.com](https://console.firebase.google.com)
- Firebase project on the **Blaze (pay-as-you-go) plan** — required for Cloud Functions
- Firebase services enabled:
  - Authentication → Email/Password provider
  - Firestore Database
  - Functions

---

## First-Time Setup

### 1. Login & link project

```bash
firebase login
firebase use --add   # select your project and give it an alias
```

### 2. Set function environment variable

```bash
firebase functions:config:set rapidapi.key="YOUR_RAPIDAPI_KEY"
```

_(Skip if you don't have a RapidAPI key — the app falls back to mock data.)_

### 3. Deploy everything

```bash
# Build the frontend
npm run build

# Build the functions
cd functions && npm run build && cd ..

# Deploy all Firebase resources
firebase deploy
```

---

## What Gets Deployed

| Resource            | Source            | Notes                                          |
| ------------------- | ----------------- | ---------------------------------------------- |
| **Hosting**         | `dist/`           | Vite production build, SPA rewrites configured |
| **Cloud Functions** | `functions/lib/`  | Compiled TypeScript → JS                       |
| **Firestore Rules** | `firestore.rules` | Security rules                                 |

---

## Selective Deploys

```bash
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
```

---

## GitHub Actions (CI/CD)

Pushing to `main` automatically builds and deploys via `.github/workflows/`.

### Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret                              | Value                         |
| ----------------------------------- | ----------------------------- |
| `FIREBASE_TOKEN`                    | Output of `firebase login:ci` |
| `RAPIDAPI_KEY`                      | Your RapidAPI key (optional)  |
| `VITE_FIREBASE_API_KEY`             | Firebase web app config       |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Firebase web app config       |
| `VITE_FIREBASE_PROJECT_ID`          | Firebase web app config       |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Firebase web app config       |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase web app config       |
| `VITE_FIREBASE_APP_ID`              | Firebase web app config       |

### Pipeline Flow

```
push to main
    → npm install & build (frontend + functions)
    → firebase deploy
```

---

## Local Development with Emulators

```bash
firebase emulators:start
```

Emulator ports (configured in `firebase.json`):

| Service     | Port           |
| ----------- | -------------- |
| Auth        | 9099           |
| Firestore   | 8080           |
| Functions   | 5001           |
| Hosting     | 5000           |
| Emulator UI | 4000 (default) |

Run the React dev server alongside:

```bash
npm run dev   # http://localhost:5173
```

> The app uses `import.meta.env.VITE_*` variables — point these at your emulator project ID to use the emulator.

---

## Troubleshooting

**"Billing not enabled" on functions deploy**
Upgrade the Firebase project to the Blaze plan (there is a generous free tier).

**Functions deploy fails after changes**

```bash
cd functions && npm run build && cd .. && firebase deploy --only functions
```

**Hosting shows blank page / 404**
Verify `firebase.json` has `"public": "dist"` and the SPA rewrite rule:

```json
"rewrites": [{ "source": "**", "destination": "/index.html" }]
```

**Emulator auth not persisting**
Add `?debug=true` to the emulator URL or check that `FIREBASE_AUTH_EMULATOR_HOST` is set.
