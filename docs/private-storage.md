# KOPPKAS private document storage

The `20261118170000_private_document_storage.sql` migration creates the private `koppkas-documents` bucket.

## Upload rules

- Maximum file size: 25 MB.
- Allowed MIME types: JPEG, PNG, WebP, PDF, MP4.
- Objects are stored under `<profile-uuid>/<random-id>-<safe-filename>`.
- Only active media roles can upload or read: Ketua Pemuda, Wakil Ketua, Sekretaris, Ketua RW, and Ketua RT.
- An uploader can mutate only objects in their own profile folder; Ketua, Wakil, and Sekretaris have administrative cleanup access.
- Bucket is private. The dashboard creates signed URLs with a 10-minute expiry.
- Media metadata is stored as `visibility='internal'`; no anonymous file access is enabled.

## Operational notes

Apply the migration before enabling uploads. The implementation uses Supabase Storage's free-tier bucket; monitor the project's included storage and egress quotas. No paid add-on is required for the feature, but usage beyond free limits may require a plan change. There is no malware scanning in this MVP, so only upload files from trusted organization members.
