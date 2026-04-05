"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Form } from "@heroui/form";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";

interface TradingSettings {
  priceThreshold: number;
  timeThreshold: number;
  stopLossPercent: number;
  takeProfitPercent: number;
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<TradingSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [priceThreshold, setPriceThreshold] = useState("");
  const [timeThreshold, setTimeThreshold] = useState("");
  const [stopLossPercent, setStopLossPercent] = useState("");
  const [takeProfitPercent, setTakeProfitPercent] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings");

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load settings");
        return;
      }

      const data: TradingSettings = await res.json();
      setSettings(data);
      setPriceThreshold(String(data.priceThreshold));
      setTimeThreshold(String(data.timeThreshold / 1000));
      setStopLossPercent(String(data.stopLossPercent));
      setTakeProfitPercent(String(data.takeProfitPercent));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceThreshold: Number(priceThreshold),
          timeThreshold: Number(timeThreshold) * 1000,
          stopLossPercent: Number(stopLossPercent),
          takeProfitPercent: Number(takeProfitPercent),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save settings");
        return;
      }

      const data: TradingSettings = await res.json();
      setSettings(data);
      setPriceThreshold(String(data.priceThreshold));
      setTimeThreshold(String(data.timeThreshold / 1000));
      setStopLossPercent(String(data.stopLossPercent));
      setTakeProfitPercent(String(data.takeProfitPercent));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const hasChanges =
    settings !== null &&
    (Number(priceThreshold) !== settings.priceThreshold ||
      Number(timeThreshold) * 1000 !== settings.timeThreshold ||
      Number(stopLossPercent) !== settings.stopLossPercent ||
      Number(takeProfitPercent) !== settings.takeProfitPercent);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner label="Loading settings..." size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Trading Settings</h1>
        {success && (
          <Chip color="success" variant="flat">
            Settings saved
          </Chip>
        )}
        {error && (
          <Chip color="danger" variant="flat">
            {error}
          </Chip>
        )}
      </div>

      <Divider />

      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <h2 className="text-lg font-semibold">Trading Configuration</h2>
          <p className="text-sm text-default-500">
            Configure thresholds, stop-loss and take-profit settings.
          </p>
        </CardHeader>
        <Divider />
        <CardBody>
          <Form className="flex flex-col gap-6" onSubmit={handleSave}>
            <Input
              description="Minimum price change ($) to trigger a trade."
              label="Price Threshold"
              labelPlacement="outside"
              placeholder="e.g. 100"
              type="number"
              value={priceThreshold}
              variant="bordered"
              onValueChange={setPriceThreshold}
            />

            <Input
              description="Time interval (seconds) between trading evaluations."
              label="Time Threshold"
              labelPlacement="outside"
              placeholder="e.g. 120"
              type="number"
              value={timeThreshold}
              variant="bordered"
              onValueChange={setTimeThreshold}
            />

            <Input
              description="Sell if best bid drops this % below entry price."
              endContent={
                <span className="text-default-400 text-sm">%</span>
              }
              label="Stop Loss"
              labelPlacement="outside"
              placeholder="e.g. 20"
              type="number"
              value={stopLossPercent}
              variant="bordered"
              onValueChange={setStopLossPercent}
            />

            <Input
              description="Sell if best bid rises this % above entry price."
              endContent={
                <span className="text-default-400 text-sm">%</span>
              }
              label="Take Profit"
              labelPlacement="outside"
              placeholder="e.g. 20"
              type="number"
              value={takeProfitPercent}
              variant="bordered"
              onValueChange={setTakeProfitPercent}
            />

            <div className="flex gap-2 justify-end w-full">
              <Button
                isDisabled={!hasChanges || isSaving}
                variant="flat"
                onPress={() => {
                  if (settings) {
                    setPriceThreshold(String(settings.priceThreshold));
                    setTimeThreshold(String(settings.timeThreshold / 1000));
                    setStopLossPercent(String(settings.stopLossPercent));
                    setTakeProfitPercent(String(settings.takeProfitPercent));
                  }
                }}
              >
                Reset
              </Button>
              <Button
                color="primary"
                isDisabled={!hasChanges}
                isLoading={isSaving}
                type="submit"
              >
                Save Changes
              </Button>
            </div>
          </Form>
        </CardBody>
      </Card>
    </div>
  );
}
