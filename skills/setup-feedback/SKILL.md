---
name: setup-feedback
description: Set up the dropin-feedback-widget widget in a React/Next.js project. Installs the package, creates the transcription API route, configures env vars, and wires up the widget.
disable-model-invocation: true
argument-hint: "[onSubmit-target]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Set up dropin-feedback-widget

You are setting up the `dropin-feedback-widget` voice + text feedback widget in a React project. Follow these steps in order.

Reference docs: [README](../../README.md)

## 1. Detect project type

Determine the project's framework by reading `package.json`:

- **Next.js App Router** — has `next` in dependencies and uses `app/` directory
- **Next.js Pages Router** — has `next` but uses `pages/` directory
- **Vite / CRA / other React** — no `next`, has `react`

If it's not a React project, stop and tell the user this widget requires React 18+.

## 2. Install the package

Copy the `dropin-feedback-widget` package into the project. If it's a monorepo with a `packages/` directory, copy there. Otherwise copy to a `lib/feedback-widget/` directory.

Then install it as a local dependency:

```bash
npm install ./path-to-package
```

Or if the user provides an npm registry URL or the package is published, use that instead.

## 3. Create the transcription API route

### Next.js App Router

Create `app/api/feedback/transcribe/route.ts`:

```ts
import { createTranscriptionHandler } from 'dropin-feedback-widget/server';

export const POST = createTranscriptionHandler({
  groqApiKey: process.env.GROQ_API_KEY!,
});
```

### Next.js Pages Router

Create `pages/api/feedback/transcribe.ts`:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Read raw body as FormData isn't natively supported in Pages Router.
  // The user may need to use a library like formidable or busboy here.
  // For simplicity, recommend migrating this single route to App Router.
  res.status(501).json({ error: 'Use App Router for this route — see README' });
}
```

Tell the user: Pages Router doesn't handle FormData natively. Recommend creating just this one route under `app/api/` (Next.js supports mixing both routers).

### Non-Next.js

Tell the user they need to create their own transcription endpoint or pass a custom `transcribe` function. Show this pattern:

```tsx
<FeedbackWidget
  transcribe={async (audioBlob) => {
    const formData = new FormData();
    formData.append("audio", audioBlob);
    const res = await fetch("YOUR_ENDPOINT", { method: "POST", body: formData });
    const data = await res.json();
    return data.transcript;
  }}
  // ...
/>
```

## 4. Configure environment

Check if `.env.local` (or `.env`) exists. Add `GROQ_API_KEY` if not present:

```
GROQ_API_KEY=
```

Tell the user: "Get a free API key at https://console.groq.com and paste it here."

Do NOT generate or guess API key values.

## 5. Mount the widget

Find the app's root layout or provider component. This is typically:

- Next.js App Router: `app/layout.tsx` or a providers wrapper
- Next.js Pages Router: `pages/_app.tsx`
- Vite/CRA: `src/App.tsx` or `src/main.tsx`

Add the widget. The user argument `$ARGUMENTS` specifies where `onSubmit` should send data. Match the argument to one of the integration patterns below.

### If argument is "linear"

Install the Linear SDK and wire it up. The API key should be used server-side only — create a server-side API route that receives the entry and creates the Linear issue.

1. Run `npm install @linear/sdk`
2. Add `LINEAR_API_KEY` and `LINEAR_TEAM_ID` to `.env.local`
3. Create a server route (e.g., `app/api/feedback/route.ts`):

```ts
import { LinearClient } from "@linear/sdk";
import { NextRequest, NextResponse } from "next/server";

const linear = new LinearClient({ apiKey: process.env.LINEAR_API_KEY! });

export async function POST(request: NextRequest) {
  const entry = await request.json();
  const result = await linear.createIssue({
    teamId: process.env.LINEAR_TEAM_ID!,
    title: entry.type === "voice"
      ? `Voice feedback from ${entry.userName}`
      : `Feedback from ${entry.userName}`,
    description: [
      `**Type:** ${entry.type}`,
      `**Page:** ${entry.page}`,
      `**Date:** ${entry.timestamp}`,
      entry.durationSeconds ? `**Recording:** ${entry.durationSeconds}s` : "",
      "", "---", "",
      entry.response,
    ].filter(Boolean).join("\n"),
    priority: 3,
  });
  return NextResponse.json({ success: result.success });
}
```

4. Mount the widget:

```tsx
import { FeedbackWidget } from 'dropin-feedback-widget';

