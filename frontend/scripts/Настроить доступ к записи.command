#!/bin/bash
# Run the same signed application in its explicit one-time setup mode.
script_dir="$(cd "$(dirname "$0")" && pwd)"
app_path="${script_dir}/A Little Universe for You.app"
if [[ ! -d "$app_path" ]]; then
  osascript -e 'display alert "Приложение не найдено" message "Поместите этот файл рядом с A Little Universe for You.app и запустите снова."'
  exit 1
fi
/usr/bin/open -n -a "$app_path" --args --setup-recording-permissions
