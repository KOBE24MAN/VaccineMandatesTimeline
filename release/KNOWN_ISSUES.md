# Known Issues

- `VIC-086` and `WA-052` have no effective or enforcement date in the approved source workbook. They remain accessible through the API and search but cannot be positioned as normal dated bars on the timeline.
- `WA-032` has a source duration of -50 days because its recorded date sequence is inconsistent. It is preserved and marked `date_uncertain`.
- The approved workbook contains no blank removal dates, so the final release has zero derived ongoing mandates.
- The timeline is optimized for desktop and laptop screens. Narrow mobile screens can display the interface, but the full three-panel workflow is less convenient.
- Docker Desktop 4.88.1 has a workstation-specific Windows socket startup failure. Ubuntu WSL 2 Docker and the non-Docker local fallback remain available.
- The public Azure demo has a minimum of zero replicas. The first request after an idle period may experience a cold-start delay.
- Workbook changes are not loaded automatically. A changed approved workbook requires a new data build, acceptance run, image tag, and Azure revision.
