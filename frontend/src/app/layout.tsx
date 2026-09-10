import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Navbar from "@/components/Layout/Navbar";
import PageViewTracker from "@/components/Tracking/PageViewTracker";
import FeedbackDrawer from "@/components/Feedback/FeedbackDrawer";
import { AgentPanelProvider } from "@/components/AgentPanelProvider";

export const metadata: Metadata = {
  title: "ProductThink",
  description: "AI product judgment and analysis workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 text-gray-900 min-h-screen flex flex-col">
        <AgentPanelProvider>
          <Navbar />
          <Suspense fallback={null}>
            <PageViewTracker />
          </Suspense>
          <FeedbackDrawer />
          <main className="flex flex-1 flex-col pt-16">
            {children}
          </main>
        </AgentPanelProvider>
      </body>
    </html>
  );
}
