import type { LayoutDirection, Point, Theme } from "../app/app-store";

export interface SavedProject {
  id: "default";
  source: string;
  direction: LayoutDirection;
  theme: Theme;
  positions: Record<string, Point>;
  updatedAt: string;
}

const databaseName = "branchscript";
const storeName = "projects";
const databaseVersion = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open project storage."));
  });
}

export async function loadProject(): Promise<SavedProject | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get("default");
    request.onsuccess = () => resolve((request.result as SavedProject | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Could not load the project."));
    transaction.oncomplete = () => database.close();
  });
}

export async function saveProject(project: SavedProject): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(project);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the project."));
  });
}
