import { useState, useCallback } from "react";
import { initWhisper, initWhisperVad } from "whisper.rn";
import RNFS from "react-native-fs";
import type { WhisperContext } from "whisper.rn";

export interface WhisperModel {
  id: string;
  label: string;
  url: string;
  filename: string;
  capabilities: {
    multilingual: boolean;
    quantizable: boolean;
    tdrz?: boolean; // Optional TDRZ capability for native models
  };
}

export const WHISPER_MODELS: WhisperModel[] = [
  {
    id: "tiny",
    label: "Tiny (en)",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
    filename: "ggml-tiny.en.bin",
    capabilities: {
      multilingual: false,
      quantizable: false,
    },
  },
  {
    id: "base",
    label: "Base Model",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
    filename: "ggml-base.bin",
    capabilities: {
      multilingual: true,
      quantizable: false,
    },
  },
  {
    id: "small",
    label: "Small Model",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
    filename: "ggml-small.bin",
    capabilities: {
      multilingual: true,
      quantizable: false,
    },
  },
  {
    id: "small-tdrz",
    label: "Small (tdrz)",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-tdrz.bin",
    filename: "ggml-small.en-tdrz.bin",
    capabilities: {
      multilingual: false,
      quantizable: false,
      tdrz: true,
    },
  },
];

export function useWhisperModels() {
  const [modelFiles, setModelFiles] = useState<Record<string, string>>({});
  const [downloadProgress, setDownloadProgress] = useState<
    Record<string, number>
  >({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [isInitializingModel, setIsInitializingModel] = useState(false);
  const [whisperContext, setWhisperContext] = useState<WhisperContext | null>(
    null
  );
  const [vadContext, setVadContext] = useState<any>(null);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);

  const getModelDirectory = useCallback(async () => {
    const directory = `${RNFS.DocumentDirectoryPath}/whisper-models/`;
    await RNFS.mkdir(directory).catch(() => {});
    return directory;
  }, []);

  const downloadModel = useCallback(
    async (model: WhisperModel) => {
      const directory = await getModelDirectory();
      const filePath = `${directory}${model.filename}`;

      // Check if file already exists
      const fileExists = await RNFS.exists(filePath);
      if (fileExists) {
        console.log(`Model ${model.id} already exists at ${filePath}`);
        setModelFiles((prev) => ({ ...prev, [model.id]: filePath }));
        return filePath;
      }

      setIsDownloading(true);
      console.log(`Downloading model ${model.id} from ${model.url}`);

      try {
        const downloadResult = await RNFS.downloadFile({
          fromUrl: model.url,
          toFile: filePath,
          headers: {},
          background: false,
          progressDivider: 10,
          begin: (res) => {
            console.log(
              `Download started for ${model.id}, content length:`,
              res.contentLength
            );
          },
          progress: (res) => {
            const progress = res.bytesWritten / res.contentLength;
            setDownloadProgress((prev) => ({
              ...prev,
              [model.id]: progress,
            }));
            console.log(
              `Download progress for ${model.id}: ${(progress * 100).toFixed(
                1
              )}%`
            );
          },
        }).promise;

        if (downloadResult.statusCode === 200) {
          console.log(`Successfully downloaded model ${model.id}`);
          setModelFiles((prev) => ({ ...prev, [model.id]: filePath }));
          setDownloadProgress((prev) => ({ ...prev, [model.id]: 1 }));
          return filePath;
        } else {
          throw new Error(
            `Download failed with status: ${downloadResult.statusCode}`
          );
        }
      } catch (error) {
        console.error(`Error downloading model ${model.id}:`, error);
        throw error;
      } finally {
        setIsDownloading(false);
      }
    },
    [getModelDirectory]
  );

  const initializeWhisperModel = useCallback(
    async (modelId: string, options?: { initVad?: boolean }) => {
      const model = WHISPER_MODELS.find((m) => m.id === modelId);
      if (!model) throw new Error("Invalid model selected");

      try {
        setIsInitializingModel(true);
        console.log(`Initializing Whisper model: ${model.label}`);

        // Download model if not already available
        const modelPath = await downloadModel(model);

        // Initialize Whisper context
        const context = await initWhisper({
          filePath: modelPath,
        });

        setWhisperContext(context);
        setCurrentModelId(modelId);
        console.log(`Whisper context initialized for model: ${model.label}`);

        // Optionally initialize VAD context
        if (options?.initVad) {
          console.log("Initializing VAD context...");
          try {
            const vad = await initWhisperVad({
              filePath: modelPath,
            });
            setVadContext(vad);
            console.log("VAD context initialized successfully");
          } catch (vadError) {
            console.warn("VAD initialization failed:", vadError);
            // Continue without VAD - it's optional
          }
        }

        return {
          whisperContext: context,
          vadContext: options?.initVad ? vadContext : null,
        };
      } catch (error) {
        console.error("Model initialization error:", error);
        throw error;
      } finally {
        setIsInitializingModel(false);
      }
    },
    [downloadModel, vadContext]
  );

  const resetWhisperContext = useCallback(() => {
    setWhisperContext(null);
    setVadContext(null);
    setCurrentModelId(null);
    console.log("Whisper contexts reset");
  }, []);

  const getModelById = useCallback((modelId: string) => {
    return WHISPER_MODELS.find((m) => m.id === modelId);
  }, []);

  const getCurrentModel = useCallback(() => {
    return currentModelId ? getModelById(currentModelId) : null;
  }, [currentModelId, getModelById]);

  const isModelDownloaded = useCallback(
    (modelId: string) => {
      return modelFiles[modelId] !== undefined;
    },
    [modelFiles]
  );

  const getDownloadProgress = useCallback(
    (modelId: string) => {
      return downloadProgress[modelId] || 0;
    },
    [downloadProgress]
  );

  return {
    // State
    modelFiles,
    downloadProgress,
    isDownloading,
    isInitializingModel,
    whisperContext,
    vadContext,
    currentModelId,

    // Actions
    downloadModel,
    initializeWhisperModel,
    resetWhisperContext,

    // Helpers
    getModelById,
    getCurrentModel,
    isModelDownloaded,
    getDownloadProgress,

    // Constants
    availableModels: WHISPER_MODELS,
  };
}
