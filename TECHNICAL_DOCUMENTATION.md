# ResQNow — Technical Documentation (Production-Level)

This document is an **implementation-based** technical reference for the `ResQNow` codebase (Expo / React Native + Firebase Firestore).

It is written for a new developer joining the team and focuses on **what the code actually does today** (not just roadmap ideas).

---

## 0) Quick repo facts

- **App type**: Mobile app (Expo, React Native) using **`expo-router`** for navigation.
- **Primary backend**: Firebase **Authentication** + **Firestore** (no Cloud Functions are present in this repo).
- **Realtime**: Firestore `onSnapshot()` listeners used for:
  - global emergency session state (caller)
  - doctor live dashboards + case monitor
  - ambulance live case view + (optional) ambulance GPS publishing
  - user emergency history
- **Entry point**: `expo-router/entry` (`package.json`).

Key files:
- `app/_layout.tsx`: root providers and router stack
- `src/firebase/config.ts`: Firebase init + Firestore long-polling for RN
- `src/context/AuthContext.tsx`: auth bootstrap + role loading
- `src/context/EmergencyContext.tsx`: global SOS session state + Firestore listener + persistence
- `firestore.rules`: role-based security rules for `users` + `emergencies`

---

## 1) High-Level Overview

### What is the application?
`ResQNow` is a **real-time emergency assistance** and **first-aid guidance** mobile app:

- Regular users can trigger an **SOS** flow that creates an `emergencies` record in Firestore.
- Approved responders (doctors and ambulances) can **monitor active emergencies** in real time.
- Ambulances can **claim an emergency**, publish **live ambulance location**, and update case status.
- Doctors can **monitor a live case**, view caller medical profile (when allowed), and add notes.
- The app also includes a **First Aid** module with categorized guidance screens.

### Main goal
Reduce time-to-help by:
- creating a structured emergency incident in Firestore
- enabling nearby/approved responders to see it quickly
- sharing location and medical info to support decision making

### Real-world problem solved
In emergencies, **seconds matter** and bystanders are often unsure what to do. This system:
- provides a consistent SOS workflow to capture location + metadata
- enables responder coordination via realtime updates
- provides a first-aid info hub for immediate guidance

---

## 2) User Roles (Auth + Permissions)

Roles are stored in Firestore under `users/{uid}.role` and enforced by both UI routing and Firestore rules.

### Role list
- **`user`**: regular app user (caller/bystander)
- **`doctor`**: responder with medical dashboard (requires admin approval)
- **`ambulance`**: responder with dispatch + GPS publishing tools (requires admin approval)
- **`admin`**: user management panel, can approve responders and manage roles

### Approval model
Responders (`doctor`, `ambulance`) have `users/{uid}.approved`:
- `approved: false` → routed to pending screens (`/doctor/pending`, `/ambulance/pending`)
- `approved: true` → can access responder dashboards and read active emergencies

### What each role can do (implemented)

#### Regular user (`role: "user"`)
- **Create SOS emergency** (writes `emergencies/{id}`).
- **View active emergency screen** (`/(tabs)/emergency/active`) which supports:
  - location display + share flow
  - share medical profile (from `users/{uid}`)
  - cancel/end emergency (updates `emergencies/{id}` to cancelled)
- **Maintain medical profile** (writes fields on `users/{uid}`).
- **Maintain emergency contacts** (writes `users/{uid}.emergencyContacts`).
- **View emergency history** (realtime query on `emergencies`).
- **Use first-aid module**.

#### Doctor (`role: "doctor"`, `approved: true`)
- **View live list of active emergencies** (realtime query `emergencies where sessionStatus == "active"`).
- **Open a case monitor** (`/doctor/case/[id]`) with:
  - realtime emergency doc subscription
  - realtime patient doc subscription (only for `victimType !== "other"`)
  - add “doctor notes” into the emergency doc (arrayUnion)

