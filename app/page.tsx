import Link from "next/link";
import Mascot from "@/components/Mascot";
import ShareQR from "@/components/ShareQR";
import ShareButtons from "@/components/ShareButtons";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-4 py-10">
      <div className="stagger mb-8">
        <Mascot mood="happy" size={96} float />
        <div className="mb-3 mt-4 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
          ต้นแบบ · ไข้หวัดใหญ่ (ICD-10 J10–J11)
        </div>
        <h1 className="text-4xl font-bold tracking-tight">พูดได้ <span className="text-2xl font-semibold text-muted">Pud-dai</span></h1>
        <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-2">
          ประชาชนเล่าอาการด้วยภาษาของตัวเอง แล้วได้คำแนะนำที่ทำตามได้จริงทันที ข้อมูลเดียวกันส่งต่อเป็น line list ที่ตรวจสอบหลักฐานได้ทุกช่อง
          ให้ทีมเฝ้าระวังเห็นกลุ่มก้อนตั้งแต่วันแรก
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/screen" className="press lift group rounded-2xl bg-brand p-6 text-white shadow-sm ">
          <div className="text-sm opacity-80">สำหรับประชาชน</div>
          <div className="mt-1 text-2xl font-bold">ประเมินอาการ</div>
          <p className="mt-2 text-sm leading-relaxed opacity-90">มีไข้ ไอ เจ็บคอ? คุยกับพูดได้ประมาณ 2 นาที แล้วรู้ว่าต้องไปหาหมอไหม ต้องหยุดงานถึงวันไหน และดูแลคนในบ้านอย่างไร</p>
          <div className="mt-4 text-sm font-semibold">เริ่มเลย →</div>
        </Link>
        <Link href="/dashboard" className="press lift group rounded-2xl border border-line bg-surface p-6 shadow-sm ">
          <div className="text-sm text-muted">สำหรับเจ้าหน้าที่ควบคุมโรค</div>
          <div className="mt-1 text-2xl font-bold">ศูนย์เฝ้าระวัง</div>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">Line list อัตโนมัติ, epidemic curve, แจ้งเตือนกลุ่มก้อนตามเกณฑ์ 5 รายใน 1 สัปดาห์ และร่างรายงานสอบสวนโรค</p>
          <div className="mt-4 text-sm font-semibold text-brand">เปิดแดชบอร์ด →</div>
        </Link>
      </div>

      <div className="mt-6 flex flex-col items-center gap-5 rounded-2xl bg-surface p-5 shadow-sm sm:flex-row">
        <ShareQR size={148} />
        <div className="flex-1 text-center sm:text-left">
          <div className="text-lg font-semibold">สแกนเพื่อลองใช้บนมือถือ</div>
          <p className="mt-1 text-sm text-ink-2">หรือส่งต่อให้คนที่คุณห่วงใย ประเมินอาการได้ฟรี ไม่ต้องติดตั้งแอป</p>
          <div className="mt-3 flex justify-center sm:justify-start">
            <ShareButtons compact />
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-3 text-sm text-ink-2 sm:grid-cols-3">
        <div className="rounded-xl bg-surface p-4"><b className="text-ink">AI ฟัง</b><br />จับใจความจากข้อความอิสระ ทุกช่องมีหลักฐานเป็นคำพูดต้นฉบับ</div>
        <div className="rounded-xl bg-surface p-4"><b className="text-ink">กฎตัดสิน</b><br />จัดประเภทผู้ป่วยและระดับความเร่งด่วนตามนิยามโรคของกรมควบคุมโรค</div>
        <div className="rounded-xl bg-surface p-4"><b className="text-ink">คนอนุมัติ</b><br />เจ้าหน้าที่ยืนยันเคสและรายงานก่อนดำเนินการทุกครั้ง</div>
      </div>
    </main>
  );
}
