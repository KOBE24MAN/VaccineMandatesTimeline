# Known Issues

- `VIC-086` and `WA-052` have no effective or enforcement date in the approved source workbook. They remain accessible through the API and search but cannot be positioned as normal dated bars on the timeline.
- `WA-032` has a source duration of -50 days because its recorded date sequence is inconsistent. It is preserved and marked `date_uncertain`.
- The approved workbook contains no blank removal dates, so the final release has zero derived ongoing mandates.
- The timeline is optimized for desktop and laptop screens. Narrow mobile screens can display the interface, but the full three-panel workflow is less convenient.
- Azure resources and the public URL must be provisioned before the client package can pass its remote health check.
