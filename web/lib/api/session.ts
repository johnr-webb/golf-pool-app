import { apiFetch } from "./client";

// Exchange a freshly minted Firebase ID token for an HttpOnly session cookie.
// The backend sets __session on the response; the browser stores it without
// JS ever touching the value. Must be called within ~5 min of Firebase auth.
export const createSession = (idToken: string) =>
  apiFetch<{ success: boolean }>("/session", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });

// Clear the session cookie and revoke refresh tokens. Called before
// firebase.signOut() so the backend has a chance to invalidate first.
export const deleteSession = () =>
  apiFetch<{ success: boolean }>("/session", { method: "DELETE" });
