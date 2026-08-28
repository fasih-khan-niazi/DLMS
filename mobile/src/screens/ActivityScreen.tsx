import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MyLoansScreen from "./MyLoansScreen";
import ReservationsScreen from "./ReservationsScreen";
import LoanHistoryScreen from "./LoanHistoryScreen";
import { useTheme } from "../theme";

type ActivityTab = "loans" | "reservations" | "returns";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route?: { params?: { initialTab?: ActivityTab } };
};

export default function ActivityScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, fontFamily, radius, space, type } = useTheme();
  const [tab, setTab] = useState<ActivityTab>(route?.params?.initialTab || "loans");

  useEffect(() => {
    const next = route?.params?.initialTab;
    if (next) {
      if ((next as string) === "history") setTab("returns");
      else setTab(next);
    }
  }, [route?.params?.initialTab]);

  const tabs: { id: ActivityTab; label: string }[] = [
    { id: "loans", label: "Loans" },
    { id: "reservations", label: "Reservations" },
    { id: "returns", label: "Returns" },
  ];

  return (
    <View
      style={[
        styles.container,
        { paddingTop: Math.max(insets.top, 8), backgroundColor: colors.cream },
      ]}
    >
      <Text
        style={{
          fontFamily: fontFamily.display,
          fontSize: type.title,
          color: colors.navy,
          marginHorizontal: space.lg,
          marginBottom: space.sm,
        }}
      >
        Activity
      </Text>

      <View
        style={[
          styles.switchRow,
          {
            marginHorizontal: space.lg,
            backgroundColor: colors.creamDark,
            borderRadius: radius.md,
          },
        ]}
      >
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <Pressable
              key={item.id}
              style={[
                styles.switchBtn,
                { borderRadius: radius.sm },
                active && { backgroundColor: colors.navy },
              ]}
              onPress={() => setTab(item.id)}
            >
              <Text
                style={{
                  fontFamily: fontFamily.bodySemiBold,
                  fontSize: type.caption,
                  color: active ? colors.white : colors.muted,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.body}>
        {tab === "loans" ? (
          <MyLoansScreen navigation={navigation} embedded />
        ) : tab === "reservations" ? (
          <ReservationsScreen navigation={navigation} embedded />
        ) : (
          <LoanHistoryScreen navigation={navigation} embedded />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  switchRow: {
    flexDirection: "row",
    marginBottom: 4,
    padding: 4,
  },
  switchBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  body: { flex: 1, paddingTop: 8 },
});
