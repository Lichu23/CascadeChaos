const GUEST_ID_KEY = "cascade-chaos:guest-id";
const USERNAME_KEY = "cascade-chaos:username";

export function getGuestId() {
  let guestId = window.localStorage.getItem(GUEST_ID_KEY);

  if (!guestId) {
    guestId = window.crypto.randomUUID();
    window.localStorage.setItem(GUEST_ID_KEY, guestId);
  }

  return guestId;
}

export function getStoredUsername() {
  return window.localStorage.getItem(USERNAME_KEY) ?? "";
}

export function storeUsername(username: string) {
  window.localStorage.setItem(USERNAME_KEY, username.trim());
}

