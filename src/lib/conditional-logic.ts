/**
 * Conditional Logic Utilities
 *
 * Provides answer piping and branch logic evaluation for surveys.
 */

// Re-export types for use across the application
export interface SkipCondition {
  questionId: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";
  value: string;
}

export interface SkipLogic {
  enabled: boolean;
  conditions: SkipCondition[];
  logic: "all" | "any";
}

export interface BranchRule {
  conditions: SkipCondition[];
  logic: "all" | "any";
  action: { type: "jump"; targetQuestionId: string } | { type: "end" };
}

export interface BranchLogic {
  enabled: boolean;
  rules: BranchRule[];
  defaultAction?: "next" | "end";
}

/**
 * Carry-forward configuration for dynamic option filtering.
 * Allows follow-up questions to show only options that were selected
 * in a previous question.
 */
export interface CarryForward {
  enabled: boolean;
  sourceQuestionId: string;
  mode: "selected" | "not_selected" | "all";
}

/**
 * Option source configuration - determines where a question's options come from.
 */
export interface OptionSource {
  type: "static" | "carry_forward";
  carryForward?: CarryForward;
}

export interface Question {
  id: string;
  type: string;
  title: string;
  description?: string;
  required: boolean;
  options?: string[];
  settings?: {
    skipLogic?: SkipLogic;
    branchLogic?: BranchLogic;
    optionSource?: OptionSource;
    [key: string]: unknown;
  };
}

/**
 * Pipes (inserts) previous answers into text using {{questionId}} syntax.
 *
 * @param text - The text containing {{questionId}} placeholders
 * @param questions - Array of questions to lookup titles for display
 * @param answers - Record of questionId -> answer value
 * @returns Text with placeholders replaced by actual answers
 *
 * @example
 * // If question "q1" was answered with "John"
 * pipeAnswers("Hello {{q1}}!", questions, { q1: "John" })
 * // Returns: "Hello John!"
 */
export function pipeAnswers(
  text: string,
  questions: Question[],
  answers: Record<string, unknown>
): string {
  if (!text) return text;

  return text.replace(/\{\{([^}]+)\}\}/g, (match, questionId) => {
    const answer = answers[questionId.trim()];

    if (answer === undefined || answer === null || answer === "") {
      // Find question title for better UX
      const question = questions.find(q => q.id === questionId.trim());
      const questionName = question?.title?.substring(0, 30) || questionId;
      return `[${questionName}...]`;
    }

    // Handle different answer types
    if (Array.isArray(answer)) {
      // Multiple choice - join with commas
      return answer.join(", ");
    }

    if (typeof answer === "object") {
      // Complex types like matrix, address, etc.
      if ("street" in answer) {
        // Address type
        const addr = answer as Record<string, string>;
        const parts = [addr.street, addr.city, addr.state, addr.zip, addr.country].filter(Boolean);
        return parts.join(", ");
      }
      // Matrix or other object types - stringify nicely
      return JSON.stringify(answer);
    }

    return String(answer);
  });
}

/**
 * Checks if text contains any answer piping placeholders.
 */
export function hasAnswerPiping(text: string): boolean {
  if (!text) return false;
  return /\{\{[^}]+\}\}/.test(text);
}

/**
 * Extracts all question IDs referenced in piping placeholders.
 */
export function extractPipedQuestionIds(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
  return matches.map(match => match.replace(/\{\{|\}\}/g, "").trim());
}

/**
 * Evaluates a single condition against current answers.
 */
export function evaluateCondition(
  condition: SkipCondition,
  answers: Record<string, unknown>
): boolean {
  const answer = answers[condition.questionId];

  // Handle empty checks first
  if (condition.operator === "is_empty") {
    return answer === undefined || answer === null || answer === "" ||
           (Array.isArray(answer) && answer.length === 0);
  }

  if (condition.operator === "is_not_empty") {
    return answer !== undefined && answer !== null && answer !== "" &&
           (!Array.isArray(answer) || answer.length > 0);
  }

  // For other operators, if no answer, condition fails
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
}

/**
 * Evaluates skip logic (show/hide conditions) for a question.
 * Returns true if the question should be shown.
 */
export function evaluateSkipLogic(
  skipLogic: SkipLogic | undefined,
  answers: Record<string, unknown>
): boolean {
  if (!skipLogic?.enabled || !skipLogic.conditions?.length) {
    return true; // No skip logic, always show
  }

  const results = skipLogic.conditions.map(condition =>
    evaluateCondition(condition, answers)
  );

  return skipLogic.logic === "any"
    ? results.some(r => r)
    : results.every(r => r);
}

