export interface FeedbackEntry {
  type: "text" | "voice";
  response: string;
  page: string;
  userId: string;
  userName: string;
  /** Recording length in seconds (voice entries only) */
  durationSeconds?: number;
  timestamp: Date;
}

export interface FeedbackUser {
  id: string;
  name: string;
}

export interface FeedbackWidgetProps {
  /** Current user info */
  user: FeedbackUser;
  /** Called when feedback is submitted (text or voice). Persist however you like. */
  onSubmit: (entry: FeedbackEntry) => Promise<void>;
  /**
   * URL to POST audio for transcription, or a custom function.
   * If a string, the widget POSTs FormData with an "audio" field and expects { transcript: string }.
   * If a function, it receives the audio Blob and should return the transcript text.
   */
  transcribe: string | ((audio: Blob) => Promise<string>);
  /** Placeholder text for the write tab. */
  placeholder?: string;
  /** Max recording seconds. Default 300 (5 min). */
  maxRecordingSeconds?: number;
  /** Seconds before limit to show warning. Default 30. */
  warningSeconds?: number;
}
