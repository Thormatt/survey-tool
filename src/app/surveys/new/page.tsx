"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  GripVertical,
  Trash2,
  Type,
  AlignLeft,
  CircleDot,
  CheckSquare,
  Star,
  Hash,
  Calendar,
  Mail,
  ArrowLeft,
  Loader2,
  Wrench,
  Users,
  Heart,
  MessageSquare,
  Briefcase,
  Sparkles,
  Link as LinkIcon,
  Lock,
  Settings,
  EyeOff,
  GitBranch,
  X,
  LayoutList,
  Grid3X3,
  ChevronDown,
  ToggleLeft,
  Image,
  Gauge,
  ThumbsUp,
  SlidersHorizontal,
  ListOrdered,
  PieChart,
  Phone,
  Clock,
} from "lucide-react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type QuestionType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "RATING"
  | "SCALE"
  | "DATE"
  | "EMAIL"
  | "NUMBER"
  | "SECTION_HEADER"
  | "MATRIX"
  | "DROPDOWN"
  | "YES_NO"
  | "IMAGE_CHOICE"
  | "NPS"
  | "LIKERT"
  | "SLIDER"
  | "RANKING"
  | "CONSTANT_SUM"
  | "PHONE"
  | "TIME";

type AccessType = "UNLISTED" | "INVITE_ONLY";

const accessTypeOptions: { value: AccessType; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "UNLISTED", label: "Anyone with Link", description: "Anyone with the link can respond", icon: <LinkIcon className="w-4 h-4" /> },
  { value: "INVITE_ONLY", label: "Invite Only", description: "Only invited emails", icon: <Lock className="w-4 h-4" /> },
];

interface SkipCondition {
  questionId: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than";
  value: string;
}

interface SkipLogic {
  enabled: boolean;
  conditions: SkipCondition[];
  logic: "all" | "any"; // all conditions must match, or any
}

interface Question {
  id: string;
  type: QuestionType;
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
  };
}

interface SurveyTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  title: string;
  surveyDescription: string;
  questions: Question[];
}

const questionTypes: {
  type: QuestionType;
  label: string;
  icon: React.ReactNode;
  description: string;
  category: "display" | "text" | "choice" | "rating" | "advanced";
}[] = [
  // Display
  { type: "SECTION_HEADER", label: "Section Header", icon: <LayoutList className="w-4 h-4" />, description: "Section break", category: "display" },
  // Text inputs
  { type: "SHORT_TEXT", label: "Short Text", icon: <Type className="w-4 h-4" />, description: "Single line text", category: "text" },
  { type: "LONG_TEXT", label: "Long Text", icon: <AlignLeft className="w-4 h-4" />, description: "Multi-line text", category: "text" },
  { type: "EMAIL", label: "Email", icon: <Mail className="w-4 h-4" />, description: "Email address", category: "text" },
  { type: "PHONE", label: "Phone", icon: <Phone className="w-4 h-4" />, description: "Phone number", category: "text" },
  { type: "NUMBER", label: "Number", icon: <Hash className="w-4 h-4" />, description: "Numeric input", category: "text" },
  { type: "DATE", label: "Date", icon: <Calendar className="w-4 h-4" />, description: "Date picker", category: "text" },
  { type: "TIME", label: "Time", icon: <Clock className="w-4 h-4" />, description: "Time picker", category: "text" },
  // Choice questions
  { type: "SINGLE_CHOICE", label: "Single Choice", icon: <CircleDot className="w-4 h-4" />, description: "Pick one option", category: "choice" },
  { type: "MULTIPLE_CHOICE", label: "Multiple Choice", icon: <CheckSquare className="w-4 h-4" />, description: "Pick multiple", category: "choice" },
  { type: "DROPDOWN", label: "Dropdown", icon: <ChevronDown className="w-4 h-4" />, description: "Select from list", category: "choice" },
  { type: "YES_NO", label: "Yes / No", icon: <ToggleLeft className="w-4 h-4" />, description: "Binary choice", category: "choice" },
  { type: "IMAGE_CHOICE", label: "Image Choice", icon: <Image className="w-4 h-4" />, description: "Pick from images", category: "choice" },
  // Rating/Scale
  { type: "RATING", label: "Star Rating", icon: <Star className="w-4 h-4" />, description: "1-5 stars", category: "rating" },
  { type: "SCALE", label: "Scale", icon: <SlidersHorizontal className="w-4 h-4" />, description: "Linear scale", category: "rating" },
  { type: "NPS", label: "NPS", icon: <Gauge className="w-4 h-4" />, description: "Net Promoter Score", category: "rating" },
  { type: "LIKERT", label: "Likert Scale", icon: <ThumbsUp className="w-4 h-4" />, description: "Agreement scale", category: "rating" },
  { type: "SLIDER", label: "Slider", icon: <SlidersHorizontal className="w-4 h-4" />, description: "Visual slider", category: "rating" },
  // Advanced
  { type: "MATRIX", label: "Matrix / Grid", icon: <Grid3X3 className="w-4 h-4" />, description: "Rate multiple items", category: "advanced" },
  { type: "RANKING", label: "Ranking", icon: <ListOrdered className="w-4 h-4" />, description: "Order by preference", category: "advanced" },
  { type: "CONSTANT_SUM", label: "Constant Sum", icon: <PieChart className="w-4 h-4" />, description: "Distribute points", category: "advanced" },
];