#### Ambulance (`role: "ambulance"`, `approved: true`)
- **View live emergencies list** (realtime subscription; see “Problems” section for query scope concerns).
- **Open emergency detail** (`/ambulance/emergency-detail`) with:
  - realtime emergency subscription
  - optional “claim” behavior (set `assignedAmbulanceId`)
  - publish **ambulanceLocation** via foreground GPS updates (throttled)
  - update case lifecycle `status` and `sessionStatus`
- **View nearby emergencies** within 200m of the ambulance device location (`/ambulance/nearby-emergencies`)

#### Admin (`role: "admin"`)
- Manage users in `/admin/panel`:
  - approve/reject responders (set `approved`)
  - promote to admin (set `role: "admin"`)
  - delete user doc from Firestore

### Firestore security rule summary (source of truth)
See `firestore.rules`:
- `users/{uid}`
  - owner can read/write own doc
  - approved responders and admin can read user docs
  - only admin can update other user docs or delete
- `emergencies/{id}`
  - any signed-in user can create **their own** emergency doc (must be `sessionStatus:"active"` and `status:"dispatched"` on create)
  - owner can read their own emergency doc
  - approved responders and admin can read emergencies
  - owner can only update to cancel (must set both `sessionStatus` and `status` to `"cancelled"`)
  - responders/admin can update (status, assignment, etc.)

---

## 3) Full User Flows (Step-by-step, by Role)

This section describes the flows as implemented in code and Firestore.

### 3.1 Regular user flow — account creation and login

#### Sign up
File: `app/auth/signup.tsx`

- User enters: `name`, `phoneNumber`, `email`, `password`, `israeliId`, selects role (`user|doctor|ambulance`).
- Validations:
  - Israeli phone format (mobile + landline)
  - Israeli ID is exactly 9 digits
- Firebase Auth:
  - `createUserWithEmailAndPassword(auth, email, password)`
- Firestore:
  - `setDoc(users/{uid})` with:
    - `name`, `phoneNumber`, `email`, `israeliId`, `role`, `approved`, `createdAt`
  - `approved` is **true for `user`**, false for responders.
- Navigation:
  - responders → pending screen
  - regular user → `/` (which redirects to tabs once auth/role loads)

#### Login
File: `app/auth/login.tsx`
- `signInWithEmailAndPassword()`
- Reads `users/{uid}` to determine:
  - if responder + `approved === false` → pending screen
  - otherwise → `/` (role-based redirect happens in `app/index.tsx`)

### 3.2 SOS flow — “press SOS” to “incident handled”

This is the core system flow.

#### Step A — user presses SOS
File: `app/(tabs)/emergency.tsx`

1. If there is an already active session:
   - `EmergencyContext.isEmergencyActive` → navigate to `/(tabs)/emergency/active`.
2. Request foreground location permission:
   - `Location.requestForegroundPermissionsAsync()`
3. Capture GPS fix:
   - `Location.getCurrentPositionAsync({ accuracy: High })`
4. Reverse geocode (best-effort):
   - `Location.reverseGeocodeAsync({ lat, lng })`
5. Show victim selection modal:
   - “Me” (`victimType:"me"`)
   - “Someone else” (`victimType:"other"`)

#### Step B — create emergency document in Firestore
File: `src/context/EmergencyContext.tsx`

On victim selection, `startEmergency({ victimType, location, timestamp })`:

- Guards:
  - must be logged in
  - cannot start if already active or if start is already in progress
- Emergency ID:
  - `id = "{uid}_{Date.now()}"`
- Firestore write:
  - `setDoc(emergencies/{id}, payload)` where payload includes:
    - `userId`, `victimType`
    - `location` and `patientLocation` (same coords, legacy+explicit)
    - `status: "dispatched"`
    - `sessionStatus: "active"`
    - `timestamp`, `updatedAt`
    - `timeline: [{ status:"dispatched", timestamp }]`
- Local state:
  - `currentEmergency` stored in context
  - emergency ID persisted to `expo-secure-store` (`current_emergency_id`)

#### Step C — realtime “active emergency” session
File: `src/context/EmergencyContext.tsx`

- A per-emergency `onSnapshot(doc(emergencies/{id}))` is started when `currentEmergency.id` exists.
- If `sessionStatus` changes away from `"active"`, the context clears the session and removes persisted id.

