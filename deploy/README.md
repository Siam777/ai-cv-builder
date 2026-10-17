# AI CV Builder — Deployment & CI/CD Guide

This guide covers deployment of AI CV Builder to Ubuntu 24.04 (Contabo VPS or similar) using Docker Compose and GitHub Actions.

## Architecture

- **Next.js 16 Standalone Container**: Node 20 runtime, non-root user (`nextjs:nodejs`, UID 10001), listening on `0.0.0.0:3000`.
- **Docker Compose**: Maps container to host `127.0.0.1:7892`.
- **Nginx Reverse Proxy**: Terminates TLS (`https://cv.elfasyssolution.com`), provides Let's Encrypt certificates, disables buffering for real-time AI token streaming, and reverse-proxies to `127.0.0.1:7892`.
- **GitHub Actions**: Runs lint, typechecks, unit tests, and production build verification, then executes zero-downtime SSH remote deployment on the VPS.

---

## 1. Initial VPS Setup (One-Time)

### Create Directories
On the VPS as root or sudo user:
```bash
sudo mkdir -p /opt/elfasys/repos/ai-cv-builder
sudo mkdir -p /opt/elfasys/config/ai-cv-builder
sudo mkdir -p /opt/elfasys/data/ai-cv-builder/data

# Ensure deploy user ownership
sudo chown -R deploy:deploy /opt/elfasys/repos/ai-cv-builder
sudo chown -R deploy:deploy /opt/elfasys/config/ai-cv-builder
sudo chown -R 10001:10001 /opt/elfasys/data/ai-cv-builder
```

### Clone the Repository
```bash
git clone <YOUR_GIT_REPO_URL> /opt/elfasys/repos/ai-cv-builder
cd /opt/elfasys/repos/ai-cv-builder
```

### Configure Production Environment
Copy the template and fill in your secrets:
```bash
cp deploy/env.example /opt/elfasys/config/ai-cv-builder/production.env
chmod 600 /opt/elfasys/config/ai-cv-builder/production.env
nano /opt/elfasys/config/ai-cv-builder/production.env
```
Ensure you provide:
- `BETTER_AUTH_SECRET` (generate with `openssl rand -hex 32`)
- `OPENAI_API_KEY`
- `TURSO_DATABASE_URL` & `TURSO_AUTH_TOKEN` (or local file sqlite path `file:/app/data/cv-builder.db`)
- `RESEND_API_KEY`
- `STRIPE_*` keys

### Configure Nginx and SSL
```bash
sudo cp deploy/nginx/cv.elfasyssolution.com.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/cv.elfasyssolution.com.conf /etc/nginx/sites-enabled/
sudo certbot --nginx -d cv.elfasyssolution.com
sudo nginx -t && sudo systemctl reload nginx
```

---

## 2. GitHub Actions Secrets

In your GitHub repository, navigate to **Settings** → **Secrets and variables** → **Actions** and add:

| Secret Name | Value |
| :--- | :--- |
| `SSH_HOST` | VPS IP address or hostname |
| `SSH_PORT` | `22` (or your VPS custom SSH port) |
| `SSH_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | SSH private key corresponding to VPS `authorized_keys` |

---

## 3. Manual Deployment Commands

To deploy or rebuild manually on the VPS:
```bash
cd /opt/elfasys/repos/ai-cv-builder
git pull origin main
cp /opt/elfasys/config/ai-cv-builder/production.env deploy/production.env
docker compose -p cv-production \
  --env-file deploy/production.env \
  -f deploy/docker-compose.yml \
  -f deploy/compose.vps.yml \
  up -d --build --force-recreate
```

## 4. Verification

Verify container health:
```bash
curl http://127.0.0.1:7892/api/healthz
curl https://cv.elfasyssolution.com/api/healthz
```
