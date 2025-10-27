# Scripts Documentation

## App Setup

### `setup-app.ts`

Interaktives Setup-Script für neue Apps aus dem Template.

**Verwendung:**
```bash
npm run setup
```

**Was macht das Script:**
- ✅ Setzt App-Name überall (docker-compose.yml, package.json)
- ✅ Konfiguriert Database Port konsistent (.env, drizzle.config.ts, docker-compose.yml)
- ✅ Setzt Node.js Server Port (.env)
- ✅ Erstellt `.setup-config.json` mit allen Einstellungen
- ✅ App-Name wird automatisch beim Seeden in die Datenbank übernommen

**Detaillierte Dokumentation:** [SETUP_README.md](./SETUP_README.md)

---

## Post-Sync Fix

### `post-sync-fix.ts`

Stellt app-spezifische Werte nach einem Template-Sync wieder her.

**Verwendung:**
```bash
pnpm run post-sync-fix
```

**Wann ausführen:**
- ⚠️ **IMMER nach einem Template-Sync!**
- Nach dem Mergen eines `template_sync` Pull Requests

**Was wird wiederhergestellt:**
- ✅ App-Name in `package.json`
- ✅ Docker Service Name und Port in `docker-compose.yml`
- ✅ Database URL in `drizzle.config.ts`
- ✅ Ports in `.env`

**Wie funktioniert es:**
- Liest die korrekten Werte aus `.setup-config.json`
- Ersetzt Template-Defaults mit deinen App-spezifischen Werten
- Zeigt an, welche Dateien aktualisiert wurden

**Beispiel-Output:**
```
🔧 Post-Sync Fix Script
══════════════════════════════════════════════════
Restoring app-specific values...

📋 Restoring from setup config:
   App Name:        my-app
   Docker Service:  node-my-app
   Database Port:   5451
   Node Port:       8101

📝 Fixing package.json...
   ✓ Restored app name: my-app
📝 Fixing docker-compose.yml...
   ✓ Restored docker service: node-my-app
📝 Fixing drizzle.config.ts...
   ✓ Restored database URL: postgresql://...
📝 Fixing .env...
   ✓ Restored ports in .env

══════════════════════════════════════════════════
✅ Post-sync fix completed! (4 files restored)
══════════════════════════════════════════════════
```

**Vollständige Sync-Anleitung:** [../TEMPLATE_SYNC.md](../TEMPLATE_SYNC.md)

---

## Frontend Type Generation

### `generate-frontend-types.ts`

Generiert automatisch eine `frontend-types.ts` Datei, die alle Backend-Types exportiert, die vom Frontend benötigt werden.

**Verwendung:**
```bash
npm run types:generate   # Generiere Types
```

**Was wird exportiert:**
- ✅ **Enums & Literal Types** - dynamisch aus `pgEnum` extrahiert
- ✅ **Base Schema Types** - vollständig dynamisch aus `src/db/schema.ts` extrahiert
- ✅ **Individual Schema Types** - vollständig dynamisch aus `src/db/individual/individual-schema.ts` extrahiert
- ✅ **Permissions (AppPermissions Enum)** - dynamisch aus `permission.service.ts` + `individual-permissions.ts` extrahiert
- ✅ **Settings Types (AppSettingsKey, AppSettingsTypeMap)** - dynamisch aus `individual-settings.ts` extrahiert
- ⚪ Utility Types (Languages) - hardcoded (generisch)
- ⚪ API Response Types (ApiResponse, PaginatedResponse) - hardcoded (generisch)

**Features:**
- 🚀 **Vollständig automatisch** - keine manuellen Anpassungen nötig
- 📦 **Standalone File** - keine Imports, kann direkt ins Frontend kopiert werden
- 🔄 **Dynamische Extraktion** - liest Drizzle pgTable Definitionen und konvertiert sie zu TypeScript
- 🎯 **Type Referencing** - verwendet korrekte Type-Referenzen (z.B. `type: AppSettingsType`)
- ♻️ **Nullable Handling** - erkennt automatisch `.notNull()` und `.primaryKey()` Modifiers

**Integration ins Frontend:**

1. **Option 1: Symlink (empfohlen für Monorepo)**
   ```bash
   cd ../frontend
   ln -s ../backend/frontend-types.ts ./types/backend-types.ts
   ```

2. **Option 2: Copy Script (für separate Repos)**
   ```json
   // In frontend/package.json
   {
     "scripts": {
       "sync:types": "cp ../backend/frontend-types.ts ./types/backend-types.ts"
     }
   }
   ```

3. **Option 3: Git Submodule (für komplett getrennte Repos)**
   ```bash
   cd frontend
   git submodule add ../backend backend-types
   ```

**Im Frontend verwenden:**
```typescript
// types/backend-types.ts (symlink zu backend/frontend-types.ts)
import type { User, Role, AppPermissions } from './backend-types';

const user: User = { /* ... */ };
```

### Neue Individual Types hinzufügen

Wenn du eine neue Tabelle in `individual-schema.ts` erstellst:

1. Definiere die Tabelle mit `pgTable`:
   ```typescript
   export const articles = pgTable("gf_articles", {
     id: serial("id").primaryKey(),
     title: varchar("title", { length: 255 }).notNull(),
     content: text("content"),
     published: boolean("published").default(false),
     createdAt: timestamp("created_at").notNull().defaultNow(),
   });
   ```

2. Exportiere die Types:
   ```typescript
   export type Article = typeof articles.$inferSelect;
   export type ArticleId = typeof articles.$inferSelect['id'];
   ```

3. **Das war's!** Regeneriere die Frontend Types:
   ```bash
   npm run types:generate
   ```

   Die Typen werden automatisch extrahiert:
   ```typescript
   export type Article = {
     id: number;
     title: string;
     content: string | null;
     published: boolean | null;
     createdAt: Date;
   };

   export type ArticleId = number;
   ```

### Vorteile

✅ **Type Safety**: Frontend und Backend verwenden identische Types
✅ **Auto-Completion**: IDE Autocomplete funktioniert out of the box
✅ **Keine Duplikation**: Single Source of Truth (Backend Schema)
✅ **Automatisch**: Bei Schema-Änderungen einfach regenerieren
✅ **Template-freundlich**: `frontend-types.ts` wird nicht gesynct

### Troubleshooting

**Problem: Types werden nicht aktualisiert**
```bash
# Lösung: Manuell regenerieren
npm run types:generate
```

**Problem: Import Error im Frontend**
```bash
# Lösung: Stelle sicher, dass der Pfad korrekt ist
# Relativ zum Frontend: '../backend/frontend-types'
```

**Problem: Individual Types fehlen**
```bash
# Lösung: Prüfe ob der Export in scripts/generate-frontend-types.ts existiert
```