#### Step D — active emergency screen UX
File: `app/(tabs)/emergency/active.tsx`

Caller can:
- **Share location**:
  - builds a Google Maps link and uses native share sheet
  - optionally tries to open **SMS composer** for each emergency contact (manual send)
  - stores preference in `users/{uid}.autoShareLocationToContacts` (boolean)
- **Share medical info** (only when `victimType === "me"`):
  - reads `users/{uid}`
  - formats a shareable text block (including emergency contacts)
  - uses native share sheet
- **End/cancel emergency**:
  - `updateDoc(emergencies/{id})` sets:
    - `sessionStatus:"cancelled"`
    - `status:"cancelled"`
    - `updatedAt`
    - `timeline: arrayUnion({ status:"cancelled", timestamp })`
  - then clears local emergency context and navigates back

#### Step E — responder handling (doctor + ambulance)
Once the emergency exists:
- approved responders can **read active emergencies** and open them.
- ambulance can **assign** and publish location + status updates.
- doctor can monitor + attach notes (optional).

#### Step F — “handled/resolved”
Ambulance sets `status:"completed"`:
- `sessionStatus` becomes `"resolved"` (see `/ambulance/emergency-detail.tsx`)
- caller’s `EmergencyContext` listener will clear local active emergency automatically

### 3.3 Edge cases and failure scenarios (implemented behavior)

#### Location permission denied
- SOS button still opens victim selection modal, but `locationDataRef` may be null.
- When proceeding, user sees error: `locationNotAvailable`.
- Nearby ambulance screens also show permission error and stop loading.

#### Reverse geocoding fails
- Coordinates are still saved; `address` is null.

#### Duplicate SOS presses / race conditions
Multiple guards exist:
- UI guard in `app/(tabs)/emergency.tsx` (`sosBusy`, `startingEmergency`, modal open)
- context guard in `EmergencyContext.startEmergency()` (`startingRef`)

#### Network failures during setDoc/updateDoc
- The UI generally shows generic “failed to start emergency” / logs the error.
- Firestore offline persistence behavior is the Firebase SDK default; this repo does not explicitly enable/disable it.

#### No responders
There is **no implemented dispatch/notification pipeline**:
- responders see emergencies only if they are actively in-app and their listener works
- there is no escalations, no “no responders found” state machine, and no timeout logic

#### Privacy when helping “someone else”
When `victimType === "other"`:
- responder UIs intentionally avoid fetching user profile (medical info) from `users/{uid}`
- doctor case screen does not subscribe to the patient doc
- ambulance emergency screens show a “privacy mode” message

---

## 4) System Architecture

### 4.1 Frontend architecture

#### Navigation (expo-router)
Key routing structure:
- `app/_layout.tsx`: global providers and `Stack`
- `app/index.tsx`: landing + role-based redirect
- `app/(tabs)/_layout.tsx`: tab bar definition

Main tabs:
- `/(tabs)/index` (home)
- `/(tabs)/emergency` (SOS)
- `/(tabs)/firstaid`
- `/(tabs)/profile`
- `/(tabs)/settings`

Role-specific stacks (non-tab):
- `/doctor/*`
- `/ambulance/*`
- `/admin/*`
- `/auth/*`

#### Global providers / state layers
File: `app/_layout.tsx`
- `LanguageProvider` → translation + RTL
- `AuthProvider` → Firebase auth + role bootstrap
- `EmergencyProvider` → global emergency session tracking + persistence

#### UI composition
The UI is implemented as screen-level components under `app/`.
There is a small shared theme system: `src/ui/theme` (used by several screens).

### 4.2 Backend architecture (Firebase)

This repo uses Firebase as a backend-as-a-service:
- **Auth**: email/password via `firebase/auth`
- **Firestore**: document DB + realtime listeners

There is no server-side API layer in this repo:
- no `functions/` directory with Cloud Functions
- no REST endpoints
- all business logic is client-side + Firestore rules

### 4.3 Database design (Firestore)