// Question Type Preview Component - shows realistic preview of how each question type looks
function QuestionTypePreview({ type }: { type: QuestionType }) {
  const previewStyles = "text-xs text-[#1a1a2e]";
  const labelStyles = "text-[10px] text-[#6b6b7b] mb-1";

  switch (type) {
    case "SECTION_HEADER":
      return (
        <div className="space-y-1">
          <div className="h-px bg-[#dcd6f6] w-full" />
          <p className="font-['Syne'] font-semibold text-sm text-[#1a1a2e]">Section Title</p>
          <p className="text-[10px] text-[#6b6b7b]">Optional description for this section</p>
        </div>
      );
    case "SHORT_TEXT":
      return (
        <div>
          <p className={labelStyles}>Your answer</p>
          <div className="border border-[#dcd6f6] rounded px-2 py-1.5 bg-white">
            <span className={`${previewStyles} text-[#9b9bab]`}>Type your answer...</span>
          </div>
        </div>
      );
    case "LONG_TEXT":
      return (
        <div>
          <p className={labelStyles}>Your answer</p>
          <div className="border border-[#dcd6f6] rounded px-2 py-1.5 bg-white h-12">
            <span className={`${previewStyles} text-[#9b9bab]`}>Type your detailed response...</span>
          </div>
        </div>
      );
    case "EMAIL":
      return (
        <div>
          <p className={labelStyles}>Email address</p>
          <div className="border border-[#dcd6f6] rounded px-2 py-1.5 bg-white flex items-center gap-1">
            <Mail className="w-3 h-3 text-[#9b9bab]" />
            <span className={`${previewStyles} text-[#9b9bab]`}>name@example.com</span>
          </div>
        </div>
      );
    case "PHONE":
      return (
        <div>
          <p className={labelStyles}>Phone number</p>
          <div className="border border-[#dcd6f6] rounded px-2 py-1.5 bg-white flex items-center gap-1">
            <Phone className="w-3 h-3 text-[#9b9bab]" />
            <span className={`${previewStyles} text-[#9b9bab]`}>+1 (555) 123-4567</span>
          </div>
        </div>
      );
    case "NUMBER":
      return (
        <div>
          <p className={labelStyles}>Enter a number</p>
          <div className="border border-[#dcd6f6] rounded px-2 py-1.5 bg-white w-20">
            <span className={`${previewStyles} text-[#9b9bab]`}>42</span>
          </div>
        </div>
      );
    case "DATE":
      return (
        <div>
          <p className={labelStyles}>Select date</p>
          <div className="border border-[#dcd6f6] rounded px-2 py-1.5 bg-white flex items-center gap-1">
            <Calendar className="w-3 h-3 text-[#9b9bab]" />
            <span className={previewStyles}>Jan 15, 2025</span>
          </div>
        </div>
      );
    case "TIME":
      return (
        <div>
          <p className={labelStyles}>Select time</p>
          <div className="border border-[#dcd6f6] rounded px-2 py-1.5 bg-white flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#9b9bab]" />
            <span className={previewStyles}>2:30 PM</span>
          </div>
        </div>
      );
    case "SINGLE_CHOICE":
      return (
        <div className="space-y-1">
          {["Option A", "Option B", "Option C"].map((opt, i) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <div className={`w-3.5 h-3.5 rounded-full border-2 ${i === 1 ? "border-[#FF4F01] bg-[#FF4F01]" : "border-[#dcd6f6]"} flex items-center justify-center`}>
                {i === 1 && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className={previewStyles}>{opt}</span>
            </label>
          ))}
        </div>
      );
    case "MULTIPLE_CHOICE":
      return (
        <div className="space-y-1">
          {["Option A", "Option B", "Option C"].map((opt, i) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <div className={`w-3.5 h-3.5 rounded border ${i === 0 || i === 2 ? "border-[#FF4F01] bg-[#FF4F01]" : "border-[#dcd6f6]"} flex items-center justify-center`}>
                {(i === 0 || i === 2) && <CheckSquare className="w-2.5 h-2.5 text-white" />}
              </div>
              <span className={previewStyles}>{opt}</span>
            </label>
          ))}
        </div>
      );
    case "DROPDOWN":
      return (
        <div>
          <p className={labelStyles}>Select an option</p>
          <div className="border border-[#dcd6f6] rounded px-2 py-1.5 bg-white flex items-center justify-between">
            <span className={previewStyles}>Select...</span>
            <ChevronDown className="w-3 h-3 text-[#6b6b7b]" />
          </div>
        </div>
      );
    case "YES_NO":
      return (
        <div className="flex gap-2">
          <button className="flex-1 py-1.5 px-3 rounded-lg bg-[#FF4F01] text-white text-xs font-medium">
            Yes
          </button>
          <button className="flex-1 py-1.5 px-3 rounded-lg border border-[#dcd6f6] text-xs">
            No
          </button>
        </div>
      );
    case "IMAGE_CHOICE":
      return (
        <div className="grid grid-cols-3 gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`aspect-square rounded border-2 ${i === 2 ? "border-[#FF4F01]" : "border-[#dcd6f6]"} bg-[#f0f0f0] flex items-center justify-center`}>
              <Image className="w-4 h-4 text-[#9b9bab]" />
            </div>
          ))}
        </div>
      );
    case "RATING":
      return (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className={`w-5 h-5 ${i <= 4 ? "fill-[#FF4F01] text-[#FF4F01]" : "text-[#dcd6f6]"}`} />
          ))}
        </div>
      );
    case "SCALE":
      return (
        <div>
          <div className="flex justify-between text-[10px] text-[#6b6b7b] mb-1">
            <span>Not likely</span>
            <span>Very likely</span>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <button key={i} className={`w-6 h-6 rounded text-[10px] font-medium ${i === 5 ? "bg-[#FF4F01] text-white" : "bg-[#dcd6f6]/50"}`}>
                {i}
              </button>
            ))}
          </div>
        </div>
      );
    case "NPS":
      return (
        <div>
          <div className="flex justify-between text-[10px] text-[#6b6b7b] mb-1">
            <span>Not likely</span>
            <span>Very likely</span>
          </div>
          <div className="flex gap-0.5">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <button key={i} className={`w-4 h-5 rounded-sm text-[8px] font-medium ${i === 8 ? "bg-[#FF4F01] text-white" : i <= 6 ? "bg-red-100" : i <= 8 ? "bg-yellow-100" : "bg-green-100"}`}>
                {i}
              </button>
            ))}
          </div>
        </div>
      );
    case "LIKERT":
      return (
        <div className="flex gap-1">
          {["😞", "😕", "😐", "🙂", "😊"].map((emoji, i) => (
            <button key={emoji} className={`w-7 h-7 rounded-full text-sm ${i === 3 ? "bg-[#FF4F01]/20 ring-2 ring-[#FF4F01]" : "bg-[#dcd6f6]/30"}`}>
              {emoji}
            </button>
          ))}
        </div>
      );
    case "SLIDER":
      return (
        <div>
          <div className="flex justify-between text-[10px] text-[#6b6b7b] mb-1">
            <span>0</span>
            <span className="font-medium text-[#FF4F01]">65</span>
            <span>100</span>
          </div>
          <div className="relative h-2 bg-[#dcd6f6] rounded-full">
            <div className="absolute left-0 top-0 h-2 bg-[#FF4F01] rounded-full" style={{ width: "65%" }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-[#FF4F01] rounded-full" style={{ left: "calc(65% - 6px)" }} />
          </div>
        </div>
      );
    case "MATRIX":
      return (
        <div className="space-y-1">
          <div className="grid grid-cols-4 gap-1 text-[8px] text-[#6b6b7b]">
            <div></div>
            <div className="text-center">Low</div>
            <div className="text-center">Med</div>
            <div className="text-center">High</div>
          </div>
          {["Item 1", "Item 2"].map((item, i) => (
            <div key={item} className="grid grid-cols-4 gap-1 items-center">
              <span className="text-[9px]">{item}</span>
              {[0, 1, 2].map((j) => (
                <div key={j} className="flex justify-center">
                  <div className={`w-3 h-3 rounded-full border ${(i === 0 && j === 2) || (i === 1 && j === 1) ? "border-[#FF4F01] bg-[#FF4F01]" : "border-[#dcd6f6]"}`} />
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    case "RANKING":
      return (
        <div className="space-y-1">
          {["First choice", "Second choice", "Third choice"].map((item, i) => (
            <div key={item} className="flex items-center gap-2 p-1.5 bg-white border border-[#dcd6f6] rounded text-[10px]">
              <GripVertical className="w-3 h-3 text-[#9b9bab]" />
              <span className="w-4 h-4 rounded bg-[#FF4F01] text-white text-[9px] flex items-center justify-center font-medium">{i + 1}</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      );
    case "CONSTANT_SUM":
      return (
        <div className="space-y-1.5">
          <div className="text-[10px] text-[#6b6b7b]">Distribute 100 points</div>
          {[{ name: "Option A", val: 40 }, { name: "Option B", val: 35 }, { name: "Option C", val: 25 }].map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <span className="text-[10px] w-14">{item.name}</span>
              <div className="flex-1 h-2 bg-[#dcd6f6] rounded-full overflow-hidden">
                <div className="h-full bg-[#FF4F01]" style={{ width: `${item.val}%` }} />
              </div>
              <span className="text-[10px] font-medium w-6">{item.val}</span>
            </div>
          ))}
        </div>
      );
    default:
      return <div className="text-[10px] text-[#6b6b7b]">Preview</div>;
  }
}

// Question Type Card with hover preview
function QuestionTypeCard({
  qt,
  index,
  onSelect,
}: {
  qt: { type: QuestionType; label: string; icon: React.ReactNode; description: string };
  index: number;
  onSelect: () => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setShowPreview(true);
    }, 600); // 600ms delay before showing preview
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShowPreview(false);
  }, []);

  return (
    <motion.div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <motion.button
        onClick={onSelect}
        className="w-full flex flex-col items-center gap-2 p-4 rounded-lg border border-[#dcd6f6] hover:border-[#c9c1ed] hover:bg-[#dcd6f6]/20 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: index * 0.03,
          type: "spring",
          stiffness: 300,
          damping: 25
        }}
        whileHover={{
          scale: 1.05,
          y: -4,
          boxShadow: "0 8px 25px -5px rgba(0, 0, 0, 0.1)",
          transition: { type: "spring", stiffness: 400, damping: 20 }
        }}
        whileTap={{ scale: 0.98 }}
      >
        <motion.div
          className="w-10 h-10 rounded-full bg-[#dcd6f6] flex items-center justify-center"
          whileHover={{
            scale: 1.1,
            rotate: [0, -10, 10, -5, 0],
            transition: { duration: 0.5 }
          }}
        >
          {qt.icon}
        </motion.div>
        <span className="text-sm font-medium">{qt.label}</span>
        <span className="text-xs text-[#6b6b7b]">{qt.description}</span>
      </motion.button>

      {/* Preview Popup */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-3 bg-white rounded-lg shadow-xl border border-[#dcd6f6]"
          >
            <div className="text-[10px] font-medium text-[#6b6b7b] uppercase tracking-wider mb-2">
              Preview
            </div>
            <QuestionTypePreview type={qt.type} />
            {/* Arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-3 h-3 bg-white border-r border-b border-[#dcd6f6] transform rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Survey Templates
const surveyTemplates: SurveyTemplate[] = [
  {
    id: "blank",
    name: "Start from Scratch",
    description: "Create a custom survey with your own questions",
    icon: <Sparkles className="w-6 h-6" />,
    title: "",
    surveyDescription: "",
    questions: [],
  },
  {
    id: "team-tools",
    name: "Team Tools Assessment",
    description: "Evaluate workplace tools and software your team uses",
    icon: <Wrench className="w-6 h-6" />,
    title: "Team Tools Survey",
    surveyDescription: "Help us understand how you use our workplace tools and what we can improve. Your feedback is anonymous and will help shape our tool decisions.",
    questions: [
      { id: "1", type: "MULTIPLE_CHOICE", title: "Which of these tools do you use regularly?", description: "Select all that apply", required: true, options: ["Gmail", "Slack", "Notion", "Google Drive", "Zoom", "Figma", "Jira", "Other"] },
      { id: "2", type: "RATING", title: "How satisfied are you with our current toolset overall?", description: "Rate from 1 (very dissatisfied) to 5 (very satisfied)", required: true },
      { id: "3", type: "SINGLE_CHOICE", title: "Do our current tools help you do your job effectively?", required: true, options: ["Yes, completely", "Mostly", "Somewhat", "Not really", "No, not at all"] },
      { id: "4", type: "LONG_TEXT", title: "Which tool do you find most valuable and why?", required: false },
      { id: "5", type: "LONG_TEXT", title: "What's the biggest challenge you face with our current tools?", description: "Be as specific as possible", required: false },
      { id: "6", type: "LONG_TEXT", title: "Are there any tools you wish we had that we don't currently use?", description: "Feel free to suggest specific tools or categories", required: false },
    ],
  },
  {
    id: "employee-satisfaction",
    name: "Employee Satisfaction",
    description: "Measure employee engagement and workplace satisfaction",
    icon: <Heart className="w-6 h-6" />,
    title: "Employee Satisfaction Survey",
    surveyDescription: "We value your feedback! This anonymous survey helps us understand your experience and improve our workplace.",
    questions: [
      { id: "1", type: "RATING", title: "Overall, how satisfied are you working here?", required: true },
      { id: "2", type: "RATING", title: "How would you rate your work-life balance?", required: true },
      { id: "3", type: "RATING", title: "How satisfied are you with your manager's support?", required: true },
      { id: "4", type: "SINGLE_CHOICE", title: "Do you feel your work is recognized and appreciated?", required: true, options: ["Always", "Often", "Sometimes", "Rarely", "Never"] },
      { id: "5", type: "SINGLE_CHOICE", title: "Would you recommend this company as a great place to work?", required: true, options: ["Definitely yes", "Probably yes", "Not sure", "Probably not", "Definitely not"] },
      { id: "6", type: "LONG_TEXT", title: "What do you enjoy most about working here?", required: false },
      { id: "7", type: "LONG_TEXT", title: "What could we improve to make this a better workplace?", required: false },
    ],
  },
  {
    id: "customer-feedback",
    name: "Customer Feedback",
    description: "Gather feedback about your products or services",
    icon: <MessageSquare className="w-6 h-6" />,
    title: "Customer Feedback Survey",
    surveyDescription: "We'd love to hear about your experience! Your feedback helps us serve you better.",
    questions: [
      { id: "1", type: "RATING", title: "How would you rate your overall experience with us?", required: true },
      { id: "2", type: "SINGLE_CHOICE", title: "How likely are you to recommend us to others?", required: true, options: ["Very likely", "Likely", "Neutral", "Unlikely", "Very unlikely"] },
      { id: "3", type: "SINGLE_CHOICE", title: "How well did our product/service meet your expectations?", required: true, options: ["Exceeded expectations", "Met expectations", "Somewhat met expectations", "Did not meet expectations"] },
      { id: "4", type: "LONG_TEXT", title: "What did you like most about your experience?", required: false },
      { id: "5", type: "LONG_TEXT", title: "What could we do better?", required: false },
    ],
  },
  {
    id: "meeting-feedback",
    name: "Meeting Feedback",
    description: "Get feedback after meetings or events",
    icon: <Users className="w-6 h-6" />,
    title: "Meeting Feedback",
    surveyDescription: "Help us make our meetings more effective! Share your thoughts on today's meeting.",
    questions: [
      { id: "1", type: "RATING", title: "How useful was this meeting for you?", required: true },
      { id: "2", type: "SINGLE_CHOICE", title: "Was the meeting length appropriate?", required: true, options: ["Too short", "Just right", "Too long"] },
      { id: "3", type: "SINGLE_CHOICE", title: "Were the meeting objectives clear?", required: true, options: ["Very clear", "Somewhat clear", "Not clear"] },
      { id: "4", type: "LONG_TEXT", title: "What was the most valuable part of this meeting?", required: false },
      { id: "5", type: "LONG_TEXT", title: "How could we improve future meetings?", required: false },
    ],
  },
  {
    id: "onboarding",
    name: "New Hire Onboarding",
    description: "Evaluate the onboarding experience for new employees",
    icon: <Briefcase className="w-6 h-6" />,
    title: "Onboarding Experience Survey",
    surveyDescription: "We want to ensure every new team member has a great start. Please share your onboarding experience.",
    questions: [
      { id: "1", type: "RATING", title: "How would you rate your overall onboarding experience?", required: true },
      { id: "2", type: "SINGLE_CHOICE", title: "Did you receive adequate training for your role?", required: true, options: ["More than enough", "Just right", "Could use more", "Not enough"] },
      { id: "3", type: "SINGLE_CHOICE", title: "How welcomed did you feel by your team?", required: true, options: ["Very welcomed", "Welcomed", "Neutral", "Not very welcomed"] },
      { id: "4", type: "RATING", title: "How clear were your initial goals and expectations?", required: true },
      { id: "5", type: "LONG_TEXT", title: "What was most helpful during your onboarding?", required: false },
      { id: "6", type: "LONG_TEXT", title: "What would have made your onboarding experience better?", required: false },
    ],
  },
];

interface SortableQuestionProps {
  question: Question;
  index: number;
  allQuestions: Question[];
  questionTypes: typeof questionTypes;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  deleteQuestion: (id: string) => void;
  addOption: (questionId: string) => void;
  updateOption: (questionId: string, optionIndex: number, value: string) => void;
  deleteOption: (questionId: string, optionIndex: number) => void;
}

function SortableQuestion({
  question,
  index,
  allQuestions,
  questionTypes,
  updateQuestion,
  deleteQuestion,
  addOption,
  updateOption,
  deleteOption,
}: SortableQuestionProps) {
  const [showSkipLogic, setShowSkipLogic] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  // Get previous questions that can be used for skip logic
  const previousQuestions = allQuestions.slice(0, index);
  const skipLogic = question.settings?.skipLogic;

  const toggleSkipLogic = () => {
    if (skipLogic?.enabled) {
      // Disable skip logic
      updateQuestion(question.id, {
        settings: { ...question.settings, skipLogic: undefined },
      });
      setShowSkipLogic(false);
    } else {
      // Enable skip logic
      setShowSkipLogic(true);
    }
  };

  const addCondition = () => {
    if (previousQuestions.length === 0) return;
    const newCondition: SkipCondition = {
      questionId: previousQuestions[0].id,
      operator: "equals",
      value: "",
    };
    updateQuestion(question.id, {
      settings: {
        ...question.settings,
        skipLogic: {
          enabled: true,
          conditions: [...(skipLogic?.conditions || []), newCondition],
          logic: skipLogic?.logic || "all",
        },
      },
    });
  };

  const updateCondition = (conditionIndex: number, updates: Partial<SkipCondition>) => {
    if (!skipLogic) return;
    const newConditions = [...skipLogic.conditions];
    newConditions[conditionIndex] = { ...newConditions[conditionIndex], ...updates };
    updateQuestion(question.id, {
      settings: {
        ...question.settings,
        skipLogic: { ...skipLogic, conditions: newConditions },
      },
    });
  };

  const removeCondition = (conditionIndex: number) => {
    if (!skipLogic) return;
    const newConditions = skipLogic.conditions.filter((_, i) => i !== conditionIndex);
    if (newConditions.length === 0) {
      updateQuestion(question.id, {
        settings: { ...question.settings, skipLogic: undefined },
      });
      setShowSkipLogic(false);
    } else {
      updateQuestion(question.id, {
        settings: {
          ...question.settings,
          skipLogic: { ...skipLogic, conditions: newConditions },
        },
      });
    }
  };

  const getQuestionOptions = (questionId: string) => {
    const q = allQuestions.find((q) => q.id === questionId);
    if (!q) return [];
    if (q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE") {
      return q.options || [];
    }
    if (q.type === "RATING") {
      return ["1", "2", "3", "4", "5"];
    }
    return [];
  };

  return (
    <Card ref={setNodeRef} style={style} className="group">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div
            {...attributes}
            {...listeners}
            className="pt-2 cursor-grab active:cursor-grabbing text-[#6b6b7b] opacity-0 group-hover:opacity-100 transition-opacity touch-none"
          >
            <GripVertical className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="text-xs">
                {questionTypes.find((t) => t.type === question.type)?.label}
              </Badge>
              <span className="text-xs text-[#6b6b7b]">Question {index + 1}</span>
              {skipLogic?.enabled && (
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                  <GitBranch className="w-3 h-3 mr-1" />
                  Conditional
                </Badge>
              )}
            </div>
            <Input
              placeholder="Question title"
              value={question.title}
              onChange={(e) => updateQuestion(question.id, { title: e.target.value })}
              className="text-lg font-medium border-0 px-0 focus-visible:ring-0 bg-transparent placeholder:text-[#6b6b7b]/50"
            />
            <Input
              placeholder="Description (optional)"
              value={question.description || ""}
              onChange={(e) => updateQuestion(question.id, { description: e.target.value })}
              className="mt-1 text-sm border-0 px-0 focus-visible:ring-0 bg-transparent placeholder:text-[#6b6b7b]/50"
            />

            {(question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE") && (
              <div className="mt-4 space-y-2">
                {question.options?.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    {question.type === "SINGLE_CHOICE" ? (
                      <div className="w-4 h-4 rounded-full border-2 border-[#dcd6f6]" />
                    ) : (
                      <div className="w-4 h-4 rounded border-2 border-[#dcd6f6]" />
                    )}
                    <Input
                      value={option}
                      onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                      className="flex-1 h-8 text-sm"
                    />
                    <button
                      onClick={() => deleteOption(question.id, optionIndex)}
                      className="text-[#6b6b7b] hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addOption(question.id)}
                  className="flex items-center gap-2 text-sm text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Add option
                </button>
              </div>
            )}

            {question.type === "RATING" && (
              <div className="mt-4 flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-6 h-6 text-[#dcd6f6]" />
                ))}
              </div>
            )}

            {/* Section Header Preview */}
            {question.type === "SECTION_HEADER" && (
              <div className="mt-4 p-4 border-l-4 border-[#FF4F01] bg-[#fff8f0] rounded-r-lg">
                <p className="text-sm text-[#6b6b7b] italic">
                  This section header will display as a visual break in the survey.
                  No response required from respondents.
                </p>
              </div>
            )}

            {/* Matrix Question Builder */}
            {question.type === "MATRIX" && (
              <div className="mt-4 space-y-4">
                {/* Scale Configuration */}
                <div className="flex items-center gap-4 p-3 bg-[#f5f3ff] rounded-lg">
                  <span className="text-sm font-medium">Scale:</span>
                  <select
                    value={question.settings?.scaleMin || 1}
                    onChange={(e) => updateQuestion(question.id, {
                      settings: { ...question.settings, scaleMin: parseInt(e.target.value) }
                    })}
                    className="text-sm px-2 py-1 border rounded"
                  >
                    {[0, 1].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <span>to</span>
                  <select
                    value={question.settings?.scaleMax || 5}
                    onChange={(e) => updateQuestion(question.id, {
                      settings: { ...question.settings, scaleMax: parseInt(e.target.value) }
                    })}
                    className="text-sm px-2 py-1 border rounded"
                  >
                    {[3, 4, 5, 7, 10].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                {/* Matrix Items (Rows) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Items to rate:</label>
                  {question.options?.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-center gap-2">
                      <Grid3X3 className="w-4 h-4 text-[#6b6b7b]" />
                      <Input
                        value={item}
                        onChange={(e) => updateOption(question.id, itemIndex, e.target.value)}
                        className="flex-1 h-8 text-sm"
                        placeholder={`Item ${itemIndex + 1}`}
                      />
                      <button
                        onClick={() => deleteOption(question.id, itemIndex)}
                        className="text-[#6b6b7b] hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addOption(question.id)}
                    className="flex items-center gap-2 text-sm text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add item
                  </button>
                </div>

                {/* Matrix Preview */}
                <div className="mt-4 p-3 bg-white rounded-lg border border-[#dcd6f6] overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left p-2"></th>
                        {Array.from({ length: (question.settings?.scaleMax || 5) - (question.settings?.scaleMin || 1) + 1 }, (_, i) => (
                          <th key={i} className="p-2 text-center text-[#6b6b7b]">
                            {(question.settings?.scaleMin || 1) + i}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {question.options?.slice(0, 3).map((item, i) => (
                        <tr key={i} className="border-t border-[#dcd6f6]">
                          <td className="p-2">{item || `Item ${i + 1}`}</td>
                          {Array.from({ length: (question.settings?.scaleMax || 5) - (question.settings?.scaleMin || 1) + 1 }, (_, j) => (
                            <td key={j} className="p-2 text-center">
                              <div className="w-4 h-4 rounded-full border-2 border-[#dcd6f6] mx-auto" />
                            </td>
                          ))}
                        </tr>
                      ))}
                      {(question.options?.length || 0) > 3 && (
                        <tr className="border-t border-[#dcd6f6]">
                          <td colSpan={100} className="p-2 text-center text-[#6b6b7b] text-xs">
                            + {(question.options?.length || 0) - 3} more items
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Dropdown Preview */}
            {question.type === "DROPDOWN" && (
              <div className="mt-4 space-y-2">
                {question.options?.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <ChevronDown className="w-4 h-4 text-[#6b6b7b]" />
                    <Input
                      value={option}
                      onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                      className="flex-1 h-8 text-sm"
                    />
                    <button
                      onClick={() => deleteOption(question.id, optionIndex)}
                      className="text-[#6b6b7b] hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addOption(question.id)}
                  className="flex items-center gap-2 text-sm text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Add option
                </button>
              </div>
            )}

            {/* Yes/No Preview */}
            {question.type === "YES_NO" && (
              <div className="mt-4 flex gap-4">
                <div className="flex-1 p-4 border-2 border-[#dcd6f6] rounded-lg text-center">
                  <span className="font-medium">Yes</span>
                </div>
                <div className="flex-1 p-4 border-2 border-[#dcd6f6] rounded-lg text-center">
                  <span className="font-medium">No</span>
                </div>
              </div>
            )}

            {/* NPS Preview */}
            {question.type === "NPS" && (
              <div className="mt-4 space-y-3">
                <div className="flex gap-1 justify-between">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <div
                      key={num}
                      className={`w-8 h-8 rounded border-2 flex items-center justify-center text-xs font-medium ${
                        num <= 6 ? "border-red-200 text-red-600" :
                        num <= 8 ? "border-yellow-200 text-yellow-600" :
                        "border-green-200 text-green-600"
                      }`}
                    >
                      {num}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-[#6b6b7b]">
                  <span>{question.settings?.minLabel || "Not at all likely"}</span>
                  <span>{question.settings?.maxLabel || "Extremely likely"}</span>
                </div>
              </div>
            )}

            {/* Likert Scale Preview */}
            {question.type === "LIKERT" && (
              <div className="mt-4">
                <div className="flex gap-2">
                  {(question.settings?.scale || ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]).map((label: string, i: number) => (
                    <div key={i} className="flex-1 p-2 border-2 border-[#dcd6f6] rounded-lg text-center">
                      <div className="w-4 h-4 rounded-full border-2 border-[#dcd6f6] mx-auto mb-1" />
                      <span className="text-xs text-[#6b6b7b]">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Slider Preview */}
            {question.type === "SLIDER" && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-4 p-3 bg-[#f5f3ff] rounded-lg">
                  <span className="text-sm font-medium">Range:</span>
                  <Input
                    type="number"
                    value={question.settings?.min || 0}
                    onChange={(e) => updateQuestion(question.id, {
                      settings: { ...question.settings, min: parseInt(e.target.value) }
                    })}
                    className="w-20 h-8 text-sm"
                  />
                  <span>to</span>
                  <Input
                    type="number"
                    value={question.settings?.max || 100}
                    onChange={(e) => updateQuestion(question.id, {
                      settings: { ...question.settings, max: parseInt(e.target.value) }
                    })}
                    className="w-20 h-8 text-sm"
                  />
                </div>
                <div className="h-2 bg-[#dcd6f6] rounded-full">
                  <div className="h-2 w-1/2 bg-[#1a1a2e] rounded-full" />
                </div>
                <div className="flex justify-between text-xs text-[#6b6b7b]">
                  <span>{question.settings?.min || 0}</span>
                  <span>{question.settings?.max || 100}</span>
                </div>
              </div>
            )}

            {/* Ranking Preview */}
            {question.type === "RANKING" && (
              <div className="mt-4 space-y-2">
                <label className="text-sm font-medium">Items to rank:</label>
                {question.options?.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#dcd6f6] flex items-center justify-center text-xs font-medium">
                      {itemIndex + 1}
                    </div>
                    <GripVertical className="w-4 h-4 text-[#6b6b7b]" />
                    <Input
                      value={item}
                      onChange={(e) => updateOption(question.id, itemIndex, e.target.value)}
                      className="flex-1 h-8 text-sm"
                      placeholder={`Item ${itemIndex + 1}`}
                    />
                    <button
                      onClick={() => deleteOption(question.id, itemIndex)}
                      className="text-[#6b6b7b] hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addOption(question.id)}
                  className="flex items-center gap-2 text-sm text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Add item
                </button>
              </div>
            )}

            {/* Constant Sum Preview */}
            {question.type === "CONSTANT_SUM" && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-4 p-3 bg-[#f5f3ff] rounded-lg">
                  <span className="text-sm font-medium">Points to distribute:</span>
                  <Input
                    type="number"
                    value={question.settings?.total || 100}
                    onChange={(e) => updateQuestion(question.id, {
                      settings: { ...question.settings, total: parseInt(e.target.value) }
                    })}
                    className="w-20 h-8 text-sm"
                  />
                </div>
                <label className="text-sm font-medium">Categories:</label>
                {question.options?.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-[#6b6b7b]" />
                    <Input
                      value={item}
                      onChange={(e) => updateOption(question.id, itemIndex, e.target.value)}
                      className="flex-1 h-8 text-sm"
                      placeholder={`Category ${itemIndex + 1}`}
                    />
                    <div className="w-16 h-8 border rounded flex items-center justify-center text-sm text-[#6b6b7b]">
                      0
                    </div>
                    <button
                      onClick={() => deleteOption(question.id, itemIndex)}
                      className="text-[#6b6b7b] hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addOption(question.id)}
                  className="flex items-center gap-2 text-sm text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Add category
                </button>
              </div>
            )}

            {/* Image Choice Preview */}
            {question.type === "IMAGE_CHOICE" && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-[#6b6b7b] italic">
                  Image URLs can be added when editing in the full survey editor.
                </p>
                {question.options?.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <div className="w-12 h-12 rounded border-2 border-dashed border-[#dcd6f6] flex items-center justify-center">
                      <Image className="w-5 h-5 text-[#6b6b7b]" />
                    </div>
                    <Input
                      value={option}
                      onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                      className="flex-1 h-8 text-sm"
                      placeholder="Option label"
                    />
                    <button
                      onClick={() => deleteOption(question.id, optionIndex)}
                      className="text-[#6b6b7b] hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addOption(question.id)}
                  className="flex items-center gap-2 text-sm text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Add option
                </button>
              </div>
            )}

            {/* Scale Preview */}
            {question.type === "SCALE" && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-4 p-3 bg-[#f5f3ff] rounded-lg">
                  <span className="text-sm font-medium">Scale:</span>
                  <Input
                    type="number"
                    value={question.settings?.scaleMin || 1}
                    onChange={(e) => updateQuestion(question.id, {
                      settings: { ...question.settings, scaleMin: parseInt(e.target.value) }
                    })}
                    className="w-16 h-8 text-sm"
                  />
                  <span>to</span>
                  <Input
                    type="number"
                    value={question.settings?.scaleMax || 10}
                    onChange={(e) => updateQuestion(question.id, {
                      settings: { ...question.settings, scaleMax: parseInt(e.target.value) }
                    })}
                    className="w-16 h-8 text-sm"
                  />
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min((question.settings?.scaleMax || 10) - (question.settings?.scaleMin || 1) + 1, 11) }, (_, i) => (
                    <div
                      key={i}
                      className="flex-1 h-8 border-2 border-[#dcd6f6] rounded flex items-center justify-center text-xs"
                    >
                      {(question.settings?.scaleMin || 1) + i}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Phone Preview */}
            {question.type === "PHONE" && (
              <div className="mt-4 p-3 bg-[#f5f5f5] rounded-lg border border-[#dcd6f6]">
                <div className="flex items-center gap-2 text-[#6b6b7b]">
                  <Phone className="w-4 h-4" />
                  <span className="text-sm">Phone number input</span>
                </div>
              </div>
            )}

            {/* Time Preview */}
            {question.type === "TIME" && (
              <div className="mt-4 p-3 bg-[#f5f5f5] rounded-lg border border-[#dcd6f6]">
                <div className="flex items-center gap-2 text-[#6b6b7b]">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Time picker</span>
                </div>
              </div>
            )}

            {/* Skip Logic Configuration */}
            {(showSkipLogic || skipLogic?.enabled) && previousQuestions.length > 0 && (
              <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
                    <GitBranch className="w-4 h-4" />
                    Show this question only if...
                  </div>
                  <button
                    onClick={() => {
                      updateQuestion(question.id, {
                        settings: { ...question.settings, skipLogic: undefined },
                      });
                      setShowSkipLogic(false);
                    }}
                    className="text-purple-400 hover:text-purple-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {skipLogic?.conditions && skipLogic.conditions.length > 1 && (
                  <div className="mb-3">
                    <select
                      value={skipLogic.logic}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          settings: {
                            ...question.settings,
                            skipLogic: { ...skipLogic, logic: e.target.value as "all" | "any" },
                          },
                        })
                      }
                      className="text-xs px-2 py-1 rounded border border-purple-200 bg-white text-purple-700"
                    >
                      <option value="all">ALL conditions match</option>
                      <option value="any">ANY condition matches</option>
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  {skipLogic?.conditions?.map((condition, conditionIndex) => {
                    const sourceQuestion = previousQuestions.find((q) => q.id === condition.questionId);
                    const hasOptions = sourceQuestion && (
                      sourceQuestion.type === "SINGLE_CHOICE" ||
                      sourceQuestion.type === "MULTIPLE_CHOICE" ||
                      sourceQuestion.type === "RATING"
                    );

                    return (
                      <div key={conditionIndex} className="flex items-center gap-2 flex-wrap">
                        <select
                          value={condition.questionId}
                          onChange={(e) => updateCondition(conditionIndex, { questionId: e.target.value, value: "" })}
                          className="text-sm px-2 py-1.5 rounded border border-purple-200 bg-white max-w-[180px]"
                        >
                          {previousQuestions.map((q, i) => (
                            <option key={q.id} value={q.id}>
                              Q{i + 1}: {q.title.slice(0, 25)}{q.title.length > 25 ? "..." : ""}
                            </option>
                          ))}
                        </select>

                        <select
                          value={condition.operator}
                          onChange={(e) => updateCondition(conditionIndex, { operator: e.target.value as SkipCondition["operator"] })}
                          className="text-sm px-2 py-1.5 rounded border border-purple-200 bg-white"
                        >
                          <option value="equals">equals</option>
                          <option value="not_equals">does not equal</option>
                          <option value="contains">contains</option>
                          {(sourceQuestion?.type === "NUMBER" || sourceQuestion?.type === "RATING") && (
                            <>
                              <option value="greater_than">greater than</option>
                              <option value="less_than">less than</option>
                            </>
                          )}
                        </select>

                        {hasOptions ? (
                          <select
                            value={condition.value}
                            onChange={(e) => updateCondition(conditionIndex, { value: e.target.value })}
                            className="text-sm px-2 py-1.5 rounded border border-purple-200 bg-white max-w-[180px]"
                          >
                            <option value="">Select value...</option>
                            {getQuestionOptions(condition.questionId).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            value={condition.value}
                            onChange={(e) => updateCondition(conditionIndex, { value: e.target.value })}
                            placeholder="Value"
                            className="h-8 w-32 text-sm"
                          />
                        )}

                        <button
                          onClick={() => removeCondition(conditionIndex)}
                          className="text-purple-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={addCondition}
                  className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 mt-3"
                >
                  <Plus className="w-4 h-4" />
                  Add condition
                </button>
              </div>
            )}

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#dcd6f6]">
              <div className="flex items-center gap-4">
                {/* Hide Required checkbox for SECTION_HEADER */}
                {question.type !== "SECTION_HEADER" && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={question.required}
                      onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                      className="rounded border-[#dcd6f6]"
                    />
                    Required
                  </label>
                )}
                {/* Hide skip logic for SECTION_HEADER (it has no answer to base logic on) */}
                {index > 0 && question.type !== "SECTION_HEADER" && (
                  <button
                    onClick={toggleSkipLogic}
                    className={`flex items-center gap-1 text-sm transition-colors ${
                      skipLogic?.enabled
                        ? "text-purple-600 hover:text-purple-800"
                        : "text-[#6b6b7b] hover:text-[#1a1a2e]"
                    }`}
                  >
                    <GitBranch className="w-4 h-4" />
                    {skipLogic?.enabled ? "Edit logic" : "Add logic"}
                  </button>
                )}
              </div>
              <button
                onClick={() => deleteQuestion(question.id)}
                className="text-[#6b6b7b] hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NewSurveyPage() {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<SurveyTemplate | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showQuestionTypes, setShowQuestionTypes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessType, setAccessType] = useState<AccessType>("UNLISTED");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setQuestions((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const selectTemplate = (template: SurveyTemplate) => {
    setSelectedTemplate(template);
    setTitle(template.title);
    setDescription(template.surveyDescription);
    // Generate new IDs for template questions
    setQuestions(
      template.questions.map((q) => ({
        ...q,
        id: crypto.randomUUID(),
      }))
    );
  };

  const saveSurvey = async (publish: boolean) => {
    if (!title.trim()) {
      setError("Please add a title for your survey");
      return;
    }
    if (questions.length === 0) {
      setError("Please add at least one question");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          published: publish,
          accessType,
          isAnonymous,
          questions: questions.map((q) => ({
            type: q.type,
            title: q.title,
            description: q.description,
            required: q.required,
            options: q.options,
            settings: q.settings,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save survey");
      }

      const survey = await response.json();
      router.push(`/surveys/${survey.id}`);
    } catch (err) {
      setError("Failed to save survey. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = (type: QuestionType) => {
    // Determine default options based on type
    let options: string[] | undefined;
    let settings: Question["settings"] | undefined;

    switch (type) {
      case "SINGLE_CHOICE":
      case "MULTIPLE_CHOICE":
      case "DROPDOWN":
        options = ["Option 1", "Option 2"];
        break;
      case "MATRIX":
      case "RANKING":
        options = ["Item 1", "Item 2", "Item 3"];
        settings = type === "MATRIX"
          ? { scaleMin: 1, scaleMax: 5, scaleLabels: { 1: "Poor", 5: "Excellent" } }
          : undefined;
        break;
      case "CONSTANT_SUM":
        options = ["Category 1", "Category 2", "Category 3"];
        settings = { total: 100 };
        break;
      case "IMAGE_CHOICE":
        options = ["Option 1", "Option 2"];
        settings = { imageUrls: {} };
        break;
      case "LIKERT":
        settings = {
          scale: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]
        };
        break;
      case "NPS":
        settings = { minLabel: "Not at all likely", maxLabel: "Extremely likely" };
        break;
      case "SLIDER":
        settings = { min: 0, max: 100, step: 1 };
        break;
      case "SCALE":
        settings = { scaleMin: 1, scaleMax: 10 };
        break;
    }

    const newQuestion: Question = {
      id: crypto.randomUUID(),
      type,
      title: "",
      required: type === "SECTION_HEADER" ? false : false,
      options,
      settings,
    };
    setQuestions([...questions, newQuestion]);
    setShowQuestionTypes(false);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const addOption = (questionId: string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId && q.options) {
          return { ...q, options: [...q.options, `Option ${q.options.length + 1}`] };
        }
        return q;
      })
    );
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId && q.options) {
          const newOptions = [...q.options];
          newOptions[optionIndex] = value;
          return { ...q, options: newOptions };
        }
        return q;
      })
    );
  };

  const deleteOption = (questionId: string, optionIndex: number) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId && q.options && q.options.length > 1) {
          return { ...q, options: q.options.filter((_, i) => i !== optionIndex) };
        }
        return q;
      })
    );
  };

  // Template Selection Screen
  if (!selectedTemplate) {
    return (
      <div className="min-h-screen bg-[#fbf5ea]">
        <header className="border-b border-[#dcd6f6]">
          <div className="container mx-auto px-6 py-4 flex items-center gap-4">
            <Link href="/" className="text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-['Syne'] font-semibold text-lg">Create New Survey</h1>
          </div>
        </header>

        <div className="container mx-auto px-6 py-8 max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="font-['Syne'] text-2xl font-bold mb-2">Choose a Template</h2>
            <p className="text-[#6b6b7b]">Start with a template or build from scratch</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {surveyTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => selectTemplate(template)}
                className="text-left p-6 rounded-xl border-2 border-[#dcd6f6] hover:border-[#c9c1ed] hover:bg-white/50 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-[#dcd6f6] flex items-center justify-center mb-4 group-hover:bg-[#c9c1ed] transition-colors">
                  {template.icon}
                </div>
                <h3 className="font-['Syne'] font-semibold text-lg mb-1">{template.name}</h3>
                <p className="text-sm text-[#6b6b7b]">{template.description}</p>
                {template.questions.length > 0 && (
                  <p className="text-xs text-[#6b6b7b] mt-2">
                    {template.questions.length} questions
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Survey Builder Screen
  return (
    <div className="min-h-screen bg-[#fbf5ea]">
      <header className="border-b border-[#dcd6f6] bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedTemplate(null)}
              className="text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-['Syne'] font-semibold text-lg">New Survey</h1>
              <p className="text-xs text-[#6b6b7b]">
                {selectedTemplate.id === "blank" ? "Starting from scratch" : `Using: ${selectedTemplate.name}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveSurvey(false)}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Draft
            </Button>
            <Button
              size="sm"
              onClick={() => saveSurvey(true)}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Publish
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-3xl">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <Card className="mb-4">
          <CardContent className="p-6">
            <Input
              placeholder="Survey Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-['Syne'] font-semibold border-0 px-0 focus-visible:ring-0 bg-transparent placeholder:text-[#6b6b7b]/50"
            />
            <Textarea
              placeholder="Add a description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 border-0 px-0 focus-visible:ring-0 bg-transparent resize-none placeholder:text-[#6b6b7b]/50 min-h-[60px]"
            />
          </CardContent>
        </Card>

        {/* Settings Section */}
        <Card className="mb-8">
          <CardContent className="p-4">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#dcd6f6] flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium text-sm">Survey Settings</div>
                  <div className="text-xs text-[#6b6b7b]">
                    {accessTypeOptions.find(o => o.value === accessType)?.label} • {isAnonymous ? "Anonymous" : "Identified responses"}
                  </div>
                </div>
              </div>
              <span className="text-[#6b6b7b] text-sm">{showSettings ? "Hide" : "Show"}</span>
            </button>

            {showSettings && (
              <div className="mt-4 pt-4 border-t border-[#dcd6f6] space-y-6">
                {/* Access Type */}
                <div>
                  <label className="text-sm font-medium mb-3 block">Who can respond?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {accessTypeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setAccessType(option.value)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          accessType === option.value
                            ? "border-[#1a1a2e] bg-[#dcd6f6]/30"
                            : "border-[#dcd6f6] hover:border-[#c9c1ed]"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {option.icon}
                          <span className="font-medium text-sm">{option.label}</span>
                        </div>
                        <p className="text-xs text-[#6b6b7b]">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Anonymous Toggle */}
                <div>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#dcd6f6] flex items-center justify-center">
                        <EyeOff className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">Anonymous Responses</div>
                        <div className="text-xs text-[#6b6b7b]">
                          {isAnonymous
                            ? "Respondent identities will not be collected"
                            : "You'll be able to see who responded"}
                        </div>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[#dcd6f6] rounded-full peer peer-checked:bg-[#1a1a2e] transition-colors"></div>
                      <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-5 transition-transform"></div>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {questions.map((question, index) => (
                <SortableQuestion
                  key={question.id}
                  question={question}
                  index={index}
                  allQuestions={questions}
                  questionTypes={questionTypes}
                  updateQuestion={updateQuestion}
                  deleteQuestion={deleteQuestion}
                  addOption={addOption}
                  updateOption={updateOption}
                  deleteOption={deleteOption}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="mt-6">
          {showQuestionTypes ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-['Syne'] font-medium">Choose question type</span>
                  <button
                    onClick={() => setShowQuestionTypes(false)}
                    className="text-[#6b6b7b] hover:text-[#1a1a2e]"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {questionTypes.map((qt, index) => (
                    <QuestionTypeCard
                      key={qt.type}
                      qt={qt}
                      index={index}
                      onSelect={() => addQuestion(qt.type)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <button
              onClick={() => setShowQuestionTypes(true)}
              className="w-full py-4 border-2 border-dashed border-[#dcd6f6] rounded-lg text-[#6b6b7b] hover:border-[#c9c1ed] hover:text-[#1a1a2e] hover:bg-[#dcd6f6]/10 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Question
            </button>
          )}
        </div>

        {questions.length === 0 && !showQuestionTypes && (
          <div className="text-center py-12 text-[#6b6b7b]">
            <p className="mb-2">Your survey is empty</p>
            <p className="text-sm">Click "Add Question" to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
