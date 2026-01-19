"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Phone,
  Clock,
  ChevronDown,
  GripVertical,
  Globe,
  MapPin,
  Upload,
  PenLine,
  EyeOff,
  Star,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Play,
  PartyPopper,
  FileText,
  ShieldCheck,
  ExternalLink,
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

// Display style types
type RatingDisplayStyle = "stars" | "hearts" | "emojis" | "thumbs" | "numbers";
type LikertDisplayStyle = "text" | "emoji" | "colored";
type ScaleDisplayStyle = "numbers" | "slider" | "colored";

interface Question {
  id: string;
  type: string;
  title: string;
  description?: string;
  required: boolean;
  options?: string[];
  settings?: {
    skipLogic?: SkipLogic;
    // Matrix/Scale settings
    scaleMin?: number;
    scaleMax?: number;
    scaleLabels?: Record<number, string>;
    // NPS settings
    minLabel?: string;
    maxLabel?: string;
    // Slider settings
    min?: number;
    max?: number;
    step?: number;
    // Likert settings
    scale?: string[];
    // Constant Sum settings
    total?: number;
    // Image Choice settings
    imageUrls?: Record<string, string>;
    // File Upload settings
    allowedTypes?: string[];
    maxSizeMB?: number;
    // Address settings
    includeCountry?: boolean;
    // Hidden field settings
    defaultValue?: string;
    // Display style for rating/likert/scale
    displayStyle?: RatingDisplayStyle | LikertDisplayStyle | ScaleDisplayStyle;
    // Welcome/End screen settings
    buttonText?: string;
    redirectUrl?: string;
    // Legal/Consent settings
    consentText?: string;
    linkUrl?: string;
    linkText?: string;
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
  const [uploading, setUploading] = useState(false);
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

  // Display-only question types that don't require answers
  const displayOnlyTypes = ["SECTION_HEADER", "WELCOME_SCREEN", "END_SCREEN", "STATEMENT"];
  // Count only answerable questions (exclude display-only types)
  const answerableQuestions = survey?.questions.filter(q => !displayOnlyTypes.includes(q.type)) || [];
  const totalSteps = survey ? answerableQuestions.length + (survey.isAnonymous ? 0 : 1) : 0;
  // Calculate current step excluding display-only questions already passed
  const questionsBeforeCurrent = survey?.questions.slice(0, Math.max(0, currentIndex + 1)).filter(q => !displayOnlyTypes.includes(q.type)) || [];
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
      // Display-only types always allow proceeding (no answer needed)
      if (
        currentQuestion.type === "SECTION_HEADER" ||
        currentQuestion.type === "HIDDEN" ||
        currentQuestion.type === "WELCOME_SCREEN" ||
        currentQuestion.type === "END_SCREEN" ||
        currentQuestion.type === "STATEMENT"
      ) return true;

      // LEGAL requires acceptance if required
      if (currentQuestion.type === "LEGAL") {
        if (!currentQuestion.required) return true;
        return answers[currentQuestion.id] === true;
      }

      // ADDRESS validation - need at least a street address if required
      if (currentQuestion.type === "ADDRESS" && currentQuestion.required) {
        const answer = answers[currentQuestion.id] as Record<string, string> | undefined;
        if (!answer || !answer.street?.trim()) return false;
        return true;
      }

      // MATRIX validation - ensure all items have been rated if required
      if (currentQuestion.type === "MATRIX" && currentQuestion.required) {
        const answer = answers[currentQuestion.id] as Record<string, number> | undefined;
        if (!answer) return false;
        // Ensure all items have been rated
        const requiredItems = currentQuestion.options || [];
        return requiredItems.every(item => answer[item] !== undefined);
      }

      // RANKING validation - ensure all items have been ranked if required
      if (currentQuestion.type === "RANKING" && currentQuestion.required) {
        const answer = answers[currentQuestion.id] as string[] | undefined;
        if (!answer) return false;
        return answer.length === (currentQuestion.options?.length || 0);
      }

      // CONSTANT_SUM validation - ensure sum equals total
      if (currentQuestion.type === "CONSTANT_SUM" && currentQuestion.required) {
        const answer = answers[currentQuestion.id] as Record<string, number> | undefined;
        if (!answer) return false;
        const total = currentQuestion.settings?.total || 100;
        const sum = Object.values(answer).reduce((a, b) => a + b, 0);
        return sum === total;
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
          <p className="text-white/70 mt-4 text-sm">Loading survey...</p>
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
                <p className="text-white/70 text-sm">
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
            <span className="text-white/70 text-sm font-medium">
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
              <p className="text-white/80 mb-10">
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
                    {currentQuestion.required && <span className="text-white/70 ml-2">Required</span>}
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
                  <p className="text-white/80 mb-10">{currentQuestion.description}</p>
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
                  role="radiogroup"
                  aria-label={currentQuestion.title}
                >
                  {currentQuestion.options.map((option, idx) => {
                    const isSelected = answers[currentQuestion.id] === option;
                    return (
                      <motion.button
                        key={option}
                        role="radio"
                        aria-checked={isSelected}
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
                  <motion.p variants={itemVariants} className="text-white/70 text-sm mt-4">Select all that apply</motion.p>
                </motion.div>
              )}

              {/* Rating */}
              {currentQuestion.type === "RATING" && (() => {
                const displayStyle = (currentQuestion.settings?.displayStyle as RatingDisplayStyle) || "numbers";
                const selectedRating = answers[currentQuestion.id] as number;

                // Render functions for different styles
                const renderRatingIcon = (rating: number, isSelected: boolean, isHovered: boolean) => {
                  const filled = isSelected || (selectedRating !== undefined && rating <= selectedRating);

                  switch (displayStyle) {
                    case "stars":
                      return (
                        <Star
                          className={`w-10 h-10 transition-all ${
                            filled ? "fill-yellow-400 text-yellow-400" : "text-white/30"
                          } ${isHovered && !filled ? "text-yellow-400/50" : ""}`}
                        />
                      );
                    case "hearts":
                      return (
                        <Heart
                          className={`w-10 h-10 transition-all ${
                            filled ? "fill-red-500 text-red-500" : "text-white/30"
                          } ${isHovered && !filled ? "text-red-500/50" : ""}`}
                        />
                      );
                    case "emojis":
                      const emojis = ["😞", "😕", "😐", "🙂", "😄"];
                      return (
                        <span className={`text-4xl transition-all ${filled ? "scale-110" : "grayscale opacity-50"}`}>
                          {emojis[rating - 1]}
                        </span>
                      );
                    case "thumbs":
                      // Thumbs: 1-2 = thumbs down, 3 = neutral, 4-5 = thumbs up
                      if (rating <= 2) {
                        return (
                          <ThumbsDown
                            className={`w-10 h-10 transition-all ${
                              filled ? "fill-red-500 text-red-500" : "text-white/30"
                            }`}
                          />
                        );
                      } else if (rating === 3) {
                        return (
                          <span className={`text-3xl ${filled ? "" : "grayscale opacity-50"}`}>😐</span>
                        );
                      } else {
                        return (
                          <ThumbsUp
                            className={`w-10 h-10 transition-all ${
                              filled ? "fill-green-500 text-green-500" : "text-white/30"
                            }`}
                          />
                        );
                      }
                    case "numbers":
                    default:
                      return (
                        <span className="text-xl font-bold">{rating}</span>
                      );
                  }
                };

                return (
                  <motion.div
                    className="flex gap-3 flex-wrap justify-center"
                    variants={containerVariants}
                    initial="initial"
                    animate="animate"
                  >
                    {[1, 2, 3, 4, 5].map((rating) => {
                      const isSelected = selectedRating === rating;
                      const [isHovered, setIsHovered] = React.useState(false);

                      return (
                        <motion.button
                          key={rating}
                          variants={itemVariants}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onHoverStart={() => setIsHovered(true)}
                          onHoverEnd={() => setIsHovered(false)}
                          onClick={() => {
                            updateAnswer(currentQuestion.id, rating);
                            setTimeout(goNext, 400);
                          }}
                          className={`w-16 h-16 rounded-xl border-2 flex items-center justify-center transition-all ${
                            displayStyle === "numbers"
                              ? isSelected
                                ? "border-[#FF4F01] bg-[#FF4F01] text-white"
                                : "border-white/20 text-white/60"
                              : isSelected
                                ? "border-[#FF4F01] bg-[#FF4F01]/10"
                                : "border-white/10 bg-white/5"
                          }`}
                        >
                          {renderRatingIcon(rating, isSelected, isHovered)}
                        </motion.button>
                      );
                    })}
                  </motion.div>
                );
              })()}

              {/* Scale */}
              {currentQuestion.type === "SCALE" && (() => {
                const displayStyle = (currentQuestion.settings?.displayStyle as ScaleDisplayStyle) || "numbers";
                const min = currentQuestion.settings?.scaleMin || 1;
                const max = currentQuestion.settings?.scaleMax || 10;
                const scaleValues = Array.from({ length: max - min + 1 }, (_, i) => min + i);

                // Colored gradient for colored style
                const getColorClass = (value: number) => {
                  const normalizedValue = (value - min) / (max - min);
                  if (normalizedValue <= 0.2) return "bg-red-500/20 border-red-500 text-red-400";
                  if (normalizedValue <= 0.4) return "bg-orange-500/20 border-orange-500 text-orange-400";
                  if (normalizedValue <= 0.6) return "bg-yellow-500/20 border-yellow-500 text-yellow-400";
                  if (normalizedValue <= 0.8) return "bg-lime-500/20 border-lime-500 text-lime-400";
                  return "bg-green-500/20 border-green-500 text-green-400";
                };

                if (displayStyle === "slider") {
                  return (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-6"
                    >
                      <div className="relative">
                        <input
                          type="range"
                          aria-label={`${currentQuestion.title} slider`}
                          min={min}
                          max={max}
                          step={1}
                          value={(answers[currentQuestion.id] as number) || min}
                          onChange={(e) => updateAnswer(currentQuestion.id, Number(e.target.value))}
                          className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none
                            [&::-webkit-slider-thumb]:w-8
                            [&::-webkit-slider-thumb]:h-8
                            [&::-webkit-slider-thumb]:rounded-full
                            [&::-webkit-slider-thumb]:bg-[#FF4F01]
                            [&::-webkit-slider-thumb]:cursor-pointer
                            [&::-webkit-slider-thumb]:shadow-lg
                            [&::-webkit-slider-thumb]:border-4
                            [&::-webkit-slider-thumb]:border-white/20
                            [&::-moz-range-thumb]:w-8
                            [&::-moz-range-thumb]:h-8
                            [&::-moz-range-thumb]:rounded-full
                            [&::-moz-range-thumb]:bg-[#FF4F01]
                            [&::-moz-range-thumb]:cursor-pointer
                            [&::-moz-range-thumb]:border-4
                            [&::-moz-range-thumb]:border-white/20"
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 text-sm">{min}</span>
                        <span className="text-white text-4xl font-bold">
                          {answers[currentQuestion.id] !== undefined
                            ? String(answers[currentQuestion.id])
                            : min}
                        </span>
                        <span className="text-white/70 text-sm">{max}</span>
                      </div>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="flex justify-between text-white/70 text-sm px-1"
                      >
                        <span>{currentQuestion.settings?.minLabel || "Not at all"}</span>
                        <span>{currentQuestion.settings?.maxLabel || "Extremely"}</span>
                      </motion.div>
                    </motion.div>
                  );
                }

                if (displayStyle === "colored") {
                  return (
                    <div>
                      <motion.div
                        className="flex gap-2 flex-wrap justify-center"
                        variants={containerVariants}
                        initial="initial"
                        animate="animate"
                      >
                        {scaleValues.map((value) => {
                          const isSelected = answers[currentQuestion.id] === value;
                          const colorClass = getColorClass(value);
                          return (
                            <motion.button
                              key={value}
                              variants={itemVariants}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                updateAnswer(currentQuestion.id, value);
                                setTimeout(goNext, 400);
                              }}
                              className={`w-12 h-12 rounded-xl border-2 font-bold transition-all ${
                                isSelected
                                  ? colorClass
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
                        className="flex justify-between text-white/70 text-sm mt-4 px-1"
                      >
                        <span>{currentQuestion.settings?.minLabel || "Not at all"}</span>
                        <span>{currentQuestion.settings?.maxLabel || "Extremely"}</span>
                      </motion.div>
                    </div>
                  );
                }

                // Default numbers style
                return (
                  <div>
                    <motion.div
                      className="flex gap-2 flex-wrap"
                      variants={containerVariants}
                      initial="initial"
                      animate="animate"
                    >
                      {scaleValues.map((value) => {
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
                      className="flex justify-between text-white/70 text-sm mt-4 px-1"
                    >
                      <span>{currentQuestion.settings?.minLabel || "Not at all"}</span>
                      <span>{currentQuestion.settings?.maxLabel || "Extremely"}</span>
                    </motion.div>
                  </div>
                );
              })()}

              {/* Section Header - Display Only */}
              {currentQuestion.type === "SECTION_HEADER" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8"
                >
                  <div className="w-16 h-1 bg-[#FF4F01] mx-auto mb-8 rounded-full" />
                  <p className="text-white/70 text-sm mt-4">
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
                    className="flex justify-between text-white/70 text-sm mt-4 px-3"
                  >
                    <span>{(currentQuestion.settings as { scaleLabels?: Record<number, string> })?.scaleLabels?.[1] || "Low"}</span>
                    <span>{(currentQuestion.settings as { scaleLabels?: Record<number, string> })?.scaleLabels?.[5] || "High"}</span>
                  </motion.div>
                </motion.div>
              )}

              {/* Phone */}
              {currentQuestion.type === "PHONE" && (
                <div className="flex items-center gap-3">
                  <Phone className="w-6 h-6 text-white/40" />
                  <Input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="tel"
                    value={(answers[currentQuestion.id] as string) || ""}
                    onChange={(e) => updateAnswer(currentQuestion.id, e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="bg-transparent border-0 border-b-2 border-white/20 rounded-none text-white text-2xl placeholder:text-white/30 h-16 focus:border-[#FF4F01] focus:ring-0 px-0 flex-1"
                  />
                </div>
              )}

              {/* Time */}
              {currentQuestion.type === "TIME" && (
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-white/40" />
                  <Input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="time"
                    value={(answers[currentQuestion.id] as string) || ""}
                    onChange={(e) => updateAnswer(currentQuestion.id, e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-lg h-14 rounded-xl focus:border-[#FF4F01] focus:ring-[#FF4F01] w-48"
                  />
                </div>
              )}

              {/* Dropdown */}
              {currentQuestion.type === "DROPDOWN" && currentQuestion.options && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative"
                >
                  <select
                    aria-label={currentQuestion.title}
                    value={(answers[currentQuestion.id] as string) || ""}
                    onChange={(e) => {
                      updateAnswer(currentQuestion.id, e.target.value);
                      if (e.target.value) {
                        setTimeout(goNext, 400);
                      }
                    }}
                    className="w-full p-5 rounded-xl border-2 border-white/10 bg-white/5 text-white text-lg appearance-none cursor-pointer focus:border-[#FF4F01] focus:ring-0 focus:outline-none"
                  >
                    <option value="" className="bg-[#1a1a2e]">Select an option...</option>
                    {currentQuestion.options.map((option) => (
                      <option key={option} value={option} className="bg-[#1a1a2e]">
                        {option}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
                </motion.div>
              )}

              {/* Yes/No Toggle */}
              {currentQuestion.type === "YES_NO" && (
                <motion.div
                  className="flex gap-4"
                  variants={containerVariants}
                  initial="initial"
                  animate="animate"
                >
                  {["Yes", "No"].map((option) => {
                    const isSelected = answers[currentQuestion.id] === option;
                    return (
                      <motion.button
                        key={option}
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          updateAnswer(currentQuestion.id, option);
                          setTimeout(goNext, 400);
                        }}
                        className={`flex-1 p-6 rounded-xl border-2 text-xl font-bold transition-all ${
                          isSelected
                            ? option === "Yes"
                              ? "border-green-500 bg-green-500/20 text-green-400"
                              : "border-red-400 bg-red-500/20 text-red-400"
                            : "border-white/10 text-white/60 hover:border-white/30"
                        }`}
                      >
                        {option}
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}

              {/* NPS - Net Promoter Score (0-10) */}
              {currentQuestion.type === "NPS" && (
                <div>
                  <motion.div
                    className="flex gap-2 flex-wrap justify-center"
                    variants={containerVariants}
                    initial="initial"
                    animate="animate"
                  >
                    {Array.from({ length: 11 }, (_, i) => i).map((value) => {
                      const isSelected = answers[currentQuestion.id] === value;
                      let colorClass = "border-white/20 text-white/60";
                      if (isSelected) {
                        if (value <= 6) colorClass = "border-red-500 bg-red-500 text-white";
                        else if (value <= 8) colorClass = "border-yellow-500 bg-yellow-500 text-white";
                        else colorClass = "border-green-500 bg-green-500 text-white";
                      }
                      return (
                        <motion.button
                          key={value}
                          variants={itemVariants}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            updateAnswer(currentQuestion.id, value);
                            setTimeout(goNext, 400);
                          }}
                          className={`w-12 h-12 rounded-xl border-2 font-bold ${colorClass}`}
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
                    className="flex justify-between text-white/70 text-sm mt-4 px-1"
                  >
                    <span>{currentQuestion.settings?.minLabel || "Not at all likely"}</span>
                    <span>{currentQuestion.settings?.maxLabel || "Extremely likely"}</span>
                  </motion.div>
                </div>
              )}

              {/* Likert Scale */}
              {currentQuestion.type === "LIKERT" && (() => {
                const displayStyle = (currentQuestion.settings?.displayStyle as LikertDisplayStyle) || "text";
                const scale = currentQuestion.settings?.scale || [
                  "Strongly Disagree",
                  "Disagree",
                  "Neutral",
                  "Agree",
                  "Strongly Agree",
                ];

                // Emoji mapping for likert scale
                const emojiScale = ["😠", "😕", "😐", "🙂", "😄"];
                // Color mapping for colored style
                const colorScale = [
                  "bg-red-500/20 border-red-500 text-red-400",
                  "bg-orange-500/20 border-orange-500 text-orange-400",
                  "bg-yellow-500/20 border-yellow-500 text-yellow-400",
                  "bg-lime-500/20 border-lime-500 text-lime-400",
                  "bg-green-500/20 border-green-500 text-green-400",
                ];

                if (displayStyle === "emoji") {
                  return (
                    <motion.div
                      className="flex gap-4 flex-wrap justify-center"
                      variants={containerVariants}
                      initial="initial"
                      animate="animate"
                    >
                      {scale.map((option, idx) => {
                        const isSelected = answers[currentQuestion.id] === option;
                        return (
                          <motion.button
                            key={option}
                            variants={itemVariants}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              updateAnswer(currentQuestion.id, option);
                              setTimeout(goNext, 400);
                            }}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                              isSelected
                                ? "border-[#FF4F01] bg-[#FF4F01]/10"
                                : "border-white/10 bg-white/5"
                            }`}
                          >
                            <span className={`text-4xl transition-transform ${isSelected ? "scale-110" : ""}`}>
                              {emojiScale[idx] || "😐"}
                            </span>
                            <span className={`text-xs ${isSelected ? "text-white" : "text-white/60"}`}>
                              {option}
                            </span>
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  );
                }

                if (displayStyle === "colored") {
                  return (
                    <motion.div
                      className="flex gap-2 flex-wrap justify-center"
                      variants={containerVariants}
                      initial="initial"
                      animate="animate"
                    >
                      {scale.map((option, idx) => {
                        const isSelected = answers[currentQuestion.id] === option;
                        const colorClass = colorScale[idx] || colorScale[2];
                        return (
                          <motion.button
                            key={option}
                            variants={itemVariants}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              updateAnswer(currentQuestion.id, option);
                              setTimeout(goNext, 400);
                            }}
                            className={`px-6 py-4 rounded-xl border-2 transition-all ${
                              isSelected
                                ? colorClass
                                : "border-white/10 bg-white/5 text-white/70"
                            }`}
                          >
                            <span className="text-sm font-medium">{option}</span>
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  );
                }

                // Default text style
                return (
                  <motion.div
                    className="space-y-3"
                    variants={containerVariants}
                    initial="initial"
                    animate="animate"
                  >
                    {scale.map((option, idx) => {
                      const isSelected = answers[currentQuestion.id] === option;
                      return (
                        <motion.button
                          key={option}
                          variants={itemVariants}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            updateAnswer(currentQuestion.id, option);
                            setTimeout(goNext, 400);
                          }}
                          className={`w-full p-5 rounded-xl border-2 text-left flex items-center gap-4 group ${
                            isSelected
                              ? "border-[#FF4F01] bg-[#FF4F01]/10"
                              : "border-white/10"
                          }`}
                        >
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                              isSelected
                                ? "bg-[#FF4F01] text-white"
                                : "bg-white/10 text-white/60"
                            }`}
                          >
                            {isSelected ? <Check className="w-4 h-4" /> : idx + 1}
                          </span>
                          <span className={`text-lg ${isSelected ? "text-white" : "text-white/80"}`}>
                            {option}
                          </span>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                );
              })()}

              {/* Slider */}
              {currentQuestion.type === "SLIDER" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  <div className="relative">
                    <input
                      type="range"
                      aria-label={`${currentQuestion.title} slider, current value ${(answers[currentQuestion.id] as number) ?? currentQuestion.settings?.min ?? 0}`}
                      min={currentQuestion.settings?.min || 0}
                      max={currentQuestion.settings?.max || 100}
                      step={currentQuestion.settings?.step || 1}
                      value={(answers[currentQuestion.id] as number) || currentQuestion.settings?.min || 0}
                      onChange={(e) => updateAnswer(currentQuestion.id, Number(e.target.value))}
                      className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-8
                        [&::-webkit-slider-thumb]:h-8
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-[#FF4F01]
                        [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-webkit-slider-thumb]:shadow-lg
                        [&::-webkit-slider-thumb]:border-4
                        [&::-webkit-slider-thumb]:border-white/20
                        [&::-moz-range-thumb]:w-8
                        [&::-moz-range-thumb]:h-8
                        [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:bg-[#FF4F01]
                        [&::-moz-range-thumb]:cursor-pointer
                        [&::-moz-range-thumb]:border-4
                        [&::-moz-range-thumb]:border-white/20"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/70 text-sm">{currentQuestion.settings?.min || 0}</span>
                    <span className="text-white text-4xl font-bold">
                      {answers[currentQuestion.id] !== undefined
                        ? String(answers[currentQuestion.id])
                        : currentQuestion.settings?.min || 0}
                    </span>
                    <span className="text-white/70 text-sm">{currentQuestion.settings?.max || 100}</span>
                  </div>
                </motion.div>
              )}

              {/* Ranking - Drag to reorder */}
              {currentQuestion.type === "RANKING" && currentQuestion.options && (
                <motion.div
                  variants={containerVariants}
                  initial="initial"
                  animate="animate"
                  className="space-y-3"
                >
                  <p className="text-white/70 text-sm mb-4">Click items in order of preference (1st = most preferred)</p>
                  {(() => {
                    const rankedItems = (answers[currentQuestion.id] as string[]) || [];
                    const unrankedItems = currentQuestion.options!.filter(
                      (item) => !rankedItems.includes(item)
                    );

                    return (
                      <>
                        {/* Ranked items */}
                        {rankedItems.map((item, idx) => (
                          <motion.div
                            key={`ranked-${item}`}
                            variants={itemVariants}
                            className="flex items-center gap-3 p-4 rounded-xl border-2 border-[#FF4F01] bg-[#FF4F01]/10"
                          >
                            <span className="w-8 h-8 rounded-full bg-[#FF4F01] text-white flex items-center justify-center font-bold text-sm">
                              {idx + 1}
                            </span>
                            <span className="text-white flex-1">{item}</span>
                            <button
                              onClick={() => {
                                const newRanked = rankedItems.filter((i) => i !== item);
                                updateAnswer(currentQuestion.id, newRanked);
                              }}
                              aria-label={`Remove ${item} from ranking`}
                              className="text-white/70 hover:text-white transition-colors"
                            >
                              ✕
                            </button>
                          </motion.div>
                        ))}

                        {/* Unranked items */}
                        {unrankedItems.map((item) => (
                          <motion.button
                            key={`unranked-${item}`}
                            variants={itemVariants}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              const newRanked = [...rankedItems, item];
                              updateAnswer(currentQuestion.id, newRanked);
                            }}
                            className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-white/10 hover:border-white/30 transition-colors"
                          >
                            <GripVertical className="w-5 h-5 text-white/40" />
                            <span className="text-white/80">{item}</span>
                          </motion.button>
                        ))}
                      </>
                    );
                  })()}
                </motion.div>
              )}

              {/* Constant Sum - Distribute points */}
              {currentQuestion.type === "CONSTANT_SUM" && currentQuestion.options && (
                <motion.div
                  variants={containerVariants}
                  initial="initial"
                  animate="animate"
                  className="space-y-4"
                >
                  {(() => {
                    const total = currentQuestion.settings?.total || 100;
                    const values = (answers[currentQuestion.id] as Record<string, number>) || {};
                    const currentSum = Object.values(values).reduce((a, b) => a + b, 0);
                    const remaining = total - currentSum;

                    return (
                      <>
                        <div className="flex justify-between items-center mb-6">
                          <span className="text-white/60 text-sm">Distribute {total} points</span>
                          <span className={`text-lg font-bold ${remaining === 0 ? "text-green-400" : remaining < 0 ? "text-red-400" : "text-white"}`}>
                            {remaining} remaining
                          </span>
                        </div>

                        {currentQuestion.options!.map((item) => (
                          <motion.div
                            key={item}
                            variants={itemVariants}
                            className="flex items-center gap-4 p-4 rounded-xl border-2 border-white/10 bg-white/5"
                          >
                            <span className="text-white flex-1 min-w-[120px]">{item}</span>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => {
                                  const current = values[item] || 0;
                                  if (current > 0) {
                                    updateAnswer(currentQuestion.id, {
                                      ...values,
                                      [item]: current - 1,
                                    });
                                  }
                                }}
                                className="w-10 h-10 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 transition-colors flex items-center justify-center text-xl"
                              >
                                −
                              </button>
                              <Input
                                type="number"
                                min={0}
                                max={total}
                                value={values[item] || 0}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  updateAnswer(currentQuestion.id, {
                                    ...values,
                                    [item]: val,
                                  });
                                }}
                                className="w-20 text-center bg-white/5 border-white/10 text-white text-lg h-10 rounded-lg"
                              />
                              <button
                                onClick={() => {
                                  const current = values[item] || 0;
                                  if (currentSum < total) {
                                    updateAnswer(currentQuestion.id, {
                                      ...values,
                                      [item]: current + 1,
                                    });
                                  }
                                }}
                                className="w-10 h-10 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 transition-colors flex items-center justify-center text-xl"
                              >
                                +
                              </button>
                            </div>
                          </motion.div>
                        ))}

                        {/* Progress bar */}
                        <div className="mt-4">
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${remaining === 0 ? "bg-green-500" : remaining < 0 ? "bg-red-500" : "bg-[#FF4F01]"}`}
                              style={{ width: `${Math.min(100, (currentSum / total) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </motion.div>
              )}

              {/* Image Choice */}
              {currentQuestion.type === "IMAGE_CHOICE" && currentQuestion.options && (
                <motion.div
                  className="grid grid-cols-2 gap-4"
                  variants={containerVariants}
                  initial="initial"
                  animate="animate"
                >
                  {currentQuestion.options.map((option) => {
                    const isSelected = answers[currentQuestion.id] === option;
                    const imageUrl = currentQuestion.settings?.imageUrls?.[option];
                    return (
                      <motion.button
                        key={option}
                        variants={itemVariants}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          updateAnswer(currentQuestion.id, option);
                          setTimeout(goNext, 400);
                        }}
                        className={`relative overflow-hidden rounded-xl border-2 aspect-square ${
                          isSelected
                            ? "border-[#FF4F01] ring-2 ring-[#FF4F01]"
                            : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={option}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
                            <span className="text-white/70 text-sm">No image</span>
                          </div>
                        )}
                        <div className={`absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent ${
                          isSelected ? "bg-[#FF4F01]/80" : ""
                        }`}>
                          <span className="text-white text-sm font-medium">{option}</span>
                        </div>
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[#FF4F01] flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}

              {/* URL Input */}
              {currentQuestion.type === "URL" && (
                <motion.div variants={itemVariants} className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                  <Input
                    type="url"
                    placeholder="https://example.com"
                    value={(answers[currentQuestion.id] as string) || ""}
                    onChange={(e) => updateAnswer(currentQuestion.id, e.target.value)}
                    className="bg-white/10 border-white/10 text-white placeholder:text-white/50 text-lg py-6 pl-12 rounded-xl focus:border-[#FF4F01] focus:ring-[#FF4F01]"
                  />
                </motion.div>
              )}

              {/* Address Input */}
              {currentQuestion.type === "ADDRESS" && (
                <motion.div variants={containerVariants} className="space-y-4">
                  <motion.div variants={itemVariants} className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                    <Input
                      placeholder="Street address"
                      value={((answers[currentQuestion.id] as Record<string, string>) || {}).street || ""}
                      onChange={(e) => updateAnswer(currentQuestion.id, {
                        ...((answers[currentQuestion.id] as Record<string, string>) || {}),
                        street: e.target.value,
                      })}
                      className="bg-white/10 border-white/10 text-white placeholder:text-white/50 text-lg py-6 pl-12 rounded-xl focus:border-[#FF4F01] focus:ring-[#FF4F01]"
                    />
                  </motion.div>
                  <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
                    <Input
                      placeholder="City"
                      value={((answers[currentQuestion.id] as Record<string, string>) || {}).city || ""}
                      onChange={(e) => updateAnswer(currentQuestion.id, {
                        ...((answers[currentQuestion.id] as Record<string, string>) || {}),
                        city: e.target.value,
                      })}
                      className="bg-white/10 border-white/10 text-white placeholder:text-white/50 text-lg py-6 rounded-xl focus:border-[#FF4F01] focus:ring-[#FF4F01]"
                    />
                    <Input
                      placeholder="State/Province"
                      value={((answers[currentQuestion.id] as Record<string, string>) || {}).state || ""}
                      onChange={(e) => updateAnswer(currentQuestion.id, {
                        ...((answers[currentQuestion.id] as Record<string, string>) || {}),
                        state: e.target.value,
                      })}
                      className="bg-white/10 border-white/10 text-white placeholder:text-white/50 text-lg py-6 rounded-xl focus:border-[#FF4F01] focus:ring-[#FF4F01]"
                    />
                  </motion.div>
                  <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
                    <Input
                      placeholder="ZIP / Postal code"
                      value={((answers[currentQuestion.id] as Record<string, string>) || {}).zip || ""}
                      onChange={(e) => updateAnswer(currentQuestion.id, {
                        ...((answers[currentQuestion.id] as Record<string, string>) || {}),
                        zip: e.target.value,
                      })}
                      className="bg-white/10 border-white/10 text-white placeholder:text-white/50 text-lg py-6 rounded-xl focus:border-[#FF4F01] focus:ring-[#FF4F01]"
                    />
                    {currentQuestion.settings?.includeCountry !== false && (
                      <Input
                        placeholder="Country"
                        value={((answers[currentQuestion.id] as Record<string, string>) || {}).country || ""}
                        onChange={(e) => updateAnswer(currentQuestion.id, {
                          ...((answers[currentQuestion.id] as Record<string, string>) || {}),
                          country: e.target.value,
                        })}
                        className="bg-white/10 border-white/10 text-white placeholder:text-white/50 text-lg py-6 rounded-xl focus:border-[#FF4F01] focus:ring-[#FF4F01]"
                      />
                    )}
                  </motion.div>
                </motion.div>
              )}

              {/* File Upload */}
              {currentQuestion.type === "FILE_UPLOAD" && (
                <motion.div variants={itemVariants}>
                  <label className="block">
                    <div className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                      uploading
                        ? "border-[#FF4F01] bg-[#FF4F01]/10"
                        : "border-white/20 hover:border-[#FF4F01] hover:bg-white/5"
                    }`}>
                      {uploading ? (
                        <>
                          <Loader2 className="w-12 h-12 text-[#FF4F01] mx-auto mb-4 animate-spin" />
                          <p className="text-white/70 mb-2">Uploading...</p>
                        </>
                      ) : (answers[currentQuestion.id] as { url?: string; filename?: string })?.url ? (
                        <>
                          <Check className="w-12 h-12 text-green-400 mx-auto mb-4" />
                          <p className="text-white mb-2">File uploaded successfully!</p>
                          <p className="text-white/70 text-sm">
                            {(answers[currentQuestion.id] as { filename?: string })?.filename}
                          </p>
                          <p className="text-[#FF4F01] text-sm mt-2">Click to replace</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-12 h-12 text-white/50 mx-auto mb-4" />
                          <p className="text-white/70 mb-2">Click to upload or drag and drop</p>
                          <p className="text-white/50 text-sm">
                            {currentQuestion.settings?.allowedTypes?.join(", ") || "Any file type"}
                            {currentQuestion.settings?.maxSizeMB && ` • Max ${currentQuestion.settings.maxSizeMB}MB`}
                          </p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      accept={currentQuestion.settings?.allowedTypes?.join(",")}
                      disabled={uploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        // Check file size
                        const maxSizeMB = currentQuestion.settings?.maxSizeMB || 10;
                        if (file.size > maxSizeMB * 1024 * 1024) {
                          setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
                          return;
                        }

                        setUploading(true);
                        setError(null);

                        try {
                          const formData = new FormData();
                          formData.append("file", file);
                          formData.append("surveyId", survey?.id || "");

                          const response = await fetch("/api/upload", {
                            method: "POST",
                            body: formData,
                          });

                          if (!response.ok) {
                            const data = await response.json();
                            throw new Error(data.error || "Upload failed");
                          }

                          const data = await response.json();
                          updateAnswer(currentQuestion.id, {
                            url: data.url,
                            filename: data.filename,
                            size: data.size,
                            type: data.type,
                          });
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Failed to upload file");
                        } finally {
                          setUploading(false);
                        }
                      }}
                      className="sr-only"
                    />
                  </label>
                </motion.div>
              )}

              {/* Signature */}
              {currentQuestion.type === "SIGNATURE" && (
                <motion.div variants={itemVariants}>
                  <div className="bg-white rounded-xl p-6">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg h-40 flex items-center justify-center">
                      {(answers[currentQuestion.id] as string) ? (
                        <div className="text-center">
                          <PenLine className="w-8 h-8 text-[#FF4F01] mx-auto mb-2" />
                          <p className="text-gray-600 text-sm">Signature captured</p>
                          <button
                            onClick={() => updateAnswer(currentQuestion.id, "")}
                            className="text-[#FF4F01] text-sm mt-2 hover:underline"
                          >
                            Clear signature
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => updateAnswer(currentQuestion.id, "signed-" + Date.now())}
                          className="text-center"
                        >
                          <PenLine className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-500">Click to sign</p>
                        </button>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs text-center mt-3">
                      By signing, you agree to the terms and conditions
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Hidden field - not rendered to respondent but included in data */}
              {currentQuestion.type === "HIDDEN" && (
                <motion.div variants={itemVariants} className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                  <EyeOff className="w-8 h-8 text-white/30 mx-auto mb-2" />
                  <p className="text-white/50 text-sm">This is a hidden tracking field</p>
                </motion.div>
              )}

              {/* Welcome Screen */}
              {currentQuestion.type === "WELCOME_SCREEN" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8"
                >
                  <div className="w-20 h-20 rounded-2xl bg-[#FF4F01] flex items-center justify-center mx-auto mb-8">
                    <Play className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-white/70 text-lg mb-8">
                    {currentQuestion.description || "Welcome! Click below to begin."}
                  </p>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={goNext}
                      size="lg"
                      className="bg-[#FF4F01] hover:bg-[#e54600] text-white px-10 py-6 text-lg rounded-xl group"
                    >
                      {currentQuestion.settings?.buttonText || "Start Survey"}
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </motion.div>
                </motion.div>
              )}

              {/* End Screen */}
              {currentQuestion.type === "END_SCREEN" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8"
                >
                  <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-8">
                    <PartyPopper className="w-10 h-10 text-green-400" />
                  </div>
                  <p className="text-white/70 text-lg mb-8">
                    {currentQuestion.description || "Thank you for completing this survey!"}
                  </p>
                  {currentQuestion.settings?.redirectUrl && (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <a
                        href={currentQuestion.settings.redirectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-[#FF4F01] hover:bg-[#e54600] text-white px-8 py-4 rounded-xl text-lg font-medium"
                      >
                        {currentQuestion.settings?.buttonText || "Continue"}
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Statement - Display Only Info */}
              {currentQuestion.type === "STATEMENT" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-8"
                >
                  <div className="bg-white/5 border border-white/10 rounded-xl p-8">
                    <FileText className="w-10 h-10 text-[#FF4F01] mb-6" />
                    <div className="prose prose-invert max-w-none">
                      <p className="text-white/80 text-lg leading-relaxed">
                        {currentQuestion.description || "This is an informational statement."}
                      </p>
                    </div>
                  </div>
                  <p className="text-white/50 text-sm text-center mt-6">
                    Press Enter or click OK to continue
                  </p>
                </motion.div>
              )}

              {/* Legal / Consent */}
              {currentQuestion.type === "LEGAL" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-4"
                >
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
                    <ShieldCheck className="w-8 h-8 text-[#FF4F01] mb-4" />
                    <p className="text-white/80 text-base leading-relaxed mb-4">
                      {currentQuestion.description || "Please review and accept the terms below."}
                    </p>
                    {currentQuestion.settings?.linkUrl && (
                      <a
                        href={currentQuestion.settings.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[#FF4F01] hover:underline text-sm"
                      >
                        {currentQuestion.settings?.linkText || "View Terms"}
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      const current = answers[currentQuestion.id] as boolean;
                      updateAnswer(currentQuestion.id, !current);
                    }}
                    className={`w-full p-5 rounded-xl border-2 text-left flex items-center gap-4 transition-all ${
                      answers[currentQuestion.id] === true
                        ? "border-green-500 bg-green-500/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                        answers[currentQuestion.id] === true
                          ? "border-green-500 bg-green-500"
                          : "border-white/30"
                      }`}
                    >
                      {answers[currentQuestion.id] === true && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <span className="text-white/80">
                      {currentQuestion.settings?.consentText || "I agree to the Terms and Conditions"}
                    </span>
                  </motion.button>
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
          <p className="text-white/60 text-xs">
            Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70">Enter ↵</kbd>
          </p>
        </div>
      </footer>
    </div>
  );
}
