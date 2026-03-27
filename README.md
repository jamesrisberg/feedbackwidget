# dropin-feedback-widget

Drop-in feedback widget for React apps. Floating button opens a panel with two tabs:

- **Write** — free-form text field
- **Talk** — voice recording (up to 5 min), auto-transcribed via Whisper

You provide an `onSubmit` callback. Save feedback wherever you want — Firestore, Supabase, Postgres, Linear, a webhook, `console.log`. The widget doesn't care.

## Install

```bash
npm install dropin-feedback-widget
```

### Claude Code Setup

If you use [Claude Code](https://claude.ai/code), run:

```bash
npx dropin-feedback-widget
```

This installs a `/setup-feedback` skill. Then in Claude Code:

```
/setup-feedback              # defaults to console.log
/setup-feedback linear       # creates Linear issues
/setup-feedback firestore    # saves to Firestore
/setup-feedback supabase     # saves to Supabase
/setup-feedback slack        # posts to Slack
```

Claude handles the full setup — API route, env vars, mounting the widget, wiring up your backend.

### Other AI Agents (Codex, Gemini, Cursor, Aider, etc.)

After installing, point your agent at the setup instructions:

```
Read skills/setup-feedback/SKILL.md in node_modules/dropin-feedback-widget/ and follow it to set up the feedback widget. Target: [linear|firestore|supabase|slack]
```

The skill file contains step-by-step instructions any AI coding agent can follow — framework detection, API route creation, env configuration, and integration wiring for each backend.

## Quick Start

```tsx
import { FeedbackWidget } from 'dropin-feedback-widget';

function App() {
  return (
    <FeedbackWidget
      user={{ id: "user-123", name: "James" }}
      transcribe="/api/feedback/transcribe"
      onSubmit={async (entry) => {
        // entry.type — "text" or "voice"
        // entry.response — the text or transcript
        // entry.page — current URL path
        // entry.timestamp — Date object
        // entry.durationSeconds — recording length (voice only)
        await fetch("/api/feedback", {
          method: "POST",
          body: JSON.stringify(entry),
        });
      }}
    />
  );
}
```

## Voice Transcription Setup

When a user records voice feedback, the widget needs to convert that audio into text. It uses [Groq](https://console.groq.com)'s free Whisper API for this.

The catch: your Groq API key can't be in client-side code (anyone could steal it). So the widget sends audio to a small server endpoint *you* create, which forwards it to Groq and returns the transcript. Your endpoint is just a 3-line proxy to keep the key safe.

### Step 1: Get a free Groq API key

[Groq](https://console.groq.com) runs Whisper for free. Sign up, create an API key, and add it to `.env.local`:

```
GROQ_API_KEY=your_key_here
```

### Step 2: Create the transcription endpoint

**Next.js App Router** — a one-liner helper is included:

```ts
// app/api/feedback/transcribe/route.ts
import { createTranscriptionHandler } from 'dropin-feedback-widget/server';

export const POST = createTranscriptionHandler({
  groqApiKey: process.env.GROQ_API_KEY!,
});
```

Then pass the URL to the widget:

```tsx
<FeedbackWidget
  transcribe="/api/feedback/transcribe"
  // ...
/>
```

**Not on Next.js?** Here's what the endpoint does — it forwards audio to Groq and returns the transcript. Write your own in any backend:

```ts
// Express / Node example
app.post("/api/feedback/transcribe", async (req, res) => {
  const formData = new FormData();
  formData.append("file", req.body.audio);  // the audio file
  formData.append("model", "whisper-large-v3-turbo");

  const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: formData,
  });

  const { text } = await groqRes.json();
  res.json({ transcript: text });
});
```

Then point the widget at it:

```tsx
<FeedbackWidget
  transcribe="/api/feedback/transcribe"
  // ...
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `user` | `{ id: string, name: string }` | required | Attached to each entry |
| `onSubmit` | `(entry) => Promise<void>` | required | Persist however you like |
| `transcribe` | `string \| (Blob) => Promise<string>` | required | Transcription endpoint or function |
| `placeholder` | `string` | `"Bug, idea, complaint..."` | Write tab placeholder |
| `maxRecordingSeconds` | `number` | `300` | Max voice recording (5 min) |
| `warningSeconds` | `number` | `30` | Warning before time limit |

## FeedbackEntry

```ts
{
  type: "text" | "voice",
  response: string,          // user's text or transcript
  page: string,              // window.location.pathname
  userId: string,
  userName: string,
  durationSeconds?: number,  // voice only
  timestamp: Date,
}
```

## Integration Examples

### Linear

Create Linear issues from every feedback submission:

```tsx
// npm install @linear/sdk

import { LinearClient } from "@linear/sdk";

const linear = new LinearClient({ apiKey: process.env.NEXT_PUBLIC_LINEAR_API_KEY! });
const TEAM_ID = "your-team-uuid"; // Linear Settings > Teams > click team > copy ID from URL

<FeedbackWidget
  user={{ id: user.id, name: user.name }}
  transcribe="/api/feedback/transcribe"
  onSubmit={async (entry) => {
    await linear.createIssue({
      teamId: TEAM_ID,
      title: entry.type === "voice"
        ? `Voice feedback from ${entry.userName}`
        : `Feedback from ${entry.userName}`,
      description: [
        `**Type:** ${entry.type}`,
        `**Page:** ${entry.page}`,
        `**Date:** ${entry.timestamp.toISOString()}`,
        entry.durationSeconds ? `**Recording:** ${entry.durationSeconds}s` : "",
        "",
        "---",
        "",
        entry.response,
      ].filter(Boolean).join("\n"),
      priority: 3, // Normal
    });
  }}
/>
```

> **Note:** For production, call the Linear API from a server-side route instead of exposing the API key client-side. Pass the entry to your own `/api/feedback` endpoint and create the issue there.

### Firestore

```tsx
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

### Supabase

```tsx
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

### REST API / Webhook

```tsx
<FeedbackWidget
  user={{ id: user.id, name: user.name }}
  transcribe="/api/feedback/transcribe"
  onSubmit={async (entry) => {
    await fetch("https://your-api.com/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
  }}
/>
```

### Slack

Post feedback to a Slack channel via incoming webhook:

```tsx
const SLACK_WEBHOOK = process.env.NEXT_PUBLIC_SLACK_WEBHOOK!;

<FeedbackWidget
  user={{ id: user.id, name: user.name }}
  transcribe="/api/feedback/transcribe"
  onSubmit={async (entry) => {
    await fetch(SLACK_WEBHOOK, {
      method: "POST",
      body: JSON.stringify({
        text: `*${entry.type === "voice" ? "Voice" : "Text"} feedback from ${entry.userName}*\n${entry.response}`,
      }),
    });
  }}
/>
```

### Multiple targets

Combine any of the above:

```tsx
onSubmit={async (entry) => {
  await Promise.all([
    addDoc(collection(db, "feedback"), { ...entry, createdAt: Timestamp.now() }),
    linear.createIssue({ teamId: TEAM_ID, title: `Feedback: ${entry.userName}`, description: entry.response }),
  ]);
}}
```

## How It Works

- Floating chat button in the bottom-right corner
- Click to open a slide-out panel with Write and Talk tabs
- **Write**: type feedback, hit submit
- **Talk**: hit record, talk for up to 5 minutes, close the panel and keep using the app — a floating red pill tracks elapsed time. Open it back up to send, or it auto-sends at the time limit
- Warning pulse at 30s before the limit
- Keyboard: `Esc` to cancel, `Enter` to send

## Styling

All inline styles, dark theme, no CSS framework required. Zero styling dependencies.

## License

MIT
