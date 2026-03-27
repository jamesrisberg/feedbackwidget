/**
 * Server-side helper for creating the transcription API route.
 *
 * Usage (Next.js App Router):
 *
 *   // app/api/feedback/transcribe/route.ts
 *   import { createTranscriptionHandler } from 'dropin-feedback-widget/server';
 *   export const POST = createTranscriptionHandler({
 *     groqApiKey: process.env.GROQ_API_KEY!,
 *   });
 */

interface TranscriptionHandlerOptions {
  /** Groq API key (get one free at https://console.groq.com) */
  groqApiKey: string;
  /** Whisper model to use. Default: "whisper-large-v3-turbo" */
  model?: string;
  /** Max file size in bytes. Default: 10MB */
  maxFileSize?: number;
}

export function createTranscriptionHandler(options: TranscriptionHandlerOptions) {
  const {
    groqApiKey,
    model = "whisper-large-v3-turbo",
    maxFileSize = 10 * 1024 * 1024,
  } = options;

  return async function POST(request: Request): Promise<Response> {
    try {
      const formData = await request.formData();
      const audioFile = formData.get("audio") as File | null;

      if (!audioFile) {
        return Response.json({ error: "No audio file provided" }, { status: 400 });
      }

      if (audioFile.size > maxFileSize) {
        return Response.json(
          { error: `File too large. Maximum size is ${Math.round(maxFileSize / 1024 / 1024)}MB.` },
          { status: 400 },
        );
      }

      const validTypes = ["audio/webm", "audio/mp4", "audio/wav", "audio/mpeg"];
      const isValidType = validTypes.some((type) => audioFile.type.startsWith(type));

      if (!isValidType && audioFile.type !== "") {
        return Response.json({ error: "Invalid file type" }, { status: 400 });
      }

      // Groq Whisper transcription via REST API (no SDK dependency)
      const groqForm = new FormData();
      groqForm.append("file", audioFile);
      groqForm.append("model", model);

      const groqResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: groqForm,
      });

      if (!groqResponse.ok) {
        const err = await groqResponse.text();
        console.error("Groq transcription error:", err);
        return Response.json({ error: "Transcription failed" }, { status: 500 });
      }

      const result = await groqResponse.json();

      return Response.json({
        success: true,
        transcript: result.text || "",
      });
    } catch (error) {
      console.error("Transcription handler error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
