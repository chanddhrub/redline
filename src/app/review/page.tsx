import type { Metadata } from "next";
import { Shell } from "./_components/shell";

export const metadata: Metadata = {
  title: "Review a document — Redline",
  description:
    "Read your offer letter, non-compete or IP assignment before you sign. Parsed in your browser; only the text is kept.",
};

export default function ReviewPage() {
  return <Shell />;
}
