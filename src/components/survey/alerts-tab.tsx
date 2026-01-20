"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Loader2,
  Plus,
  X,
  Trash2,
  Mail,
  MessageSquare,
  Globe,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Settings,
  Zap,
  TestTube,
  Eye,
} from "lucide-react";

interface Question {
  id: string;
  title: string;
  type: string;
}

interface AlertTrigger {
  id: string;
  questionId: string;
  operator: string;
  value: unknown;
  question?: Question | null;
}

interface Alert {
  id: string;
  name: string;
  channel: "EMAIL" | "SLACK" | "WEBHOOK";
  enabled: boolean;
  config: Record<string, unknown>;
  triggers: AlertTrigger[];
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  events: string[];
  secret?: string;
  recentDeliveries?: {
    id: string;
    eventType: string;
    responseCode: number | null;
    error: string | null;
    deliveredAt: string;
  }[];
  _count?: { deliveries: number };
}

interface AlertsTabProps {
  surveyId: string;
  questions: Question[];
}

const OPERATORS = [
  { value: "EQUALS", label: "Equals" },
  { value: "NOT_EQUALS", label: "Does not equal" },
  { value: "GREATER_THAN", label: "Greater than" },
  { value: "LESS_THAN", label: "Less than" },
  { value: "CONTAINS", label: "Contains" },
  { value: "IS_EMPTY", label: "Is empty" },
];

const CHANNEL_ICONS = {
  EMAIL: Mail,
  SLACK: MessageSquare,
  WEBHOOK: Globe,
};

const CHANNEL_COLORS = {
  EMAIL: "bg-blue-100 text-blue-700",
  SLACK: "bg-purple-100 text-purple-700",
  WEBHOOK: "bg-green-100 text-green-700",
};

