# ai-life backend

If you don't have bun, install it first!

```bash
npm i -g bun
```

Then, make sure you install dependencies:

```bash
bun i
```

Then, be sure to set the following environment variables in a `.env` file placed next to this ReadMe:

```env
# https://aistudio.google.com/app/apikey
GEMINI_TOKEN=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA

# Any way you'd like to use postgres! I'm using supabase: https://supabase.com/
DATABASE_URL=postgresql://user:password@dburl.com:PORT/dbname
```

Finally, spin up the backend!

```bash
bun run dev
```

This command will hot reload by restarting the server if you make changes to a file. If you don't like that for some reason, use `start`!

```bash
bun run start
```
