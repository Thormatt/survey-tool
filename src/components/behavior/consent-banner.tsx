"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, X, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BehaviorSettings } from "@/types/behavior";

interface ConsentBannerProps {
  settings: BehaviorSettings;
  onAccept: () => void;
  onDecline: () => void;
}

const DEFAULT_CONSENT_TEXT =
  "We'd like to record your session to improve this survey experience. This helps us understand how respondents interact with our surveys. Your responses remain private and the recording will be automatically deleted after the retention period.";

export function ConsentBanner({
  settings,
  onAccept,
  onDecline,
}: ConsentBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const consentText = settings.consentText || DEFAULT_CONSENT_TEXT;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
      >
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 flex items-center gap-3 border-b border-gray-100">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Eye className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Session Recording</h3>
              <p className="text-sm text-gray-600">
                Help us improve your experience
              </p>
            </div>
            <button
              onClick={onDecline}
              className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
              aria-label="Decline recording"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            <p className="text-gray-700 text-sm leading-relaxed">
              {isExpanded ? consentText : `${consentText.slice(0, 150)}...`}
            </p>

            {consentText.length > 150 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-blue-600 text-sm mt-2 hover:underline"
              >
                {isExpanded ? "Show less" : "Read more"}
              </button>
            )}

            {/* Privacy note */}
            <div className="flex items-start gap-2 mt-4 p-3 bg-gray-50 rounded-lg">
              <Shield className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-600">
                <span className="font-medium">Privacy Protected:</span> Sensitive
                inputs like passwords are automatically masked. Recording will be
                deleted after {settings.retentionDays} days.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={onDecline}
              className="flex-1 sm:flex-none"
            >
              No thanks
            </Button>
            <Button onClick={onAccept} className="flex-1 sm:flex-none">
              Accept & Continue
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
