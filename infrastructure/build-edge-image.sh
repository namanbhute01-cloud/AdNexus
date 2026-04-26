#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_ROOTFS="${1:-/tmp/adnexus-edge-rootfs}"
CFG_DIR="$TARGET_ROOTFS/etc/adnexus"
OPT_DIR="$TARGET_ROOTFS/opt/adnexus"

echo "[1/10] Preparing rootfs at $TARGET_ROOTFS"
mkdir -p "$TARGET_ROOTFS" "$CFG_DIR" "$OPT_DIR"

echo "[2/10] Installing system packages"
cat >"$TARGET_ROOTFS/.packages.txt" <<'PKG'
python3.11
python3-pip
mpv
ffmpeg
network-manager
cryptsetup
lvm2
ca-certificates
PKG

echo "[3/10] Copying edge applications"
mkdir -p "$OPT_DIR/edge-agent" "$OPT_DIR/edge-player"
cp -r "$ROOT_DIR/apps/edge-agent/"* "$OPT_DIR/edge-agent/"
cp -r "$ROOT_DIR/apps/edge-player/"* "$OPT_DIR/edge-player/"

echo "[4/10] Installing Python dependencies manifest"
cat >"$OPT_DIR/install-python-deps.sh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
python3 -m pip install --upgrade pip
python3 -m pip install -r /opt/adnexus/edge-agent/requirements.txt
python3 -m pip install -r /opt/adnexus/edge-player/requirements.txt
SH
chmod +x "$OPT_DIR/install-python-deps.sh"

echo "[5/10] Creating systemd service files"
mkdir -p "$TARGET_ROOTFS/etc/systemd/system"
cat >"$TARGET_ROOTFS/etc/systemd/system/adnexus-agent.service" <<'UNIT'
[Unit]
Description=AdNexus Edge Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/adnexus/edge-agent/agent.py
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT

cat >"$TARGET_ROOTFS/etc/systemd/system/adnexus-player.service" <<'UNIT'
[Unit]
Description=AdNexus Edge Player
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/adnexus/edge-player/player.py
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT

echo "[6/10] Enabling systemd services metadata"
mkdir -p "$TARGET_ROOTFS/etc/systemd/system/multi-user.target.wants"
ln -sf /etc/systemd/system/adnexus-agent.service "$TARGET_ROOTFS/etc/systemd/system/multi-user.target.wants/adnexus-agent.service"
ln -sf /etc/systemd/system/adnexus-player.service "$TARGET_ROOTFS/etc/systemd/system/multi-user.target.wants/adnexus-player.service"

echo "[7/10] Writing read-only rootfs and OverlayFS hints"
cat >"$TARGET_ROOTFS/etc/fstab" <<'FSTAB'
# AdNexus edge image fstab
/dev/root / ext4 ro,defaults 0 1
overlay / overlay lowerdir=/,upperdir=/var/overlay/upper,workdir=/var/overlay/work 0 0
tmpfs /media/rambuf tmpfs defaults,size=6G 0 0
FSTAB

echo "[8/10] Writing NetworkManager priority profile hints"
mkdir -p "$TARGET_ROOTFS/etc/NetworkManager/conf.d"
cat >"$TARGET_ROOTFS/etc/NetworkManager/conf.d/99-adnexus-priority.conf" <<'NM'
[connection-wifi]
autoconnect-priority=100

[connection-4g]
autoconnect-priority=10
NM

echo "[9/10] Writing LUKS + first-boot provisioning notes"
cat >"$TARGET_ROOTFS/etc/adnexus/provisioning-notes.txt" <<'TXT'
1) Encrypt /dev/nvme0n1 with LUKS during image install.
2) On first boot, generate device keypair and CSR.
3) Register device using /api/v1/auth/register-device.
4) Store issued certs under /etc/adnexus/certs/.
TXT

echo "[10/10] Creating /etc/adnexus/config.json.template"
mkdir -p "$CFG_DIR/certs"
cat >"$CFG_DIR/config.json.template" <<'JSON'
{
  "device_id": "EV-0042",
  "serial_number": "EV-0042",
  "api_url": "https://api.adnexus.io",
  "mqtt_broker": "mqtts://broker.adnexus.io:8883",
  "cert_path": "/etc/adnexus/certs/device.crt",
  "key_path": "/etc/adnexus/certs/device.key",
  "ca_path": "/etc/adnexus/certs/ca.crt",
  "media_path": "/media/campaigns",
  "config_path": "/config",
  "heartbeat_interval_s": 30,
  "schedule_sync_interval_s": 900,
  "telemetry_interval_s": 60,
  "lvco_voltage_threshold": 11.0,
  "ignition_off_delay_s": 60,
  "screens": ["A", "B", "C"]
}
JSON

echo "Edge image filesystem scaffold complete: $TARGET_ROOTFS"
echo "Next: integrate this script with your Ubuntu image builder (Packer/PIgen/custom installer)."

