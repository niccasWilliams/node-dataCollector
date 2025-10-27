# Node Backend Template

Dieses Template bietet eine vorkonfigurierte Node.js Backend-Struktur mit Authentication, Rollen, Permissions, Webhooks und mehr.

## 🚀 Schnellstart für neue App

### 1. Template kopieren
```bash
# Kopiere das gesamte Template in ein neues Verzeichnis
cp -r node-template my-new-app
cd my-new-app
```

### 2. Abhängigkeiten installieren
```bash
pnpm install
```

### 3. **NEU: Interaktives Setup ausführen** ⭐

**Der einfachste Weg, eine neue App zu konfigurieren:**

```bash
pnpm run setup
```

Das Setup-Script konfiguriert automatisch:
- ✅ App-Name (in docker-compose.yml, package.json)
- ✅ Database Port (konsistent über alle Config-Files)
- ✅ Node.js Server Port
- ✅ App-Name wird automatisch in Datenbank übernommen

**Beispiel:**
```
📝 Enter app name: event-planner
🗄️  Enter database port: 5451
🌐 Enter Node.js server port: 8101
```

➡️ **Fertig!** Alle Dateien sind korrekt konfiguriert.

Siehe [`scripts/SETUP_README.md`](./scripts/SETUP_README.md) für Details.

### 4. Manuelle Konfiguration (Optional)

Falls du das Setup-Script nicht nutzt, passe folgende Dateien manuell an:

**Wichtige Dateien zum Anpassen:**

#### `src/app.config.ts`
- Support Email anpassen
- Logo-Pfade aktualisieren
- Sprach-Einstellungen

#### `src/db/userSeeds.ts`
- Admin-User Email ändern
- Weitere Users hinzufügen

#### `src/routes/settings/individual-settings.ts`
- App-Name anpassen
- Weitere App-Settings hinzufügen

#### `src/individual-routes.ts`
- Eigene Routes registrieren
- Wird von `routes.ts` automatisch geladen

### 5. Individual-Dateien anpassen

Die folgenden Dateien sind **app-spezifisch** und werden NICHT vom Template überschrieben:

```
src/
├── individual-routes.ts       # ⚠️ Deine eigenen Routes registrieren

src/db/individual/
├── individual-schema.ts       # Deine eigenen Tabellen
├── individual-seed.ts         # Seeds für deine Tabellen
└── individual-user-seeds.ts   # Weitere User-Seeds

src/routes/
├── settings/individual-settings.ts
├── webhooks/individual-webhooks.ts
└── auth/roles/permissions/individual-permissions.ts
```

### 6. Datenbank migrieren & seeden

```bash
pnpm run db:reset    # Resettet DB, migriert und seedet
```

## 📁 Projekt-Struktur

```
src/
├── app.config.ts              # ⚠️ App-spezifische Konfiguration
├── routes.ts                  # ✅ Base Route-Registrierung
├── individual-routes.ts       # ⚠️ Individual Route-Registrierung
├── db/
│   ├── schema.ts              # ✅ Base Schema (vom Template)
│   ├── userSeeds.ts           # ⚠️ Admin User Seeds (anpassen!)
│   ├── seed.ts                # ✅ Base Seed Runner
│   └── individual/            # ⚠️ Deine eigenen Schemas & Seeds
├── routes/
│   ├── auth/                  # ✅ Base Auth System
│   ├── settings/
│   │   ├── settings.service.ts         # ✅ Base Service
│   │   └── individual-settings.ts      # ⚠️ Deine Settings
│   ├── webhooks/
│   │   ├── webhook.service.ts          # ✅ Base Service
│   │   └── individual-webhooks.ts      # ⚠️ Deine Webhooks
│   └── ...                    # Weitere Base Routes
```

**Legende:**
- ✅ = Wird vom Template gesynct
- ⚠️ = App-spezifisch, NICHT gesynct

## 🔄 Template Updates synchronisieren

Das Template wird **vollständig automatisch** via GitHub Actions synchronisiert (wöchentlich).

**✨ NEU: Komplett automatisiert!**
- GitHub Actions synct das Template
- App-Config wird automatisch wiederhergestellt
- Du musst nur noch den PR prüfen und mergen!

**Vollständige Anleitung:** Siehe [TEMPLATE_SYNC.md](./TEMPLATE_SYNC.md)

### Was wird synchronisiert?

