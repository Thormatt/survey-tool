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

interface Question {
  id: string;
  type: string;
  title: string;
  description?: string;
  required: boolean;
  options?: string[];
  settings?: Record<string, unknown>;
}

interface Survey {
  id: string;
  title: string;
  description?: string;
  published: boolean;
  accessType: "PUBLIC" | "UNLISTED" | "INVITE_ONLY";
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

  const totalSteps = survey ? survey.questions.length + (survey.isAnonymous ? 0 : 1) : 0;
  const currentStep = survey?.isAnonymous ? currentIndex + 1 : currentIndex + 2;
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
      if (!currentQuestion.required) return true;
      const answer = answers[currentQuestion.id];
      if (answer === undefined || answer === "" || (Array.isArray(answer) && answer.length === 0)) {
        return false;
      }
    }

    return true;
  }, [survey, currentIndex, currentQuestion, answers, respondentInfo]);

  const goNext = useCallback(() => {
    if (!survey || isAnimating || !canProceed()) return;

    setIsAnimating(true);
    setDirection("forward");

    setTimeout(() => {
      if (currentIndex === -1) {
        // From welcome to either info screen or first question
        setCurrentIndex(survey.isAnonymous ? 0 : -2);
      } else if (!survey.isAnonymous && currentIndex === -2) {
        // From info screen to first question
        setCurrentIndex(0);
      } else if (currentIndex < survey.questions.length - 1) {
        // Next question
        setCurrentIndex(currentIndex + 1);
      } else {
        // Submit
        handleSubmit();
      }
      setIsAnimating(false);
    }, 300);
  }, [survey, currentIndex, isAnimating, canProceed]);

  const goBack = useCallback(() => {
    if (!survey || isAnimating || currentIndex === -1) return;

    setIsAnimating(true);
    setDirection("backward");

    setTimeout(() => {
      if (currentIndex === 0) {
        setCurrentIndex(survey.isAnonymous ? -1 : -2);
      } else if (!survey.isAnonymous && currentIndex === -2) {
        setCurrentIndex(-1);
      } else {
        setCurrentIndex(currentIndex - 1);
      }
      setIsAnimating(false);
    }, 300);
  }, [survey, currentIndex, isAnimating]);

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

    // Validate all required questions
    for (const question of survey.questions) {
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
        <div className="max-w-md w-full text-center animate-fade-in-up">
          <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
          </div>
          <h2 className="font-['Syne'] text-4xl font-bold text-white mb-4">Thank you!</h2>
          <p className="text-white/60 text-lg">
            Your response has been recorded. We appreciate you taking the time to complete this survey.
          </p>
        </div>
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
        <div
          className={`w-full max-w-2xl transition-all duration-300 ${
            isAnimating
              ? direction === "forward"
                ? "opacity-0 translate-x-8"
                : "opacity-0 -translate-x-8"
              : "opacity-100 translate-x-0"
          }`}
        >
          {/* Welcome Screen */}
          {currentIndex === -1 && (
            <div className="text-center">
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
              <Button
                onClick={goNext}
                size="lg"
                className="bg-[#FF4F01] hover:bg-[#e54600] text-white px-10 py-6 text-lg rounded-xl group"
              >
                Start Survey
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          )}

          {/* Respondent Info Screen */}
          {!survey.isAnonymous && currentIndex === -2 && (
            <div>
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
            </div>
          )}

          {/* Question Screens */}
          {currentQuestion && (
            <div>
              <p className="text-[#FF4F01] text-sm font-medium mb-4">
                Question {currentIndex + 1}
                {currentQuestion.required && <span className="text-white/40 ml-2">Required</span>}
              </p>
              <h2 className="font-['Syne'] text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
                {currentQuestion.title}
              </h2>
              {currentQuestion.description && (
                <p className="text-white/50 mb-10">{currentQuestion.description}</p>
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
                <div className="space-y-3">
                  {currentQuestion.options.map((option, idx) => {
                    const isSelected = answers[currentQuestion.id] === option;
                    return (
                      <button
                        key={option}
                        onClick={() => {
                          updateAnswer(currentQuestion.id, option);
                          // Auto-advance after selection
                          setTimeout(goNext, 400);
                        }}
                        className={`w-full p-5 rounded-xl border-2 text-left transition-all duration-200 flex items-center gap-4 group ${
                          isSelected
                            ? "border-[#FF4F01] bg-[#FF4F01]/10"
                            : "border-white/10 hover:border-white/30 hover:bg-white/5"
                        }`}
                      >
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
                          isSelected
                            ? "bg-[#FF4F01] text-white"
                            : "bg-white/10 text-white/60 group-hover:bg-white/20"
                        }`}>
                          {isSelected ? <Check className="w-4 h-4" /> : String.fromCharCode(65 + idx)}
                        </span>
                        <span className={`text-lg ${isSelected ? "text-white" : "text-white/80"}`}>
                          {option}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Multiple Choice */}
              {currentQuestion.type === "MULTIPLE_CHOICE" && currentQuestion.options && (
                <div className="space-y-3">
                  {currentQuestion.options.map((option, idx) => {
                    const isSelected = ((answers[currentQuestion.id] as string[]) || []).includes(option);
                    return (
                      <button
                        key={option}
                        onClick={() => handleMultipleChoice(currentQuestion.id, option, !isSelected)}
                        className={`w-full p-5 rounded-xl border-2 text-left transition-all duration-200 flex items-center gap-4 group ${
                          isSelected
                            ? "border-[#FF4F01] bg-[#FF4F01]/10"
                            : "border-white/10 hover:border-white/30 hover:bg-white/5"
                        }`}
                      >
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
                          isSelected
                            ? "bg-[#FF4F01] text-white"
                            : "bg-white/10 text-white/60 group-hover:bg-white/20"
                        }`}>
                          {isSelected ? <Check className="w-4 h-4" /> : String.fromCharCode(65 + idx)}
                        </span>
                        <span className={`text-lg ${isSelected ? "text-white" : "text-white/80"}`}>
                          {option}
                        </span>
                      </button>
                    );
                  })}
                  <p className="text-white/40 text-sm mt-4">Select all that apply</p>
                </div>
              )}

              {/* Rating */}
              {currentQuestion.type === "RATING" && (
                <div className="flex gap-3 flex-wrap">
                  {[1, 2, 3, 4, 5].map((rating) => {
                    const isSelected = answers[currentQuestion.id] === rating;
                    return (
                      <button
                        key={rating}
                        onClick={() => {
                          updateAnswer(currentQuestion.id, rating);
                          setTimeout(goNext, 400);
                        }}
                        className={`w-16 h-16 rounded-xl border-2 font-bold text-xl transition-all duration-200 ${
                          isSelected
                            ? "border-[#FF4F01] bg-[#FF4F01] text-white scale-110"
                            : "border-white/20 text-white/60 hover:border-white/40 hover:scale-105"
                        }`}
                      >
                        {rating}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Scale */}
              {currentQuestion.type === "SCALE" && (
                <div>
                  <div className="flex gap-2 flex-wrap">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => {
                      const isSelected = answers[currentQuestion.id] === value;
                      return (
                        <button
                          key={value}
                          onClick={() => {
                            updateAnswer(currentQuestion.id, value);
                            setTimeout(goNext, 400);
                          }}
                          className={`w-12 h-12 rounded-xl border-2 font-bold transition-all duration-200 ${
                            isSelected
                              ? "border-[#FF4F01] bg-[#FF4F01] text-white scale-110"
                              : "border-white/20 text-white/60 hover:border-white/40 hover:scale-105"
                          }`}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-white/40 text-sm mt-4 px-1">
                    <span>Not at all</span>
                    <span>Extremely</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>
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
