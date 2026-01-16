"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Lock,
  Mail,
  ArrowRight,
  ArrowLeft,
  Check,
} from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

// Animation variants for smooth page transitions
const pageVariants = {
  initial: (direction: "forward" | "backward") => ({
    x: direction === "forward" ? 100 : -100,
    opacity: 0,
    scale: 0.95,
  }),
  animate: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 30,
      mass: 1,
    },
  },
  exit: (direction: "forward" | "backward") => ({
    x: direction === "forward" ? -100 : 100,
    opacity: 0,
    scale: 0.95,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 30,
    },
  }),
};

// Staggered children animation for options
const containerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
    },
  },
};

// Button hover/tap animations
const buttonVariants = {
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
};

// Option card animations
const optionVariants = {
  initial: { opacity: 0, x: -20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
  },
  hover: {
    scale: 1.02,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    transition: { duration: 0.2 },
  },
  tap: { scale: 0.98 },
  selected: {
    backgroundColor: "rgba(255, 79, 1, 0.2)",
    borderColor: "#FF4F01",
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
    // Matrix-specific settings
    scaleMin?: number;
    scaleMax?: number;
    scaleLabels?: Record<number, string>;
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

// Confetti component
function Confetti() {
  const colors = ["#FF4F01", "#1a1a2e", "#c9c1ed", "#22c55e", "#3b82f6", "#f59e0b", "#ec4899"];
  const confettiPieces = Array.from({ length: 150 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 3,
    duration: 3 + Math.random() * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 8 + Math.random() * 8,
    rotation: Math.random() * 360,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti"
          style={{
            left: `${piece.left}%`,
            top: "-20px",
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            transform: `rotate(${piece.rotation}deg)`,
            borderRadius: Math.random() > 0.5 ? "50%" : "0",
          }}
        />
      ))}
    </div>
  );
}

