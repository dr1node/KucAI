const DATABASE_NAME = "nusa-ai-local-files";
const STORE_NAME = "attachments";

export type StoredAttachment = {
  id: string;
  blob: Blob;
  textContent?: string;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Gagal membuka penyimpanan lampiran browser."));
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Penyimpanan lampiran browser sedang diblokir tab lain."));
    };
  });
}

export async function saveAttachment(attachment: StoredAttachment) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(attachment);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(
        transaction.error ?? new Error("Gagal menyimpan file di browser."),
      );
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Penyimpanan file dibatalkan."));
    };
  });
}

export async function getAttachment(id: string) {
  const database = await openDatabase();
  return new Promise<StoredAttachment | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => {
      database.close();
      resolve((request.result as StoredAttachment | undefined) ?? null);
    };
    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error("Gagal membaca file dari browser."));
    };
  });
}

export async function deleteAttachments(ids: string[]) {
  if (!ids.length) return;
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    ids.forEach((id) => store.delete(id));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(
        transaction.error ?? new Error("Gagal menghapus file dari browser."),
      );
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Penghapusan file dibatalkan."));
    };
  });
}

export async function clearAttachments() {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(
        transaction.error ?? new Error("Gagal menghapus lampiran browser."),
      );
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Penghapusan lampiran dibatalkan."));
    };
  });
}
