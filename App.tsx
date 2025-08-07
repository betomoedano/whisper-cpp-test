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
} from "react-native";
import type {
  TranscribeRealtimeOptions,
  TranscribeNewSegmentsResult,
} from "whisper.rn";
import RNFS from "react-native-fs";
import { useAudioRecorder } from "@siteed/expo-audio-studio";
import { useWhisperModels } from "./hooks/useWhisperModels";

interface WhisperContext {
  transcribe: (
    filePath: string,
    options: any
  ) => { stop: () => void; promise: Promise<{ result: string }> };
  transcribeRealtime: (options: TranscribeRealtimeOptions) => Promise<{
    stop: () => Promise<void>;
    subscribe: (callback: (event: any) => void) => void;
  }>;
}

export default function App() {
  const [realtimeTranscriber, setRealtimeTranscriber] = useState<any>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<string>("");
  const [realtimeResult, setRealtimeResult] = useState<string>("");
  const [realtimeFinalResult, setRealtimeFinalResult] = useState<string>("");
  const [lastProcessedResult, setLastProcessedResult] = useState<string>("");
  const [realtimeSegments, setRealtimeSegments] = useState<string[]>([]);
  const [error, setError] = useState<string>("");

  const audioRecorder = useAudioRecorder({
    sampleRate: 16000,
    numberOfChannels: 1,
    bitDepth: 16,
    outputFormat: "wav",
  });

  const {
    whisperContext,
    vadContext,
    isInitializingModel,
    isDownloading,
    downloadProgress,
    initializeWhisperModel,
    resetWhisperContext,
    getCurrentModel,
    getDownloadProgress,
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

      // Simple approach: download audio file if not exists
      const audioPath = `${RNFS.DocumentDirectoryPath}/jfk.wav`;

      // Download file if it doesn't exist
      if (!(await RNFS.exists(audioPath))) {
        console.log("Downloading JFK sample...");
        await RNFS.downloadFile({
          fromUrl:
            "https://github.com/ggerganov/whisper.cpp/raw/master/samples/jfk.wav",
          toFile: audioPath,
        }).promise;
        console.log("Download complete");
      }

      // Transcribe the audio
      const options = { language: "en" };
      const { promise } = whisperContext.transcribe(audioPath, options);

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
      setIsRealtimeActive(true);
      setRealtimeResult("");
      setLastProcessedResult("");
      setRealtimeSegments([]);
      setError("");

      console.log("Starting real-time transcription...");

      // Use the built-in transcribeRealtime method from whisper.rn
      const realtimeOptions: TranscribeRealtimeOptions = {
        language: "en",
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

          // Keep track of the last result for final transcript
          setLastProcessedResult(currentResult);

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
      setLastProcessedResult("");
      console.log("Real-time transcription stopped");
    } catch (err) {
      console.error("Error stopping real-time transcription:", err);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <Text style={styles.title}>Whisper.rn Test App</Text>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text
          style={[
            styles.statusText,
            { color: whisperContext ? "#4CAF50" : "#FF5722" },
          ]}
        >
          {isDownloading
            ? `Downloading ${getCurrentModel()?.label || "Model"}... ${(
                getDownloadProgress(currentModelId || "base") * 100
              ).toFixed(0)}%`
            : isInitializingModel
            ? "Initializing..."
            : whisperContext
            ? `Ready (${getCurrentModel()?.label || "Unknown"})`
            : "Not Initialized"}
        </Text>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Real-time:</Text>
        <Text
          style={[
            styles.statusText,
            { color: isRealtimeActive ? "#4CAF50" : "#666" },
          ]}
        >
          {isRealtimeActive ? "ACTIVE" : "INACTIVE"}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          (!whisperContext || isTranscribing) && styles.buttonDisabled,
        ]}
        onPress={transcribeAudio}
        disabled={!whisperContext || isTranscribing}
      >
        <Text style={styles.buttonText}>
          {isTranscribing ? "Transcribing..." : "Transcribe JFK Sample"}
        </Text>
      </TouchableOpacity>

      <View style={styles.modelSelectorContainer}>
        <Text style={styles.modelSelectorLabel}>Select Model:</Text>
        <View style={styles.modelButtons}>
          <TouchableOpacity
            style={[
              styles.modelButton,
              getCurrentModel()?.id === "tiny" && styles.modelButtonActive,
            ]}
            onPress={() => initializeModel("tiny")}
            disabled={isDownloading || isInitializingModel}
          >
            <Text style={styles.modelButtonText}>Tiny</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modelButton,
              getCurrentModel()?.id === "base" && styles.modelButtonActive,
            ]}
            onPress={() => initializeModel("base")}
            disabled={isDownloading || isInitializingModel}
          >
            <Text style={styles.modelButtonText}>Base</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modelButton,
              getCurrentModel()?.id === "small" && styles.modelButtonActive,
            ]}
            onPress={() => initializeModel("small")}
            disabled={isDownloading || isInitializingModel}
          >
            <Text style={styles.modelButtonText}>Small</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          styles.realtimeButton,
          !whisperContext && styles.buttonDisabled,
        ]}
        onPress={
          isRealtimeActive
            ? stopRealtimeTranscription
            : startRealtimeTranscription
        }
        disabled={!whisperContext}
      >
        <Text style={styles.buttonText}>
          {isRealtimeActive ? "🛑 Stop Real-time" : "🎤 Start Real-time"}
        </Text>
      </TouchableOpacity>

      <ScrollView style={styles.resultContainer}>
        {realtimeResult && isRealtimeActive && (
          <View style={styles.realtimeSection}>
            <Text style={styles.realtimeLabel}>
              🎤 Real-time Transcription (Live):
            </Text>
            <Text style={styles.realtimeText}>{realtimeResult}</Text>
          </View>
        )}

        {realtimeFinalResult && (
          <View style={styles.finalRealtimeSection}>
            <Text style={styles.finalRealtimeLabel}>
              ✅ Final Real-time Transcript:
            </Text>
            <Text style={styles.finalRealtimeText}>{realtimeFinalResult}</Text>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setRealtimeFinalResult("")}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {transcriptionResult && (
          <View>
            <Text style={styles.resultLabel}>📁 File Transcription:</Text>
            <Text style={styles.resultText}>{transcriptionResult}</Text>
          </View>
        )}

        {error && (
          <View>
            <Text style={styles.errorLabel}>Error:</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <Text style={styles.infoText}>
        This app tests whisper.rn with downloadable models and supports both
        file and real-time transcription.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 30,
    color: "#333",
  },
  statusContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  statusText: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  button: {
    backgroundColor: "#2196F3",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#2196F3",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButtonText: {
    color: "#2196F3",
  },
  realtimeButton: {
    backgroundColor: "#FF9800",
  },
  realtimeSection: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: "#F0F8FF",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#FF9800",
  },
  realtimeLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FF9800",
    marginBottom: 10,
  },
  realtimeText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#333",
    fontStyle: "italic",
  },
  finalRealtimeSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: "#F0FFF0",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
  },
  finalRealtimeLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4CAF50",
    marginBottom: 10,
  },
  finalRealtimeText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#333",
    marginBottom: 10,
  },
  clearButton: {
    alignSelf: "flex-end",
    backgroundColor: "#FF5722",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  clearButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  modelSelectorContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  modelSelectorLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 10,
  },
  modelButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  modelButton: {
    flex: 1,
    marginHorizontal: 5,
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: "#F5F5F5",
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
  },
  modelButtonActive: {
    backgroundColor: "#E3F2FD",
    borderColor: "#2196F3",
  },
  modelButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  resultContainer: {
    flex: 1,
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: "white",
    borderRadius: 8,
    padding: 15,
    maxHeight: 300,
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4CAF50",
    marginBottom: 10,
  },
  resultText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#333",
  },
  errorLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FF5722",
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#FF5722",
  },
  infoText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    fontStyle: "italic",
  },
});
