"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  Phone,
  Clock,
  ChevronDown,
  GripVertical,
} from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

// Animation variants
const pageVariants = {
  initial: (direction: "forward" | "backward") => ({
    x: direction === "forward" ? 50 : -50,
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 30,
    },
  },
  exit: (direction: "forward" | "backward") => ({
    x: direction === "forward" ? -50 : 50,
    opacity: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 30,
    },
  }),
};

const containerVariants = {
  animate: {
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 400, damping: 25 },
  },
};

interface SkipCondition {
  questionId: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than";
  value: string;
}

interface SkipLogic {
  enabled: boolean;
  conditions: SkipCondition[];
  logic: "all" | "any";
}

interface Question {
  id: string;
  type: string;
  title: string;
  description?: string;
  required: boolean;
  options?: string[];
  settings?: {
    skipLogic?: SkipLogic;
    scaleMin?: number;
    scaleMax?: number;
    scaleLabels?: Record<number, string>;
    minLabel?: string;
    maxLabel?: string;
    min?: number;
    max?: number;
    step?: number;
    scale?: string[];
    total?: number;
    imageUrls?: Record<string, string>;
  };
}

interface Survey {
  id: string;
  title: string;
  description?: string;
  published: boolean;
  accessType: "UNLISTED" | "INVITE_ONLY";
  isAnonymous: boolean;
  closesAt?: string;
  questions: Question[];
}

// Send message to parent window
function postToParent(type: string, data: Record<string, unknown> = {}) {
  if (typeof window !== "undefined" && window.parent !== window) {
    window.parent.postMessage({ type: `survey:${type}`, ...data }, "*");
  }
}

