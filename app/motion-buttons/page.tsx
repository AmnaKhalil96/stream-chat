import type { Metadata } from "next";
import MotionButtonsDemo from "@/components/motion/MotionButtonsDemo";

export const metadata: Metadata = {
  title: "Motion Buttons Demo — FE-AA1",
  description: "FE-AA1 motion/state button micro-interactions demo.",
};

export default function MotionButtonsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <MotionButtonsDemo />
    </div>
  );
}
