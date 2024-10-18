# ai-life frontend

This is an astro (https://astro.build/) frontend built with React, using bun to run the server.

To run this, first make sure you have bun installed if you don't already!

```bash
npm i -g bun
```

Then, make sure you install dependencies:

```bash
bun i
```

Then, be sure to set the following environment variables in a `.env` file placed next to this ReadMe:

```env
# If running the backend locally on port 5000

PUBLIC_BACKEND_URL=ws://localhost:5000
PUBLIC_API_URL=http://localhost:5000/api
```

Finally, spin up the frontend by running the dev command!

```bash
bun run dev
```

This should open up a server on port 4321, so open up a browser to `localhost:4321` and you should be good to go!
