import { mkdir, open, readFile, rename } from 'node:fs/promises';
import path from 'node:path';

export class JsonStore {
  constructor(file) { this.file = file; this.data = { version: 1, sessions: {} }; this.writeQueue = Promise.resolve(); }
  async load() {
    await mkdir(path.dirname(this.file), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || typeof parsed.sessions !== 'object') throw new Error('Format invalide');
      const sessions = Object.fromEntries(Object.entries(parsed.sessions).map(([id, item]) => [id, {
        ...item,
        guildId: item.guildId ?? item.guild,
        ownerId: item.ownerId ?? item.owner,
        privateCode: item.privateCode ?? item.private ?? false,
        createdAt: item.createdAt ?? item.created ?? Date.now(),
        updatedAt: item.updatedAt ?? item.createdAt ?? item.created ?? Date.now(),
        lastAnnouncementAt: item.lastAnnouncementAt ?? null,
      }]));
      this.data = { version: 1, sessions };
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Stockage illisible (${this.file}) : ${error.message}`, { cause: error });
    }
    return this;
  }
  get(id) { return this.data.sessions[id] || null; }
  values() { return Object.values(this.data.sessions); }
  async set(session) { this.data.sessions[session.id] = session; await this.flush(); return session; }
  async flush() {
    const snapshot = `${JSON.stringify(this.data, null, 2)}\n`;
    this.writeQueue = this.writeQueue.then(async () => {
      const temporary = `${this.file}.${process.pid}.tmp`;
      const handle = await open(temporary, 'w', 0o600);
      try { await handle.writeFile(snapshot, 'utf8'); await handle.sync(); } finally { await handle.close(); }
      await rename(temporary, this.file);
    });
    return this.writeQueue;
  }
}
