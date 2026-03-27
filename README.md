# fieldmark-feedback

Drop-in feedback widget for React apps. Floating button opens a panel with two tabs:

- **Write** — free-form text field
- **Talk** — voice recording (up to 5 min), auto-transcribed via Whisper

You provide an `onSubmit` callback. Save feedback wherever you want — Firestore, Supabase, Postgres, Linear, a webhook, `console.log`. The widget doesn't care.

## Install

```bash
npm install fieldmark-feedback
```

## Quick Start

```tsx
import { FeedbackWidget } from 'fieldmark-feedback';

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

Voice recordings need a server endpoint. A Next.js helper is included:

```ts
// app/api/feedback/transcribe/route.ts
import { createTranscriptionHandler } from 'fieldmark-feedback/server';

export const POST = createTranscriptionHandler({
  groqApiKey: process.env.GROQ_API_KEY!,
});
```

Get a free API key at [console.groq.com](https://console.groq.com). Add to `.env.local`:

```
GROQ_API_KEY=your_key_here
```

### Custom transcription

Not on Next.js? Pass a function instead of a URL:

```tsx
<FeedbackWidget
  transcribe={async (audioBlob) => {
    const fd = new FormData();
    fd.append("audio", audioBlob);
    const res = await fetch("https://your-api.com/transcribe", { method: "POST", body: fd });
    return (await res.json()).transcript;
  }}
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