/**
 * Evaluates branch logic for a question and returns the action to take.
 *
 * @param branchLogic - The branch logic configuration
 * @param answers - Current answers
 * @returns The action to take: { type: "next" }, { type: "end" }, or { type: "jump", targetQuestionId: string }
 */
export function evaluateBranchLogic(
  branchLogic: BranchLogic | undefined,
  answers: Record<string, unknown>
): { type: "next" } | { type: "end" } | { type: "jump"; targetQuestionId: string } {
  if (!branchLogic?.enabled || !branchLogic.rules?.length) {
    return { type: "next" }; // No branch logic, go to next question
  }

  // Check each rule in order
  for (const rule of branchLogic.rules) {
    const results = rule.conditions.map(condition =>
      evaluateCondition(condition, answers)
    );

    const ruleMatches = rule.logic === "any"
      ? results.some(r => r)
      : results.every(r => r);

    if (ruleMatches) {
      return rule.action;
    }
  }

  // No rules matched, use default action
  if (branchLogic.defaultAction === "end") {
    return { type: "end" };
  }

  return { type: "next" };
}

/**
 * Finds the next question index based on skip logic and branch logic.
 *
 * @param questions - All questions in the survey
 * @param currentIndex - Current question index
 * @param answers - Current answers
 * @returns Next question index, or -1 if should submit (end of survey)
 */
export function findNextQuestion(
  questions: Question[],
  currentIndex: number,
  answers: Record<string, unknown>
): number {
  const currentQuestion = questions[currentIndex];

  // First, check if there's branch logic on the current question
  const branchLogic = currentQuestion?.settings?.branchLogic;
  const branchAction = evaluateBranchLogic(branchLogic, answers);

  if (branchAction.type === "end") {
    return -1; // End survey
  }

  if (branchAction.type === "jump") {
    // Find the target question index
    const targetIndex = questions.findIndex(q => q.id === branchAction.targetQuestionId);
    if (targetIndex !== -1) {
      // Check if target question should be shown based on its skip logic
      const targetQuestion = questions[targetIndex];
      if (evaluateSkipLogic(targetQuestion.settings?.skipLogic, answers)) {
        return targetIndex;
      }
      // Target question is skipped, continue from there
      return findNextVisibleQuestion(questions, targetIndex, answers);
    }
  }

  // Default: find next visible question
  return findNextVisibleQuestion(questions, currentIndex, answers);
}

/**
 * Finds the next visible question starting from a given index.
 * Only considers skip logic (show/hide), not branch logic.
 */
export function findNextVisibleQuestion(
  questions: Question[],
  fromIndex: number,
  answers: Record<string, unknown>
): number {
  for (let i = fromIndex + 1; i < questions.length; i++) {
    if (evaluateSkipLogic(questions[i].settings?.skipLogic, answers)) {
      return i;
    }
  }
  return -1; // No more visible questions
}

/**
 * Finds the previous visible question.
 */
export function findPrevVisibleQuestion(
  questions: Question[],
  fromIndex: number,
  answers: Record<string, unknown>
): number {
  for (let i = fromIndex - 1; i >= 0; i--) {
    if (evaluateSkipLogic(questions[i].settings?.skipLogic, answers)) {
      return i;
    }
  }
  return -1; // No previous visible questions
}

/**
 * Checks if a question should be shown based on skip logic.
 */
export function shouldShowQuestion(
  question: Question,
  answers: Record<string, unknown>
): boolean {
  return evaluateSkipLogic(question.settings?.skipLogic, answers);
}

/**
 * Gets all visible questions based on current answers.
 */
export function getVisibleQuestions(
  questions: Question[],
  answers: Record<string, unknown>
): Question[] {
  return questions.filter(q => shouldShowQuestion(q, answers));
}

/**
 * Validates that all referenced question IDs in branch logic exist.
 */