The data model is centered around:
- `users/{uid}`
- `emergencies/{id}`

See Section 5 for detailed schema.

---

## 5) Firebase / Firestore — Collections, Fields, Examples, Relationships

### 5.1 `users` collection

Document ID: Firebase Auth `uid`.

#### Core identity / role fields
- `name: string`
- `email: string`
- `phoneNumber: string`
- `israeliId: string` (digits only)
- `role: "user" | "doctor" | "ambulance" | "admin"`
- `approved: boolean`
- `createdAt: ISO string`
- `updatedAt: ISO string` (set by various profile screens)

#### Medical profile fields (user role, but readable by responders/admin per rules)
- `age: string | number`
- `bloodType: string` (UI restricts to common types)
- `height: string | number`
- `weight: string | number`
- `diseases: string`
- `medications: string`
- `allergies: string`
- `sensitiveNotes: string`

#### Emergency contacts
- `emergencyContacts: Array<{ id: string; name: string; phone: string; relationship: string }>`

#### Preferences
- `autoShareLocationToContacts: boolean` (controls SMS auto-share behavior during emergencies)

#### Example `users/{uid}` document

```json
{
  "name": "Dana Levi",
  "email": "dana@example.com",
  "phoneNumber": "052-1234567",
  "israeliId": "123456789",
  "role": "user",
  "approved": true,
  "createdAt": "2026-04-30T12:00:00.000Z",
  "updatedAt": "2026-04-30T12:10:00.000Z",
  "age": "29",
  "bloodType": "O+",
  "height": "165",
  "weight": "62",
  "diseases": "Asthma",
  "medications": "Ventolin as needed",
  "allergies": "Penicillin",
  "sensitiveNotes": "Pregnant - 2nd trimester",
  "autoShareLocationToContacts": true,
  "emergencyContacts": [
    { "id": "1714470000000", "name": "Avi", "phone": "0501234567", "relationship": "Spouse" }
  ]
}
```

### 5.2 `emergencies` collection

Document ID: `"{callerUid}_{timestampMs}"` (created client-side).

#### Fields written on create (SOS)
From `EmergencyContext.startEmergency()`:
- `userId: string` (caller uid)
- `victimType: "me" | "other"`
- `location: { latitude: number; longitude: number; address: string | null }` (legacy)
- `patientLocation: { latitude: number; longitude: number; address: string | null }` (preferred)
- `status: string` (initial `"dispatched"`)
- `sessionStatus: "active" | "resolved" | "cancelled"`
- `timestamp: ISO string`
- `updatedAt: ISO string`
- `timeline: Array<{ status: string; timestamp: ISO string; ambulanceId?: string; doctorId?: string; text?: string }>`

#### Fields written by ambulance
From `/ambulance/emergency-detail.tsx`:
- `assignedAmbulanceId: string | null`
- `ambulanceLocation: { latitude: number; longitude: number } | null`
- updates to `status`:
  - `"en_route"`, `"arrived_patient"`, `"patient_picked"`, `"en_route_hospital"`, `"completed"`
- sets `sessionStatus:"resolved"` when status becomes `"completed"`
- appends timeline events (`arrayUnion`)

#### Fields written by doctor
From `/doctor/case/[id].tsx`:
- `doctorNotes: Array<{ text: string; timestamp: ISO string; doctorId: string }>`
- adds timeline entries like `{ status:"doctor_note", doctorId, text, timestamp }`

#### Example `emergencies/{id}` document

