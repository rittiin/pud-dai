import Chat from "@/components/Chat";
import { PUBLIC_DEMO_MODE } from "@/lib/demo";

export const metadata = { title: "ประเมินอาการ · พูดได้" };

export default function ScreenPage() {
  const publicVoiceAllowed = !PUBLIC_DEMO_MODE || process.env.ALLOW_PUBLIC_OPENAI_TTS === "1";
  return <Chat publicDemo={PUBLIC_DEMO_MODE} openAiVoiceAvailable={publicVoiceAllowed && Boolean(process.env.OPENAI_API_KEY)} />;
}
