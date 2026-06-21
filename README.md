# Meridian Nexus

Meridian Nexus landing page and temporary shared file workspace, hosted on Firebase.

## Features

- Responsive Meridian Nexus landing page and PWA
- Temporary `Files` navigation view
- Resumable, multi-file uploads with no application-level size or type restriction
- Live Firestore-backed file list
- Single, selected, or select-all downloads
- Selected or select-all deletion

## Firebase services

- Hosting serves `public/`
- Storage keeps objects under `uploads/{fileId}/{fileName}`
- Firestore keeps matching metadata in `files/{fileId}`

The Files workspace is intentionally public and temporary. Firestore and Storage rules automatically deny access after **20 July 2026**. Add authentication and owner/admin rules before extending access.

## Commands

```bash
firebase emulators:start
firebase deploy --only hosting,firestore:rules,firestore:indexes,storage
```
