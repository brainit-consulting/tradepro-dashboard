## Dev Notes - V049

- Build: V049; based on V048.
- Checkpoint editor: added collapse/expand toggle plus vertical scroll (max-height 280px) so long lists don't overflow. Text inputs remain full-width and visible.
- Toggle defaults to expanded when opening branch editor; auto-expands when adding a new checkpoint.
- Backend (n8n POST/GET) now preserves checkpoints as `{ text, done }` objects so checkboxes round-trip correctly; added shape guards for GET defaults.
- Current live data (rev 194): branches roofers/plumbers/electricians with updated checkpoints (roofers mostly checked; plumbers only n8n workflows checked; electricians n8n workflows + ai agents checked).
