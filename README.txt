SR Lumapas Attendance — Netlify Pilot v1.0

Adds Term & YTD Main Attendance reporting while preserving:
- v0.9 Admin School Dashboard
- v0.8 Monthly Statistics
- v0.7 Teacher Signup & Access
- v0.6 Student Management

New reporting:
- Term 1-4 reports using database term dates
- YTD report with configurable as-of date
- Cumulative attendance
- Average attendance ratio
- Attendance percentage
- Male/female cumulative attendance
- Monthly breakdown
- Daily breakdown
- Missing-register visibility
- Gender-completeness warning
- UTF-8 CSV export designed to open cleanly in Excel

Important:
- Missing registers are never treated as zero attendance.
- Average/percentage use completed registers only.
- CCA attendance is excluded and remains separate.

Deploy to the SAME Netlify project. Previous deploys remain available for rollback.
