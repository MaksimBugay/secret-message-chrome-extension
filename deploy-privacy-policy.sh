#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ssh_key="${SSH_KEY:-$HOME/.ssh/pushca-backend.key}"
remote_host="${DEPLOY_HOST:-root@148.251.49.213}"
remote_dir="/data/nginx-pusher/data"

# The page is self-contained: styles and logo are inline. Paths under web/ are the paths on the site.
files=(
  web/privacy/secret-message-privacy.html
)

[[ -f "$ssh_key" ]] || { echo "SSH key not found: $ssh_key" >&2; exit 1; }
for file in "${files[@]}"; do
  [[ -f "$script_dir/$file" ]] || { echo "File not found: $script_dir/$file" >&2; exit 1; }
done

# Keep the path short: OpenSSH adds a temporary suffix to its Unix socket.
control_dir="$(mktemp -d /tmp/smp.XXXXXX)"
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
ssh "${ssh_options[@]}" "$remote_host" "mkdir -p '$remote_dir/privacy'"

# web/privacy/secret-message-privacy.html → $remote_dir/privacy/secret-message-privacy.html.
for file in "${files[@]}"; do
  scp "${ssh_options[@]}" "$script_dir/$file" "$remote_host:$remote_dir/${file#web/}"
done

echo "Privacy policy deployed to $remote_host:$remote_dir/privacy"
