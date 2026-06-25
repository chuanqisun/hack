import { createStore, del, get, keys, set } from "idb-keyval";

type FileContent = string | Uint8Array | ArrayBuffer;

type FileRecord = {
  content: FileContent;
};

export class IdbFs {
  private readonly store;

  constructor(dbName = "hack-vfs", storeName = "files") {
    this.store = createStore(dbName, storeName);
  }

  async read(path: string): Promise<FileContent> {
    const normalizedPath = normalizePath(path);
    const record = await get<FileRecord>(normalizedPath, this.store);

    if (record == null) {
      throw new Error(`File not found: ${normalizedPath}`);
    }

    return record.content;
  }

  async write(path: string, content: FileContent): Promise<void> {
    const normalizedPath = normalizePath(path);

    if (normalizedPath === "/") {
      throw new Error("Cannot write to the root directory.");
    }

    await set(normalizedPath, { content } satisfies FileRecord, this.store);
  }

  async rename(from: string, to: string): Promise<void> {
    const sourcePath = normalizePath(from);
    const targetPath = normalizePath(to);

    if (sourcePath === "/") {
      throw new Error("Cannot rename the root directory.");
    }

    if (targetPath === "/") {
      throw new Error("Cannot overwrite the root directory.");
    }

    if (sourcePath === targetPath) {
      return;
    }

    const record = await get<FileRecord>(sourcePath, this.store);

    if (record == null) {
      throw new Error(`File not found: ${sourcePath}`);
    }

    await set(targetPath, record, this.store);
    await del(sourcePath, this.store);
  }

  async move(from: string, to: string): Promise<void> {
    return this.rename(from, to);
  }

  async delete(path: string): Promise<void> {
    const normalizedPath = normalizePath(path);

    if (normalizedPath === "/") {
      throw new Error("Cannot delete the root directory.");
    }

    await del(normalizedPath, this.store);
  }

  async allFiles(): Promise<string[]> {
    const entries = await keys<string>(this.store);
    return entries
      .filter((entry): entry is string => typeof entry === "string")
      .sort();
  }

  async list(dir = "/"): Promise<string[]> {
    const normalizedDir = normalizePath(dir);
    const entries = await keys<string>(this.store);

    return entries
      .filter((entry): entry is string => typeof entry === "string")
      .filter((entry) => parentDirectory(entry) === normalizedDir)
      .sort();
  }
}

export const idbFs = new IdbFs();

function normalizePath(path: string): string {
  if (path == null || path.trim() === "") {
    return "/";
  }

  const normalized = path.replace(/\\/g, "/").trim();
  const parts: string[] = [];

  for (const part of normalized.split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      if (parts.length > 0) {
        parts.pop();
      }
      continue;
    }

    parts.push(part);
  }

  return "/" + parts.join("/");
}

function parentDirectory(path: string): string {
  const normalizedPath = normalizePath(path);
  const lastSlash = normalizedPath.lastIndexOf("/");

  if (lastSlash <= 0) {
    return "/";
  }

  return normalizedPath.slice(0, lastSlash) || "/";
}
