"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { X, MessageSquare, ChevronRight } from "lucide-react";

export default function EmbedPreviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const surveyId = params.id as string;

  const embedType = searchParams.get("type") || "iframe";
  const position = searchParams.get("position") || "right";
  const accentColor = searchParams.get("accent") || "#FF4F01";
  const tabText = searchParams.get("tabText") || "Feedback";
  const buttonText = searchParams.get("buttonText") || "Take Survey";
  const triggerDelay = parseInt(searchParams.get("delay") || "0", 10);

  const [isOpen, setIsOpen] = useState(embedType === "iframe");
  const [showExitIntent, setShowExitIntent] = useState(false);

  // Auto-open for certain types after delay
  useEffect(() => {
    if (embedType === "slidein" || embedType === "popup" || embedType === "widget") {
      const timer = setTimeout(() => setIsOpen(true), triggerDelay * 1000 || 1000);
      return () => clearTimeout(timer);
    }
    if (embedType === "exit-intent") {
      const timer = setTimeout(() => setShowExitIntent(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [embedType, triggerDelay]);

  const embedUrl = `/embed/${surveyId}?accent=${encodeURIComponent(accentColor)}`;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Simulated Website Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600" />
            <span className="font-semibold text-gray-800">Your Website</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <span className="hover:text-gray-900 cursor-pointer">Home</span>
            <span className="hover:text-gray-900 cursor-pointer">Products</span>
            <span className="hover:text-gray-900 cursor-pointer">About</span>
            <span className="hover:text-gray-900 cursor-pointer">Contact</span>
          </nav>
        </div>
      </header>

      {/* Simulated Website Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Our Website</h1>
          <p className="text-gray-600 mb-6">
            This is a preview of how your survey embed will appear on a real website.
            The content you see here is just placeholder text to simulate a typical webpage.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-6">
                <div className="w-12 h-12 rounded-full bg-gray-200 mb-4" />
                <h3 className="font-semibold text-gray-800 mb-2">Feature {i}</h3>
                <p className="text-sm text-gray-500">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor.
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">More Content</h2>
          <p className="text-gray-600 mb-4">
            Interact with the survey widget to see how it works. You can close this preview
            tab when you&apos;re done testing.
          </p>
          <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
            Placeholder content area
          </div>
        </div>
      </main>

      {/* Preview Badge */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm font-medium z-[9999] flex items-center gap-2">
        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        Preview Mode: {embedType === "iframe" ? "Inline Embed" : embedType === "popup" ? "Popup Modal" : embedType === "slidein" ? "Slide-in Panel" : embedType === "feedback-tab" ? "Feedback Tab" : embedType === "widget" ? "Corner Widget" : embedType === "exit-intent" ? "Exit Intent" : "Embed"}
      </div>

      {/* IFRAME EMBED */}
      {embedType === "iframe" && (
        <div className="max-w-6xl mx-auto px-6 pb-12">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Embedded Survey</h2>
            <div className="rounded-lg overflow-hidden border border-gray-200">
              <iframe
                src={embedUrl}
                width="100%"
                height="600"
                style={{ border: "none" }}
                title="Survey"
              />
            </div>
          </div>
        </div>
      )}

      {/* Custom Animation Styles */}
      <style jsx global>{`
        @keyframes popupOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popupModalIn { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-popup-overlay { animation: popupOverlayIn 0.3s ease-out; }
        .animate-popup-modal { animation: popupModalIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .transition-spring { transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
      `}</style>

      {/* POPUP MODAL */}
      {embedType === "popup" && (
        <>
          {!isOpen && (
            <button
              onClick={() => setIsOpen(true)}
              className="fixed bottom-6 right-6 px-6 py-3 rounded-lg font-medium text-white shadow-lg hover:shadow-xl transition-all z-50"
              style={{ backgroundColor: accentColor }}
            >
              {buttonText}
            </button>
          )}
          {isOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9998] p-4 animate-popup-overlay">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden relative animate-popup-modal">
                <button
                  onClick={() => setIsOpen(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center z-10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <iframe
                  src={embedUrl}
                  width="100%"
                  height="600"
                  style={{ border: "none" }}
                  title="Survey"
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* SLIDE-IN PANEL */}
      {embedType === "slidein" && (
        <>
          {!isOpen && (
            <button
              onClick={() => setIsOpen(true)}
              className="fixed bottom-6 right-6 px-6 py-3 rounded-lg font-medium text-white shadow-lg hover:shadow-xl transition-all z-50"
              style={{ backgroundColor: accentColor }}
            >
              {buttonText}
            </button>
          )}
          <div
            className={`fixed top-0 ${position === "left" ? "left-0" : "right-0"} h-full w-full max-w-md bg-white shadow-2xl z-[9998] transition-spring ${
              isOpen ? "translate-x-0 opacity-100" : position === "left" ? "-translate-x-full opacity-0" : "translate-x-full opacity-0"
            }`}
          >
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center z-10"
            >
              <X className="w-4 h-4" />
            </button>
            <iframe
              src={embedUrl}
              width="100%"
              height="100%"
              style={{ border: "none" }}
              title="Survey"
            />
          </div>
          {isOpen && (
            <div
              className="fixed inset-0 bg-black/30 z-[9997]"
              onClick={() => setIsOpen(false)}
            />
          )}
        </>
      )}

      {/* FEEDBACK TAB */}
      {embedType === "feedback-tab" && (
        <>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`fixed ${position === "left" ? "left-0" : "right-0"} top-1/2 -translate-y-1/2 px-3 py-6 text-white font-medium text-sm shadow-lg z-[9998] transition-all`}
            style={{
              backgroundColor: accentColor,
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              borderRadius: position === "left" ? "0 8px 8px 0" : "8px 0 0 8px",
              transform: position === "left" ? "translateY(-50%)" : "translateY(-50%) rotate(180deg)",
            }}
          >
            {tabText}
          </button>
          <div
            className={`fixed top-0 ${position === "left" ? "left-0" : "right-0"} h-full w-full max-w-md bg-white shadow-2xl z-[9997] transition-spring ${
              isOpen ? "translate-x-0 opacity-100" : position === "left" ? "-translate-x-full opacity-0" : "translate-x-full opacity-0"
            }`}
            style={{ [position === "left" ? "left" : "right"]: isOpen ? "0" : undefined }}
          >
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center z-10"
            >
              <X className="w-4 h-4" />
            </button>
            <iframe
              src={embedUrl}
              width="100%"
              height="100%"
              style={{ border: "none" }}
              title="Survey"
            />
          </div>
        </>
      )}

      {/* CORNER WIDGET */}
      {embedType === "widget" && (
        <>
          {!isOpen && (
            <button
              onClick={() => setIsOpen(true)}
              className="fixed bottom-6 right-6 w-14 h-14 rounded-full text-white shadow-lg hover:shadow-xl transition-all z-50 flex items-center justify-center"
              style={{ backgroundColor: accentColor }}
            >
              <MessageSquare className="w-6 h-6" />
            </button>
          )}
          {isOpen && (
            <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl z-[9998] overflow-hidden animate-popup-modal">
              <div
                className="flex items-center justify-between px-4 py-3 text-white"
                style={{ backgroundColor: accentColor }}
              >
                <span className="font-medium">Feedback</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <iframe
                src={embedUrl}
                width="100%"
                height="calc(100% - 48px)"
                style={{ border: "none", height: "452px" }}
                title="Survey"
              />
            </div>
          )}
        </>
      )}

      {/* EXIT INTENT */}
      {embedType === "exit-intent" && showExitIntent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9998] p-4 animate-popup-overlay">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden relative animate-popup-modal">
            <button
              onClick={() => setShowExitIntent(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center z-10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div
              className="px-6 py-4 text-white font-medium"
              style={{ backgroundColor: accentColor }}
            >
              Wait! Before you go...
            </div>
            <iframe
              src={embedUrl}
              width="100%"
              height="550"
              style={{ border: "none" }}
              title="Survey"
            />
          </div>
        </div>
      )}
    </div>
  );
}