export function AlertsTab({ surveyId, questions }: AlertsTabProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state for new alert
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [alertName, setAlertName] = useState("");
  const [alertChannel, setAlertChannel] = useState<"EMAIL" | "SLACK" | "WEBHOOK">("EMAIL");
  const [alertConfig, setAlertConfig] = useState<Record<string, unknown>>({ emails: [""] });
  const [alertTriggers, setAlertTriggers] = useState<Array<{
    questionId: string;
    operator: string;
    value: string;
  }>>([{ questionId: "", operator: "EQUALS", value: "" }]);
  const [savingAlert, setSavingAlert] = useState(false);

  // Form state for new webhook
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [webhookName, setWebhookName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>(["RESPONSE_SUBMITTED"]);
  const [savingWebhook, setSavingWebhook] = useState(false);

  // Expanded sections
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [alertsRes, webhooksRes] = await Promise.all([
        fetch(`/api/surveys/${surveyId}/alerts`),
        fetch(`/api/surveys/${surveyId}/webhooks`),
      ]);

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.alerts || []);
      }

      if (webhooksRes.ok) {
        const webhooksData = await webhooksRes.json();
        setWebhooks(webhooksData.webhooks || []);
      }
    } catch (err) {
      setError("Failed to load alerts and webhooks");
    } finally {
      setLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateAlert = async () => {
    if (!alertName.trim()) {
      setError("Alert name is required");
      return;
    }

    const validTriggers = alertTriggers.filter(
      (t) => t.questionId && (t.operator === "IS_EMPTY" || t.value)
    );
    if (validTriggers.length === 0) {
      setError("At least one valid trigger is required");
      return;
    }

    setSavingAlert(true);
    setError(null);

    try {
      const response = await fetch(`/api/surveys/${surveyId}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: alertName,
          channel: alertChannel,
          config: alertConfig,
          triggers: validTriggers.map((t) => ({
            ...t,
            value: parseValue(t.value, t.operator),
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create alert");
      }

      setSuccess("Alert created successfully");
      setShowAlertForm(false);
      resetAlertForm();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create alert");
    } finally {
      setSavingAlert(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!webhookName.trim() || !webhookUrl.trim()) {
      setError("Webhook name and URL are required");
      return;
    }

    setSavingWebhook(true);
    setError(null);

    try {
      const response = await fetch(`/api/surveys/${surveyId}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: webhookName,
          url: webhookUrl,
          events: webhookEvents,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create webhook");
      }

      setSuccess(`Webhook created. Secret: ${data.webhook.secret} (save this!)`);
      setShowWebhookForm(false);
      resetWebhookForm();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create webhook");
    } finally {
      setSavingWebhook(false);
    }
  };

  const toggleAlertEnabled = async (alertId: string, enabled: boolean) => {
    try {
      await fetch(`/api/surveys/${surveyId}/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      fetchData();
    } catch (err) {
      setError("Failed to update alert");
    }
  };

  const toggleWebhookEnabled = async (webhookId: string, enabled: boolean) => {
    try {
      await fetch(`/api/surveys/${surveyId}/webhooks/${webhookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      fetchData();
    } catch (err) {
      setError("Failed to update webhook");
    }
  };

  const deleteAlert = async (alertId: string) => {
    if (!confirm("Delete this alert?")) return;
    try {
      await fetch(`/api/surveys/${surveyId}/alerts/${alertId}`, {
        method: "DELETE",
      });
      fetchData();
    } catch (err) {
      setError("Failed to delete alert");
    }
  };

  const deleteWebhook = async (webhookId: string) => {
    if (!confirm("Delete this webhook?")) return;
    try {
      await fetch(`/api/surveys/${surveyId}/webhooks/${webhookId}`, {
        method: "DELETE",
      });
      fetchData();
    } catch (err) {
      setError("Failed to delete webhook");
    }
  };

  const testWebhook = async (webhookId: string) => {
    try {
      const response = await fetch(`/api/surveys/${surveyId}/webhooks/${webhookId}`, {
        method: "POST",
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess("Test webhook sent successfully");
      } else {
        setError(data.error || "Test failed");
      }
    } catch (err) {
      setError("Failed to send test webhook");
    }
  };

  const resetAlertForm = () => {
    setAlertName("");
    setAlertChannel("EMAIL");
    setAlertConfig({ emails: [""] });
    setAlertTriggers([{ questionId: "", operator: "EQUALS", value: "" }]);
  };

  const resetWebhookForm = () => {
    setWebhookName("");
    setWebhookUrl("");
    setWebhookEvents(["RESPONSE_SUBMITTED"]);
  };

  const parseValue = (value: string, operator: string): unknown => {
    if (operator === "IS_EMPTY") return true;
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== "") return num;
    return value;
  };

  // Clear success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#6b6b7b]" />
      </div>
    );
  }

  return (
    <motion.div
      key="alerts"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      <div className="mb-6">
        <h2 className="font-['Syne'] font-semibold text-lg mb-1">Alerts & Webhooks</h2>
        <p className="text-sm text-[#6b6b7b]">
          Get notified when responses match specific conditions or send data to external services.
        </p>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conditional Alerts Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <h3 className="font-medium">Conditional Alerts</h3>
            <Badge variant="secondary">{alerts.length}</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAlertForm(!showAlertForm)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Alert
          </Button>
        </div>

        {/* Alert Form */}
        <AnimatePresence>
          {showAlertForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg overflow-hidden"
            >
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Alert Name</label>
                  <Input
                    value={alertName}
                    onChange={(e) => setAlertName(e.target.value)}
                    placeholder="e.g., Low NPS Score Alert"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Notification Channel</label>
                  <div className="flex gap-2">
                    {(["EMAIL", "SLACK", "WEBHOOK"] as const).map((channel) => {
                      const Icon = CHANNEL_ICONS[channel];
                      return (
                        <button
                          key={channel}
                          onClick={() => {
                            setAlertChannel(channel);
                            if (channel === "EMAIL") setAlertConfig({ emails: [""] });
                            else if (channel === "SLACK") setAlertConfig({ slackWebhookUrl: "" });
                            else setAlertConfig({ webhookUrl: "" });
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                            alertChannel === channel
                              ? "bg-[#FF4F01] text-white border-[#FF4F01]"
                              : "bg-white border-[#dcd6f6] hover:border-[#FF4F01]"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {channel.charAt(0) + channel.slice(1).toLowerCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Channel-specific config */}
                {alertChannel === "EMAIL" && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Email Recipients</label>
                    <Input
                      value={(alertConfig.emails as string[])?.[0] || ""}
                      onChange={(e) =>
                        setAlertConfig({ emails: [e.target.value] })
                      }
                      placeholder="email@example.com"
                      type="email"
                    />
                    <p className="text-xs text-[#6b6b7b] mt-1">
                      Separate multiple emails with commas
                    </p>
                  </div>
                )}

                {alertChannel === "SLACK" && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Slack Webhook URL</label>
                    <Input
                      value={(alertConfig.slackWebhookUrl as string) || ""}
                      onChange={(e) =>
                        setAlertConfig({ slackWebhookUrl: e.target.value })
                      }
                      placeholder="https://hooks.slack.com/services/..."
                      type="url"
                    />
                  </div>
                )}

                {alertChannel === "WEBHOOK" && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Webhook URL</label>
                    <Input
                      value={(alertConfig.webhookUrl as string) || ""}
                      onChange={(e) =>
                        setAlertConfig({ webhookUrl: e.target.value })
                      }
                      placeholder="https://your-server.com/webhook"
                      type="url"
                    />
                  </div>
                )}

                {/* Triggers */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Trigger Conditions
                  </label>
                  <p className="text-xs text-[#6b6b7b] mb-2">
                    Alert fires when ALL conditions are met
                  </p>
                  {alertTriggers.map((trigger, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <select
                        value={trigger.questionId}
                        onChange={(e) => {
                          const newTriggers = [...alertTriggers];
                          newTriggers[idx].questionId = e.target.value;
                          setAlertTriggers(newTriggers);
                        }}
                        className="flex-1 px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value="">Select question...</option>
                        {questions.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.title.slice(0, 40)}
                            {q.title.length > 40 ? "..." : ""}
                          </option>
                        ))}
                      </select>
                      <select
                        value={trigger.operator}
                        onChange={(e) => {
                          const newTriggers = [...alertTriggers];
                          newTriggers[idx].operator = e.target.value;
                          setAlertTriggers(newTriggers);
                        }}
                        className="w-32 px-3 py-2 border rounded-lg text-sm"
                      >
                        {OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                      {trigger.operator !== "IS_EMPTY" && (
                        <Input
                          value={trigger.value}
                          onChange={(e) => {
                            const newTriggers = [...alertTriggers];
                            newTriggers[idx].value = e.target.value;
                            setAlertTriggers(newTriggers);
                          }}
                          placeholder="Value"
                          className="w-32"
                        />
                      )}
                      {alertTriggers.length > 1 && (
                        <button
                          onClick={() =>
                            setAlertTriggers(alertTriggers.filter((_, i) => i !== idx))
                          }
                          className="p-2 text-[#6b6b7b] hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setAlertTriggers([
                        ...alertTriggers,
                        { questionId: "", operator: "EQUALS", value: "" },
                      ])
                    }
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Condition
                  </Button>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAlertForm(false);
                      resetAlertForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateAlert} disabled={savingAlert}>
                    {savingAlert ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Create Alert"
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Alerts List */}
        {alerts.length === 0 ? (
          <p className="text-[#6b6b7b] text-sm py-4 text-center bg-[#fbf5ea] rounded-lg">
            No alerts configured. Create one to get notified about specific responses.
          </p>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => {
              const Icon = CHANNEL_ICONS[alert.channel];
              return (
                <div
                  key={alert.id}
                  className="p-3 bg-[#fbf5ea] rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${CHANNEL_COLORS[alert.channel]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{alert.name}</p>
                      <p className="text-xs text-[#6b6b7b]">
                        {alert.triggers.length} condition
                        {alert.triggers.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAlertEnabled(alert.id, !alert.enabled)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        alert.enabled
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {alert.enabled ? "Active" : "Paused"}
                    </button>
                    <button
                      onClick={() => deleteAlert(alert.id)}
                      className="p-1 text-[#6b6b7b] hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Webhooks Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-green-500" />
            <h3 className="font-medium">Webhooks</h3>
            <Badge variant="secondary">{webhooks.length}</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowWebhookForm(!showWebhookForm)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Webhook
          </Button>
        </div>

        {/* Webhook Form */}
        <AnimatePresence>
          {showWebhookForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg overflow-hidden"
            >
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Webhook Name</label>
                  <Input
                    value={webhookName}
                    onChange={(e) => setWebhookName(e.target.value)}
                    placeholder="e.g., CRM Integration"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Endpoint URL</label>
                  <Input
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-server.com/webhook"
                    type="url"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Events to Send</label>
                  <div className="flex flex-wrap gap-2">
                    {["RESPONSE_SUBMITTED", "SURVEY_COMPLETED", "TRIGGER_MATCHED"].map(
                      (event) => (
                        <button
                          key={event}
                          onClick={() => {
                            if (webhookEvents.includes(event)) {
                              setWebhookEvents(webhookEvents.filter((e) => e !== event));
                            } else {
                              setWebhookEvents([...webhookEvents, event]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            webhookEvents.includes(event)
                              ? "bg-green-500 text-white"
                              : "bg-white border border-[#dcd6f6] text-[#6b6b7b]"
                          }`}
                        >
                          {event.replace(/_/g, " ").toLowerCase()}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowWebhookForm(false);
                      resetWebhookForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateWebhook} disabled={savingWebhook}>
                    {savingWebhook ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Create Webhook"
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Webhooks List */}
        {webhooks.length === 0 ? (
          <p className="text-[#6b6b7b] text-sm py-4 text-center bg-[#fbf5ea] rounded-lg">
            No webhooks configured. Add one to send response data to external services.
          </p>
        ) : (
          <div className="space-y-2">
            {webhooks.map((webhook) => (
              <div key={webhook.id} className="bg-[#fbf5ea] rounded-lg overflow-hidden">
                <div
                  className="p-3 flex items-center justify-between cursor-pointer"
                  onClick={() =>
                    setExpandedWebhook(expandedWebhook === webhook.id ? null : webhook.id)
                  }
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 text-green-700">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{webhook.name}</p>
                      <p className="text-xs text-[#6b6b7b] font-mono">
                        {webhook.url.slice(0, 40)}
                        {webhook.url.length > 40 ? "..." : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {webhook._count?.deliveries || 0} deliveries
                    </Badge>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWebhookEnabled(webhook.id, !webhook.enabled);
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        webhook.enabled
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {webhook.enabled ? "Active" : "Paused"}
                    </button>
                    {expandedWebhook === webhook.id ? (
                      <ChevronDown className="w-4 h-4 text-[#6b6b7b]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#6b6b7b]" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {expandedWebhook === webhook.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 pt-2 border-t border-[#dcd6f6]">
                        <div className="flex flex-wrap gap-1 mb-3">
                          {webhook.events.map((event) => (
                            <Badge key={event} variant="secondary" className="text-xs">
                              {event.replace(/_/g, " ").toLowerCase()}
                            </Badge>
                          ))}
                        </div>

                        {/* Recent Deliveries */}
                        {webhook.recentDeliveries && webhook.recentDeliveries.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-[#6b6b7b] mb-2">
                              Recent Deliveries
                            </p>
                            <div className="space-y-1">
                              {webhook.recentDeliveries.slice(0, 3).map((delivery) => (
                                <div
                                  key={delivery.id}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="text-[#6b6b7b]">
                                    {new Date(delivery.deliveredAt).toLocaleString()}
                                  </span>
                                  {delivery.error ? (
                                    <Badge className="bg-red-100 text-red-700 text-xs">
                                      Failed
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-green-100 text-green-700 text-xs">
                                      {delivery.responseCode}
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testWebhook(webhook.id)}
                          >
                            <TestTube className="w-3 h-3 mr-1" />
                            Test
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteWebhook(webhook.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
