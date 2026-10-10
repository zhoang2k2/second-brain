import type Database from 'better-sqlite3';
import { Project, Vault } from '@zhon/contracts';

interface ProjectRow {
  id: string;
  root: string;
  remote: string | null;
  version: number;
  created_at: string;
}

interface VaultRow {
  id: string;
  root: string;
  version: number;
  created_at: string;
}

export class ProjectRepository {
  saveProject(db: Database.Database, project: Project): void {
    const stmt = db.prepare(`
      INSERT INTO projects (id, root, remote, version, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(root) DO UPDATE SET
        remote = excluded.remote,
        version = projects.version + 1
    `);
    stmt.run(
      project.id,
      project.root,
      project.remote ?? null,
      project.version,
      project.createdAt
    );
  }

  findProjectById(db: Database.Database, id: string): Project | null {
    const stmt = db.prepare('SELECT id, root, remote, version, created_at FROM projects WHERE id = ?');
    const row = stmt.get(id) as ProjectRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      root: row.root,
      remote: row.remote ?? undefined,
      version: row.version,
      createdAt: row.created_at
    };
  }

  findProjectByRoot(db: Database.Database, root: string): Project | null {
    const stmt = db.prepare('SELECT id, root, remote, version, created_at FROM projects WHERE root = ?');
    const row = stmt.get(root) as ProjectRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      root: row.root,
      remote: row.remote ?? undefined,
      version: row.version,
      createdAt: row.created_at
    };
  }

  listProjects(db: Database.Database): Project[] {
    const stmt = db.prepare('SELECT id, root, remote, version, created_at FROM projects ORDER BY created_at ASC');
    const rows = stmt.all() as ProjectRow[];
    return rows.map(row => ({
      id: row.id,
      root: row.root,
      remote: row.remote ?? undefined,
      version: row.version,
      createdAt: row.created_at
    }));
  }

  saveVault(db: Database.Database, vault: Vault): void {
    const stmt = db.prepare(`
      INSERT INTO vaults (id, root, version, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(root) DO UPDATE SET
        version = vaults.version + 1
    `);
    stmt.run(
      vault.id,
      vault.root,
      vault.version,
      vault.createdAt
    );
  }

  findVaultById(db: Database.Database, id: string): Vault | null {
    const stmt = db.prepare('SELECT id, root, version, created_at FROM vaults WHERE id = ?');
    const row = stmt.get(id) as VaultRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      root: row.root,
      version: row.version,
      createdAt: row.created_at
    };
  }

  findVaultByRoot(db: Database.Database, root: string): Vault | null {
    const stmt = db.prepare('SELECT id, root, version, created_at FROM vaults WHERE root = ?');
    const row = stmt.get(root) as VaultRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      root: row.root,
      version: row.version,
      createdAt: row.created_at
    };
  }

  listVaults(db: Database.Database): Vault[] {
    const stmt = db.prepare('SELECT id, root, version, created_at FROM vaults ORDER BY created_at ASC');
    const rows = stmt.all() as VaultRow[];
    return rows.map(row => ({
      id: row.id,
      root: row.root,
      version: row.version,
      createdAt: row.created_at
    }));
  }
}
