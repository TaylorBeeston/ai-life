# ai-life

This is a bun workspace that houses a frontend/backend for my AI Life Simulator.

The way this works is that the backend will continuously run and simulate the lives of various "agents",
some of which use LLMs to make decisions/take actions. The frontend then allows you to visualize this
simulation, including looking at the history of what's happened so far.

To view it in action, head on over to https://ai-life.netlify.app

To run it locally, first make sure you have bun installed if you don't already:

```bash
npm i -g bun
```

Then, make sure you install all dependencies:

```bash
bun i
```

Then, first follow the instructions in the readme for the backend (services/backend/README.md) to get
the backend up and running. Finally, follow the instructions in the readme for the frontend (apps/frontend/README.md)
to get the frontend up and running!