export default function SurveyResponsePage() {
  const params = useParams();
  const { user, isLoaded: userLoaded } = useUser();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<{ type: string; message: string } | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [respondentInfo, setRespondentInfo] = useState({ email: "", name: "" });

  // Typeform-style navigation
  const [currentIndex, setCurrentIndex] = useState(-1); // -1 = welcome screen, -2 = info screen (if not anonymous)
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isAnimating, setIsAnimating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    async function fetchSurvey() {
      try {
        const userEmail = user?.primaryEmailAddress?.emailAddress;
        const url = userEmail
          ? `/api/surveys/${params.id}/public?email=${encodeURIComponent(userEmail)}`
          : `/api/surveys/${params.id}/public`;

        const res = await fetch(url);

        if (!res.ok) {
          const data = await res.json();
          if (res.status === 404) {
            setError("Survey not found");
          } else if (res.status === 403) {
            if (data.accessType === "INVITE_ONLY") {
              if (data.requiresAuth) {
                setAccessError({ type: "needs_signin", message: data.error });
              } else if (data.notInvited) {
                setAccessError({ type: "not_invited", message: data.error });
              } else {
                setAccessError({ type: "invite_only", message: data.error });
              }
            } else {
              setError(data.error || "This survey is not available");
            }
          } else {
            setError("Failed to load survey");
          }
          return;
        }
        const data = await res.json();
        setSurvey(data);
        setAccessError(null);
      } catch {
        setError("Failed to load survey");
      } finally {
        setLoading(false);
      }
    }

    if (params.id && userLoaded) {
      fetchSurvey();
    }
  }, [params.id, userLoaded, user]);

  // Auto-focus input when question changes
  useEffect(() => {
    if (inputRef.current && currentIndex >= 0) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [currentIndex]);

  // Count only answerable questions (exclude SECTION_HEADER)
  const answerableQuestions = survey?.questions.filter(q => q.type !== "SECTION_HEADER") || [];
  const totalSteps = survey ? answerableQuestions.length + (survey.isAnonymous ? 0 : 1) : 0;
  // Calculate current step excluding SECTION_HEADER questions already passed
  const questionsBeforeCurrent = survey?.questions.slice(0, Math.max(0, currentIndex + 1)).filter(q => q.type !== "SECTION_HEADER") || [];
  const currentStep = survey?.isAnonymous ? questionsBeforeCurrent.length : questionsBeforeCurrent.length + 1;
  const progress = totalSteps > 0 ? Math.max(0, (currentStep / totalSteps) * 100) : 0;

  const currentQuestion = survey && currentIndex >= 0 ? survey.questions[currentIndex] : null;

  const updateAnswer = (questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleMultipleChoice = (questionId: string, option: string, checked: boolean) => {
    const current = (answers[questionId] as string[]) || [];
    if (checked) {
      updateAnswer(questionId, [...current, option]);
    } else {
      updateAnswer(questionId, current.filter((o) => o !== option));
    }
  };

  const canProceed = useCallback(() => {
    if (!survey) return false;

    // Welcome screen
    if (currentIndex === -1) return true;

    // Info screen (if not anonymous)
    if (!survey.isAnonymous && currentIndex === -2) {
      return respondentInfo.email.includes("@");
    }

    // Question screens
    if (currentIndex >= 0 && currentQuestion) {
      // SECTION_HEADER always allows proceeding (no answer needed)
      if (currentQuestion.type === "SECTION_HEADER") return true;

      // MATRIX validation - ensure all items have been rated if required
      if (currentQuestion.type === "MATRIX" && currentQuestion.required) {
        const answer = answers[currentQuestion.id] as Record<string, number> | undefined;
        if (!answer) return false;
        // Ensure all items have been rated
        const requiredItems = currentQuestion.options || [];
        return requiredItems.every(item => answer[item] !== undefined);
      }

      if (!currentQuestion.required) return true;
      const answer = answers[currentQuestion.id];
      if (answer === undefined || answer === "" || (Array.isArray(answer) && answer.length === 0)) {
        return false;
      }
    }

    return true;
  }, [survey, currentIndex, currentQuestion, answers, respondentInfo]);

  // Evaluate if a question should be shown based on skip logic
  const shouldShowQuestion = useCallback((question: Question, currentAnswers: Record<string, unknown>) => {
    const skipLogic = question.settings?.skipLogic;
    if (!skipLogic?.enabled || !skipLogic.conditions?.length) {
      return true; // No skip logic, always show
    }

    const evaluateCondition = (condition: SkipCondition): boolean => {
      const answer = currentAnswers[condition.questionId];
      if (answer === undefined || answer === null) return false;

      const answerStr = Array.isArray(answer) ? answer.join(",") : String(answer);
      const conditionValue = condition.value;

      switch (condition.operator) {
        case "equals":
          if (Array.isArray(answer)) {
            return answer.includes(conditionValue);
          }
          return answerStr === conditionValue;
        case "not_equals":
          if (Array.isArray(answer)) {
            return !answer.includes(conditionValue);
          }
          return answerStr !== conditionValue;
        case "contains":
          return answerStr.toLowerCase().includes(conditionValue.toLowerCase());
        case "greater_than":
          return Number(answerStr) > Number(conditionValue);
        case "less_than":
          return Number(answerStr) < Number(conditionValue);
        default:
          return true;
      }
    };

    const results = skipLogic.conditions.map(evaluateCondition);
    return skipLogic.logic === "any"
      ? results.some((r) => r)
      : results.every((r) => r);
  }, []);

  // Find the next visible question index
  const findNextVisibleQuestion = useCallback((fromIndex: number) => {
    if (!survey) return -1;
    for (let i = fromIndex + 1; i < survey.questions.length; i++) {
      if (shouldShowQuestion(survey.questions[i], answers)) {
        return i;
      }
    }
    return -1; // No more visible questions, submit
  }, [survey, answers, shouldShowQuestion]);

  // Find the previous visible question index
  const findPrevVisibleQuestion = useCallback((fromIndex: number) => {
    if (!survey) return -1;
    for (let i = fromIndex - 1; i >= 0; i--) {
      if (shouldShowQuestion(survey.questions[i], answers)) {
        return i;
      }
    }
    return -1; // No previous visible questions
  }, [survey, answers, shouldShowQuestion]);

  const goNext = useCallback(() => {
    if (!survey || isAnimating || !canProceed()) return;

    setIsAnimating(true);
    setDirection("forward");

    setTimeout(() => {
      if (currentIndex === -1) {
        // From welcome to either info screen or first question
        if (survey.isAnonymous) {
          // Find first visible question
          const firstVisible = survey.questions.findIndex((q) => shouldShowQuestion(q, answers));
          setCurrentIndex(firstVisible >= 0 ? firstVisible : survey.questions.length);
        } else {
          setCurrentIndex(-2);
        }
      } else if (!survey.isAnonymous && currentIndex === -2) {
        // From info screen to first visible question
        const firstVisible = survey.questions.findIndex((q) => shouldShowQuestion(q, answers));
        setCurrentIndex(firstVisible >= 0 ? firstVisible : survey.questions.length);
      } else {
        // Find next visible question
        const nextIndex = findNextVisibleQuestion(currentIndex);
        if (nextIndex >= 0) {
          setCurrentIndex(nextIndex);
        } else {
          // No more visible questions, submit
          handleSubmit();
        }
      }
      setIsAnimating(false);
    }, 300);
  }, [survey, currentIndex, isAnimating, canProceed, answers, shouldShowQuestion, findNextVisibleQuestion]);

  const goBack = useCallback(() => {
    if (!survey || isAnimating || currentIndex === -1) return;

    setIsAnimating(true);
    setDirection("backward");

    setTimeout(() => {
      if (!survey.isAnonymous && currentIndex === -2) {
        setCurrentIndex(-1);
      } else if (currentIndex >= 0) {
        // Find previous visible question
        const prevIndex = findPrevVisibleQuestion(currentIndex);
        if (prevIndex >= 0) {
          setCurrentIndex(prevIndex);
        } else {
          // No previous visible questions, go to welcome/info screen
          setCurrentIndex(survey.isAnonymous ? -1 : -2);
        }
      }
      setIsAnimating(false);
    }, 300);
  }, [survey, currentIndex, isAnimating, findPrevVisibleQuestion]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext]);

  const handleSubmit = async () => {
    if (!survey) return;

    // Validate all required questions that are visible (not skipped)
    for (const question of survey.questions) {
      // Skip validation for questions that aren't shown due to skip logic
      if (!shouldShowQuestion(question, answers)) continue;

      if (question.required) {
        const answer = answers[question.id];
        if (answer === undefined || answer === "" || (Array.isArray(answer) && answer.length === 0)) {
          setError(`Please answer: "${question.title}"`);
          return;
        }
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const userEmail = user?.primaryEmailAddress?.emailAddress;
      const emailToSubmit = survey.accessType === "INVITE_ONLY"
        ? userEmail
        : (survey.isAnonymous ? undefined : respondentInfo.email);

      const res = await fetch("/api/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyId: survey.id,
          answers: Object.entries(answers).map(([questionId, value]) => ({
            questionId,
            value,
          })),
          respondentEmail: emailToSubmit,
          respondentName: survey.isAnonymous ? undefined : respondentInfo.name,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit response");
      }

      setShowConfetti(true);
      setTimeout(() => setSubmitted(true), 500);
    } catch {
      setError("Failed to submit your response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !userLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#2d2d44] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-white/60 mx-auto" />
          <p className="text-white/40 mt-4 text-sm">Loading survey...</p>
        </div>
      </div>
    );
  }

  // Access error screens
  if (accessError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#2d2d44] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          {accessError.type === "needs_signin" ? (
            <>
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
                <Lock className="w-10 h-10 text-white/80" />
              </div>
              <h2 className="font-['Syne'] text-2xl font-semibold text-white mb-3">Sign in Required</h2>
              <p className="text-white/60 mb-8">
                This survey requires you to sign in to verify your email address.
              </p>
              <SignInButton mode="modal" forceRedirectUrl={`/s/${params.id}`}>
                <Button size="lg" className="bg-[#FF4F01] hover:bg-[#e54600] text-white px-8">
                  <Mail className="w-5 h-5 mr-2" />
                  Sign in to Continue
                </Button>
              </SignInButton>
            </>
          ) : accessError.type === "not_invited" ? (
            <>
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-red-400" />
              </div>
              <h2 className="font-['Syne'] text-2xl font-semibold text-white mb-3">Access Denied</h2>
              <p className="text-white/60 mb-2">
                Your email address is not on the invite list for this survey.
              </p>
              {user?.primaryEmailAddress?.emailAddress && (
                <p className="text-white/40 text-sm">
                  Signed in as: {user.primaryEmailAddress.emailAddress}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
                <Lock className="w-10 h-10 text-white/80" />
              </div>
              <h2 className="font-['Syne'] text-2xl font-semibold text-white mb-3">Invitation Required</h2>
              <p className="text-white/60">{accessError.message}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#2d2d44] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="font-['Syne'] text-2xl font-semibold text-white mb-3">{error}</h2>
          <p className="text-white/60">
            The survey you're looking for may have been closed or doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  // Success screen with confetti
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#2d2d44] flex items-center justify-center p-6">
        {showConfetti && <Confetti />}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
          className="max-w-md w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.4 }}
            className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-8"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.6 }}
            >
              <CheckCircle2 className="w-12 h-12 text-green-400" />
            </motion.div>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="font-['Syne'] text-4xl font-bold text-white mb-4"
          >
            Thank you!
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="text-white/60 text-lg"
          >
            Your response has been recorded. We appreciate you taking the time to complete this survey.
          </motion.p>
        </motion.div>
      </div>
    );
  }

  if (!survey) return null;

  const isLastQuestion = currentIndex === survey.questions.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#2d2d44] flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-40">
        <div className="h-1 bg-white/10">
          <div
            className="h-full bg-[#FF4F01] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Header */}
      <header className="fixed top-4 left-0 right-0 z-30 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Image
            src="https://cdn.prod.website-files.com/686e52cd9c00136ae69ac4d6/68751c8e13a5456b2330eb95_andus-sun-1.svg"
            alt="Andus Labs"
            width={36}
            height={36}
            className="opacity-80"
          />
          {currentIndex >= 0 && (
            <span className="text-white/40 text-sm font-medium">
              {currentIndex + 1} of {survey.questions.length}
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 py-24">
        <AnimatePresence mode="wait" custom={direction}>
          {/* Welcome Screen */}
          {currentIndex === -1 && (
            <motion.div
              key="welcome"
              custom={direction}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full max-w-2xl text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#FF4F01] flex items-center justify-center mx-auto mb-8">
                <span className="text-white font-bold text-2xl">S</span>
              </div>
              <h1 className="font-['Syne'] text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                {survey.title}
              </h1>
              {survey.description && (
                <p className="text-white/60 text-lg md:text-xl mb-12 max-w-lg mx-auto">
                  {survey.description}
                </p>
              )}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={goNext}
                  size="lg"
                  className="bg-[#FF4F01] hover:bg-[#e54600] text-white px-10 py-6 text-lg rounded-xl group"
                >
                  Start Survey
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
            </motion.div>
          )}

          {/* Respondent Info Screen */}
          {!survey.isAnonymous && currentIndex === -2 && (
            <motion.div
              key="info"
              custom={direction}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full max-w-2xl"
            >
              <p className="text-[#FF4F01] text-sm font-medium mb-4 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Your Information
              </p>
              <h2 className="font-['Syne'] text-3xl md:text-4xl font-bold text-white mb-3">
                Before we start, tell us about yourself
              </h2>
              <p className="text-white/50 mb-10">
                This survey collects your identity for follow-up purposes.
              </p>

              <div className="space-y-6">
                <div>
                  <Label className="text-white/70 text-sm mb-2 block">Email *</Label>
                  <Input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="email"
                    value={respondentInfo.email}
                    onChange={(e) => setRespondentInfo((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="your@email.com"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-14 text-lg rounded-xl focus:border-[#FF4F01] focus:ring-[#FF4F01]"
                  />
                </div>
                <div>
                  <Label className="text-white/70 text-sm mb-2 block">Name (optional)</Label>
                  <Input
                    value={respondentInfo.name}
                    onChange={(e) => setRespondentInfo((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Your name"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-14 text-lg rounded-xl focus:border-[#FF4F01] focus:ring-[#FF4F01]"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Question Screens */}
          {currentQuestion && (
            <motion.div
              key={`question-${currentQuestion.id}`}
              custom={direction}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full max-w-2xl"
            >
              {/* Question number - skip counting for SECTION_HEADER */}
              <p className="text-[#FF4F01] text-sm font-medium mb-4">
                {currentQuestion.type === "SECTION_HEADER" ? (
                  "Section"
                ) : (
                  <>
                    Question {survey!.questions.slice(0, currentIndex + 1).filter(q => q.type !== "SECTION_HEADER").length}
                    {currentQuestion.required && <span className="text-white/40 ml-2">Required</span>}
                  </>
                )}
              </p>
              <h2 className="font-['Syne'] text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
                {currentQuestion.title}
              </h2>
              {currentQuestion.description && (
                currentQuestion.type === "SECTION_HEADER" ? (
                  <p className="text-lg md:text-xl text-white/70 mb-10 italic leading-relaxed">
                    <span className="text-[#FF4F01]">&ldquo;</span>
                    {currentQuestion.description}
                    <span className="text-[#FF4F01]">&rdquo;</span>
                  </p>
                ) : (
                  <p className="text-white/50 mb-10">{currentQuestion.description}</p>
                )
              )}

              {/* Short Text */}
              {currentQuestion.type === "SHORT_TEXT" && (
                <Input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  value={(answers[currentQuestion.id] as string) || ""}
                  onChange={(e) => updateAnswer(currentQuestion.id, e.target.value)}
                  placeholder="Type your answer here..."
                  className="bg-transparent border-0 border-b-2 border-white/20 rounded-none text-white text-2xl placeholder:text-white/30 h-16 focus:border-[#FF4F01] focus:ring-0 px-0"
                />
              )}

              {/* Long Text */}
              {currentQuestion.type === "LONG_TEXT" && (
                <Textarea
                  ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                  value={(answers[currentQuestion.id] as string) || ""}
                  onChange={(e) => updateAnswer(currentQuestion.id, e.target.value)}
                  placeholder="Type your answer here..."
                  rows={4}
                  className="bg-white/5 border-white/10 text-white text-lg placeholder:text-white/30 rounded-xl focus:border-[#FF4F01] focus:ring-[#FF4F01] resize-none"
                />
              )}

              {/* Email */}
              {currentQuestion.type === "EMAIL" && (
                <Input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type="email"
                  value={(answers[currentQuestion.id] as string) || ""}
                  onChange={(e) => updateAnswer(currentQuestion.id, e.target.value)}
                  placeholder="your@email.com"
                  className="bg-transparent border-0 border-b-2 border-white/20 rounded-none text-white text-2xl placeholder:text-white/30 h-16 focus:border-[#FF4F01] focus:ring-0 px-0"
                />
              )}

              {/* Number */}
              {currentQuestion.type === "NUMBER" && (
                <Input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type="number"
                  value={(answers[currentQuestion.id] as string) || ""}
                  onChange={(e) => updateAnswer(currentQuestion.id, e.target.value)}
                  placeholder="0"
                  className="bg-transparent border-0 border-b-2 border-white/20 rounded-none text-white text-4xl font-bold placeholder:text-white/30 h-20 focus:border-[#FF4F01] focus:ring-0 px-0 w-40"
                />
              )}

              {/* Date */}
              {currentQuestion.type === "DATE" && (
                <Input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type="date"
                  value={(answers[currentQuestion.id] as string) || ""}
                  onChange={(e) => updateAnswer(currentQuestion.id, e.target.value)}
                  className="bg-white/5 border-white/10 text-white text-lg h-14 rounded-xl focus:border-[#FF4F01] focus:ring-[#FF4F01] w-60"
                />
              )}

              {/* Single Choice */}
              {currentQuestion.type === "SINGLE_CHOICE" && currentQuestion.options && (
                <motion.div
                  className="space-y-3"
                  variants={containerVariants}
                  initial="initial"
                  animate="animate"
                >
                  {currentQuestion.options.map((option, idx) => {
                    const isSelected = answers[currentQuestion.id] === option;
                    return (
                      <motion.button
                        key={option}
                        variants={itemVariants}
                        whileHover={{ scale: 1.02, backgroundColor: isSelected ? "rgba(255, 79, 1, 0.15)" : "rgba(255, 255, 255, 0.08)" }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          updateAnswer(currentQuestion.id, option);
                          // Auto-advance after selection
                          setTimeout(goNext, 400);
                        }}
                        className={`w-full p-5 rounded-xl border-2 text-left flex items-center gap-4 group ${
                          isSelected
                            ? "border-[#FF4F01] bg-[#FF4F01]/10"
                            : "border-white/10"
                        }`}
                      >
                        <motion.span
                          animate={isSelected ? { scale: 1.1 } : { scale: 1 }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
                            isSelected
                              ? "bg-[#FF4F01] text-white"
                              : "bg-white/10 text-white/60 group-hover:bg-white/20"
                          }`}
                        >
                          {isSelected ? <Check className="w-4 h-4" /> : String.fromCharCode(65 + idx)}
                        </motion.span>
                        <span className={`text-lg ${isSelected ? "text-white" : "text-white/80"}`}>
                          {option}
                        </span>
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}

              {/* Multiple Choice */}
              {currentQuestion.type === "MULTIPLE_CHOICE" && currentQuestion.options && (
                <motion.div
                  className="space-y-3"
                  variants={containerVariants}
                  initial="initial"
                  animate="animate"
                >
                  {currentQuestion.options.map((option, idx) => {
                    const isSelected = ((answers[currentQuestion.id] as string[]) || []).includes(option);
                    return (
                      <motion.button
                        key={option}
                        variants={itemVariants}
                        whileHover={{ scale: 1.02, backgroundColor: isSelected ? "rgba(255, 79, 1, 0.15)" : "rgba(255, 255, 255, 0.08)" }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleMultipleChoice(currentQuestion.id, option, !isSelected)}
                        className={`w-full p-5 rounded-xl border-2 text-left flex items-center gap-4 group ${
                          isSelected
                            ? "border-[#FF4F01] bg-[#FF4F01]/10"
                            : "border-white/10"
                        }`}
                      >
                        <motion.span
                          animate={isSelected ? { scale: 1.1 } : { scale: 1 }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
                            isSelected
                              ? "bg-[#FF4F01] text-white"
                              : "bg-white/10 text-white/60 group-hover:bg-white/20"
                          }`}
                        >
                          {isSelected ? <Check className="w-4 h-4" /> : String.fromCharCode(65 + idx)}
                        </motion.span>
                        <span className={`text-lg ${isSelected ? "text-white" : "text-white/80"}`}>
                          {option}
                        </span>
                      </motion.button>
                    );
                  })}
                  <motion.p variants={itemVariants} className="text-white/40 text-sm mt-4">Select all that apply</motion.p>
                </motion.div>
              )}

              {/* Rating */}
              {currentQuestion.type === "RATING" && (
                <motion.div
                  className="flex gap-3 flex-wrap"
                  variants={containerVariants}
                  initial="initial"
                  animate="animate"
                >
                  {[1, 2, 3, 4, 5].map((rating) => {
                    const isSelected = answers[currentQuestion.id] === rating;
                    return (
                      <motion.button
                        key={rating}
                        variants={itemVariants}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        animate={isSelected ? { scale: 1.15, backgroundColor: "#FF4F01" } : { scale: 1 }}
                        onClick={() => {
                          updateAnswer(currentQuestion.id, rating);
                          setTimeout(goNext, 400);
                        }}
                        className={`w-16 h-16 rounded-xl border-2 font-bold text-xl ${
                          isSelected
                            ? "border-[#FF4F01] bg-[#FF4F01] text-white"
                            : "border-white/20 text-white/60"
                        }`}
                      >
                        {rating}
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}

              {/* Scale */}
              {currentQuestion.type === "SCALE" && (
                <div>
                  <motion.div
                    className="flex gap-2 flex-wrap"
                    variants={containerVariants}
                    initial="initial"
                    animate="animate"
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => {
                      const isSelected = answers[currentQuestion.id] === value;
                      return (
                        <motion.button
                          key={value}
                          variants={itemVariants}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          animate={isSelected ? { scale: 1.15, backgroundColor: "#FF4F01" } : { scale: 1 }}
                          onClick={() => {
                            updateAnswer(currentQuestion.id, value);
                            setTimeout(goNext, 400);
                          }}
                          className={`w-12 h-12 rounded-xl border-2 font-bold ${
                            isSelected
                              ? "border-[#FF4F01] bg-[#FF4F01] text-white"
                              : "border-white/20 text-white/60"
                          }`}
                        >
                          {value}
                        </motion.button>
                      );
                    })}
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex justify-between text-white/40 text-sm mt-4 px-1"
                  >
                    <span>Not at all</span>
                    <span>Extremely</span>
                  </motion.div>
                </div>
              )}

              {/* Section Header - Display Only */}
              {currentQuestion.type === "SECTION_HEADER" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8"
                >
                  <div className="w-16 h-1 bg-[#FF4F01] mx-auto mb-8 rounded-full" />
                  <p className="text-white/30 text-sm mt-4">
                    Press Enter or click OK to continue
                  </p>
                </motion.div>
              )}

              {/* Matrix Question */}
              {currentQuestion.type === "MATRIX" && currentQuestion.options && (
                <motion.div
                  variants={containerVariants}
                  initial="initial"
                  animate="animate"
                  className="w-full overflow-x-auto"
                >
                  <table className="w-full min-w-[400px]">
                    <thead>
                      <tr>
                        <th className="text-left p-3 text-white/60"></th>
                        {Array.from(
                          { length: ((currentQuestion.settings as { scaleMax?: number })?.scaleMax || 5) -
                                    ((currentQuestion.settings as { scaleMin?: number })?.scaleMin || 1) + 1 },
                          (_, i) => ((currentQuestion.settings as { scaleMin?: number })?.scaleMin || 1) + i
                        ).map((value) => (
                          <th key={value} className="p-3 w-14 text-center text-white/60 text-sm font-normal">
                            {value}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentQuestion.options.map((item) => {
                        const matrixAnswers = (answers[currentQuestion.id] as Record<string, number>) || {};
                        return (
                          <motion.tr
                            key={item}
                            variants={itemVariants}
                            className="border-t border-white/10"
                          >
                            <td className="p-3 text-white">{item}</td>
                            {Array.from(
                              { length: ((currentQuestion.settings as { scaleMax?: number })?.scaleMax || 5) -
                                        ((currentQuestion.settings as { scaleMin?: number })?.scaleMin || 1) + 1 },
                              (_, i) => ((currentQuestion.settings as { scaleMin?: number })?.scaleMin || 1) + i
                            ).map((value) => {
                              const isSelected = matrixAnswers[item] === value;
                              return (
                                <td key={value} className="p-3 w-14">
                                  <div className="flex justify-center">
                                    <motion.button
                                      whileHover={{ scale: 1.2 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => {
                                        const newAnswers = { ...matrixAnswers, [item]: value };
                                        updateAnswer(currentQuestion.id, newAnswers);
                                      }}
                                      className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                                        isSelected
                                          ? "border-[#FF4F01] bg-[#FF4F01]"
                                          : "border-white/30 hover:border-white/60"
                                      }`}
                                    >
                                      {isSelected && <Check className="w-4 h-4 text-white" />}
                                    </motion.button>
                                  </div>
                                </td>
                              );
                            })}
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Scale labels */}
                  <motion.div
                    variants={itemVariants}
                    className="flex justify-between text-white/40 text-sm mt-4 px-3"
                  >
                    <span>{(currentQuestion.settings as { scaleLabels?: Record<number, string> })?.scaleLabels?.[1] || "Low"}</span>
                    <span>{(currentQuestion.settings as { scaleLabels?: Record<number, string> })?.scaleLabels?.[5] || "High"}</span>
                  </motion.div>
                </motion.div>
              )}

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm"
                >
                  {error}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 p-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Button
            onClick={goBack}
            variant="ghost"
            disabled={currentIndex === -1 || isAnimating}
            className="text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-0"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {currentIndex >= -1 && currentIndex !== -1 && (
            <Button
              onClick={goNext}
              disabled={!canProceed() || isAnimating || submitting}
              className="bg-[#FF4F01] hover:bg-[#e54600] text-white px-6 disabled:opacity-50 group"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : isLastQuestion ? (
                <>
                  Submit
                  <Check className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  OK
                  <Check className="w-4 h-4 ml-2 group-hover:scale-110 transition-transform" />
                </>
              )}
            </Button>
          )}
        </div>

        {/* Keyboard hint */}
        <div className="text-center mt-4">
          <p className="text-white/20 text-xs">
            Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/40">Enter ↵</kbd>
          </p>
        </div>
      </footer>
    </div>
  );
}
