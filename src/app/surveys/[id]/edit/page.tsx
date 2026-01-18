"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
  Link as LinkIcon,
  Lock,
  Settings,
  EyeOff,
  GitBranch,
  X,
  LayoutList,
  Grid3X3,
  Phone,
  Clock,
  ChevronDown,
  ToggleLeft,
  Image,
  Gauge,
  ThumbsUp,
  SlidersHorizontal,
  ListOrdered,
  PieChart,
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
  | "PHONE"
  | "TIME"
  | "DROPDOWN"
  | "YES_NO"
  | "IMAGE_CHOICE"
  | "NPS"
  | "LIKERT"
  | "SLIDER"
  | "RANKING"
  | "CONSTANT_SUM";

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
  logic: "all" | "any";
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

const questionTypes: {
  type: QuestionType;
  label: string;
  icon: React.ReactNode;
  description: string;
  category?: string;
}[] = [
  // Display
  { type: "SECTION_HEADER", label: "Section Header", icon: <LayoutList className="w-4 h-4" />, description: "Section break", category: "Display" },
  // Text inputs
  { type: "SHORT_TEXT", label: "Short Text", icon: <Type className="w-4 h-4" />, description: "Single line text", category: "Text" },
  { type: "LONG_TEXT", label: "Long Text", icon: <AlignLeft className="w-4 h-4" />, description: "Multi-line text", category: "Text" },
  { type: "EMAIL", label: "Email", icon: <Mail className="w-4 h-4" />, description: "Email address", category: "Text" },
  { type: "PHONE", label: "Phone", icon: <Phone className="w-4 h-4" />, description: "Phone number", category: "Text" },
  { type: "NUMBER", label: "Number", icon: <Hash className="w-4 h-4" />, description: "Numeric input", category: "Text" },
  // Date/Time
  { type: "DATE", label: "Date", icon: <Calendar className="w-4 h-4" />, description: "Date picker", category: "Date/Time" },
  { type: "TIME", label: "Time", icon: <Clock className="w-4 h-4" />, description: "Time picker", category: "Date/Time" },
  // Choice
  { type: "SINGLE_CHOICE", label: "Single Choice", icon: <CircleDot className="w-4 h-4" />, description: "Pick one option", category: "Choice" },
  { type: "MULTIPLE_CHOICE", label: "Multiple Choice", icon: <CheckSquare className="w-4 h-4" />, description: "Pick multiple", category: "Choice" },
  { type: "DROPDOWN", label: "Dropdown", icon: <ChevronDown className="w-4 h-4" />, description: "Select from list", category: "Choice" },
  { type: "YES_NO", label: "Yes/No", icon: <ToggleLeft className="w-4 h-4" />, description: "Simple toggle", category: "Choice" },
  { type: "IMAGE_CHOICE", label: "Image Choice", icon: <Image className="w-4 h-4" />, description: "Pick from images", category: "Choice" },
  // Rating/Scale
  { type: "RATING", label: "Rating", icon: <Star className="w-4 h-4" />, description: "Star rating", category: "Rating" },
  { type: "SCALE", label: "Scale", icon: <SlidersHorizontal className="w-4 h-4" />, description: "Linear scale", category: "Rating" },
  { type: "NPS", label: "NPS", icon: <Gauge className="w-4 h-4" />, description: "Net Promoter Score", category: "Rating" },
  { type: "LIKERT", label: "Likert", icon: <ThumbsUp className="w-4 h-4" />, description: "Opinion scale", category: "Rating" },
  { type: "SLIDER", label: "Slider", icon: <SlidersHorizontal className="w-4 h-4" />, description: "Visual slider", category: "Rating" },
  // Advanced
  { type: "MATRIX", label: "Matrix / Grid", icon: <Grid3X3 className="w-4 h-4" />, description: "Rate multiple items", category: "Advanced" },
  { type: "RANKING", label: "Ranking", icon: <ListOrdered className="w-4 h-4" />, description: "Drag to order", category: "Advanced" },
  { type: "CONSTANT_SUM", label: "Constant Sum", icon: <PieChart className="w-4 h-4" />, description: "Distribute points", category: "Advanced" },
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

  const previousQuestions = allQuestions.slice(0, index);
  const skipLogic = question.settings?.skipLogic;

  const toggleSkipLogic = () => {
    if (skipLogic?.enabled) {
      updateQuestion(question.id, {
        settings: { ...question.settings, skipLogic: undefined },
      });
      setShowSkipLogic(false);
    } else {
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

            {question.type === "SECTION_HEADER" && (
              <div className="mt-4 p-4 border-l-4 border-[#FF4F01] bg-[#fff8f0] rounded-r-lg">
                <p className="text-sm text-[#6b6b7b] italic">
                  This section header will display as a visual break in the survey.
                  No response required from respondents.
                </p>
              </div>
            )}

            {question.type === "MATRIX" && (
              <div className="mt-4 space-y-4">
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

            {/* Phone preview */}
            {question.type === "PHONE" && (
              <div className="mt-4">
                <div className="flex items-center gap-2 p-3 border border-[#dcd6f6] rounded-lg bg-white/50">
                  <Phone className="w-4 h-4 text-[#6b6b7b]" />
                  <span className="text-[#6b6b7b] text-sm">+1 (555) 123-4567</span>
                </div>
              </div>
            )}

            {/* Time preview */}
            {question.type === "TIME" && (
              <div className="mt-4">
                <div className="flex items-center gap-2 p-3 border border-[#dcd6f6] rounded-lg bg-white/50">
                  <Clock className="w-4 h-4 text-[#6b6b7b]" />
                  <span className="text-[#6b6b7b] text-sm">09:00 AM</span>
                </div>
              </div>
            )}

            {/* Dropdown preview */}
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

            {/* Yes/No preview */}
            {question.type === "YES_NO" && (
              <div className="mt-4 flex gap-4">
                <div className="flex items-center gap-2 px-4 py-2 border-2 border-[#dcd6f6] rounded-lg">
                  <div className="w-4 h-4 rounded-full border-2 border-[#dcd6f6]" />
                  <span className="text-sm">Yes</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 border-2 border-[#dcd6f6] rounded-lg">
                  <div className="w-4 h-4 rounded-full border-2 border-[#dcd6f6]" />
                  <span className="text-sm">No</span>
                </div>
              </div>
            )}

            {/* NPS preview */}
            {question.type === "NPS" && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={question.settings?.minLabel || "Not at all likely"}
                    onChange={(e) => updateQuestion(question.id, {
                      settings: { ...question.settings, minLabel: e.target.value }
                    })}
                    className="flex-1 h-8 text-sm"
                    placeholder="Min label"
                  />
                  <span className="text-[#6b6b7b]">to</span>
                  <Input
                    value={question.settings?.maxLabel || "Extremely likely"}
                    onChange={(e) => updateQuestion(question.id, {
                      settings: { ...question.settings, maxLabel: e.target.value }
                    })}
                    className="flex-1 h-8 text-sm"
                    placeholder="Max label"
                  />
                </div>
                <div className="flex justify-between">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <div
                      key={n}
                      className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium border ${
                        n <= 6 ? "border-red-200 bg-red-50" :
                        n <= 8 ? "border-yellow-200 bg-yellow-50" :
                        "border-green-200 bg-green-50"
                      }`}
                    >
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Likert preview */}
            {question.type === "LIKERT" && (
              <div className="mt-4 space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Scale options:</label>
                  {(question.settings?.scale || ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]).map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-6 text-center text-xs text-[#6b6b7b]">{i + 1}</span>
                      <Input
                        value={item}
                        onChange={(e) => {
                          const newScale = [...(question.settings?.scale || [])];
                          newScale[i] = e.target.value;
                          updateQuestion(question.id, {
                            settings: { ...question.settings, scale: newScale }
                          });
                        }}
                        className="flex-1 h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between gap-2 p-3 bg-white rounded-lg border border-[#dcd6f6]">
                  {(question.settings?.scale || ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]).map((label, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-4 h-4 rounded-full border-2 border-[#dcd6f6]" />
                      <span className="text-xs text-[#6b6b7b] text-center">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Slider preview */}
            {question.type === "SLIDER" && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Min:</label>
                    <Input
                      type="number"
                      value={question.settings?.min || 0}
                      onChange={(e) => updateQuestion(question.id, {
                        settings: { ...question.settings, min: parseInt(e.target.value) }
                      })}
                      className="w-20 h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Max:</label>
                    <Input
                      type="number"
                      value={question.settings?.max || 100}
                      onChange={(e) => updateQuestion(question.id, {
                        settings: { ...question.settings, max: parseInt(e.target.value) }
                      })}
                      className="w-20 h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Step:</label>
                    <Input
                      type="number"
                      value={question.settings?.step || 1}
                      onChange={(e) => updateQuestion(question.id, {
                        settings: { ...question.settings, step: parseInt(e.target.value) }
                      })}
                      className="w-20 h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-[#dcd6f6]">
                  <input
                    type="range"
                    min={question.settings?.min || 0}
                    max={question.settings?.max || 100}
                    step={question.settings?.step || 1}
                    className="w-full"
                    disabled
                  />
                  <div className="flex justify-between text-xs text-[#6b6b7b] mt-1">
                    <span>{question.settings?.min || 0}</span>
                    <span>{question.settings?.max || 100}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Scale preview */}
            {question.type === "SCALE" && (
              <div className="mt-4 space-y-3">
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
                    value={question.settings?.scaleMax || 10}
                    onChange={(e) => updateQuestion(question.id, {
                      settings: { ...question.settings, scaleMax: parseInt(e.target.value) }
                    })}
                    className="text-sm px-2 py-1 border rounded"
                  >
                    {[5, 7, 10].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="flex justify-between gap-1">
                  {Array.from({ length: (question.settings?.scaleMax || 10) - (question.settings?.scaleMin || 1) + 1 }, (_, i) => (
                    <div
                      key={i}
                      className="flex-1 h-10 rounded border-2 border-[#dcd6f6] flex items-center justify-center text-sm font-medium"
                    >
                      {(question.settings?.scaleMin || 1) + i}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ranking preview */}
            {question.type === "RANKING" && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-[#6b6b7b] mb-2">Respondents will drag to rank these items:</p>
                {question.options?.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-[#6b6b7b]" />
                    <span className="w-6 h-6 rounded-full bg-[#dcd6f6] flex items-center justify-center text-xs font-medium">
                      {optionIndex + 1}
                    </span>
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
                  Add item
                </button>
              </div>
            )}

            {/* Constant Sum preview */}
            {question.type === "CONSTANT_SUM" && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 p-3 bg-[#f5f3ff] rounded-lg">
                  <span className="text-sm font-medium">Total points to distribute:</span>
                  <Input
                    type="number"
                    value={question.settings?.total || 100}
                    onChange={(e) => updateQuestion(question.id, {
                      settings: { ...question.settings, total: parseInt(e.target.value) }
                    })}
                    className="w-24 h-8 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  {question.options?.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center gap-2">
                      <Input
                        value={option}
                        onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                        className="flex-1 h-8 text-sm"
                      />
                      <div className="w-20 h-8 border border-[#dcd6f6] rounded flex items-center justify-center text-sm text-[#6b6b7b]">
                        0
                      </div>
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
                    Add category
                  </button>
                </div>
                <p className="text-xs text-[#6b6b7b]">
                  Respondents must allocate exactly {question.settings?.total || 100} points across all categories.
                </p>
              </div>
            )}

            {/* Image Choice preview */}
            {question.type === "IMAGE_CHOICE" && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-[#6b6b7b] mb-2">Add images for each option (respondents select one):</p>
                {question.options?.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <div className="w-16 h-16 border-2 border-dashed border-[#dcd6f6] rounded-lg flex items-center justify-center bg-white">
                      <Image className="w-6 h-6 text-[#6b6b7b]" />
                    </div>
                    <Input
                      value={option}
                      onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                      className="flex-1 h-8 text-sm"
                      placeholder="Image label"
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
                  Add image option
                </button>
              </div>
            )}

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

export default function EditSurveyPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showQuestionTypes, setShowQuestionTypes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessType, setAccessType] = useState<AccessType>("UNLISTED");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

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

  // Fetch existing survey data
  useEffect(() => {
    async function fetchSurvey() {
      try {
        const response = await fetch(`/api/surveys/${params.id}`);
        if (!response.ok) {
          throw new Error("Survey not found");
        }
        const data = await response.json();

        // Check if survey is published - can't edit published surveys
        if (data.published) {
          setIsPublished(true);
          setError("Published surveys cannot be edited. Duplicate this survey to create an editable draft.");
        }

        setTitle(data.title);
        setDescription(data.description || "");
        setAccessType(data.accessType || "UNLISTED");
        setIsAnonymous(data.isAnonymous ?? true);

        // Map questions to local format
        setQuestions(
          data.questions.map((q: { id: string; type: QuestionType; title: string; description?: string; required: boolean; options?: string[]; settings?: Question["settings"] }) => ({
            id: q.id,
            type: q.type as QuestionType,
            title: q.title,
            description: q.description,
            required: q.required,
            options: q.options,
            settings: q.settings,
          }))
        );
      } catch {
        setError("Failed to load survey");
      } finally {
        setLoading(false);
      }
    }

    fetchSurvey();
  }, [params.id]);

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
      const response = await fetch(`/api/surveys/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          published: publish,
          accessType,
          isAnonymous,
          questions: questions.map((q, index) => ({
            id: q.id,
            type: q.type,
            title: q.title,
            description: q.description,
            required: q.required,
            options: q.options,
            settings: q.settings,
            order: index,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save survey");
      }

      router.push(`/surveys/${params.id}`);
    } catch {
      setError("Failed to save survey. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = (type: QuestionType) => {
    let options: string[] | undefined;
    let settings: Question["settings"] | undefined;

    switch (type) {
      case "SINGLE_CHOICE":
      case "MULTIPLE_CHOICE":
        options = ["Option 1", "Option 2"];
        break;
      case "DROPDOWN":
        options = ["Option 1", "Option 2", "Option 3"];
        break;
      case "IMAGE_CHOICE":
        options = ["Image 1", "Image 2", "Image 3"];
        settings = { imageUrls: {} };
        break;
      case "MATRIX":
        options = ["Item 1", "Item 2", "Item 3"];
        settings = { scaleMin: 1, scaleMax: 5, scaleLabels: { 1: "Poor", 5: "Excellent" } };
        break;
      case "RANKING":
        options = ["Item 1", "Item 2", "Item 3"];
        break;
      case "CONSTANT_SUM":
        options = ["Category 1", "Category 2", "Category 3"];
        settings = { total: 100 };
        break;
      case "SCALE":
        settings = { scaleMin: 1, scaleMax: 10, scaleLabels: { 1: "Low", 10: "High" } };
        break;
      case "NPS":
        settings = { minLabel: "Not at all likely", maxLabel: "Extremely likely" };
        break;
      case "LIKERT":
        settings = { scale: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] };
        break;
      case "SLIDER":
        settings = { min: 0, max: 100, step: 1 };
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf5ea] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#6b6b7b]" />
      </div>
    );
  }

  if (isPublished) {
    return (
      <div className="min-h-screen bg-[#fbf5ea]">
        <header className="border-b border-[#dcd6f6]">
          <div className="container mx-auto px-6 py-4 flex items-center gap-4">
            <Link href={`/surveys/${params.id}`} className="text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-['Syne'] font-semibold text-lg">Edit Survey</h1>
          </div>
        </header>
        <div className="container mx-auto px-6 py-16 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="font-['Syne'] text-xl font-bold mb-2">Cannot Edit Published Survey</h2>
          <p className="text-[#6b6b7b] mb-6">
            This survey has already been published and cannot be modified to protect the integrity of collected responses.
          </p>
          <p className="text-[#6b6b7b] mb-6 text-sm">
            To make changes, duplicate this survey to create an editable draft copy.
          </p>
          <Link href={`/surveys/${params.id}`}>
            <Button>Back to Survey</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbf5ea]">
      <header className="border-b border-[#dcd6f6] bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/surveys/${params.id}`}
              className="text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-['Syne'] font-semibold text-lg">Edit Survey</h1>
              <p className="text-xs text-[#6b6b7b]">Draft</p>
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
                    <motion.button
                      key={qt.type}
                      onClick={() => addQuestion(qt.type)}
                      className="flex flex-col items-center gap-2 p-4 rounded-lg border border-[#dcd6f6] hover:border-[#c9c1ed] hover:bg-[#dcd6f6]/20 text-center"
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
