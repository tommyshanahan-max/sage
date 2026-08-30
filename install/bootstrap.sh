#!/usr/bin/env bash
# Prepare a fresh Ubuntu 22.04/24.04 VPS to run this workspace.
# Run as root on the VPS:  sudo bash install/bootstrap.sh
set -euo pipefail

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run this as root (sudo bash install/bootstrap.sh)"
command -v apt-get >/dev/null || die "this script targets Debian/Ubuntu"

export DEBIAN_FRONTEND=noninteractive

log "Updating base packages"
apt-get update -qq
apt-get upgrade -y -qq
# git and make are not in Ubuntu's cloud image. git is needed to fetch this
# repo in the first place, make to run it — without them the deploy stops at
# "command not found" after everything else has succeeded.
apt-get install -y -qq ca-certificates curl git gnupg make ufw fail2ban unattended-upgrades

log "Enabling BBR congestion control"
# The default (CUBIC) collapses its window hard on loss. Long-haul links into
# Japan see steady background loss, so CUBIC spends most of its time backed off.
# BBR paces on measured bandwidth and round-trip time instead, which is the
# difference between a usable and an unusable editor session on a lossy path.
cat > /etc/sysctl.d/99-tomscoding-network.conf <<'SYSCTL'
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
net.ipv4.tcp_slow_start_after_idle = 0
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.ipv4.tcp_mtu_probing = 1
SYSCTL
sysctl --quiet --load /etc/sysctl.d/99-tomscoding-network.conf

active_cc=$(sysctl -n net.ipv4.tcp_congestion_control)
if [[ $active_cc == "bbr" ]]; then
  log "Congestion control is now: bbr"
else
  warn "congestion control is '$active_cc', not bbr — kernel may lack the module"
fi

log "Installing Docker Engine"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu %s stable\n' \
    "$(dpkg --print-architecture)" "$(. /etc/os-release && echo "$VERSION_CODENAME")" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
else
  log "Docker already present, skipping"
fi
systemctl enable --now docker

log "Configuring firewall"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow "${SSH_PORT:-22}"/tcp comment 'ssh' >/dev/null
ufw allow 80/tcp comment 'http (acme)' >/dev/null
ufw allow 443/tcp comment 'https' >/dev/null
ufw --force enable >/dev/null
ufw status verbose

log "Enabling fail2ban for SSH"
systemctl enable --now fail2ban

log "Enabling unattended security upgrades"
dpkg-reconfigure -f noninteractive unattended-upgrades

if [[ ! -f /swapfile ]] && [[ $(free -m | awk '/^Mem:/{print $2}') -lt 4096 ]]; then
  log "Adding a 2G swapfile (small VPS, builds will need it)"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "Done. Next steps:"
cat <<'NEXT'

  1. Point an A record for your domain at this VPS's public IP.
     Confirm it has propagated before continuing:  dig +short your.domain
  2. cp .env.example .env  &&  edit .env
  3. make up
  4. Open https://your.domain and log in with TOMSCODING_PASSWORD.

  This script did NOT change your SSH configuration. Hardening it is worth
  doing by hand, so you can verify a second session still works before you
  close the first: disable password auth and root login in
  /etc/ssh/sshd_config once your key is confirmed working.

NEXT
