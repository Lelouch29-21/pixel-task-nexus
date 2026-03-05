# Pixel Task Nexus

Pixel Task Nexus is a light-mode collaborative task management web app designed for team delivery workflows where everyone can see tasks, collaborate in context, track dependencies, and understand ownership clearly.

This project is intentionally built as a static frontend (HTML/CSS/JS) so it can be hosted on GitHub Pages while still supporting optional realtime sync via Firebase Firestore.

## Why This Exists

Most small-team task boards miss three practical realities:
- work gets halted due to internal/external dependencies,
- managers need nudge mechanisms,
- people contribute with different intensity (owner vs shadowing).

Pixel Task Nexus makes those realities visible through:
- dependency factor + dependency source (internal team vs external team/company),
- halted status with explicit dependency reason,
- per-person involvement stars with work summary.

## Core Capabilities

- Role-based login (`admin`, `manager`, `member`)
- Shared visibility: everyone can see all tasks
- Task Bucket for unassigned pending work (pick-up model)
- Team board (`In Progress`, `Halted`, `Done`)
- Collaboration thread per task
- Mentions via `@username` and mention inbox
- Manager/admin nudges to assignees
- Dependency tracking:
  - factor: `none`, `low`, `medium`, `high`
  - source: `internal team` or `external team/company`
- Halted tasks show dependency reason directly in UI
- Dependency node graph:
  - users represented as nodes
  - internal/external dependency edges
  - per-user project participation counts
- Per-user involvement stars (1-5) + work summary per task
- Checklist items per task
- Worklog entries (hours + notes)
- Attachment/reference links per task
- Watchlist + pinning
- Completed-by-you panel
- Admin user management (create user, update role)
- Workspace export/import as JSON backup
- Optional cross-device realtime sync with Firebase Firestore

## User Roles & Permissions

| Capability | Member | Manager | Admin |
|---|---:|---:|---:|
| View all tasks | Yes | Yes | Yes |
| Pick from bucket | Yes | Yes | Yes |
| Update own task status | Yes (assignee only) | Yes | Yes |
| Create tasks in bucket | No | Yes | Yes |
| Set assignee/dependency controls | No | Yes | Yes |
| Send nudges | No | Yes | Yes |
| Bulk update tasks | No | Yes | Yes |
| Create users / update roles | No | No | Yes |
| Export/import workspace | No | No | Yes |

## Status Model

- `Bucket`: pending, unassigned tasks available for pickup.
- `In Progress`: active execution.
- `Halted`: execution paused due to dependency constraints.
- `Done`: completed tasks.

When a task is halted, the UI displays:
- `Halted because of dependency on Internal Team (...)` or
- `Halted because of dependency on External Team/Company (...)`.

## Involvement Stars Model

Each teammate can self-report involvement on any task:
- 1 star: shadowing
- 2 stars: light support
- 3 stars: active contributor
- 4 stars: major owner
- 5 stars: driving execution

Each entry stores:
- `userId`
- `stars`
- `workSummary`
- `updatedAt`

This helps distinguish direct ownership from passive participation.

## Dependency Graph

The dependency graph section visualizes:
- user nodes,
- external dependency nodes,
- edge types:
  - solid blue for internal team dependencies,
  - rose dashed for external dependencies,
  - slate dashed fallback collaboration links when explicit dependencies are absent.

## Project Structure

```txt
.
├── app.js
├── styles.css
├── index.html
├── firebase-config.js
├── firebase-config.example.js
└── .github/
    └── workflows/
        └── deploy-pages.yml
```

## Technology Stack

- Vanilla JavaScript (ES modules)
- HTML5
- CSS3
- Optional Firebase Firestore for realtime sync
- GitHub Pages for static hosting

## Local Development

### 1) Clone

```bash
git clone https://github.com/<your-username>/pixel-task-nexus.git
cd pixel-task-nexus
```

### 2) Serve locally

```bash
python3 -m http.server 4173
```

Open:
- `http://127.0.0.1:4173/`

## Demo Accounts

- `admin` / `admin123`
- `manager` / `manager123`
- `alex` / `alex123`
- `sam` / `sam123`
- `rina` / `rina123`

## Firebase Realtime Sync (Optional)

Default mode runs locally (`cloudSyncEnabled = false`).

To enable cloud sync:
1. Create a Firebase project.
2. Enable Firestore.
3. Copy `firebase-config.example.js` values into `firebase-config.js`.
4. Set:
   - `cloudSyncEnabled = true`
5. Reload app.

Recommended dev-only relaxed rules (not production-safe):

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /pixel_task_nexus/{docId} {
      allow read, write: if true;
    }
  }
}
```

## GitHub Pages Deployment

This repository includes a workflow at:
- `.github/workflows/deploy-pages.yml`

Trigger options:
- push to `main`
- manual `workflow_dispatch`

The workflow deploys this static app to GitHub Pages using Actions artifact deployment.

## Data Persistence

- Local mode: `localStorage`
  - workspace state
  - session identity
- Cloud mode: Firestore document sync + local cache fallback

## Backup & Restore

Admin users can:
- export workspace JSON snapshot,
- import JSON snapshot to replace workspace state.

This allows safe migration and rollback for demos/internal use.

## Production Notes

This is optimized for team demos/internal coordination. For production hardening, add:
- real authentication and password hashing,
- role-based backend authorization,
- server-side validation,
- audit logs and immutable event stream,
- stricter Firestore security rules,
- CSP/security headers.

## License

No license file is currently defined. Add a license before external distribution.
