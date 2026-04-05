"use client";

import { useEffect, useState, useCallback, Key } from "react";
import { Tabs, Tab } from "@heroui/tabs";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Input } from "@heroui/input";

interface HitEvent {
  blockId: number;
  hitPrice: number;
  targetPrice: number;
  hitDiff: string;
  hitTime: string;
  hitAvgPerSec: number;
  hitAverage5Ticks: number;
  finalPrice: number;
  finalDiff: string;
  finalTime: string;
  finalAvgPerSec: number;
  finalAverage5Ticks: number;
}

interface OrderEvent {
  blockId: number;
  side: string;
  tokenId: string;
  amount: number;
  price: number;
  success: boolean;
  orderId: string;
  status: string;
  makingAmount: string;
  takingAmount: string;
  transactionHash: string;
  error: string;
}

const hitTableColumns = [
  { key: "blockId", label: "Block ID" },
  { key: "hitDiff", label: "Hit Diff" },
  { key: "hitTime", label: "Hit Time" },
  { key: "hitAvgPerSec", label: "Avg/Sec" },
  { key: "hitAverage5Ticks", label: "Avg 5 Ticks" },
  { key: "finalDiff", label: "Final Diff" },
  { key: "finalAvgPerSec", label: "Final Avg/Sec" },
  { key: "finalAverage5Ticks", label: "Final Avg 5 Ticks" },
  { key: "success", label: "Success" },
  { key: "actions", label: "" },
];

const hitAllFields: { key: keyof HitEvent; label: string }[] = [
  { key: "blockId", label: "Block ID" },
  { key: "hitPrice", label: "Hit Price" },
  { key: "targetPrice", label: "Target Price" },
  { key: "hitDiff", label: "Hit Diff" },
  { key: "hitTime", label: "Hit Time" },
  { key: "hitAvgPerSec", label: "Avg/Sec" },
  { key: "hitAverage5Ticks", label: "Avg 5 Ticks" },
  { key: "finalPrice", label: "Final Price" },
  { key: "finalDiff", label: "Final Diff" },
  { key: "finalTime", label: "Final Time" },
  { key: "finalAvgPerSec", label: "Final Avg/Sec" },
  { key: "finalAverage5Ticks", label: "Final Avg 5 Ticks" },
];

const orderTableColumns = [
  { key: "blockId", label: "Block ID" },
  { key: "side", label: "Side" },
  { key: "amount", label: "Amount" },
  { key: "price", label: "Price" },
  { key: "success", label: "Success" },
  { key: "status", label: "Status" },
  { key: "makingAmount", label: "Making Amount" },
  { key: "takingAmount", label: "Taking Amount" },
  { key: "profit", label: "Profit" },
  { key: "actions", label: "" },
];

const orderAllFields: { key: keyof OrderEvent; label: string }[] = [
  { key: "blockId", label: "Block ID" },
  { key: "side", label: "Side" },
  { key: "tokenId", label: "Token ID" },
  { key: "amount", label: "Amount" },
  { key: "price", label: "Price" },
  { key: "success", label: "Success" },
  { key: "orderId", label: "Order ID" },
  { key: "status", label: "Status" },
  { key: "makingAmount", label: "Making Amount" },
  { key: "takingAmount", label: "Taking Amount" },
  { key: "transactionHash", label: "Transaction Hash" },
  { key: "error", label: "Error" },
];

function statusColor(status: string) {
  switch (status?.toUpperCase()) {
    case "MATCHED":
      return "success";
    case "FAILED":
    case "ERROR":
      return "danger";
    case "SKIPPED":
      return "warning";
    default:
      return "default";
  }
}

function formatValue(value: unknown, key: string): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && key !== "blockId") return value.toFixed(4);
  return String(value);
}

function EyeIcon() {
  return (
    <svg
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="18"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      fill="none"
      height="20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="20"
    >
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
  );
}

