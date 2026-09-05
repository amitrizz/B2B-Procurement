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
