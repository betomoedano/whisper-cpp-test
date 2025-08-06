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
import { initWhisper } from "whisper.rn";
import RNFS from "react-native-fs";

interface WhisperContext {
  transcribe: (
    filePath: string,
    options: any
  ) => { stop: () => void; promise: Promise<{ result: string }> };
}

export default function App() {
  const [whisperContext, setWhisperContext] = useState<WhisperContext | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    initializeWhisper();
  }, []);

  const initializeWhisper = async () => {
    try {
      setIsLoading(true);
      setError("");

      console.log("Initializing Whisper...");
      const context = await initWhisper({
        filePath: require("./assets/ggml-tiny.en.bin"),
      });

      setWhisperContext(context);
      console.log("Whisper initialized successfully!");
    } catch (err) {
      const errorMessage = `Failed to initialize Whisper: ${err}`;
      console.error(errorMessage);
      setError(errorMessage);
      Alert.alert("Initialization Error", errorMessage);
    } finally {
      setIsLoading(false);
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
          {isLoading
            ? "Initializing..."
            : whisperContext
            ? "Ready"
            : "Not Initialized"}
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

      <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={initializeWhisper}
        disabled={isLoading}
      >
        <Text style={[styles.buttonText, styles.secondaryButtonText]}>
          {isLoading ? "Initializing..." : "Reinitialize Whisper"}
        </Text>
      </TouchableOpacity>

      <ScrollView style={styles.resultContainer}>
        {transcriptionResult && (
          <View>
            <Text style={styles.resultLabel}>Transcription Result:</Text>
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
        This app tests whisper.rn with a tiny.en model and JFK sample audio.
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
