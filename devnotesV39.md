## Dev Notes - V039

- Build: V039; base on V038; add Backup settings button in Server settings modal.
- Backup: exports current saved server settings to a JSON file; blocks backup if required fields are missing.
- No other changes.
- The backup downloads as tpb_server_settings_YYYY-MM-DDTHH-MM-SS-MMMZ.json (timestamp from your system clock). It saves to your browser’s default Downloads location unless the browser is set to prompt for a save location.
-Edge’s default is your user Downloads folder:
C:\Users\snake\Downloads

-If you enabled “Ask me what to do with each download,” it will prompt you instead.

