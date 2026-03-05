# File Upload & Management Updates

Last updated: 2026-03-04

## Objective
Align implementation with Prompt 10 for file upload, gallery, and deliverable version workflows.

## Implemented

### 1) Reusable Upload Foundation
- Added `src/services/fileService.js`:
  - `uploadToStorage(file, path, onProgress?)`
  - `handleGoogleDriveLink(link, context?)`
  - `deleteFile(fileUrl)`
  - `getFileMetadata(fileUrl)`
- Added reusable `src/components/common/FileUploader.jsx`:
  - drag and drop
  - browse file picker
  - size/type validation
  - upload progress
  - Google Drive and external link support
  - inline file removal

### 1.1) Google Drive Link Persistence Access
- Added Firestore rule support for `fileLinks` used by `handleGoogleDriveLink(...)`.
- `fileLinks` access is now creator/admin scoped:
  - creator can create/read/update/delete own link records
  - admin can read/update/delete all
- Added `createdBy` attribution in link records from authenticated client session.

### 2) File Gallery
- Added `src/components/projects/FileGallery.jsx`:
  - grid file display
  - image thumbnails
  - download/open
  - optional delete
  - image lightbox
  - Google Drive awareness

### 3) Deliverable Upload Flow
- Added `src/components/projects/DeliverableUploader.jsx`:
  - multi-file upload
  - revision round
  - version note
  - mark latest toggle
  - explicit upload target (`wip`, `revisions`, `final`)
- Wired into project workspace production tab.
- Extended `projectService.addDeliverableLink(...)` to support metadata:
  - `revisionRound`
  - `isLatest` (auto-demotes previous latest)
  - `files` payload
  - `targetFolder` payload

### 4) Client Reference Files
- Wired `FileUploader` into new project request step 3.
- Reference uploads are now persisted and passed into project creation payload (`referenceFiles`).

### 5) Brand Assets Upload
- Wired `FileUploader` into client quick actions brand assets modal:
  - logos uploads
  - fonts uploads
  - guideline files uploads
- Existing URL/manual entry remains supported.

### 6) Template Contributions Upload
- Wired `FileUploader` into creative template contributions.
- Supports either direct link or uploaded file URL for submission.

### 7) Storage Rules
- Added `storage.rules` with role-aware access and size cap:
  - clients own brand-assets and project folders
  - creatives on assigned/member projects
  - admins full access
  - max file size enforced at 50MB
- Added owner-based delete guard:
  - uploader identity is stored as `customMetadata.createdBy`
  - non-admin deletion is allowed only for uploader-owned objects
  - UI delete action now mirrors this rule using file `createdBy`
- Added storage rules config in `firebase.json`.

## Files Updated
- `src/services/fileService.js`
- `src/components/common/FileUploader.jsx`
- `src/components/projects/FileGallery.jsx`
- `src/components/projects/DeliverableUploader.jsx`
- `src/components/projects/NewProjectModal.jsx`
- `src/components/creative/ProjectWorkspace.jsx`
- `src/components/creative/TemplateContributionsCard.jsx`
- `src/components/dashboard/CreativeDashboard.jsx`
- `src/components/client/QuickActionsPanel.jsx`
- `src/services/projectService.js`
- `src/services/creativeService.js`
- `storage.rules`
- `firebase.json`

## Validation
- `npm run lint` passed.
- `npm run build` passed.
- `npm --prefix functions run lint` passed.

## Current Known Limitation
- Very large-file fallback (>10MB) is currently link-first (Google Drive/Figma/external) rather than background chunking to Storage.

## 2026-03-04 Alignment Pass
- Added `image/jpg` to default accepted upload MIME list.
- Improved oversize validation message in `FileUploader` to explicitly instruct link-based fallback (Google Drive/Figma) for files above configured upload limit.