- ✅ Base-Dateien, Scripts, Dependencies
- ✅ App-Config wird automatisch wiederhergestellt
- ❌ Individual-Dateien bleiben unberührt

**Wichtig:** Die `.setup-config.json` muss committed sein für automatischen Sync!

## 🛠️ Wichtige Befehle

```bash
# Setup (NEW!)
pnpm run setup            # ⭐ Interaktives Setup für neue App

# Development
pnpm run dev              # Startet Dev Server

# Database
pnpm run db:generate      # Generiert Migration
pnpm run db:migrate       # Führt Migration aus
pnpm run db:seed          # Seedet Datenbank
pnpm run db:reset         # Reset + Migrate + Seed

# Type Generation
pnpm run types:generate   # Generiert frontend-types.ts

# Production
pnpm run build            # Build für Production
pnpm start                # Startet Production Server

# Docker
docker-compose up -d     # Startet DB Container
```

## 🎯 Features

### Bereits implementiert:
- ✅ User Management mit Clerk Integration
- ✅ Rollen & Permissions System
- ✅ Webhook Tracking & Processing
- ✅ App Settings Management
- ✅ Logging System
- ✅ Cron Jobs / Background Jobs
- ✅ User Activity Tracking
- ✅ PostgreSQL mit Drizzle ORM

### Einfach erweiterbar:
- Individual Permissions
- Individual Webhooks
- Individual Settings
- Individual Database Schema
- Individual Routes

## 🔄 Frontend Types synchronisieren

### Automatische Type-Generation

Alle Database Types werden automatisch in `frontend-types.ts` exportiert:

```bash
pnpm run types:generate  # Types manuell generieren
```

### Im Frontend verwenden

```typescript
// In deinem Frontend (z.B. React/Next.js)
import type { User, Role, AppPermissions } from '../backend/frontend-types';

// Types sind jetzt verfügbar
const user: User = {
  id: 1,
  email: "test@example.com",
  // ... TypeScript autocomplete funktioniert!
};

// Permissions verwenden
if (user.permissions.includes(AppPermissions.UsersManage)) {
  // ...
}
```

### Neue Individual Types hinzufügen

1. **Tabelle in `individual-schema.ts` erstellen:**
```typescript
export const articles = pgTable("articles", {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
});

export type Article = typeof articles.$inferSelect;
export type ArticleId = typeof articles.$inferSelect['id'];
```

2. **Type-Generator updaten (`scripts/generate-frontend-types.ts`):**
```typescript
// In der INDIVIDUAL SCHEMA TYPES Sektion:
export { type Article, type ArticleId } from './src/db/individual/individual-schema';
```

3. **Types generieren:**
```bash
pnpm run types:generate
```

4. **Im Frontend importieren:**
```typescript
import type { Article } from '../backend/frontend-types';
```

## 📝 Beispiel: Neue Route hinzufügen

```typescript
// 1. Erstelle deine Route (z.B. src/routes/articles/article.route.ts)
import express from "express";
const router = express.Router();

router.get("/", async (req, res) => {
    res.json({ articles: [] });
});

export default router;

// 2. Registriere in individual-routes.ts
import articleRouter from "./routes/articles/article.route";

const registerIndividualRoutes = (app: express.Application) => {
    app.use("/articles", articleRouter);
};
```

## 📝 Beispiel: Neue Permission hinzufügen

```typescript
// src/routes/auth/roles/permissions/individual-permissions.ts
export const individualPermissions = [
    { name: "articles_create", description: "Artikel erstellen" },
    { name: "articles_edit", description: "Artikel bearbeiten" },
];

export enum IndividualAppPermissions {
    ArticlesCreate = "articles_create",
    ArticlesEdit = "articles_edit",
}
```

Dann einfach verwenden:
```typescript
import { AppPermissions } from "@/routes/auth/roles/permissions/permission.service";

// Base + Individual Permissions verfügbar:
AppPermissions.UsersManage     // Base Permission
AppPermissions.ArticlesCreate  // Individual Permission
```

## 🐛 Troubleshooting

**Migration Fehler:**
```bash
pnpm run db:reset  # Resettet alles
```

**TypeScript Fehler nach Template Update:**
```bash
pnpm install
pnpm run build
```

**Seed Fehler:**
- Prüfe `userSeeds.ts` Admin Email
- Prüfe `individual-settings.ts` Konfiguration

## 📞 Support

Bei Fragen oder Problemen, siehe Projekt README oder kontaktiere den Template-Maintainer.