export default function EmbedSurveyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [respondentInfo, setRespondentInfo] = useState({ email: "", name: "" });

  const [currentIndex, setCurrentIndex] = useState(-1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isAnimating, setIsAnimating] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get embed customization from URL params
  const bgColor = searchParams.get("bg") || "#fbf5ea";
  const hideTitle = searchParams.get("hideTitle") === "true";
  const hideDescription = searchParams.get("hideDescription") === "true";
  const accentColor = searchParams.get("accent") || "#FF4F01";

  // Notify parent of height changes for auto-resize
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        postToParent("resize", { height: entry.contentRect.height });
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Notify parent when survey loads
  useEffect(() => {
    if (survey) {
      postToParent("loaded", {
        surveyId: survey.id,
        title: survey.title,
        questionCount: survey.questions.length
      });
    }
  }, [survey]);

  useEffect(() => {
    async function fetchSurvey() {
      try {
        const res = await fetch(`/api/surveys/${params.id}/public`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Survey not found");
          } else if (res.status === 403) {
            setError("This survey requires an invitation");
          } else {
            setError("Failed to load survey");
          }
          postToParent("error", { error: "Failed to load survey" });
          return;
        }
        const data = await res.json();
        setSurvey(data);
      } catch {
        setError("Failed to load survey");
        postToParent("error", { error: "Failed to load survey" });
      } finally {
        setLoading(false);
      }
    }
    fetchSurvey();
  }, [params.id]);

  // Filter visible questions based on skip logic
  const getVisibleQuestions = useCallback(() => {
    if (!survey) return [];
    return survey.questions.filter((question) => {
      const skipLogic = question.settings?.skipLogic;
      if (!skipLogic?.enabled || !skipLogic.conditions?.length) return true;

      const results = skipLogic.conditions.map((condition) => {
        const answer = answers[condition.questionId];
        if (answer === undefined || answer === null) return false;

        const answerStr = String(answer);
        const valueStr = condition.value;

        switch (condition.operator) {
          case "equals":
            if (Array.isArray(answer)) return answer.includes(valueStr);
            return answerStr === valueStr;
          case "not_equals":
            if (Array.isArray(answer)) return !answer.includes(valueStr);
            return answerStr !== valueStr;
          case "contains":
            return answerStr.toLowerCase().includes(valueStr.toLowerCase());
          case "greater_than":
            return parseFloat(answerStr) > parseFloat(valueStr);
          case "less_than":
            return parseFloat(answerStr) < parseFloat(valueStr);
          default:
            return true;
        }
      });

      return skipLogic.logic === "all" ? results.every(Boolean) : results.some(Boolean);
    });
  }, [survey, answers]);

  const visibleQuestions = getVisibleQuestions().filter(q => q.type !== "SECTION_HEADER");
  const allVisibleQuestions = getVisibleQuestions();
  const currentQuestion = currentIndex >= 0 ? allVisibleQuestions[currentIndex] : null;

  const canProceed = useCallback(() => {
    if (!currentQuestion) return true;
    if (currentQuestion.type === "SECTION_HEADER") return true;
    if (!currentQuestion.required) return true;

    const answer = answers[currentQuestion.id];
    if (answer === undefined || answer === null || answer === "") return false;

    if (currentQuestion.type === "RANKING") {
      const arr = answer as string[];
      return arr.length === (currentQuestion.options?.length || 0);
    }
    if (currentQuestion.type === "CONSTANT_SUM") {
      const obj = answer as Record<string, number>;
      const sum = Object.values(obj).reduce((a, b) => a + b, 0);
      return sum === (currentQuestion.settings?.total || 100);
    }
    if (currentQuestion.type === "MATRIX") {
      const obj = answer as Record<string, number>;
      return Object.keys(obj).length === (currentQuestion.options?.length || 0);
    }

    return true;
  }, [currentQuestion, answers]);

  const goNext = useCallback(() => {
    if (isAnimating || !canProceed()) return;
    setDirection("forward");
    setIsAnimating(true);

    const nextIndex = currentIndex + 1;
    postToParent("progress", {
      current: nextIndex,
      total: allVisibleQuestions.length,
      percentage: Math.round((nextIndex / allVisibleQuestions.length) * 100)
    });

    if (nextIndex >= allVisibleQuestions.length) {
      handleSubmit();
    } else {
      setCurrentIndex(nextIndex);
    }

    setTimeout(() => setIsAnimating(false), 300);
  }, [currentIndex, isAnimating, canProceed, allVisibleQuestions.length]);

  const goBack = useCallback(() => {
    if (isAnimating || currentIndex <= -1) return;
    setDirection("backward");
    setIsAnimating(true);
    setCurrentIndex(currentIndex - 1);
    setTimeout(() => setIsAnimating(false), 300);
  }, [currentIndex, isAnimating]);

  const handleSubmit = async () => {
    if (!survey) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyId: survey.id,
          answers,
          respondentEmail: survey.isAnonymous ? undefined : respondentInfo.email,
          respondentName: survey.isAnonymous ? undefined : respondentInfo.name,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");

      setSubmitted(true);
      postToParent("completed", { surveyId: survey.id });
    } catch {
      setError("Failed to submit. Please try again.");
      postToParent("error", { error: "Failed to submit" });
    } finally {
      setSubmitting(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && canProceed()) {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, canProceed]);

  // Focus input when question changes
  useEffect(() => {
    if (currentIndex >= 0 && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [currentIndex]);

  // Update answer helper
  const updateAnswer = (questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  // Calculate progress
  const getQuestionNumber = () => {
    if (currentIndex < 0) return 0;
    let num = 0;
    for (let i = 0; i <= currentIndex; i++) {
      if (allVisibleQuestions[i]?.type !== "SECTION_HEADER") num++;
    }
    return num;
  };

  if (loading) {
    return (
      <div
        ref={containerRef}
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: bgColor }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        ref={containerRef}
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: bgColor }}
      >
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!survey) return null;

  if (submitted) {
    return (
      <div
        ref={containerRef}
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: bgColor }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-md"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <CheckCircle2 className="w-10 h-10" style={{ color: accentColor }} />
          </motion.div>
          <h2 className="text-2xl font-bold mb-2">Thank you!</h2>
          <p className="text-gray-600">Your response has been recorded.</p>
        </motion.div>
      </div>
    );
  }

  // Welcome screen
  if (currentIndex === -1) {
    return (
      <div
        ref={containerRef}
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: bgColor }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-lg"
        >
          {!hideTitle && (
            <h1 className="text-3xl font-bold mb-4">{survey.title}</h1>
          )}
          {!hideDescription && survey.description && (
            <p className="text-gray-600 mb-8 whitespace-pre-wrap">{survey.description}</p>
          )}
          <div className="text-sm text-gray-500 mb-6">
            {visibleQuestions.length} questions
          </div>
          <Button
            onClick={() => {
              if (!survey.isAnonymous) {
                setCurrentIndex(-2);
              } else {
                setCurrentIndex(0);
              }
              postToParent("started", { surveyId: survey.id });
            }}
            className="px-8 py-3 text-lg"
            style={{ backgroundColor: accentColor }}
          >
            Start <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </motion.div>
      </div>
    );
  }

  // Respondent info screen (for non-anonymous surveys)
  if (currentIndex === -2) {
    return (
      <div
        ref={containerRef}
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: bgColor }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <h2 className="text-2xl font-bold mb-2">Before we begin...</h2>
          <p className="text-gray-600 mb-6">Please provide your information</p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={respondentInfo.email}
                onChange={(e) => setRespondentInfo((p) => ({ ...p, email: e.target.value }))}
                placeholder="your@email.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                value={respondentInfo.name}
                onChange={(e) => setRespondentInfo((p) => ({ ...p, name: e.target.value }))}
                placeholder="Your name"
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={() => setCurrentIndex(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <Button
              onClick={() => setCurrentIndex(0)}
              disabled={!respondentInfo.email}
              className="flex-1"
              style={{ backgroundColor: accentColor }}
            >
              Continue <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Question display
  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: bgColor }}
    >
      {/* Progress bar */}
      <div className="h-1 bg-gray-200">
        <motion.div
          className="h-full"
          style={{ backgroundColor: accentColor }}
          initial={{ width: 0 }}
          animate={{ width: `${(getQuestionNumber() / visibleQuestions.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {currentQuestion && (
                <div>
                  {/* Question number */}
                  {currentQuestion.type !== "SECTION_HEADER" && (
                    <div className="text-sm text-gray-500 mb-2">
                      Question {getQuestionNumber()} of {visibleQuestions.length}
                    </div>
                  )}

                  {/* Section Header */}
                  {currentQuestion.type === "SECTION_HEADER" ? (
                    <div className="py-8">
                      <div
                        className="w-12 h-1 mb-6 rounded-full"
                        style={{ backgroundColor: accentColor }}
                      />
                      <h2 className="text-2xl font-bold mb-2">{currentQuestion.title}</h2>
                      {currentQuestion.description && (
                        <p className="text-gray-600">{currentQuestion.description}</p>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Question title */}
                      <h2 className="text-2xl font-bold mb-2">
                        {currentQuestion.title}
                        {currentQuestion.required && <span style={{ color: accentColor }}> *</span>}
                      </h2>
                      {currentQuestion.description && (
                        <p className="text-gray-600 mb-6">{currentQuestion.description}</p>
                      )}

                      {/* Question input based on type */}
                      <motion.div variants={containerVariants} initial="initial" animate="animate" className="mt-6">
                        {renderQuestionInput(currentQuestion, answers, updateAnswer, inputRef, accentColor)}
                      </motion.div>
                    </>
                  )}

                  {/* Navigation */}
                  <div className="flex gap-3 mt-8">
                    {currentIndex > 0 && (
                      <Button variant="outline" onClick={goBack}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                      </Button>
                    )}
                    <Button
                      onClick={goNext}
                      disabled={!canProceed() || submitting}
                      className="flex-1"
                      style={{ backgroundColor: canProceed() ? accentColor : undefined }}
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : currentIndex === allVisibleQuestions.length - 1 ? (
                        <>Submit <Check className="ml-2 w-4 h-4" /></>
                      ) : (
                        <>Continue <ArrowRight className="ml-2 w-4 h-4" /></>
                      )}
                    </Button>
                  </div>

                  {/* Press Enter hint */}
                  {canProceed() && (
                    <p className="text-center text-sm text-gray-400 mt-4">
                      Press <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Enter ↵</kbd> to continue
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// Render question input based on type
function renderQuestionInput(
  question: Question,
  answers: Record<string, unknown>,
  updateAnswer: (id: string, value: unknown) => void,
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  accentColor: string
) {
  const answer = answers[question.id];

  switch (question.type) {
    case "SHORT_TEXT":
    case "EMAIL":
    case "PHONE":
      return (
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={question.type === "EMAIL" ? "email" : question.type === "PHONE" ? "tel" : "text"}
          value={(answer as string) || ""}
          onChange={(e) => updateAnswer(question.id, e.target.value)}
          placeholder={
            question.type === "EMAIL" ? "your@email.com" :
            question.type === "PHONE" ? "+1 (555) 123-4567" :
            "Type your answer..."
          }
          className="text-lg py-6"
        />
      );

    case "LONG_TEXT":
      return (
        <Textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={(answer as string) || ""}
          onChange={(e) => updateAnswer(question.id, e.target.value)}
          placeholder="Type your answer..."
          className="text-lg min-h-[150px]"
        />
      );

    case "NUMBER":
      return (
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="number"
          value={(answer as string) || ""}
          onChange={(e) => updateAnswer(question.id, e.target.value)}
          placeholder="0"
          className="text-lg py-6"
        />
      );

    case "DATE":
      return (
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="date"
          value={(answer as string) || ""}
          onChange={(e) => updateAnswer(question.id, e.target.value)}
          className="text-lg py-6"
        />
      );

    case "TIME":
      return (
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="time"
          value={(answer as string) || ""}
          onChange={(e) => updateAnswer(question.id, e.target.value)}
          className="text-lg py-6"
        />
      );

    case "SINGLE_CHOICE":
    case "DROPDOWN":
      return (
        <div className="space-y-3">
          {question.options?.map((option, i) => (
            <motion.button
              key={i}
              variants={itemVariants}
              onClick={() => updateAnswer(question.id, option)}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                answer === option
                  ? "border-current bg-opacity-10"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              style={answer === option ? { borderColor: accentColor, backgroundColor: `${accentColor}10` } : {}}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    answer === option ? "border-current" : "border-gray-300"
                  }`}
                  style={answer === option ? { borderColor: accentColor } : {}}
                >
                  {answer === option && (
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
                  )}
                </div>
                <span>{option}</span>
              </div>
            </motion.button>
          ))}
        </div>
      );

    case "MULTIPLE_CHOICE":
      const selected = (answer as string[]) || [];
      return (
        <div className="space-y-3">
          {question.options?.map((option, i) => (
            <motion.button
              key={i}
              variants={itemVariants}
              onClick={() => {
                const newSelected = selected.includes(option)
                  ? selected.filter((s) => s !== option)
                  : [...selected, option];
                updateAnswer(question.id, newSelected);
              }}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selected.includes(option)
                  ? "border-current bg-opacity-10"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              style={selected.includes(option) ? { borderColor: accentColor, backgroundColor: `${accentColor}10` } : {}}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selected.includes(option) ? "border-current" : "border-gray-300"
                  }`}
                  style={selected.includes(option) ? { borderColor: accentColor, backgroundColor: accentColor } : {}}
                >
                  {selected.includes(option) && <Check className="w-3 h-3 text-white" />}
                </div>
                <span>{option}</span>
              </div>
            </motion.button>
          ))}
        </div>
      );

    case "YES_NO":
      return (
        <div className="flex gap-4">
          {["Yes", "No"].map((opt) => (
            <motion.button
              key={opt}
              variants={itemVariants}
              onClick={() => updateAnswer(question.id, opt)}
              className={`flex-1 p-6 rounded-lg border-2 text-center font-medium transition-all ${
                answer === opt ? "border-current" : "border-gray-200 hover:border-gray-300"
              }`}
              style={answer === opt ? { borderColor: accentColor, backgroundColor: `${accentColor}10` } : {}}
            >
              {opt}
            </motion.button>
          ))}
        </div>
      );

    case "RATING":
      return (
        <div className="flex gap-2 justify-center">
          {[1, 2, 3, 4, 5].map((star) => (
            <motion.button
              key={star}
              variants={itemVariants}
              onClick={() => updateAnswer(question.id, star)}
              className="p-2 transition-transform hover:scale-110"
            >
              <svg
                className="w-10 h-10"
                fill={(answer as number) >= star ? accentColor : "none"}
                stroke={accentColor}
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </motion.button>
          ))}
        </div>
      );

    case "SCALE":
      const scaleMin = question.settings?.scaleMin || 1;
      const scaleMax = question.settings?.scaleMax || 10;
      return (
        <div className="space-y-4">
          <div className="flex justify-between gap-2">
            {Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => scaleMin + i).map((num) => (
              <motion.button
                key={num}
                variants={itemVariants}
                onClick={() => updateAnswer(question.id, num)}
                className={`flex-1 py-4 rounded-lg border-2 font-medium transition-all ${
                  answer === num ? "border-current" : "border-gray-200 hover:border-gray-300"
                }`}
                style={answer === num ? { borderColor: accentColor, backgroundColor: `${accentColor}10` } : {}}
              >
                {num}
              </motion.button>
            ))}
          </div>
          {question.settings?.scaleLabels && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>{question.settings.scaleLabels[scaleMin]}</span>
              <span>{question.settings.scaleLabels[scaleMax]}</span>
            </div>
          )}
        </div>
      );

    case "NPS":
      return (
        <div className="space-y-4">
          <div className="flex justify-between gap-1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <motion.button
                key={num}
                variants={itemVariants}
                onClick={() => updateAnswer(question.id, num)}
                className={`flex-1 py-3 rounded text-sm font-medium transition-all ${
                  answer === num ? "text-white" : "border hover:bg-gray-50"
                } ${
                  num <= 6 ? "border-red-200 bg-red-50" : num <= 8 ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50"
                }`}
                style={answer === num ? { backgroundColor: accentColor } : {}}
              >
                {num}
              </motion.button>
            ))}
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>{question.settings?.minLabel || "Not likely"}</span>
            <span>{question.settings?.maxLabel || "Very likely"}</span>
          </div>
        </div>
      );

    case "LIKERT":
      const scale = question.settings?.scale || ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"];
      return (
        <div className="space-y-3">
          {scale.map((option, i) => (
            <motion.button
              key={i}
              variants={itemVariants}
              onClick={() => updateAnswer(question.id, option)}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                answer === option ? "border-current" : "border-gray-200 hover:border-gray-300"
              }`}
              style={answer === option ? { borderColor: accentColor, backgroundColor: `${accentColor}10` } : {}}
            >
              {option}
            </motion.button>
          ))}
        </div>
      );

    case "SLIDER":
      const min = question.settings?.min || 0;
      const max = question.settings?.max || 100;
      const step = question.settings?.step || 1;
      return (
        <div className="space-y-4">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={(answer as number) || min}
            onChange={(e) => updateAnswer(question.id, parseInt(e.target.value))}
            className="w-full h-3 rounded-full appearance-none cursor-pointer"
            style={{ accentColor }}
          />
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">{min}</span>
            <span className="text-2xl font-bold" style={{ color: accentColor }}>
              {answer !== undefined ? String(answer) : min}
            </span>
            <span className="text-sm text-gray-500">{max}</span>
          </div>
        </div>
      );

    case "MATRIX":
      const matrixAnswers = (answer as Record<string, number>) || {};
      const matrixMin = question.settings?.scaleMin || 1;
      const matrixMax = question.settings?.scaleMax || 5;
      return (
        <div className="space-y-4">
          {question.options?.map((item, i) => (
            <motion.div key={i} variants={itemVariants} className="p-4 bg-white rounded-lg border">
              <div className="font-medium mb-3">{item}</div>
              <div className="flex gap-2">
                {Array.from({ length: matrixMax - matrixMin + 1 }, (_, j) => matrixMin + j).map((val) => (
                  <button
                    key={val}
                    onClick={() => updateAnswer(question.id, { ...matrixAnswers, [item]: val })}
                    className={`flex-1 py-2 rounded border-2 text-sm transition-all ${
                      matrixAnswers[item] === val ? "border-current" : "border-gray-200"
                    }`}
                    style={matrixAnswers[item] === val ? { borderColor: accentColor, backgroundColor: `${accentColor}10` } : {}}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      );

    case "RANKING":
      const rankItems = (answer as string[]) || [...(question.options || [])];
      const moveItem = (from: number, to: number) => {
        const newItems = [...rankItems];
        const [moved] = newItems.splice(from, 1);
        newItems.splice(to, 0, moved);
        updateAnswer(question.id, newItems);
      };
      return (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 mb-4">Drag to reorder</p>
          {rankItems.map((item, i) => (
            <motion.div
              key={item}
              variants={itemVariants}
              className="flex items-center gap-3 p-4 bg-white rounded-lg border"
            >
              <GripVertical className="w-5 h-5 text-gray-400 cursor-grab" />
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium text-white"
                style={{ backgroundColor: accentColor }}
              >
                {i + 1}
              </span>
              <span className="flex-1">{item}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => i > 0 && moveItem(i, i - 1)}
                  disabled={i === 0}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => i < rankItems.length - 1 && moveItem(i, i + 1)}
                  disabled={i === rankItems.length - 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      );

    case "CONSTANT_SUM":
      const sumAnswers = (answer as Record<string, number>) || {};
      const total = question.settings?.total || 100;
      const currentSum = Object.values(sumAnswers).reduce((a, b) => a + b, 0);
      return (
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Allocate {total} points</span>
            <span className={currentSum === total ? "text-green-600 font-medium" : "text-gray-500"}>
              {currentSum} / {total}
            </span>
          </div>
          {question.options?.map((opt, i) => (
            <motion.div key={i} variants={itemVariants} className="flex items-center gap-4">
              <span className="flex-1">{opt}</span>
              <Input
                type="number"
                min={0}
                max={total}
                value={sumAnswers[opt] || 0}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  updateAnswer(question.id, { ...sumAnswers, [opt]: Math.max(0, val) });
                }}
                className="w-24 text-center"
              />
            </motion.div>
          ))}
          {currentSum !== total && (
            <p className="text-sm text-red-500">
              {currentSum < total ? `${total - currentSum} more points to allocate` : `${currentSum - total} points over limit`}
            </p>
          )}
        </div>
      );

    case "IMAGE_CHOICE":
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {question.options?.map((option, i) => {
            const imageUrl = question.settings?.imageUrls?.[option];
            return (
              <motion.button
                key={i}
                variants={itemVariants}
                onClick={() => updateAnswer(question.id, option)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  answer === option ? "border-current" : "border-gray-200 hover:border-gray-300"
                }`}
                style={answer === option ? { borderColor: accentColor, backgroundColor: `${accentColor}10` } : {}}
              >
                <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                  {imageUrl ? (
                    <Image src={imageUrl} alt={option} width={100} height={100} className="object-cover rounded-lg" />
                  ) : (
                    <span className="text-gray-400 text-4xl">{i + 1}</span>
                  )}
                </div>
                <span className="text-sm">{option}</span>
              </motion.button>
            );
          })}
        </div>
      );

    default:
      return <p className="text-gray-500">Unsupported question type: {question.type}</p>;
  }
}
