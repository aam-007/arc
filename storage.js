const DATABASE = 'arc-academic';
const VERSION = 1;
const STORE = 'records';
const PROFILE = 'profile';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    let blocked = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Another ARC tab is blocking the database update. Close it and retry.'));
    };
  });
}

async function transaction(mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let request;
    try {
      const tx = database.transaction(STORE, mode);
      request = operation(tx.objectStore(STORE));
      tx.oncomplete = () => {
        database.close();
        resolve(request.result);
      };
      tx.onerror = tx.onabort = () => {
        database.close();
        reject(tx.error || request.error || new Error('The database transaction was aborted.'));
      };
    } catch (error) {
      database.close();
      reject(error);
    }
  });
}

export function read() {
  return transaction('readonly', (store) => store.get(PROFILE));
}

// Serialize snapshots so rapid edits cannot commit in a different order.
let pendingWrite = Promise.resolve();
export function save(data) {
  const snapshot = structuredClone(data);
  pendingWrite = pendingWrite
    .catch(() => {})
    .then(() => transaction('readwrite', (store) => store.put(snapshot, PROFILE)));
  return pendingWrite;
}
