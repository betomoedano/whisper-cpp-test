import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  SafeAreaView,
} from "react-native";
import { useWhisperModels } from "./hooks/useWhisperModels";
import { Directory, File, Paths } from "expo-file-system";
import { TranscribeRealtimeOptions } from "whisper.rn/index.js";
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";

const APP_DIRECTORY_NAME = "whisper-app-files";
const ACCENT_COLOR = "#0A84FF";

export default function App() {
  const [realtimeTranscriber, setRealtimeTranscriber] = useState<any>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<string>("");
  const [realtimeResult, setRealtimeResult] = useState<string>("");
  const [realtimeFinalResult, setRealtimeFinalResult] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isDeletingModelId, setIsDeletingModelId] = useState<string | null>(
    null
  );

  const {
    whisperContext,
    vadContext,
    isInitializingModel,
    isDownloading,
    downloadProgress,
    currentModelId,
    modelFiles,
    initializeWhisperModel,
    resetWhisperContext,
    getCurrentModel,
    getDownloadProgress,
    getModelById,
    deleteModel,
  } = useWhisperModels();

  useEffect(() => {
    // Initialize with tiny model by default
    initializeModel();
  }, []);

  const initializeModel = async (modelId: string = "base") => {
    try {
      await initializeWhisperModel(modelId, { initVad: false });
    } catch (error) {
      console.error("Failed to initialize model:", error);
      setError(`Failed to initialize model: ${error}`);
    }
  };

  const ensureMicrophonePermission = async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Unsupported Platform",
        "Real-time transcription is not available on the web."
      );
      return false;
    }

    const getPermissionText = (blocked: boolean) =>
      blocked
        ? Platform.OS === "android"
          ? "Please enable microphone access in Android Settings to use real-time transcription."
          : "Please enable microphone access in iOS Settings to use real-time transcription."
        : "Microphone permission is required for real-time transcription.";

    try {
      let permissionStatus = await getRecordingPermissionsAsync();

      if (permissionStatus.granted) {
        return true;
      }

      if (!permissionStatus.canAskAgain) {
        Alert.alert("Microphone Permission", getPermissionText(true));
        console.warn("Microphone permission permanently denied.");
        return false;
      }

      permissionStatus = await requestRecordingPermissionsAsync();

      if (permissionStatus.granted) {
        return true;
      }

      const blocked = !permissionStatus.canAskAgain;
      Alert.alert("Microphone Permission", getPermissionText(blocked));
      console.warn("Microphone permission not granted:", permissionStatus);
      return false;
    } catch (err) {
      console.error("Failed to verify microphone permission:", err);
      Alert.alert(
        "Microphone Permission",
        "Unable to verify microphone permission. Please try again."
      );
      return false;
    }
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(
      units.length - 1,
      Math.floor(Math.log(bytes) / Math.log(1024))
    );
    const scaled = bytes / Math.pow(1024, index);
    return `${scaled.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  };

  const handleDeleteModel = (modelId: string) => {
    if (isRealtimeActive || isTranscribing) {
      Alert.alert(
        "Busy",
        "Please stop any active transcription before deleting models."
      );
      return;
    }

    const modelLabel = getModelById(modelId)?.label || modelId;

    Alert.alert(
      "Delete Model",
      `Remove ${modelLabel} from this device? You can download it again later.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeletingModelId(modelId);
            try {
              await deleteModel(modelId);
              setRealtimeTranscriber(null);
              setRealtimeResult("");
              setRealtimeFinalResult("");
            } catch (err) {
              const message = `Failed to delete model: ${err}`;
              console.error(message);
              Alert.alert("Delete Error", message);
            } finally {
              setIsDeletingModelId(null);
            }
          },
        },
      ]
    );
  };

  const transcribeAudio = async () => {
    if (!whisperContext) {
      Alert.alert("Error", "Whisper not initialized");
      return;
    }

    try {
      setIsTranscribing(true);
      setTranscriptionResult("");
      setError("");

      console.log("Starting transcription...");

      const expoAudioPath = new File(
        Paths.document,
        APP_DIRECTORY_NAME,
        "jfk.wav"
      );

      // Download file if it doesn't exist
      if (!expoAudioPath.exists) {
        console.log("Downloading JFK sample...");
        const url =
          "https://github.com/ggerganov/whisper.cpp/raw/master/samples/jfk.wav";

        // create directory
        const destination = new Directory(Paths.document, APP_DIRECTORY_NAME);
        destination.create({ intermediates: true });

        // download
        await File.downloadFileAsync(url, expoAudioPath);
        console.log("download complete (jfk.wav) file");
      }

      // Transcribe the audio
      const options = { language: "en" };
      const { promise } = whisperContext.transcribe(expoAudioPath.uri, options);

      const startTime = Date.now();
      const { result } = await promise;
      const endTime = Date.now();

      console.log(`Transcription completed in ${endTime - startTime}ms`);
      console.log("Result:", result);

      setTranscriptionResult(result || "No transcription result");
    } catch (err) {
      const errorMessage = `Transcription failed: ${err}`;
      console.error(errorMessage);
      setError(errorMessage);
      Alert.alert("Transcription Error", errorMessage);
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRealtimeTranscription = async () => {
    if (!whisperContext) {
      Alert.alert("Error", "Whisper not initialized");
      return;
    }

    try {
      const hasMicPermission = await ensureMicrophonePermission();
      if (!hasMicPermission) {
        setError("Real-time transcription requires microphone access.");
        return;
      }

      setIsRealtimeActive(true);
      setRealtimeResult("");
      setError("");

      console.log("Starting real-time transcription...");

      // Use the built-in transcribeRealtime method from whisper.rn
      const realtimeOptions: TranscribeRealtimeOptions = {
        language: "en",
        // Keep the session alive well past the default 30s ceiling so we only stop on user action
        realtimeAudioSec: 300,
        realtimeAudioSliceSec: 20,
        realtimeAudioMinSec: 2,
        audioSessionOnStartIos: {
          category: "PlayAndRecord" as any,
          options: ["MixWithOthers" as any],
          mode: "Default" as any,
        },
        audioSessionOnStopIos: "restore" as any,
      };

      const { stop, subscribe } = await whisperContext.transcribeRealtime(
        realtimeOptions
      );

      // Subscribe to transcription events
      subscribe((event: any) => {
        const { isCapturing, data, processTime, recordingTime } = event;

        console.log(
          `Realtime transcribing: ${isCapturing ? "ON" : "OFF"}\n` +
            `Result: ${data?.result || "No result"}\n` +
            `Process time: ${processTime}ms\n` +
            `Recording time: ${recordingTime}ms`
        );

        if (data?.result) {
          const currentResult = data.result.trim();

          // Always update the display - this ensures we never miss updates
          setRealtimeResult(currentResult);

          // Debug logging to help track what's happening
          console.log("📝 Real-time update:", {
            isCapturing,
            length: currentResult.length,
            lastWords: currentResult.split(" ").slice(-5).join(" "), // Last 5 words
            totalWords: currentResult.split(" ").length,
          });
        }

        if (!isCapturing) {
          console.log("Speech segment finished, but continuing to listen...");
          // Don't stop the session - just log that this speech segment ended
          // The transcription will continue listening for more speech
        }
      });

      // Store the stop function
      setRealtimeTranscriber({ stop });
    } catch (err) {
      const errorMessage = `Real-time transcription failed: ${err}`;
      console.error(errorMessage);
      setError(errorMessage);
      Alert.alert("Real-time Error", errorMessage);
      setIsRealtimeActive(false);
    }
  };

  const stopRealtimeTranscription = async () => {
    try {
      if (realtimeTranscriber?.stop) {
        await realtimeTranscriber.stop();
        setRealtimeTranscriber(null);
      }

      // Capture the final result before clearing
      const finalTranscript = realtimeResult.trim();
      if (finalTranscript) {
        setRealtimeFinalResult(finalTranscript);
        console.log("Final real-time transcript:", finalTranscript);
      }

      setIsRealtimeActive(false);
      console.log("Real-time transcription stopped");
    } catch (err) {
      console.error("Error stopping real-time transcription:", err);
    }
  };

  const activeModelLabel = getCurrentModel()?.label || "Model";
  const downloadPercentage =
    getDownloadProgress(currentModelId || "base") ?? 0;
  const whisperStatusText = isDownloading
    ? `Downloading ${activeModelLabel} · ${(downloadPercentage * 100).toFixed(
        0
      )}%`
    : isInitializingModel
    ? "Initializing…"
    : whisperContext
    ? `Ready · ${activeModelLabel}`
    : "Not initialized";
  const realtimeStatusText = isRealtimeActive ? "Listening" : "Idle";
  const transcriptionStatusText = isTranscribing
    ? "Processing sample…"
    : "Idle";
  const storedModels = Object.entries(modelFiles);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Whisper Demo</Text>
          <Text style={styles.subtitle}>
            Minimal transcription playground for whisper.rn models.
          </Text>
        </View>

        {error ? (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.cardLabel}>Something went wrong</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Status</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusCard,
                whisperContext && styles.statusCardActive,
              ]}
            >
              <Text style={styles.statusTitle}>Model</Text>
              <Text style={styles.statusValue}>{whisperStatusText}</Text>
            </View>
            <View
              style={[
                styles.statusCard,
                isRealtimeActive && styles.statusCardActive,
              ]}
            >
              <Text style={styles.statusTitle}>Live</Text>
              <Text style={styles.statusValue}>{realtimeStatusText}</Text>
            </View>
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>File</Text>
              <Text style={styles.statusValue}>{transcriptionStatusText}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, isRealtimeActive && styles.liveCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Live transcription</Text>
            {isRealtimeActive ? (
              <Text style={styles.liveBadge}>Live</Text>
            ) : null}
          </View>
          <Text
            style={[
              styles.cardText,
              !realtimeResult && styles.placeholderText,
            ]}
          >
            {realtimeResult ||
              "Start a live session to see the transcript populate here in real time."}
          </Text>
        </View>

        {realtimeFinalResult ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Latest live transcript</Text>
              <TouchableOpacity onPress={() => setRealtimeFinalResult("")}>
                <Text style={styles.link}>Clear</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.cardText}>{realtimeFinalResult}</Text>
          </View>
        ) : null}

        {transcriptionResult ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>File transcription</Text>
            <Text style={styles.cardText}>{transcriptionResult}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Quick actions</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.primaryButton,
                (!whisperContext || isTranscribing) && styles.buttonDisabled,
              ]}
              onPress={transcribeAudio}
              disabled={!whisperContext || isTranscribing}
            >
              <Text style={styles.primaryButtonText}>
                {isTranscribing ? "Transcribing…" : "Transcribe sample"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                isRealtimeActive ? styles.stopButton : styles.secondaryButton,
                !whisperContext && styles.buttonDisabled,
              ]}
              onPress={
                isRealtimeActive
                  ? stopRealtimeTranscription
                  : startRealtimeTranscription
              }
              disabled={!whisperContext}
            >
              <Text
                style={
                  isRealtimeActive
                    ? styles.stopButtonText
                    : styles.secondaryButtonText
                }
              >
                {isRealtimeActive ? "Stop live session" : "Start live session"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Models</Text>
          <View style={styles.modelGrid}>
            {["large-v3-turbo", "tiny", "base", "small"].map((modelId) => {
              const isActive = getCurrentModel()?.id === modelId;
              return (
                <TouchableOpacity
                  key={modelId}
                  style={[
                    styles.modelChip,
                    isActive && styles.modelChipActive,
                    (isDownloading || isInitializingModel) &&
                      styles.buttonDisabled,
                  ]}
                  onPress={() => initializeModel(modelId)}
                  disabled={isDownloading || isInitializingModel}
                >
                  <Text
                    style={[
                      styles.modelChipText,
                      isActive && styles.modelChipTextActive,
                    ]}
                  >
                    {modelId}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {storedModels.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Stored models</Text>
            {storedModels.map(([modelId, info]) => {
              const modelLabel = getModelById(modelId)?.label || modelId;
              const isCurrent = currentModelId === modelId;
              const deleting = isDeletingModelId === modelId;

              return (
                <View key={modelId} style={styles.storageRow}>
                  <View style={styles.storageMeta}>
                    <Text style={styles.storageName}>
                      {modelLabel}
                      {isCurrent ? " · active" : ""}
                    </Text>
                    <Text style={styles.storageDetails}>
                      Size {formatBytes(info.size)}
                    </Text>
                    <Text
                      style={styles.storagePath}
                      numberOfLines={1}
                      ellipsizeMode="middle"
                    >
                      {info.path}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteModel(modelId)}
                    disabled={deleting}
                  >
                    <Text
                      style={[
                        styles.deleteLink,
                        deleting && styles.deleteDisabled,
                      ]}
                    >
                      {deleting ? "Deleting…" : "Remove"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.footerNote}>
          whisper.rn demo — download a model, try a sample file, or speak live.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111111",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#555555",
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#777777",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -8,
  },
  statusCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e5ea",
    padding: 16,
    marginHorizontal: 8,
    marginBottom: 12,
    minWidth: 140,
    flexGrow: 1,
  },
  statusCardActive: {
    borderColor: ACCENT_COLOR,
    backgroundColor: "#f5f8ff",
  },
  statusTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666666",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111111",
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e5ea",
    padding: 20,
    marginBottom: 24,
  },
  liveCard: {
    borderColor: ACCENT_COLOR,
    backgroundColor: "#f5f8ff",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#777777",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  cardText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#111111",
  },
  placeholderText: {
    color: "#8e8e93",
  },
  liveBadge: {
    color: ACCENT_COLOR,
    fontSize: 12,
    fontWeight: "600",
  },
  errorCard: {
    borderColor: "#ff3b30",
    backgroundColor: "#fff5f4",
  },
  errorText: {
    color: "#b3261e",
    fontSize: 14,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -8,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 8,
    marginBottom: 16,
    minWidth: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: ACCENT_COLOR,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d1d6",
  },
  secondaryButtonText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  stopButton: {
    backgroundColor: "#111111",
  },
  stopButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  modelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  modelChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d1d1d6",
    marginHorizontal: 6,
    marginBottom: 12,
    backgroundColor: "#ffffff",
  },
  modelChipActive: {
    borderColor: ACCENT_COLOR,
    backgroundColor: "#f5f8ff",
  },
  modelChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111111",
  },
  modelChipTextActive: {
    color: ACCENT_COLOR,
  },
  storageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e5e5ea",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#ffffff",
  },
  storageMeta: {
    flex: 1,
    marginRight: 12,
  },
  storageName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111111",
    marginBottom: 6,
  },
  storageDetails: {
    fontSize: 12,
    color: "#666666",
    marginBottom: 4,
  },
  storagePath: {
    fontSize: 11,
    color: "#8e8e93",
  },
  deleteLink: {
    color: "#111111",
    fontSize: 12,
    fontWeight: "600",
  },
  deleteDisabled: {
    opacity: 0.4,
  },
  link: {
    color: ACCENT_COLOR,
    fontSize: 12,
    fontWeight: "600",
  },
  footerNote: {
    fontSize: 12,
    color: "#8e8e93",
    textAlign: "center",
    marginTop: 8,
  },
});
