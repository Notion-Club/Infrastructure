"use client";
import dynamic from "next/dynamic";

const FeedbackWidget = dynamic(() => import("./FeedbackWidget"), { ssr: false });

export default function FeedbackWidgetLoader() {
  return <FeedbackWidget />;
}
