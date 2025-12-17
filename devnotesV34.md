## Dev Notes – V034

- Build: V034; base on V033 (filters + owner/tags/due date + progress chart), added move controls.
- Reordering: new up/down buttons per branch; works with current filtered view; drag-and-drop still present but desktop-only.
- Layout: branch row grid widened to fit move controls; branch meta line uses pipe separators.
- State: branch metadata (owner, tags, dueDate, priority) remains local-only (`tpb_branch_meta_v1`); server payload unchanged.
- Saving: Save/Refresh behavior unchanged from V033 (warning about refresh gating added in V035).
- iPad/mobile: up/down buttons are the primary accessible reorder method; drag handle is optional.
