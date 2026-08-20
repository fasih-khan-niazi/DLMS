import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MyLoansScreen from "./MyLoansScreen";
import ReservationsScreen from "./ReservationsScreen";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function ActivityScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"loans" | "reservations">("loans");

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}>
      <Text style={styles.title}>Activity</Text>
      <View style={styles.switchRow}>
        <TouchableOpacity
          style={[styles.switchBtn, tab === "loans" && styles.switchActive]}
          onPress={() => setTab("loans")}
        >
          <Text style={[styles.switchText, tab === "loans" && styles.switchTextActive]}>
            Loans
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.switchBtn, tab === "reservations" && styles.switchActive]}
          onPress={() => setTab("reservations")}
        >
          <Text
            style={[
              styles.switchText,
              tab === "reservations" && styles.switchTextActive,
            ]}
          >
            Reservations
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.body}>
        {tab === "loans" ? (
          <MyLoansScreen navigation={navigation} embedded />
        ) : (
          <ReservationsScreen navigation={navigation} embedded />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7F4" },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#2E4A62",
    marginHorizontal: 16,
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: "#EBE8E1",
    borderRadius: 12,
    padding: 4,
  },
  switchBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  switchActive: {
    backgroundColor: "#2E4A62",
  },
  switchText: {
    color: "#6B7280",
    fontWeight: "600",
  },
  switchTextActive: {
    color: "#FFF",
  },
  body: { flex: 1 },
});
