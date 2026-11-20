const DB_NAME = "field-apps";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("properties")) {
        db.createObjectStore("properties", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("photos")) {
        const store = db.createObjectStore("photos", { keyPath: "id" });
        store.createIndex("propertyId", "propertyId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txComplete(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });
}

async function withStore(name, mode, fn) {
  const db = await openDb();
  try {
    const tx = db.transaction(name, mode);
    const result = await fn(tx.objectStore(name));
    await txComplete(tx);
    return result;
  } finally {
    db.close();
  }
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function listProperties() {
  return withStore("properties", "readonly", (store) => requestToPromise(store.getAll()));
}

export function getProperty(id) {
  return withStore("properties", "readonly", (store) => requestToPromise(store.get(id)));
}

export function saveProperty(property) {
  return withStore("properties", "readwrite", (store) => requestToPromise(store.put(property)));
}

export function putPhoto(photo) {
  return withStore("photos", "readwrite", (store) => requestToPromise(store.put(photo)));
}

export function deletePhoto(id) {
  return withStore("photos", "readwrite", (store) => requestToPromise(store.delete(id)));
}

export function listPhotos(propertyId) {
  return withStore("photos", "readonly", (store) => requestToPromise(store.index("propertyId").getAll(propertyId)));
}

export async function clearAll() {
  const db = await openDb();
  try {
    const tx = db.transaction(["properties", "photos"], "readwrite");
    tx.objectStore("properties").clear();
    tx.objectStore("photos").clear();
    await txComplete(tx);
  } finally {
    db.close();
  }
}
