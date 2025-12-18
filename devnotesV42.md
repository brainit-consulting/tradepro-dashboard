## Dev Notes - V042

- Build: V042; base on V041; add Import settings, Test connection, and overdue/at-risk indicators.
- Import: loads JSON backup into the modal and requires explicit Save settings to persist.
- Test: checks Read URL and reports latency + revision when available.
- Risk: Overdue when due date is before today; At Risk when due in 7 days or less and progress < 50%.
- No other changes.