export function validateBranchLogic(
  branchLogic: BranchLogic | undefined,
  allQuestionIds: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!branchLogic?.enabled) {
    return { valid: true, errors: [] };
  }

  for (const rule of branchLogic.rules || []) {
    // Check condition question IDs
    for (const condition of rule.conditions || []) {
      if (!allQuestionIds.includes(condition.questionId)) {
        errors.push(`Condition references non-existent question: ${condition.questionId}`);
      }
    }

    // Check jump target
    if (rule.action.type === "jump" && !allQuestionIds.includes(rule.action.targetQuestionId)) {
      errors.push(`Jump target question does not exist: ${rule.action.targetQuestionId}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Filters options for a question based on carry-forward configuration.
 *
 * This enables follow-up questions to only show options that were selected
 * (or not selected) in a previous question.
 *
 * @param question - The question whose options should be filtered
 * @param questions - All questions in the survey (to find source question)
 * @param answers - Current answers
 * @returns Filtered array of options
 *
 * @example
 * // Question 1: "Which tools do you use?" - User selects ["Figma", "Sketch"]
 * // Question 2: Has carryForward from Q1 with mode "selected"
 * filterOptions(question2, questions, answers)
 * // Returns: ["Figma", "Sketch"] (only the selected options)
 */
export function filterOptions(
  question: Question,
  questions: Question[],
  answers: Record<string, unknown>
): string[] {
  const baseOptions = question.options || [];
  const optionSource = question.settings?.optionSource;

  // If no carry-forward configured or disabled, return all options
  if (!optionSource || optionSource.type !== "carry_forward") {
    return baseOptions;
  }

  const carryForward = optionSource.carryForward;
  if (!carryForward?.enabled || !carryForward.sourceQuestionId) {
    return baseOptions;
  }

  // Find the source question
  const sourceQuestion = questions.find(q => q.id === carryForward.sourceQuestionId);
  if (!sourceQuestion) {
    return baseOptions;
  }

  // Get the answer from source question
  const sourceAnswer = answers[carryForward.sourceQuestionId];

  // Normalize to array (handle both single and multiple choice answers)
  const selectedOptions: string[] = Array.isArray(sourceAnswer)
    ? sourceAnswer.filter((v): v is string => typeof v === "string")
    : typeof sourceAnswer === "string"
      ? [sourceAnswer]
      : [];

  // Get source question options as the pool
  const sourceOptions = sourceQuestion.options || [];

  switch (carryForward.mode) {
    case "selected":
      // Only show options that were selected in source question
      // Filter to ensure we only include valid options from source
      return selectedOptions.filter(opt => sourceOptions.includes(opt));

    case "not_selected":
      // Only show options that were NOT selected in source question
      return sourceOptions.filter(opt => !selectedOptions.includes(opt));

    case "all":
    default:
      // Show all options from source question (useful for copying options)
      return sourceOptions;
  }
}

/**
 * Checks if a question has carry-forward configured.
 */
export function hasCarryForward(question: Question): boolean {
  const optionSource = question.settings?.optionSource;
  return (
    optionSource?.type === "carry_forward" &&
    optionSource.carryForward?.enabled === true &&
    !!optionSource.carryForward?.sourceQuestionId
  );
}

/**
 * Gets the source question ID for carry-forward, if configured.
 */
export function getCarryForwardSource(question: Question): string | null {
  if (!hasCarryForward(question)) {
    return null;
  }
  return question.settings?.optionSource?.carryForward?.sourceQuestionId || null;
}

/**
 * Validates carry-forward configuration.
 */
export function validateCarryForward(
  question: Question,
  allQuestions: Question[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const optionSource = question.settings?.optionSource;

  if (!optionSource || optionSource.type !== "carry_forward") {
    return { valid: true, errors: [] };
  }

  const carryForward = optionSource.carryForward;
  if (!carryForward?.enabled) {
    return { valid: true, errors: [] };
  }

  if (!carryForward.sourceQuestionId) {
    errors.push("Carry-forward source question is not specified");
    return { valid: false, errors };
  }

  const sourceQuestion = allQuestions.find(q => q.id === carryForward.sourceQuestionId);
  if (!sourceQuestion) {
    errors.push(`Carry-forward source question does not exist: ${carryForward.sourceQuestionId}`);
    return { valid: false, errors };
  }

  // Ensure source question has options
  if (!sourceQuestion.options || sourceQuestion.options.length === 0) {
    errors.push("Carry-forward source question has no options");
    return { valid: false, errors };
  }

  // Ensure source question comes before this question
  const sourceIndex = allQuestions.findIndex(q => q.id === carryForward.sourceQuestionId);
  const currentIndex = allQuestions.findIndex(q => q.id === question.id);
  if (sourceIndex >= currentIndex) {
    errors.push("Carry-forward source question must come before the current question");
  }

  return { valid: errors.length === 0, errors };
}
