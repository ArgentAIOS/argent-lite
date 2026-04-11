# Hailo-10H Setup (Raspberry Pi AI HAT+ 2)

<!--
Reference: Pudding Entertainment, "Running LLMs on Raspberry Pi 5 with the
Hailo-10H AI HAT+", Medium (2025). URL recorded in slice JOURNAL — fetch
fresh before retrying.
-->

## Hardware

- Raspberry Pi 5 (16 GB), Debian 12 (bookworm)
- Raspberry Pi AI HAT+ 2 carrying a **Hailo-10H** accelerator
- PCIe Gen 3 x4 link from the Pi 5 PCIe FPC connector

## One-time install (Debian 12 / Pi OS bookworm)

1. Update apt and install the Hailo-all metapackage:

   ```bash
   sudo apt update
   sudo apt install -y hailo-all
   ```

   This pulls the kernel module (`hailo_pci`), `hailortcli`, the runtime
   libraries, and udev rules.

2. Force PCIe Gen 3 + disable ASPM in `/boot/firmware/config.txt`:

   ```ini
   dtparam=pciex1
   dtparam=pciex1_gen=3
   ```

   Append `pcie_aspm=off` to the kernel command line in
   `/boot/firmware/cmdline.txt` (single line, space-separated).

3. Reboot:

   ```bash
   sudo reboot
   ```

## Purge order if a Hailo-8 stack was previously installed

The Hailo-8 and Hailo-10H runtimes can collide. Remove the old stack
before installing `hailo-all`:

```bash
sudo apt purge -y 'hailo-8*' 'hailort*' 'hailo-tappas*' || true
sudo apt autoremove -y
sudo rm -f /etc/modprobe.d/hailo*.conf
sudo reboot
```

Then run the install steps above.

## Smoke test

After reboot, run:

```bash
scripts/hailo-setup.sh   # full probe; writes /tmp/hailo-setup-<ts>.log
scripts/hailo-check.sh   # thin pass/fail for CI and nightly smoke
```

`hailo-check.sh` exits 0 iff `hailortcli fw-control identify` reports a
Hailo-10H. Wire this into the nightly smoke once the board is installed.

## Runtime probe from TypeScript

`src/providers/hailo-runtime.ts` exposes `probeHailo()` for the router and
health endpoints. It shells out to `hailortcli fw-control identify` and
returns a structured result; it never throws.
