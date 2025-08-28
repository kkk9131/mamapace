# Project Overview: MamaPace

## Purpose
MamaPace is a React Native social media application built with Expo that features:
- Social media posts with comments and reactions
- Real-time chat functionality
- Room-based communication system (spaces, channels, anonymous rooms)
- User profiles and authentication
- Mobile-first design with blur effects and animations

## Tech Stack
- **Framework**: React Native with Expo (v53)
- **Language**: TypeScript with strict type checking
- **Navigation**: React Navigation 6
- **Backend**: Supabase (authentication, database, real-time)
- **UI**: Expo Blur, Linear Gradient, Haptics
- **State Management**: React Context + Custom Hooks
- **Testing**: Jest with React Native Testing Library, Detox for E2E
- **Styling**: React Native built-in styling with theme system

## Key Technologies
- React Native 0.79.5
- TypeScript 5.8.3
- Expo SDK 53
- Supabase 2.54.0
- React Navigation 6
- React Native Gesture Handler
- Expo Blur, Linear Gradient, Haptics

## Architecture
- **Entry Point**: App.js with LinearGradient background
- **Navigation**: RootNavigator with tab-based navigation
- **Screens**: Multiple screens for different features
- **Components**: Reusable UI components
- **Services**: API layer for Supabase integration
- **Types**: Strong TypeScript typing throughout
- **Contexts**: Authentication and other global state
- **Hooks**: Custom hooks for data fetching and state management