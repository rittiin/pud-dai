import Chat from "@/components/Chat";
import { PUBLIC_DEMO_MODE } from "@/lib/demo";

export const metadata = { title: "ประเมินอาการ · พูดได้" };

export default function ScreenPage() {
  return <Chat publicDemo={PUBLIC_DEMO_MODE} openAiVoiceAvailable={!PUBLIC_DEMO_MODE && Boolean(process.env.OPENAI_API_KEY)} />;
}
