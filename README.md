# Datello

Datello analyse vos fichiers CSV, Excel, JSON, GeoJSON et LAS : importez un fichier, posez votre question en langage naturel et obtenez des KPI, tendances, anomalies et recommandations, avec des graphiques et des exports PDF/Excel.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://da-copilot.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/18496a55-3e01-5128-947c-9f3caa95bd4a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? This project uses [Bun](https://bun.sh) (see `bun.lock`).

```sh
git clone <this-repository-url>
cd <repository-name>
bun install
bun run dev
```

Copy `.env.example` to `.env` and fill in the public Supabase values. Server-only
secrets (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `LOVABLE_API_KEY`) must be
provided through your hosting environment, never committed.
