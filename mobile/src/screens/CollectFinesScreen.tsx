import React, { useMemo, useState } from "react";
import { Text, View, Keyboard } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";
import { AppModal } from "../components/AppModal";
import { Badge, Button, Card, Input, Screen, ScreenHeader } from "../components/ui";
import { extractApiError } from "../utils/apiError";
import { formatShortDate } from "../utils/loanDates";
import { useTheme } from "../theme";
import * as Haptics from "../utils/haptics";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

type FineItem = {
  loanId: string;
  title: string;
  copyNumber?: number | null;
  status: string;
  dueDate?: string | null;
  returnedAt?: string | null;
  borrowedAt?: string | null;
  fineAmount: number;
  finePaidAmount: number;
  remaining: number;
};

type LookupResult = {
  user: {
    uid: string;
    email: string;
    displayName: string;
    role: string;
    activeBorrowCount: number;
  };
  outstanding: number;
  items: FineItem[];
  onLoan: Array<{
    loanId: string;
    title: string;
    copyNumber?: number | null;
    status: string;
    dueDate?: string | null;
    remaining: number;
  }>;
};

type ModalState =
  | { kind: "confirm" }
  | { kind: "success"; title: string; message: string }
  | { kind: "error"; title: string; message: string }
  | null;

export default function CollectFinesScreen({ navigation }: Props) {
  const { colors, fontFamily, space, type } = useTheme();
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const outstanding = lookup?.outstanding ?? 0;

  const amountValue = useMemo(() => {
    const n = Math.floor(Number(amount));
    return Number.isFinite(n) ? n : 0;
  }, [amount]);

  const clampAmount = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, "");
    if (!digits) {
      setAmount("");
      return;
    }
    let n = Number(digits);
    if (lookup && n > lookup.outstanding) n = lookup.outstanding;
    setAmount(n > 0 ? String(n) : "");
  };

  const findAccount = async () => {
    Keyboard.dismiss();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setModal({
        kind: "error",
        title: "Email needed",
        message: "Enter the reader's library email, then look up their fines.",
      });
      return;
    }
    setLooking(true);
    setLookup(null);
    setAmount("");
    try {
      const { data } = await api.get<LookupResult>("/api/fines/lookup", {
        params: { email: trimmed },
      });
      setEmail(trimmed);
      setLookup(data);
      if (data.outstanding > 0) setAmount(String(data.outstanding));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      setModal({
        kind: "error",
        title: "Lookup failed",
        message: extractApiError(error, "Could not find that account."),
      });
    } finally {
      setLooking(false);
    }
  };

  const openConfirm = () => {
    if (!lookup) return;
    if (amountValue <= 0) {
      setModal({
        kind: "error",
        title: "Amount needed",
        message: "Enter the cash received, up to the outstanding balance.",
      });
      return;
    }
    if (amountValue > lookup.outstanding) {
      setAmount(String(lookup.outstanding));
    }
    setModal({ kind: "confirm" });
  };

  const recordPayment = async () => {
    if (!lookup || amountValue <= 0) return;
    setSaving(true);
    try {
      const { data } = await api.post("/api/fines/collect", {
        email: lookup.user.email,
        amount: amountValue,
      });
      const { data: refreshed } = await api.get<LookupResult>("/api/fines/lookup", {
        params: { email: lookup.user.email },
      });
      setLookup(refreshed);
      setAmount(refreshed.outstanding > 0 ? String(refreshed.outstanding) : "");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setModal({
        kind: "success",
        title: "Payment recorded",
        message: String(data.message || `Recorded Rs ${amountValue}.`),
      });
    } catch (error) {
      setModal({
        kind: "error",
        title: "Could not record payment",
        message: extractApiError(error, "The payment was not saved."),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll keyboard contentStyle={{ paddingHorizontal: 20 }}>
      <ScreenHeader
        title="Collect fines"
        subtitle="Cash at the desk"
        onBack={() => navigation.goBack()}
      />

      <Text
        style={{
          fontFamily: fontFamily.body,
          fontSize: type.small,
          color: colors.muted,
          lineHeight: 20,
          marginBottom: space.md,
        }}
      >
        Look up a reader by email, take the cash, then record what you received. This never
        returns a book. They still scan to return.
      </Text>

      <Input
        label="Reader email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="student@university.edu"
        returnKeyType="go"
        blurOnSubmit
        onSubmitEditing={() => void findAccount()}
      />
      <Button
        title={looking ? "Looking up..." : "Look up"}
        onPress={() => void findAccount()}
        loading={looking}
        style={{ marginTop: space.sm, marginBottom: space.lg }}
      />

      {lookup ? (
        <>
          <Card style={{ marginBottom: space.md }}>
            <Text style={{ fontFamily: fontFamily.bodyBold, fontSize: type.body, color: colors.navy }}>
              {lookup.user.displayName || lookup.user.email}
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontFamily: fontFamily.body,
                fontSize: type.small,
                color: colors.muted,
              }}
            >
              {lookup.user.email}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <Badge
                label={lookup.user.role === "librarian" ? "Librarian" : "Student"}
                tone="info"
              />
              <Badge
                label={
                  lookup.user.activeBorrowCount === 1
                    ? "1 book on loan"
                    : `${lookup.user.activeBorrowCount} books on loan`
                }
                tone="muted"
              />
            </View>
            <Text
              style={{
                marginTop: space.md,
                fontFamily: fontFamily.bodyBold,
                fontSize: type.titleSm,
                color: outstanding > 0 ? colors.danger : colors.success,
              }}
            >
              Outstanding Rs {outstanding}
            </Text>
          </Card>

          {lookup.items.length > 0 ? (
            <View style={{ marginBottom: space.md }}>
              <Text
                style={{
                  fontFamily: fontFamily.bodyBold,
                  fontSize: type.small,
                  color: colors.navy,
                  marginBottom: space.sm,
                }}
              >
                Unpaid fines
              </Text>
              {lookup.items.map((item) => (
                <Card key={item.loanId} style={{ marginBottom: space.sm }}>
                  <Text style={{ fontFamily: fontFamily.bodyBold, color: colors.navy }}>
                    {item.title}
                  </Text>
                  <Text
                    style={{
                      marginTop: 4,
                      fontFamily: fontFamily.body,
                      fontSize: type.small,
                      color: colors.muted,
                    }}
                  >
                    {item.copyNumber ? `Copy ${item.copyNumber} · ` : ""}
                    {item.status === "returned" ? "Returned" : "Still on loan"}
                    {item.dueDate ? ` · due ${formatShortDate(item.dueDate)}` : ""}
                  </Text>
                  <Text
                    style={{
                      marginTop: 8,
                      fontFamily: fontFamily.bodySemiBold,
                      fontSize: type.small,
                      color: colors.danger,
                    }}
                  >
                    Rs {item.remaining} unpaid
                    {item.finePaidAmount > 0 ? ` · Rs ${item.finePaidAmount} already paid` : ""}
                    {` · assessed Rs ${item.fineAmount}`}
                  </Text>
                </Card>
              ))}
            </View>
          ) : (
            <Text
              style={{
                fontFamily: fontFamily.body,
                fontSize: type.small,
                color: colors.muted,
                marginBottom: space.md,
              }}
            >
              No outstanding fines on this account.
            </Text>
          )}

          {lookup.onLoan.length > 0 ? (
            <View style={{ marginBottom: space.md }}>
              <Text
                style={{
                  fontFamily: fontFamily.bodyBold,
                  fontSize: type.small,
                  color: colors.navy,
                  marginBottom: space.sm,
                }}
              >
                Currently on loan
              </Text>
              {lookup.onLoan.map((item) => (
                <Text
                  key={item.loanId}
                  style={{
                    fontFamily: fontFamily.body,
                    fontSize: type.small,
                    color: colors.muted,
                    marginBottom: 6,
                  }}
                >
                  {item.title}
                  {item.copyNumber ? ` · Copy ${item.copyNumber}` : ""}
                  {item.dueDate ? ` · due ${formatShortDate(item.dueDate)}` : ""}
                  {item.remaining > 0 ? ` · Rs ${item.remaining} fine` : ""}
                </Text>
              ))}
            </View>
          ) : null}

          {outstanding > 0 ? (
            <>
              <Input
                label="Cash received (Rs)"
                value={amount}
                onChangeText={clampAmount}
                keyboardType="number-pad"
                placeholder={`Up to ${outstanding}`}
              />
              <Button
                title="Record collection"
                onPress={openConfirm}
                style={{ marginTop: space.sm, marginBottom: space.lg }}
              />
            </>
          ) : null}
        </>
      ) : null}

      <AppModal
        visible={modal?.kind === "confirm"}
        variant="info"
        title="Confirm collection"
        message={
          lookup
            ? `Record Rs ${Math.min(amountValue, outstanding)} cash from ${
                lookup.user.displayName || lookup.user.email
              } (${lookup.user.email})? This does not return any books.`
            : ""
        }
        confirmLabel="Confirm"
        cancelLabel="Back"
        confirmLoading={saving}
        onClose={() => {
          if (!saving) setModal(null);
        }}
        onConfirm={() => void recordPayment()}
        onCancel={() => setModal(null)}
      />

      <AppModal
        visible={modal?.kind === "success" || modal?.kind === "error"}
        variant={modal?.kind === "success" ? "success" : "error"}
        title={modal && modal.kind !== "confirm" ? modal.title : ""}
        message={modal && modal.kind !== "confirm" ? modal.message : ""}
        confirmLabel="OK"
        onClose={() => setModal(null)}
        onConfirm={() => setModal(null)}
      />
    </Screen>
  );
}
