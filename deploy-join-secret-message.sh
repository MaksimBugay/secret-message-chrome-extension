#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ssh_key="${SSH_KEY:-$HOME/.ssh/pushca-backend.key}"
remote_host="${DEPLOY_HOST:-root@148.251.49.213}"
remote_dir="/data/nginx-pusher/data"

# The page is self-contained: styles, logo and script are inline.
files=(
  web/join-secret-message.html
)

[[ -f "$ssh_key" ]] || { echo "SSH key not found: $ssh_key" >&2; exit 1; }
for file in "${files[@]}"; do
  [[ -f "$script_dir/$file" ]] || { echo "File not found: $script_dir/$file" >&2; exit 1; }
done

# Keep the path short: OpenSSH adds a temporary suffix to its Unix socket.
control_dir="$(mktemp -d /tmp/jsm.XXXXXX)"
control_socket="$control_dir/s"
cleanup() {
  if [[ -S "$control_socket" ]]; then
    ssh -i "$ssh_key" -S "$control_socket" -O exit "$remote_host" >/dev/null 2>&1 || true
  fi
  rm -f "$control_socket"
  rmdir "$control_dir"
}
trap cleanup EXIT

# Authenticate once; reuse the connection for all remaining commands.
ssh -i "$ssh_key" -M -N -f -S "$control_socket" "$remote_host"
ssh_options=(-i "$ssh_key" -o BatchMode=yes -o ControlMaster=auto -o "ControlPath=$control_socket")
ssh "${ssh_options[@]}" "$remote_host" "mkdir -p '$remote_dir'"

# Published at the site root: web/join-secret-message.html → $remote_dir/join-secret-message.html.
for file in "${files[@]}"; do
  scp "${ssh_options[@]}" "$script_dir/$file" "$remote_host:$remote_dir/$(basename "$file")"
done

echo "Join page deployed to $remote_host:$remote_dir"