```json
{
  "userId": "callerUid123",
  "victimType": "me",
  "status": "en_route",
  "sessionStatus": "active",
  "timestamp": "2026-04-30T12:05:00.000Z",
  "updatedAt": "2026-04-30T12:08:10.000Z",
  "patientLocation": { "latitude": 32.0853, "longitude": 34.7818, "address": "Tel Aviv, Israel" },
  "location": { "latitude": 32.0853, "longitude": 34.7818, "address": "Tel Aviv, Israel" },
  "assignedAmbulanceId": "ambulanceUid999",
  "ambulanceLocation": { "latitude": 32.0839, "longitude": 34.7791 },
  "timeline": [
    { "status": "dispatched", "timestamp": "2026-04-30T12:05:00.000Z" },
    { "status": "assigned_ambulance", "ambulanceId": "ambulanceUid999", "timestamp": "2026-04-30T12:06:00.000Z" },
    { "status": "en_route", "ambulanceId": "ambulanceUid999", "timestamp": "2026-04-30T12:06:05.000Z" }
  ],
  "doctorNotes": [
    { "text": "Advise CPR until ambulance arrives.", "doctorId": "doctorUid555", "timestamp": "2026-04-30T12:07:30.000Z" }
  ]
}
```

### 5.3 Relationships between collections

- `emergencies.userId` → references `users/{uid}`
- responders read `users/{uid}` to display medical data during `victimType:"me"` cases
- there is no explicit join collection; reads are performed on-demand in the client

### 5.4 Realtime listeners and how they work

Implemented listeners:
- Caller session state:
  - `onSnapshot(doc(db,"emergencies", currentEmergency.id))` in `EmergencyContext`
- Doctor live board:
  - `onSnapshot(query(emergencies, where("sessionStatus","==","active")))` in `app/doctor/dashboard.tsx`
  - `onSnapshot(doc(emergencies,id))` in `app/doctor/case/[id].tsx`
  - `onSnapshot(doc(users, emergency.userId))` in `app/doctor/case/[id].tsx` (only when victimType !== "other")
- Ambulance:
  - `onSnapshot(doc(emergencies,id))` in `app/ambulance/emergency-detail.tsx`
  - `onSnapshot(query(emergencies, where("sessionStatus","==","active")))` in `app/ambulance/nearby-emergencies.tsx`
- User history:
  - `onSnapshot(query(emergencies, where("userId","==",uid), orderBy("timestamp","desc")))` in `app/(tabs)/profile/emergency-history.tsx`
  - note: this requires a composite index (see that file)

---

## 6) Core Logic & Key Files (What they do, how they interact)

### `src/firebase/config.ts`
Responsibilities:
- initialize Firebase app once (safe under fast refresh)
- initialize Firestore with `experimentalForceLongPolling: true` for React Native stability
- enable Firestore debug logging in dev

### `src/context/AuthContext.tsx`
Responsibilities:
- subscribe to Firebase auth state (`onAuthStateChanged`)
- read `users/{uid}` and expose:
  - `user` (Firebase user object)
  - `role` (string)
  - `approved` (boolean)
  - `loading` state while bootstrapping
- provide `logout()` which calls `signOut()`

How it interacts:
- `app/index.tsx` uses `role/approved/loading` to redirect.
- Role-specific screens (doctor/admin) also gate access in `useEffect`.

### `src/context/EmergencyContext.tsx`
Responsibilities:
- provide a global “current emergency session”
- create emergencies (`startEmergency()`)
- persist active emergency ID to `expo-secure-store`
- restore session on app restart:
  - tries stored emergency doc id
  - otherwise queries any `sessionStatus:"active"` emergency for the user
- attach realtime listener to emergency doc and clear session when no longer active

How it interacts:
- `/(tabs)/emergency.tsx` triggers `startEmergency()`
- `/(tabs)/index.tsx` and `/(tabs)/emergency.tsx` use `isEmergencyActive` for UX
- `/(tabs)/emergency/active.tsx` reads `currentEmergency` and can cancel it

### `firestore.rules`
Responsibilities:
- enforce role-based data access
- prevent users from editing other users’ profiles
- prevent callers from updating emergencies except for cancellation
- allow only approved responders to list/read active emergencies

---

## 7) Real-Time Features (Live updates, location tracking, emergency update flow)

### 7.1 Live emergency updates
The system uses Firestore as the event stream.

Updates are written as:
- direct field updates: `status`, `sessionStatus`, `assignedAmbulanceId`, `ambulanceLocation`, `updatedAt`
- append-only event log: `timeline` array via `arrayUnion()`

Subscribers (doctor/ambulance/caller) react to these changes via `onSnapshot()`.

