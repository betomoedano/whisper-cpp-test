/**
 * OpenAI's Whisper models converted to ggml format for use with whisper.cpp
 *
 * Download from https://huggingface.co/ggerganov/whisper.cpp/tree/main
 */
import { useState, useCallback, useEffect } from "react";
import { Directory, File, Paths } from "expo-file-system";
import {
  createDownloadResumable,
  type DownloadProgressData,
  type FileSystemDownloadResult,
} from "expo-file-system/legacy";
import { initWhisper, initWhisperVad } from "whisper.rn/index.js";
import type { WhisperContext } from "whisper.rn/index.js";

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
    id: "large-v3-turbo",
    label: "Large Multilanguae",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
    filename: "ggml-large-v3-turbo.bin",
    capabilities: {
      multilingual: true,
      quantizable: false,
    },
  },
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

interface ModelFileInfo {
  path: string;
  size: number;
}

export function useWhisperModels() {
  const [modelFiles, setModelFiles] = useState<Record<string, ModelFileInfo>>(
    {}
  );
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
    let documentDirectory: Directory;
    try {
      documentDirectory = Paths.document;
    } catch (error) {
      throw new Error("Document directory is not available.");
    }

    if (!documentDirectory?.uri) {
      throw new Error("Document directory is not available.");
    }

    const directory = new Directory(documentDirectory, "whisper-models");
    try {
      directory.create({ idempotent: true, intermediates: true });
    } catch (error) {
      console.warn("Failed to ensure Whisper model directory exists:", error);
      throw error;
    }
    return directory;
  }, []);

  const downloadModel = useCallback(
    async (model: WhisperModel) => {
      const directory = await getModelDirectory();
      const file = new File(directory, model.filename);

      // Helper to update cache with latest stat info
      const updateModelFileInfo = () => {
        try {
          const stats = file.info();
          if (!stats.exists) throw new Error("File not found");
          setModelFiles((prev) => ({
            ...prev,
            [model.id]: {
              path: file.uri,
              size: Number(stats.size) || 0,
            },
          }));
        } catch (statError) {
          console.warn(
            `Failed to stat model file ${model.id} at ${file.uri}:`,
            statError
          );
          setModelFiles((prev) => ({
            ...prev,
            [model.id]: {
              path: file.uri,
              size: 0,
            },
          }));
        }
      };

      // Check if file already exists
      let existingInfo;
      try {
        existingInfo = file.info();
      } catch (infoError) {
        console.warn(
          `Failed to read info for model ${model.id} at ${file.uri}:`,
          infoError
        );
        existingInfo = { exists: false };
      }
      if (existingInfo.exists) {
        console.log(`Model ${model.id} already exists at ${file.uri}`);
        updateModelFileInfo();
        return file.uri;
      }

      setIsDownloading(true);
      console.log(`Downloading model ${model.id} from ${model.url}`);

      try {
        const downloadResumable = createDownloadResumable(
          model.url,
          file.uri,
          undefined,
          (progressData: DownloadProgressData) => {
            const { totalBytesWritten, totalBytesExpectedToWrite } = progressData;
            const fraction =
              totalBytesExpectedToWrite > 0
                ? totalBytesWritten / totalBytesExpectedToWrite
                : 0;
            setDownloadProgress((prev) => ({
              ...prev,
              [model.id]: fraction,
            }));
            console.log(
              `Download progress for ${model.id}: ${(fraction * 100).toFixed(
                1
              )}%`
            );
          },
        );

        const downloadResult = (await downloadResumable.downloadAsync()) as
          | FileSystemDownloadResult
          | undefined;

        if (
          downloadResult &&
          (downloadResult.status === 0 ||
            (downloadResult.status >= 200 && downloadResult.status < 300))
        ) {
          console.log(`Successfully downloaded model ${model.id}`);
          updateModelFileInfo();
          setDownloadProgress((prev) => ({ ...prev, [model.id]: 1 }));
          return file.uri;
        } else {
          throw new Error(
            `Download failed with status: ${downloadResult?.status}`
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

  const deleteModel = useCallback(
    async (modelId: string) => {
      const fileInfo = modelFiles[modelId];
      if (!fileInfo) {
        console.warn(`Attempted to delete non-downloaded model: ${modelId}`);
        return;
      }

      try {
        const file = new File(fileInfo.path);
        const info = file.info();
        if (info.exists) {
          file.delete();
          console.log(`Deleted model file at ${fileInfo.path}`);
        }
      } catch (error) {
        console.error(`Failed to delete model ${modelId}:`, error);
        throw error;
      }

      setModelFiles((prev) => {
        const next = { ...prev };
        delete next[modelId];
        return next;
      });
      setDownloadProgress((prev) => {
        const next = { ...prev };
        delete next[modelId];
        return next;
      });

      if (currentModelId === modelId) {
        if (whisperContext?.release) {
          try {
            await whisperContext.release();
          } catch (releaseError) {
            console.warn(
              "Failed to release Whisper context during model deletion:",
              releaseError
            );
          }
        }
        setWhisperContext(null);
        setCurrentModelId(null);
        setVadContext(null);
      }
    },
    [currentModelId, modelFiles, whisperContext]
  );

  useEffect(() => {
    let isMounted = true;

    const loadExistingModels = async () => {
      try {
        const directory = await getModelDirectory();
        const entries = await Promise.all(
          WHISPER_MODELS.map(async (model) => {
            const file = new File(directory, model.filename);
            try {
              const fileInfo = file.info();
              if (!fileInfo.exists) return null;

              return {
                id: model.id,
                info: {
                  path: file.uri,
                  size: Number(fileInfo.size) || 0,
                },
              } as { id: string; info: ModelFileInfo };
            } catch (statError) {
              console.warn(
                `Failed to stat existing model file ${model.id}:`,
                statError
              );
              return {
                id: model.id,
                info: {
                  path: file.uri,
                  size: 0,
                },
              };
            }
          })
        );

        if (!isMounted) return;

        const fileMap: Record<string, ModelFileInfo> = {};
        entries.forEach((entry) => {
          if (entry) {
            fileMap[entry.id] = entry.info;
          }
        });

        if (Object.keys(fileMap).length > 0) {
          setModelFiles((prev) => ({ ...prev, ...fileMap }));
        }
      } catch (error) {
        console.warn("Failed to load existing Whisper models:", error);
      }
    };

    loadExistingModels();

    return () => {
      isMounted = false;
    };
  }, [getModelDirectory]);

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
    deleteModel,

    // Helpers
    getModelById,
    getCurrentModel,
    isModelDownloaded,
    getDownloadProgress,

    // Constants
    availableModels: WHISPER_MODELS,
  };
}
