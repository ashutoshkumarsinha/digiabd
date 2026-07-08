# End User Guide — Digital ABD

## 1. Who this guide is for

This guide is for business users and operational users of Digital ABD:

- Field Engineer
- Site Supervisor
- Inspector / OIC
- GIS Engineer
- NOC Operator
- Program Manager
- Auditor
- Enterprise Admin

## 2. Accessing the platform

## 2.1 Web portal

- Open the web URL provided by your administrator.
- For local environments, this may be:
  - Direct web dev server: `http://localhost:5173`
  - Via Caddy: `http://localhost:8088`

## 2.2 Mobile app

- Install the Expo/mobile app build shared by your administrator.
- Ensure location permission is granted for field capture.

## 2.3 Sign-in methods

- **Dev/hybrid mode**: login with approved email.
- **OIDC mode**: authenticate through enterprise SSO/Keycloak.

If login fails:

1. Verify your account is active.
2. Verify network connectivity.
3. Confirm your assigned role allows access.

## 3. Core concepts

- **Project**: top-level construction program
- **Route**: subdivision of project alignment
- **Segment**: chainage-bounded work unit for field capture
- **Completeness**: percentage of mandatory ABD records captured
- **Deviation**: approved exception from design
- **Sign-off**: final OIC approval of a segment

## 4. Standard user workflows

## 4.1 Field Engineer workflow

1. Sign in.
2. Open project and route.
3. Create/select segment.
4. Capture field data:
   - trench
   - duct
   - cable
   - survey points
   - closures
   - photos
5. Submit segment for review.

### Tips

- Use clear photos with correct phase (before/during/after).
- Validate chainage and depth values before submit.
- Sync mobile queue as soon as network is available.

## 4.2 Site Supervisor workflow

1. Review submitted segments for completeness.
2. If mismatch exists, create deviation with proper justification.
3. Forward for OIC approval when quality criteria are met.

## 4.3 OIC workflow

1. Review deviations and either approve/reject/return.
2. Validate compliance checkpoints.
3. Sign off segment when no blocking issues remain.

## 4.4 GIS Engineer workflow

1. Export route GeoJSON and review feature metadata.
2. Trigger CAD generation/ETL jobs where needed.
3. Verify artifacts and data quality.

## 4.5 NOC Operator workflow

1. Open NOC lookup endpoint/screen.
2. Search by:
   - segment id
   - chainage
   - coordinates
3. Use returned route/asset/deviation context for fault localization.

## 4.6 Program Manager workflow

1. Open governance dashboard.
2. Review:
   - completeness
   - open deviations
   - escalations
   - project SLA status
3. Evaluate escalation rules and coordinate remediation.

## 4.7 Auditor workflow

1. Open audit/compliance screens.
2. Export audit package for route/project.
3. Validate traceability, approvals, and checkpoints.

## 5. Mobile offline usage

When network is poor/unavailable:

1. Continue capturing records (queued offline).
2. Confirm pending queue count in app.
3. Use Sync action when connectivity returns.
4. Confirm queue is cleared after successful sync.

If sync fails:

- Do not clear app data.
- Retry sync later.
- Notify support if failures persist.

## 6. Governance dashboard interpretation

Common KPIs:

- **ABD completeness rate**: quality/coverage of segment records
- **Open deviations**: unresolved compliance exceptions
- **Open escalations**: active governance alerts
- **SLA status**: compliance indicator (compliant/at-risk/non-compliant)

Recommended actions:

- Rising open deviations: inspect approval bottlenecks
- Low completeness: target field capture remediation
- Frequent escalations: tune thresholds and process discipline

## 7. Common errors and what to do

- **401 Unauthorized**
  - token expired/invalid; log in again
- **403 Forbidden**
  - role does not permit this action; request proper role
- **422 Incomplete package**
  - missing mandatory records; complete missing items and resubmit
- **413 Payload too large**
  - photo/file exceeds size limit; compress or retry with smaller file

## 8. Role-to-capability quick map

| Role | Key capabilities |
|---|---|
| field_engineer | capture and submit field records |
| site_supervisor | review records, manage deviation flow |
| inspector_oic | approve deviations, sign-off |
| gis_engineer | GIS/CAD/ETL operations |
| noc_operator | lookup and fault triage |
| program_manager | governance dashboard, escalations |
| auditor | read-only compliance/audit exports |
| enterprise_admin | broad governance/admin visibility |

## 9. Best practices

- Use standardized naming and consistent metadata.
- Attach evidence as close to capture time as possible.
- Resolve deviations before end-of-day where practical.
- Avoid sharing credentials; use assigned accounts only.
- Report suspicious access/activity immediately.

## 10. Support and escalation

When raising support tickets, include:

- user email and role
- time of issue
- endpoint/screen affected
- project/route/segment identifiers
- request ID (if available from API response headers/logs)

Escalate urgent incidents (production outage, data access issue, security concern) to platform operations immediately.
