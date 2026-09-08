# POSTFY — Database Schema & Data Models

## Entidades Principais
1. **Workspace**: `id`, `name`, `slug`, `logo`, `primaryColor`, `customDomain`, `whiteLabelEnabled`, `plan`.
2. **User / Member**: `id`, `name`, `email`, `avatar`, `role` (Owner, Admin, Manager, SocialMedia, Designer, Copywriter, Client), `teams`.
3. **Client**: `id`, `workspaceId`, `name`, `legalName`, `email`, `phone`, `avatar`, `status`, `healthScore`, `services`, `contacts`, `portalToken`.
4. **Job / Content**:
   - `id`, `workspaceId`, `clientId`, `title`, `campaign`, `platform` (instagram, facebook, linkedin, tiktok, youtube), `format` (feed, carousel, reel, story, text), `priority`, `status` (ideas, in_production, for_approval, in_adjustment, approved, scheduled, published).
   - `copy`, `caption`, `firstComment`, `hashtags`, `mediaUrls`, `cta`, `currentVersion`.
   - `scheduledDate`, `deadlineProduction`, `deadlineApproval`, `publishedDate`.
   - `versions`: Lista de versões (`versionNumber`, `mediaUrls`, `caption`, `submittedBy`, `submittedAt`, `feedback`, `status`).
5. **Approval / Adjustment**: `id`, `jobId`, `status`, `reviewedBy`, `reviewedAt`, `feedbackText`, `versionNumber`.
6. **Lead & Opportunity**: `id`, `name`, `company`, `email`, `phone`, `source`, `value`, `stage`, `proposalId`.
7. **Proposal & Contract**: `id`, `clientId`, `title`, `items`, `totalValue`, `status`, `acceptedAt`.
8. **Notification & ActivityLog**: `id`, `title`, `message`, `type`, `read`, `timestamp`, `metadata`.
9. **Automation**: `id`, `title`, `trigger`, `action`, `enabled`, `lastRunAt`.
