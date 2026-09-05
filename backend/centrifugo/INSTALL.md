# Centrifugo (local install)

Download the Windows binary from [Centrifugo releases](https://github.com/centrifugal/centrifugo/releases) and place it here:

```
backend/centrifugo/centrifugo.exe
```

Or extract from `backend/centrifugo.zip` (not committed — too large and triggers GitHub secret scanning).

Configure `config.json` and run:

```bash
cd backend/centrifugo
./centrifugo.exe --config=config.json
```

Set in `backend/.env.dev`:

```
CENTRIFUGO_URL=http://127.0.0.1:8000
CENTRIFUGO_API_KEY=your-api-key
CENTRIFUGO_TOKEN_HMAC_SECRET_KEY=your-hmac-secret
```

Frontend (`.env.dev`):

```
NEXT_PUBLIC_CENTRIFUGO_URL=ws://127.0.0.1:8000/connection/websocket
```

## Render.com (deployed)

Example service: `https://centrifugo-latest-31xv.onrender.com`

**Important:** A generic Render “Centrifugo latest” deploy uses **auto-generated API keys**.  
If publish returns **401**, redeploy from this repo:

1. Render → **New** → **Web Service** → Docker
2. Root directory: `backend/centrifugo`
3. Use the included `Dockerfile` + `config.v6.json` (keys match backend `.env.prod`)
4. Set `CENTRIFUGO_URL` / `NEXT_PUBLIC_CENTRIFUGO_URL` to the new Render URL

Or set Render env vars manually from `render.env.example` (must match backend keys exactly).
