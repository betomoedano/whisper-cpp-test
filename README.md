# 🎤 Whisper.rn Real-time Transcription App

A React Native + Expo application demonstrating real-time speech-to-text transcription using OpenAI's Whisper model via [whisper.rn](https://github.com/mybigday/whisper.rn).

## ✨ Features

### 🎙️ Real-time Transcription

- **Live speech-to-text** - Transcribe as you speak with minimal latency
- **Continuous listening** - Automatically handles speech segments and pauses
- **Final transcript capture** - Save and review complete transcriptions
- **Voice Activity Detection** - Built-in VAD for intelligent speech detection

### 🤖 Multiple AI Models

- **Tiny Model** (39MB) - Fast, English-only, basic accuracy
- **Base Model** (74MB) - Good accuracy, multilingual support
- **Small Model** (244MB) - Very good accuracy, excellent for complex conversations
- **Easy model switching** - Download and switch between models with one tap

### 📁 File Transcription

- **Audio file support** - Transcribe pre-recorded audio files
- **Sample audio included** - Test with JFK speech sample
- **Progress tracking** - Visual feedback during transcription

### 🎨 Modern UI

- **Clean interface** - Intuitive controls and status indicators
- **Real-time updates** - See transcription appear as you speak
- **Model management** - Visual indicators for downloads and initialization
- **Result management** - Clear, copy, and manage transcription results

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ or **Bun** runtime
- **Expo CLI** - For running the app
- **iOS Simulator** or **Physical Device** (recommended for real-time transcription)
- **Android Emulator** or **Physical Device**

### Installation

```bash
# Clone the repository
git clone https://github.com/betomoedano/whisper-cpp-test.git
cd whisper-cpp-test

# Install dependencies
bun install
# or
npm install

# Prebuild native modules (required after first install)
npx expo prebuild

# Run on iOS
bun run ios
# or npm run ios

# Run on Android
bun run android
# or npm run android
```

## 📱 How to Use

### Initial Setup

1. **App launches** - Automatically downloads and initializes the Base model
2. **Wait for "Ready"** - Status indicator shows when model is loaded
3. **Grant microphone permission** - Required for real-time transcription

### Real-time Transcription

1. **Tap "🎤 Start Real-time"** - Begins listening for speech
2. **Speak naturally** - Your speech appears in real-time
3. **Pause anytime** - The app continues listening for more speech
4. **Tap "🛑 Stop Real-time"** - Ends session and shows final transcript
5. **Review and Clear** - Final transcript persists until cleared

### File Transcription

1. **Tap "Transcribe JFK Sample"** - Tests file transcription
2. **Wait for processing** - Progress shown during transcription
3. **View results** - Complete transcript appears below

### Switching Models

1. **Tap model button** - Tiny, Base, or Small
2. **Wait for download** - First-time downloads show progress
3. **Automatic initialization** - Model loads when ready
4. **Test transcription** - Compare quality between models

## 🏗️ Project Structure

```
whisper-cpp-test/
├── App.tsx                    # Main application component
├── hooks/
│   └── useWhisperModels.ts    # Model management hook
├── assets/
│   └── jfk.wav               # Sample audio file
├── index.ts                   # Entry point
├── app.json                   # Expo configuration
├── package.json               # Dependencies
├── tsconfig.json             # TypeScript configuration
└── metro.config.js           # Metro bundler configuration
```

## 🛠️ Technical Details

### Core Technologies

- **React Native** 0.79.5 - Cross-platform mobile framework
- **Expo** ~53.0 - Development and build tooling
- **TypeScript** - Type-safe development
- **whisper.rn** ^0.4.3 - React Native bindings for Whisper.cpp
- **react-native-fs** - File system operations
- **@siteed/expo-audio-studio** - Audio recording utilities

### Model Management

- **Automatic downloads** - Models download from HuggingFace on first use
- **Local caching** - Models stored in app's Documents directory
- **Progress tracking** - Real-time download progress indicators
- **Easy switching** - Change models without app restart

### Performance Optimizations

- **Lazy model loading** - Only downloads selected models
- **Efficient state management** - React hooks for optimal re-renders
- **Incremental updates** - Real-time transcription shows only new text
- **Memory management** - Proper cleanup on component unmount

## 🎯 Model Comparison

| Model     | Size  | Download | Speed   | Accuracy  | Best For                                 |
| --------- | ----- | -------- | ------- | --------- | ---------------------------------------- |
| **Tiny**  | 39MB  | ~5s      | Fastest | Basic     | Quick tests, simple speech               |
| **Base**  | 74MB  | ~10s     | Fast    | Good      | General conversations                    |
| **Small** | 244MB | ~30s     | Medium  | Very Good | Technical discussions, accuracy-critical |

## 🔧 Configuration

### Audio Session (iOS)

```typescript
audioSessionOnStartIos: {
  category: "PlayAndRecord",
  options: ["MixWithOthers"],
  mode: "Default",
}
```

### Transcription Options

```typescript
{
  language: "en",
  translate: false,
  word_timestamps: false,
  max_len: 0,
  split_on_word: false,
}
```

## 📝 Development

### Key Hooks

#### `useWhisperModels()`

Manages Whisper model lifecycle:

- Model downloading and caching
- Context initialization
- Progress tracking
- Model switching

#### `useAudioRecorder()`

Handles audio recording:

- 16kHz sample rate
- Mono channel
- 16-bit depth
- WAV format output

### State Management

- **React Hooks** - useState, useEffect, useCallback
- **Context-free** - Self-contained component state
- **Performance optimized** - Minimal re-renders

## 🚧 Known Limitations

### Real-time Transcription

- **Session length** - Very long sessions may impact performance
- **Background processing** - Limited by OS policies (iOS/Android)
- **Model constraints** - Tiny model struggles with complex/technical terms
- **Latency** - Small delay between speech and transcription

### File Transcription

- **Format support** - Currently supports WAV files
- **File size** - Large files may take longer to process
- **Memory usage** - Models consume device RAM during processing

## 🤝 Contributing

Contributions are welcome! This project demonstrates:

- Real-time audio processing
- AI model integration in React Native
- Cross-platform mobile development
- Modern React patterns and hooks

## 📚 Resources

- **whisper.rn** - [GitHub Repository](https://github.com/mybigday/whisper.rn)
- **Whisper.cpp** - [OpenAI Whisper C++ port](https://github.com/ggerganov/whisper.cpp)
- **Expo Documentation** - [docs.expo.dev](https://docs.expo.dev)
- **React Native** - [reactnative.dev](https://reactnative.dev)

## 📄 License

MIT License - Feel free to use this project as a reference or starting point for your own applications.

## 👨‍💻 Author

Created by **Beto Moedano**

- GitHub: [@betomoedano](https://github.com/betomoedano)

## 🙏 Acknowledgments

- **whisper.rn team** - For the excellent React Native bindings
- **OpenAI** - For the Whisper speech recognition model
- **Expo team** - For amazing development tools
- **Community contributors** - For testing and feedback

---

**Note:** Model files (\*.bin) are not included in the repository due to size constraints. They download automatically on first use.
