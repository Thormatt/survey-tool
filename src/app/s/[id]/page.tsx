"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Loader2, AlertCircle, Lock, Mail } from "lucide-react";

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

export default function SurveyResponsePage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<{ type: string; message: string } | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [respondentInfo, setRespondentInfo] = useState({ email: "", name: "" });

  useEffect(() => {
    async function fetchSurvey() {
      try {
        // For invite-only, pass user email for verification
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
            // Check if it's an invite-only access issue
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

    // Wait for user to be loaded before fetching (for invite-only verification)
    if (params.id && userLoaded) {
      fetchSurvey();
    }
  }, [params.id, userLoaded, user]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey) return;

    // Validate required questions
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
      // For INVITE_ONLY surveys, always include the authenticated user's email
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

      setSubmitted(true);
    } catch {
      setError("Failed to submit your response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !userLoaded) {
    return (
      <div className="min-h-screen bg-[#fbf5ea] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#6b6b7b]" />
      </div>
    );
  }

  // Handle invite-only access errors
  if (accessError) {
    return (
      <div className="min-h-screen bg-[#fbf5ea] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            {accessError.type === "needs_signin" ? (
              <>
                <div className="w-16 h-16 rounded-full bg-[#dcd6f6] flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-[#1a1a2e]" />
                </div>
                <h2 className="font-['Syne'] text-xl font-semibold mb-2">Sign in Required</h2>
                <p className="text-[#6b6b7b] mb-6">
                  This survey requires you to sign in to verify your email address.
                </p>
                <SignInButton mode="modal" forceRedirectUrl={`/s/${params.id}`}>
                  <Button size="lg" className="w-full">
                    <Mail className="w-4 h-4 mr-2" />
                    Sign in with Google
                  </Button>
                </SignInButton>
              </>
            ) : accessError.type === "not_invited" ? (
              <>
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="font-['Syne'] text-xl font-semibold mb-2">Access Denied</h2>
                <p className="text-[#6b6b7b] mb-2">
                  Your email address is not on the invite list for this survey.
                </p>
                {user?.primaryEmailAddress?.emailAddress && (
                  <p className="text-sm text-[#6b6b7b] mb-4">
                    Signed in as: <strong>{user.primaryEmailAddress.emailAddress}</strong>
                  </p>
                )}
                <p className="text-sm text-[#6b6b7b]">
                  If you believe this is an error, please contact the survey creator.
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-[#dcd6f6] flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-[#1a1a2e]" />
                </div>
                <h2 className="font-['Syne'] text-xl font-semibold mb-2">Invitation Required</h2>
                <p className="text-[#6b6b7b]">
                  {accessError.message}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className="min-h-screen bg-[#fbf5ea] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="font-['Syne'] text-xl font-semibold mb-2">{error}</h2>
            <p className="text-[#6b6b7b]">
              The survey you're looking for may have been closed or doesn't exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#fbf5ea] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="font-['Syne'] text-2xl font-semibold mb-2">Thank you!</h2>
            <p className="text-[#6b6b7b]">
              Your response has been recorded. We appreciate you taking the time to complete this survey.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!survey) return null;

  return (
    <div className="min-h-screen bg-[#fbf5ea] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Survey Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#FF4F01] flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
            </div>
            <CardTitle className="font-['Syne'] text-2xl">{survey.title}</CardTitle>
            {survey.description && (
              <CardDescription className="text-base">{survey.description}</CardDescription>
            )}
          </CardHeader>
        </Card>

        <form onSubmit={handleSubmit}>
          {/* Respondent Info (if not anonymous) */}
          {!survey.isAnonymous && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Your Information</CardTitle>
                <CardDescription>This survey collects your identity for follow-up purposes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="respondent-email">Email *</Label>
                  <Input
                    id="respondent-email"
                    type="email"
                    required
                    value={respondentInfo.email}
                    onChange={(e) => setRespondentInfo((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="your@email.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="respondent-name">Name</Label>
                  <Input
                    id="respondent-name"
                    value={respondentInfo.name}
                    onChange={(e) => setRespondentInfo((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Your name (optional)"
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Questions */}
          {survey.questions.map((question, index) => (
            <Card key={question.id} className="mb-4">
              <CardContent className="pt-6">
                <div className="mb-4">
                  <Label className="text-base font-medium">
                    {index + 1}. {question.title}
                    {question.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  {question.description && (
                    <p className="text-sm text-[#6b6b7b] mt-1">{question.description}</p>
                  )}
                </div>

                {/* Short Text */}
                {question.type === "SHORT_TEXT" && (
                  <Input
                    value={(answers[question.id] as string) || ""}
                    onChange={(e) => updateAnswer(question.id, e.target.value)}
                    placeholder="Your answer"
                  />
                )}

                {/* Long Text */}
                {question.type === "LONG_TEXT" && (
                  <Textarea
                    value={(answers[question.id] as string) || ""}
                    onChange={(e) => updateAnswer(question.id, e.target.value)}
                    placeholder="Your answer"
                    rows={4}
                  />
                )}

                {/* Email */}
                {question.type === "EMAIL" && (
                  <Input
                    type="email"
                    value={(answers[question.id] as string) || ""}
                    onChange={(e) => updateAnswer(question.id, e.target.value)}
                    placeholder="your@email.com"
                  />
                )}

                {/* Number */}
                {question.type === "NUMBER" && (
                  <Input
                    type="number"
                    value={(answers[question.id] as string) || ""}
                    onChange={(e) => updateAnswer(question.id, e.target.value)}
                    placeholder="Enter a number"
                  />
                )}

                {/* Date */}
                {question.type === "DATE" && (
                  <Input
                    type="date"
                    value={(answers[question.id] as string) || ""}
                    onChange={(e) => updateAnswer(question.id, e.target.value)}
                  />
                )}

                {/* Single Choice */}
                {question.type === "SINGLE_CHOICE" && question.options && (
                  <RadioGroup
                    value={(answers[question.id] as string) || ""}
                    onValueChange={(value) => updateAnswer(question.id, value)}
                  >
                    {question.options.map((option) => (
                      <div key={option} className="flex items-center space-x-2 py-2">
                        <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                        <Label htmlFor={`${question.id}-${option}`} className="font-normal cursor-pointer">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {/* Multiple Choice */}
                {question.type === "MULTIPLE_CHOICE" && question.options && (
                  <div className="space-y-2">
                    {question.options.map((option) => (
                      <div key={option} className="flex items-center space-x-2 py-2">
                        <Checkbox
                          id={`${question.id}-${option}`}
                          checked={((answers[question.id] as string[]) || []).includes(option)}
                          onCheckedChange={(checked) =>
                            handleMultipleChoice(question.id, option, checked as boolean)
                          }
                        />
                        <Label htmlFor={`${question.id}-${option}`} className="font-normal cursor-pointer">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}

                {/* Rating */}
                {question.type === "RATING" && (
                  <div className="flex gap-2 flex-wrap">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => updateAnswer(question.id, rating)}
                        className={`w-12 h-12 rounded-lg border-2 font-semibold transition-all ${
                          answers[question.id] === rating
                            ? "border-[#FF4F01] bg-[#FF4F01] text-white"
                            : "border-[#dcd6f6] hover:border-[#c9c1ed]"
                        }`}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                )}

                {/* Scale */}
                {question.type === "SCALE" && (
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateAnswer(question.id, value)}
                        className={`w-10 h-10 rounded-lg border-2 font-medium text-sm transition-all ${
                          answers[question.id] === value
                            ? "border-[#FF4F01] bg-[#FF4F01] text-white"
                            : "border-[#dcd6f6] hover:border-[#c9c1ed]"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Response"
            )}
          </Button>

          <p className="text-center text-xs text-[#6b6b7b] mt-4">
            {survey.isAnonymous
              ? "Your response is anonymous"
              : "Your identity will be recorded with this response"}
          </p>
        </form>
      </div>
    </div>
  );
}