### 7.2 Location tracking

Caller:
- SOS captures a single high-accuracy GPS fix and saves it to the emergency doc.
- No continuous caller tracking is implemented.

Ambulance:
- In `app/ambulance/emergency-detail.tsx`, ambulance can enable GPS publishing:
  - `watchPositionAsync({ timeInterval: 5000, distanceInterval: 10 })`
  - throttles Firestore writes to ~4.5s
  - writes `ambulanceLocation` and ensures `assignedAmbulanceId`
  - only assigned ambulance should publish (logic checks `assignedAmbulanceId`)

Doctor:
- Reads `ambulanceLocation` and displays rough ETA (simple speed assumption).

### 7.3 Emergency updates flow (state machine)

There is a **soft** lifecycle encoded by `status` string:

- Caller creates:
  - `status: "dispatched"`, `sessionStatus: "active"`
- Ambulance updates (buttons):
  - `en_route`
  - `arrived_patient`
  - `patient_picked`
  - `en_route_hospital`
  - `completed` → `sessionStatus` becomes `resolved`
- Caller can cancel:
  - `status:"cancelled"`, `sessionStatus:"cancelled"`

The UI treats `sessionStatus` as the canonical “active session?” indicator.

---

## 8) State Management (Key states + lifecycle)

The app uses **React Context + hooks**, not Redux.

### Auth state
`AuthContext`:
- `loading` true during bootstrap
- `user` set from Firebase Auth
- `role/approved` loaded from `users/{uid}` once on auth change (non-realtime)

Lifecycle:
- login/signup → Auth updates → role read → `app/index.tsx` redirects

### Emergency state
`EmergencyContext`:
- `currentEmergency` is either null or `{ id, sessionStatus, victimType, status? }`
- persisted `current_emergency_id` in SecureStore
- realtime doc listener keeps state in sync

Lifecycle:
- create emergency → set currentEmergency → attach listener
- status changes to resolved/cancelled → context clears + deletes persisted id
- app restart → restore stored id or query active emergency doc

### Language state
`LanguageContext`:
- `lang` stored in SecureStore (`app_lang`)
- applies RTL changes via `I18nManager` and sets `i18n.locale`

---

## 9) External Integrations

### Expo Location
Used in:
- SOS flow (`/(tabs)/emergency.tsx`)
- ambulance dashboards and detail screens
- nearby emergencies feature

### Maps
- **In-app map**: `react-native-maps` in `app/ambulance/emergency-detail.tsx`
- **WebView embedded map**: Google Maps embed in `app/doctor/case/[id].tsx`
- **Deep links to navigation**: `google.navigation:` (Android), Apple Maps scheme (iOS), web fallback

### Sharing (native)
- `Share.share()` for:
  - medical info (profile tab and active emergency)
  - location message

### Phone/SMS deep links
- `tel:` used from emergency contacts screen
- `sms:` used for location auto-share to contacts (opens composer; user must send)

### AI / Notifications / Storage
The `package.json` lists:
- `@anthropic-ai/sdk`
- `nodemailer`

But **no app code currently imports/uses them** in this repo, so treat these as **unused / planned**.

There is also no implementation of:
- push notifications (FCM / expo-notifications)
- cloud storage uploads
- camera scanner

---

## 10) Error Handling & Edge Cases

Implemented patterns:
- `try/catch` around Firestore reads/writes with `Alert.alert()` on common failure paths
- realtime listener error callbacks log errors

Important edge cases to know:
- **Emergency history query** uses `where(userId==uid) + orderBy(timestamp desc)` and may require a **composite Firestore index** (the screen includes a note).
- **Location permission denied** blocks ambulance nearby filtering and SOS emergency creation.
- **Helping “someone else”** disables medical profile access intentionally (privacy).

---

## 11) Current Problems / Missing Features (Implementation Gaps)

These are concrete issues or missing pieces based on the current codebase.

### Missing: dispatch/notification pipeline
- No FCM / push notification registration.
- No server-side matching of volunteers/responders.
- No escalation logic for “no responders found”.