<FeedbackWidget
  user={{ id: currentUser.id, name: currentUser.name }}
  transcribe="/api/feedback/transcribe"
  onSubmit={async (entry) => {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
  }}
/>
```

Tell the user: "Get your Linear API key from Linear Settings > API > Personal API keys. Get your team ID from the team settings URL."

### If argument is "firestore"

Look for existing Firebase setup in the project (search for `firebase`, `firestore`, `initializeApp`). Use whatever `db` instance they already have.

```tsx
import { FeedbackWidget } from 'dropin-feedback-widget';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // adjust to match their import

<FeedbackWidget
  user={{ id: currentUser.uid, name: currentUser.displayName }}
  transcribe="/api/feedback/transcribe"
  onSubmit={async (entry) => {
    await addDoc(collection(db, "feedback"), {
      ...entry,
      createdAt: Timestamp.now(),
    });
  }}
/>
```

### If argument is "supabase"

Look for existing Supabase client setup in the project.

```tsx
import { FeedbackWidget } from 'dropin-feedback-widget';

<FeedbackWidget
  user={{ id: session.user.id, name: session.user.email }}
  transcribe="/api/feedback/transcribe"
  onSubmit={async (entry) => {
    await supabase.from("feedback").insert({
      ...entry,
      created_at: entry.timestamp.toISOString(),
    });
  }}
/>
```

### If argument is "slack"

1. Add `SLACK_WEBHOOK_URL` to `.env.local`
2. Create a server route to proxy the webhook (don't expose the URL client-side):

```ts
// app/api/feedback/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const entry = await request.json();
  await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `*${entry.type === "voice" ? "Voice" : "Text"} feedback from ${entry.userName}*\nPage: ${entry.page}\n\n${entry.response}`,
    }),
  });
  return NextResponse.json({ success: true });
}
```

3. Mount the widget pointing at the route:

```tsx
<FeedbackWidget
  user={{ id: user.id, name: user.name }}
  transcribe="/api/feedback/transcribe"
  onSubmit={async (entry) => {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
  }}
/>
```

Tell the user: "Create a Slack incoming webhook at api.slack.com/apps and paste the URL in your .env.local."

### If argument is a URL (starts with "http" or "/api")

Use it as the POST endpoint:

```tsx
<FeedbackWidget
  user={{ id: user.id, name: user.name }}
  transcribe="/api/feedback/transcribe"
  onSubmit={async (entry) => {
    await fetch("$ARGUMENTS", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
  }}
/>
```

### Default (no argument or "console")

```tsx
import { FeedbackWidget } from 'dropin-feedback-widget';

<FeedbackWidget
  user={{ id: "test-user", name: "Tester" }}
  transcribe="/api/feedback/transcribe"
  onSubmit={async (entry) => {
    console.log("Feedback received:", entry);
  }}
/>
```

Tell them to swap `console.log` for their preferred backend. Mention available integrations: Linear, Firestore, Supabase, Slack, or any REST endpoint.

### If user says multiple targets (e.g., "firestore and linear")

Combine them in a single `onSubmit`:

```tsx
onSubmit={async (entry) => {
  await Promise.all([
    addDoc(collection(db, "feedback"), { ...entry, createdAt: Timestamp.now() }),
    fetch("/api/feedback/linear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }),
  ]);
}}
```

Create separate server routes for each service that needs a secret key.

## 6. Verify

Tell the user:

1. Start the dev server
2. Look for the floating chat bubble button in the bottom-right corner
3. Try the "Write" tab — type something, submit
4. Try the "Talk" tab — hit record, talk for a bit, send it
5. Check wherever `onSubmit` sends data to confirm entries arrive

## 7. Summary

Print a short summary:

- What was installed
- Where the API route lives
- Where the widget was mounted
- Remind them to add their `GROQ_API_KEY`
- Link to the README for customization (placeholder text, recording limits, etc.)
