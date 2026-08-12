// Drop-in stand-in for the 5 Firestore functions this app uses (doc, getDoc, setDoc,
// onSnapshot, writeBatch), backed by localStorage with an in-memory pub/sub for listeners.
// Lets modules/*.js run unmodified against either this or firestoreBackend.js.

const STORAGE_PREFIX = 'flowpilot_mockdb:';
const listeners = new Map();

function storageKey(ref) {
  return STORAGE_PREFIX + ref.collectionPath + '/' + ref.id;
}

function readRaw(ref) {
  try {
    const raw = localStorage.getItem(storageKey(ref));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeRaw(ref, data) {
  localStorage.setItem(storageKey(ref), JSON.stringify(data));
}

function makeSnapshot(ref, raw) {
  return {
    exists: () => raw !== null,
    data: () => (raw === null ? undefined : raw),
    id: ref.id,
  };
}

function listenerKey(ref) {
  return ref.collectionPath + '/' + ref.id;
}

function notify(ref) {
  const subs = listeners.get(listenerKey(ref));
  if (!subs || !subs.size) return;
  const snap = makeSnapshot(ref, readRaw(ref));
  subs.forEach((cb) => {
    try {
      cb(snap);
    } catch (e) {
      // listener errors shouldn't break other subscribers
    }
  });
}

export function initApp() {
  return { __mock: true };
}

export function getDb() {
  return { __mock: true };
}

export function doc(_db, collectionPath, id) {
  return { collectionPath, id };
}

export async function getDoc(ref) {
  return makeSnapshot(ref, readRaw(ref));
}

export async function setDoc(ref, data) {
  writeRaw(ref, data);
  notify(ref);
}

export function onSnapshot(ref, onNext, onError) {
  const key = listenerKey(ref);
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(onNext);

  Promise.resolve().then(() => {
    try {
      onNext(makeSnapshot(ref, readRaw(ref)));
    } catch (e) {
      if (onError) onError(e);
    }
  });

  return () => {
    const subs = listeners.get(key);
    if (subs) subs.delete(onNext);
  };
}

export function writeBatch() {
  const writes = [];
  return {
    set(ref, data) {
      writes.push({ ref, data });
    },
    async commit() {
      writes.forEach(({ ref, data }) => writeRaw(ref, data));
      writes.forEach(({ ref }) => notify(ref));
    },
  };
}