### Potential problem: ambulance dashboard queries are too broad
`app/ambulance/dashboard.tsx` subscribes to **all emergencies** (`query(emergenciesRef)` without `where(sessionStatus=="active")`), which:
- increases read costs
- may include resolved/cancelled history
- is slower and noisier than necessary

### Potential problem: admin user deletion is incomplete
Admin panel deletes only the Firestore `users/{uid}` doc:
- does **not** delete Firebase Auth user
- does not clean related `emergencies` docs
- can leave orphaned auth accounts or incident data

### Data model: timeline and notes arrays will grow forever
Storing every event in an array field will eventually hit document size limits.
For production, consider subcollections (see improvements section).

### Security: Firebase config is committed
`src/firebase/config.ts` contains Firebase project config. This is not a secret by itself, but:
- you must rely on Firestore rules and Auth, not secrecy of config
- ensure rules are deployed and tested

### Product mismatch: README lists features not present
The README mentions:
- AI symptom checker
- kit scanner
- offline mode
- vitals monitoring
- live video/audio support

Those are not implemented in the code currently (no screens/services).

---

## 12) Code Quality Notes + Suggested Improvements

### Suggested improvements (high priority)
- **Introduce typed models** for Firestore documents:
  - `UserDoc`, `EmergencyDoc`, timeline event type union
- **Centralize Firestore operations** into a service layer:
  - avoid duplicating `getDoc(doc(db,"users",uid))` across screens
- **Replace array growth fields** (`timeline`, `doctorNotes`) with subcollections:
  - `emergencies/{id}/timelineEvents/{eventId}`
  - `emergencies/{id}/doctorNotes/{noteId}`
- **Add responder notifications**:
  - FCM topic or geofenced dispatch, likely requires Cloud Functions
- **Fix ambulance dashboard query scope**:
  - filter `sessionStatus == "active"` (and potentially region-based filtering)
- **Improve authorization gating**:
  - some ambulance screens do not explicitly redirect if role is not ambulance

### Suggested improvements (medium)
- **Handle location permission denial** more gracefully:
  - allow SOS creation with “location unknown”, or prompt for manual address entry
- **Make status machine explicit**:
  - use enums and restrict transitions client-side
- **Add analytics/observability**:
  - log emergency lifecycle events for debugging and metrics

---

## 13) Deployment & Environment

### Local development
From `package.json`:

- `npm install`
- `npm run start` (Expo dev server)
- `npm run android` / `npm run ios` / `npm run web`

### Firebase configuration
- Firebase project config is currently hardcoded in `src/firebase/config.ts`.
- Firestore rules are in `firestore.rules` and referenced by `firebase.json`.

To deploy rules:
- Use Firebase CLI (not included in this repo’s scripts). Typical workflow:
  - `firebase login`
  - `firebase use <project>`
  - `firebase deploy --only firestore:rules`

### Expo configuration
- `app.json` configures:
  - location permissions for iOS/Android
  - plugins: `expo-router`, `expo-location`, `expo-secure-store`, `expo-web-browser`

---

## 14) Beginner-Friendly Explanation (super simple)

ResQNow is an app where:
- A normal user can press **SOS**.
- The app saves an “emergency ticket” in Firebase (with the user’s location).
- Doctors and ambulances (who are approved) watch Firebase in real time and see emergencies as they appear.
- An ambulance can take the case, update its status, and share its live GPS location.
- The user can cancel the SOS, and everyone sees that update instantly.

---

## 15) TL;DR

- **Main data**: `users/{uid}` and `emergencies/{id}` in Firestore.
- **SOS**: creates `emergencies` doc with `sessionStatus:"active"` + `status:"dispatched"` and a `timeline` entry.
- **Realtime**: `onSnapshot()` powers dashboards and active session syncing.
- **Roles**: `user`, `doctor`, `ambulance`, `admin`; responders require `approved:true`.
- **Ambulance**: can claim case, publish GPS, update status to `completed` (resolves session).
- **Gaps**: no push notifications/dispatch pipeline; some queries are broad; arrays can grow unbounded.

