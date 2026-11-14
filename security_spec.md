# Security Specification & Hardening Audit

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every document under `/users/{userId}`, `/users/{userId}/workspaces/{workspaceId}`, and `/users/{userId}/appState/{stateId}` belongs strictly to the authenticated Google user (`request.auth.uid == userId && request.auth.token.email_verified == true`).
2. **Master Gate Parent Existence**: Subcollections (`workspaces`, `appState`) require an existing, owner-matching parent `/users/{userId}` document (`exists(...)` + `get(...).data.uid == userId`) on `get`, `create`, `update`, and `delete`.
3. **Zero Unbounded / Unauthenticated Queries**: Root `users` collection forbids `list`. Subcollection `list` queries enforce `resource.data.uid == request.auth.uid` without `get()`/`exists()` O(n) cost multipliers.
4. **Immutable Identity & Server Timestamps**: `uid`, `id`, and `createdAt` cannot be modified after creation. `createdAt` (on create) and `updatedAt` (on create/update) must equal `request.time`.
5. **Strict Key & Array Bounds**: Every entity checks `hasAll` + `hasOnly` on create, `affectedKeys().hasOnly(...)` on update, string `.size()` limits, regex ID guards (`^[a-zA-Z0-9_\\-]+$`), and list `.size()` + first-element type validation.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-Tenant Read**: User B attempts `get(/users/userA)` -> `PERMISSION_DENIED`.
2. **Cross-Tenant Workspace List**: User B queries `list(/users/userA/workspaces)` -> `PERMISSION_DENIED`.
3. **Ghost Field Shadow Update**: User A sends `isAdmin: true` or `role: 'superadmin'` in `/users/userA` or workspace update -> `PERMISSION_DENIED` (`hasOnly` & `affectedKeys().hasOnly` reject).
4. **Unverified Email Spoof**: Token with matching UID/email but `email_verified: false` writes to `/users/userA` -> `PERMISSION_DENIED`.
5. **Identity Spoofing on Create**: User A creates `/users/userA/workspaces/ws-1` with `uid: 'userB'` -> `PERMISSION_DENIED`.
6. **Immutable Owner Tampering on Update**: User A updates `/users/userA/workspaces/ws-1` changing `uid` or `id` -> `PERMISSION_DENIED`.
7. **Client Timestamp Forgery**: User A sets `createdAt` or `updatedAt` to a past/future client timestamp instead of `request.time` -> `PERMISSION_DENIED`.
8. **ID Poisoning Attack**: User A targets `/users/userA/workspaces/${'a'.repeat(500)}` or non-matching ID `ws$bad` -> `PERMISSION_DENIED` (`isValidId`).
9. **Orphan Subcollection Write**: User A writes `/users/userA/workspaces/ws-1` before `/users/userA` exists -> `PERMISSION_DENIED` (`parentUserExists`).
10. **Array Type Poisoning**: User A sets `sources: ["invalid-string"]` instead of `map` objects -> `PERMISSION_DENIED` (`sources[0] is map`).
11. **Denial-of-Wallet Oversized List**: User A sends 250 items in `sources` or 100 `notebooks` -> `PERMISSION_DENIED` (`size()` cap).
12. **User Directory Enumeration**: Authenticated user attempts `list(/users)` -> `PERMISSION_DENIED`.

## 3. Rules Verification Checklist
- Rules file linted via `@firebase/eslint-plugin-security-rules` (`eslint DRAFT_firestore.rules` / `eslint firestore.rules`).
- Deployed to `daw-9be97` via `DeployRules`.