function DetailModal({
  title,
  fields,
  item,
  isOpen,
  onClose,
}: {
  title: string;
  fields: { key: string; label: string }[];
  item: Record<string, unknown>;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={isOpen} size="2xl" onClose={onClose}>
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {fields.map((field) => (
              <div key={field.key} className="flex justify-between py-1 border-b border-default-100">
                <span className="text-small text-default-500">{field.label}</span>
                <span className="text-small font-medium text-right max-w-[60%] truncate">
                  {formatValue(item[field.key], field.key) || "—"}
                </span>
              </div>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function MetricsPanel() {
  const [hits, setHits] = useState<HitEvent[]>([]);
  const [orders, setOrders] = useState<OrderEvent[]>([]);
  const [selectedTab, setSelectedTab] = useState("hits");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Record<string, unknown> | null>(null);
  const [selectedType, setSelectedType] = useState<"hit" | "order">("hit");
  const { isOpen, onOpen, onClose } = useDisclosure();

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [hitsRes, ordersRes] = await Promise.all([
        fetch("/api/metrics?type=hits"),
        fetch("/api/metrics?type=orders"),
      ]);

      if (!hitsRes.ok || !ordersRes.ok) {
        throw new Error("Failed to fetch metrics");
      }

      setHits(await hitsRes.json());
      setOrders(await ordersRes.json());
    } catch {
      setError("Failed to load metrics data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openDetail(item: Record<string, unknown>, type: "hit" | "order") {
    setSelectedItem(item);
    setSelectedType(type);
    onOpen();
  }

  function renderHitCell(item: HitEvent & { _key: number }, columnKey: Key) {
    if (columnKey === "actions") {
      return (
        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={() => openDetail(item as unknown as Record<string, unknown>, "hit")}
        >
          <EyeIcon />
        </Button>
      );
    }

    if (columnKey === "success") {
      var success = (Number(item.hitDiff) > 0 && Number(item.finalDiff) > 0) || (Number(item.hitDiff) < 0 && Number(item.finalDiff) < 0);
      return (<Chip color={success ? "success" : "danger"} size="sm" variant="flat">
        {success ? "Yes" : "No"}
      </Chip>)
    }

    const value = item[columnKey as keyof HitEvent];

    if (typeof value === "number" && columnKey !== "blockId") {
      return value.toFixed(4);
    }

    return String(value ?? "");
  }

  function renderOrderCell(item: OrderEvent & { _key: number }, columnKey: Key) {
    const key = columnKey as string;

    if (key === "actions") {
      return (
        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={() => openDetail(item as unknown as Record<string, unknown>, "order")}
        >
          <EyeIcon />
        </Button>
      );
    }

    if (key === "success") {
      return (
        <Chip color={item.success ? "success" : "danger"} size="sm" variant="flat">
          {item.success ? "Yes" : "No"}
        </Chip>
      );
    }

    if (key === "status") {
      return (
        <Chip color={statusColor(item.status)} size="sm" variant="flat">
          {item.status}
        </Chip>
      );
    }

    if (key === "profit") {
      if (item.success) {
        const profit : number = Number(item.takingAmount) - Number(item.makingAmount)
        return (profit.toFixed(2));
      }
    }

    const value = item[key as keyof OrderEvent];

    if (typeof value === "number" && key !== "blockId") {
      return value.toFixed(4);
    }

    return String(value ?? "");
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <p className="text-danger text-center py-8">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Tabs
          aria-label="Metrics"
          selectedKey={selectedTab}
          size="lg"
          onSelectionChange={(key) => setSelectedTab(key as string)}
        >
          <Tab key="hits" title={`Hits (${hits.length})`} />
          <Tab key="orders" title={`Orders (${orders.length})`} />
        </Tabs>
        <Button
          isIconOnly
          isLoading={refreshing}
          size="sm"
          variant="flat"
          onPress={() => fetchData(true)}
        >
          <RefreshIcon />
        </Button>
      </div>

      {selectedTab === "hits" && (
        <Table aria-label="Hits table">
          <TableHeader columns={hitTableColumns}>
            {(column) => (
              <TableColumn key={column.key}>{column.label}</TableColumn>
            )}
          </TableHeader>
          <TableBody items={hits.map((h, i) => ({ ...h, _key: i }))}>
            {(item) => (
              <TableRow key={item._key}>
                {(columnKey) => (
                  <TableCell>{renderHitCell(item, columnKey)}</TableCell>
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {selectedTab === "orders" && (
        <Table aria-label="Orders table">
          <TableHeader columns={orderTableColumns}>
            {(column) => (
              <TableColumn key={column.key}>{column.label}</TableColumn>
            )}
          </TableHeader>
          <TableBody items={orders.map((o, i) => ({ ...o, _key: i }))}>
            {(item) => (
              <TableRow key={item._key}>
                {(columnKey) => (
                  <TableCell>{renderOrderCell(item, columnKey)}</TableCell>
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {selectedItem && (
        <DetailModal
          fields={selectedType === "hit" ? hitAllFields : orderAllFields}
          isOpen={isOpen}
          item={selectedItem}
          title={selectedType === "hit" ? `Hit #${selectedItem.blockId}` : `Order #${selectedItem.blockId}`}
          onClose={onClose}
        />
      )}
    </div>
  );
}
