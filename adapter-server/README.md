# boring adapter server

this server hosts llm-generated adapter specs. the browser asks for an adapter by url and uses it to extract data in minimal mode.

the server can auto-generate adapters with chatgpt 5.2 and refresh them on a schedule. it can also recursively refine adapters with self-evaluation until they meet your criteria.

## setup

```bash
cd adapter-server
npm install
```

create a `.env` file:

```
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-5.2-chat-latest
OPENAI_MAX_COMPLETION_TOKENS=1200
PORT=8787
ADAPTER_AUTO_GENERATE=1
ADAPTER_AUTO_REFRESH=1
ADAPTER_TTL_MS=21600000
ADAPTER_MISS_MODE=async
ADAPTER_AUTO_RECURSIVE=1
ADAPTER_RECURSIVE_MAX_ITER=4
```

run:

```bash
npm start
```

model notes:
- chatgpt 5.2 instant: `gpt-5.2-chat-latest`
- chatgpt 5.2 thinking: `gpt-5.2`

## recursive generation example

```bash
curl -X POST http://localhost:8787/generate-recursive \
  -H "content-type: application/json" \
  -d '{
    "url": "https://www.amazon.com/s?k=shoes",
    "template": "shopping",
    "modeLabel": "shopping",
    "criteria": {
      "minItems": 8,
      "requiredFields": { "title": 0.7, "href": 0.7, "price": 0.3 }
    },
    "maxIterations": 4
  }'
```

## endpoints

- `GET /adapter?url=...` -> returns adapter spec json (optional `template` to pick a template-specific adapter)
- `POST /generate` with `{ url }` -> generates + stores adapter (single pass)
- `POST /generate-recursive` with `{ url, template, criteria, maxIterations }` -> iteratively generates, evaluates, and stores adapter
- `POST /adapters` with spec json -> manual upsert
- `GET /adapters` -> list all

## client wiring

set env var for the electron app:

```
BORING_ADAPTER_SERVER=http://your-vm:8787
```

optional tuning:

```
BORING_ADAPTER_TIMEOUT_MS=150
BORING_ADAPTER_CACHE_TTL_MS=21600000
BORING_ADAPTER_STRATEGY=fast
BORING_ADAPTER_REFRESH_DELAY_MS=2000
BORING_ADAPTER_REFRESH_MAX_ATTEMPTS=3
```

## speed strategy

- `ADAPTER_MISS_MODE=async` makes the server respond immediately on cache misses and generates adapters in the background (best for fastest page loads).
- `ADAPTER_MISS_MODE=sync` blocks the request until chatgpt 5.2 returns an adapter (slower, but first-load can render with the new adapter).
- `ADAPTER_AUTO_RECURSIVE=1` makes auto-generation run the recursive evaluator loop (best quality on miss).

client strategies:
- `BORING_ADAPTER_STRATEGY=fast` (default): use cached remote adapters instantly, otherwise local adapters; background fetch for next time.
- `BORING_ADAPTER_STRATEGY=balanced`: if local falls back, wait briefly for the remote adapter.
- `BORING_ADAPTER_STRATEGY=remote-first`: always try the server first.

## deploy on a vm (ubuntu)

```bash
sudo apt update
sudo apt install -y nodejs npm
node -v  # ensure >= 18 for fetch

git clone <your-repo>
cd adapter-server
npm install
cp .env.example .env  # or create .env
```

create a systemd service:

```
sudo tee /etc/systemd/system/boring-adapter.service > /dev/null <<'EOF'
[Unit]
Description=boring adapter server
After=network.target

[Service]
WorkingDirectory=/home/ubuntu/ichackdemoproject/adapter-server
EnvironmentFile=/home/ubuntu/ichackdemoproject/adapter-server/.env
ExecStart=/usr/bin/node /home/ubuntu/ichackdemoproject/adapter-server/index.js
Restart=always
User=ubuntu

[Install]
WantedBy=multi-user.target
EOF
```

enable + start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable boring-adapter
sudo systemctl start boring-adapter
sudo systemctl status boring-adapter
```

open the port (if needed):

```bash
sudo ufw allow 8787
```
