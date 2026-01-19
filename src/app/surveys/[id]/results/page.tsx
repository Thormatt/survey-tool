"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Download,
  Loader2,
  Users,
  MessageSquare,
  Calendar,
  Share2,
  Mail,
  FileText,
  Copy,
  Check,
  TrendingUp,
  BarChart3,
  Radio,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useRealtimeResults } from "@/hooks/useRealtimeResults";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  AreaChart,
  Area,
} from "recharts";

interface Answer {
  id: string;
  questionId: string;
  value: unknown;
  response: {
    completedAt: string;
    respondentEmail?: string;
    respondentName?: string;
  };
}

interface Question {
  id: string;
  type: string;
  title: string;
  description?: string;
  required: boolean;
  options?: string[];
  settings?: {
    scaleMin?: number;
    scaleMax?: number;
    scaleLabels?: Record<string, string>;
    minLabel?: string;
    maxLabel?: string;
    min?: number;
    max?: number;
    step?: number;
    scale?: string[];
    total?: number;
    imageUrls?: Record<string, string>;
  };
  answers: Answer[];
}

interface Survey {
  id: string;
  title: string;
  description?: string;
  published: boolean;
  isAnonymous: boolean;
  createdAt: string;
  questions: Question[];
  _count: {
    responses: number;
  };
}

// Beautiful color palette
const COLORS = [
  "#FF4F01", // Brand orange
  "#1a1a2e", // Dark navy
  "#c9c1ed", // Light purple
  "#dcd6f6", // Lighter purple
  "#6b6b7b", // Gray
  "#FF7A33", // Light orange
  "#2d2d44", // Medium navy
  "#a99de0", // Medium purple
];

const GRADIENT_COLORS = {
  primary: ["#FF4F01", "#FF7A33"],
  secondary: ["#1a1a2e", "#2d2d44"],
  purple: ["#c9c1ed", "#dcd6f6"],
};

// Animation variants for staggered entry
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 20,
    },
  },
  hover: {
    y: -5,
    scale: 1.02,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
    },
  },
};

const statsCardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
      delay: i * 0.1,
    },
  }),
  hover: {
    y: -8,
    scale: 1.05,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 20,
    },
  },
};

const pageVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: "easeOut" as const,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2,
    },
  },
};

