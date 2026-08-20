import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api from "../config/api";

type Mode = "borrow" | "return";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function ScanScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>("borrow");
  const [busy, setBusy] = useState(false);
  const [scanned, setScanned] = useState(false);

  const handleBarcode = async ({ data }: { data: string }) => {
    if (busy || scanned) return;
    setScanned(true);
    setBusy(true);

    try {
      const endpoint = mode === "borrow" ? "/api/loans/borrow" : "/api/loans/return";
      const response = await api.post(endpoint, { qrPayload: data });
      Alert.alert("Success", response.data.message || "Done", [
        {
          text: "OK",
          onPress: () => {
            setScanned(false);
            setBusy(false);
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert("Failed", error.response?.data?.error || "Scan action failed", [
        {
          text: "Try again",
          onPress: () => {
            setScanned(false);
            setBusy(false);
          },
        },
      ]);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2E4A62" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Camera permission is required to scan book QR codes.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Scan QR</Text>
      </View>

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeButton, mode === "borrow" && styles.modeActive]}
          onPress={() => setMode("borrow")}
        >
          <Text style={[styles.modeText, mode === "borrow" && styles.modeTextActive]}>
            Borrow
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === "return" && styles.modeActive]}
          onPress={() => setMode("return")}
        >
          <Text style={[styles.modeText, mode === "return" && styles.modeTextActive]}>
            Return
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanned ? undefined : handleBarcode}
        />
        {busy && (
          <View style={styles.overlay}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.overlayText}>Processing...</Text>
          </View>
        )}
      </View>

      <Text style={styles.hint}>
        Point at a book QR code to {mode}. Format: copyId_isbn
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F7F4",
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F7F4",
    padding: 24,
  },
  topBar: {
    marginBottom: 12,
  },
  back: {
    color: "#E8A838",
    marginBottom: 8,
    fontSize: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2E4A62",
  },
  modeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2E4A62",
    paddingVertical: 12,
    alignItems: "center",
  },
  modeActive: {
    backgroundColor: "#2E4A62",
  },
  modeText: {
    color: "#2E4A62",
    fontWeight: "600",
  },
  modeTextActive: {
    color: "#FFFFFF",
  },
  cameraWrap: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#111827",
    minHeight: 320,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayText: {
    color: "#fff",
    marginTop: 12,
  },
  hint: {
    marginTop: 16,
    marginBottom: 24,
    color: "#6B7280",
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    color: "#4B5563",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#2E4A62",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  link: {
    color: "#E8A838",
  },
});
