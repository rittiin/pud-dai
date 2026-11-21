import Chat from "@/components/Chat";
import { PUBLIC_DEMO_MODE } from "@/lib/demo";
import { aiEnabled } from "@/lib/ai";

export const metadata = { title: "ประเมินอาการ · พูดได้" };

export default function ScreenPage() {
  return <Chat publicDemo={PUBLIC_DEMO_MODE} openAiVoiceAvailable={Boolean(process.env.OPENAI_API_KEY)} aiAvailable={aiEnabled()} />;
}