export default function SurveyResultsPage() {
  const params = useParams();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [newResponsesCount, setNewResponsesCount] = useState(0);
  const [showNewResponsesNotification, setShowNewResponsesNotification] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Real-time updates handler
  const handleRealtimeUpdate = useCallback((updatedSurvey: unknown, newResponses: number) => {
    setSurvey(updatedSurvey as Survey);
    if (newResponses > 0) {
      setNewResponsesCount((prev) => prev + newResponses);
      setShowNewResponsesNotification(true);
      // Auto-hide notification after 5 seconds
      setTimeout(() => setShowNewResponsesNotification(false), 5000);
    }
  }, []);

  // Real-time connection
  const { isConnected } = useRealtimeResults({
    surveyId: params.id as string,
    enabled: !loading && !!survey,
    onUpdate: handleRealtimeUpdate,
  });

  useEffect(() => {
    async function fetchResults() {
      try {
        const response = await fetch(`/api/surveys/${params.id}/results`);
        if (!response.ok) {
          throw new Error("Results not found");
        }
        const data = await response.json();
        setSurvey(data);
      } catch {
        setError("Failed to load results");
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [params.id]);

  const exportToCSV = () => {
    if (!survey) return;

    // Filter out SECTION_HEADER questions (no data) and expand MATRIX into multiple columns
    const exportQuestions = survey.questions.filter(q => q.type !== "SECTION_HEADER");

    // Build headers - MATRIX and CONSTANT_SUM questions expand to one column per item
    const headers = ["Response Date"];
    exportQuestions.forEach((q) => {
      if ((q.type === "MATRIX" || q.type === "CONSTANT_SUM") && q.options) {
        // Add a column for each matrix/sum item
        q.options.forEach((item) => {
          headers.push(`${q.title} - ${item}`);
        });
      } else {
        headers.push(q.title);
      }
    });

    const rows: string[][] = [];

    const responsesMap = new Map<string, { date: string; answers: Map<string, unknown> }>();

    exportQuestions.forEach((question) => {
      question.answers.forEach((answer) => {
        const responseId = answer.response.completedAt;
        if (!responsesMap.has(responseId)) {
          responsesMap.set(responseId, {
            date: new Date(answer.response.completedAt).toLocaleString(),
            answers: new Map(),
          });
        }
        responsesMap.get(responseId)!.answers.set(question.id, answer.value);
      });
    });

    responsesMap.forEach((response) => {
      const row = [response.date];
      exportQuestions.forEach((question) => {
        const value = response.answers.get(question.id);

        if (question.type === "MATRIX" && question.options) {
          // Expand matrix values into separate columns
          const matrixValue = value as Record<string, number> | null;
          question.options.forEach((item) => {
            if (matrixValue && matrixValue[item] !== undefined) {
              row.push(String(matrixValue[item]));
            } else {
              row.push("");
            }
          });
        } else if (question.type === "CONSTANT_SUM" && question.options) {
          // Similar to MATRIX - expand into separate columns
          const sumValue = value as Record<string, number> | null;
          question.options.forEach((item) => {
            if (sumValue && sumValue[item] !== undefined) {
              row.push(String(sumValue[item]));
            } else {
              row.push("0");
            }
          });
        } else if (question.type === "RANKING" && Array.isArray(value)) {
          // Show as ordered list: "1. Item, 2. Item, ..."
          row.push((value as string[]).map((item, idx) => `${idx + 1}. ${item}`).join("; "));
        } else if (Array.isArray(value)) {
          row.push(value.join("; "));
        } else if (value !== undefined && value !== null) {
          row.push(String(value));
        } else {
          row.push("");
        }
      });
      rows.push(row);
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${survey.title.replace(/[^a-z0-9]/gi, "_")}_results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = async () => {
    if (!resultsRef.current || !survey) return;

    const html2canvas = (await import("html2canvas")).default;
    const jsPDF = (await import("jspdf")).default;

    const canvas = await html2canvas(resultsRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#fbf5ea",
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    const pdf = new jsPDF("p", "mm", "a4");
    const imgData = canvas.toDataURL("image/png");

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${survey.title.replace(/[^a-z0-9]/gi, "_")}_results.pdf`);
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/results/${params.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendResultsEmail = async () => {
    if (!survey) return;
    setSendingEmail(true);

    try {
      const response = await fetch(`/api/surveys/${params.id}/results/email`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to send");
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    } catch {
      alert("Failed to send results email");
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf5ea] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-8 h-8 text-[#FF4F01] mx-auto mb-4" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[#6b6b7b]"
          >
            Loading results...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="min-h-screen bg-[#fbf5ea]">
        <header className="border-b border-[#dcd6f6]">
          <div className="container mx-auto px-6 py-4">
            <Link href="/" className="text-[#6b6b7b] hover:text-[#1a1a2e]">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-6 py-16 text-center">
          <h1 className="font-['Syne'] text-2xl font-bold mb-2">
            {error || "Results not found"}
          </h1>
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Calculate overview statistics
  const completionRate = survey.questions.length > 0
    ? (survey.questions.reduce((acc, q) => acc + q.answers.length, 0) /
        (survey.questions.length * survey._count.responses)) * 100
    : 0;

  const avgRating = survey.questions
    .filter((q) => q.type === "RATING")
    .reduce((acc, q) => {
      const values = q.answers.map((a) => Number(a.value)).filter((v) => !isNaN(v));
      return values.length > 0 ? acc + values.reduce((a, b) => a + b, 0) / values.length : acc;
    }, 0);

  const ratingQuestions = survey.questions.filter((q) => q.type === "RATING").length;

  return (
    <div className="min-h-screen bg-[#fbf5ea]">
      {/* New Responses Notification */}
      {showNewResponsesNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-[#FF4F01] text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <Radio className="w-4 h-4 animate-pulse" />
            <span className="font-medium">
              {newResponsesCount} new response{newResponsesCount !== 1 ? "s" : ""} received!
            </span>
            <button
              onClick={() => setShowNewResponsesNotification(false)}
              className="ml-2 hover:bg-white/20 rounded-full p-1"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-[#dcd6f6] bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/surveys/${survey.id}`}
              className="text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-['Syne'] font-semibold text-lg">
                {survey.title}
              </h1>
              <div className="flex items-center gap-2">
                <Badge variant="highlight" className="bg-[#FF4F01] text-white">
                  {survey._count.responses} responses
                </Badge>
                {survey.isAnonymous && (
                  <Badge variant="outline" className="text-xs">Anonymous</Badge>
                )}
                {/* Real-time connection indicator */}
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                    isConnected
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                  title={isConnected ? "Live updates active" : "Connecting..."}
                >
                  {isConnected ? (
                    <>
                      <Wifi className="w-3 h-3" />
                      <span>Live</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3" />
                      <span>Offline</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowShareMenu(!showShareMenu)}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              {showShareMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-[#dcd6f6] p-2 z-20">
                  <button
                    onClick={copyShareLink}
                    className="w-full flex items-center gap-3 p-3 hover:bg-[#fbf5ea] rounded-lg transition-colors text-left"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    <div>
                      <div className="font-medium text-sm">Copy public link</div>
                      <div className="text-xs text-[#6b6b7b]">Anyone with link can view</div>
                    </div>
                  </button>
                  <button
                    onClick={sendResultsEmail}
                    disabled={sendingEmail}
                    className="w-full flex items-center gap-3 p-3 hover:bg-[#fbf5ea] rounded-lg transition-colors text-left disabled:opacity-50"
                  >
                    {emailSent ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : sendingEmail ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                    <div>
                      <div className="font-medium text-sm">
                        {emailSent ? "Email sent!" : "Email to participants"}
                      </div>
                      <div className="text-xs text-[#6b6b7b]">Send results summary</div>
                    </div>
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="w-full flex items-center gap-3 p-3 hover:bg-[#fbf5ea] rounded-lg transition-colors text-left"
                  >
                    <FileText className="w-4 h-4" />
                    <div>
                      <div className="font-medium text-sm">Export as PDF</div>
                      <div className="text-xs text-[#6b6b7b]">Download report</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
          </div>
        </div>
      </header>

      <motion.div
        ref={resultsRef}
        className="container mx-auto px-6 py-8 max-w-5xl"
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        {/* Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            custom={0}
            variants={statsCardVariants}
            initial="hidden"
            animate="visible"
            whileHover="hover"
          >
            <Card className="bg-gradient-to-br from-[#FF4F01] to-[#FF7A33] text-white h-full">
              <CardContent className="p-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.2 }}
                >
                  <Users className="w-8 h-8 mb-3 opacity-80" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl font-['Syne'] font-bold"
                >
                  {survey._count.responses}
                </motion.div>
                <div className="text-sm opacity-80">Total Responses</div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div
            custom={1}
            variants={statsCardVariants}
            initial="hidden"
            animate="visible"
            whileHover="hover"
          >
            <Card className="bg-gradient-to-br from-[#1a1a2e] to-[#2d2d44] text-white h-full">
              <CardContent className="p-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.3 }}
                >
                  <MessageSquare className="w-8 h-8 mb-3 opacity-80" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-4xl font-['Syne'] font-bold"
                >
                  {survey.questions.length}
                </motion.div>
                <div className="text-sm opacity-80">Questions</div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div
            custom={2}
            variants={statsCardVariants}
            initial="hidden"
            animate="visible"
            whileHover="hover"
          >
            <Card className="bg-gradient-to-br from-[#c9c1ed] to-[#dcd6f6] h-full">
              <CardContent className="p-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.4 }}
                >
                  <TrendingUp className="w-8 h-8 mb-3 text-[#1a1a2e] opacity-80" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-4xl font-['Syne'] font-bold text-[#1a1a2e]"
                >
                  {isNaN(completionRate) ? "—" : `${completionRate.toFixed(0)}%`}
                </motion.div>
                <div className="text-sm text-[#1a1a2e] opacity-80">Completion Rate</div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div
            custom={3}
            variants={statsCardVariants}
            initial="hidden"
            animate="visible"
            whileHover="hover"
          >
            <Card className="h-full">
              <CardContent className="p-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.5 }}
                >
                  <BarChart3 className="w-8 h-8 mb-3 text-[#FF4F01]" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="text-4xl font-['Syne'] font-bold"
                >
                  {ratingQuestions > 0 ? (avgRating / ratingQuestions).toFixed(1) : "—"}
                </motion.div>
                <div className="text-sm text-[#6b6b7b]">Avg. Rating</div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Response Timeline */}
        {survey._count.responses > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.5 }}
          >
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="font-['Syne'] flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Response Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponseTimeline survey={survey} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {survey._count.responses === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.3 }}
          >
            <Card>
              <CardContent className="py-16 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.5 }}
                  className="w-16 h-16 rounded-full bg-[#dcd6f6] flex items-center justify-center mx-auto mb-4"
                >
                  <Users className="w-8 h-8 text-[#1a1a2e]" />
                </motion.div>
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="font-['Syne'] text-lg font-semibold mb-2"
                >
                  No responses yet
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="text-[#6b6b7b] mb-6"
                >
                  Share your survey link to start collecting responses.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  <Link href={`/surveys/${survey.id}/distribute`}>
                    <Button>Distribute Survey</Button>
                  </Link>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {survey.questions.map((question, index) => (
              <motion.div
                key={question.id}
                variants={cardVariants}
                whileHover="hover"
              >
                <QuestionResults
                  question={question}
                  index={index}
                  totalResponses={survey._count.responses}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 text-center text-sm text-[#6b6b7b]"
        >
          <p>Survey created on {new Date(survey.createdAt).toLocaleDateString()}</p>
        </motion.div>
      </motion.div>

      {/* Click outside to close share menu */}
      {showShareMenu && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowShareMenu(false)}
        />
      )}
    </div>
  );
}

function ResponseTimeline({ survey }: { survey: Survey }) {
  // Group responses by date
  const responsesByDate = new Map<string, number>();

  // Only count questions that actually collect answers (exclude SECTION_HEADER)
  const answerableQuestions = survey.questions.filter(q => q.type !== "SECTION_HEADER");

  answerableQuestions.forEach((question) => {
    question.answers.forEach((answer) => {
      const date = new Date(answer.response.completedAt).toLocaleDateString();
      responsesByDate.set(date, (responsesByDate.get(date) || 0) + 1);
    });
  });

  // Normalize by number of answerable questions (not total questions)
  const answerableCount = answerableQuestions.length || 1; // Avoid division by zero
  const data = Array.from(responsesByDate.entries())
    .map(([date, count]) => ({
      date,
      responses: Math.round(count / answerableCount),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-14); // Last 14 days

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorResponses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#FF4F01" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#FF4F01" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#dcd6f6" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "#6b6b7b" }}
          tickFormatter={(value) => {
            const date = new Date(value);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          }}
        />
        <YAxis tick={{ fontSize: 12, fill: "#6b6b7b" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #dcd6f6",
            borderRadius: "8px",
          }}
        />
        <Area
          type="monotone"
          dataKey="responses"
          stroke="#FF4F01"
          strokeWidth={2}
          fill="url(#colorResponses)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function QuestionResults({
  question,
  index,
  totalResponses,
}: {
  question: Question;
  index: number;
  totalResponses: number;
}) {
  const answerCount = question.answers.length;
  const responseRate = totalResponses > 0 ? (answerCount / totalResponses) * 100 : 0;

  // For choice questions, calculate distribution
  const getChoiceDistribution = () => {
    if (!question.options) return [];

    const counts: Record<string, number> = {};
    question.options.forEach((opt) => (counts[opt] = 0));

    question.answers.forEach((answer) => {
      if (question.type === "MULTIPLE_CHOICE" && Array.isArray(answer.value)) {
        (answer.value as string[]).forEach((v) => {
          if (counts[v] !== undefined) counts[v]++;
        });
      } else if (typeof answer.value === "string") {
        if (counts[answer.value] !== undefined) counts[answer.value]++;
      }
    });

    return question.options.map((opt, i) => ({
      name: opt,
      value: counts[opt],
      percentage: answerCount > 0 ? (counts[opt] / answerCount) * 100 : 0,
      fill: COLORS[i % COLORS.length],
    }));
  };

  // For rating/scale questions, calculate distribution
  const getRatingDistribution = () => {
    const maxValue = question.type === "RATING" ? 5 : 10;
    const distribution = Array.from({ length: maxValue }, (_, i) => ({
      rating: i + 1,
      count: 0,
    }));

    question.answers.forEach((answer) => {
      const value = Number(answer.value);
      if (!isNaN(value) && value >= 1 && value <= maxValue) {
        distribution[value - 1].count++;
      }
    });

    return distribution;
  };

  const getRatingStats = () => {
    const values = question.answers
      .map((a) => Number(a.value))
      .filter((v) => !isNaN(v));
    if (values.length === 0) return { average: 0, min: 0, max: 0 };
    return {
      average: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  };

  // Special rendering for SECTION_HEADER - it's just a visual divider
  if (question.type === "SECTION_HEADER") {
    return (
      <Card className="overflow-hidden border-dashed border-2 border-[#dcd6f6] bg-gradient-to-r from-[#f5f3ff] to-[#fbf5ea]">
        <CardHeader className="py-6">
          <div className="text-center">
            <CardTitle className="text-xl font-['Syne'] text-[#1a1a2e]">{question.title}</CardTitle>
            {question.description && (
              <CardDescription className="mt-2 text-base">{question.description}</CardDescription>
            )}
            <Badge variant="outline" className="text-xs mt-3">
              Section Header
            </Badge>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-white to-[#fbf5ea]">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF4F01] to-[#FF7A33] flex items-center justify-center text-white font-bold shrink-0">
            {index + 1}
          </span>
          <div className="flex-1">
            <CardTitle className="text-lg">{question.title}</CardTitle>
            {question.description && (
              <CardDescription className="mt-1">{question.description}</CardDescription>
            )}
            <div className="flex items-center gap-3 mt-3">
              <Badge variant="outline" className="text-xs">
                {question.type.replace("_", " ")}
              </Badge>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-[#f5f3ff] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FF4F01] rounded-full transition-all duration-500"
                    style={{ width: `${responseRate}%` }}
                  />
                </div>
                <span className="text-xs text-[#6b6b7b]">
                  {answerCount}/{totalResponses} ({responseRate.toFixed(0)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Single Choice - Pie Chart */}
        {question.type === "SINGLE_CHOICE" && question.options && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getChoiceDistribution()}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {getChoiceDistribution().map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${value} responses`, ""]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #dcd6f6",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {getChoiceDistribution().map((item, i) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-[#6b6b7b]">
                        {item.value} ({item.percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-[#f5f3ff] rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Multiple Choice - List with bars (handles long labels better) */}
        {question.type === "MULTIPLE_CHOICE" && question.options && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {getChoiceDistribution()
              .sort((a, b) => b.value - a.value) // Sort by count descending
              .map((item, i) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm gap-2">
                      <span className="font-medium truncate" title={item.name}>{item.name}</span>
                      <span className="text-[#6b6b7b] shrink-0">
                        {item.value} ({item.percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-[#f5f3ff] rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Rating - Radial Gauge + Bar Distribution */}
        {question.type === "RATING" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col items-center justify-center">
              <div className="relative">
                <ResponsiveContainer width={200} height={200}>
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="100%"
                    barSize={20}
                    data={[
                      {
                        name: "Average",
                        value: getRatingStats().average,
                        fill: "#FF4F01",
                      },
                    ]}
                    startAngle={180}
                    endAngle={0}
                  >
                    <RadialBar background dataKey="value" cornerRadius={10} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-4xl font-['Syne'] font-bold text-[#FF4F01]">
                    {getRatingStats().average.toFixed(1)}
                  </div>
                  <div className="text-sm text-[#6b6b7b]">out of 5</div>
                </div>
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getRatingDistribution()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dcd6f6" />
                  <XAxis dataKey="rating" tick={{ fontSize: 12, fill: "#6b6b7b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#6b6b7b" }} />
                  <Tooltip
                    formatter={(value) => [`${value} responses`]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #dcd6f6",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" fill="#FF4F01" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Scale - Bar Distribution */}
        {question.type === "SCALE" && (
          <div>
            <div className="text-center mb-6">
              <div className="text-5xl font-['Syne'] font-bold text-[#1a1a2e]">
                {getRatingStats().average.toFixed(1)}
              </div>
              <div className="text-sm text-[#6b6b7b]">Average score out of 10</div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getRatingDistribution()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dcd6f6" />
                  <XAxis dataKey="rating" tick={{ fontSize: 12, fill: "#6b6b7b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#6b6b7b" }} />
                  <Tooltip
                    formatter={(value) => [`${value} responses`]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #dcd6f6",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {getRatingDistribution().map((entry, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={entry.rating <= 3 ? "#ef4444" : entry.rating <= 6 ? "#f59e0b" : "#22c55e"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Text responses - Beautiful cards */}
        {(question.type === "SHORT_TEXT" ||
          question.type === "LONG_TEXT" ||
          question.type === "EMAIL" ||
          question.type === "NUMBER" ||
          question.type === "DATE" ||
          question.type === "PHONE" ||
          question.type === "TIME" ||
          question.type === "URL" ||
          question.type === "SIGNATURE") && (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {question.answers.length === 0 ? (
              <p className="text-[#6b6b7b] text-sm italic text-center py-8">No responses yet</p>
            ) : (
              question.answers.map((answer, i) => (
                <div
                  key={answer.id}
                  className="p-4 bg-gradient-to-r from-white to-[#fbf5ea] rounded-xl border border-[#dcd6f6] hover:shadow-md transition-shadow"
                >
                  <p className="text-[#1a1a2e]">{String(answer.value)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-6 h-6 rounded-full bg-[#dcd6f6] flex items-center justify-center text-xs font-medium">
                      {i + 1}
                    </div>
                    <p className="text-xs text-[#6b6b7b]">
                      {new Date(answer.response.completedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* File Upload responses - With download links */}
        {question.type === "FILE_UPLOAD" && (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {question.answers.length === 0 ? (
              <p className="text-[#6b6b7b] text-sm italic text-center py-8">No files uploaded yet</p>
            ) : (
              question.answers.map((answer, i) => {
                const fileData = answer.value as { url?: string; filename?: string; size?: number; type?: string } | string | null;
                const isObject = typeof fileData === "object" && fileData !== null;
                const url = isObject ? fileData.url : null;
                const filename = isObject ? fileData.filename : String(fileData);
                const size = isObject ? fileData.size : null;

                return (
                  <div
                    key={answer.id}
                    className="p-4 bg-gradient-to-r from-white to-[#fbf5ea] rounded-xl border border-[#dcd6f6] hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#FF4F01]/10 flex items-center justify-center">
                        <svg className="w-5 h-5 text-[#FF4F01]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#FF4F01] hover:underline font-medium truncate block"
                          >
                            {filename}
                          </a>
                        ) : (
                          <p className="text-[#1a1a2e] truncate">{filename}</p>
                        )}
                        {size && (
                          <p className="text-xs text-[#6b6b7b]">
                            {size < 1024 * 1024
                              ? `${(size / 1024).toFixed(1)} KB`
                              : `${(size / (1024 * 1024)).toFixed(1)} MB`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-6 h-6 rounded-full bg-[#dcd6f6] flex items-center justify-center text-xs font-medium">
                        {i + 1}
                      </div>
                      <p className="text-xs text-[#6b6b7b]">
                        {new Date(answer.response.completedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Dropdown, Likert, Image Choice - Same as Single Choice (Pie Chart) */}
        {(question.type === "DROPDOWN" || question.type === "LIKERT" || question.type === "IMAGE_CHOICE") && question.options && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getChoiceDistribution()}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {getChoiceDistribution().map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${value} responses`, ""]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #dcd6f6",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {getChoiceDistribution().map((item, i) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-[#6b6b7b]">
                        {item.value} ({item.percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-[#f5f3ff] rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Yes/No - Simple two-item visualization */}
        {question.type === "YES_NO" && (() => {
          const counts = { Yes: 0, No: 0 };
          question.answers.forEach((answer) => {
            if (answer.value === "Yes") counts.Yes++;
            else if (answer.value === "No") counts.No++;
          });
          const total = counts.Yes + counts.No;
          const yesPercent = total > 0 ? (counts.Yes / total) * 100 : 0;
          const noPercent = total > 0 ? (counts.No / total) * 100 : 0;

          return (
            <div className="flex gap-4">
              <div className="flex-1 p-6 rounded-xl bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 text-center">
                <div className="text-4xl font-['Syne'] font-bold text-green-600">{counts.Yes}</div>
                <div className="text-lg font-medium text-green-700">Yes</div>
                <div className="text-sm text-green-600">{yesPercent.toFixed(0)}%</div>
              </div>
              <div className="flex-1 p-6 rounded-xl bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 text-center">
                <div className="text-4xl font-['Syne'] font-bold text-red-600">{counts.No}</div>
                <div className="text-lg font-medium text-red-700">No</div>
                <div className="text-sm text-red-600">{noPercent.toFixed(0)}%</div>
              </div>
            </div>
          );
        })()}

        {/* NPS - Special with Promoters/Passives/Detractors */}
        {question.type === "NPS" && (() => {
          const distribution = Array.from({ length: 11 }, (_, i) => ({ score: i, count: 0 }));
          let detractors = 0, passives = 0, promoters = 0;

          question.answers.forEach((answer) => {
            const value = Number(answer.value);
            if (!isNaN(value) && value >= 0 && value <= 10) {
              distribution[value].count++;
              if (value <= 6) detractors++;
              else if (value <= 8) passives++;
              else promoters++;
            }
          });

          const total = detractors + passives + promoters;
          const npsScore = total > 0 ? ((promoters - detractors) / total) * 100 : 0;

          return (
            <div className="space-y-6">
              {/* NPS Score */}
              <div className="text-center">
                <div className="text-6xl font-['Syne'] font-bold" style={{
                  color: npsScore >= 50 ? "#22c55e" : npsScore >= 0 ? "#f59e0b" : "#ef4444"
                }}>
                  {npsScore.toFixed(0)}
                </div>
                <div className="text-sm text-[#6b6b7b]">NPS Score</div>
              </div>

              {/* Category breakdown */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-red-50 text-center">
                  <div className="text-2xl font-bold text-red-600">{detractors}</div>
                  <div className="text-sm text-red-700">Detractors (0-6)</div>
                  <div className="text-xs text-red-500">{total > 0 ? ((detractors / total) * 100).toFixed(0) : 0}%</div>
                </div>
                <div className="p-4 rounded-xl bg-yellow-50 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{passives}</div>
                  <div className="text-sm text-yellow-700">Passives (7-8)</div>
                  <div className="text-xs text-yellow-500">{total > 0 ? ((passives / total) * 100).toFixed(0) : 0}%</div>
                </div>
                <div className="p-4 rounded-xl bg-green-50 text-center">
                  <div className="text-2xl font-bold text-green-600">{promoters}</div>
                  <div className="text-sm text-green-700">Promoters (9-10)</div>
                  <div className="text-xs text-green-500">{total > 0 ? ((promoters / total) * 100).toFixed(0) : 0}%</div>
                </div>
              </div>

              {/* Score distribution */}
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dcd6f6" />
                    <XAxis dataKey="score" tick={{ fontSize: 12, fill: "#6b6b7b" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#6b6b7b" }} />
                    <Tooltip
                      formatter={(value) => [`${value} responses`]}
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #dcd6f6",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {distribution.map((entry, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={entry.score <= 6 ? "#ef4444" : entry.score <= 8 ? "#f59e0b" : "#22c55e"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}

        {/* Slider - Similar to Scale */}
        {question.type === "SLIDER" && (() => {
          const min = question.settings?.min || 0;
          const max = question.settings?.max || 100;
          const step = question.settings?.step || 1;
          const values = question.answers.map((a) => Number(a.value)).filter((v) => !isNaN(v));

          const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          const minVal = values.length > 0 ? Math.min(...values) : 0;
          const maxVal = values.length > 0 ? Math.max(...values) : 0;

          // Create histogram buckets
          const bucketCount = Math.min(10, Math.ceil((max - min) / step));
          const bucketSize = (max - min) / bucketCount;
          const histogram = Array.from({ length: bucketCount }, (_, i) => ({
            range: `${Math.round(min + i * bucketSize)}-${Math.round(min + (i + 1) * bucketSize)}`,
            count: 0,
          }));

          values.forEach((v) => {
            const bucketIndex = Math.min(Math.floor((v - min) / bucketSize), bucketCount - 1);
            if (bucketIndex >= 0) histogram[bucketIndex].count++;
          });

          return (
            <div className="space-y-6">
              {/* Average display */}
              <div className="text-center">
                <div className="text-5xl font-['Syne'] font-bold text-[#FF4F01]">{average.toFixed(1)}</div>
                <div className="text-sm text-[#6b6b7b]">Average (range: {minVal} - {maxVal})</div>
              </div>

              {/* Distribution */}
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogram}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dcd6f6" />
                    <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#6b6b7b" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#6b6b7b" }} />
                    <Tooltip
                      formatter={(value) => [`${value} responses`]}
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #dcd6f6",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="count" fill="#FF4F01" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}

        {/* Ranking - Show average positions */}
        {question.type === "RANKING" && question.options && (() => {
          // Calculate average position for each item
          const positionSums: Record<string, { total: number; count: number }> = {};
          question.options.forEach((item) => {
            positionSums[item] = { total: 0, count: 0 };
          });

          question.answers.forEach((answer) => {
            const ranking = answer.value as string[] | null;
            if (Array.isArray(ranking)) {
              ranking.forEach((item, idx) => {
                if (positionSums[item]) {
                  positionSums[item].total += idx + 1;
                  positionSums[item].count++;
                }
              });
            }
          });

          const averagePositions = question.options
            .map((item) => ({
              item,
              avgPosition: positionSums[item].count > 0
                ? positionSums[item].total / positionSums[item].count
                : question.options!.length,
              responses: positionSums[item].count,
            }))
            .sort((a, b) => a.avgPosition - b.avgPosition);

          return (
            <div className="space-y-3">
              <p className="text-sm text-[#6b6b7b] mb-4">Items ranked by average position (lower = more preferred)</p>
              {averagePositions.map((stat, idx) => (
                <div key={stat.item} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF4F01] to-[#FF7A33] text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-[#1a1a2e] flex-1">{stat.item}</span>
                  <span className="text-sm text-[#6b6b7b]">
                    Avg: {stat.avgPosition.toFixed(1)} ({stat.responses} responses)
                  </span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Constant Sum - Show average distribution */}
        {question.type === "CONSTANT_SUM" && question.options && (() => {
          const total = question.settings?.total || 100;
          const sums: Record<string, number[]> = {};
          question.options.forEach((item) => {
            sums[item] = [];
          });

          question.answers.forEach((answer) => {
            const values = answer.value as Record<string, number> | null;
            if (values) {
              question.options!.forEach((item) => {
                if (values[item] !== undefined) {
                  sums[item].push(values[item]);
                }
              });
            }
          });

          const averages = question.options.map((item) => ({
            item,
            average: sums[item].length > 0
              ? sums[item].reduce((a, b) => a + b, 0) / sums[item].length
              : 0,
            percentage: sums[item].length > 0
              ? (sums[item].reduce((a, b) => a + b, 0) / sums[item].length / total) * 100
              : 0,
          })).sort((a, b) => b.average - a.average);

          return (
            <div className="space-y-4">
              <p className="text-sm text-[#6b6b7b]">Average point distribution out of {total}</p>
              {averages.map((stat, i) => (
                <div key={stat.item} className="flex items-center gap-3">
                  <span className="text-sm text-[#1a1a2e] w-32 md:w-40 shrink-0 truncate" title={stat.item}>
                    {stat.item}
                  </span>
                  <div className="flex-1 h-4 bg-[#f5f3ff] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${stat.percentage}%`,
                        backgroundColor: COLORS[i % COLORS.length],
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-16 text-right">
                    {stat.average.toFixed(1)} pts
                  </span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Matrix - Compact table with rating bars */}
        {question.type === "MATRIX" && question.options && (() => {
          // Parse matrix answers and calculate stats per item
          const matrixSettings = question.settings as { scaleMin?: number; scaleMax?: number; scaleLabels?: Record<string, string> } | null;
          const scaleMin = matrixSettings?.scaleMin ?? 1;
          const scaleMax = matrixSettings?.scaleMax ?? 5;
          const scaleLabels = matrixSettings?.scaleLabels ?? {};

          // Calculate stats for each item
          const itemStats = question.options.map((item) => {
            const values: number[] = [];
            question.answers.forEach((answer) => {
              const answerValue = answer.value as Record<string, number> | null;
              if (answerValue && typeof answerValue[item] === 'number') {
                values.push(answerValue[item]);
              }
            });

            const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            return {
              item,
              average,
              count: values.length,
            };
          }).sort((a, b) => b.average - a.average); // Sort by rating descending

          return (
            <div className="space-y-3">
              {/* Scale legend */}
              {(scaleLabels[scaleMin] || scaleLabels[scaleMax]) && (
                <div className="flex justify-between text-xs text-[#6b6b7b] px-1 mb-2">
                  <span>{scaleLabels[scaleMin] || scaleMin}</span>
                  <span>{scaleLabels[scaleMax] || scaleMax}</span>
                </div>
              )}

              {/* Compact items */}
              {itemStats.map((stat) => {
                const percentage = ((stat.average - scaleMin) / (scaleMax - scaleMin)) * 100;
                // Color based on rating: red < 2.5, yellow 2.5-3.5, green > 3.5
                const midpoint = (scaleMax + scaleMin) / 2;
                const barColor = stat.average < midpoint - 0.5
                  ? "#ef4444"
                  : stat.average > midpoint + 0.5
                    ? "#22c55e"
                    : "#FF4F01";

                return (
                  <div key={stat.item} className="flex items-center gap-3">
                    <span className="text-sm text-[#1a1a2e] w-32 md:w-40 shrink-0 truncate" title={stat.item}>
                      {stat.item}
                    </span>
                    <div className="flex-1 h-4 bg-[#f5f3ff] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%`, backgroundColor: barColor }}
                      />
                    </div>
                    <span className="text-lg font-['Syne'] font-bold w-10 text-right" style={{ color: barColor }}>
                      {stat.average.toFixed(1)}
                    </span>
                  </div>
                );
              })}

              {/* Response count footer */}
              <div className="text-xs text-[#6b6b7b] text-right pt-2 border-t border-[#f5f3ff]">
                {itemStats[0]?.count || 0} response{(itemStats[0]?.count || 0) !== 1 ? 's' : ''}
              </div>
            </div>
          );
        })()}

        {/* Address responses - Formatted address cards */}
        {question.type === "ADDRESS" && (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {question.answers.length === 0 ? (
              <p className="text-[#6b6b7b] text-sm italic text-center py-8">No responses yet</p>
            ) : (
              question.answers.map((answer, i) => {
                const addr = answer.value as { street?: string; city?: string; state?: string; zip?: string; country?: string } | null;
                return (
                  <div
                    key={answer.id}
                    className="p-4 bg-gradient-to-r from-white to-[#fbf5ea] rounded-xl border border-[#dcd6f6] hover:shadow-md transition-shadow"
                  >
                    <p className="text-[#1a1a2e] font-medium">{addr?.street || "No address"}</p>
                    {(addr?.city || addr?.state || addr?.zip) && (
                      <p className="text-[#1a1a2e] text-sm">
                        {[addr?.city, addr?.state, addr?.zip].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {addr?.country && <p className="text-[#6b6b7b] text-sm">{addr.country}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-6 h-6 rounded-full bg-[#dcd6f6] flex items-center justify-center text-xs font-medium">
                        {i + 1}
                      </div>
                      <p className="text-xs text-[#6b6b7b]">
                        {new Date(answer.response.completedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Hidden field - Show values for tracking */}
        {question.type === "HIDDEN" && (
          <div className="bg-[#f5f3ff] rounded-xl p-4 border border-dashed border-[#dcd6f6]">
            <p className="text-[#6b6b7b] text-sm mb-2">Hidden tracking field values:</p>
            {question.answers.length === 0 ? (
              <p className="text-[#6b6b7b] text-sm italic">No values recorded</p>
            ) : (
              <div className="space-y-1">
                {question.answers.map((answer, i) => (
                  <div key={answer.id} className="text-xs text-[#1a1a2e]">
                    {i + 1}. {String(answer.value) || "(empty)"}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
