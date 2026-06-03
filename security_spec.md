# Firestore Security Specification & Threat Model

This specification models the access-control constraints, data invariants, and potential attack vectors for the Firebase project.

## 1. Data Invariants

- **Immutable ID Integrity**: Document IDs must represent safe administrative formats.
- **Identity Restriction (Self-Assigned Roles)**: Users may register themselves, but they are forbidden from modifying their own `role` or setting themselves as `admin`.
- **Temporal Integrity**: Timestamps (`createdAt`, `updatedAt`) must strictly match transaction times via `request.time`.
- **Administrative Bypass**: Users marked as admins inside a verified `/admins/{userId}` node can write/read all paths.

---

## 2. The "Dirty Dozen" Payloads (Threat Vectors)

1. **The Ghost field inject**: An attacker registers a user profile and adds `isVerifiedAdmin: true`.
2. **The Temporal Fraud**: A client attempts to fake historical registration by writing a manual `createdAt` value of `2018-01-01`.
3. **The Role Escalation**: A standard user sends an update patching their own `role` field to `admin`.
4. **The Zombie Re-animation**: Attempting to alter fields of a user whose status is set to `suspended`.
5. **The Orphan write**: Creating a sub-collection activity log with a fake `userId` referencing no real profile.
6. **The PII Broadcast**: Attempting to query the entire list of user emails without restriction.
7. **The System Poisoning**: Injecting an astronomical 2MB notes value to crash index engines.
8. **The ID Poisoning**: Specifying a malicious Unicode injection string (e.g., `../admin/rules`) as the Document ID.
9. **The Denial-of-Wallet Loop**: Flooding collections with massive, recursive document generation loops.
10. **The Log Tampering**: Modifying an audit event log post-creation (logs must be completely append-only and immutable).
11. **The Spoof Email Auth**: Submitting writes with verified email token flags mock-set to false.
12. **The Status Jump**: Skipping pending setup cycles to forcefully activate account.

---

## 3. Test Rules Target Assertions

All "Dirty Dozen" payloads must trigger complete `PERMISSION_DENIED` exceptions at the rules matcher. Only authorized admins have broad access to user CRMs.
