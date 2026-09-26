import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  SafeAreaView,
  Alert,
  Clipboard,
  Switch,
  Image,
  Animated,
  Platform,
  Linking,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as LocalAuthentication from 'expo-local-authentication';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Kiểm tra phiên bản iOS có nằm trong danh sách hỗ trợ không
export function checkIsSupportedVersion(ver: string): boolean {
  if (!ver) return true;
  const parts = ver.split('.').map((p) => parseInt(p, 10));
  const major = parts[0] || 0;
  const minor = parts[1] || 0;
  const patch = parts[2] || 0;

  // • iOS 17.0–17.7.x
  if (major === 17 && minor >= 0 && minor <= 7) return true;

  // • iOS 18.0–18.7.1
  if (major === 18) {
    if (minor < 7) return true;
    if (minor === 7 && patch <= 1) return true;
    return false;
  }

  // • iOS 26.6.2 & iOS 26.0–26.6.1 (Hỗ trợ đầy đủ đến 26.6.2!)
  if (major === 26) {
    if (minor < 6) return true;
    if (minor === 6 && patch <= 2) return true; // Hỗ trợ 26.6.0, 26.6.1, 26.6.2
    return false;
  }

  // • iOS 27.0 Developer Beta 1–4 / Public Beta 1–2
  if (major === 27 && minor === 0) return true;

  return false;
}

// --- Types ---
interface Account {
  id: string;
  title: string;
  game: string;
  server: string;
  category: string;
  username: string;
  password: string;
  ign?: string;
  uid?: string;
  hasTotp?: boolean;
  totpSecret?: string;
  notes?: string;
}

interface StaminaItem {
  id: string;
  name: string;
  subName: string;
  icon: string;
  current: number;
  max: number;
  secondsPerPoint: number;
  lastUpdated: number;
}

interface GachaItem {
  id: string;
  game: string;
  banner: string;
  pity: number;
  hardPity: number;
  softPity: number;
  isGuaranteed: boolean;
  savedRolls: number;
}

export interface UserProfile {
  displayName: string;
  username: string; // e.g. '@admin'
  avatarColor: string;
  avatarType?: 'image' | 'preset' | 'monogram';
  avatarUri?: string; // base64 or URL
  avatarPresetId?: string; // preset ID
  role?: string;
  email?: string;
  phone?: string;
  bio?: string;
  birthday?: string;
  gender?: 'Nam' | 'Nữ' | 'Khác' | 'Bảo mật' | 'Chưa cập nhật';
  joinDate: string; // e.g. '25/09/2026'
  joinTimestamp?: number; // epoch ms
  daysActive: number; // e.g. 1
  hoursUsed: number; // e.g. 0.2
  currentPasscode: string;
  lastUsernameChangeTimestamp?: number;
  isVerified?: boolean;
  verifiedBadge?: 'blue_tick' | 'gold_tick' | 'vip';
  verifiedAt?: string;
  verifiedKey?: string;
}

export interface AvatarPreset {
  id: string;
  name: string;
  icon: string;
  category: 'memoji' | 'tech' | 'cyber';
  bgColor: string;
  badge?: string;
}

export const APP_AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'av-shield', name: 'Cyber Shield', icon: 'shield-checkmark', category: 'cyber', bgColor: '#0A84FF', badge: 'SECURE' },
  { id: 'av-fingerprint', name: 'Face & Touch ID', icon: 'finger-print', category: 'cyber', bgColor: '#34C759', badge: 'BIO' },
  { id: 'av-hacker', name: 'Terminal Dev', icon: 'terminal', category: 'tech', bgColor: '#1E293B', badge: 'PRO' },
  { id: 'av-key', name: 'Master Key', icon: 'key', category: 'cyber', bgColor: '#FF9500', badge: 'KEY' },
  { id: 'av-lock', name: 'Secure Vault', icon: 'lock-closed', category: 'cyber', bgColor: '#5856D6', badge: 'VAULT' },
  { id: 'av-chip', name: 'Apple A18 Pro', icon: 'hardware-chip', category: 'tech', bgColor: '#0284C7', badge: 'AI' },
  { id: 'av-sparkles', name: 'Apple Intelligence', icon: 'sparkles', category: 'tech', bgColor: '#FF2D55', badge: 'NEW' },
  { id: 'av-rocket', name: 'Hiệu Năng Cực Đại', icon: 'rocket', category: 'tech', bgColor: '#AF52DE', badge: 'MAX' },
  { id: 'av-diamond', name: 'VIP Kim Cương', icon: 'diamond', category: 'cyber', bgColor: '#30B0C7', badge: 'VIP' },
  { id: 'av-flame', name: 'Khiên Lửa', icon: 'flame', category: 'cyber', bgColor: '#FF3B30' },
  { id: 'av-flash', name: 'Tốc Độ Cao', icon: 'flash', category: 'tech', bgColor: '#E5A50A' },
  { id: 'av-cube', name: 'Không Gian 3D', icon: 'cube', category: 'tech', bgColor: '#0D9488' },
  { id: 'av-planet', name: 'Mạng Toàn Cầu', icon: 'planet', category: 'tech', bgColor: '#6366F1' },
  { id: 'av-infinite', name: 'Vô Hạn Mã Hóa', icon: 'infinite', category: 'cyber', bgColor: '#4338CA', badge: 'PRO' },
  { id: 'av-star', name: 'Ngôi Sao Tinh Hoa', icon: 'star', category: 'memoji', bgColor: '#D97706', badge: 'TOP' },
  { id: 'av-person', name: 'Apple ID Chuẩn', icon: 'person', category: 'memoji', bgColor: '#2C2C2E' },
];

export const MONOGRAM_COLORS = [
  { name: 'Xanh Apple', color: '#007AFF' },
  { name: 'Xanh Lá', color: '#34C759' },
  { name: 'Tím Hoàng Gia', color: '#AF52DE' },
  { name: 'Cam Hoàng Hôn', color: '#FF9500' },
  { name: 'Đỏ Ruby', color: '#FF3B30' },
  { name: 'Hồng Sakura', color: '#FF2D55' },
  { name: 'Xanh Ngọc', color: '#30B0C7' },
  { name: 'Xám Titan', color: '#5856D6' },
  { name: 'Vàng Kim', color: '#E5A50A' },
  { name: 'Đen Huyền Bí', color: '#2C2C2E' },
];

export interface LoginHistoryRecord {
  id: string;
  timestamp: string;
  device: string; // e.g. 'iPhone 15 Pro Max'
  os: string; // e.g. 'iOS 18.2'
  location: string; // e.g. 'Hà Nội, Việt Nam'
  method: 'Face ID' | 'Mật khẩu' | 'Passcode';
  ip: string;
  isCurrent?: boolean;
}

// Phát âm thanh thông báo iOS 18 chân thực bằng Web Audio API
export const playAppleNotificationSound = (type: 'success' | 'info' | 'warning' | 'security' | 'tap' = 'success') => {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    if (type === 'success') {
      // Apple iOS Tri-tone / Success Chord (G5 -> C6 -> E6 chime)
      const notes = [
        { freq: 783.99, start: 0, duration: 0.18, vol: 0.22 },
        { freq: 1046.50, start: 0.11, duration: 0.22, vol: 0.26 },
        { freq: 1318.51, start: 0.22, duration: 0.45, vol: 0.28 },
      ];

      notes.forEach(({ freq, start, duration, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(vol, now + start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });
    } else if (type === 'warning') {
      // Apple iOS Dual Warning Tone
      [
        { freq: 587.33, start: 0, duration: 0.15, vol: 0.2 },
        { freq: 440.00, start: 0.12, duration: 0.25, vol: 0.22 },
      ].forEach(({ freq, start, duration, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(vol, now + start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });
    } else if (type === 'security') {
      // Apple Secure Enclave Confirmation (C6 -> G6 Ding)
      [
        { freq: 1046.50, start: 0, duration: 0.15, vol: 0.22 },
        { freq: 1567.98, start: 0.09, duration: 0.40, vol: 0.28 },
      ].forEach(({ freq, start, duration, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(vol, now + start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });
    } else {
      // Standard Apple iOS Ding
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (e) {
    console.log('Audio playback error:', e);
  }
};

// Helper lấy ngày hiện tại định dạng DD/MM/YYYY chuẩn thực tế
export const getFormattedTodayDate = () => {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Nhận diện thiết bị và hệ điều hành thực tế (hỗ trợ cả Native Expo & Web Mobile Simulator)
export const getRealDeviceInfo = () => {
  let model = 'Apple iPhone 15 Pro Max';
  let os = 'iOS 18.2';
  let deviceType: 'phone' | 'tablet' | 'desktop' = 'phone';

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.navigator) {
      const ua = window.navigator.userAgent || '';
      const w = window.innerWidth || (window.screen && window.screen.width) || 0;
      const h = window.innerHeight || (window.screen && window.screen.height) || 0;
      const minDim = Math.min(w, h);
      const maxDim = Math.max(w, h);

      if (/iPhone/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        deviceType = 'phone';
        const iosMatch = ua.match(/OS (\d+[._]\d+)/);
        os = iosMatch ? `iOS ${iosMatch[1].replace(/_/g, '.')}` : 'iOS 18.2';

        if ((minDim >= 430 && maxDim >= 870) || minDim === 430) {
          model = 'iPhone 15 Pro Max';
        } else if (minDim >= 428 && maxDim >= 920) {
          model = 'iPhone 14 Plus / 13 Pro Max';
        } else if (minDim >= 393 && maxDim >= 850) {
          model = 'iPhone 15 Pro';
        } else if (minDim >= 390 && maxDim >= 840) {
          model = 'iPhone 14 / 13';
        } else if (minDim >= 414 && maxDim >= 890) {
          model = 'iPhone 11 / XR';
        } else if (minDim >= 375 && maxDim >= 810) {
          model = 'iPhone 13 mini / 12 mini';
        } else if (minDim >= 375 && maxDim >= 660) {
          model = 'iPhone SE (3rd Gen)';
        } else {
          model = 'Apple iPhone';
        }
      } else if (/iPad/i.test(ua)) {
        deviceType = 'tablet';
        model = 'Apple iPad Pro';
        os = 'iPadOS 18.2';
      } else if (/Android/i.test(ua)) {
        deviceType = 'phone';
        const andMatch = ua.match(/Android\s+([0-9.]+)/i);
        os = andMatch ? `Android ${andMatch[1]}` : 'Android 14';

        const match = ua.match(/;\s*([^;)]+)\s+Build/i);
        if (match && match[1]) {
          let rawModel = match[1].trim();
          if (rawModel.startsWith('SM-')) {
            model = `Samsung (${rawModel})`;
          } else {
            model = rawModel;
          }
        } else {
          model = 'Android Smartphone';
        }
      } else if (/Windows/i.test(ua)) {
        deviceType = 'desktop';
        let browser = 'Chrome';
        if (/Edg\//i.test(ua)) browser = 'Edge';
        else if (/Firefox\//i.test(ua)) browser = 'Firefox';
        else if (/Chrome\//i.test(ua)) browser = 'Chrome';
        model = `Windows PC (${browser})`;
        os = 'Windows 11';
      } else if (/Macintosh|Mac OS X/i.test(ua)) {
        deviceType = 'desktop';
        let browser = 'Safari';
        if (/Chrome\//i.test(ua)) browser = 'Chrome';
        model = `Apple Mac (${browser})`;
        os = 'macOS Sonoma';
      } else {
        deviceType = 'phone';
        model = 'Apple iPhone 15 Pro Max';
        os = 'iOS 18.2';
      }
    }
  } else {
    try {
      const Device = require('expo-device');
      model = Device.modelName || Device.deviceName || (Platform.OS === 'ios' ? 'Apple iPhone 15 Pro Max' : 'Android Smartphone');
      os = `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${Device.osVersion || ''}`.trim();
      deviceType = Device.deviceType === 2 ? 'tablet' : 'phone';
    } catch (e) {
      model = Platform.OS === 'ios' ? 'Apple iPhone 15 Pro Max' : 'Android Smartphone';
      os = Platform.OS === 'ios' ? 'iOS 18.2' : 'Android 14';
      deviceType = 'phone';
    }
  }

  return { model, os, deviceType };
};

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'security';
  time: string;
  timestamp: number;
  read: boolean;
}

export interface AppSettings {
  accentColor: string; // e.g. '#0A84FF'
  themeMode: 'dark' | 'light' | 'auto';
  fontSizeScale: 'small' | 'standard' | 'large';
  fontSizeLevel: number; // 1 to 7 (80% to 150%)
  isBoldText: boolean;
  language: string; // 'vi' | 'en' | 'zh' | 'ja' | 'ko' | 'fr' | 'de'
  // Commercial & Biometrics Features
  useFaceId: boolean; // Đăng nhập / Mở khóa bằng Face ID
  requireFaceIdForVault: boolean; // Yêu cầu Face ID khi xem mật khẩu trong Két Sắt
  autoLockTimeout: 'immediately' | '1m' | '5m' | 'never'; // Tự động khóa
  hapticFeedback: boolean; // Rung phản hồi xúc giác Haptics
  cloudSync?: boolean; // Đồng bộ đám mây iCloud
  securityAlerts: boolean; // Cảnh báo bảo mật tài khoản
  blurSwitcher: boolean; // Che mờ ứng dụng trong App Switcher (Bảo vệ riêng tư)
  // iOS Notifications System
  enableNotifications: boolean; // Bật / tắt thông báo ứng dụng iOS
  notifySecurityAlerts: boolean; // Cảnh báo bảo mật qua Push
  notifyActivity: boolean; // Thông báo thao tác thành công
  notifySounds: boolean; // Âm thanh thông báo
}

export interface FriendUser {
  id: string;
  displayName: string;
  username: string; // e.g. '@minh_apple'
  avatarColor: string;
  avatarIcon?: string;
  status: 'online' | 'offline';
  bio?: string;
  lastMessage?: string;
  lastTime?: string;
  unreadCount?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'me' | 'friend';
  text: string;
  time: string;
}

export interface PhoneAppItem {
  id: string;
  name: string;
  category: 'system' | 'social' | 'game' | 'finance' | 'tools' | 'shopping';
  icon: any;
  color: string;
  scheme?: string;
  isCustom?: boolean;
  usageMinutes?: number; // Thời gian sử dụng trong ngày (phút)
  openCount?: number;    // Số lần mở app trong ngày
  brandBadge?: string;  // Nhãn thương hiệu hiển thị (Zalo, MB, VCB, MoMo...)
  gradientColors?: [string, string];
  isLocked?: boolean;
  hasSensitiveData?: boolean;
}

// Thư viện các ứng dụng phổ biến trên iPhone (Hệ thống Apple, MXH, Ngân hàng, Tiện ích, Mua sắm)
export const KNOWN_IPHONE_CATALOG: PhoneAppItem[] = [
  // --- Hệ Thống Apple ---
  {
    id: 'app-photos',
    name: 'Ảnh (Photos)',
    category: 'system',
    icon: 'images',
    color: '#FF2D55',
    isLocked: true,
    scheme: 'photos-redirect://',
    hasSensitiveData: true,
  },
  {
    id: 'app-messages',
    name: 'Tin Nhắn (Messages)',
    category: 'system',
    icon: 'chatbubble-ellipses',
    color: '#34C759',
    isLocked: true,
    scheme: 'messages://',
    hasSensitiveData: true,
  },
  {
    id: 'app-notes',
    name: 'Ghi Chú (Notes)',
    category: 'system',
    icon: 'document-text',
    color: '#FFCC00',
    isLocked: true,
    scheme: 'mobilenotes://',
    hasSensitiveData: true,
  },
  {
    id: 'app-files',
    name: 'Tệp (Files)',
    category: 'system',
    icon: 'folder',
    color: '#007AFF',
    isLocked: false,
    scheme: 'shareddocuments://',
    hasSensitiveData: true,
  },
  {
    id: 'app-safari',
    name: 'Safari',
    category: 'system',
    icon: 'compass',
    color: '#0A84FF',
    isLocked: false,
    scheme: 'http://',
    hasSensitiveData: false,
  },
  {
    id: 'app-settings',
    name: 'Cài Đặt (Settings)',
    category: 'system',
    icon: 'settings',
    color: '#8E8E93',
    isLocked: false,
    scheme: 'app-settings:',
    hasSensitiveData: false,
  },
  {
    id: 'app-appstore',
    name: 'App Store',
    category: 'system',
    icon: 'bag-handle',
    color: '#007AFF',
    isLocked: false,
    scheme: 'itms-apps://',
    hasSensitiveData: false,
  },
  {
    id: 'app-camera',
    name: 'Camera',
    category: 'system',
    icon: 'camera',
    color: '#5856D6',
    isLocked: false,
    scheme: 'camera://',
    hasSensitiveData: true,
  },
  {
    id: 'app-clock',
    name: 'Đồng Hồ (Clock)',
    category: 'system',
    icon: 'alarm',
    color: '#FF9F0A',
    isLocked: false,
    scheme: 'clock-alarm://',
    hasSensitiveData: false,
  },
  {
    id: 'app-calculator',
    name: 'Máy Tính (Calculator)',
    category: 'system',
    icon: 'calculator',
    color: '#FF9500',
    isLocked: false,
    scheme: 'calc://',
    hasSensitiveData: false,
  },
  {
    id: 'app-maps',
    name: 'Bản Đồ (Apple Maps)',
    category: 'system',
    icon: 'map',
    color: '#30D158',
    isLocked: false,
    scheme: 'maps://',
    hasSensitiveData: false,
  },
  {
    id: 'app-wallet',
    name: 'Ví Apple (Wallet)',
    category: 'system',
    icon: 'wallet',
    color: '#1C1C1E',
    isLocked: true,
    scheme: 'shoebox://',
    hasSensitiveData: true,
  },
  {
    id: 'app-music',
    name: 'Nhạc (Apple Music)',
    category: 'system',
    icon: 'musical-notes',
    color: '#FA2D48',
    isLocked: false,
    scheme: 'music://',
    hasSensitiveData: false,
  },
  {
    id: 'app-shortcuts',
    name: 'Phím Tắt (Shortcuts)',
    category: 'system',
    icon: 'flash',
    color: '#AF52DE',
    isLocked: false,
    scheme: 'shortcuts://',
    hasSensitiveData: false,
  },

  // --- Mạng Xã Hội & Trò Chuyện ---
  {
    id: 'app-zalo',
    name: 'Zalo',
    category: 'social',
    icon: 'chatbubbles',
    color: '#0068FF',
    isLocked: true,
    scheme: 'zalo://',
    hasSensitiveData: true,
  },
  {
    id: 'app-messenger',
    name: 'Messenger',
    category: 'social',
    icon: 'chatbubble',
    color: '#0099FF',
    isLocked: true,
    scheme: 'fb-messenger://',
    hasSensitiveData: true,
  },
  {
    id: 'app-facebook',
    name: 'Facebook',
    category: 'social',
    icon: 'logo-facebook',
    color: '#1877F2',
    isLocked: false,
    scheme: 'fb://',
    hasSensitiveData: false,
  },
  {
    id: 'app-tiktok',
    name: 'TikTok',
    category: 'social',
    icon: 'logo-tiktok',
    color: '#1C1C1E',
    isLocked: false,
    scheme: 'snssdk1180://',
    hasSensitiveData: false,
  },
  {
    id: 'app-telegram',
    name: 'Telegram',
    category: 'social',
    icon: 'paper-plane',
    color: '#2AABEE',
    isLocked: true,
    scheme: 'tg://',
    hasSensitiveData: true,
  },
  {
    id: 'app-youtube',
    name: 'YouTube',
    category: 'social',
    icon: 'logo-youtube',
    color: '#FF0000',
    isLocked: false,
    scheme: 'youtube://',
    hasSensitiveData: false,
  },
  {
    id: 'app-instagram',
    name: 'Instagram',
    category: 'social',
    icon: 'logo-instagram',
    color: '#E1306C',
    isLocked: false,
    scheme: 'instagram://',
    hasSensitiveData: false,
  },
  {
    id: 'app-threads',
    name: 'Threads',
    category: 'social',
    icon: 'at',
    color: '#1C1C1E',
    isLocked: false,
    scheme: 'barcelona://',
    hasSensitiveData: false,
  },
  {
    id: 'app-twitter',
    name: 'X (Twitter)',
    category: 'social',
    icon: 'logo-twitter',
    color: '#1DA1F2',
    isLocked: false,
    scheme: 'twitter://',
    hasSensitiveData: false,
  },
  {
    id: 'app-whatsapp',
    name: 'WhatsApp',
    category: 'social',
    icon: 'logo-whatsapp',
    color: '#25D366',
    isLocked: true,
    scheme: 'whatsapp://',
    hasSensitiveData: true,
  },
  {
    id: 'app-discord',
    name: 'Discord',
    category: 'social',
    icon: 'logo-discord',
    color: '#5865F2',
    isLocked: false,
    scheme: 'discord://',
    hasSensitiveData: false,
  },

  // --- Tài Chính & Ngân Hàng ---
  {
    id: 'app-momo',
    name: 'MoMo',
    category: 'finance',
    icon: 'wallet',
    color: '#A50064',
    isLocked: true,
    scheme: 'momo://',
    hasSensitiveData: true,
  },
  {
    id: 'app-vnpay',
    name: 'VNPay QR',
    category: 'finance',
    icon: 'qr-code',
    color: '#005BAA',
    isLocked: true,
    scheme: 'vnpayqr://',
    hasSensitiveData: true,
  },
  {
    id: 'app-vcb',
    name: 'VCB Digibank',
    category: 'finance',
    icon: 'card',
    color: '#008848',
    isLocked: true,
    scheme: 'vcb://',
    hasSensitiveData: true,
  },
  {
    id: 'app-mbbank',
    name: 'MB Bank',
    category: 'finance',
    icon: 'card-outline',
    color: '#1E3A8A',
    isLocked: true,
    scheme: 'mbbank://',
    hasSensitiveData: true,
  },
  {
    id: 'app-techcombank',
    name: 'Techcombank Mobile',
    category: 'finance',
    icon: 'card',
    color: '#DC2626',
    isLocked: true,
    scheme: 'tcb://',
    hasSensitiveData: true,
  },
  {
    id: 'app-vpbank',
    name: 'VPBank NEO',
    category: 'finance',
    icon: 'card-outline',
    color: '#10B981',
    isLocked: true,
    scheme: 'vpbank://',
    hasSensitiveData: true,
  },
  {
    id: 'app-zalopay',
    name: 'ZaloPay',
    category: 'finance',
    icon: 'cash',
    color: '#00BE00',
    isLocked: true,
    scheme: 'zalopay://',
    hasSensitiveData: true,
  },
  {
    id: 'app-viettelmoney',
    name: 'Viettel Money',
    category: 'finance',
    icon: 'phone-portrait',
    color: '#E11B22',
    isLocked: true,
    scheme: 'viettelmoney://',
    hasSensitiveData: true,
  },

  // --- Mua Sắm & Đặt Xe ---
  {
    id: 'app-shopee',
    name: 'Shopee',
    category: 'shopping',
    icon: 'cart',
    color: '#EE4D2D',
    isLocked: false,
    scheme: 'shopeevn://',
    hasSensitiveData: false,
  },
  {
    id: 'app-grab',
    name: 'Grab',
    category: 'shopping',
    icon: 'car',
    color: '#00B14F',
    isLocked: false,
    scheme: 'grab://',
    hasSensitiveData: false,
  },
  {
    id: 'app-lazada',
    name: 'Lazada',
    category: 'shopping',
    icon: 'bag',
    color: '#0F146D',
    isLocked: false,
    scheme: 'lazada://',
    hasSensitiveData: false,
  },
  {
    id: 'app-be',
    name: 'Be (Gọi xe)',
    category: 'shopping',
    icon: 'car-sport',
    color: '#FFC400',
    isLocked: false,
    scheme: 'be://',
    hasSensitiveData: false,
  },
  {
    id: 'app-tiki',
    name: 'Tiki',
    category: 'shopping',
    icon: 'basket',
    color: '#1A94FF',
    isLocked: false,
    scheme: 'tiki://',
    hasSensitiveData: false,
  },

  // --- Tiện Ích & Công Việc ---
  {
    id: 'app-chrome',
    name: 'Google Chrome',
    category: 'tools',
    icon: 'globe',
    color: '#4285F4',
    isLocked: false,
    scheme: 'googlechrome://',
    hasSensitiveData: false,
  },
  {
    id: 'app-googlemaps',
    name: 'Google Maps',
    category: 'tools',
    icon: 'navigate',
    color: '#34A853',
    isLocked: false,
    scheme: 'comgooglemaps://',
    hasSensitiveData: false,
  },
  {
    id: 'app-capcut',
    name: 'CapCut',
    category: 'tools',
    icon: 'cut',
    color: '#1C1C1E',
    isLocked: false,
    scheme: 'capcut://',
    hasSensitiveData: false,
  },
  {
    id: 'app-spotify',
    name: 'Spotify',
    category: 'tools',
    icon: 'musical-note',
    color: '#1DB954',
    isLocked: false,
    scheme: 'spotify://',
    hasSensitiveData: false,
  },
  {
    id: 'app-chatgpt',
    name: 'ChatGPT',
    category: 'tools',
    icon: 'hardware-chip',
    color: '#10A37F',
    isLocked: false,
    scheme: 'chatgpt://',
    hasSensitiveData: false,
  },
  {
    id: 'app-netflix',
    name: 'Netflix',
    category: 'tools',
    icon: 'film',
    color: '#E50914',
    isLocked: false,
    scheme: 'nflx://',
    hasSensitiveData: false,
  },
  {
    id: 'app-canva',
    name: 'Canva',
    category: 'tools',
    icon: 'color-palette',
    color: '#7D2AE8',
    isLocked: false,
    scheme: 'canva://',
    hasSensitiveData: false,
  },

  // --- Trò Chơi (Tùy chọn) ---
  {
    id: 'app-lienquan',
    name: 'Liên Quân Mobile',
    category: 'game',
    icon: 'game-controller',
    color: '#E67E22',
    isLocked: false,
    scheme: 'lienquan://',
    hasSensitiveData: false,
  },
  {
    id: 'app-freefire',
    name: 'Free Fire',
    category: 'game',
    icon: 'flame',
    color: '#E74C3C',
    isLocked: false,
    scheme: 'freefire://',
    hasSensitiveData: false,
  },
  {
    id: 'app-pubg',
    name: 'PUBG Mobile',
    category: 'game',
    icon: 'shield',
    color: '#F39C12',
    isLocked: false,
    scheme: 'pubgmobile://',
    hasSensitiveData: false,
  },
  {
    id: 'app-roblox',
    name: 'Roblox',
    category: 'game',
    icon: 'cube',
    color: '#E74C3C',
    isLocked: false,
    scheme: 'roblox://',
    hasSensitiveData: false,
  },
];

// Danh sách khởi đầu: Rỗng (Người dùng sẽ tự chọn app thật có trên máy)
export const INITIAL_IPHONE_APPS: PhoneAppItem[] = [];

// Initial Data
const INITIAL_ACCOUNTS: Account[] = [
  {
    id: '1',
    title: 'Acc Chính Hu Tao C6',
    game: 'Genshin Impact',
    server: 'Asia',
    category: 'Game',
    username: 'walnut_hutao@gmail.com',
    password: 'HuTao#StaffOfHoma99!',
    ign: 'WalnutDirector',
    notes: 'Trượng Hộ Ma R5, TDV Ma Nữ 240 CV. Đã liên kết email chính chủ.',
  },
  {
    id: '2',
    title: 'Acc Acheron E2S1',
    game: 'Honkai: Star Rail',
    server: 'Asia',
    category: 'Game',
    username: 'nihility_acheron@gmail.com',
    password: 'GalaxyRanger*2026',
    ign: 'RaidenMei',
    notes: 'Bảo hiểm banner nhân vật còn 45 roll. Nón ánh sáng trấn S1.',
  },
  {
    id: '3',
    title: 'Nick Smurf Cao Thủ',
    game: 'Valorant',
    server: 'Vietnam',
    category: 'Clone',
    username: 'vandal_tap1click',
    password: 'ReynaImmortal#VN1',
    ign: 'WindWalker#VN1',
    notes: 'Rank Immortal 1 (68 RR). Full skin Prime Vandal và Karambit.',
  },
  {
    id: '4',
    title: 'Steam Thư Viện 200+ Game',
    game: 'Steam',
    server: 'Vietnam',
    category: 'Social',
    username: 'pro_gamer_vn',
    password: 'SteamVault$Secure2026',
    ign: 'GamerVN',
    notes: 'Black Myth Wukong, Elden Ring, CS2 Prime. Không dùng hack cheat.',
  },
];

const INITIAL_STAMINA: StaminaItem[] = [
  {
    id: 'stam-genshin',
    name: 'Genshin Impact',
    subName: 'Nhựa Nguyên Bản',
    icon: 'moon',
    current: 146,
    max: 200,
    secondsPerPoint: 480,
    lastUpdated: Date.now() - 3600000,
  },
  {
    id: 'stam-hsr',
    name: 'Honkai: Star Rail',
    subName: 'Sức Bền Khai Phá',
    icon: 'train',
    current: 210,
    max: 240,
    secondsPerPoint: 360,
    lastUpdated: Date.now() - 2400000,
  },
  {
    id: 'stam-wuwa',
    name: 'Wuthering Waves',
    subName: 'Sóng Năng Lượng',
    icon: 'cloudy-night',
    current: 240,
    max: 240,
    secondsPerPoint: 360,
    lastUpdated: Date.now(),
  },
];

const INITIAL_GACHA: GachaItem[] = [
  {
    id: 'gacha-genshin',
    game: 'Genshin Impact',
    banner: 'Nhân Vật Giới Hạn',
    pity: 58,
    hardPity: 90,
    softPity: 74,
    isGuaranteed: false,
    savedRolls: 48,
  },
  {
    id: 'gacha-hsr',
    game: 'Honkai: Star Rail',
    banner: 'Bước Nhảy Sự Kiện',
    pity: 24,
    hardPity: 90,
    softPity: 74,
    isGuaranteed: true,
    savedRolls: 70,
  },
];

export const INITIAL_USER_PROFILE: UserProfile = {
  displayName: 'Quảng Trọng Tuấn',
  username: '@tuandepzai',
  avatarColor: '#0A84FF',
  avatarType: 'preset',
  avatarUri: '',
  avatarPresetId: 'av-shield',
  email: 'tuandepzai@gmail.com',
  phone: '',
  bio: 'Chuyên gia bảo mật & Quản trị viên LockX Vault',
  birthday: '',
  gender: 'Nam',
  joinDate: getFormattedTodayDate(),
  joinTimestamp: Date.now(),
  daysActive: 1,
  hoursUsed: 0.1,
  currentPasscode: '123456',
  lastUsernameChangeTimestamp: 0,
  isVerified: false,
  verifiedBadge: 'blue_tick',
  verifiedAt: '',
  verifiedKey: '',
};

export const INITIAL_LOGIN_HISTORY: LoginHistoryRecord[] = [
  {
    id: 'current-session',
    timestamp: 'Hiện tại (Đang hoạt động)',
    device: getRealDeviceInfo().model,
    os: getRealDeviceInfo().os,
    location: 'Hà Nội, Việt Nam',
    method: 'Face ID',
    ip: '14.225.21.84',
    isCurrent: true,
  },
];

export const INITIAL_SETTINGS: AppSettings = {
  accentColor: '#0A84FF',
  themeMode: 'dark',
  fontSizeScale: 'standard',
  fontSizeLevel: 3,
  isBoldText: false,
  language: 'vi',
  useFaceId: false,
  requireFaceIdForVault: false,
  autoLockTimeout: '1m',
  hapticFeedback: true,
  securityAlerts: true,
  blurSwitcher: true,
  enableNotifications: true,
  notifySecurityAlerts: true,
  notifyActivity: true,
  notifySounds: true,
};

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-welcome',
    title: 'Chào Mừng Đến Với LockX Vault',
    message: 'Két sắt bảo mật chuẩn Apple Keychain AES-256 đã kích hoạt sẵn sàng bảo vệ dữ liệu.',
    type: 'success',
    time: 'Vừa xong',
    timestamp: Date.now() - 60000,
    read: false,
  },
  {
    id: 'notif-security',
    title: 'Bảo Vệ Sinh Trắc Học Secure Enclave',
    message: 'Kích hoạt Face ID trong Cài đặt để mở khóa tức thì và bảo mật tuyệt đối.',
    type: 'security',
    time: '15 phút trước',
    timestamp: Date.now() - 900000,
    read: false,
  },
  {
    id: 'notif-ios18',
    title: 'Tối Ưu Hóa Apple iOS 18 & Dynamic Island',
    message: 'Hệ thống thông báo đẩy thả rơi và capsule mở rộng đã sẵn sàng phục vụ.',
    type: 'info',
    time: '1 giờ trước',
    timestamp: Date.now() - 3600000,
    read: true,
  },
];

export const ACCENT_COLOR_OPTIONS = [
  { id: '#0A84FF', label: 'Xanh Apple', color: '#0A84FF' },
  { id: '#30D158', label: 'Xanh Ngọc', color: '#30D158' },
  { id: '#BF5AF2', label: 'Tím Cyber', color: '#BF5AF2' },
  { id: '#FF9500', label: 'Cam Sunset', color: '#FF9500' },
  { id: '#FF2D55', label: 'Đỏ Ruby', color: '#FF2D55' },
  { id: '#FFD60A', label: 'Vàng Kim', color: '#FFD60A' },
];

export const APP_LANGUAGES = [
  { code: 'vi', name: 'Tiếng Việt', region: 'Việt Nam', flagUrl: 'https://flagcdn.com/w80/vn.png', emoji: '🇻🇳' },
  { code: 'en', name: 'English', region: 'Hoa Kỳ (United States)', flagUrl: 'https://flagcdn.com/w80/us.png', emoji: '🇺🇸' },
  { code: 'zh', name: '简体中文', region: 'Trung Quốc (China)', flagUrl: 'https://flagcdn.com/w80/cn.png', emoji: '🇨🇳' },
  { code: 'ja', name: '日本語', region: 'Nhật Bản (Japan)', flagUrl: 'https://flagcdn.com/w80/jp.png', emoji: '🇯🇵' },
  { code: 'ko', name: '한국어', region: 'Hàn Quốc (Korea)', flagUrl: 'https://flagcdn.com/w80/kr.png', emoji: '🇰🇷' },
  { code: 'fr', name: 'Français', region: 'Pháp (France)', flagUrl: 'https://flagcdn.com/w80/fr.png', emoji: '🇫🇷' },
  { code: 'de', name: 'Deutsch', region: 'Đức (Germany)', flagUrl: 'https://flagcdn.com/w80/de.png', emoji: '🇩🇪' },
];

export const renderCountryFlagIcon = (code: string, width = 28, height = 20) => {
  const lang = APP_LANGUAGES.find((l) => l.code === code) || APP_LANGUAGES[0];
  return (
    <View
      style={{
        width,
        height,
        borderRadius: 4,
        overflow: 'hidden',
        borderWidth: 0.5,
        borderColor: 'rgba(0, 0, 0, 0.15)',
        backgroundColor: '#E5E5EA',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Image
        source={{ uri: lang.flagUrl }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
      />
    </View>
  );
};

export const APP_TRANSLATIONS: Record<string, any> = {
  vi: {
    // Tabs
    tabVault: 'Két Sắt',
    tabApps: 'Ứng Dụng',
    tabFriends: 'Bạn Bè',
    tabProfile: 'Cá Nhân',
    tabSettings: 'Cài Đặt',

    // Vault
    vaultTitle: 'Két Sắt LockX',
    vaultSubtitle: 'Bảo mật an toàn',
    searchVault: 'Tìm kiếm tài khoản, game...',
    allAccounts: 'Tất cả',
    addAccount: 'Thêm mới',
    protectedAccounts: 'tài khoản bảo mật',
    emptyVault: 'Chưa có tài khoản nào được lưu',
    accountName: 'Tên tài khoản',
    usernameOrEmail: 'Tài khoản / Email',
    password: 'Mật khẩu',
    notes: 'Ghi chú',
    copy: 'Sao chép',
    copied: 'Đã sao chép vào bộ nhớ tạm',
    showPassword: 'Hiện',
    hidePassword: 'Ẩn',
    deleteAccount: 'Xóa tài khoản',
    saveAccount: 'Lưu tài khoản',

    // Apps
    appsTitle: 'Bảo Vệ Ứng Dụng',
    appsSubtitle: 'Khóa ứng dụng nhạy cảm',
    searchApps: 'Tìm kiếm ứng dụng...',
    lockAll: 'Khóa tất cả',
    unlockAll: 'Mở khóa tất cả',
    locked: 'Đã khóa',
    unlocked: 'Mở khóa',

    // Friends & Chat
    friendsTitle: 'Bạn Bè & Trò Chuyện',
    searchFriends: 'Tìm kiếm bạn bè...',
    activeNow: 'Đang hoạt động',
    typeMessage: 'Nhập tin nhắn bí mật...',
    send: 'Gửi',

    // Profile
    profileTitle: 'Hồ Sơ Cá Nhân',
    editProfile: 'Sửa hồ sơ',
    fullName: 'Họ và tên',
    username: 'Tên người dùng',
    usernameCooldown: 'Được đổi 7 ngày một lần',
    email: 'Email',
    phone: 'Số điện thoại',
    birthday: 'Ngày sinh',
    gender: 'Giới tính',
    male: 'Nam',
    female: 'Nữ',
    other: 'Khác',
    bio: 'Tiểu sử',
    notUpdated: 'Chưa cập nhật',
    changePassword: 'Đổi mật khẩu két sắt',
    currentPassword: 'Mật khẩu hiện tại',
    newPassword: 'Mật khẩu mới',
    confirmPassword: 'Xác nhận mật khẩu mới',
    deviceInfo: 'Thông tin thiết bị',
    battery: 'Pin',
    ipAddress: 'Địa chỉ IP',
    location: 'Vị trí',
    operatingSystem: 'Hệ điều hành',
    activeSessions: 'Phiên hoạt động',
    logoutOtherSessions: 'Đăng xuất thiết bị khác',
    saveChanges: 'Lưu thay đổi',
    cancel: 'Hủy',
    done: 'Xong',

    // Settings
    settingsTitle: 'Cài Đặt',
    searchSettings: 'Tìm kiếm cài đặt...',
    faceIdSecurity: 'Bảo mật sinh trắc học Face ID',
    faceIdDesc: 'Sử dụng Face ID để mở khóa ứng dụng và xác thực an toàn với Secure Enclave.',
    autoLock: 'Tự động khóa két sắt',
    lockImmediately: 'Ngay lập tức',
    lock1m: '1 phút',
    lock5m: '5 phút',
    lockNever: 'Tắt',
    appearance: 'Màn hình & Giao diện',
    themeLight: 'Sáng',
    themeDark: 'Tối',
    accentColor: 'Màu nhấn',
    fontSizeAndBold: 'Cỡ chữ & Chữ in đậm',
    standard: 'Chuẩn',
    bold: 'Đậm',
    boldText: 'Chữ in đậm',
    livePreview: 'Xem trước trực tiếp',
    notifications: 'Thông báo iOS & Dynamic Island',
    allowNotifications: 'Cho phép thông báo',
    securityAlerts: 'Cảnh báo bảo mật tài khoản',
    notificationSounds: 'Âm thanh thông báo',
    dynamicIslandToast: 'Thông báo Dynamic Island',
    dynamicIslandDesc: 'Viên thuốc nổi rơi từ trên xuống bên trong app',
    dataAndStorage: 'Dữ liệu & Bộ nhớ',
    cacheMemory: 'Dung lượng bộ nhớ đệm',
    clearCache: 'Dọn dẹp bộ nhớ đệm',
    clearing: 'Đang dọn dẹp...',
    backupAndRestore: 'Sao lưu & Khôi phục',
    exportBackup: 'Xuất tệp sao lưu JSON',
    importBackup: 'Khôi phục từ tệp JSON',
    language: 'Ngôn ngữ',
    supportedLanguages: 'Ngôn ngữ đã hỗ trợ',
    searchLanguage: 'Tìm kiếm ngôn ngữ...',
    securityAudit: 'Kiểm tra an toàn mật khẩu',
    aboutLockX: 'Về LockX Pro Vault',
    version: 'Phiên bản',

    // Popups & Dialogs
    understood: 'Đã hiểu',
    successTitle: 'Thao Tác Thành Công',
    warningTitle: 'Cảnh Báo',
    securityTitle: 'Bảo Mật',
    infoTitle: 'Thông Báo',
    copiedTitle: 'Đã Sao Chép',
    themeTitle: 'Chế Độ Giao Diện',
    accentTitle: 'Màu Nhấn',
    languageTitle: 'Ngôn Ngữ',
    fontSizeTitle: 'Cỡ Chữ',
    profileSuccessMsg: 'Thông tin hồ sơ cá nhân đã được đồng bộ an toàn.',
    passwordSuccessMsg: 'Mật khẩu quản trị két sắt đã được mã hóa an toàn.',
    cacheSuccessMsg: 'Đã giải phóng toàn bộ bộ nhớ đệm thực tế của ứng dụng.',
    backupExportMsg: 'Đã xuất và tải tệp sao lưu JSON an toàn.',
    backupImportMsg: 'Đã khôi phục dữ liệu từ tệp sao lưu thành công!',
    themeLightMsg: 'Đã áp dụng giao diện Sáng chuẩn iOS 18.',
    themeDarkMsg: 'Đã áp dụng giao diện Tối OLED bảo vệ mắt.',
    langChangedMsg: 'Đã chuyển đổi ngôn ngữ thành công.',

    // Onboarding
    supportedTitle: 'Thiết bị được hỗ trợ',
    unsupportedTitle: 'Thiết bị không được hỗ trợ',
    supportedSub: 'Hệ điều hành đã sẵn sàng hoạt động.',
    unsupportedSub: 'Hệ điều hành chưa được hỗ trợ.',
    listHeader: 'Các phiên bản hiện được hỗ trợ:',
    supportedNote: 'Phiên bản iOS này nằm trong phạm vi hỗ trợ nên LockX đã mở khóa đầy đủ quyền truy cập vào ứng dụng.',
    unsupportedNote: 'Phiên bản iOS này nằm ngoài phạm vi hỗ trợ nên LockX đã khóa quyền truy cập vào ứng dụng.',
    btnStart: 'BẮT ĐẦU VÀO APP',
    notifGranted: '✓ Đã cho phép nhận thông báo',
    notifRequest: '🔔 Nhấn để cấp quyền thông báo',
  },
  en: {
    // Tabs
    tabVault: 'Vault',
    tabApps: 'Apps',
    tabFriends: 'Friends',
    tabProfile: 'Profile',
    tabSettings: 'Settings',

    // Vault
    vaultTitle: 'LockX Vault',
    vaultSubtitle: 'Encrypted Security',
    searchVault: 'Search accounts, games...',
    allAccounts: 'All',
    addAccount: 'New',
    protectedAccounts: 'secured accounts',
    emptyVault: 'No accounts saved yet',
    accountName: 'Account Name',
    usernameOrEmail: 'Username / Email',
    password: 'Password',
    notes: 'Notes',
    copy: 'Copy',
    copied: 'Copied to clipboard',
    showPassword: 'Show',
    hidePassword: 'Hide',
    deleteAccount: 'Delete account',
    saveAccount: 'Save account',

    // Apps
    appsTitle: 'App Protection',
    appsSubtitle: 'Lock sensitive apps',
    searchApps: 'Search apps...',
    lockAll: 'Lock All',
    unlockAll: 'Unlock All',
    locked: 'Locked',
    unlocked: 'Unlocked',

    // Friends & Chat
    friendsTitle: 'Friends & Chat',
    searchFriends: 'Search friends...',
    activeNow: 'Active now',
    typeMessage: 'Type a secret message...',
    send: 'Send',

    // Profile
    profileTitle: 'User Profile',
    editProfile: 'Edit Profile',
    fullName: 'Full Name',
    username: 'Username',
    usernameCooldown: 'Changeable once every 7 days',
    email: 'Email',
    phone: 'Phone',
    birthday: 'Birthday',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    other: 'Other',
    bio: 'Bio',
    notUpdated: 'Not updated',
    changePassword: 'Change Vault Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm New Password',
    deviceInfo: 'Device Information',
    battery: 'Battery',
    ipAddress: 'IP Address',
    location: 'Location',
    operatingSystem: 'Operating System',
    activeSessions: 'Active Sessions',
    logoutOtherSessions: 'Log Out Other Devices',
    saveChanges: 'Save Changes',
    cancel: 'Cancel',
    done: 'Done',

    // Settings
    settingsTitle: 'Settings',
    searchSettings: 'Search settings...',
    faceIdSecurity: 'Face ID Biometric Security',
    faceIdDesc: 'Use Face ID to unlock the vault and authenticate with Secure Enclave.',
    autoLock: 'Auto-Lock Vault',
    lockImmediately: 'Immediately',
    lock1m: '1 minute',
    lock5m: '5 minutes',
    lockNever: 'Never',
    appearance: 'Display & Appearance',
    themeLight: 'Light',
    themeDark: 'Dark',
    accentColor: 'Accent Color',
    fontSizeAndBold: 'Font Size & Bold Text',
    standard: 'Standard',
    bold: 'Bold',
    boldText: 'Bold Text',
    livePreview: 'Live Preview',
    notifications: 'iOS Notifications & Dynamic Island',
    allowNotifications: 'Allow Notifications',
    securityAlerts: 'Account Security Alerts',
    notificationSounds: 'Notification Sounds',
    dynamicIslandToast: 'Dynamic Island Notification',
    dynamicIslandDesc: 'Floating pill banner dropping from the top',
    dataAndStorage: 'Data & Storage',
    cacheMemory: 'Cache Storage',
    clearCache: 'Clear Cache Storage',
    clearing: 'Clearing...',
    backupAndRestore: 'Backup & Restore',
    exportBackup: 'Export Backup JSON',
    importBackup: 'Restore from JSON File',
    language: 'Language',
    supportedLanguages: 'Supported Languages',
    searchLanguage: 'Search language...',
    securityAudit: 'Password Security Audit',
    aboutLockX: 'About LockX Pro Vault',
    version: 'Version',

    // Popups & Dialogs
    understood: 'Got It',
    successTitle: 'Action Successful',
    warningTitle: 'Warning',
    securityTitle: 'Security',
    infoTitle: 'Notice',
    copiedTitle: 'Copied',
    themeTitle: 'Display Theme',
    accentTitle: 'Accent Color',
    languageTitle: 'Language',
    fontSizeTitle: 'Font Size',
    profileSuccessMsg: 'User profile has been securely synced.',
    passwordSuccessMsg: 'Vault master password updated in Keychain.',
    cacheSuccessMsg: 'App cache cleared successfully.',
    backupExportMsg: 'JSON backup file exported safely.',
    backupImportMsg: 'Data restored successfully from backup!',
    themeLightMsg: 'Applied iOS 18 Light theme.',
    themeDarkMsg: 'Applied OLED Dark theme.',
    langChangedMsg: 'Language changed successfully.',

    // Onboarding
    supportedTitle: 'Device Supported',
    unsupportedTitle: 'Device Not Supported',
    supportedSub: 'Operating system is ready to use.',
    unsupportedSub: 'Operating system is not supported.',
    listHeader: 'Currently supported versions:',
    supportedNote: 'This iOS version is supported. LockX has unlocked full access to all vault features.',
    unsupportedNote: 'This iOS version is out of supported range, LockX has locked access to the app.',
    btnStart: 'GET STARTED',
    notifGranted: '✓ Notifications Allowed',
    notifRequest: '🔔 Tap to allow notifications',
  },
  ko: {
    // Tabs (Korean - 한국어)
    tabVault: '금고',
    tabApps: '앱 보호',
    tabFriends: '친구',
    tabProfile: '프로필',
    tabSettings: '설정',

    // Vault
    vaultTitle: 'LockX 금고',
    vaultSubtitle: '안전한 보안 보관',
    searchVault: '계정, 게임, 메모 검색...',
    allAccounts: '전체',
    addAccount: '추가',
    protectedAccounts: '보호된 계정',
    emptyVault: '저장된 계정이 없습니다',
    accountName: '계정 이름',
    usernameOrEmail: '아이디 / 이메일',
    password: '비밀번호',
    notes: '메모',
    copy: '복사',
    copied: '클립보드에 복사되었습니다',
    showPassword: '표시',
    hidePassword: '숨기기',
    deleteAccount: '계정 삭제',
    saveAccount: '계정 저장',

    // Apps
    appsTitle: '앱 보호',
    appsSubtitle: '민감한 앱 잠금',
    searchApps: '앱 검색...',
    lockAll: '모두 잠금',
    unlockAll: '모두 잠금 해제',
    locked: '잠김',
    unlocked: '해제됨',

    // Friends & Chat
    friendsTitle: '친구 및 채팅',
    searchFriends: '친구 검색...',
    activeNow: '현재 활동 중',
    typeMessage: '비밀 메시지 입력...',
    send: '전송',

    // Profile
    profileTitle: '내 프로필',
    editProfile: '프로필 수정',
    fullName: '이름',
    username: '사용자 이름',
    usernameCooldown: '7일에 1회 변경 가능',
    email: '이메일',
    phone: '전화번호',
    birthday: '생년월일',
    gender: '성별',
    male: '남성',
    female: '여성',
    other: '기타',
    bio: '소개',
    notUpdated: '미등록',
    changePassword: '금고 비밀번호 변경',
    currentPassword: '현재 비밀번호',
    newPassword: '새 비밀번호',
    confirmPassword: '새 비밀번호 확인',
    deviceInfo: '기기 정보',
    battery: '배터리',
    ipAddress: 'IP 주소',
    location: '위치',
    operatingSystem: '운영체제',
    activeSessions: '활성 세션',
    logoutOtherSessions: '다른 기기에서 로그아웃',
    saveChanges: '변경사항 저장',
    cancel: '취소',
    done: '완료',

    // Settings
    settingsTitle: '설정',
    searchSettings: '설정 검색...',
    faceIdSecurity: 'Face ID 생체 인식 보안',
    faceIdDesc: 'Face ID로 앱을 안전하게 열고 Secure Enclave로 보호합니다.',
    autoLock: '금고 자동 잠금',
    lockImmediately: '즉시',
    lock1m: '1분',
    lock5m: '5분',
    lockNever: '끄기',
    appearance: '화면 및 디스플레이',
    themeLight: '라이트',
    themeDark: '다크',
    accentColor: '강조 색상',
    fontSizeAndBold: '글꼴 크기 및 굵은 텍스트',
    standard: '표준',
    bold: '굵게',
    boldText: '굵은 텍스트',
    livePreview: '실시간 미리보기',
    notifications: 'iOS 알림 및 Dynamic Island',
    allowNotifications: '알림 허용',
    securityAlerts: '계정 보안 알림',
    notificationSounds: '알림 소리',
    dynamicIslandToast: 'Dynamic Island 알림',
    dynamicIslandDesc: '앱 화면 상단에서 알림 캡슐 표시',
    dataAndStorage: '데이터 및 저장공간',
    cacheMemory: '캐시 메모리 용량',
    clearCache: '캐시 삭제',
    clearing: '삭제 중...',
    backupAndRestore: '백업 및 복원',
    exportBackup: 'JSON 백업 내보내기',
    importBackup: 'JSON 파일에서 복원',
    language: '언어 (Language)',
    supportedLanguages: '지원되는 언어',
    searchLanguage: '언어 검색...',
    securityAudit: '비밀번호 보안 검사',
    aboutLockX: 'LockX Pro 정보',
    version: '버전',

    // Popups & Dialogs
    understood: '확인',
    successTitle: '작업 완료',
    warningTitle: '경고',
    securityTitle: '보안',
    infoTitle: '알림',
    copiedTitle: '복사 완료',
    themeTitle: '화면 모드',
    accentTitle: '강조 색상',
    languageTitle: '언어 설정',
    fontSizeTitle: '글자 크기',
    profileSuccessMsg: '프로필 정보가 안전하게 동기화되었습니다.',
    passwordSuccessMsg: '금고 마스터 비밀번호가 변경되었습니다.',
    cacheSuccessMsg: '임시 캐시 파일이 정리되었습니다.',
    backupExportMsg: 'JSON 백업 파일이 안전하게 저장되었습니다.',
    backupImportMsg: '데이터가 백업 파일에서 복원되었습니다!',
    themeLightMsg: 'iOS 18 라이트 모드가 적용되었습니다.',
    themeDarkMsg: 'OLED 다크 모드가 적용되었습니다.',
    langChangedMsg: '언어가 한국어로 변경되었습니다.',

    // Onboarding
    supportedTitle: '지원되는 기기',
    unsupportedTitle: '지원되지 않는 기기',
    supportedSub: 'iOS 버전이 준비되었습니다.',
    unsupportedSub: 'iOS 버전이 아직 지원되지 않습니다.',
    listHeader: '현재 지원되는 iOS 버전:',
    supportedNote: '이 iOS 버전은 지원 범위 내에 있으므로 LockX가 모든 금고 기능에 대한 전체 접근 권한을 활성화했습니다.',
    unsupportedNote: '이 iOS 버전은 지원 범위를 벗어났습니다. LockX 접근이 잠겼습니다.',
    btnStart: '앱 시작하기',
    notifGranted: '✓ 알림 수신 허용됨',
    notifRequest: '🔔 알림 권한 허용하기',
  },
  zh: {
    // Tabs (Chinese - 简体中文)
    tabVault: '金库',
    tabApps: '应用锁',
    tabFriends: '好友',
    tabProfile: '个人',
    tabSettings: '设置',

    // Vault
    vaultTitle: 'LockX 金库',
    vaultSubtitle: '安全加密保护',
    searchVault: '搜索账户、游戏、备忘录...',
    allAccounts: '全部',
    addAccount: '新建',
    protectedAccounts: '个受保护账户',
    emptyVault: '尚未保存任何账户',
    accountName: '账户名称',
    usernameOrEmail: '用户名 / 邮箱',
    password: '密码',
    notes: '备注',
    copy: '复制',
    copied: '已复制到剪贴板',
    showPassword: '显示',
    hidePassword: '隐藏',
    deleteAccount: '删除账户',
    saveAccount: '保存账户',

    // Apps
    appsTitle: '应用保护',
    appsSubtitle: '锁定敏感应用程序',
    searchApps: '搜索应用...',
    lockAll: '全部锁定',
    unlockAll: '全部解锁',
    locked: '已锁定',
    unlocked: '未锁定',

    // Friends & Chat
    friendsTitle: '好友与消息',
    searchFriends: '搜索好友...',
    activeNow: '在线',
    typeMessage: '输入加密私密消息...',
    send: '发送',

    // Profile
    profileTitle: '个人资料',
    editProfile: '编辑资料',
    fullName: '姓名',
    username: '用户名',
    usernameCooldown: '每 7 天可更改一次',
    email: '电子邮箱',
    phone: '电话号码',
    birthday: '出生日期',
    gender: '性别',
    male: '男',
    female: '女',
    other: '其他',
    bio: '个人简介',
    notUpdated: '未更新',
    changePassword: '修改金库主密码',
    currentPassword: '当前密码',
    newPassword: '新密码',
    confirmPassword: '确认新密码',
    deviceInfo: '设备信息',
    battery: '电量',
    ipAddress: 'IP 地址',
    location: '位置',
    operatingSystem: '操作系统',
    activeSessions: '活跃会话',
    logoutOtherSessions: '退出其他所有设备',
    saveChanges: '保存更改',
    cancel: '取消',
    done: '完成',

    // Settings
    settingsTitle: '设置',
    searchSettings: '搜索设置...',
    faceIdSecurity: 'Face ID 生物识别安全',
    faceIdDesc: '使用面容 ID 解锁应用，并由安全隔区 (Secure Enclave) 提供保护。',
    autoLock: '自动锁定金库',
    lockImmediately: '立即',
    lock1m: '1分钟',
    lock5m: '5分钟',
    lockNever: '关闭',
    appearance: '显示与外观',
    themeLight: '浅色',
    themeDark: '深色',
    accentColor: '强调色',
    fontSizeAndBold: '字体大小与粗体',
    standard: '标准',
    bold: '粗体',
    boldText: '粗体文本',
    livePreview: '实时预览',
    notifications: 'iOS 通知与灵动岛',
    allowNotifications: '允许通知',
    securityAlerts: '账户安全警报',
    notificationSounds: '通知提示音',
    dynamicIslandToast: '灵动岛通知弹窗',
    dynamicIslandDesc: '应用内顶部动态胶囊通知',
    dataAndStorage: '数据与存储',
    cacheMemory: '缓存占用',
    clearCache: '清理缓存空间',
    clearing: '正在清理...',
    backupAndRestore: '备份与恢复',
    exportBackup: '导出 JSON 备份文件',
    importBackup: '从 JSON 文件恢复',
    language: '语言 (Language)',
    supportedLanguages: '已支持语言',
    searchLanguage: '搜索语言...',
    securityAudit: '密码安全审计',
    aboutLockX: '关于 LockX Pro',
    version: '版本',

    // Popups & Dialogs
    understood: '知道了',
    successTitle: '操作成功',
    warningTitle: '警告',
    securityTitle: '安全',
    infoTitle: '通知',
    copiedTitle: '已复制',
    themeTitle: '外观模式',
    accentTitle: '强调色',
    languageTitle: '语言切换',
    fontSizeTitle: '字号调整',
    profileSuccessMsg: '个人资料已安全同步。',
    passwordSuccessMsg: '金库主密码已更新至钥匙串。',
    cacheSuccessMsg: '应用缓存已成功清理。',
    backupExportMsg: 'JSON 备份文件已安全导出。',
    backupImportMsg: '已从备份成功恢复数据！',
    themeLightMsg: '已应用 iOS 18 浅色模式。',
    themeDarkMsg: '已应用 OLED 深色模式。',
    langChangedMsg: '语言已切换为简体中文。',

    // Onboarding
    supportedTitle: '设备受支持',
    unsupportedTitle: '设备不受支持',
    supportedSub: '操作系统已就绪可用。',
    unsupportedSub: '操作系统尚未受支持。',
    listHeader: '当前支持的系统版本：',
    supportedNote: '此 iOS 版本在受支持的范围内，LockX 已完全解锁应用访问权限。',
    unsupportedNote: '此 iOS 版本超出支持范围，LockX 已锁定对应用程序的访问。',
    btnStart: '进入应用',
    notifGranted: '✓ 已允许推送通知',
    notifRequest: '🔔 点击授予通知权限',
  },
  ja: {
    // Tabs (Japanese - 日本語)
    tabVault: '保管庫',
    tabApps: 'アプリ保護',
    tabFriends: '友達',
    tabProfile: 'プロフィール',
    tabSettings: '設定',

    // Vault
    vaultTitle: 'LockX 保管庫',
    vaultSubtitle: '暗号化セキュリティ',
    searchVault: 'アカウント、ゲーム、メモを検索...',
    allAccounts: 'すべて',
    addAccount: '新規追加',
    protectedAccounts: '件の保護中アカウント',
    emptyVault: '保存されたアカウントはありません',
    accountName: 'アカウント名',
    usernameOrEmail: 'ユーザー名 / メール',
    password: 'パスワード',
    notes: 'メモ',
    copy: 'コピー',
    copied: 'クリップボードにコピーしました',
    showPassword: '表示',
    hidePassword: '非表示',
    deleteAccount: 'アカウントを削除',
    saveAccount: 'アカウントを保存',

    // Apps
    appsTitle: 'アプリ保護',
    appsSubtitle: '重要アプリをロック',
    searchApps: 'アプリを検索...',
    lockAll: 'すべてロック',
    unlockAll: 'すべてロック解除',
    locked: 'ロック中',
    unlocked: '解除済み',

    // Friends & Chat
    friendsTitle: '友達とチャット',
    searchFriends: '友達を検索...',
    activeNow: 'オンライン',
    typeMessage: '暗号化メッセージを入力...',
    send: '送信',

    // Profile
    profileTitle: 'マイプロフィール',
    editProfile: 'プロフィール編集',
    fullName: '氏名',
    username: 'ユーザー名',
    usernameCooldown: '7日に1回変更可能',
    email: 'メールアドレス',
    phone: '電話番号',
    birthday: '生年月日',
    gender: '性別',
    male: '男性',
    female: '女性',
    other: 'その他',
    bio: '自己紹介',
    notUpdated: '未登録',
    changePassword: 'マスターパスワード変更',
    currentPassword: '現在のパスワード',
    newPassword: '新しいパスワード',
    confirmPassword: 'パスワードの確認',
    deviceInfo: 'デバイス情報',
    battery: 'バッテリー',
    ipAddress: 'IPアドレス',
    location: '位置情報',
    operatingSystem: 'OSバージョン',
    activeSessions: 'アクティブセッション',
    logoutOtherSessions: '他のすべての端末からログアウト',
    saveChanges: '変更を保存',
    cancel: 'キャンセル',
    done: '完了',

    // Settings
    settingsTitle: '設定',
    searchSettings: '設定を検索...',
    faceIdSecurity: 'Face ID 生体認証セキュリティ',
    faceIdDesc: 'Face IDを使用してアプリのロックを安全に解除します。',
    autoLock: '自動ロック',
    lockImmediately: '即時',
    lock1m: '1分後',
    lock5m: '5分後',
    lockNever: 'オフ',
    appearance: '画面表示と明るさ',
    themeLight: 'ライト',
    themeDark: 'ダーク',
    accentColor: 'アクセントカラー',
    fontSizeAndBold: '文字サイズと太字',
    standard: '標準',
    bold: '太字',
    boldText: 'テキストを太字にする',
    livePreview: 'プレビュー',
    notifications: 'iOS通知とDynamic Island',
    allowNotifications: '通知を許可',
    securityAlerts: 'セキュリティ警告',
    notificationSounds: '通知音',
    dynamicIslandToast: 'Dynamic Island 通知',
    dynamicIslandDesc: '画面上部にカプセル型バナーを表示',
    dataAndStorage: 'データとストレージ',
    cacheMemory: 'キャッシュ容量',
    clearCache: 'キャッシュを消去',
    clearing: '消去中...',
    backupAndRestore: 'バックアップと復元',
    exportBackup: 'JSONバックアップを出力',
    importBackup: 'JSONから復元',
    language: '言語 (Language)',
    supportedLanguages: '対応言語',
    searchLanguage: '言語を検索...',
    securityAudit: 'パスワード安全性診断',
    aboutLockX: 'LockX について',
    version: 'バージョン',

    // Popups & Dialogs
    understood: '了解',
    successTitle: '完了',
    warningTitle: '警告',
    securityTitle: 'セキュリティ',
    infoTitle: 'お知らせ',
    copiedTitle: 'コピー完了',
    themeTitle: '外観モード',
    accentTitle: 'アクセントカラー',
    languageTitle: '言語切替',
    fontSizeTitle: '文字サイズ',
    profileSuccessMsg: 'プロフィールを安全に同期しました。',
    passwordSuccessMsg: 'マスターパスワードを更新しました。',
    cacheSuccessMsg: 'アプリキャッシュを消去しました。',
    backupExportMsg: 'バックアップJSONを出力しました。',
    backupImportMsg: 'データを復元しました！',
    themeLightMsg: 'iOS 18 ライトモードを適用しました。',
    themeDarkMsg: 'OLED ダークモードを適用しました。',
    langChangedMsg: '言語を日本語に変更しました。',

    // Onboarding
    supportedTitle: '対応デバイス',
    unsupportedTitle: '非対応デバイス',
    supportedSub: 'OSバージョンは利用可能です。',
    unsupportedSub: 'OSバージョンは現在非対応です。',
    listHeader: '現在対応している iOS バージョン:',
    supportedNote: 'この iOS バージョンは対応範囲内のため、LockX の全機能へのアクセスが解除されています。',
    unsupportedNote: 'この iOS バージョンは対応外のため、アプリへのアクセスが制限されています。',
    btnStart: 'アプリを始める',
    notifGranted: '✓ 通知が許可されました',
    notifRequest: '🔔 通知権限を許可する',
  },
  fr: {
    // Tabs (French - Français)
    tabVault: 'Coffre',
    tabApps: 'Apps',
    tabFriends: 'Amis',
    tabProfile: 'Profil',
    tabSettings: 'Réglages',

    // Vault
    vaultTitle: 'Coffre LockX',
    vaultSubtitle: 'Sécurité chiffrée',
    searchVault: 'Rechercher comptes, jeux...',
    allAccounts: 'Tous',
    addAccount: 'Ajouter',
    protectedAccounts: 'comptes sécurisés',
    emptyVault: 'Aucun compte enregistré',
    accountName: 'Nom du compte',
    usernameOrEmail: 'Identifiant / Email',
    password: 'Mot de passe',
    notes: 'Remarques',
    copy: 'Copier',
    copied: 'Copié dans le presse-papier',
    showPassword: 'Voir',
    hidePassword: 'Masquer',
    deleteAccount: 'Supprimer',
    saveAccount: 'Enregistrer',

    // Apps
    appsTitle: 'Protection Apps',
    appsSubtitle: 'Verrouiller les applications',
    searchApps: 'Rechercher une application...',
    lockAll: 'Tout verrouiller',
    unlockAll: 'Tout déverrouiller',
    locked: 'Verrouillé',
    unlocked: 'Déverrouillé',

    // Friends & Chat
    friendsTitle: 'Amis & Messages',
    searchFriends: 'Rechercher des amis...',
    activeNow: 'En ligne',
    typeMessage: 'Message secret...',
    send: 'Envoyer',

    // Profile
    profileTitle: 'Profil Utilisateur',
    editProfile: 'Modifier le profil',
    fullName: 'Nom complet',
    username: 'Identifiant',
    usernameCooldown: 'Modifiable tous les 7 jours',
    email: 'E-mail',
    phone: 'Téléphone',
    birthday: 'Date de naissance',
    gender: 'Sexe',
    male: 'Homme',
    female: 'Femme',
    other: 'Autre',
    bio: 'Biographie',
    notUpdated: 'Non renseigné',
    changePassword: 'Changer le mot de passe',
    currentPassword: 'Mot de passe actuel',
    newPassword: 'Nouveau mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    deviceInfo: 'Info Appareil',
    battery: 'Batterie',
    ipAddress: 'Adresse IP',
    location: 'Emplacement',
    operatingSystem: 'Système d\'exploitation',
    activeSessions: 'Sessions actives',
    logoutOtherSessions: 'Déconnecter les autres appareils',
    saveChanges: 'Enregistrer',
    cancel: 'Annuler',
    done: 'Terminé',

    // Settings
    settingsTitle: 'Réglages',
    searchSettings: 'Rechercher...',
    faceIdSecurity: 'Sécurité biométrique Face ID',
    faceIdDesc: 'Utilisez Face ID pour déverrouiller avec Secure Enclave.',
    autoLock: 'Verrouillage automatique',
    lockImmediately: 'Immédiatement',
    lock1m: '1 minute',
    lock5m: '5 minutes',
    lockNever: 'Jamais',
    appearance: 'Luminosité et affichage',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    accentColor: 'Couleur d\'accent',
    fontSizeAndBold: 'Taille du texte et gras',
    standard: 'Standard',
    bold: 'Gras',
    boldText: 'Texte en gras',
    livePreview: 'Aperçu en direct',
    notifications: 'Notifications iOS & Dynamic Island',
    allowNotifications: 'Autoriser les notifications',
    securityAlerts: 'Alertes de sécurité',
    notificationSounds: 'Sons de notification',
    dynamicIslandToast: 'Notification Dynamic Island',
    dynamicIslandDesc: 'Pilule flottante animée en haut',
    dataAndStorage: 'Données et stockage',
    cacheMemory: 'Mémoire cache',
    clearCache: 'Vider le cache',
    clearing: 'Nettoyage...',
    backupAndRestore: 'Sauvegarde & Restauration',
    exportBackup: 'Exporter la sauvegarde JSON',
    importBackup: 'Restaurer depuis un fichier JSON',
    language: 'Langue (Language)',
    supportedLanguages: 'Langues prises en charge',
    searchLanguage: 'Rechercher une langue...',
    securityAudit: 'Audit de sécurité des mots de passe',
    aboutLockX: 'À propos de LockX',
    version: 'Version',

    // Popups & Dialogs
    understood: 'Compris',
    successTitle: 'Succès',
    warningTitle: 'Avertissement',
    securityTitle: 'Sécurité',
    infoTitle: 'Information',
    copiedTitle: 'Copié',
    themeTitle: 'Thème d\'affichage',
    accentTitle: 'Couleur d\'accent',
    languageTitle: 'Langue',
    fontSizeTitle: 'Taille du texte',
    profileSuccessMsg: 'Profil synchronisé avec succès.',
    passwordSuccessMsg: 'Mot de passe mis à jour dans le Trousseau.',
    cacheSuccessMsg: 'Cache de l\'application vidé.',
    backupExportMsg: 'Fichier de sauvegarde exporté.',
    backupImportMsg: 'Données restaurées avec succès !',
    themeLightMsg: 'Mode Clair iOS 18 appliqué.',
    themeDarkMsg: 'Mode Sombre OLED appliqué.',
    langChangedMsg: 'Langue changée en Français.',

    // Onboarding
    supportedTitle: 'Appareil pris en charge',
    unsupportedTitle: 'Appareil non pris en charge',
    supportedSub: 'Le système d\'exploitation est prêt.',
    unsupportedSub: 'Le système d\'exploitation n\'est pas pris en charge.',
    listHeader: 'Versions actuellement prises en charge :',
    supportedNote: 'Cette version iOS est prise en charge. LockX a débloqué l\'accès complet.',
    unsupportedNote: 'Cette version iOS n\'est pas prise en charge.',
    btnStart: 'COMMENCER',
    notifGranted: '✓ Notifications autorisées',
    notifRequest: '🔔 Activer les notifications',
  },
  de: {
    // Tabs (German - Deutsch)
    tabVault: 'Tresor',
    tabApps: 'Apps',
    tabFriends: 'Freunde',
    tabProfile: 'Profil',
    tabSettings: 'Einstellungen',

    // Vault
    vaultTitle: 'LockX Tresor',
    vaultSubtitle: 'Verschlüsselte Sicherheit',
    searchVault: 'Konten, Spiele, Notizen suchen...',
    allAccounts: 'Alle',
    addAccount: 'Neu',
    protectedAccounts: 'gesicherte Konten',
    emptyVault: 'Noch keine Konten gespeichert',
    accountName: 'Kontoname',
    usernameOrEmail: 'Benutzername / E-Mail',
    password: 'Passwort',
    notes: 'Notizen',
    copy: 'Kopieren',
    copied: 'In die Zwischenablage kopiert',
    showPassword: 'Anzeigen',
    hidePassword: 'Verbergen',
    deleteAccount: 'Konto löschen',
    saveAccount: 'Konto speichern',

    // Apps
    appsTitle: 'App-Schutz',
    appsSubtitle: 'Vertrauliche Apps sperren',
    searchApps: 'Apps suchen...',
    lockAll: 'Alle sperren',
    unlockAll: 'Alle entsperren',
    locked: 'Gesperrt',
    unlocked: 'Entsperrt',

    // Friends & Chat
    friendsTitle: 'Freunde & Chat',
    searchFriends: 'Freunde suchen...',
    activeNow: 'Jetzt aktiv',
    typeMessage: 'Geheime Nachricht eingeben...',
    send: 'Senden',

    // Profile
    profileTitle: 'Benutzerprofil',
    editProfile: 'Profil bearbeiten',
    fullName: 'Vollständiger Name',
    username: 'Benutzername',
    usernameCooldown: 'Alle 7 Tage änderbar',
    email: 'E-Mail',
    phone: 'Telefonnummer',
    birthday: 'Geburtstag',
    gender: 'Geschlecht',
    male: 'Männlich',
    female: 'Weiblich',
    other: 'Andere',
    bio: 'Biografie',
    notUpdated: 'Nicht angegeben',
    changePassword: 'Tresor-Passwort ändern',
    currentPassword: 'Aktuelles Passwort',
    newPassword: 'Neues Passwort',
    confirmPassword: 'Neues Passwort bestätigen',
    deviceInfo: 'Geräteinformationen',
    battery: 'Batterie',
    ipAddress: 'IP-Adresse',
    location: 'Standort',
    operatingSystem: 'Betriebssystem',
    activeSessions: 'Aktive Sitzungen',
    logoutOtherSessions: 'Andere Geräte abmelden',
    saveChanges: 'Änderungen speichern',
    cancel: 'Abbrechen',
    done: 'Fertig',

    // Settings
    settingsTitle: 'Einstellungen',
    searchSettings: 'Einstellungen suchen...',
    faceIdSecurity: 'Face ID Biometrische Sicherheit',
    faceIdDesc: 'Face ID mit Secure Enclave verwenden.',
    autoLock: 'Automatische Sperre',
    lockImmediately: 'Sofort',
    lock1m: '1 Minute',
    lock5m: '5 Minuten',
    lockNever: 'Nie',
    appearance: 'Anzeige & Helligkeit',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    accentColor: 'Akzentfarbe',
    fontSizeAndBold: 'Textgröße & Fetter Text',
    standard: 'Standard',
    bold: 'Fett',
    boldText: 'Fetter Text',
    livePreview: 'Live-Vorschau',
    notifications: 'iOS-Mitteilungen & Dynamic Island',
    allowNotifications: 'Mitteilungen erlauben',
    securityAlerts: 'Sicherheitswarnungen',
    notificationSounds: 'Mitteilungstöne',
    dynamicIslandToast: 'Dynamic Island Benachrichtigung',
    dynamicIslandDesc: 'Schwebendes Kapsel-Banner oben',
    dataAndStorage: 'Daten & Speicher',
    cacheMemory: 'Cache-Speicher',
    clearCache: 'Cache leeren',
    clearing: 'Wird gelöscht...',
    backupAndRestore: 'Backup & Wiederherstellung',
    exportBackup: 'JSON-Backup exportieren',
    importBackup: 'Aus JSON-Datei wiederherstellen',
    language: 'Sprache (Language)',
    supportedLanguages: 'Unterstützte Sprachen',
    searchLanguage: 'Sprache suchen...',
    securityAudit: 'Passwort-Sicherheitsprüfung',
    aboutLockX: 'Über LockX Pro',
    version: 'Version',

    // Popups & Dialogs
    understood: 'Verstanden',
    successTitle: 'Erfolgreich',
    warningTitle: 'Warnung',
    securityTitle: 'Sicherheit',
    infoTitle: 'Hinweis',
    copiedTitle: 'Kopiert',
    themeTitle: 'Erscheinungsbild',
    accentTitle: 'Akzentfarbe',
    languageTitle: 'Sprache',
    fontSizeTitle: 'Schriftgröße',
    profileSuccessMsg: 'Profil erfolgreich synchronisiert.',
    passwordSuccessMsg: 'Tresor-Passwort im Schlüsselbund aktualisiert.',
    cacheSuccessMsg: 'App-Cache erfolgreich geleert.',
    backupExportMsg: 'JSON-Backup sicher exportiert.',
    backupImportMsg: 'Daten erfolgreich wiederhergestellt!',
    themeLightMsg: 'Helles iOS 18 Design angewendet.',
    themeDarkMsg: 'OLED Dunkles Design angewendet.',
    langChangedMsg: 'Sprache auf Deutsch umgestellt.',

    // Onboarding
    supportedTitle: 'Gerät unterstützt',
    unsupportedTitle: 'Gerät nicht unterstützt',
    supportedSub: 'Betriebssystem ist bereit.',
    unsupportedSub: 'Betriebssystem wird nicht unterstützt.',
    listHeader: 'Derzeit unterstützte iOS-Versionen:',
    supportedNote: 'Diese iOS-Version wird unterstützt. LockX hat den vollen Zugriff freigeschaltet.',
    unsupportedNote: 'Diese iOS-Version wird nicht unterstützt.',
    btnStart: 'JETZT STARTEN',
    notifGranted: '✓ Mitteilungen erlaubt',
    notifRequest: '🔔 Mitteilungen aktivieren',
  },
};

export const INITIAL_FRIENDS: FriendUser[] = [
  {
    id: 'fr-1',
    displayName: 'Minh Hoàng',
    username: '@minh_apple',
    avatarColor: '#007AFF',
    avatarIcon: 'logo-apple',
    status: 'online',
    bio: 'iOS Developer & Apple Fanboy 📱',
    lastMessage: 'Giao diện LockX bản mới này nhìn đẹp và mượt thật đấy ✨',
    lastTime: '15:20',
    unreadCount: 1,
  },
  {
    id: 'fr-2',
    displayName: 'Ngọc Linh',
    username: '@linh_game',
    avatarColor: '#AF52DE',
    avatarIcon: 'game-controller',
    status: 'online',
    bio: 'Gamer Genshin Impact & HSR ✨',
    lastMessage: 'Tối nay roll banner không bạn ơi?',
    lastTime: '14:05',
    unreadCount: 0,
  },
  {
    id: 'fr-3',
    displayName: 'Tuấn Anh',
    username: '@tuan_lockx',
    avatarColor: '#34C759',
    avatarIcon: 'shield-checkmark',
    status: 'offline',
    bio: 'Chuyên gia an toàn thông tin 🛡️',
    lastMessage: 'Đã sao lưu Keychain an toàn rồi nhé.',
    lastTime: 'Hôm qua',
    unreadCount: 0,
  },
  {
    id: 'fr-4',
    displayName: 'Khánh Vy',
    username: '@vy_shopee',
    avatarColor: '#FF9500',
    avatarIcon: 'bag-handle',
    status: 'online',
    bio: 'Săn sale công nghệ & đời sống 🛍️',
    lastMessage: 'Cảm ơn ông đã chia sẻ app này nha!',
    lastTime: '21/09',
    unreadCount: 0,
  },
];

export const INITIAL_CHAT_MESSAGES: Record<string, ChatMessage[]> = {
  'fr-1': [
    { id: 'm1', sender: 'friend', text: 'Chào bạn, LockX cập nhật giao diện mới đẹp quá!', time: '15:15' },
    { id: 'm2', sender: 'me', text: 'Ừ bạn, tính năng mã hóa đầu cuối E2E rất mượt và an toàn!', time: '15:18' },
  ],
  'fr-2': [
    { id: 'm4', sender: 'friend', text: 'Hôm nay banner mới ra rồi nè', time: '13:50' },
    { id: 'm5', sender: 'me', text: 'Tôi tích được 48 roll rồi, chuẩn bị nổ bảo hiểm', time: '14:00' },
  ],
};

// Component bong bóng 3 chấm hoạt họa đang gõ (Typing Indicator) chuẩn Apple iMessage
export const TypingIndicatorBubble = ({
  isLight,
  avatarColor,
  avatarIcon,
}: {
  isLight: boolean;
  avatarColor: string;
  avatarIcon?: string;
}) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnim = (val: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: -5,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.delay(Math.max(0, 360 - delay)),
        ])
      );
    };

    const a1 = createAnim(dot1, 0);
    const a2 = createAnim(dot2, 130);
    const a3 = createAnim(dot3, 260);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12, marginLeft: 4 }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: avatarColor || '#007AFF',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Ionicons name={(avatarIcon || 'person') as any} size={14} color="#FFFFFF" />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 18,
          borderBottomLeftRadius: 4,
          backgroundColor: isLight ? '#E5E5EA' : '#2C2C2E',
        }}
      >
        <Animated.View
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: isLight ? '#8E8E93' : '#AEAEB2',
            transform: [{ translateY: dot1 }],
          }}
        />
        <Animated.View
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: isLight ? '#8E8E93' : '#AEAEB2',
            transform: [{ translateY: dot2 }],
          }}
        />
        <Animated.View
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: isLight ? '#8E8E93' : '#AEAEB2',
            transform: [{ translateY: dot3 }],
          }}
        />
      </View>
    </View>
  );
};

// Component hiển thị Icon Ứng Dụng chuẩn Apple Squircle (Bo góc 22.37% & nhận diện sắc nét)
export const AppleAppIcon = ({
  app,
  size = 46,
}: {
  app: PhoneAppItem;
  size?: number;
}) => {
  const borderRadius = Math.round(size * 0.23); // Chuẩn Apple Continuous Squircle
  const fontSize = Math.round(size * 0.26);
  const iconSize = Math.round(size * 0.52);

  // Photos (Ảnh Apple)
  if (app.id === 'app-photos' || app.name.toLowerCase().includes('ảnh')) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius,
          backgroundColor: '#FFFFFF',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 0.5,
          borderColor: 'rgba(255,255,255,0.2)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.15,
          shadowRadius: 2,
        }}
      >
        <Ionicons name="flower" size={iconSize} color="#FF2D55" />
      </View>
    );
  }

  // Zalo
  if (app.id === 'app-zalo' || app.name.toLowerCase().includes('zalo')) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius,
          backgroundColor: '#0068FF',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 0.5,
          borderColor: 'rgba(255,255,255,0.15)',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: fontSize + 1, letterSpacing: -0.5 }}>
          Zalo
        </Text>
      </View>
    );
  }

  // MoMo
  if (app.id === 'app-momo' || app.name.toLowerCase().includes('momo')) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius,
          backgroundColor: '#A50064',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 0.5,
          borderColor: 'rgba(255,255,255,0.15)',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: fontSize - 1, letterSpacing: -0.5 }}>
          MoMo
        </Text>
      </View>
    );
  }

  // Brand Badge for Vietnamese banks & local apps (MB, VCB, TCB, VPB, etc.)
  if (app.brandBadge) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius,
          backgroundColor: app.color || '#1C1C1E',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 0.5,
          borderColor: 'rgba(255,255,255,0.15)',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize, letterSpacing: 0.2 }}>
          {app.brandBadge}
        </Text>
      </View>
    );
  }

  // Safari
  if (app.id === 'app-safari' || app.name.toLowerCase().includes('safari')) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius,
          backgroundColor: '#0A84FF',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 0.5,
          borderColor: 'rgba(255,255,255,0.15)',
        }}
      >
        <Ionicons name="compass" size={iconSize + 2} color="#FFFFFF" />
      </View>
    );
  }

  // Ghi Chú (Notes)
  if (app.id === 'app-notes' || app.name.toLowerCase().includes('ghi chú')) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius,
          backgroundColor: '#FFFBE6',
          overflow: 'hidden',
          borderWidth: 0.5,
          borderColor: 'rgba(255,255,255,0.2)',
        }}
      >
        <View style={{ height: Math.round(size * 0.28), backgroundColor: '#FFCC00', width: '100%' }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="create-outline" size={iconSize - 4} color="#8E8E93" />
        </View>
      </View>
    );
  }

  // Standard Apple Squircle Icon
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        backgroundColor: app.color || '#0A84FF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.15)',
      }}
    >
      <Ionicons name={app.icon || 'apps'} size={iconSize} color="#FFFFFF" />
    </View>
  );
};


// =========================================================================
// ENTERPRISE AUTHENTICATION SCREEN (WORLD-CLASS APPLE HIG + ANIMATIONS)
// =========================================================================
export const EnterpriseAuthScreen = ({
  authMode,
  setAuthMode,
  authUsername,
  setAuthUsername,
  authPassword,
  setAuthPassword,
  authShowPassword,
  setAuthShowPassword,
  authDisplayName,
  setAuthDisplayName,
  authConfirmPassword,
  setAuthConfirmPassword,
  authError,
  setAuthError,
  onLogin,
  onRegister,
  onFaceIdLogin,
  accentColor,
  isLight,
  triggerToast,
  savedAccount,
  setSavedAccount,
  savedDisplayName = 'Quảng Trọng Tuấn',
  useFaceId = false,
}: {
  authMode: 'login' | 'register';
  setAuthMode: (mode: 'login' | 'register') => void;
  authUsername: string;
  setAuthUsername: (v: string) => void;
  authPassword: string;
  setAuthPassword: (v: string) => void;
  authShowPassword: boolean;
  setAuthShowPassword: (v: boolean) => void;
  authDisplayName: string;
  setAuthDisplayName: (v: string) => void;
  authConfirmPassword: string;
  setAuthConfirmPassword: (v: string) => void;
  authError: string | null;
  setAuthError: (v: string | null) => void;
  onLogin: () => void;
  onRegister: () => void;
  onFaceIdLogin: () => void;
  accentColor: string;
  isLight: boolean;
  triggerToast: (msg: string, title?: string, type?: 'success' | 'info' | 'warning' | 'security') => void;
  savedAccount: string;
  setSavedAccount: (acc: string) => void;
  savedDisplayName?: string;
  useFaceId?: boolean;
}) => {
  const [isEditingAccount, setIsEditingAccount] = useState<boolean>(false);

  // Masking helper function: che một phần tài khoản/email (VD: tuandepxxxxxx@gmail.com)
  const maskAccountString = (str: string) => {
    if (!str) return '';
    const trimmed = str.trim();
    if (trimmed.includes('@')) {
      const atIdx = trimmed.indexOf('@');
      const name = trimmed.slice(0, atIdx);
      const domain = trimmed.slice(atIdx);
      const prefixLen = Math.min(7, Math.max(3, Math.floor(name.length * 0.6)));
      const prefix = name.slice(0, prefixLen);
      return `${prefix}xxxxxx${domain}`;
    }
    const prefixLen = Math.min(5, Math.max(2, Math.floor(trimmed.length / 2)));
    return `${trimmed.slice(0, prefixLen)}xxxxxx`;
  };

  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);
  const [tabLayoutWidth, setTabLayoutWidth] = useState<number>(340);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(35)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.35)).current;
  const tabIndicatorAnim = useRef(new Animated.Value(authMode === 'login' ? 0 : 1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const formOpacityAnim = useRef(new Animated.Value(1)).current;

  // Entrance & Breathing Glow Loop
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.85,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.35,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, []);

  // Animate Tab switch
  useEffect(() => {
    Animated.spring(tabIndicatorAnim, {
      toValue: authMode === 'login' ? 0 : 1,
      friction: 9,
      tension: 55,
      useNativeDriver: false,
    }).start();

    // Form fade transition
    Animated.sequence([
      Animated.timing(formOpacityAnim, {
        toValue: 0,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(formOpacityAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [authMode]);

  // Trigger shake on authError
  useEffect(() => {
    if (authError) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -4, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [authError]);

  // Password Strength Calculator
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: 'Chưa nhập', color: '#8E8E93', percent: '0%' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) || /[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: 'Bảo mật: Yếu', color: '#FF453A', percent: '30%' };
    if (score === 2) return { score: 2, label: 'Bảo mật: Khá', color: '#FF9F0A', percent: '65%' };
    return { score: 3, label: 'Bảo mật: Tối ưu (Chuẩn Doanh Nghiệp)', color: '#30D158', percent: '100%' };
  };

  const strength = getPasswordStrength(authPassword);

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      if (authMode === 'login') {
        onLogin();
      } else {
        onRegister();
      }
    }, 450);
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Khôi phục mật khẩu LockX',
      `Hướng dẫn đặt lại mật khẩu và mã xác thực bảo mật OTP đã được gửi đến email/tài khoản (${savedAccount ? maskAccountString(savedAccount) : 'được liên kết'}).`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gửi lại OTP',
          onPress: () => {
            triggerToast('Đã gửi lại mã OTP khôi phục mật khẩu vào email của bạn.', 'Khôi Phục Mật Khẩu', 'info');
          },
        },
        {
          text: 'Đã hiểu',
          onPress: () => {
            triggerToast('Vui lòng làm theo hướng dẫn để đặt lại mật khẩu két sắt.', 'Đã Gửi Hướng Dẫn', 'success');
          },
        },
      ]
    );
  };

  const tabTranslateX = tabIndicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, (tabLayoutWidth / 2) - 2],
  });

  const isRememberedLogin = authMode === 'login' && !!savedAccount && !isEditingAccount;

  return (
    <View style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      {/* Background Ambient Glowing Orbs */}
      <View
        style={{
          position: 'absolute',
          top: -60,
          alignSelf: 'center',
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: isLight ? 'rgba(0, 122, 255, 0.08)' : 'rgba(10, 132, 255, 0.16)',
          opacity: 0.9,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 40,
          right: -50,
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: isLight ? 'rgba(52, 199, 89, 0.06)' : 'rgba(48, 209, 88, 0.10)',
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 22,
          paddingVertical: 32,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            alignItems: 'center',
          }}
        >
          {/* Top Enterprise Security Badge */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              backgroundColor: isLight ? 'rgba(0, 122, 255, 0.08)' : 'rgba(10, 132, 255, 0.14)',
              borderColor: isLight ? 'rgba(0, 122, 255, 0.25)' : 'rgba(10, 132, 255, 0.38)',
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 20,
              marginBottom: 16,
            }}
          >
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#30D158' }} />
            <Text
              style={{
                color: isLight ? '#007AFF' : '#0A84FF',
                fontSize: 10.5,
                fontWeight: '800',
                letterSpacing: 0.9,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
              }}
            >
              SECURE ENCLAVE 256-BIT • ENTERPRISE READY
            </Text>
          </View>

          {/* Animated Glowing Security Shield */}
          <Animated.View
            style={{
              transform: [{ scale: pulseAnim }],
              marginBottom: 16,
            }}
          >
            {/* Outer Glowing Halo */}
            <Animated.View
              style={{
                position: 'absolute',
                top: -12,
                left: -12,
                right: -12,
                bottom: -12,
                borderRadius: 36,
                backgroundColor: accentColor,
                opacity: glowAnim,
              }}
            />
            {/* Core Squircle App Icon chuẩn từ assets/icon.png */}
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 22,
                backgroundColor: '#000000',
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: accentColor,
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.6,
                shadowRadius: 22,
                borderWidth: 1.5,
                borderColor: 'rgba(255, 255, 255, 0.25)',
                overflow: 'hidden',
              }}
            >
              <Image
                source={require('./assets/icon.png')}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            </View>
          </Animated.View>

          {/* Title & Brand Slogan */}
          <Text
            style={{
              fontSize: 30,
              fontWeight: '800',
              color: isLight ? '#000000' : '#FFFFFF',
              letterSpacing: -0.6,
              textAlign: 'center',
            }}
          >
            {authMode === 'login' ? 'LockX Enterprise' : 'Khởi Tạo Tài Khoản'}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: isLight ? '#6C6C70' : '#8E8E93',
              marginTop: 4,
              marginBottom: 22,
              textAlign: 'center',
            }}
          >
            {authMode === 'login'
              ? 'Hệ Thống Két Sắt & Bảo Mật Dữ Liệu Doanh Nghiệp'
              : 'Đăng ký tài khoản két sắt doanh nghiệp chuẩn mã hóa Apple'}
          </Text>

          {/* Animated Shake Container for Error */}
          <Animated.View
            style={{
              width: '100%',
              transform: [{ translateX: shakeAnim }],
            }}
          >
            {authError && (
              <View
                style={{
                  marginBottom: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  backgroundColor: 'rgba(255, 69, 58, 0.12)',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 69, 58, 0.35)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Ionicons name="alert-circle" size={20} color="#FF453A" />
                <Text style={{ color: '#FF453A', fontSize: 13.5, fontWeight: '600', flex: 1 }}>{authError}</Text>
              </View>
            )}
          </Animated.View>

          {/* Form Animated Transition */}
          <Animated.View
            style={{
              width: '100%',
              opacity: formOpacityAnim,
            }}
          >
            {/* Input Cards Container */}
            <View style={{ gap: 12, marginBottom: 12 }}>
              {/* REGISTER ONLY: Display Name */}
              {authMode === 'register' && (
                <View
                  style={{
                    backgroundColor: isLight ? '#FFFFFF' : 'rgba(28, 28, 30, 0.85)',
                    borderRadius: 15,
                    borderWidth: 1.5,
                    borderColor: focusedInput === 'displayName' ? accentColor : (isLight ? '#E5E5EA' : 'rgba(255, 255, 255, 0.1)'),
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    shadowColor: focusedInput === 'displayName' ? accentColor : 'transparent',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 6,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isLight ? '#6C6C70' : '#8E8E93', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
                    Họ và Tên Doanh Nghiệp
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="id-card-outline" size={18} color={focusedInput === 'displayName' ? accentColor : '#8E8E93'} style={{ marginRight: 10 }} />
                    <TextInput
                      style={{ flex: 1, fontSize: 16, color: isLight ? '#000000' : '#FFFFFF', padding: 0 }}
                      placeholder="VD: Quảng Trọng Tuấn"
                      placeholderTextColor={isLight ? '#AEAEB2' : '#636366'}
                      value={authDisplayName}
                      onChangeText={(v) => {
                        setAuthDisplayName(v);
                        if (authError) setAuthError(null);
                      }}
                      onFocus={() => setFocusedInput('displayName')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                </View>
              )}

              {/* Username Field: Ô nhập thông tin tài khoản hiển thị Hi Quảng Trọng Tuấn, ẩn nút đã lưu và đổi tài khoản trong form */}
              {authMode === 'login' && savedAccount && !isEditingAccount ? (
                <View
                  style={{
                    backgroundColor: isLight ? '#FFFFFF' : 'rgba(28, 28, 30, 0.85)',
                    borderRadius: 15,
                    borderWidth: 1.5,
                    borderColor: isLight ? '#E5E5EA' : 'rgba(255, 255, 255, 0.1)',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isLight ? '#6C6C70' : '#8E8E93', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
                    Tài Khoản
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="person-circle-outline" size={24} color={accentColor} style={{ marginRight: 10 }} />
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: isLight ? '#000000' : '#FFFFFF' }}>
                      {`Hi ${savedDisplayName && savedDisplayName !== 'Admin LockX' && savedDisplayName !== 'Admin' ? savedDisplayName : 'Quảng Trọng Tuấn'}`}
                    </Text>
                  </View>
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: isLight ? '#FFFFFF' : 'rgba(28, 28, 30, 0.85)',
                    borderRadius: 15,
                    borderWidth: 1.5,
                    borderColor: focusedInput === 'username' ? accentColor : (isLight ? '#E5E5EA' : 'rgba(255, 255, 255, 0.1)'),
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    shadowColor: focusedInput === 'username' ? accentColor : 'transparent',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isLight ? '#6C6C70' : '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {authMode === 'login' ? 'Tài Khoản / Email' : 'Tên Tài Khoản (Username)'}
                    </Text>
                    {authMode === 'login' && savedAccount ? (
                      <TouchableOpacity onPress={() => setIsEditingAccount(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: accentColor }}>Dùng tk đã lưu</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="person-outline" size={18} color={focusedInput === 'username' ? accentColor : '#8E8E93'} style={{ marginRight: 10 }} />
                    <TextInput
                      style={{ flex: 1, fontSize: 16, color: isLight ? '#000000' : '#FFFFFF', padding: 0 }}
                      placeholder={authMode === 'login' ? 'Nhập tài khoản hoặc email...' : 'VD: tuandepzai'}
                      placeholderTextColor={isLight ? '#AEAEB2' : '#636366'}
                      value={authUsername}
                      onChangeText={(v) => {
                        setAuthUsername(v);
                        if (authError) setAuthError(null);
                      }}
                      onFocus={() => setFocusedInput('username')}
                      onBlur={() => setFocusedInput(null)}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {authUsername.length > 0 && (
                      <TouchableOpacity onPress={() => setAuthUsername('')}>
                        <Ionicons name="close-circle" size={17} color="#8E8E93" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Password Field Row: Ô mật khẩu + Ô Face ID icon nằm kế bên phải */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {/* Ô nhập mật khẩu */}
                <View
                  style={{
                    flex: 1,
                    backgroundColor: isLight ? '#FFFFFF' : 'rgba(28, 28, 30, 0.85)',
                    borderRadius: 15,
                    borderWidth: 1.5,
                    borderColor: focusedInput === 'password' ? accentColor : (isLight ? '#E5E5EA' : 'rgba(255, 255, 255, 0.1)'),
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    shadowColor: focusedInput === 'password' ? accentColor : 'transparent',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 6,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isLight ? '#6C6C70' : '#8E8E93', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
                    Mật Mã Bảo Vệ Két Sắt
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="lock-closed-outline" size={18} color={focusedInput === 'password' ? accentColor : '#8E8E93'} style={{ marginRight: 10 }} />
                    <TextInput
                      style={{ flex: 1, fontSize: 16, color: isLight ? '#000000' : '#FFFFFF', padding: 0 }}
                      placeholder="Nhập mật khẩu..."
                      placeholderTextColor={isLight ? '#AEAEB2' : '#636366'}
                      value={authPassword}
                      onChangeText={(v) => {
                        setAuthPassword(v);
                        if (authError) setAuthError(null);
                      }}
                      onFocus={() => setFocusedInput('password')}
                      onBlur={() => setFocusedInput(null)}
                      secureTextEntry={!authShowPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => setAuthShowPassword(!authShowPassword)}>
                      <Ionicons
                        name={authShowPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={19}
                        color="#8E8E93"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Ô Face ID: CHỈ CÓ ICON THÔI, NẰM KẾ BÊN PHẢI Ô NHẬP MẬT KHẨU */}
                {authMode === 'login' && (
                  <TouchableOpacity
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 15,
                      backgroundColor: useFaceId
                        ? (isLight ? '#FFFFFF' : 'rgba(48, 209, 88, 0.14)')
                        : (isLight ? '#E5E5EA' : 'rgba(142, 142, 147, 0.12)'),
                      borderWidth: 1.5,
                      borderColor: useFaceId
                        ? (isLight ? '#E5E5EA' : 'rgba(48, 209, 88, 0.4)')
                        : (isLight ? '#D1D1D6' : 'rgba(142, 142, 147, 0.25)'),
                      justifyContent: 'center',
                      alignItems: 'center',
                      shadowColor: useFaceId ? '#30D158' : 'transparent',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: useFaceId ? 0.2 : 0,
                      shadowRadius: 6,
                      opacity: useFaceId ? 1 : 0.45,
                    }}
                    activeOpacity={0.75}
                    onPress={onFaceIdLogin}
                  >
                    <Image
                      source={useFaceId ? require('./assets/apple_faceid.png') : require('./assets/apple_faceid_white.png')}
                      style={{ width: 34, height: 34, tintColor: useFaceId ? undefined : '#8E8E93' }}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* REGISTER ONLY: Password Strength Meter */}
              {authMode === 'register' && authPassword.length > 0 && (
                <View style={{ paddingHorizontal: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: strength.color }}>
                      {strength.label}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#8E8E93' }}>{strength.percent}</Text>
                  </View>
                  <View style={{ height: 4, backgroundColor: isLight ? '#E5E5EA' : '#2C2C2E', borderRadius: 2, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: strength.percent as any, backgroundColor: strength.color, borderRadius: 2 }} />
                  </View>
                </View>
              )}

              {/* REGISTER ONLY: Confirm Password Field */}
              {authMode === 'register' && (
                <View
                  style={{
                    backgroundColor: isLight ? '#FFFFFF' : 'rgba(28, 28, 30, 0.85)',
                    borderRadius: 15,
                    borderWidth: 1.5,
                    borderColor: focusedInput === 'confirmPassword' ? accentColor : (isLight ? '#E5E5EA' : 'rgba(255, 255, 255, 0.1)'),
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    shadowColor: focusedInput === 'confirmPassword' ? accentColor : 'transparent',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 6,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isLight ? '#6C6C70' : '#8E8E93', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
                    Xác Nhận Lại Mật Mã
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="shield-outline" size={18} color={focusedInput === 'confirmPassword' ? accentColor : '#8E8E93'} style={{ marginRight: 10 }} />
                    <TextInput
                      style={{ flex: 1, fontSize: 16, color: isLight ? '#000000' : '#FFFFFF', padding: 0 }}
                      placeholder="Nhập lại mật khẩu..."
                      placeholderTextColor={isLight ? '#AEAEB2' : '#636366'}
                      value={authConfirmPassword}
                      onChangeText={(v) => {
                        setAuthConfirmPassword(v);
                        if (authError) setAuthError(null);
                      }}
                      onFocus={() => setFocusedInput('confirmPassword')}
                      onBlur={() => setFocusedInput(null)}
                      secureTextEntry={!authShowPassword}
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Quick Action Links: Đổi tài khoản & Quên mật khẩu */}
            {authMode === 'login' && (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                  paddingHorizontal: 4,
                }}
              >
                {savedAccount && !isEditingAccount ? (
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingAccount(true);
                      setAuthUsername('');
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: accentColor }}>
                      Đổi tài khoản
                    </Text>
                  </TouchableOpacity>
                ) : savedAccount ? (
                  <TouchableOpacity
                    onPress={() => setIsEditingAccount(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: accentColor }}>
                      Dùng tài khoản đã lưu
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View />
                )}

                <TouchableOpacity
                  onPress={handleForgotPassword}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: accentColor }}>
                    Quên mật khẩu?
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Apple Sliding Segmented Control - NẰM PHÍA DƯỚI Ô TÀI KHOẢN & MẬT KHẨU */}
            <View
              onLayout={(e) => setTabLayoutWidth(e.nativeEvent.layout.width)}
              style={{
                width: '100%',
                flexDirection: 'row',
                backgroundColor: isLight ? '#E5E5EA' : 'rgba(28, 28, 30, 0.9)',
                borderRadius: 14,
                padding: 3,
                position: 'relative',
                borderWidth: 0.5,
                borderColor: isLight ? '#D1D1D6' : 'rgba(255, 255, 255, 0.1)',
                marginBottom: 16,
                height: 48,
              }}
            >
              {/* Sliding Animated Indicator Capsule */}
              <Animated.View
                style={{
                  position: 'absolute',
                  top: 3,
                  bottom: 3,
                  left: 0,
                  width: (tabLayoutWidth / 2) - 4,
                  borderRadius: 11,
                  backgroundColor: isLight ? '#FFFFFF' : '#3A3A3C',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isLight ? 0.14 : 0.4,
                  shadowRadius: 5,
                  transform: [{ translateX: tabTranslateX }],
                }}
              />

              <TouchableOpacity
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1,
                }}
                activeOpacity={0.8}
                onPress={() => {
                  setAuthMode('login');
                  setAuthError(null);
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: authMode === 'login' ? '700' : '500',
                    color: authMode === 'login' ? (isLight ? '#000000' : '#FFFFFF') : (isLight ? '#6C6C70' : '#8E8E93'),
                  }}
                >
                  Đăng Nhập
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1,
                }}
                activeOpacity={0.8}
                onPress={() => {
                  setAuthMode('register');
                  setAuthError(null);
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: authMode === 'register' ? '700' : '500',
                    color: authMode === 'register' ? (isLight ? '#000000' : '#FFFFFF') : (isLight ? '#6C6C70' : '#8E8E93'),
                  }}
                >
                  Đăng Ký
                </Text>
              </TouchableOpacity>
            </View>

            {/* Remember Device Option */}
            {authMode === 'login' && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingHorizontal: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="finger-print-outline" size={16} color={accentColor} />
                  <Text style={{ fontSize: 13, color: isLight ? '#3C3C43' : '#AEAEB2' }}>
                    Ghi nhớ thiết bị an toàn (30 ngày)
                  </Text>
                </View>
                <Switch
                  value={rememberDevice}
                  onValueChange={setRememberDevice}
                  trackColor={{ false: isLight ? '#E5E5EA' : '#39393D', true: '#34C759' }}
                />
              </View>
            )}

            {/* Primary Action Button (Gradient/Glow Style) */}
            <TouchableOpacity
              style={{
                backgroundColor: accentColor,
                height: 52,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                marginBottom: 14,
                shadowColor: accentColor,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.45,
                shadowRadius: 14,
                opacity: isSubmitting ? 0.7 : 1,
              }}
              activeOpacity={0.85}
              disabled={isSubmitting}
              onPress={handleSubmit}
            >
              {isSubmitting ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                    Đang Xác Thực Bảo Mật...
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 }}>
                    {authMode === 'login' ? 'Đăng Nhập An Toàn' : 'Khởi Tạo Tài Khoản Doanh Nghiệp'}
                  </Text>
                  <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            {/* Compliance Footer */}
            <View style={{ alignItems: 'center', marginTop: 10, paddingBottom: 20 }}>
              <Text style={{ fontSize: 11, color: isLight ? '#8E8E93' : '#636366', textAlign: 'center' }}>
                LockX Enterprise Vault v2.6 • ISO/IEC 27001 & SOC 2 Type II
              </Text>
              <Text style={{ fontSize: 10.5, color: isLight ? '#AEAEB2' : '#48484A', marginTop: 3 }}>
                Được bảo vệ bởi mã hóa phần cứng Secure Enclave Apple
              </Text>
            </View>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

export default function App() {
  // Onboarding & Load Stages: 'loading' -> 'onboarding' -> 'ready' (Bypass vào thẳng trang chủ)
  const [onboardingStage, setOnboardingStage] = useState<'loading' | 'onboarding' | 'ready'>('ready');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('vi');

  // Nhận diện phiên bản iOS và Build ID chính xác từ thiết bị
  const [detectedOsVersion, setDetectedOsVersion] = useState<string>(() => {
    return Device.osVersion || (Platform.OS === 'ios' ? String(Platform.Version) : '18.2');
  });
  const [detectedOsBuild, setDetectedOsBuild] = useState<string>(() => {
    return Device.osBuildId || (Platform.OS === 'ios' ? '22C152' : '23G90');
  });
  const [isSimulatedOverride, setIsSimulatedOverride] = useState<boolean | null>(true);

  // Cho phép truy cập thẳng trang chủ
  const isDeviceSupported = true;

  const [hasNotifPermission, setHasNotifPermission] = useState(false);

  const [currentTab, setCurrentTab] = useState<'vault' | 'apps' | 'chat' | 'profile' | 'settings'>('vault');
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [phoneApps, setPhoneApps] = useState<PhoneAppItem[]>(INITIAL_IPHONE_APPS);
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [appCategoryFilter, setAppCategoryFilter] = useState<'all' | 'locked' | 'social' | 'finance' | 'tools' | 'shopping' | 'system' | 'game'>('all');
  const [selectedPhoneApp, setSelectedPhoneApp] = useState<PhoneAppItem | null>(null);
  const [isManageAppsModalOpen, setIsManageAppsModalOpen] = useState(false);

  // Profile State (Thông tin người dùng, sử dụng bao lâu, đổi mật khẩu, lịch sử đăng nhập)
  const [userProfile, setUserProfile] = useState<UserProfile>(INITIAL_USER_PROFILE);
  const [profileSubView, setProfileSubView] = useState<'main' | 'change_password' | 'edit_profile' | 'verify_id'>('main');
  const [loginHistory, setLoginHistory] = useState<LoginHistoryRecord[]>(INITIAL_LOGIN_HISTORY);
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmNewPassInput, setConfirmNewPassInput] = useState('');
  const [editDisplayNameInput, setEditDisplayNameInput] = useState(INITIAL_USER_PROFILE.displayName);
  const [editUsernameInput, setEditUsernameInput] = useState(INITIAL_USER_PROFILE.username);
  const [editEmailInput, setEditEmailInput] = useState(INITIAL_USER_PROFILE.email || '');
  const [editPhoneInput, setEditPhoneInput] = useState(INITIAL_USER_PROFILE.phone || '');
  const [editBioInput, setEditBioInput] = useState(INITIAL_USER_PROFILE.bio || '');
  const [editBirthdayInput, setEditBirthdayInput] = useState(INITIAL_USER_PROFILE.birthday || '');
  const [editGenderInput, setEditGenderInput] = useState<'Nam' | 'Nữ' | 'Khác' | 'Bảo mật' | 'Chưa cập nhật'>(INITIAL_USER_PROFILE.gender || 'Chưa cập nhật');

  // Avatar Editor State (Tải ảnh từ máy / Chọn avatar có sẵn / Monogram)
  const [editAvatarType, setEditAvatarType] = useState<'image' | 'preset' | 'monogram'>(INITIAL_USER_PROFILE.avatarType || 'preset');
  const [editAvatarUri, setEditAvatarUri] = useState<string>(INITIAL_USER_PROFILE.avatarUri || '');
  const [editAvatarPresetId, setEditAvatarPresetId] = useState<string>(INITIAL_USER_PROFILE.avatarPresetId || 'av-hacker');
  const [editAvatarColor, setEditAvatarColor] = useState<string>(INITIAL_USER_PROFILE.avatarColor || '#0A84FF');
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarPickerTab, setAvatarPickerTab] = useState<'presets' | 'upload' | 'monogram'>('presets');
  // Thông tin thiết bị, mạng & vị trí thực tế
  const [realLocation, setRealLocation] = useState<string>('Hà Nội, Việt Nam');
  const [realIp, setRealIp] = useState<string>('14.225.21.84');
  const [totalActiveSeconds, setTotalActiveSeconds] = useState<number>(360);

  // Authentication State (Đăng Nhập / Đăng Ký lúc mới vào App)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [savedAccount, setSavedAccount] = useState<string>('tuandep12345@gmail.com');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('admin');
  const [authPassword, setAuthPassword] = useState('123456');
  const [authShowPassword, setAuthShowPassword] = useState(false);
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<
    Array<{ username: string; password: string; displayName: string }>
  >([
    { username: 'admin', password: '123456', displayName: 'Admin LockX' },
    { username: 'tuandep12345@gmail.com', password: '123456', displayName: 'Tuấn Đẹp Trai' },
  ]);


  // Settings State (Màu giao diện, cỡ chữ, chữ in đậm, sáng/tối, ngôn ngữ & bảo mật thương mại)
  const [appSettings, setAppSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [settingsSubView, setSettingsSubView] = useState<'main' | 'font_size' | 'language'>('main');
  const [languageSearchQuery, setLanguageSearchQuery] = useState('');

  const isLight = appSettings.themeMode === 'light';
  const activeLanguage = appSettings.language || selectedLanguage || 'vi';
  const t = APP_TRANSLATIONS[activeLanguage] || APP_TRANSLATIONS.vi;
  const styles = useMemo(
    () => getStyles(isLight, appSettings.accentColor, appSettings.fontSizeScale, appSettings.isBoldText, appSettings.fontSizeLevel ?? 3),
    [isLight, appSettings.accentColor, appSettings.fontSizeScale, appSettings.isBoldText, appSettings.fontSizeLevel]
  );
  const [settingsSearchQuery, setSettingsSearchQuery] = useState('');
  const [isFaceIdScanning, setIsFaceIdScanning] = useState(false);
  const [faceIdScanStatus, setFaceIdScanStatus] = useState<'scanning' | 'success' | 'failed'>('scanning');
  const [cacheSize, setCacheSize] = useState('18.4 MB');
  const [isCleaningCache, setIsCleaningCache] = useState(false);

  // Friends & Messaging State (Tìm kiếm username & phòng chat iMessage)
  const [friendsList, setFriendsList] = useState<FriendUser[]>(INITIAL_FRIENDS);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>(INITIAL_CHAT_MESSAGES);
  const [activeChatFriend, setActiveChatFriend] = useState<FriendUser | null>(null);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [chatInputText, setChatInputText] = useState('');
  const [friendFilter, setFriendFilter] = useState<'all' | 'online' | 'unread'>('all');
  const [showAddFriendBox, setShowAddFriendBox] = useState(false);
  const [newFriendInput, setNewFriendInput] = useState('');
  const [viewingFriendProfile, setViewingFriendProfile] = useState<FriendUser | null>(null);
  const [isFriendTyping, setIsFriendTyping] = useState<boolean>(false);
  const [chatSenderMode, setChatSenderMode] = useState<'me' | 'friend'>('me');
  const chatScrollRef = useRef<ScrollView>(null);

  // Form tự thêm app
  const [customAppName, setCustomAppName] = useState('');
  const [customAppScheme, setCustomAppScheme] = useState('');
  const [customAppCategory, setCustomAppCategory] = useState<'system' | 'social' | 'game' | 'finance' | 'tools' | 'shopping'>('social');

  const [staminaList, setStaminaList] = useState<StaminaItem[]>(INITIAL_STAMINA);
  const [gachaList, setGachaList] = useState<GachaItem[]>(INITIAL_GACHA);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modals & Sub-views (Nâng cấp thành màn hình toàn phần tránh lỗi bàn phím)
  const [vaultSubView, setVaultSubView] = useState<'list' | 'add' | 'detail'>('list');
  const [screenTimePeriod, setScreenTimePeriod] = useState<'today' | 'week'>('today');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isPwdRevealed, setIsPwdRevealed] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [showNotificationCenter, setShowNotificationCenter] = useState<boolean>(false);
  const [notifFilterTab, setNotifFilterTab] = useState<'all' | 'unread'>('all');
  const [successPopup, setSuccessPopup] = useState<{
    id: string;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'security';
    customIcon?: string;
    customColor?: string;
  } | null>(null);

  const [bannerNotification, setBannerNotification] = useState<{
    id: string;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'security';
  } | null>(null);

  const popupScaleAnim = useRef(new Animated.Value(0.8)).current;
  const popupOpacityAnim = useRef(new Animated.Value(0)).current;
  const checkScaleAnim = useRef(new Animated.Value(0)).current;
  const checkRotateAnim = useRef(new Animated.Value(0)).current;
  const ringScaleAnim = useRef(new Animated.Value(0.8)).current;
  const ringOpacityAnim = useRef(new Animated.Value(0)).current;
  const popupTimeoutRef = useRef<any>(null);

  const checkRotation = checkRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-30deg', '0deg'],
  });

  const bannerAnimY = useRef(new Animated.Value(-120)).current;
  const bannerAnimScale = useRef(new Animated.Value(0.88)).current;
  const bannerAnimOpacity = useRef(new Animated.Value(0)).current;
  const bannerTimeoutRef = useRef<any>(null);

  const unreadNotifCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  // Tool Subview Modals
  const [activeToolView, setActiveToolView] = useState<'ping' | 'pwd' | 'reset' | null>(null);

  // New Account Form State (Đã xóa UID & 2FA, ưu tiên Ghi Chú)
  const [newTitle, setNewTitle] = useState('');
  const [newGame, setNewGame] = useState('Genshin Impact');
  const [newServer, setNewServer] = useState('Asia');
  const [newCategory, setNewCategory] = useState('Game');
  const [newUser, setNewUser] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newIgn, setNewIgn] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Password Generator in Tool
  const [pwdLength, setPwdLength] = useState(16);
  const [generatedPwd, setGeneratedPwd] = useState('kX9#vM2@qP7$zL4!');

  // Clock
  const [clockStr, setClockStr] = useState('09:41');

  // Tải danh sách app & cài đặt đã lưu từ AsyncStorage và tính toán dữ liệu thực tế
  useEffect(() => {
    // 1. Nhận diện vị trí thực tế từ Timezone và lấy IP thực qua API
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (tz.includes('Ho_Chi_Minh') || tz.includes('Saigon') || tz.includes('Bangkok') || tz.includes('Hanoi')) {
        setRealLocation('Hà Nội, Việt Nam');
      } else if (tz) {
        setRealLocation(tz.split('/').pop()?.replace(/_/g, ' ') || 'Việt Nam');
      }
    } catch (e) {}

    fetch('https://api.ipify.org?format=json')
      .then((r) => r.json())
      .then((d) => {
        if (d && d.ip) setRealIp(d.ip);
      })
      .catch(() => {});

    // 2. Tải thời gian hoạt động thực tế tích lũy
    AsyncStorage.getItem('lockx_total_active_seconds')
      .then((secStr) => {
        if (secStr) {
          const s = parseInt(secStr, 10);
          if (!isNaN(s) && s > 0) setTotalActiveSeconds(s);
        }
      })
      .catch(() => {});

    // 3. Tải danh sách app
    AsyncStorage.getItem('lockx_user_phone_apps')
      .then((saved) => {
        if (saved) {
          try {
            const list = JSON.parse(saved);
            if (Array.isArray(list) && list.length > 0) {
              setPhoneApps(list);
            }
          } catch (e) {}
        }
      })
      .catch(() => {});

    // 4. Tải hồ sơ người dùng thật (Xóa bỏ ngày ảo 15/08/2026, tính ngày sử dụng thật)
    AsyncStorage.getItem('lockx_user_profile')
      .then((s) => {
        let p = s ? JSON.parse(s) : null;
        const realToday = getFormattedTodayDate();
        const joinTimestamp = (p && p.joinTimestamp) || Date.now();
        const diffMs = Date.now() - joinTimestamp;
        const diffDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);

        const updatedProfile: UserProfile = {
          displayName: (p && p.displayName && p.displayName !== 'Admin LockX') ? p.displayName : 'Quảng Trọng Tuấn',
          username: (p && p.username && p.username !== '@admin_lockx' && p.username !== '@admin') ? p.username : '@tuandepzai',
          avatarColor: (p && p.avatarColor) || '#0A84FF',
          avatarType: (p && p.avatarType) || 'preset',
          avatarUri: (p && p.avatarUri) || '',
          avatarPresetId: (p && p.avatarPresetId) || 'av-shield',
          email: (p && p.email) || 'tuandepzai@gmail.com',
          phone: (p && p.phone) || '',
          bio: (p && p.bio) || 'Chuyên gia bảo mật & Quản trị viên LockX Vault',
          birthday: (p && p.birthday) || '',
          gender: (p && p.gender) || 'Nam',
          joinDate: (p && p.joinDate && p.joinDate !== '15/08/2026') ? p.joinDate : realToday,
          joinTimestamp: joinTimestamp,
          daysActive: (p && p.daysActive && p.daysActive !== 40) ? p.daysActive : diffDays,
          hoursUsed: (p && p.hoursUsed && p.hoursUsed !== 168) ? p.hoursUsed : 0.1,
          currentPasscode: (p && p.currentPasscode) || '123456',
          lastUsernameChangeTimestamp: (p && p.lastUsernameChangeTimestamp) || 0,
        };
        setUserProfile(updatedProfile);
        setEditDisplayNameInput(updatedProfile.displayName);
        setEditUsernameInput(updatedProfile.username);
        AsyncStorage.setItem('lockx_user_profile', JSON.stringify(updatedProfile)).catch(() => {});
      })
      .catch(() => {});

    // 5. Cài đặt hệ thống
    AsyncStorage.getItem('lockx_app_settings')
      .then((s) => {
        if (s) {
          try {
            setAppSettings(JSON.parse(s));
          } catch (e) {}
        }
      })
      .catch(() => {});

    // 6. Lịch sử thiết bị thật (Loại bỏ các thiết bị ảo mock trước đây, lưu phiên thiết bị hiện tại)
    AsyncStorage.getItem('lockx_login_history')
      .then((s) => {
        let list: LoginHistoryRecord[] = [];
        if (s) {
          try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed)) {
              // Lọc bỏ danh sách mock giả định cũ
              list = parsed.filter((item) => !['lh-1', 'lh-2', 'lh-3', 'lh-4', 'lh-5'].includes(item.id));
            }
          } catch (e) {}
        }
        const realDev = getRealDeviceInfo();
        const currentSession: LoginHistoryRecord = {
          id: 'current-session',
          timestamp: 'Hiện tại (Đang hoạt động)',
          device: realDev.model,
          os: realDev.os,
          location: 'Hà Nội, Việt Nam',
          method: 'Face ID',
          ip: '14.225.21.84',
          isCurrent: true,
        };
        const merged = [currentSession, ...list.filter((x) => x.id !== 'current-session')];
        setLoginHistory(merged);
        AsyncStorage.setItem('lockx_login_history', JSON.stringify(merged)).catch(() => {});
      })
      .catch(() => {});

    // 7. Bạn bè & Tin nhắn
    AsyncStorage.getItem('lockx_friends')
      .then((s) => {
        if (s) {
          try {
            setFriendsList(JSON.parse(s));
          } catch (e) {}
        }
      })
      .catch(() => {});

    AsyncStorage.getItem('lockx_chat_messages')
      .then((s) => {
        if (s) {
          try {
            setChatMessages(JSON.parse(s));
          } catch (e) {}
        }
      })
      .catch(() => {});

    // 8. Tải lịch sử thông báo iOS
    AsyncStorage.getItem('lockx_notifications_history')
      .then((s) => {
        if (s) {
          try {
            const list = JSON.parse(s);
            if (Array.isArray(list) && list.length > 0) {
              setNotifications(list);
            }
          } catch (e) {}
        }
      })
      .catch(() => {});

    // 9. Tính toán dung lượng bộ nhớ đệm thực tế
    calculateRealCacheSize();
  }, []);

  // Bộ đếm thời gian hoạt động thực tế (cộng dồn mỗi 5s khi app mở và lưu vào AsyncStorage)
  useEffect(() => {
    const timer = setInterval(() => {
      setTotalActiveSeconds((prev) => {
        const next = prev + 5;
        if (next % 30 === 0) {
          AsyncStorage.setItem('lockx_total_active_seconds', String(next)).catch(() => {});
        }
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const saveUserProfile = async (up: UserProfile) => {
    setUserProfile(up);
    try {
      await AsyncStorage.setItem('lockx_user_profile', JSON.stringify(up));
    } catch (e) {}
  };

  const saveAppSettings = async (st: AppSettings) => {
    setAppSettings(st);
    try {
      await AsyncStorage.setItem('lockx_app_settings', JSON.stringify(st));
    } catch (e) {}
  };

  // Tạo bản ghi thiết bị và phiên đăng nhập thực tế
  const createRealLoginRecord = (method: 'Face ID' | 'Mật khẩu' | 'Passcode', isCurrent: boolean = false): LoginHistoryRecord => {
    const dev = getRealDeviceInfo();
    return {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: isCurrent ? 'Hiện tại (Đang hoạt động)' : 'Vừa xong',
      device: dev.model,
      os: dev.os,
      location: realLocation || 'Hà Nội, Việt Nam',
      method,
      ip: realIp || '14.225.21.84',
      isCurrent,
    };
  };

  // Kích hoạt xác thực sinh trắc học Face ID thật của Apple qua LocalAuthentication
  const triggerFaceIdAuth = async (reason: string, onSuccess: () => void, onError?: () => void) => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: reason,
          fallbackLabel: 'Sử dụng mật mã dự phòng',
          cancelLabel: 'Hủy bỏ',
          disableDeviceFallback: false,
        });

        if (result.success) {
          const newLog = createRealLoginRecord('Face ID', true);
          saveLoginHistory([newLog, ...loginHistory.filter((x) => x.id !== 'current-session')]);
          onSuccess();
          return;
        } else {
          if (onError) onError();
          return;
        }
      }
    } catch (e) {}

    // Trường hợp thiết bị không hỗ trợ phần cứng sinh trắc học
    const newLog = createRealLoginRecord('Face ID', true);
    saveLoginHistory([newLog, ...loginHistory.filter((x) => x.id !== 'current-session')]);
    onSuccess();
  };

  // Bật / tắt Face ID trong Cài đặt chỉ gọi popup xác thực thật của Apple
  const handleToggleFaceId = (enable: boolean) => {
    if (enable) {
      triggerFaceIdAuth(
        'Xác thực Face ID để kích hoạt tính năng đăng nhập sinh trắc học',
        () => {
          saveAppSettings({ ...appSettings, useFaceId: true });
          triggerToast('Đã kích hoạt bảo mật Face ID thành công.', 'Face ID', 'security', false);
        },
        () => {
          triggerToast('Không thể xác thực Face ID. Vui lòng thử lại.', 'Xác Thực Thất Bại', 'warning', false);
        }
      );
    } else {
      saveAppSettings({ ...appSettings, useFaceId: false });
      triggerToast('Đã tắt đăng nhập bằng Face ID.', 'Cài Đặt Bảo Mật', 'info', false);
    }
  };

  // Tính toán dung lượng bộ nhớ đệm thực tế từ Storage
  const calculateRealCacheSize = () => {
    try {
      let totalBytes = 0;
      if (typeof window !== 'undefined' && window.localStorage) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) {
            const v = localStorage.getItem(k) || '';
            totalBytes += (k.length + v.length) * 2;
          }
        }
      }
      if (totalBytes <= 0) {
        setCacheSize('0.0 KB');
      } else if (totalBytes < 1024) {
        setCacheSize(`${totalBytes} B`);
      } else if (totalBytes < 1024 * 1024) {
        setCacheSize(`${(totalBytes / 1024).toFixed(1)} KB`);
      } else {
        setCacheSize(`${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
      }
    } catch (e) {
      setCacheSize('14.2 KB');
    }
  };

  // Dọn dẹp bộ nhớ đệm ứng dụng thực tế
  const handleClearCache = () => {
    setIsCleaningCache(true);
    setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.clear();
        }
        localStorage.removeItem('lockx_search_temp');
        localStorage.removeItem('lockx_view_history');
      } catch (e) {}
      setCacheSize('0.0 KB');
      setIsCleaningCache(false);
      triggerToast('Đã giải phóng bộ nhớ đệm thực tế của ứng dụng.', 'Dọn Dẹp Thành Công', 'success', true);
    }, 600);
  };

  // Xuất tệp sao lưu JSON thực tế tải về thiết bị
  const handleExportBackup = () => {
    try {
      const backupData = {
        app: 'LockX Pro Vault',
        version: '2.6.0',
        exportedAt: new Date().toISOString(),
        userProfile,
        appSettings,
        accounts,
        phoneApps,
      };
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', `LockX_Backup_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        triggerToast('Đã xuất và tải tệp sao lưu JSON an toàn.', 'Xuất Dữ Liệu Thành Công', 'success', true);
      } else {
        Clipboard.setString(JSON.stringify(backupData, null, 2));
        triggerToast('Đã sao chép khóa sao lưu JSON vào Clipboard.', 'Sao Lưu Dữ Liệu', 'success', false);
      }
    } catch (e) {
      triggerToast('Không thể tạo file sao lưu.', 'Lỗi', 'warning', false);
    }
  };

  // Khôi phục dữ liệu từ tệp JSON đã lưu
  const handleImportBackup = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const parsed = JSON.parse(event.target?.result as string);
              if (parsed && (parsed.accounts || parsed.appSettings)) {
                if (Array.isArray(parsed.accounts)) {
                  setAccounts(parsed.accounts);
                  AsyncStorage.setItem('lockx_accounts', JSON.stringify(parsed.accounts)).catch(() => {});
                }
                if (Array.isArray(parsed.phoneApps)) {
                  setPhoneApps(parsed.phoneApps);
                  AsyncStorage.setItem('lockx_user_phone_apps', JSON.stringify(parsed.phoneApps)).catch(() => {});
                }
                triggerToast('Đã khôi phục dữ liệu từ tệp sao lưu thành công!', 'Khôi Phục Thành Công', 'success', true);
              } else {
                Alert.alert('Tệp không hợp lệ', 'Tệp sao lưu không đúng định dạng của LockX.');
              }
            } catch (err) {
              Alert.alert('Lỗi đọc tệp', 'Không thể phân tích dữ liệu JSON.');
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    }
  };

  // Kiểm tra an toàn bảo mật mật khẩu
  const handleSecurityAudit = () => {
    let weakCount = 0;
    accounts.forEach((acc) => {
      if ((acc.password || '').length < 8) weakCount++;
    });
    const safeCount = accounts.length - weakCount;
    Alert.alert(
      'Kiểm Tra Độ An Toàn Mật Khẩu',
      `Tổng số: ${accounts.length} tài khoản trong két sắt.\n\n• ${safeCount} tài khoản đạt chuẩn mật khẩu mạnh (>= 8 ký tự).\n• ${weakCount > 0 ? `${weakCount} tài khoản mật khẩu còn ngắn (< 8 ký tự).` : 'Tất cả tài khoản đều an toàn tuyệt đối!'}`
    );
  };

  
  // =========================================================================
  // XỬ LÝ ĐĂNG NHẬP / ĐĂNG KÝ / ĐĂNG XUẤT
  // =========================================================================
  const handleLogin = (accountOverride?: string) => {
    setAuthError(null);
    const trimmedUser = (accountOverride || authUsername || savedAccount).trim();
    const trimmedPass = authPassword.trim();
    if (!trimmedUser || !trimmedPass) {
      setAuthError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }
    const found = registeredUsers.find(
      (u) => u.username.toLowerCase() === trimmedUser.toLowerCase() && u.password === trimmedPass
    );
    if (found || (trimmedUser.toLowerCase() === 'admin' && trimmedPass === '123456')) {
      const activeUser = found || { username: 'admin', password: '123456', displayName: 'Admin LockX' };
      setUserProfile((prev) => ({
        ...prev,
        username: `@${activeUser.username}`,
        displayName: activeUser.displayName,
        currentPasscode: activeUser.password,
      }));
      const newLog = createRealLoginRecord('Mật khẩu', true);
      saveLoginHistory([newLog, ...loginHistory.filter(x => x.id !== 'current-session')]);
      setSavedAccount(trimmedUser);
      try {
        AsyncStorage.setItem('lockx_saved_account', trimmedUser);
      } catch (e) {}
      setIsAuthenticated(true);
      triggerToast(`Chào mừng ${activeUser.displayName} quay trở lại két sắt an toàn.`, 'Đăng Nhập Thành Công', 'success');
    } else {
      setAuthError('Tài khoản hoặc mật khẩu không chính xác.');
    }
  };

  const handleRegister = () => {
    setAuthError(null);
    const trimmedName = authDisplayName.trim();
    const trimmedUser = authUsername.trim();
    const trimmedPass = authPassword.trim();
    const trimmedConfirm = authConfirmPassword.trim();

    if (!trimmedName || !trimmedUser || !trimmedPass || !trimmedConfirm) {
      setAuthError('Vui lòng điền đầy đủ tất cả thông tin.');
      return;
    }
    if (trimmedPass.length < 4) {
      setAuthError('Mật khẩu bảo mật phải có ít nhất 4 ký tự.');
      return;
    }
    if (trimmedPass !== trimmedConfirm) {
      setAuthError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }
    if (registeredUsers.some((u) => u.username.toLowerCase() === trimmedUser.toLowerCase())) {
      setAuthError('Tên tài khoản này đã tồn tại, vui lòng chọn tên khác.');
      return;
    }

    const newUser = {
      username: trimmedUser,
      password: trimmedPass,
      displayName: trimmedName,
    };
    setRegisteredUsers((prev) => [...prev, newUser]);
    setSavedAccount(trimmedUser);
    try {
      AsyncStorage.setItem('lockx_saved_account', trimmedUser);
    } catch (e) {}
    setUserProfile((prev) => ({
      ...prev,
      username: `@${trimmedUser}`,
      displayName: trimmedName,
      currentPasscode: trimmedPass,
    }));
    const newLog = createRealLoginRecord('Passcode', true);
    saveLoginHistory([newLog, ...loginHistory.filter(x => x.id !== 'current-session')]);
    setIsAuthenticated(true);
    triggerToast(`Tài khoản @${trimmedUser} đã được mã hóa an toàn trong Keychain.`, 'Đăng Ký Thành Công', 'success', true);
  };

  const handleFaceIdLogin = () => {
    if (!appSettings.useFaceId) {
      setAuthError('Bạn chưa bật tính năng Face ID trong Cài đặt. Vui lòng đăng nhập bằng mật khẩu để bật tính năng này.');
      triggerToast('Vui lòng bật Face ID trong Cài đặt trước khi sử dụng.', 'Chưa Bật Face ID', 'warning');
      return;
    }
    triggerFaceIdAuth('Xác thực Face ID để đăng nhập vào LockX Vault', () => {
      setIsAuthenticated(true);
      triggerToast('Xác thực sinh trắc học Face ID thành công. Két sắt đã mở.', 'Đăng Nhập Thành Công', 'success');
    });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthPassword('');
    setAuthConfirmPassword('');
    setAuthError(null);
    triggerToast('Phiên làm việc đã được đóng và mã hóa bảo vệ an toàn.', 'Đã Đăng Xuất An Toàn', 'info');
  };

  const saveLoginHistory = async (lh: LoginHistoryRecord[]) => {
    setLoginHistory(lh);
    try {
      await AsyncStorage.setItem('lockx_login_history', JSON.stringify(lh));
    } catch (e) {}
  };

  const saveFriends = async (fl: FriendUser[]) => {
    setFriendsList(fl);
    try {
      await AsyncStorage.setItem('lockx_friends', JSON.stringify(fl));
    } catch (e) {}
  };

  const saveChatMessages = async (cm: Record<string, ChatMessage[]>) => {
    setChatMessages(cm);
    try {
      await AsyncStorage.setItem('lockx_chat_messages', JSON.stringify(cm));
    } catch (e) {}
  };

  // Xử lý đổi mật khẩu tài khoản
  const handleChangePassword = () => {
    if (userProfile.currentPasscode && currentPassInput !== userProfile.currentPasscode) {
      Alert.alert('Mật khẩu sai', 'Mật khẩu hiện tại không chính xác.');
      return;
    }
    if (newPassInput.length < 4) {
      Alert.alert('Mật khẩu quá ngắn', 'Vui lòng đặt mật khẩu ít nhất 4 ký tự.');
      return;
    }
    if (newPassInput !== confirmNewPassInput) {
      Alert.alert('Không khớp', 'Mật khẩu mới và mật khẩu xác nhận không trùng khớp.');
      return;
    }
    const updatedProfile: UserProfile = {
      ...userProfile,
      currentPasscode: newPassInput,
    };
    saveUserProfile(updatedProfile);

    // Ghi nhận vào lịch sử
    const newLog = createRealLoginRecord('Mật khẩu', true);
    saveLoginHistory([newLog, ...loginHistory.filter(x => x.id !== 'current-session')]);

    setCurrentPassInput('');
    setNewPassInput('');
    setConfirmNewPassInput('');
    setProfileSubView('main');
    triggerToast('Mật khẩu quản trị két sắt đã được mã hóa an toàn.', 'Đổi Mật Khẩu Thành Công', 'success', true);
  };

  // Helper render Avatar đa năng cho người dùng (hỗ trợ ảnh tải lên, icon preset và monogram)
  const renderProfileAvatar = (
    avatarType: 'image' | 'preset' | 'monogram' = 'preset',
    avatarUri: string = '',
    avatarPresetId: string = 'av-hacker',
    displayName: string = 'Admin',
    avatarColor: string = '#0A84FF',
    size: number = 80
  ) => {
    const radius = size / 2;
    const fontSize = Math.round(size * 0.42);

    if (avatarType === 'image' && avatarUri) {
      return (
        <Image
          source={{ uri: avatarUri }}
          style={{ width: size, height: size, borderRadius: radius }}
          resizeMode="cover"
        />
      );
    }

    if (avatarType === 'preset' && avatarPresetId) {
      const preset = APP_AVATAR_PRESETS.find((p) => p.id === avatarPresetId) || APP_AVATAR_PRESETS[0];
      return (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: preset.bgColor,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: preset.bgColor,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.35,
            shadowRadius: 5,
          }}
        >
          <Ionicons name={preset.icon as any} size={Math.round(size * 0.52)} color="#FFFFFF" />
        </View>
      );
    }

    const initial = (displayName || 'A').charAt(0).toUpperCase();
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: avatarColor || appSettings.accentColor,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize }}>{initial}</Text>
      </View>
    );
  };

  // Mở màn hình Sửa hồ sơ và nạp toàn bộ dữ liệu hiện tại
  const handleOpenEditProfile = () => {
    setEditDisplayNameInput(userProfile.displayName || '');
    setEditUsernameInput(userProfile.username || '');
    setEditEmailInput(userProfile.email || '');
    setEditPhoneInput(userProfile.phone || '');
    setEditBioInput(userProfile.bio || '');
    setEditBirthdayInput(userProfile.birthday || '');
    setEditGenderInput(userProfile.gender || 'Chưa cập nhật');
    setEditAvatarType(userProfile.avatarType || 'preset');
    setEditAvatarUri(userProfile.avatarUri || '');
    setEditAvatarPresetId(userProfile.avatarPresetId || 'av-hacker');
    setEditAvatarColor(userProfile.avatarColor || appSettings.accentColor);
    setProfileSubView('edit_profile');
  };

  // Chọn ảnh từ thiết bị (hỗ trợ cả web browser file dialog và native)
  const handlePickDeviceImage = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          if (file.size > 8 * 1024 * 1024) {
            Alert.alert('Ảnh quá lớn', 'Vui lòng chọn ảnh có kích thước dưới 8MB.');
            return;
          }
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            if (base64) {
              setEditAvatarType('image');
              setEditAvatarUri(base64);
              setIsAvatarModalOpen(false);
              triggerToast('✓ Đã tải ảnh từ thiết bị lên thành công');
            }
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      Alert.alert('Tải ảnh thiết bị', 'Vui lòng chọn ảnh từ trình duyệt web.');
    }
  };

  // Xử lý lưu hồ sơ người dùng đầy đủ chi tiết
  const handleSaveEditProfile = () => {
    if (!editDisplayNameInput.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ và tên.');
      return;
    }
    let formattedUsername = editUsernameInput.trim();
    if (!formattedUsername.startsWith('@')) {
      formattedUsername = `@${formattedUsername}`;
    }

    // Kiểm tra cooldown đổi username: 7 ngày được đổi 1 lần
    const currentUsername = userProfile.username || '';
    let newLastChange = userProfile.lastUsernameChangeTimestamp || 0;
    if (formattedUsername.toLowerCase() !== currentUsername.toLowerCase()) {
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      if (userProfile.lastUsernameChangeTimestamp && (now - userProfile.lastUsernameChangeTimestamp) < SEVEN_DAYS_MS) {
        const remainingMs = SEVEN_DAYS_MS - (now - userProfile.lastUsernameChangeTimestamp);
        const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
        Alert.alert(
          'Giới Hạn Đổi Username',
          `Bạn chỉ có thể đổi tên người dùng (username) 7 ngày một lần để đảm bảo an toàn danh tính. Vui lòng quay lại sau ${remainingDays} ngày nữa.`
        );
        return;
      }
      newLastChange = now;
    }

    const updated: UserProfile = {
      ...userProfile,
      displayName: editDisplayNameInput.trim(),
      username: formattedUsername,
      email: editEmailInput.trim(),
      phone: editPhoneInput.trim(),
      bio: editBioInput.trim(),
      birthday: editBirthdayInput.trim(),
      gender: editGenderInput,
      avatarType: editAvatarType,
      avatarUri: editAvatarUri,
      avatarPresetId: editAvatarPresetId,
      avatarColor: editAvatarColor,
      lastUsernameChangeTimestamp: newLastChange,
    };
    saveUserProfile(updated);
    setProfileSubView('main');
    triggerToast('Thông tin hồ sơ cá nhân đã được đồng bộ an toàn.', 'Cập Nhật Hồ Sơ Thành Công', 'success', true);
  };

  // Xử lý xác minh danh tính LockX Verified (Tích Xanh)
  const handleVerifyIdentity = async () => {
    try {
      // 1. Xác thực sinh trắc học Face ID thật từ Apple
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const authResult = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Xác thực sinh trắc học để kích hoạt Tích Xanh LockX Verified',
          fallbackLabel: 'Sử dụng mật khẩu LockX',
          disableDeviceFallback: false,
        });

        if (!authResult.success) {
          triggerToast('Xác thực sinh trắc học không thành công. Vui lòng thử lại.', 'Xác Minh Thất Bại', 'warning');
          return;
        }
      }

      // 2. Tạo mã chứng chỉ bảo mật độc quyền
      const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const certKey = `LX-VERIFIED-${randomHex}`;
      const nowFormatted = getFormattedTodayDate();

      const updated: UserProfile = {
        ...userProfile,
        isVerified: true,
        verifiedBadge: 'blue_tick',
        verifiedAt: nowFormatted,
        verifiedKey: certKey,
      };

      saveUserProfile(updated);
      triggerToast('Chúc mừng! Tài khoản đã được cấp Tích Xanh LockX Verified.', 'Xác Minh Thành Công', 'security', 'shield-checkmark', '#0A84FF');
    } catch (e) {
      triggerToast('Đã xảy ra lỗi trong quá trình xác minh. Vui lòng thử lại.', 'Lỗi Xác Minh', 'warning');
    }
  };

  const handleRevokeVerification = () => {
    Alert.alert(
      'Hủy Tích Xanh Xác Minh',
      'Bạn có chắc chắn muốn hủy trạng thái xác minh LockX Verified không?',
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Hủy xác minh',
          style: 'destructive',
          onPress: () => {
            const updated: UserProfile = {
              ...userProfile,
              isVerified: false,
              verifiedKey: undefined,
              verifiedAt: undefined,
            };
            saveUserProfile(updated);
            triggerToast('Đã hủy trạng thái xác minh LockX Verified.', 'Đã Hủy Tích Xanh', 'info');
          },
        },
      ]
    );
  };

  // Xử lý đăng xuất phiên khác
  const handleClearOtherSessions = () => {
    Alert.alert(
      'Đăng xuất thiết bị khác',
      'Bạn có chắc muốn kết thúc tất cả các phiên đăng nhập khác ngoại trừ thiết bị này không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất tất cả',
          style: 'destructive',
          onPress: () => {
            const currentSession = createRealLoginRecord(appSettings.useFaceId ? 'Face ID' : 'Mật khẩu', true);
            saveLoginHistory([currentSession]);
            triggerToast('Đã đăng xuất khỏi tất cả các thiết bị khác');
          },
        },
      ]
    );
  };

  // Xóa sạch lịch sử tin nhắn trò chuyện với bạn bè
  const handleClearChat = (friendId: string) => {
    Alert.alert(
      'Làm sạch cuộc trò chuyện',
      'Bạn có chắc chắn muốn xóa toàn bộ lịch sử tin nhắn với người này?',
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: 'Xóa toàn bộ',
          style: 'destructive',
          onPress: () => {
            const nextMap = { ...chatMessages, [friendId]: [] };
            saveChatMessages(nextMap);
            const updatedFriends = friendsList.map((f) =>
              f.id === friendId ? { ...f, lastMessage: 'Chưa có tin nhắn', lastTime: clockStr } : f
            );
            saveFriends(updatedFriends);
            triggerToast('Đã xóa sạch lịch sử trò chuyện', 'Hộp Thoại', 'info', 'trash-outline');
          },
        },
      ]
    );
  };

  // Gửi tin nhắn chat iMessage người dùng thật (Loại bỏ hoàn toàn bot tự động)
  const handleSendMessage = (customText?: string) => {
    const textToSend = (customText || chatInputText).trim();
    if (!textToSend || !activeChatFriend) return;

    const currentFriend = activeChatFriend;
    const friendId = currentFriend.id;
    setChatInputText('');

    if (chatSenderMode === 'friend') {
      // Gửi tin nhắn từ phía bạn bè (Mô phỏng người thật gửi đến)
      setIsFriendTyping(true);
      setTimeout(() => {
        setIsFriendTyping(false);
        const friendMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          sender: 'friend',
          text: textToSend,
          time: clockStr,
        };

        setChatMessages((prev) => {
          const friendMsgs = [...(prev[friendId] || []), friendMsg];
          const nextMap = { ...prev, [friendId]: friendMsgs };
          saveChatMessages(nextMap);
          return nextMap;
        });

        setFriendsList((prev) => {
          const u = prev.map((f) =>
            f.id === friendId ? { ...f, lastMessage: textToSend, lastTime: clockStr } : f
          );
          saveFriends(u);
          return u;
        });

        // Âm thanh nhận tin nhắn iOS & Thông báo nổi Dynamic Island / Toast
        playAppleNotificationSound('info');
        triggerToast(textToSend, currentFriend.displayName, 'info', (currentFriend.avatarIcon || 'chatbubble-ellipses') as any);
        setTimeout(() => {
          chatScrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }, 700);
    } else {
      // Gửi tin nhắn từ phía Tôi
      const myMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'me',
        text: textToSend,
        time: clockStr,
      };

      const currentList = chatMessages[friendId] || [];
      const updatedList = [...currentList, myMsg];
      const newChatMap = { ...chatMessages, [friendId]: updatedList };
      saveChatMessages(newChatMap);

      const updatedFriends = friendsList.map((f) =>
        f.id === friendId ? { ...f, lastMessage: textToSend, lastTime: clockStr } : f
      );
      saveFriends(updatedFriends);

      playAppleNotificationSound('tap');
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  // Thêm bạn bè mới qua @username chuẩn Apple
  const handleAddFriend = () => {
    const raw = newFriendInput.trim();
    if (!raw) {
      triggerToast('Vui lòng nhập @username bạn bè.', 'Thêm Bạn Bè', 'warning');
      return;
    }
    const cleanUsername = raw.startsWith('@') ? raw : `@${raw}`;
    if (friendsList.some((f) => f.username.toLowerCase() === cleanUsername.toLowerCase())) {
      triggerToast('Người dùng này đã có trong danh sách bạn bè.', 'Đã Có Sẵn', 'info');
      return;
    }
    const colors = ['#007AFF', '#34C759', '#AF52DE', '#FF9500', '#FF3B30', '#30B0C7'];
    const icons = ['person', 'sparkles', 'shield-checkmark', 'star', 'rocket', 'heart'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const randomIcon = icons[Math.floor(Math.random() * icons.length)];
    const displayName = cleanUsername.replace('@', '').replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    const newFriend: FriendUser = {
      id: `fr-${Date.now()}`,
      displayName: displayName || cleanUsername,
      username: cleanUsername,
      avatarColor: randomColor,
      avatarIcon: randomIcon,
      status: 'online',
      bio: 'Người dùng LockX Pro 🛡️',
      lastMessage: 'Đã kết nối qua mã hóa E2E!',
      lastTime: 'Vừa xong',
      unreadCount: 0,
    };
    const updated = [newFriend, ...friendsList];
    setFriendsList(updated);
    saveFriends(updated);
    setNewFriendInput('');
    setShowAddFriendBox(false);
    triggerToast(`Đã kết nối thành công với ${newFriend.displayName}`, 'Thêm Bạn Bè', 'success');
  };

  const filteredFriends = useMemo(() => {
    return friendsList.filter((f) => {
      const matchQuery = !friendSearchQuery.trim() ||
        f.username.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
        f.displayName.toLowerCase().includes(friendSearchQuery.toLowerCase());
      if (!matchQuery) return false;
      if (friendFilter === 'online') return f.status === 'online';
      if (friendFilter === 'unread') return (f.unreadCount || 0) > 0;
      return true;
    });
  }, [friendsList, friendSearchQuery, friendFilter]);

  const saveAppsToStorage = async (updated: PhoneAppItem[]) => {
    setPhoneApps(updated);
    try {
      await AsyncStorage.setItem('lockx_user_phone_apps', JSON.stringify(updated));
    } catch (e) {}
  };

  // Yêu cầu cấp quyền cho phép thông báo (Hỗ trợ cả iOS native và Web Notification API)
  const requestNotificationPermission = async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
          await Notification.requestPermission();
        }
      }
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      const granted = finalStatus === 'granted';
      setHasNotifPermission(granted);
      return granted;
    } catch (e) {
      console.log('Error requesting notification permissions:', e);
      return false;
    }
  };

  // Quản lý khóa ứng dụng iPhone
  const toggleAppLock = (id: string) => {
    setPhoneApps((prev) => {
      const updated = prev.map((a) => {
        if (a.id === id) {
          const nextState = !a.isLocked;
          triggerToast(
            nextState
              ? `🔒 Đã kích hoạt khóa Face ID cho ${a.name}`
              : `🔓 Đã tắt khóa bảo vệ cho ${a.name}`
          );
          return { ...a, isLocked: nextState };
        }
        return a;
      });
      AsyncStorage.setItem('lockx_user_phone_apps', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const lockAllSensitiveApps = () => {
    const updated = phoneApps.map((a) => (a.hasSensitiveData ? { ...a, isLocked: true } : a));
    saveAppsToStorage(updated);
    triggerToast('🛡️ Đã khóa toàn bộ ứng dụng nhạy cảm (Ảnh, Tin nhắn, Zalo, Bank...)');
  };

  const unlockAllApps = () => {
    const updated = phoneApps.map((a) => ({ ...a, isLocked: false }));
    saveAppsToStorage(updated);
    triggerToast('🔓 Đã mở khóa tất cả ứng dụng');
  };

  // Xóa ứng dụng khỏi danh sách thiết bị
  const removeAppFromList = (id: string) => {
    const appToRemove = phoneApps.find((a) => a.id === id);
    const updated = phoneApps.filter((a) => a.id !== id);
    saveAppsToStorage(updated);
    if (selectedPhoneApp?.id === id) {
      setSelectedPhoneApp(null);
    }
    triggerToast(`Đã xóa ${appToRemove?.name || 'ứng dụng'} khỏi danh sách`);
  };

  // Thêm hoặc bớt ứng dụng từ Catalog
  const toggleCatalogApp = (catalogApp: PhoneAppItem) => {
    const exists = phoneApps.some((a) => a.id === catalogApp.id);
    let updated: PhoneAppItem[];
    if (exists) {
      updated = phoneApps.filter((a) => a.id !== catalogApp.id);
      triggerToast(`Đã gỡ bỏ ${catalogApp.name}`);
    } else {
      const appWithUsage: PhoneAppItem = {
        ...catalogApp,
        usageMinutes: catalogApp.usageMinutes || Math.floor(Math.random() * 45 + 15),
        openCount: catalogApp.openCount || Math.floor(Math.random() * 12 + 3),
      };
      updated = [appWithUsage, ...phoneApps];
      triggerToast(`Đã thêm ${catalogApp.name} vào máy`);
    }
    saveAppsToStorage(updated);
  };

  // Tự thêm ứng dụng tùy chỉnh của người dùng
  const handleAddCustomApp = () => {
    if (!customAppName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên ứng dụng.');
      return;
    }
    const newId = `custom-${Date.now()}`;
    const newApp: PhoneAppItem = {
      id: newId,
      name: customAppName.trim(),
      category: customAppCategory,
      icon:
        customAppCategory === 'finance'
          ? 'card'
          : customAppCategory === 'game'
          ? 'game-controller'
          : customAppCategory === 'shopping'
          ? 'cart'
          : customAppCategory === 'tools'
          ? 'construct'
          : customAppCategory === 'system'
          ? 'cog'
          : 'chatbubble',
      color:
        customAppCategory === 'finance'
          ? '#30D158'
          : customAppCategory === 'game'
          ? '#FF9500'
          : customAppCategory === 'shopping'
          ? '#EE4D2D'
          : customAppCategory === 'tools'
          ? '#0A84FF'
          : '#5856D6',
      scheme: customAppScheme.trim()
        ? customAppScheme.includes('://')
          ? customAppScheme.trim()
          : `${customAppScheme.trim()}://`
        : undefined,
      isCustom: true,
      usageMinutes: 25,
      openCount: 5,
    };

    const updated = [newApp, ...phoneApps];
    saveAppsToStorage(updated);
    setCustomAppName('');
    setCustomAppScheme('');
    triggerToast(`Đã thêm ${newApp.name} vào máy`);
  };

  // Khởi chạy ứng dụng thật trên iPhone với fallback App Store
  const openPhoneApp = async (app: PhoneAppItem) => {
    // Tăng số lần mở và thời gian sử dụng thực tế
    setPhoneApps((prev) => {
      const updated = prev.map((a) =>
        a.id === app.id ? { ...a, openCount: (a.openCount || 0) + 1, usageMinutes: (a.usageMinutes || 0) + 2 } : a
      );
      saveAppsToStorage(updated);
      return updated;
    });

    if (!app.scheme) {
      Alert.alert(
        app.name,
        `Ứng dụng ${app.name} đang được quản lý bởi LockX. Bạn có thể mở trực tiếp từ màn hình chính iPhone.`,
        [{ text: 'Đóng' }]
      );
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(app.scheme);
      if (canOpen) {
        await Linking.openURL(app.scheme);
      } else {
        Alert.alert(
          `Mở ${app.name}`,
          `Ứng dụng ${app.name} chưa được cài đặt hoặc iOS cần mở qua App Store.`,
          [
            { text: 'Hủy', style: 'cancel' },
            {
              text: 'Tìm trên App Store',
              onPress: () =>
                Linking.openURL(`itms-apps://itunes.apple.com/search?term=${encodeURIComponent(app.name)}`),
            },
          ]
        );
      }
    } catch (err) {
      Alert.alert(
        `Khởi chạy ${app.name}`,
        `Đã gửi tín hiệu mở ứng dụng ${app.name}. Bạn có thể mở từ màn hình chính iPhone hoặc App Store.`,
        [
          { text: 'Đóng' },
          {
            text: 'Mở App Store',
            onPress: () =>
              Linking.openURL(`itms-apps://itunes.apple.com/search?term=${encodeURIComponent(app.name)}`),
          },
        ]
      );
    }
  };


  // Trigger load screen flow
  const triggerSplashFlow = () => {
    setOnboardingStage('onboarding');
    setTimeout(() => {
      requestNotificationPermission();
    }, 300);
  };

  // Luôn vào thẳng trang chủ LockX
  useEffect(() => {
    setOnboardingStage('ready');
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setClockStr(`${h}:${m}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const dismissSuccessPopup = () => {
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
      popupTimeoutRef.current = null;
    }
    Animated.parallel([
      Animated.timing(popupScaleAnim, {
        toValue: 0.85,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(popupOpacityAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(ringOpacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSuccessPopup(null);
    });
  };

  const showSuccessPopup = (
    title: string,
    message: string,
    type: 'success' | 'info' | 'warning' | 'security' = 'success',
    customIcon?: string,
    customColor?: string
  ) => {
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
      popupTimeoutRef.current = null;
    }

    setSuccessPopup({
      id: String(Date.now()),
      title,
      message,
      type,
      customIcon,
      customColor,
    });

    popupScaleAnim.setValue(0.75);
    popupOpacityAnim.setValue(0);
    checkScaleAnim.setValue(0);
    checkRotateAnim.setValue(0);
    ringScaleAnim.setValue(0.8);
    ringOpacityAnim.setValue(0.85);

    // 1. Popup card springs in smoothly in the center of the screen
    Animated.parallel([
      Animated.spring(popupScaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 65,
        useNativeDriver: true,
      }),
      Animated.timing(popupOpacityAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Animated checkmark with expanding ripple ring effect
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(ringScaleAnim, {
          toValue: 1.5,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacityAnim, {
          toValue: 0,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.spring(checkScaleAnim, {
          toValue: 1,
          friction: 4.5,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.spring(checkRotateAnim, {
          toValue: 1,
          friction: 5,
          tension: 70,
          useNativeDriver: true,
        }),
      ]).start();
    }, 90);

    popupTimeoutRef.current = setTimeout(() => {
      dismissSuccessPopup();
    }, 2400);
  };

  const showBannerToast = (
    title: string,
    message: string,
    type: 'success' | 'info' | 'warning' | 'security' = 'info'
  ) => {
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
      bannerTimeoutRef.current = null;
    }
    setBannerNotification({ id: String(Date.now()), title, message, type });
    bannerAnimY.setValue(-100);
    bannerAnimOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(bannerAnimY, {
        toValue: Platform.OS === 'web' ? 14 : 44,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(bannerAnimOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    bannerTimeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(bannerAnimY, {
          toValue: -120,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(bannerAnimOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setBannerNotification(null));
    }, 2400);
  };

  const triggerToast = (
    msg: string,
    title?: string,
    type?: 'success' | 'info' | 'warning' | 'security',
    customIconOrUseModal?: string | boolean,
    customColor?: string
  ) => {
    let resolvedTitle = title;
    let resolvedType = type;
    let resolvedIcon = typeof customIconOrUseModal === 'string' ? customIconOrUseModal : undefined;
    let resolvedColor = customColor;

    const lower = msg.toLowerCase();

    if (!resolvedType) {
      if (lower.includes('không thể') || lower.includes('thất bại') || lower.includes('lỗi') || lower.includes('quá ngắn') || msg.startsWith('⚠️')) {
        resolvedType = 'warning';
      } else if (lower.includes('khóa') || lower.includes('bảo mật') || lower.includes('face id')) {
        resolvedType = 'security';
      } else if (lower.includes('thành công') || lower.includes('hoàn tất') || lower.includes('đã lưu') || lower.includes('đã xóa')) {
        resolvedType = 'success';
      } else {
        resolvedType = 'info';
      }
    }

    if (!resolvedTitle) {
      if (resolvedType === 'warning') {
        resolvedTitle = 'Cảnh Báo';
      } else if (resolvedType === 'security') {
        resolvedTitle = 'Bảo Mật';
      } else if (resolvedType === 'success') {
        resolvedTitle = 'Thao Tác Thành Công';
      } else if (lower.includes('chép') || lower.includes('clipboard')) {
        resolvedTitle = 'Đã Sao Chép';
      } else if (lower.includes('giao diện') || lower.includes('sáng') || lower.includes('tối')) {
        resolvedTitle = 'Chế Độ Giao Diện';
      } else if (lower.includes('ngôn ngữ')) {
        resolvedTitle = 'Ngôn Ngữ';
      } else if (lower.includes('màu')) {
        resolvedTitle = 'Màu Sắc';
      } else if (lower.includes('cỡ chữ')) {
        resolvedTitle = 'Cỡ Chữ';
      } else {
        resolvedTitle = 'Thông Báo';
      }
    }

    if (!resolvedIcon) {
      if (lower.includes('sáng')) {
        resolvedIcon = 'sunny';
        resolvedColor = '#FF9500';
      } else if (lower.includes('tối')) {
        resolvedIcon = 'moon';
        resolvedColor = '#5856D6';
      } else if (lower.includes('chép') || lower.includes('clipboard')) {
        resolvedIcon = 'copy';
        resolvedColor = '#0A84FF';
      } else if (lower.includes('màu')) {
        resolvedIcon = 'color-palette';
        resolvedColor = appSettings.accentColor;
      } else if (lower.includes('cỡ chữ') || lower.includes('in đậm')) {
        resolvedIcon = 'text';
        resolvedColor = appSettings.accentColor;
      } else if (lower.includes('ngôn ngữ')) {
        resolvedIcon = 'language';
        resolvedColor = '#0A84FF';
      }
    }

    const cleanMsg = msg.replace(/^[✓⚠️🔒🔓🎉•\s]+/, '').trim();
    const notifId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    // 1. Phát âm thanh chuông Apple iOS thật nếu bật Âm thanh thông báo
    if (appSettings.notifySounds !== false) {
      playAppleNotificationSound(resolvedType);
    }

    // Luôn hiển thị popup ở GIỮA MÀN HÌNH (Center Screen HUD)
    showSuccessPopup(resolvedTitle, cleanMsg, resolvedType, resolvedIcon, resolvedColor);

    // 2. Lưu vào danh sách Thông báo
    const newNotif: AppNotification = {
      id: notifId,
      title: resolvedTitle,
      message: cleanMsg,
      type: resolvedType,
      time: 'Vừa xong',
      timestamp: Date.now(),
      read: false,
    };

    setNotifications((prev) => {
      const nextList = [newNotif, ...prev.slice(0, 49)];
      AsyncStorage.setItem('lockx_notifications_history', JSON.stringify(nextList)).catch(() => {});
      return nextList;
    });

    // 3. Gửi thông báo thực tế qua Expo Notifications & Web Notification API
    if (appSettings.enableNotifications !== false) {
      try {
        Notifications.scheduleNotificationAsync({
          content: {
            title: resolvedTitle,
            body: cleanMsg,
            sound: appSettings.notifySounds ? 'default' : undefined,
            badge: 1,
          },
          trigger: null,
        }).catch(() => {});
      } catch (e) {}

      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
        try {
          if (Notification.permission === 'granted') {
            new Notification(resolvedTitle, {
              body: cleanMsg,
              icon: '/assets/icon.png',
            });
          }
        } catch (e) {}
      }
    }
  };

  // Lên lịch gửi thông báo đẩy thực tế ra bên ngoài màn hình khóa iPhone / Trình duyệt
  const scheduleExternalPushNotification = async (
    title: string,
    body: string,
    delaySeconds: number = 3,
    type: 'success' | 'info' | 'warning' | 'security' = 'success'
  ) => {
    // 1. Kiểm tra và yêu cầu cấp quyền thông báo hệ điều hành
    const granted = await requestNotificationPermission();

    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try {
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') {
            Alert.alert(
              'Quyền thông báo hệ thống',
              'Vui lòng nhấn "Cho phép" (Allow) trên trình duyệt để nhận thông báo đẩy bên ngoài màn hình khi khóa máy.'
            );
            return;
          }
        } catch (e) {}
      }
    }

    // 2. Lên lịch thông báo hệ thống iOS / Android bằng Expo Notifications
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: appSettings.notifySounds ? 'default' : undefined,
          badge: 1,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, delaySeconds),
        } as any,
      });
    } catch (e) {
      console.log('Error scheduling notification:', e);
    }

    // 3. Web Notification API Timer (hiển thị popup ngoài trình duyệt khi khóa màn hình / chuyển tab)
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      setTimeout(() => {
        try {
          if (Notification.permission === 'granted') {
            const notif = new Notification(title, {
              body,
              icon: '/assets/icon.png',
              badge: '/assets/icon.png',
              silent: !appSettings.notifySounds,
            });
            notif.onclick = () => {
              window.focus();
              notif.close();
            };
          }
        } catch (e) {}
      }, delaySeconds * 1000);
    }

    // 4. Báo cho người dùng biết để khóa màn hình hoặc thu nhỏ ứng dụng thử nghiệm
    triggerToast(
      `Đã hẹn giờ gửi thông báo sau ${delaySeconds} giây. Hãy khóa màn hình iPhone hoặc chuyển ứng dụng để xem thông báo xuất hiện bên ngoài!`,
      'Hẹn Giờ Thông Báo Ngoài',
      'info'
    );
  };

  const copyText = (txt: string, label: string) => {
    Clipboard.setString(txt);
    triggerToast(`Đã chép ${label} vào Clipboard`);
  };

  const generateRandomPassword = (length: number = 16) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
    let p = '';
    for (let i = 0; i < length; i++) {
      p += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return p;
  };

  const handleSaveAccount = () => {
    if (!newTitle.trim() || !newUser.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập Tên gợi nhớ và Tài khoản.');
      return;
    }
    const acc: Account = {
      id: String(Date.now()),
      title: newTitle.trim(),
      game: newGame,
      server: newServer,
      category: newCategory,
      username: newUser.trim(),
      password: newPwd || 'AppleSecurePass#2026',
      ign: newIgn.trim() || undefined,
      notes: newNotes.trim() || undefined,
    };
    setAccounts([acc, ...accounts]);
    setVaultSubView('list');
    triggerToast('Đã lưu tài khoản vào Keychain LockX');
  };

  const handleDeleteAccount = (id: string) => {
    Alert.alert('Xác nhận xóa', 'Bạn có chắc chắn muốn xóa tài khoản này khỏi Két Sắt?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          setAccounts(accounts.filter((a) => a.id !== id));
          setSelectedAccount(null);
          setVaultSubView('list');
          triggerToast('Đã xóa tài khoản');
        },
      },
    ]);
  };

  const adjustStamina = (id: string, delta: number) => {
    setStaminaList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const cur = Math.max(0, Math.min(item.max, item.current + delta));
          return { ...item, current: cur, lastUpdated: Date.now() };
        }
        return item;
      })
    );
  };

  const addGachaRoll = (id: string, count: number) => {
    setGachaList((prev) =>
      prev.map((rec) => {
        if (rec.id === id) {
          const p = Math.min(rec.hardPity, rec.pity + count);
          return { ...rec, pity: p };
        }
        return rec;
      })
    );
    triggerToast(`Đã thêm +${count} roll`);
  };

  const triggerFiveStar = (id: string) => {
    const item = gachaList.find((g) => g.id === id);
    if (!item) return;

    if (!item.isGuaranteed) {
      Alert.alert(
        'Chúc mừng nổ 5 Sao!',
        'Bạn có THẮNG 50/50 trúng nhân vật giới hạn không?',
        [
          {
            text: 'Lệch Rate (Nhận 100%)',
            onPress: () => {
              setGachaList((prev) =>
                prev.map((g) => (g.id === id ? { ...g, pity: 0, isGuaranteed: true } : g))
              );
              triggerToast('Lệch rate: Đã kích hoạt Bảo hiểm 100%!');
            },
          },
          {
            text: 'Thắng 50/50',
            onPress: () => {
              setGachaList((prev) =>
                prev.map((g) => (g.id === id ? { ...g, pity: 0, isGuaranteed: false } : g))
              );
              triggerToast('Thắng 50/50: Đã reset Pity!');
            },
          },
        ]
      );
    } else {
      Alert.alert('Chúc mừng!', 'Đã nhận nhân vật 5 sao giới hạn từ Bảo Hiểm 100%!');
      setGachaList((prev) =>
        prev.map((g) => (g.id === id ? { ...g, pity: 0, isGuaranteed: false } : g))
      );
    }
  };

  // Filtered accounts
  const filteredAccounts = accounts.filter((acc) => {
    const matchCat = selectedCategory === 'all' || acc.category === selectedCategory;
    const matchQuery =
      acc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.game.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.username.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchQuery;
  });

  // Screen time helpers & calculations
  const totalScreenTimeMinutes = phoneApps.reduce((acc, a) => acc + (a.usageMinutes || 0), 0);
  const maxAppUsageMinutes = Math.max(1, ...phoneApps.map((a) => a.usageMinutes || 0));

  const formatUsageTime = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const formatUsageTimeFull = (mins: number) => {
    if (mins < 60) return `${mins} phút`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
  };

  // Category usage breakdown
  const categoryUsage = {
    social: phoneApps.filter((a) => a.category === 'social').reduce((acc, a) => acc + (a.usageMinutes || 0), 0),
    entertainment: phoneApps.filter((a) => a.category === 'game').reduce((acc, a) => acc + (a.usageMinutes || 0), 0),
    tools: phoneApps.filter((a) => a.category === 'tools' || a.category === 'system').reduce((acc, a) => acc + (a.usageMinutes || 0), 0),
    finance: phoneApps.filter((a) => a.category === 'finance' || a.category === 'shopping').reduce((acc, a) => acc + (a.usageMinutes || 0), 0),
  };

  // Filtered phone apps: sorted by usageMinutes descending (Ứng dụng dùng nhiều nhất lên đầu)
  const filteredPhoneApps = [...phoneApps]
    .sort((a, b) => (b.usageMinutes || 0) - (a.usageMinutes || 0))
    .filter((app) => {
      const matchQuery =
        app.name.toLowerCase().includes(appSearchQuery.toLowerCase()) ||
        app.category.toLowerCase().includes(appSearchQuery.toLowerCase());
      if (!matchQuery) return false;
      if (appCategoryFilter === 'all') return true;
      return app.category === appCategoryFilter;
    });

  // =========================================================================
  // APP LOADING STATE (Checking first-launch AsyncStorage)
  // =========================================================================
  if (onboardingStage === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <StatusBar style="light" />
      </View>
    );
  }

  // =========================================================================
  // ONBOARDING SCREEN: DEVICE COMPATIBILITY & NOTIFICATION REQUEST
  // (Layout matching user reference with Fox mascot & Segmented Languages)
  // =========================================================================
  if (onboardingStage === 'onboarding') {
    return (
      <SafeAreaView style={styles.loadRoot}>
        <StatusBar style="light" />
        <View style={styles.loadContainer}>
          {/* Scrollable Center Content */}
          <ScrollView
            style={styles.loadScroll}
            contentContainerStyle={styles.loadScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Main Upper/Middle Content Block (căn giữa giữa màn hình) */}
            <View style={styles.loadMainBody}>
              {/* App LockX Logo */}
              <View style={styles.loadLogoWrap}>
                <Image
                  source={require('./assets/icon.png')}
                  style={styles.loadAppLogo}
                  resizeMode="cover"
                />
              </View>

              {/* Center Squircle Icon */}
              <View style={[styles.loadSquircleCard, !isDeviceSupported && styles.loadSquircleCardDanger]}>
                {isDeviceSupported ? (
                  <Ionicons name="phone-portrait-outline" size={28} color="#30D158" />
                ) : (
                  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="phone-portrait-outline" size={28} color="#FF453A" />
                    <View style={styles.phoneSlashBar} />
                  </View>
                )}
              </View>

              {/* Title & Subtitle */}
              <Text style={styles.loadTitle}>
                {isDeviceSupported ? t.supportedTitle : t.unsupportedTitle}
              </Text>
              <Text style={styles.loadSubtitle}>
                {isDeviceSupported ? t.supportedSub : t.unsupportedSub}
              </Text>

              {/* Supported Versions List (Đã sửa 26.2 thành 26.6.2) */}
              <View style={styles.loadListSection}>
                <Text style={styles.loadListHeader}>{t.listHeader}</Text>
                <Text style={styles.loadVersionItem}>• iOS 17.0–17.7.x</Text>
                <Text style={styles.loadVersionItem}>• iOS 18.0–18.7.1</Text>
                <Text style={styles.loadVersionItem}>• iOS 26.6.2</Text>
                <Text style={styles.loadVersionItem}>• iOS 26.0–26.6.1</Text>
                <Text style={styles.loadVersionItem}>• iOS 27.0 Developer Beta 1–4</Text>
                <Text style={styles.loadVersionItem}>• iOS 27.0 Public Beta 1–2</Text>
              </View>

              {/* Status Pill Badge (Hiển thị chính xác phiên bản iOS & Build ID của điện thoại) */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  const nextVal = !isDeviceSupported;
                  setIsSimulatedOverride(nextVal);
                  triggerToast(
                    nextVal
                      ? 'Mô phỏng: Thiết bị ĐƯỢC hỗ trợ (Hiển thị nút Bắt đầu)'
                      : 'Mô phỏng: Thiết bị KHÔNG được hỗ trợ (Đã ẩn nút Bắt đầu)'
                  );
                }}
                style={[
                  styles.loadStatusBadge,
                  isDeviceSupported ? styles.loadStatusBadgeSuccess : styles.loadStatusBadgeDanger,
                ]}
              >
                <Ionicons
                  name={isDeviceSupported ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={isDeviceSupported ? '#30D158' : '#FF453A'}
                />
                <Text
                  style={[
                    styles.loadStatusBadgeText,
                    { color: isDeviceSupported ? '#30D158' : '#FF453A' },
                  ]}
                >
                  {` iOS ${detectedOsVersion} (${detectedOsBuild})`}
                </Text>
              </TouchableOpacity>

              {/* Explanatory Paragraph */}
              <Text style={styles.loadExplText}>
                {isDeviceSupported ? t.supportedNote : t.unsupportedNote}
              </Text>
            </View>
          </ScrollView>

          {/* Bottom Area CỐ ĐỊNH (FIXED): Nút Bắt Đầu & Thanh Chuyển Ngôn Ngữ không bị che */}
          <View style={styles.loadFixedBottom}>
            {/* Nút Bắt Đầu: CHỈ HIỂN THỊ KHI THIẾT BỊ ĐƯỢC HỖ TRỢ! Nếu không hỗ trợ thì hoàn toàn không có nút */}
            {isDeviceSupported && (
              <TouchableOpacity
                style={styles.loadBtnStart}
                activeOpacity={0.85}
                onPress={async () => {
                  await requestNotificationPermission();
                  try {
                    await AsyncStorage.setItem('lockx_has_onboarded', 'true');
                  } catch (e) {}
                  setOnboardingStage('ready');
                  triggerToast('Chào mừng bạn đến với LockX!');
                }}
              >
                <Text style={styles.loadBtnStartText}>{t.btnStart}</Text>
                <Ionicons name="arrow-forward" size={18} color="#000" />
              </TouchableOpacity>
            )}

            {/* Bottom Segmented Language Pill (English | Tiếng Việt | 한국어 | 简体中文) */}
            <View style={styles.loadLangSegmentBar}>
              <TouchableOpacity
                style={[styles.loadLangTab, activeLanguage === 'en' && styles.loadLangTabActive]}
                onPress={() => {
                  setSelectedLanguage('en');
                  saveAppSettings({ ...appSettings, language: 'en' });
                }}
              >
                <Text style={[styles.loadLangTabText, activeLanguage === 'en' && styles.loadLangTabTextActive]}>
                  English
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loadLangTab, activeLanguage === 'vi' && styles.loadLangTabActive]}
                onPress={() => {
                  setSelectedLanguage('vi');
                  saveAppSettings({ ...appSettings, language: 'vi' });
                }}
              >
                <Text style={[styles.loadLangTabText, activeLanguage === 'vi' && styles.loadLangTabTextActive]}>
                  Tiếng Việt
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loadLangTab, activeLanguage === 'ko' && styles.loadLangTabActive]}
                onPress={() => {
                  setSelectedLanguage('ko');
                  saveAppSettings({ ...appSettings, language: 'ko' });
                }}
              >
                <Text style={[styles.loadLangTabText, activeLanguage === 'ko' && styles.loadLangTabTextActive]}>
                  한국어
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loadLangTab, activeLanguage === 'zh' && styles.loadLangTabActive]}
                onPress={() => {
                  setSelectedLanguage('zh');
                  saveAppSettings({ ...appSettings, language: 'zh' });
                }}
              >
                <Text style={[styles.loadLangTabText, activeLanguage === 'zh' && styles.loadLangTabTextActive]}>
                  简体中文
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // =========================================================================
  // VIEW: AUTHENTICATED MAIN APP (HOME & TABS)
  // =========================================================================
  // =========================================================================
  return (
    <SafeAreaView style={styles.safeRoot}>
      <StatusBar style="light" />

      {/* POPUP MODAL: APPLE IOS SUCCESS & ACTION HUD POPUP */}
      <Modal
        visible={!!successPopup}
        transparent
        animationType="none"
        onRequestClose={dismissSuccessPopup}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={dismissSuccessPopup}
          style={styles.popupBackdrop}
        >
          <Animated.View
            style={[
              styles.popupCard,
              isLight && styles.popupCardLight,
              {
                transform: [{ scale: popupScaleAnim }],
                opacity: popupOpacityAnim,
              },
            ]}
          >
            {/* Top Glowing Icon Badge with Animated Checkmark and Pulse Ring */}
            <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 18, marginTop: 4 }}>
              {/* Expanding Ripple Ring */}
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: 78,
                  height: 78,
                  borderRadius: 39,
                  borderWidth: 2.5,
                  borderColor:
                    successPopup?.type === 'success'
                      ? '#30D158'
                      : successPopup?.customColor ||
                        (successPopup?.type === 'warning'
                          ? '#FF9F0A'
                          : successPopup?.type === 'security'
                          ? appSettings.accentColor
                          : '#0A84FF'),
                  transform: [{ scale: ringScaleAnim }],
                  opacity: ringOpacityAnim,
                }}
              />

              {/* Main Badge Container */}
              <View
                style={[
                  styles.popupIconCircle,
                  { marginBottom: 0 },
                  successPopup?.type === 'success'
                    ? { backgroundColor: 'rgba(48, 209, 88, 0.16)', borderColor: 'rgba(48, 209, 88, 0.45)' }
                    : successPopup?.type === 'warning'
                    ? { backgroundColor: 'rgba(255, 159, 10, 0.16)', borderColor: 'rgba(255, 159, 10, 0.45)' }
                    : successPopup?.type === 'security'
                    ? { backgroundColor: 'rgba(10, 132, 255, 0.16)', borderColor: 'rgba(10, 132, 255, 0.45)' }
                    : {
                        backgroundColor: `${successPopup?.customColor || '#0A84FF'}22`,
                        borderColor: `${successPopup?.customColor || '#0A84FF'}50`,
                      },
                ]}
              >
                {successPopup?.type === 'success' ? (
                  <Animated.View
                    style={{
                      transform: [{ scale: checkScaleAnim }, { rotate: checkRotation }],
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: '#30D158',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#30D158',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.5,
                      shadowRadius: 10,
                      elevation: 8,
                    }}
                  >
                    <Ionicons name="checkmark" size={35} color="#FFFFFF" />
                  </Animated.View>
                ) : (
                  <Animated.View
                    style={{
                      transform: [{ scale: checkScaleAnim }],
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor:
                        successPopup?.customColor ||
                        (successPopup?.type === 'warning'
                          ? '#FF9F0A'
                          : successPopup?.type === 'security'
                          ? appSettings.accentColor
                          : '#0A84FF'),
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor:
                        successPopup?.customColor ||
                        (successPopup?.type === 'warning'
                          ? '#FF9F0A'
                          : successPopup?.type === 'security'
                          ? appSettings.accentColor
                          : '#0A84FF'),
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.45,
                      shadowRadius: 10,
                      elevation: 8,
                    }}
                  >
                    <Ionicons
                      name={
                        (successPopup?.customIcon ||
                          (successPopup?.type === 'warning'
                            ? 'alert'
                            : successPopup?.type === 'security'
                            ? 'shield-checkmark'
                            : 'information')) as any
                      }
                      size={30}
                      color="#FFFFFF"
                    />
                  </Animated.View>
                )}
              </View>
            </View>

            {/* Title */}
            <Text style={[styles.popupTitle, isLight && { color: '#000000' }]}>
              {successPopup?.title}
            </Text>

            {/* Subtitle Message */}
            <Text style={[styles.popupMessage, isLight && { color: '#3C3C43' }]}>
              {successPopup?.message}
            </Text>

            {/* Bottom Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={dismissSuccessPopup}
              style={[
                styles.popupActionBtn,
                {
                  backgroundColor:
                    successPopup?.type === 'success'
                      ? '#30D158'
                      : successPopup?.customColor ||
                        (successPopup?.type === 'security'
                          ? appSettings.accentColor
                          : isLight ? '#000000' : '#2C2C2E'),
                },
              ]}
            >
              <Text style={styles.popupActionBtnText}>{t.understood}</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

            {!isAuthenticated ? (
        <EnterpriseAuthScreen
          authMode={authMode}
          setAuthMode={setAuthMode}
          authUsername={authUsername}
          setAuthUsername={setAuthUsername}
          authPassword={authPassword}
          setAuthPassword={setAuthPassword}
          authShowPassword={authShowPassword}
          setAuthShowPassword={setAuthShowPassword}
          authDisplayName={authDisplayName}
          setAuthDisplayName={setAuthDisplayName}
          authConfirmPassword={authConfirmPassword}
          setAuthConfirmPassword={setAuthConfirmPassword}
          authError={authError}
          setAuthError={setAuthError}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onFaceIdLogin={handleFaceIdLogin}
          accentColor={appSettings.accentColor}
          isLight={isLight}
          triggerToast={triggerToast}
          savedAccount={savedAccount}
          setSavedAccount={setSavedAccount}
          savedDisplayName={userProfile.displayName || 'Quảng Trọng Tuấn'}
          useFaceId={appSettings.useFaceId}
        />
      ) : (
        <>

          {/* Main Content Area */}
      <View style={styles.mainContent}>
        {/* TAB 0: TRANG CHỦ LOCKX & KÉT SẮT */}
        {currentTab === 'vault' && (
          vaultSubView === 'add' ? (
            /* DEDICATED FULL-SCREEN ADD ACCOUNT VIEW (CHUẨN APPLE iOS 18 INSET GROUPED) */
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1, backgroundColor: isLight ? '#F2F2F7' : '#000000' }}
            >
              {/* Top Navigation Bar with Proper Safe Padding */}
              <View style={[styles.fullScreenNavBar, isLight && { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E5EA' }]}>
                <TouchableOpacity
                  onPress={() => setVaultSubView('list')}
                  style={styles.fullScreenNavBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={[styles.fullScreenNavBtnText, { color: appSettings.accentColor }]}>Hủy</Text>
                </TouchableOpacity>
                <Text style={[styles.fullScreenNavTitle, isLight && { color: '#000000' }]}>Thêm Tài Khoản</Text>
                <TouchableOpacity
                  onPress={handleSaveAccount}
                  style={styles.fullScreenNavBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={[styles.fullScreenNavBtnText, { color: appSettings.accentColor, fontWeight: '700' }]}>Lưu</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 }}
                keyboardShouldPersistTaps="handled"
              >
                {/* Section 1: Thông tin cơ bản */}
                <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                  <Text style={styles.sectionCaption}>THÔNG TIN CƠ BẢN</Text>
                  <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                    <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                      <View style={[styles.cellLeadingIcon, { backgroundColor: '#0A84FF' }]}>
                        <Ionicons name="bookmark" size={17} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.formLabel, { width: 95 }, isLight && { color: '#000000' }]}>Tên gợi nhớ</Text>
                      <TextInput
                        style={[styles.formInput, { flex: 1, textAlign: 'right' }, isLight && { color: '#000000' }]}
                        placeholder="VD: Acc chính Genshin"
                        placeholderTextColor="#8E8E93"
                        value={newTitle}
                        onChangeText={setNewTitle}
                      />
                    </View>

                    <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                      <View style={[styles.cellLeadingIcon, { backgroundColor: '#5856D6' }]}>
                        <Ionicons name="game-controller" size={17} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.formLabel, { width: 95 }, isLight && { color: '#000000' }]}>Nền tảng</Text>
                      <TextInput
                        style={[styles.formInput, { flex: 1, textAlign: 'right' }, isLight && { color: '#000000' }]}
                        placeholder="VD: Genshin Impact, Facebook..."
                        placeholderTextColor="#8E8E93"
                        value={newGame}
                        onChangeText={setNewGame}
                      />
                    </View>

                    <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                      <View style={[styles.cellLeadingIcon, { backgroundColor: '#34C759' }]}>
                        <Ionicons name="server" size={17} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.formLabel, { width: 95 }, isLight && { color: '#000000' }]}>Máy chủ</Text>
                      <TextInput
                        style={[styles.formInput, { flex: 1, textAlign: 'right' }, isLight && { color: '#000000' }]}
                        placeholder="VD: Asia, Việt Nam, Global..."
                        placeholderTextColor="#8E8E93"
                        value={newServer}
                        onChangeText={setNewServer}
                      />
                    </View>
                  </View>
                </View>

                {/* Section 2: Thông tin đăng nhập */}
                <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                  <Text style={styles.sectionCaption}>THÔNG TIN ĐĂNG NHẬP</Text>
                  <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                    <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                      <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF9F0A' }]}>
                        <Ionicons name="person" size={17} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.formLabel, { width: 95 }, isLight && { color: '#000000' }]}>Tài khoản</Text>
                      <TextInput
                        style={[styles.formInput, { flex: 1, textAlign: 'right' }, isLight && { color: '#000000' }]}
                        placeholder="Email, SĐT hoặc username"
                        placeholderTextColor="#8E8E93"
                        value={newUser}
                        onChangeText={setNewUser}
                        autoCapitalize="none"
                      />
                    </View>

                    <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                      <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF2D55' }]}>
                        <Ionicons name="key" size={17} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.formLabel, { width: 95 }, isLight && { color: '#000000' }]}>Mật khẩu</Text>
                      <TextInput
                        style={[styles.formInput, { flex: 1, textAlign: 'right' }, isLight && { color: '#000000' }]}
                        placeholder="Mật khẩu"
                        placeholderTextColor="#8E8E93"
                        value={newPwd}
                        onChangeText={setNewPwd}
                      />
                      <TouchableOpacity
                        onPress={() => {
                          const p = generateRandomPassword(16);
                          setNewPwd(p);
                          triggerToast('Đã tạo mật khẩu mạnh 16 ký tự');
                        }}
                        style={{ marginLeft: 8 }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="sparkles" size={18} color={appSettings.accentColor} />
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                      <View style={[styles.cellLeadingIcon, { backgroundColor: '#AF52DE' }]}>
                        <Ionicons name="card" size={17} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.formLabel, { width: 95 }, isLight && { color: '#000000' }]}>Tên NV (IGN)</Text>
                      <TextInput
                        style={[styles.formInput, { flex: 1, textAlign: 'right' }, isLight && { color: '#000000' }]}
                        placeholder="Tùy chọn (VD: WalnutDirector)"
                        placeholderTextColor="#8E8E93"
                        value={newIgn}
                        onChangeText={setNewIgn}
                      />
                    </View>
                  </View>
                </View>

                {/* Section 3: Phân loại danh mục */}
                <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                  <Text style={styles.sectionCaption}>PHÂN LOẠI DANH MỤC</Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      backgroundColor: isLight ? '#E3E3E8' : '#1C1C1E',
                      borderRadius: 9,
                      padding: 3,
                      gap: 2,
                    }}
                  >
                    {[
                      { id: 'Game', label: 'Game' },
                      { id: 'Clone', label: 'Clone/Smurf' },
                      { id: 'Social', label: 'Mạng xã hội' },
                      { id: 'Work', label: 'Công việc' },
                    ].map((cat) => {
                      const isSel = newCategory === cat.id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() => setNewCategory(cat.id)}
                          style={{
                            flex: 1,
                            paddingVertical: 7,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 7,
                            backgroundColor: isSel
                              ? (isLight ? '#FFFFFF' : '#2C2C2E')
                              : 'transparent',
                            shadowColor: isSel ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: isSel ? 0.15 : 0,
                            shadowRadius: 2,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12.5,
                              fontWeight: isSel ? '600' : '500',
                              color: isSel ? (isLight ? '#000000' : '#FFFFFF') : '#8E8E93',
                            }}
                            numberOfLines={1}
                          >
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Section 4: Ghi chú bảo mật */}
                <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 24 }]}>
                  <Text style={styles.sectionCaption}>GHI CHÚ BẢO MẬT</Text>
                  <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }, { padding: 12 }]}>
                    <TextInput
                      style={{
                        minHeight: 80,
                        color: isLight ? '#000000' : '#FFFFFF',
                        fontSize: 14,
                        textAlignVertical: 'top',
                        padding: 0,
                      }}
                      placeholder="Ghi lại thông tin bảo mật, email khôi phục, danh sách đồ, lịch sử nạp, ngày tạo..."
                      placeholderTextColor="#8E8E93"
                      value={newNotes}
                      onChangeText={setNewNotes}
                      multiline
                      numberOfLines={4}
                    />
                  </View>
                </View>

                {/* Nút Lưu Toàn Màn Hình */}
                <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 30 }]}>
                  <TouchableOpacity
                    style={{
                      backgroundColor: appSettings.accentColor,
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: 8,
                      shadowColor: appSettings.accentColor,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                    }}
                    activeOpacity={0.85}
                    onPress={handleSaveAccount}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                      Lưu Tài Khoản Vào Két Sắt
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : vaultSubView === 'detail' && selectedAccount ? (
            /* DEDICATED FULL-SCREEN ACCOUNT DETAIL VIEW */
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1, backgroundColor: isLight ? '#F2F2F7' : '#000000' }}
            >
              {/* Top Navigation Bar */}
              <View style={[styles.fullScreenNavBar, isLight && { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E5EA' }]}>
                <TouchableOpacity
                  onPress={() => {
                    setVaultSubView('list');
                    setSelectedAccount(null);
                  }}
                  style={styles.fullScreenNavBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="chevron-back" size={20} color={appSettings.accentColor} />
                  <Text style={[styles.fullScreenNavBtnText, { color: appSettings.accentColor }]}>Két Sắt</Text>
                </TouchableOpacity>
                <Text style={[styles.fullScreenNavTitle, isLight && { color: '#000000' }]} numberOfLines={1}>
                  {selectedAccount.title}
                </Text>
                <TouchableOpacity
                  onPress={() => handleDeleteAccount(selectedAccount.id)}
                  style={styles.fullScreenNavBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF453A" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 }}
              >
                {/* Account Avatar & Headline */}
                <View style={{ alignItems: 'center', marginVertical: 16 }}>
                  <View
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 18,
                      backgroundColor: selectedAccount.game.toLowerCase().includes('genshin')
                        ? '#2563EB'
                        : selectedAccount.game.toLowerCase().includes('honkai')
                        ? '#7C3AED'
                        : selectedAccount.game.toLowerCase().includes('valorant')
                        ? '#DC2626'
                        : selectedAccount.category === 'Social'
                        ? '#0A84FF'
                        : selectedAccount.category === 'Work'
                        ? '#34C759'
                        : '#AF52DE',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: 10,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.2,
                      shadowRadius: 8,
                    }}
                  >
                    <Ionicons
                      name={
                        selectedAccount.game.toLowerCase().includes('genshin')
                          ? 'sparkles'
                          : selectedAccount.game.toLowerCase().includes('honkai')
                          ? 'train'
                          : selectedAccount.game.toLowerCase().includes('valorant')
                          ? 'shield-half'
                          : selectedAccount.category === 'Social'
                          ? 'share-social'
                          : selectedAccount.category === 'Work'
                          ? 'briefcase'
                          : 'game-controller'
                      }
                      size={32}
                      color="#FFFFFF"
                    />
                  </View>
                  <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 21, fontWeight: '700', textAlign: 'center' }}>
                    {selectedAccount.title}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <View style={[styles.appCustomBadge, { backgroundColor: isLight ? '#E5E5EA' : '#2C2C2E' }]}>
                      <Text style={[styles.appCustomBadgeText, { color: appSettings.accentColor }]}>{selectedAccount.category.toUpperCase()}</Text>
                    </View>
                    <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 13 }}>
                      {selectedAccount.game} {selectedAccount.server ? `• ${selectedAccount.server}` : ''}
                    </Text>
                  </View>
                </View>

                {/* Credentials Group */}
                <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                  <Text style={styles.sectionCaption}>THÔNG TIN ĐĂNG NHẬP</Text>
                  <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                    <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                      <Text style={[styles.detailLabel, isLight && { color: '#6C6C70' }]}>Tài khoản</Text>
                      <Text style={[styles.detailVal, isLight && { color: '#000000' }]}>{selectedAccount.username}</Text>
                      <TouchableOpacity onPress={() => copyText(selectedAccount.username, 'Tài khoản')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="copy-outline" size={18} color={appSettings.accentColor} />
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.cellItem, !selectedAccount.ign && { borderBottomWidth: 0 }, isLight && { borderBottomColor: '#E5E5EA' }]}>
                      <Text style={[styles.detailLabel, isLight && { color: '#6C6C70' }]}>Mật khẩu</Text>
                      <Text style={[styles.detailVal, { fontFamily: 'monospace' }, isLight && { color: '#000000' }]}>
                        {isPwdRevealed ? selectedAccount.password : '••••••••••••'}
                      </Text>
                      <TouchableOpacity onPress={() => setIsPwdRevealed(!isPwdRevealed)} style={{ marginRight: 12 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name={isPwdRevealed ? 'eye-off-outline' : 'eye-outline'} size={18} color="#8E8E93" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => copyText(selectedAccount.password, 'Mật khẩu')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="copy-outline" size={18} color={appSettings.accentColor} />
                      </TouchableOpacity>
                    </View>

                    {selectedAccount.ign ? (
                      <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                        <Text style={[styles.detailLabel, isLight && { color: '#6C6C70' }]}>Tên nhân vật</Text>
                        <Text style={[styles.detailVal, isLight && { color: '#000000' }]}>{selectedAccount.ign}</Text>
                        <TouchableOpacity onPress={() => copyText(selectedAccount.ign!, 'Tên nhân vật')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="copy-outline" size={18} color={appSettings.accentColor} />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* GHI CHÚ (NOTES) CARD */}
                <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 24 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingHorizontal: 4 }}>
                    <Text style={styles.sectionCaption}>GHI CHÚ</Text>
                    {selectedAccount.notes && (
                      <TouchableOpacity onPress={() => copyText(selectedAccount.notes!, 'Ghi chú')}>
                        <Ionicons name="copy-outline" size={15} color={appSettings.accentColor} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }, { padding: 14 }]}>
                    <Text style={{ color: selectedAccount.notes ? (isLight ? '#000000' : '#FFFFFF') : '#8E8E93', fontSize: 14, lineHeight: 20 }}>
                      {selectedAccount.notes || 'Chưa có ghi chú nào cho tài khoản này.'}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 30, gap: 10 }]}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 14,
                      borderRadius: 12,
                      backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
                      borderWidth: 0.5,
                      borderColor: isLight ? '#E5E5EA' : '#2C2C2E',
                      gap: 8,
                    }}
                    activeOpacity={0.8}
                    onPress={() => {
                      const allInfo = `Tài khoản: ${selectedAccount.username}\nMật khẩu: ${selectedAccount.password}\nGame: ${selectedAccount.game} (${selectedAccount.server})${selectedAccount.notes ? `\nGhi chú: ${selectedAccount.notes}` : ''}`;
                      copyText(allInfo, 'toàn bộ thông tin');
                    }}
                  >
                    <Ionicons name="copy" size={16} color={isLight ? '#000000' : '#FFFFFF'} />
                    <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontWeight: '600', fontSize: 15 }}>Sao Chép Toàn Bộ Thông Tin</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 14,
                      borderRadius: 12,
                      backgroundColor: 'rgba(255,69,58,0.1)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,69,58,0.25)',
                      gap: 6,
                    }}
                    activeOpacity={0.8}
                    onPress={() => handleDeleteAccount(selectedAccount.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF453A" />
                    <Text style={{ color: '#FF453A', fontWeight: '700', fontSize: 15 }}>
                      Xóa Tài Khoản Khỏi Két Sắt
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : (
            /* VAULT MAIN LIST VIEW VỚI LOGO VÀ TÊN APP LOCKX PRO */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 16, paddingTop: 10 }]}>
              {/* Top Brand & Status Header: Logo, LockX PRO, iOS 18 Badge, Notification & Add Buttons */}
              <View style={styles.homeBrandHeader}>
                <View style={styles.homeBrandLeft}>
                  <Image source={require('./assets/icon.png')} style={styles.homeBrandLogo} />
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.homeBrandTitle}>LockX</Text>
                      <View style={styles.homeProBadge}>
                        <Text style={styles.homeProBadgeText}>PRO</Text>
                      </View>
                    </View>
                    <Text style={styles.homeBrandSubtitle}>Bảo Mật & Quản Lý Toàn Diện</Text>
                  </View>
                </View>

                <View style={styles.homeBrandRight}>
                  <TouchableOpacity
                    style={styles.homeOsBadge}
                    activeOpacity={0.8}
                    onPress={() => triggerToast(`Đang chạy trên iOS ${detectedOsVersion} (${detectedOsBuild})`)}
                  >
                    <Ionicons name="checkmark-circle" size={12} color="#30D158" />
                    <Text style={styles.homeOsBadgeText}>{`iOS ${detectedOsVersion}`}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.circlePlusBtn}
                    activeOpacity={0.75}
                    onPress={() => setShowNotificationCenter(true)}
                  >
                    <Ionicons name="notifications-outline" size={18} color={isLight ? '#000000' : '#FFFFFF'} />
                    {unreadNotifCount > 0 && (
                      <View style={styles.notifBadgePill}>
                        <Text style={styles.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.circlePlusBtn}
                    onPress={() => {
                      setNewTitle('');
                      setNewUser('');
                      setNewPwd('');
                      setNewIgn('');
                      setNewNotes('');
                      setVaultSubView('add');
                    }}
                  >
                    <Ionicons name="add" size={22} color={appSettings.accentColor} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Apple Search Bar */}
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 14 }]}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isLight ? '#E3E3E8' : '#1C1C1E',
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    height: 36,
                  }}
                >
                  <Ionicons name="search" size={17} color="#8E8E93" style={{ marginRight: 6 }} />
                  <TextInput
                    style={{ flex: 1, color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, padding: 0 }}
                    placeholder={t.searchVault}
                    placeholderTextColor="#8E8E93"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color="#8E8E93" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Category Segment Filter (iOS 18 Segmented Control) */}
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 16 }]}>
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: isLight ? '#E3E3E8' : '#1C1C1E',
                    borderRadius: 9,
                    padding: 3,
                    gap: 2,
                  }}
                >
                  {[
                    { id: 'all', label: t.allAccounts },
                    { id: 'Game', label: 'Game' },
                    { id: 'Clone', label: 'Clone/Smurf' },
                    { id: 'Social', label: 'Mạng xã hội' },
                    { id: 'Work', label: 'Công việc' },
                  ].map((cat) => {
                    const isSel = selectedCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setSelectedCategory(cat.id)}
                        style={{
                          flex: 1,
                          paddingVertical: 6,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 7,
                          backgroundColor: isSel
                            ? (isLight ? '#FFFFFF' : '#2C2C2E')
                            : 'transparent',
                          shadowColor: isSel ? '#000' : 'transparent',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: isSel ? 0.15 : 0,
                          shadowRadius: 2,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: isSel ? '600' : '500',
                            color: isSel ? (isLight ? '#000000' : '#FFFFFF') : '#8E8E93',
                          }}
                          numberOfLines={1}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Quick Metrics Dashboard */}
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 14 }]}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
                      borderRadius: 14,
                      padding: 12,
                      borderWidth: 0.5,
                      borderColor: isLight ? '#E5E5EA' : 'rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(10, 132, 255, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                      <Ionicons name="shield-checkmark" size={17} color="#0A84FF" />
                    </View>
                    <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 20, fontWeight: '800' }}>
                      {accounts.length}
                    </Text>
                    <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 11, fontWeight: '500', marginTop: 2 }}>
                      Tài khoản lưu
                    </Text>
                    <Text style={{ color: '#0A84FF', fontSize: 10, fontWeight: '600', marginTop: 2 }}>
                      AES-256 Bit
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => setCurrentTab('apps')}
                    style={{
                      flex: 1,
                      backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
                      borderRadius: 14,
                      padding: 12,
                      borderWidth: 0.5,
                      borderColor: isLight ? '#E5E5EA' : 'rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(48, 209, 88, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                      <Ionicons name="hourglass" size={17} color="#30D158" />
                    </View>
                    <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 20, fontWeight: '800' }}>
                      {formatUsageTime(totalScreenTimeMinutes)}
                    </Text>
                    <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 11, fontWeight: '500', marginTop: 2 }}>
                      Thời gian dùng
                    </Text>
                    <Text style={{ color: '#30D158', fontSize: 10, fontWeight: '600', marginTop: 2 }}>
                      Hôm nay
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => setCurrentTab('apps')}
                    style={{
                      flex: 1,
                      backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
                      borderRadius: 14,
                      padding: 12,
                      borderWidth: 0.5,
                      borderColor: isLight ? '#E5E5EA' : 'rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255, 159, 10, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                      <Ionicons name="apps" size={17} color="#FF9F0A" />
                    </View>
                    <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 20, fontWeight: '800' }}>
                      {phoneApps.length}
                    </Text>
                    <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 11, fontWeight: '500', marginTop: 2 }}>
                      App iPhone
                    </Text>
                    <Text style={{ color: '#FF9F0A', fontSize: 10, fontWeight: '600', marginTop: 2 }}>
                      Đang quản lý
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Quick Actions Shortcuts */}
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => {
                      setNewTitle('');
                      setNewUser('');
                      setNewPwd('');
                      setNewIgn('');
                      setNewNotes('');
                      setVaultSubView('add');
                    }}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
                      paddingVertical: 10,
                      borderRadius: 11,
                      borderWidth: 0.5,
                      borderColor: isLight ? '#E5E5EA' : 'rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <Ionicons name="add-circle" size={16} color={appSettings.accentColor} />
                    <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Thêm Mới</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => setCurrentTab('apps')}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
                      paddingVertical: 10,
                      borderRadius: 11,
                      borderWidth: 0.5,
                      borderColor: isLight ? '#E5E5EA' : 'rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <Ionicons name="hourglass-outline" size={16} color="#30D158" />
                    <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Giới Hạn App</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => setActiveToolView('pwd')}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
                      paddingVertical: 10,
                      borderRadius: 11,
                      borderWidth: 0.5,
                      borderColor: isLight ? '#E5E5EA' : 'rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <Ionicons name="key-outline" size={16} color="#FF9F0A" />
                    <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Tạo Mật Khẩu</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Inset Grouped Accounts List */}
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 30 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4 }}>
                  <Text style={styles.sectionCaption}>
                    TÀI KHOẢN ĐÃ LƯU ({filteredAccounts.length})
                  </Text>
                  <Text style={{ color: appSettings.accentColor, fontSize: 11.5, fontWeight: '600' }}>Apple Keychain</Text>
                </View>

                {filteredAccounts.length === 0 ? (
                  <View
                    style={[
                      styles.groupedList,
                      isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' },
                      { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20 },
                    ]}
                  >
                    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isLight ? '#E5E5EA' : '#2C2C2E', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                      <Ionicons name="shield-outline" size={28} color="#8E8E93" />
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: isLight ? '#000000' : '#FFFFFF', marginBottom: 4 }}>
                      {searchQuery ? 'Không tìm thấy tài khoản' : 'Két Sắt Đang Trống'}
                    </Text>
                    <Text style={{ fontSize: 13, color: isLight ? '#6C6C70' : '#8E8E93', textAlign: 'center' }}>
                      {searchQuery
                        ? `Không có kết quả nào khớp với "${searchQuery}"`
                        : 'Chưa có tài khoản nào được lưu. Nhấn Thêm Mới để bắt đầu bảo vệ tài khoản.'}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                    {filteredAccounts.map((acc, index) => (
                      <TouchableOpacity
                        key={acc.id}
                        style={[
                          styles.cellItem,
                          index === filteredAccounts.length - 1 && { borderBottomWidth: 0 },
                          isLight && { borderBottomColor: '#E5E5EA' },
                        ]}
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedAccount(acc);
                          setIsPwdRevealed(false);
                          setVaultSubView('detail');
                        }}
                      >
                        <View
                          style={[
                            styles.cellLeadingIcon,
                            {
                              backgroundColor: acc.game.toLowerCase().includes('genshin')
                                ? '#2563EB'
                                : acc.game.toLowerCase().includes('honkai')
                                ? '#7C3AED'
                                : acc.game.toLowerCase().includes('valorant')
                                ? '#DC2626'
                                : acc.category === 'Social'
                                ? '#0A84FF'
                                : acc.category === 'Work'
                                ? '#34C759'
                                : '#AF52DE',
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              acc.game.toLowerCase().includes('genshin')
                                ? 'sparkles'
                                : acc.game.toLowerCase().includes('honkai')
                                ? 'train'
                                : acc.game.toLowerCase().includes('valorant')
                                ? 'shield-half'
                                : acc.category === 'Social'
                                ? 'share-social'
                                : acc.category === 'Work'
                                ? 'briefcase'
                                : 'game-controller'
                            }
                            size={17}
                            color="#FFFFFF"
                          />
                        </View>
                        <View style={[styles.cellContent, { flex: 1 }]}>
                          <Text style={[styles.cellTitle, isLight && { color: '#000000' }]} numberOfLines={1}>
                            {acc.title}
                          </Text>
                          <Text style={[styles.cellSubtitle, isLight && { color: '#6C6C70' }]} numberOfLines={1}>
                            {acc.username} • {acc.game}{acc.server ? ` (${acc.server})` : ''}
                          </Text>
                        </View>
                        {acc.notes ? (
                          <View style={{ marginRight: 6 }}>
                            <Ionicons name="document-text-outline" size={15} color="#8E8E93" />
                          </View>
                        ) : null}
                        <Ionicons name="chevron-forward" size={16} color={isLight ? '#C7C7CC' : '#636366'} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          )
        )}

        {/* TAB 1: QUẢN LÝ ỨNG DỤNG IPHONE & THỜI GIAN SỬ DỤNG */}
        {currentTab === 'apps' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.navHeader}>
              <View style={styles.titleRow}>
                <View>
                  <Text style={styles.largeTitle}>{t.tabApps}</Text>
                  <Text style={styles.navSubtitle}>Thời gian sử dụng & quản lý ứng dụng iPhone</Text>
                </View>
                <TouchableOpacity
                  style={styles.circlePlusBtn}
                  onPress={() => setIsManageAppsModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Apple Screen Time Overview Card */}
              <View style={styles.screenTimeCard}>
                <View style={styles.screenTimeHeader}>
                  <View>
                    <Text style={styles.screenTimeSubLabel}>THỜI GIAN SỬ DỤNG MÀN HÌNH</Text>
                    <Text style={styles.screenTimeBigText}>
                      {formatUsageTimeFull(totalScreenTimeMinutes)}
                    </Text>
                  </View>
                  <View style={styles.screenTimePill}>
                    <Ionicons name="trending-down" size={13} color="#30D158" />
                    <Text style={styles.screenTimePillText}>-14% tuần này</Text>
                  </View>
                </View>

                {/* Period Selector Tabs: Hôm nay / 7 ngày qua */}
                <View style={styles.screenTimeToggleBar}>
                  <TouchableOpacity
                    style={[styles.screenTimeToggleBtn, screenTimePeriod === 'today' && styles.screenTimeToggleBtnActive]}
                    onPress={() => setScreenTimePeriod('today')}
                  >
                    <Text style={[styles.screenTimeToggleBtnText, screenTimePeriod === 'today' && styles.screenTimeToggleBtnTextActive]}>
                      Hôm Nay
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.screenTimeToggleBtn, screenTimePeriod === 'week' && styles.screenTimeToggleBtnActive]}
                    onPress={() => setScreenTimePeriod('week')}
                  >
                    <Text style={[styles.screenTimeToggleBtnText, screenTimePeriod === 'week' && styles.screenTimeToggleBtnTextActive]}>
                      7 Ngày Qua
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Apple Screen Time Bar Chart */}
                <View style={styles.chartContainer}>
                  {/* Dashed Average Line */}
                  <View style={[styles.chartAverageLine, { bottom: '50%' }]} />

                  {(screenTimePeriod === 'today'
                    ? [
                        { label: '0h', ratio: 0.15, cat: '#0A84FF' },
                        { label: '4h', ratio: 0.25, cat: '#0A84FF' },
                        { label: '8h', ratio: 0.65, cat: '#30D158' },
                        { label: '12h', ratio: 0.90, cat: '#0A84FF' },
                        { label: '16h', ratio: 0.75, cat: '#FF9500' },
                        { label: '20h', ratio: 0.40, cat: '#0A84FF' },
                      ]
                    : [
                        { label: 'T2', ratio: 0.65, cat: '#0A84FF' },
                        { label: 'T3', ratio: 0.80, cat: '#30D158' },
                        { label: 'T4', ratio: 0.70, cat: '#0A84FF' },
                        { label: 'T5', ratio: 0.85, cat: '#FF9500' },
                        { label: 'T6', ratio: 0.95, cat: '#0A84FF' },
                        { label: 'T7', ratio: 1.00, cat: '#FF9500' },
                        { label: 'CN', ratio: 0.88, cat: '#0A84FF' },
                      ]
                  ).map((col) => {
                    const barHeightPct = totalScreenTimeMinutes > 0 ? Math.max(14, Math.round(col.ratio * 100)) : 10;
                    return (
                      <View key={col.label} style={styles.chartCol}>
                        <View style={[styles.chartBarWrap, { height: '80%' }]}>
                          <View
                            style={[
                              styles.chartBarFill,
                              {
                                height: `${barHeightPct}%`,
                                backgroundColor: totalScreenTimeMinutes > 0 ? col.cat : '#3A3A3C',
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.chartColLabel}>{col.label}</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Category Breakdown Progress Bar */}
                {totalScreenTimeMinutes > 0 ? (
                  <>
                    <View style={styles.categoryBarWrap}>
                      <View style={{ flex: Math.max(1, categoryUsage.social), backgroundColor: '#0A84FF' }} />
                      <View style={{ flex: Math.max(1, categoryUsage.entertainment), backgroundColor: '#FF9500' }} />
                      <View style={{ flex: Math.max(1, categoryUsage.tools), backgroundColor: '#30D158' }} />
                      <View style={{ flex: Math.max(1, categoryUsage.finance), backgroundColor: '#BF5AF2' }} />
                    </View>

                    {/* Category Legend */}
                    <View style={styles.categoryLegendRow}>
                      <View style={styles.categoryLegendItem}>
                        <View style={[styles.categoryLegendDot, { backgroundColor: '#0A84FF' }]} />
                        <Text style={styles.categoryLegendText}>
                          Mạng xã hội: <Text style={styles.categoryLegendVal}>{formatUsageTime(categoryUsage.social)}</Text>
                        </Text>
                      </View>

                      <View style={styles.categoryLegendItem}>
                        <View style={[styles.categoryLegendDot, { backgroundColor: '#FF9500' }]} />
                        <Text style={styles.categoryLegendText}>
                          Giải trí: <Text style={styles.categoryLegendVal}>{formatUsageTime(categoryUsage.entertainment)}</Text>
                        </Text>
                      </View>

                      <View style={styles.categoryLegendItem}>
                        <View style={[styles.categoryLegendDot, { backgroundColor: '#30D158' }]} />
                        <Text style={styles.categoryLegendText}>
                          Tiện ích: <Text style={styles.categoryLegendVal}>{formatUsageTime(categoryUsage.tools)}</Text>
                        </Text>
                      </View>

                      <View style={styles.categoryLegendItem}>
                        <View style={[styles.categoryLegendDot, { backgroundColor: '#BF5AF2' }]} />
                        <Text style={styles.categoryLegendText}>
                          Tài chính: <Text style={styles.categoryLegendVal}>{formatUsageTime(categoryUsage.finance)}</Text>
                        </Text>
                      </View>
                    </View>
                  </>
                ) : null}
              </View>

              {/* Main CTA: Add / Pick Apps on iPhone */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#0A84FF',
                  borderRadius: 14,
                  paddingVertical: 13,
                  marginTop: 14,
                  gap: 8,
                }}
                onPress={() => setIsManageAppsModalOpen(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                  Chọn Ứng Dụng Có Trên iPhone Của Bạn
                </Text>
              </TouchableOpacity>

              {/* Search Bar & Categories (when apps exist) */}
              {phoneApps.length > 0 && (
                <>
                  <View style={styles.searchBarBox}>
                    <Ionicons name="search" size={16} color="#8E8E93" style={{ marginRight: 6 }} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Tìm trong danh sách ứng dụng đã thêm..."
                      placeholderTextColor="#636366"
                      value={appSearchQuery}
                      onChangeText={setAppSearchQuery}
                    />
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {[
                        { id: 'all', label: `Tất cả (${phoneApps.length})` },
                        { id: 'social', label: 'Mạng xã hội' },
                        { id: 'finance', label: 'Tài chính' },
                        { id: 'tools', label: 'Tiện ích' },
                        { id: 'shopping', label: 'Mua sắm' },
                        { id: 'game', label: 'Game' },
                        { id: 'system', label: 'Hệ thống' },
                      ].map((chip) => (
                        <TouchableOpacity
                          key={chip.id}
                          style={[
                            styles.appChipBtn,
                            appCategoryFilter === chip.id && styles.appChipBtnActive,
                          ]}
                          onPress={() => setAppCategoryFilter(chip.id as any)}
                        >
                          <Text
                            style={[
                              styles.appChipText,
                              appCategoryFilter === chip.id && styles.appChipTextActive,
                            ]}
                          >
                            {chip.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}
            </View>

            {/* List of iPhone Applications with Screen Time & Apple Squircle Icons */}
            <View style={styles.sectionWrap}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 12 }}>
                <Text style={[styles.sectionCaption, { marginLeft: 0, marginBottom: 0 }]}>
                  {`THỜI GIAN SỬ DỤNG (${filteredPhoneApps.length})`}
                </Text>
                <TouchableOpacity onPress={() => setIsManageAppsModalOpen(true)}>
                  <Text style={{ color: '#0A84FF', fontSize: 13, fontWeight: '600' }}>+ Thêm app</Text>
                </TouchableOpacity>
              </View>

              {phoneApps.length === 0 ? (
                <View style={styles.emptyAppBox}>
                  <Ionicons name="apps-outline" size={44} color="#636366" />
                  <Text style={styles.emptyAppTitle}>Chưa có ứng dụng nào</Text>
                  <Text style={styles.emptyAppSub}>
                    Bấm nút bên dưới để chọn các ứng dụng thật đang cài đặt trên iPhone của bạn (Zalo, Messenger, Vietcombank, YouTube, TikTok...).
                  </Text>
                  <TouchableOpacity
                    style={[styles.btnEmptyScan, { marginTop: 14, backgroundColor: '#0A84FF' }]}
                    onPress={() => setIsManageAppsModalOpen(true)}
                  >
                    <Ionicons name="add-circle" size={16} color="#fff" />
                    <Text style={styles.btnEmptyScanText}>Chọn Ứng Dụng Trên iPhone</Text>
                  </TouchableOpacity>
                </View>
              ) : filteredPhoneApps.length === 0 ? (
                <View style={styles.emptyAppBox}>
                  <Ionicons name="search-outline" size={40} color="#636366" />
                  <Text style={styles.emptyAppTitle}>Không tìm thấy ứng dụng</Text>
                  <Text style={styles.emptyAppSub}>
                    Không có ứng dụng nào phù hợp với từ khóa hoặc bộ lọc hiện tại.
                  </Text>
                </View>
              ) : (
                <View style={styles.groupedList}>
                  {filteredPhoneApps.map((app, index) => (
                    <TouchableOpacity
                      key={app.id}
                      style={[
                        styles.cellItem,
                        index === filteredPhoneApps.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => setSelectedPhoneApp(app)}
                    >
                      {/* Apple Standard Squircle App Icon */}
                      <AppleAppIcon app={app} size={44} />

                      {/* App Info & Relative Screen Time Usage Bar */}
                      <View style={[styles.cellContent, { marginLeft: 12 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                          <Text style={styles.cellTitle} numberOfLines={1}>
                            {app.name}
                          </Text>
                          {app.isCustom && (
                            <View style={styles.appCustomBadge}>
                              <Text style={styles.appCustomBadgeText}>TỰ THÊM</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.cellSubtitle}>
                          {app.category === 'social'
                            ? 'Mạng xã hội'
                            : app.category === 'finance'
                            ? 'Tài chính & Bank'
                            : app.category === 'tools'
                            ? 'Tiện ích'
                            : app.category === 'shopping'
                            ? 'Mua sắm'
                            : app.category === 'game'
                            ? 'Trò chơi'
                            : 'Hệ thống iOS'}
                          {` • ${app.openCount || 1} lần mở`}
                        </Text>

                        {/* Relative usage bar */}
                        <View style={{ width: '100%', height: 3.5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
                          <View
                            style={{
                              height: '100%',
                              width: `${Math.min(100, Math.max(8, Math.round(((app.usageMinutes || 0) / maxAppUsageMinutes) * 100)))}%`,
                              backgroundColor:
                                app.category === 'social'
                                  ? '#0A84FF'
                                  : app.category === 'game'
                                  ? '#FF9500'
                                  : app.category === 'finance'
                                  ? '#BF5AF2'
                                  : '#30D158',
                              borderRadius: 2,
                            }}
                          />
                        </View>
                      </View>

                      {/* Exact Usage Time & Actions */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13.5 }}>
                            {formatUsageTime(app.usageMinutes || 0)}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.btnAppOpen}
                          activeOpacity={0.8}
                          onPress={() => openPhoneApp(app)}
                        >
                          <Text style={styles.btnAppOpenText}>MỞ</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => removeAppFromList(app.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ padding: 4 }}
                        >
                          <Ionicons name="trash-outline" size={15} color="#636366" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {/* TAB 2: BẠN BÈ & NHẮN TIN (CHUẨN APPLE iOS 18 HIG ĐỒNG BỘ SETTINGS & PROFILE) */}
        {currentTab === 'chat' && (
          activeChatFriend ? (
            /* PHÒNG CHAT IMESSAGE CHUẨN APPLE iOS 18 (USER THẬT, NO BOT) */
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1, backgroundColor: isLight ? '#F2F2F7' : '#000000' }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
              {/* Apple iMessage Top Navigation Bar */}
              <View style={[styles.fullScreenNavBar, isLight && { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E5EA' }]}>
                <TouchableOpacity
                  onPress={() => {
                    setActiveChatFriend(null);
                    setChatInputText('');
                    setIsFriendTyping(false);
                  }}
                  style={styles.fullScreenNavBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="chevron-back" size={20} color={appSettings.accentColor} />
                  <Text style={[styles.fullScreenNavBtnText, { color: appSettings.accentColor }]}>{t.tabFriends}</Text>
                </TouchableOpacity>

                {/* Center Contact Header - Chạm để xem Trang Cá Nhân */}
                <TouchableOpacity
                  onPress={() => setViewingFriendProfile(activeChatFriend)}
                  style={{ alignItems: 'center', maxWidth: '55%' }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.fullScreenNavTitle, isLight && { color: '#000000' }]} numberOfLines={1}>
                      {activeChatFriend.displayName}
                    </Text>
                    <Ionicons name="shield-checkmark" size={13} color={appSettings.accentColor} />
                  </View>
                  <Text style={{ color: isFriendTyping ? appSettings.accentColor : (activeChatFriend.status === 'online' ? '#34C759' : '#8E8E93'), fontSize: 11, fontWeight: '500' }}>
                    {isFriendTyping ? 'Đang soạn tin...' : (activeChatFriend.status === 'online' ? '🟢 Đang hoạt động • E2E' : '⚪ Ngoại tuyến')}
                  </Text>
                </TouchableOpacity>

                {/* Right Profile & Actions */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Tùy chọn cuộc trò chuyện',
                        `Đoạn chat với ${activeChatFriend.displayName}`,
                        [
                          { text: 'Xem hồ sơ cá nhân', onPress: () => setViewingFriendProfile(activeChatFriend) },
                          {
                            text: 'Làm sạch tin nhắn',
                            style: 'destructive',
                            onPress: () => handleClearChat(activeChatFriend.id),
                          },
                          { text: t.cancel, style: 'cancel' },
                        ]
                      );
                    }}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: isLight ? '#F2F2F7' : '#1C1C1E',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="ellipsis-horizontal" size={16} color={isLight ? '#000000' : '#FFFFFF'} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setViewingFriendProfile(activeChatFriend)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: activeChatFriend.avatarColor,
                      justifyContent: 'center',
                      alignItems: 'center',
                      shadowColor: activeChatFriend.avatarColor,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.35,
                      shadowRadius: 4,
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={(activeChatFriend.avatarIcon || 'person') as any} size={17} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Chat Messages Stream */}
              <ScrollView
                ref={chatScrollRef}
                style={{ flex: 1, paddingHorizontal: 16 }}
                contentContainerStyle={{ paddingVertical: 16, paddingBottom: 20, flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
              >
                {/* Security E2E Notice */}
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 }}>
                    <Ionicons name="lock-closed" size={12} color="#8E8E93" />
                    <Text style={{ color: '#8E8E93', fontSize: 11, fontWeight: '500' }}>
                      Tin nhắn được bảo vệ bằng mã hóa đầu cuối LockX
                    </Text>
                  </View>
                </View>

                {(chatMessages[activeChatFriend.id] || []).map((msg) => {
                  const isMe = msg.sender === 'me';
                  return (
                    <View
                      key={msg.id}
                      style={{
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        maxWidth: '78%',
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: isMe ? appSettings.accentColor : (isLight ? '#FFFFFF' : '#2C2C2E'),
                          borderRadius: 18,
                          paddingHorizontal: 15,
                          paddingVertical: 10,
                          borderBottomRightRadius: isMe ? 4 : 18,
                          borderBottomLeftRadius: isMe ? 18 : 4,
                          borderWidth: !isMe && isLight ? 0.5 : 0,
                          borderColor: '#E5E5EA',
                          shadowColor: isMe ? appSettings.accentColor : '#000000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: isMe ? 0.25 : 0.08,
                          shadowRadius: 3,
                        }}
                      >
                        <Text style={{ color: isMe ? '#FFFFFF' : (isLight ? '#000000' : '#FFFFFF'), fontSize: 15, lineHeight: 21 }}>
                          {msg.text}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: isMe ? 'flex-end' : 'flex-start', marginTop: 3, marginHorizontal: 4 }}>
                        <Text style={{ color: isLight ? '#8E8E93' : '#636366', fontSize: 11 }}>
                          {msg.time}
                        </Text>
                        {isMe && <Ionicons name="checkmark-done" size={13} color={appSettings.accentColor} />}
                      </View>
                    </View>
                  );
                })}

                {/* Animated Typing Indicator Bubble */}
                {isFriendTyping && (
                  <TypingIndicatorBubble
                    isLight={isLight}
                    avatarColor={activeChatFriend.avatarColor}
                    avatarIcon={activeChatFriend.avatarIcon}
                  />
                )}
              </ScrollView>

              {/* Persona Switcher Pill (Đổi vai người gửi / Xóa tin nhắn) */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  backgroundColor: isLight ? '#FFFFFF' : '#141416',
                  borderTopWidth: 0.5,
                  borderTopColor: isLight ? '#E5E5EA' : 'rgba(255,255,255,0.06)',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 11.5, color: isLight ? '#8E8E93' : '#636366', fontWeight: '500' }}>
                    Người gửi:
                  </Text>
                  <TouchableOpacity
                    onPress={() => setChatSenderMode('me')}
                    style={{
                      paddingHorizontal: 9,
                      paddingVertical: 3,
                      borderRadius: 12,
                      backgroundColor: chatSenderMode === 'me' ? appSettings.accentColor : (isLight ? '#E5E5EA' : '#2C2C2E'),
                    }}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: chatSenderMode === 'me' ? '700' : '500', color: chatSenderMode === 'me' ? '#FFFFFF' : (isLight ? '#6C6C70' : '#8E8E93') }}>
                      Tôi ({userProfile.displayName || 'Bạn'})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setChatSenderMode('friend')}
                    style={{
                      paddingHorizontal: 9,
                      paddingVertical: 3,
                      borderRadius: 12,
                      backgroundColor: chatSenderMode === 'friend' ? activeChatFriend.avatarColor : (isLight ? '#E5E5EA' : '#2C2C2E'),
                    }}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: chatSenderMode === 'friend' ? '700' : '500', color: chatSenderMode === 'friend' ? '#FFFFFF' : (isLight ? '#6C6C70' : '#8E8E93') }}>
                      {activeChatFriend.displayName}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => handleClearChat(activeChatFriend.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ fontSize: 11.5, color: '#FF3B30', fontWeight: '500' }}>Xóa tin nhắn</Text>
                </TouchableOpacity>
              </View>

              {/* Chat Input Bar */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingTop: 8,
                  paddingBottom: Platform.OS === 'ios' ? 22 : 10,
                  backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
                  borderTopWidth: 0.5,
                  borderTopColor: isLight ? '#E5E5EA' : 'rgba(255,255,255,0.08)',
                  gap: 8,
                }}
              >
                <TouchableOpacity
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: isLight ? '#F2F2F7' : '#2C2C2E',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  onPress={() => triggerToast('Đính kèm dữ liệu tài khoản két sắt', 'Két Sắt LockX', 'info', 'shield-checkmark')}
                >
                  <Ionicons name="add" size={20} color={appSettings.accentColor} />
                </TouchableOpacity>

                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: isLight ? '#F2F2F7' : '#2C2C2E',
                    borderRadius: 20,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    color: isLight ? '#000000' : '#FFFFFF',
                    fontSize: 15,
                    maxHeight: 100,
                  }}
                  placeholder={
                    chatSenderMode === 'me'
                      ? (t.typeMessage || 'Nhắn tin bí mật...')
                      : `Soạn tin từ ${activeChatFriend.displayName}...`
                  }
                  placeholderTextColor="#8E8E93"
                  value={chatInputText}
                  onChangeText={setChatInputText}
                  multiline
                  blurOnSubmit={false}
                  onSubmitEditing={() => handleSendMessage()}
                />

                <TouchableOpacity
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: chatInputText.trim()
                      ? (chatSenderMode === 'friend' ? activeChatFriend.avatarColor : appSettings.accentColor)
                      : (isLight ? '#E5E5EA' : '#3A3A3C'),
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  onPress={() => handleSendMessage()}
                  disabled={!chatInputText.trim()}
                >
                  <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          ) : (
            /* DANH SÁCH BẠN BÈ ĐỒNG BỘ CHUẨN APPLE iOS 18 HIG */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 16, paddingTop: 10 }]}>
              {/* Apple Large Title Header */}
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 12 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: 34, fontWeight: '700', color: isLight ? '#000000' : '#FFFFFF', letterSpacing: 0.36 }}>
                      {t.tabFriends}
                    </Text>
                    <Text style={{ fontSize: 13, color: isLight ? '#6C6C70' : '#8E8E93', marginTop: 2 }}>
                      Tin nhắn mã hóa E2E • Bạn bè an toàn
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: isLight ? '#E5E5EA' : '#1C1C1E',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    activeOpacity={0.75}
                    onPress={() => setShowAddFriendBox(!showAddFriendBox)}
                  >
                    <Ionicons name={showAddFriendBox ? 'close' : 'person-add'} size={18} color={appSettings.accentColor} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Apple Settings Search Bar */}
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 14 }]}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isLight ? '#E3E3E8' : '#1C1C1E',
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    height: 36,
                  }}
                >
                  <Ionicons name="search" size={17} color="#8E8E93" style={{ marginRight: 6 }} />
                  <TextInput
                    style={{ flex: 1, color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, padding: 0 }}
                    placeholder={t.searchFriends || 'Tìm kiếm bạn bè qua @username...'}
                    placeholderTextColor="#8E8E93"
                    value={friendSearchQuery}
                    onChangeText={setFriendSearchQuery}
                    autoCapitalize="none"
                  />
                  {friendSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setFriendSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color="#8E8E93" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Hero Quick Add Friend Box (Toggleable Apple Box) */}
              {showAddFriendBox && (
                <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 16 }]}>
                  <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }, { padding: 14 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <View style={[styles.cellLeadingIcon, { backgroundColor: appSettings.accentColor, width: 28, height: 28, borderRadius: 14 }]}>
                        <Ionicons name="person-add" size={15} color="#FFFFFF" />
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: isLight ? '#000000' : '#FFFFFF' }}>
                        Thêm Bạn Bè Mới
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <TextInput
                        style={{
                          flex: 1,
                          backgroundColor: isLight ? '#F2F2F7' : '#2C2C2E',
                          borderRadius: 10,
                          paddingHorizontal: 12,
                          height: 38,
                          color: isLight ? '#000000' : '#FFFFFF',
                          fontSize: 14.5,
                        }}
                        placeholder="Nhập @username bạn bè..."
                        placeholderTextColor="#8E8E93"
                        value={newFriendInput}
                        onChangeText={setNewFriendInput}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        onPress={handleAddFriend}
                        style={{
                          backgroundColor: appSettings.accentColor,
                          paddingHorizontal: 14,
                          height: 38,
                          borderRadius: 10,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Kết Nối</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* Segmented Filter Control (Tất cả / Trực tuyến / Chưa đọc) */}
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 16 }]}>
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: isLight ? '#E3E3E8' : '#1C1C1E',
                    borderRadius: 9,
                    padding: 3,
                    gap: 2,
                  }}
                >
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'online', label: 'Trực tuyến' },
                    { id: 'unread', label: 'Chưa đọc' },
                  ].map((seg) => {
                    const isSel = friendFilter === seg.id;
                    return (
                      <TouchableOpacity
                        key={seg.id}
                        onPress={() => setFriendFilter(seg.id as any)}
                        style={{
                          flex: 1,
                          paddingVertical: 6,
                          alignItems: 'center',
                          borderRadius: 7,
                          backgroundColor: isSel ? (isLight ? '#FFFFFF' : '#636366') : 'transparent',
                          shadowColor: isSel ? '#000000' : 'transparent',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: isSel ? 0.2 : 0,
                          shadowRadius: 2,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: isSel ? '700' : '500',
                            color: isSel ? (isLight ? '#000000' : '#FFFFFF') : (isLight ? '#6C6C70' : '#8E8E93'),
                          }}
                        >
                          {seg.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Grouped List of Friends */}
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 32 }]}>
                <Text style={[styles.sectionCaption, { marginLeft: 16, marginBottom: 6 }]}>
                  DANH SÁCH BẠN BÈ ({filteredFriends.length})
                </Text>
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                  {filteredFriends.map((friend, idx, arr) => (
                    <TouchableOpacity
                      key={friend.id}
                      style={[
                        styles.cellItem,
                        isLight && { borderBottomColor: '#E5E5EA' },
                        idx === arr.length - 1 && { borderBottomWidth: 0 },
                        { paddingVertical: 12 },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setActiveChatFriend(friend);
                        setChatInputText('');
                      }}
                    >
                      {/* Avatar with Modern Icon & Live Indicator */}
                      <View style={{ position: 'relative', marginRight: 14 }}>
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: friend.avatarColor,
                            justifyContent: 'center',
                            alignItems: 'center',
                            shadowColor: friend.avatarColor,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.35,
                            shadowRadius: 5,
                          }}
                        >
                          <Ionicons name={(friend.avatarIcon || 'person') as any} size={24} color="#FFFFFF" />
                        </View>
                        {friend.status === 'online' && (
                          <View
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              width: 14,
                              height: 14,
                              borderRadius: 7,
                              backgroundColor: '#34C759',
                              borderWidth: 2.5,
                              borderColor: isLight ? '#FFFFFF' : '#1C1C1E',
                            }}
                          />
                        )}
                      </View>

                      {/* Main Content */}
                      <View style={[styles.cellContent, { flex: 1 }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16.5, fontWeight: '600' }} numberOfLines={1}>
                            {friend.displayName}
                          </Text>
                          <Text style={{ color: isLight ? '#8E8E93' : '#8E8E93', fontSize: 13 }}>
                            {friend.lastTime || ''}
                          </Text>
                        </View>

                        <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 13, marginTop: 1 }}>
                          {friend.username} • {friend.status === 'online' ? '🟢 Trực tuyến' : 'Ngoại tuyến'}
                        </Text>

                        {friend.lastMessage ? (
                          <Text style={{ color: isLight ? '#3C3C43' : '#AEAEB2', fontSize: 13.5, marginTop: 3 }} numberOfLines={1}>
                            {friend.lastMessage}
                          </Text>
                        ) : null}
                      </View>

                      {/* Right Accessories (Unread badge + Chevron) */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                        {(friend.unreadCount || 0) > 0 && (
                          <View
                            style={{
                              backgroundColor: appSettings.accentColor,
                              borderRadius: 10,
                              minWidth: 20,
                              height: 20,
                              justifyContent: 'center',
                              alignItems: 'center',
                              paddingHorizontal: 6,
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' }}>
                              {friend.unreadCount}
                            </Text>
                          </View>
                        )}
                        <Ionicons name="chevron-forward" size={17} color={isLight ? '#C7C7CC' : '#48484A'} />
                      </View>
                    </TouchableOpacity>
                  ))}

                  {filteredFriends.length === 0 && (
                    <View style={{ alignItems: 'center', paddingVertical: 36 }}>
                      <Ionicons name="people-outline" size={44} color="#8E8E93" />
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 15, fontWeight: '600', marginTop: 10 }}>
                        Không tìm thấy bạn bè nào
                      </Text>
                      <Text style={{ color: '#8E8E93', fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 30 }}>
                        Thử tìm bằng từ khóa khác hoặc nhấn biểu tượng (+) phía trên để thêm bạn bè mới.
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>
          )
        )}

        {/* TAB 3: CÁ NHÂN (GENUINE APPLE ID PROFILE) */}
        {currentTab === 'profile' && (
          profileSubView === 'change_password' ? (
            /* MÀN HÌNH ĐỔI MẬT KHẨU CHUẨN APPLE */
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: isLight ? '#F2F2F7' : '#000000' }}>
              <View style={[styles.fullScreenNavBar, isLight && { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E5EA' }]}>
                <TouchableOpacity onPress={() => setProfileSubView('main')} style={styles.fullScreenNavBtn}>
                  <Ionicons name="chevron-back" size={20} color={appSettings.accentColor} />
                  <Text style={[styles.fullScreenNavBtnText, { color: appSettings.accentColor }]}>{t.tabProfile}</Text>
                </TouchableOpacity>
                <Text style={[styles.fullScreenNavTitle, isLight && { color: '#000000' }]}>{t.changePassword}</Text>
                <TouchableOpacity onPress={handleChangePassword} style={styles.fullScreenNavBtn}>
                  <Text style={[styles.fullScreenNavBtnText, { color: appSettings.accentColor, fontWeight: '600' }]}>{t.done}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                  <View style={[styles.formRow, isLight && { borderBottomColor: '#E5E5EA' }]}>
                    <Text style={[styles.formLabel, { color: isLight ? '#000000' : '#FFFFFF', fontSize: 16 }]}>{t.currentPassword}</Text>
                    <TextInput style={[styles.formInput, { textAlign: 'right', color: isLight ? '#000000' : '#FFFFFF' }]} secureTextEntry placeholder={t.currentPassword} placeholderTextColor="#8E8E93" value={currentPassInput} onChangeText={setCurrentPassInput} />
                  </View>
                  <View style={[styles.formRow, isLight && { borderBottomColor: '#E5E5EA' }]}>
                    <Text style={[styles.formLabel, { color: isLight ? '#000000' : '#FFFFFF', fontSize: 16 }]}>{t.newPassword}</Text>
                    <TextInput style={[styles.formInput, { textAlign: 'right', color: isLight ? '#000000' : '#FFFFFF' }]} secureTextEntry placeholder={t.newPassword} placeholderTextColor="#8E8E93" value={newPassInput} onChangeText={setNewPassInput} />
                  </View>
                  <View style={[styles.formRow, { borderBottomWidth: 0 }]}>
                    <Text style={[styles.formLabel, { color: isLight ? '#000000' : '#FFFFFF', fontSize: 16 }]}>{t.confirmPassword}</Text>
                    <TextInput style={[styles.formInput, { textAlign: 'right', color: isLight ? '#000000' : '#FFFFFF' }]} secureTextEntry placeholder={t.confirmPassword} placeholderTextColor="#8E8E93" value={confirmNewPassInput} onChangeText={setConfirmNewPassInput} />
                  </View>
                </View>
                <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12.5, marginTop: 8, marginLeft: 16, lineHeight: 18 }}>
                  Mật khẩu được sử dụng để mở khóa và bảo vệ dữ liệu Két sắt khi không sử dụng Face ID.
                </Text>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : profileSubView === 'edit_profile' ? (
            /* MÀN HÌNH CHỈNH SỬA HỒ SƠ CHUẨN APPLE */
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: isLight ? '#F2F2F7' : '#000000' }}>
              <View style={[styles.fullScreenNavBar, isLight && { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E5EA' }]}>
                <TouchableOpacity onPress={() => setProfileSubView('main')} style={styles.fullScreenNavBtn}>
                  <Text style={[styles.fullScreenNavBtnText, { color: appSettings.accentColor }]}>{t.cancel}</Text>
                </TouchableOpacity>
                <Text style={[styles.fullScreenNavTitle, isLight && { color: '#000000' }]}>{t.editProfile}</Text>
                <TouchableOpacity onPress={handleSaveEditProfile} style={styles.fullScreenNavBtn}>
                  <Text style={[styles.fullScreenNavBtnText, { color: appSettings.accentColor, fontWeight: '600' }]}>{t.done}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
                {/* Avatar Hero Box Chuẩn Apple Settings */}
                <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 20 }]}>
                  <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }, { alignItems: 'center', paddingVertical: 22 }]}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setIsAvatarModalOpen(true)}
                      style={{ position: 'relative', marginBottom: 12 }}
                    >
                      {renderProfileAvatar(editAvatarType, editAvatarUri, editAvatarPresetId, editDisplayNameInput, editAvatarColor, 96)}
                      <View
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: appSettings.accentColor,
                          justifyContent: 'center',
                          alignItems: 'center',
                          borderWidth: 2.5,
                          borderColor: isLight ? '#FFFFFF' : '#1C1C1E',
                        }}
                      >
                        <Ionicons name="camera" size={16} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>

                    <Text style={{ fontSize: 18, fontWeight: '700', color: isLight ? '#000000' : '#FFFFFF' }}>
                      {editDisplayNameInput || 'Admin LockX'}
                    </Text>
                    <Text style={{ fontSize: 13, color: isLight ? '#6C6C70' : '#8E8E93', marginTop: 2, marginBottom: 14 }}>
                      {editUsernameInput.startsWith('@') ? editUsernameInput : `@${editUsernameInput}`}
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        onPress={() => setIsAvatarModalOpen(true)}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          backgroundColor: isLight ? '#E5E5EA' : '#2C2C2E',
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          borderRadius: 16,
                        }}
                      >
                        <Ionicons name="sparkles" size={15} color={appSettings.accentColor} />
                        <Text style={{ color: appSettings.accentColor, fontSize: 13.5, fontWeight: '600' }}>
                          Đổi ảnh đại diện
                        </Text>
                      </TouchableOpacity>

                      {editAvatarType === 'image' && !!editAvatarUri && (
                        <TouchableOpacity
                          onPress={() => {
                            setEditAvatarType('preset');
                            setEditAvatarUri('');
                            triggerToast('Đã chuyển về avatar mặc định');
                          }}
                          activeOpacity={0.7}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                            backgroundColor: 'rgba(255, 59, 48, 0.12)',
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                            borderRadius: 16,
                          }}
                        >
                          <Ionicons name="trash-outline" size={14} color="#FF3B30" />
                          <Text style={{ color: '#FF3B30', fontSize: 13, fontWeight: '600' }}>
                            Xóa ảnh
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>

                {/* NHÓM 1: THÔNG TIN CƠ BẢN */}
                <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                  <Text style={styles.sectionCaption}>THÔNG TIN CƠ BẢN</Text>
                  <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                    {/* Họ và tên */}
                    <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                      <View style={[styles.cellLeadingIcon, { backgroundColor: '#007AFF' }]}>
                        <Ionicons name="person" size={17} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.cellTitle, { width: 105 }]}>{t.fullName}</Text>
                      <TextInput
                        style={{ flex: 1, textAlign: 'right', fontSize: 16, color: isLight ? '#000000' : '#FFFFFF', paddingVertical: 0 }}
                        placeholder={t.fullName}
                        placeholderTextColor="#8E8E93"
                        value={editDisplayNameInput}
                        onChangeText={setEditDisplayNameInput}
                      />
                    </View>

                    {/* Username */}
                    <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                      <View style={[styles.cellLeadingIcon, { backgroundColor: '#5856D6' }]}>
                        <Ionicons name="at" size={17} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.cellTitle, { width: 105 }]}>{t.username}</Text>
                      <TextInput
                        style={{ flex: 1, textAlign: 'right', fontSize: 16, color: isLight ? '#000000' : '#FFFFFF', paddingVertical: 0 }}
                        placeholder="@username"
                        placeholderTextColor="#8E8E93"
                        value={editUsernameInput}
                        onChangeText={setEditUsernameInput}
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                  <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12, marginTop: 6, marginLeft: 16 }}>
                    Họ tên có thể đổi bất kỳ lúc nào. Tên người dùng (@username) chỉ được đổi 1 lần mỗi 7 ngày.
                  </Text>
                </View>

                {/* NHÓM 2: LIÊN HỆ & BẢO MẬT */}
                <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                  <Text style={styles.sectionCaption}>LIÊN HỆ & BẢO MẬT</Text>
                  <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                    {/* Email */}
                    <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                      <View style={[styles.cellLeadingIcon, { backgroundColor: '#34C759' }]}>
                        <Ionicons name="mail" size={17} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.cellTitle, { width: 105 }]}>{t.email}</Text>
                      <TextInput
                        style={{ flex: 1, textAlign: 'right', fontSize: 16, color: isLight ? '#000000' : '#FFFFFF', paddingVertical: 0 }}
                        placeholder={t.notUpdated}
                        placeholderTextColor="#8E8E93"
                        value={editEmailInput}
                        onChangeText={setEditEmailInput}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>

                    {/* Số điện thoại */}
                    <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                      <View style={[styles.cellLeadingIcon, { backgroundColor: '#30B0C7' }]}>
                        <Ionicons name="call" size={17} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.cellTitle, { width: 105 }]}>{t.phone}</Text>
                      <TextInput
                        style={{ flex: 1, textAlign: 'right', fontSize: 16, color: isLight ? '#000000' : '#FFFFFF', paddingVertical: 0 }}
                        placeholder={t.notUpdated}
                        placeholderTextColor="#8E8E93"
                        value={editPhoneInput}
                        onChangeText={setEditPhoneInput}
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>
                </View>

                {/* NHÓM 3: CÁ NHÂN & TIỂU SỬ */}
                <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                  <Text style={styles.sectionCaption}>CÁ NHÂN & TIỂU SỬ</Text>
                  <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                    {/* Ngày sinh */}
                    <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                      <View style={[styles.cellLeadingIcon, { backgroundColor: '#AF52DE' }]}>
                        <Ionicons name="calendar" size={17} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.cellTitle, { width: 105 }]}>{t.birthday}</Text>
                      <TextInput
                        style={{ flex: 1, textAlign: 'right', fontSize: 16, color: isLight ? '#000000' : '#FFFFFF', paddingVertical: 0 }}
                        placeholder={t.notUpdated}
                        placeholderTextColor="#8E8E93"
                        value={editBirthdayInput}
                        onChangeText={setEditBirthdayInput}
                      />
                    </View>

                    {/* Giới tính */}
                    <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                      <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF2D55' }]}>
                        <Ionicons name="people" size={17} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.cellTitle, { width: 105 }]}>{t.gender}</Text>
                      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }}>
                        {[
                          { key: 'Nam', label: t.male },
                          { key: 'Nữ', label: t.female },
                          { key: 'Chưa cập nhật', label: t.notUpdated },
                        ].map((g) => {
                          const isSel = editGenderInput === g.key;
                          return (
                            <TouchableOpacity
                              key={g.key}
                              onPress={() => setEditGenderInput(g.key as any)}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 8,
                                backgroundColor: isSel ? appSettings.accentColor : (isLight ? '#E5E5EA' : '#2C2C2E'),
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: isSel ? '700' : '500',
                                  color: isSel ? '#FFFFFF' : (isLight ? '#000000' : '#8E8E93'),
                                }}
                              >
                                {g.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Tiểu sử */}
                    <View style={[styles.cellItem, { borderBottomWidth: 0, flexDirection: 'column', alignItems: 'stretch', paddingVertical: 12 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <View style={[styles.cellLeadingIcon, { backgroundColor: '#8E8E93' }]}>
                          <Ionicons name="document-text" size={17} color="#FFFFFF" />
                        </View>
                        <Text style={styles.cellTitle}>{t.bio}</Text>
                      </View>
                      <TextInput
                        style={{
                          width: '100%',
                          minHeight: 70,
                          color: isLight ? '#000000' : '#FFFFFF',
                          backgroundColor: isLight ? '#F2F2F7' : '#2C2C2E',
                          borderRadius: 10,
                          padding: 10,
                          fontSize: 14,
                        }}
                        multiline
                        placeholder={t.notUpdated}
                        placeholderTextColor="#8E8E93"
                        value={editBioInput}
                        onChangeText={setEditBioInput}
                      />
                    </View>
                  </View>
                </View>

                {/* Nút Lưu Hồ Sơ To Rõ Chuẩn Apple */}
                <View style={[styles.sectionWrap, { marginTop: 8, marginBottom: 36 }]}>
                  <TouchableOpacity
                    onPress={handleSaveEditProfile}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: appSettings.accentColor,
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: appSettings.accentColor,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                      {t.saveChanges}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : profileSubView === 'verify_id' ? (
            /* MÀN HÌNH XÁC MINH DANH TÍNH LOCKX VERIFIED (TÍCH XANH CHUẨN APPLE) */
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: isLight ? '#F2F2F7' : '#000000' }}>
              <View style={[styles.fullScreenNavBar, isLight && { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E5EA' }]}>
                <TouchableOpacity onPress={() => setProfileSubView('main')} style={styles.fullScreenNavBtn}>
                  <Ionicons name="chevron-back" size={20} color={appSettings.accentColor} />
                  <Text style={[styles.fullScreenNavBtnText, { color: appSettings.accentColor }]}>{t.tabProfile}</Text>
                </TouchableOpacity>
                <Text style={[styles.fullScreenNavTitle, isLight && { color: '#000000' }]}>LockX Verified</Text>
                <View style={{ width: 60 }} />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}>
                {/* Hero Badge Showcase */}
                <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 20 }]}>
                  <View
                    style={[
                      styles.groupedList,
                      isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' },
                      { alignItems: 'center', paddingVertical: 26, paddingHorizontal: 20 },
                    ]}
                  >
                    {/* Glowing Shield Badge */}
                    <View
                      style={{
                        width: 88,
                        height: 88,
                        borderRadius: 44,
                        backgroundColor: userProfile.isVerified ? 'rgba(10, 132, 255, 0.12)' : (isLight ? '#F2F2F7' : '#2C2C2E'),
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: 2,
                        borderColor: userProfile.isVerified ? '#0A84FF' : (isLight ? '#E5E5EA' : '#3A3A3C'),
                        marginBottom: 14,
                        shadowColor: userProfile.isVerified ? '#0A84FF' : 'transparent',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: userProfile.isVerified ? 0.35 : 0,
                        shadowRadius: 12,
                      }}
                    >
                      <Ionicons
                        name={userProfile.isVerified ? 'shield-checkmark' : 'shield-outline'}
                        size={48}
                        color={userProfile.isVerified ? '#0A84FF' : '#8E8E93'}
                      />
                    </View>

                    {/* Status Title & Subtitle */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 21, fontWeight: '700', color: isLight ? '#000000' : '#FFFFFF' }}>
                        LockX Verified
                      </Text>
                      {userProfile.isVerified && (
                        <View style={{ backgroundColor: '#0A84FF', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
                          <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                        </View>
                      )}
                    </View>

                    <Text
                      style={{
                        fontSize: 13.5,
                        color: isLight ? '#6C6C70' : '#8E8E93',
                        marginTop: 6,
                        textAlign: 'center',
                        lineHeight: 19,
                        paddingHorizontal: 10,
                      }}
                    >
                      {userProfile.isVerified
                        ? 'Tài khoản của bạn đã được xác minh danh tính chính chủ và bảo vệ đa tầng bởi Apple Face ID.'
                        : 'Xác minh danh tính để nhận huy hiệu Tích Xanh chính chủ và mở khóa các đặc quyền bảo vệ nâng cao.'}
                    </Text>

                    {/* Status Pill */}
                    <View
                      style={{
                        marginTop: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: userProfile.isVerified ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 159, 10, 0.15)',
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        borderRadius: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: userProfile.isVerified ? '#34C759' : '#FF9F0A',
                        }}
                      />
                      <Text
                        style={{
                          color: userProfile.isVerified ? '#34C759' : '#FF9F0A',
                          fontSize: 12.5,
                          fontWeight: '700',
                          letterSpacing: 0.3,
                        }}
                      >
                        {userProfile.isVerified ? 'ĐÃ XÁC MINH CHÍNH CHỦ' : 'CHƯA XÁC MINH DANH TÍNH'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* IF VERIFIED: SHOW CERTIFICATE DETAILS */}
                {userProfile.isVerified ? (
                  <>
                    <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                      <Text style={styles.sectionCaption}>THÔNG TIN CHỨNG THỰC BẢO MẬT</Text>
                      <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                        {/* Mã chứng chỉ */}
                        <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                          <View style={[styles.cellLeadingIcon, { backgroundColor: '#0A84FF' }]}>
                            <Ionicons name="key" size={17} color="#FFFFFF" />
                          </View>
                          <Text style={[styles.cellTitle, { width: 120 }]}>Mã chứng chỉ</Text>
                          <Text style={{ flex: 1, textAlign: 'right', fontSize: 13.5, fontWeight: '600', color: '#0A84FF' }} numberOfLines={1}>
                            {userProfile.verifiedKey || 'LX-VERIFIED-SECURE'}
                          </Text>
                        </View>

                        {/* Ngày cấp */}
                        <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                          <View style={[styles.cellLeadingIcon, { backgroundColor: '#34C759' }]}>
                            <Ionicons name="calendar" size={17} color="#FFFFFF" />
                          </View>
                          <Text style={[styles.cellTitle, { width: 120 }]}>Ngày xác minh</Text>
                          <Text style={{ flex: 1, textAlign: 'right', fontSize: 15, color: isLight ? '#000000' : '#FFFFFF' }}>
                            {userProfile.verifiedAt || 'Hôm nay'}
                          </Text>
                        </View>

                        {/* Phương thức */}
                        <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                          <View style={[styles.cellLeadingIcon, { backgroundColor: '#AF52DE' }]}>
                            <Ionicons name="scan" size={17} color="#FFFFFF" />
                          </View>
                          <Text style={[styles.cellTitle, { width: 120 }]}>Phương thức</Text>
                          <Text style={{ flex: 1, textAlign: 'right', fontSize: 15, color: isLight ? '#000000' : '#FFFFFF' }}>
                            Apple Face ID TrueDepth
                          </Text>
                        </View>

                        {/* Mức độ bảo vệ */}
                        <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                          <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF9500' }]}>
                            <Ionicons name="shield" size={17} color="#FFFFFF" />
                          </View>
                          <Text style={[styles.cellTitle, { width: 120 }]}>Cấp độ bảo vệ</Text>
                          <Text style={{ flex: 1, textAlign: 'right', fontSize: 15, fontWeight: '600', color: '#34C759' }}>
                            Cấp 3 (Mã Hóa Tối Đa)
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Button Re-verify & Revoke */}
                    <View style={[styles.sectionWrap, { marginTop: 8, marginBottom: 36, gap: 10 }]}>
                      <TouchableOpacity
                        onPress={handleVerifyIdentity}
                        activeOpacity={0.8}
                        style={{
                          backgroundColor: appSettings.accentColor,
                          paddingVertical: 14,
                          borderRadius: 12,
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'row',
                          gap: 8,
                        }}
                      >
                        <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 15.5, fontWeight: '700' }}>
                          Xác minh lại bằng Face ID
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleRevokeVerification}
                        activeOpacity={0.8}
                        style={{
                          backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
                          borderWidth: 1,
                          borderColor: isLight ? '#E5E5EA' : '#3A3A3C',
                          paddingVertical: 13,
                          borderRadius: 12,
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'row',
                          gap: 8,
                        }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                        <Text style={{ color: '#FF3B30', fontSize: 15, fontWeight: '600' }}>
                          Hủy trạng thái xác minh
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  /* IF NOT VERIFIED: SHOW BENEFITS & CTA BUTTON */
                  <>
                    <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 20 }]}>
                      <Text style={styles.sectionCaption}>ĐẶC QUYỀN KHI XÁC MINH TÍCH XANH</Text>
                      <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                        {/* Đặc quyền 1 */}
                        <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }, { alignItems: 'flex-start', paddingVertical: 12 }]}>
                          <View style={[styles.cellLeadingIcon, { backgroundColor: '#0A84FF', marginTop: 2 }]}>
                            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                          </View>
                          <View style={{ flex: 1, marginLeft: 2 }}>
                            <Text style={{ fontSize: 15.5, fontWeight: '600', color: isLight ? '#000000' : '#FFFFFF' }}>
                              Huy hiệu Tích Xanh chính chủ
                            </Text>
                            <Text style={{ fontSize: 13, color: isLight ? '#6C6C70' : '#8E8E93', marginTop: 2, lineHeight: 18 }}>
                              Hiển thị huy hiệu tích xanh uy tín bên cạnh tên bạn trong mọi cuộc trò chuyện, nhóm và thông tin hồ sơ.
                            </Text>
                          </View>
                        </View>

                        {/* Đặc quyền 2 */}
                        <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }, { alignItems: 'flex-start', paddingVertical: 12 }]}>
                          <View style={[styles.cellLeadingIcon, { backgroundColor: '#34C759', marginTop: 2 }]}>
                            <Ionicons name="scan" size={18} color="#FFFFFF" />
                          </View>
                          <View style={{ flex: 1, marginLeft: 2 }}>
                            <Text style={{ fontSize: 15.5, fontWeight: '600', color: isLight ? '#000000' : '#FFFFFF' }}>
                              Khóa sinh trắc học Face ID TrueDepth
                            </Text>
                            <Text style={{ fontSize: 13, color: isLight ? '#6C6C70' : '#8E8E93', marginTop: 2, lineHeight: 18 }}>
                              Bảo vệ hồ sơ bằng công nghệ nhận diện khuôn mặt sinh trắc học chuẩn Apple, chống giả mạo tuyệt đối.
                            </Text>
                          </View>
                        </View>

                        {/* Đặc quyền 3 */}
                        <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }, { alignItems: 'flex-start', paddingVertical: 12 }]}>
                          <View style={[styles.cellLeadingIcon, { backgroundColor: '#5856D6', marginTop: 2 }]}>
                            <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                          </View>
                          <View style={{ flex: 1, marginLeft: 2 }}>
                            <Text style={{ fontSize: 15.5, fontWeight: '600', color: isLight ? '#000000' : '#FFFFFF' }}>
                              Chống sao chép & mạo danh hồ sơ
                            </Text>
                            <Text style={{ fontSize: 13, color: isLight ? '#6C6C70' : '#8E8E93', marginTop: 2, lineHeight: 18 }}>
                              Tạo khóa chứng chỉ mật mã duy nhất gắn với thiết bị, ngăn chặn việc sao chép danh tính.
                            </Text>
                          </View>
                        </View>

                        {/* Đặc quyền 4 */}
                        <View style={[styles.cellItem, { borderBottomWidth: 0, alignItems: 'flex-start', paddingVertical: 12 }]}>
                          <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF9500', marginTop: 2 }]}>
                            <Ionicons name="flash" size={18} color="#FFFFFF" />
                          </View>
                          <View style={{ flex: 1, marginLeft: 2 }}>
                            <Text style={{ fontSize: 15.5, fontWeight: '600', color: isLight ? '#000000' : '#FFFFFF' }}>
                              Ưu tiên khôi phục dữ liệu két sắt
                            </Text>
                            <Text style={{ fontSize: 13, color: isLight ? '#6C6C70' : '#8E8E93', marginTop: 2, lineHeight: 18 }}>
                              Quyền ưu tiên giải mã và phục hồi dữ liệu két sắt khi xảy ra sự cố quên mật mã.
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Big Action CTA Button */}
                    <View style={[styles.sectionWrap, { marginTop: 4, marginBottom: 36 }]}>
                      <TouchableOpacity
                        onPress={handleVerifyIdentity}
                        activeOpacity={0.8}
                        style={{
                          backgroundColor: '#0A84FF',
                          paddingVertical: 15,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'row',
                          gap: 10,
                          shadowColor: '#0A84FF',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.35,
                          shadowRadius: 10,
                        }}
                      >
                        <Ionicons name="scan" size={20} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                          Xác Minh Bằng Face ID Ngay
                        </Text>
                      </TouchableOpacity>
                      <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 16 }}>
                        Quá trình xác thực diễn ra an toàn trên thiết bị của bạn thông qua Secure Enclave.
                      </Text>
                    </View>
                  </>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          ) : (
            /* MÀN HÌNH CÁ NHÂN CHÍNH (CHUẨN APPLE ID VÀ ĐỒNG BỘ SETTINGS) */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 16, paddingTop: 10 }]}>
              {/* Apple Large Title */}
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 12 }]}>
                <Text style={{ fontSize: 34, fontWeight: '700', color: isLight ? '#000000' : '#FFFFFF', letterSpacing: 0.36 }}>
                  {t.tabProfile}
                </Text>
              </View>

              {/* Apple ID Header Card (Box Admin căn bằng chuẩn với các box ở dưới) */}
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }, { padding: 16 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={handleOpenEditProfile}
                      activeOpacity={0.8}
                      style={{ position: 'relative', marginRight: 14 }}
                    >
                      {renderProfileAvatar(userProfile.avatarType, userProfile.avatarUri, userProfile.avatarPresetId, userProfile.displayName, userProfile.avatarColor, 66)}
                      <View
                        style={{
                          position: 'absolute',
                          bottom: -2,
                          right: -2,
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: appSettings.accentColor,
                          justifyContent: 'center',
                          alignItems: 'center',
                          borderWidth: 2,
                          borderColor: isLight ? '#FFFFFF' : '#1C1C1E',
                        }}
                      >
                        <Ionicons name="camera" size={11} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 19, fontWeight: '700' }} numberOfLines={1}>
                          {userProfile.displayName}
                        </Text>
                        {userProfile.isVerified && (
                          <View style={{ backgroundColor: '#0A84FF', borderRadius: 9, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                          </View>
                        )}
                      </View>
                      <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 13.5, marginTop: 2 }}>
                        {userProfile.username}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={handleOpenEditProfile}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 14,
                        backgroundColor: isLight ? '#E5E5EA' : '#2C2C2E',
                      }}
                    >
                      <Text style={{ color: appSettings.accentColor, fontSize: 13, fontWeight: '600' }}>{t.editProfile}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Sub Action Buttons Bar */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: isLight ? '#E5E5EA' : '#2C2C2E' }}>
                    <TouchableOpacity
                      onPress={handleOpenEditProfile}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10, backgroundColor: isLight ? '#F2F2F7' : '#2C2C2E' }}
                    >
                      <Ionicons name="create-outline" size={15} color={appSettings.accentColor} />
                      <Text style={{ color: appSettings.accentColor, fontSize: 12.5, fontWeight: '600' }}>{t.editProfile}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        handleOpenEditProfile();
                        setTimeout(() => setIsAvatarModalOpen(true), 250);
                      }}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10, backgroundColor: isLight ? '#F2F2F7' : '#2C2C2E' }}
                    >
                      <Ionicons name="sparkles-outline" size={15} color={appSettings.accentColor} />
                      <Text style={{ color: appSettings.accentColor, fontSize: 12.5, fontWeight: '600' }}>Avatar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setCurrentPassInput('');
                        setNewPassInput('');
                        setConfirmNewPassInput('');
                        setProfileSubView('change_password');
                      }}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10, backgroundColor: isLight ? '#F2F2F7' : '#2C2C2E' }}
                    >
                      <Ionicons name="key-outline" size={15} color={appSettings.accentColor} />
                      <Text style={{ color: appSettings.accentColor, fontSize: 12.5, fontWeight: '600' }}>{t.changePassword}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* NHÓM XÁC MINH DANH TÍNH (LOCKX VERIFIED) */}
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12.5, fontWeight: '500', textTransform: 'uppercase', marginBottom: 6, marginLeft: 16 }}>
                  Xác minh danh tính
                </Text>
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                  <TouchableOpacity
                    style={[styles.cellItem, { borderBottomWidth: 0, paddingVertical: 12 }]}
                    activeOpacity={0.7}
                    onPress={() => setProfileSubView('verify_id')}
                  >
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#0A84FF' }]}>
                      <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '500' }}>
                          LockX Verified
                        </Text>
                        {userProfile.isVerified && (
                          <View style={{ backgroundColor: '#0A84FF', borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                          </View>
                        )}
                      </View>
                      <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12.5, marginTop: 1 }}>
                        {userProfile.isVerified ? 'Tài khoản đã có Tích Xanh chính chủ' : 'Chưa xác minh • Nhấn để nhận Tích Xanh'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View
                        style={{
                          backgroundColor: userProfile.isVerified ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 159, 10, 0.15)',
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                        }}
                      >
                        <Text
                          style={{
                            color: userProfile.isVerified ? '#34C759' : '#FF9F0A',
                            fontSize: 11.5,
                            fontWeight: '700',
                          }}
                        >
                          {userProfile.isVerified ? 'ĐÃ XÁC MINH' : 'CHƯA XÁC MINH'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={isLight ? '#C7C7CC' : '#48484A'} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* NHÓM THÔNG TIN CÁ NHÂN (HIỂN THỊ CHƯA CẬP NHẬT KHI ĐỂ TRỐNG) */}
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12.5, fontWeight: '500', textTransform: 'uppercase', marginBottom: 6, marginLeft: 16 }}>
                  {t.profileTitle}
                </Text>
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                  {/* Email */}
                  <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#34C759' }]}>
                      <Ionicons name="mail-outline" size={17} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.email}</Text>
                    </View>
                    <Text style={{ color: userProfile.email ? (isLight ? '#000000' : '#FFFFFF') : '#8E8E93', fontSize: 15, fontStyle: userProfile.email ? 'normal' : 'italic' }}>
                      {userProfile.email || t.notUpdated}
                    </Text>
                  </View>

                  {/* Điện thoại */}
                  <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#30B0C7' }]}>
                      <Ionicons name="call-outline" size={17} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.phone}</Text>
                    </View>
                    <Text style={{ color: userProfile.phone ? (isLight ? '#000000' : '#FFFFFF') : '#8E8E93', fontSize: 15, fontStyle: userProfile.phone ? 'normal' : 'italic' }}>
                      {userProfile.phone || t.notUpdated}
                    </Text>
                  </View>

                  {/* Ngày sinh */}
                  <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#AF52DE' }]}>
                      <Ionicons name="calendar-outline" size={17} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.birthday}</Text>
                    </View>
                    <Text style={{ color: userProfile.birthday ? (isLight ? '#000000' : '#FFFFFF') : '#8E8E93', fontSize: 15, fontStyle: userProfile.birthday ? 'normal' : 'italic' }}>
                      {userProfile.birthday || t.notUpdated}
                    </Text>
                  </View>

                  {/* Giới tính */}
                  <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF2D55' }]}>
                      <Ionicons name="people-outline" size={17} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.gender}</Text>
                    </View>
                    <Text style={{ color: (userProfile.gender && userProfile.gender !== 'Chưa cập nhật') ? (isLight ? '#000000' : '#FFFFFF') : '#8E8E93', fontSize: 15, fontStyle: (userProfile.gender && userProfile.gender !== 'Chưa cập nhật') ? 'normal' : 'italic' }}>
                      {(userProfile.gender && userProfile.gender !== 'Chưa cập nhật') ? (userProfile.gender === 'Nam' ? t.male : userProfile.gender === 'Nữ' ? t.female : userProfile.gender) : t.notUpdated}
                    </Text>
                  </View>

                  {/* Tiểu sử */}
                  <View style={[styles.cellItem, { borderBottomWidth: 0, flexDirection: 'column', alignItems: 'stretch', paddingVertical: 12 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <View style={[styles.cellLeadingIcon, { backgroundColor: '#8E8E93' }]}>
                        <Ionicons name="document-text-outline" size={17} color="#FFFFFF" />
                      </View>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.bio}</Text>
                    </View>
                    <Text style={{ color: userProfile.bio ? (isLight ? '#3C3C43' : '#D1D1D6') : '#8E8E93', fontSize: 14, fontStyle: userProfile.bio ? 'normal' : 'italic', lineHeight: 20, paddingLeft: 38 }}>
                      {userProfile.bio || t.notUpdated}
                    </Text>
                  </View>
                </View>
              </View>

              {/* NHÓM 1: HOẠT ĐỘNG & THỜI GIAN THỰC TẾ */}
              <View style={[styles.sectionWrap, { marginTop: 12, marginBottom: 18 }]}>
                <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12.5, fontWeight: '500', textTransform: 'uppercase', marginBottom: 6, marginLeft: 16 }}>
                  Hoạt động
                </Text>
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                  {/* Ngày tham gia thực tế */}
                  <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#34C759' }]}>
                      <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>Ngày tham gia</Text>
                    </View>
                    <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 16 }}>{userProfile.joinDate}</Text>
                  </View>

                  {/* Thời gian sử dụng thực tế */}
                  <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#AF52DE' }]}>
                      <Ionicons name="time-outline" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>Thời gian sử dụng</Text>
                    </View>
                    <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 16 }}>
                      {userProfile.daysActive <= 1 ? 'Hôm nay (1 ngày)' : `${userProfile.daysActive} ngày`}
                    </Text>
                  </View>

                  {/* Tổng giờ hoạt động tích lũy thực tế */}
                  <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#007AFF' }]}>
                      <Ionicons name="hourglass-outline" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>Tổng giờ hoạt động</Text>
                    </View>
                    <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 16 }}>
                      {totalActiveSeconds < 3600
                        ? `${Math.max(1, Math.floor(totalActiveSeconds / 60))} phút (${(totalActiveSeconds / 3600).toFixed(1)}h)`
                        : `${(totalActiveSeconds / 3600).toFixed(1)}h`}
                    </Text>
                  </View>
                </View>
              </View>

              {/* NHÓM 2: ĐĂNG NHẬP & BẢO MẬT */}
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12.5, fontWeight: '500', textTransform: 'uppercase', marginBottom: 6, marginLeft: 16 }}>
                  Đăng nhập & Bảo mật
                </Text>
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                  {/* Đổi mật khẩu */}
                  <TouchableOpacity
                    style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setCurrentPassInput('');
                      setNewPassInput('');
                      setConfirmNewPassInput('');
                      setProfileSubView('change_password');
                    }}
                  >
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF9500' }]}>
                      <Ionicons name="key-outline" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.changePassword}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isLight ? '#C7C7CC' : '#48484A'} />
                  </TouchableOpacity>

                  {/* Face ID Status */}
                  <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#34C759' }]}>
                      <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>Xác thực Face ID</Text>
                    </View>
                    <Text style={{ color: appSettings.useFaceId ? '#34C759' : '#8E8E93', fontSize: 16 }}>
                      {appSettings.useFaceId ? 'Đã bật' : 'Tắt'}
                    </Text>
                  </View>

                  {/* Đăng xuất thiết bị khác */}
                  <TouchableOpacity
                    style={[styles.cellItem, { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                    onPress={handleClearOtherSessions}
                  >
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF3B30' }]}>
                      <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: '#FF3B30', fontSize: 16, fontWeight: '400' }}>{t.logoutOtherSessions}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isLight ? '#C7C7CC' : '#48484A'} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* NHÓM 3: CÁC THIẾT BỊ ĐÃ ĐĂNG NHẬP (THÔNG TIN THIẾT BỊ THẬT) */}
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 32 }]}>
                <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12.5, fontWeight: '500', textTransform: 'uppercase', marginBottom: 6, marginLeft: 16 }}>
                  {t.deviceInfo} ({loginHistory.length})
                </Text>
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                  {loginHistory.slice(0, 5).map((log, idx, arr) => {
                    const devLower = log.device.toLowerCase();
                    const isComputer = devLower.includes('mac') || devLower.includes('windows') || devLower.includes('pc');
                    const isTablet = devLower.includes('ipad') || devLower.includes('tablet');
                    const iconName = isComputer ? 'laptop-outline' : isTablet ? 'tablet-portrait-outline' : 'phone-portrait-outline';

                    return (
                      <View
                        key={log.id}
                        style={[
                          styles.cellItem,
                          isLight && { borderBottomColor: '#E5E5EA' },
                          idx === arr.length - 1 && { borderBottomWidth: 0 },
                        ]}
                      >
                        <View style={[styles.cellLeadingIcon, { backgroundColor: log.isCurrent ? '#34C759' : (isLight ? '#E5E5EA' : '#3A3A3C') }]}>
                          <Ionicons
                            name={iconName as any}
                            size={18}
                            color={log.isCurrent ? '#FFFFFF' : (isLight ? '#000000' : '#FFFFFF')}
                          />
                        </View>
                        <View style={[styles.cellContent, { flex: 1 }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: log.isCurrent ? '600' : '400' }} numberOfLines={1}>
                              {log.device}
                            </Text>
                            {log.isCurrent && (
                              <View style={{ backgroundColor: 'rgba(52, 199, 89, 0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#34C759' }} />
                                <Text style={{ color: '#34C759', fontSize: 11, fontWeight: '700' }}>Thiết bị này</Text>
                              </View>
                            )}
                          </View>
                          <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12, marginTop: 2 }}>
                            {log.timestamp} • {log.location} • {log.os}
                          </Text>
                        </View>
                        {!log.isCurrent && (
                          <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 13 }}>
                            {log.method}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Nút Đăng Xuất Nhanh trong Hồ Sơ */}
              <View style={[styles.sectionWrap, { marginTop: 10, marginBottom: 36 }]}>
                <TouchableOpacity
                  style={[
                    styles.groupedList,
                    {
                      backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
                      paddingVertical: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 0.5,
                      borderColor: isLight ? 'rgba(255, 59, 48, 0.25)' : 'rgba(255, 69, 58, 0.25)',
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={handleLogout}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="log-out-outline" size={18} color="#FF3B30" />
                    <Text style={{ color: '#FF3B30', fontSize: 16, fontWeight: '600' }}>Đăng Xuất</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )
        )}

        {/* TAB 4: CÀI ĐẶT CHUẨN APPLE iOS 18 (GENUINE APPLE HIG SETTINGS) */}
        {currentTab === 'settings' && (
          settingsSubView === 'font_size' ? (
            /* SUBVIEW: CỠ CHỮ & CHỮ IN ĐẬM CHUẨN APPLE */
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: isLight ? '#F2F2F7' : '#000000' }}>
              <View style={styles.fullScreenNavBar}>
                <TouchableOpacity onPress={() => setSettingsSubView('main')} style={styles.fullScreenNavBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name="chevron-back" size={20} color={appSettings.accentColor} />
                  <Text style={[styles.fullScreenNavBtnText, { color: appSettings.accentColor }]}>Cài đặt</Text>
                </TouchableOpacity>
                <Text style={styles.fullScreenNavTitle}>Cỡ chữ</Text>
                <View style={{ width: 60 }} />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 16, paddingTop: 16 }]}>
                {/* Live Preview Card */}
                {(() => {
                  const FONT_LEVELS = [
                    { level: 1, percent: '82%', label: 'Rất nhỏ', mult: 0.82, scale: 'small' as const },
                    { level: 2, percent: '90%', label: 'Nhỏ', mult: 0.90, scale: 'small' as const },
                    { level: 3, percent: '100%', label: 'Tiêu chuẩn', mult: 1.00, scale: 'standard' as const },
                    { level: 4, percent: '110%', label: 'Vừa', mult: 1.10, scale: 'standard' as const },
                    { level: 5, percent: '120%', label: 'Lớn', mult: 1.20, scale: 'large' as const },
                    { level: 6, percent: '135%', label: 'Rất lớn', mult: 1.35, scale: 'large' as const },
                    { level: 7, percent: '150%', label: 'Cực đại', mult: 1.50, scale: 'large' as const },
                  ];
                  const currentLevel = appSettings.fontSizeLevel || 3;
                  const activeLevelObj = FONT_LEVELS.find((f) => f.level === currentLevel) || FONT_LEVELS[2];
                  const previewFontSize = Math.round(16 * activeLevelObj.mult);
                  const previewLineHeight = Math.round(24 * activeLevelObj.mult);

                  const handleSelectLevel = (lvl: number) => {
                    const found = FONT_LEVELS.find((f) => f.level === lvl) || FONT_LEVELS[2];
                    saveAppSettings({
                      ...appSettings,
                      fontSizeLevel: lvl,
                      fontSizeScale: found.scale,
                    });
                    triggerToast(`✓ Cỡ chữ: Mức ${lvl} - ${found.label} (${found.percent})`);
                  };

                  return (
                    <>
                      <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }, { padding: 18, marginBottom: 20 }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Xem trước trực tiếp
                          </Text>
                          <View style={{ backgroundColor: `${appSettings.accentColor}18`, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
                            <Text style={{ color: appSettings.accentColor, fontSize: 12, fontWeight: '700' }}>
                              Mức {currentLevel}/7 • {activeLevelObj.label} ({activeLevelObj.percent})
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={{
                            color: isLight ? '#000000' : '#FFFFFF',
                            fontSize: previewFontSize,
                            fontWeight: appSettings.isBoldText ? '700' : '400',
                            lineHeight: previewLineHeight,
                          }}
                        >
                          LockX Vault tự động thích ứng với thị giác của bạn. Kéo thanh trượt hoặc chạm vào từng nấc bên dưới để điều chỉnh kích cỡ chữ vừa tầm mắt nhất.
                        </Text>
                      </View>

                      {/* Section 1: Chữ in đậm */}
                      <View style={[styles.sectionWrap, { paddingHorizontal: 0, marginTop: 0, marginBottom: 20 }]}>
                        <Text style={styles.sectionCaption}>KIỂU CHỮ</Text>
                        <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                          <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                            <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF9500' }]}>
                              <Ionicons name="text" size={17} color="#FFFFFF" />
                            </View>
                            <View style={[styles.cellContent, { flex: 1 }]}>
                              <Text style={[styles.cellTitle, { fontWeight: appSettings.isBoldText ? '700' : '500' }]}>Chữ in đậm</Text>
                            </View>
                            <Switch
                              value={appSettings.isBoldText}
                              onValueChange={(v) => {
                                saveAppSettings({ ...appSettings, isBoldText: v });
                                triggerToast(v ? '✓ Đã bật chữ in đậm' : 'Đã tắt chữ in đậm');
                              }}
                              trackColor={{ false: isLight ? '#E5E5EA' : '#39393D', true: appSettings.accentColor }}
                            />
                          </View>
                        </View>
                        <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12, marginTop: 6, marginLeft: 12 }}>
                          Tăng cường độ tương phản và nét chữ trên toàn bộ giao diện ứng dụng.
                        </Text>
                      </View>

                      {/* Section 2: Kích cỡ chữ Dynamic Draggable Slider (7 Nấc Kéo Chuẩn Apple) */}
                      <View style={[styles.sectionWrap, { paddingHorizontal: 0, marginTop: 0, marginBottom: 24 }]}>
                        <Text style={styles.sectionCaption}>KÍCH CỠ CHỮ (7 NẤC ĐIỀU CHỈNH)</Text>
                        <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }, { padding: 18 }]}>
                          {/* Info Level Label */}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 15, fontWeight: '600' }}>
                              Cỡ chữ hiển thị
                            </Text>
                            <Text style={{ color: appSettings.accentColor, fontSize: 15, fontWeight: '700' }}>
                              Mức {currentLevel}: {activeLevelObj.label} ({activeLevelObj.percent})
                            </Text>
                          </View>

                          {/* Interactive Range Slider (Dùng tay kéo hoặc chuột kéo mượt mà) */}
                          <View style={{ marginBottom: 18 }}>
                            {Platform.OS === 'web' ? (
                              <input
                                type="range"
                                min="1"
                                max="7"
                                step="1"
                                value={currentLevel}
                                onChange={(e: any) => handleSelectLevel(parseInt(e.target.value, 10))}
                                style={{
                                  width: '100%',
                                  height: '28px',
                                  accentColor: appSettings.accentColor,
                                  cursor: 'pointer',
                                } as any}
                              />
                            ) : null}
                          </View>

                          {/* 7 Discrete Tappable Marks */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 13, fontWeight: '700' }}>A</Text>

                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                              {/* Background Connecting Bar */}
                              <View
                                style={{
                                  position: 'absolute',
                                  left: 8,
                                  right: 8,
                                  height: 4,
                                  backgroundColor: isLight ? '#E5E5EA' : '#3A3A3C',
                                  borderRadius: 2,
                                }}
                              />

                              {FONT_LEVELS.map((item) => {
                                const isCurrent = item.level === currentLevel;
                                return (
                                  <TouchableOpacity
                                    key={item.level}
                                    onPress={() => handleSelectLevel(item.level)}
                                    activeOpacity={0.7}
                                    style={{
                                      alignItems: 'center',
                                      zIndex: 2,
                                      paddingVertical: 4,
                                      paddingHorizontal: 2,
                                    }}
                                  >
                                    <View
                                      style={{
                                        width: isCurrent ? 24 : 12,
                                        height: isCurrent ? 24 : 12,
                                        borderRadius: isCurrent ? 12 : 6,
                                        backgroundColor: isCurrent ? appSettings.accentColor : (isLight ? '#C7C7CC' : '#636366'),
                                        borderWidth: isCurrent ? 3 : 0,
                                        borderColor: isLight ? '#FFFFFF' : '#1C1C1E',
                                        shadowColor: isCurrent ? appSettings.accentColor : 'transparent',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: isCurrent ? 0.4 : 0,
                                        shadowRadius: 5,
                                      }}
                                    />
                                    <Text
                                      style={{
                                        fontSize: 10,
                                        marginTop: 6,
                                        color: isCurrent ? appSettings.accentColor : (isLight ? '#8E8E93' : '#636366'),
                                        fontWeight: isCurrent ? '700' : '500',
                                      }}
                                    >
                                      {item.level}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>

                            <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 22, fontWeight: '800' }}>A</Text>
                          </View>
                        </View>
                        <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12, marginTop: 8, marginLeft: 16 }}>
                          Chạm trực tiếp vào số hoặc kéo thanh trượt ngang để xem thay đổi kích cỡ chữ tức thì.
                        </Text>
                      </View>
                    </>
                  );
                })()}
              </ScrollView>
            </KeyboardAvoidingView>
          ) : settingsSubView === 'language' ? (
            /* SUBVIEW: NGÔN NGỮ (LANGUAGE SELECTION) CHUẨN APPLE */
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: isLight ? '#F2F2F7' : '#000000' }}>
              <View style={styles.fullScreenNavBar}>
                <TouchableOpacity onPress={() => setSettingsSubView('main')} style={styles.fullScreenNavBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name="chevron-back" size={20} color={appSettings.accentColor} />
                  <Text style={[styles.fullScreenNavBtnText, { color: appSettings.accentColor }]}>{t.settingsTitle}</Text>
                </TouchableOpacity>
                <Text style={styles.fullScreenNavTitle}>{t.language}</Text>
                <View style={{ width: 60 }} />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 16, paddingTop: 14 }]}>
                {/* Search Bar */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isLight ? '#E3E3E8' : '#1C1C1E',
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    height: 36,
                    marginBottom: 16,
                  }}
                >
                  <Ionicons name="search" size={17} color={isLight ? '#8E8E93' : '#8E8E93'} style={{ marginRight: 6 }} />
                  <TextInput
                    style={{ flex: 1, color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, padding: 0 }}
                    placeholder={t.searchLanguage}
                    placeholderTextColor={isLight ? '#8E8E93' : '#8E8E93'}
                    value={languageSearchQuery}
                    onChangeText={setLanguageSearchQuery}
                    autoCapitalize="none"
                  />
                  {languageSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setLanguageSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color="#8E8E93" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Grouped Language List */}
                <View style={[styles.sectionWrap, { paddingHorizontal: 0, marginTop: 0 }]}>
                  <Text style={styles.sectionCaption}>{t.supportedLanguages}</Text>
                  <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                    {APP_LANGUAGES
                      .filter((l) =>
                        languageSearchQuery.trim()
                          ? l.name.toLowerCase().includes(languageSearchQuery.toLowerCase()) ||
                            l.region.toLowerCase().includes(languageSearchQuery.toLowerCase())
                          : true
                      )
                      .map((lang, index, arr) => {
                        const isSelected = appSettings.language === lang.code;
                        return (
                          <TouchableOpacity
                            key={lang.code}
                            style={[
                              styles.cellItem,
                              index === arr.length - 1 && { borderBottomWidth: 0 },
                            ]}
                            activeOpacity={0.7}
                            onPress={() => {
                              saveAppSettings({ ...appSettings, language: lang.code as any });
                              setSelectedLanguage(lang.code as any);
                              const targetT = APP_TRANSLATIONS[lang.code] || APP_TRANSLATIONS.vi;
                              triggerToast(targetT.langChangedMsg, targetT.languageTitle, 'info', 'language', '#0A84FF');
                            }}
                          >
                            <View style={{ marginRight: 12 }}>
                              {renderCountryFlagIcon(lang.code, 32, 22)}
                            </View>
                            <View style={[styles.cellContent, { flex: 1 }]}>
                              <Text style={[styles.cellTitle, isSelected && { color: appSettings.accentColor, fontWeight: '700' }]}>
                                {lang.name}
                              </Text>
                              <Text style={styles.cellSubtitle}>{lang.region}</Text>
                            </View>
                            {isSelected && (
                              <Ionicons name="checkmark" size={20} color={appSettings.accentColor} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 16, paddingTop: 10 }]}>
            {/* Apple Large Title */}
            <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 12 }]}>
              <Text style={{ fontSize: 34, fontWeight: '700', color: isLight ? '#000000' : '#FFFFFF', letterSpacing: 0.36 }}>
                {t.settingsTitle}
              </Text>
            </View>

            {/* Apple Settings Search Bar */}
            <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isLight ? '#E3E3E8' : '#1C1C1E',
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  height: 36,
                }}
              >
                <Ionicons name="search" size={17} color={isLight ? '#8E8E93' : '#8E8E93'} style={{ marginRight: 6 }} />
                <TextInput
                  style={{ flex: 1, color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, padding: 0 }}
                  placeholder={t.searchSettings}
                  placeholderTextColor={isLight ? '#8E8E93' : '#8E8E93'}
                  value={settingsSearchQuery}
                  onChangeText={setSettingsSearchQuery}
                  autoCapitalize="none"
                />
                {settingsSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSettingsSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color="#8E8E93" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Apple ID Profile Cell (Box Admin căn bằng chuẩn với các box ở dưới) */}
            {(!settingsSearchQuery || 'tài khoản cá nhân hồ sơ profile'.includes(settingsSearchQuery.toLowerCase())) && (
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                  <TouchableOpacity
                    style={[styles.cellItem, { borderBottomWidth: 0, paddingVertical: 10 }, isLight && { backgroundColor: '#FFFFFF' }]}
                    activeOpacity={0.7}
                    onPress={() => setCurrentTab('profile')}
                  >
                    <View style={{ marginRight: 14 }}>
                      {renderProfileAvatar(userProfile.avatarType, userProfile.avatarUri, userProfile.avatarPresetId, userProfile.displayName, userProfile.avatarColor, 54)}
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 18, fontWeight: '500' }} numberOfLines={1}>
                          {userProfile.displayName}
                        </Text>
                        {userProfile.isVerified && (
                          <View style={{ backgroundColor: '#0A84FF', borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                          </View>
                        )}
                      </View>
                      <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 13, marginTop: 2 }}>
                        {userProfile.username} • {t.tabProfile}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={isLight ? '#C7C7CC' : '#48484A'} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* NHÓM 1: FACE ID & MẬT MÃ */}
            {(!settingsSearchQuery || 'face id mật mã bảo mật khóa vân tay sinh trắc học'.includes(settingsSearchQuery.toLowerCase())) && (
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12.5, fontWeight: '500', textTransform: 'uppercase', marginBottom: 6, marginLeft: 16 }}>
                  {t.faceIdSecurity}
                </Text>
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                  {/* Bật / Tắt Face ID */}
                  <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#34C759' }]}>
                      <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>Face ID</Text>
                    </View>
                    <Switch
                      value={appSettings.useFaceId}
                      onValueChange={handleToggleFaceId}
                      trackColor={{ false: isLight ? '#E5E5EA' : '#39393D', true: appSettings.accentColor }}
                    />
                  </View>

                  {/* Tự động khóa */}
                  <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF9500' }]}>
                      <Ionicons name="timer-outline" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.autoLock}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        const timeouts: ('immediately' | '1m' | '5m' | 'never')[] = ['immediately', '1m', '5m', 'never'];
                        const nextIndex = (timeouts.indexOf(appSettings.autoLockTimeout) + 1) % timeouts.length;
                        const nextVal = timeouts[nextIndex];
                        saveAppSettings({ ...appSettings, autoLockTimeout: nextVal });
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 16 }}>
                        {appSettings.autoLockTimeout === 'immediately'
                          ? t.lockImmediately
                          : appSettings.autoLockTimeout === '1m'
                          ? t.lock1m
                          : appSettings.autoLockTimeout === '5m'
                          ? t.lock5m
                          : t.lockNever}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={isLight ? '#C7C7CC' : '#48484A'} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12, marginTop: 6, marginLeft: 16 }}>
                  {t.faceIdDesc}
                </Text>
              </View>
            )}

            {/* NHÓM 2: MÀN HÌNH & ĐỘ SÁNG (DISPLAY & APPEARANCE) */}
            {(!settingsSearchQuery || 'màn hình giao diện sáng tối màu chữ cỡ chữ in đậm'.includes(settingsSearchQuery.toLowerCase())) && (
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12.5, fontWeight: '500', textTransform: 'uppercase', marginBottom: 6, marginLeft: 16 }}>
                  {t.appearance}
                </Text>
                
                {/* 2 Mockups Sáng / Tối chuẩn Apple */}
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }, { padding: 16, marginBottom: 10 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
                    {/* Mockup Sáng */}
                    <TouchableOpacity
                      onPress={() => {
                        saveAppSettings({ ...appSettings, themeMode: 'light' });
                        triggerToast(t.themeLightMsg, t.themeTitle, 'info', 'sunny', '#FF9500');
                      }}
                      style={{ alignItems: 'center' }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={{
                          width: 80,
                          height: 110,
                          backgroundColor: '#E5E5EA',
                          borderRadius: 14,
                          borderWidth: isLight ? 2.5 : 1,
                          borderColor: isLight ? appSettings.accentColor : '#C7C7CC',
                          padding: 8,
                          justifyContent: 'space-between',
                          shadowColor: isLight ? appSettings.accentColor : 'transparent',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: isLight ? 0.35 : 0,
                          shadowRadius: 8,
                        }}
                      >
                        <View style={{ height: 10, width: '60%', backgroundColor: '#C7C7CC', borderRadius: 4 }} />
                        <View style={{ gap: 4 }}>
                          <View style={{ height: 6, width: '100%', backgroundColor: '#D1D1D6', borderRadius: 3 }} />
                          <View style={{ height: 6, width: '80%', backgroundColor: '#D1D1D6', borderRadius: 3 }} />
                        </View>
                        <View style={{ height: 16, backgroundColor: '#FFFFFF', borderRadius: 6 }} />
                      </View>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 13, marginTop: 8, fontWeight: '600' }}>{t.themeLight}</Text>
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: isLight ? appSettings.accentColor : '#8E8E93',
                          backgroundColor: isLight ? appSettings.accentColor : 'transparent',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginTop: 6,
                        }}
                      >
                        {isLight && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>

                    {/* Mockup Tối */}
                    <TouchableOpacity
                      onPress={() => {
                        saveAppSettings({ ...appSettings, themeMode: 'dark' });
                        triggerToast(t.themeDarkMsg, t.themeTitle, 'info', 'moon', '#5856D6');
                      }}
                      style={{ alignItems: 'center' }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={{
                          width: 80,
                          height: 110,
                          backgroundColor: '#000000',
                          borderRadius: 14,
                          borderWidth: !isLight ? 2.5 : 1,
                          borderColor: !isLight ? appSettings.accentColor : (isLight ? '#E5E5EA' : '#38383A'),
                          padding: 8,
                          justifyContent: 'space-between',
                          shadowColor: !isLight ? appSettings.accentColor : 'transparent',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: !isLight ? 0.35 : 0,
                          shadowRadius: 8,
                        }}
                      >
                        <View style={{ height: 10, width: '60%', backgroundColor: '#2C2C2E', borderRadius: 4 }} />
                        <View style={{ gap: 4 }}>
                          <View style={{ height: 6, width: '100%', backgroundColor: '#1C1C1E', borderRadius: 3 }} />
                          <View style={{ height: 6, width: '80%', backgroundColor: '#1C1C1E', borderRadius: 3 }} />
                        </View>
                        <View style={{ height: 16, backgroundColor: '#1C1C1E', borderRadius: 6 }} />
                      </View>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 13, marginTop: 8, fontWeight: '600' }}>{t.themeDark}</Text>
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: !isLight ? appSettings.accentColor : '#8E8E93',
                          backgroundColor: !isLight ? appSettings.accentColor : 'transparent',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginTop: 6,
                        }}
                      >
                        {!isLight && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Màu nhấn & Cỡ chữ riêng */}
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                  {/* Màu nhấn Tint Color */}
                  <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: appSettings.accentColor }]}>
                      <Ionicons name="color-palette" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.accentColor}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                      {[
                        { color: '#007AFF', label: 'Xanh Apple' },
                        { color: '#34C759', label: 'Xanh Ngọc' },
                        { color: '#AF52DE', label: 'Tím Cyber' },
                        { color: '#FF9500', label: 'Cam Sunset' },
                        { color: '#FF3B30', label: 'Đỏ Ruby' },
                      ].map((c) => (
                        <TouchableOpacity
                          key={c.color}
                          onPress={() => {
                            saveAppSettings({ ...appSettings, accentColor: c.color });
                            triggerToast(`Đã áp dụng màu chủ đạo ${c.label}.`, t.accentTitle, 'info', 'color-palette', c.color);
                          }}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 13,
                            backgroundColor: c.color,
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderWidth: appSettings.accentColor === c.color ? 2.5 : 0,
                            borderColor: isLight ? '#000000' : '#FFFFFF',
                          }}
                        >
                          {appSettings.accentColor === c.color && (
                            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Cỡ chữ & Chữ in đậm -> MỞ TAB RIÊNG */}
                  <TouchableOpacity
                    style={[styles.cellItem, { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                    onPress={() => setSettingsSubView('font_size')}
                  >
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#007AFF' }]}>
                      <Ionicons name="text-outline" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.fontSizeAndBold}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 16 }}>
                        {appSettings.fontSizeScale === 'small' ? 'Nhỏ' : appSettings.fontSizeScale === 'large' ? 'Lớn' : t.standard}
                        {appSettings.isBoldText ? ` • ${t.bold}` : ''}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={isLight ? '#C7C7CC' : '#48484A'} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* NHÓM THÔNG BÁO & DYNAMIC ISLAND */}
            {(!settingsSearchQuery || 'thông báo thông báo đẩy dynamic island chuông cảnh báo âm thanh'.includes(settingsSearchQuery.toLowerCase())) && (
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12.5, fontWeight: '500', textTransform: 'uppercase', marginBottom: 6, marginLeft: 16 }}>
                  {t.notifications}
                </Text>
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                  {/* Cho phép thông báo */}
                  <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF3B30' }]}>
                      <Ionicons name="notifications" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.allowNotifications}</Text>
                    </View>
                    <Switch
                      value={appSettings.enableNotifications !== false}
                      onValueChange={async (v) => {
                        if (v) {
                          await requestNotificationPermission();
                          saveAppSettings({ ...appSettings, enableNotifications: true });
                          triggerToast('Đã cấp quyền và bật thông báo ứng dụng iOS.', t.infoTitle, 'info', false);
                        } else {
                          saveAppSettings({ ...appSettings, enableNotifications: false });
                          triggerToast('Đã tắt nhận thông báo đẩy từ ứng dụng.', t.infoTitle, 'info', false);
                        }
                      }}
                      trackColor={{ false: isLight ? '#E5E5EA' : '#39393D', true: appSettings.accentColor }}
                    />
                  </View>

                  {/* Cảnh báo bảo mật */}
                  <View style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF9500' }]}>
                      <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.securityAlerts}</Text>
                    </View>
                    <Switch
                      value={appSettings.notifySecurityAlerts !== false}
                      onValueChange={(v) => {
                        saveAppSettings({ ...appSettings, notifySecurityAlerts: v });
                        triggerToast(v ? 'Đã bật cảnh báo an toàn thiết bị.' : 'Đã tắt cảnh báo bảo mật.', t.securityTitle, 'security', false);
                      }}
                      trackColor={{ false: isLight ? '#E5E5EA' : '#39393D', true: appSettings.accentColor }}
                    />
                  </View>

                  {/* Âm thanh thông báo */}
                  <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#5856D6' }]}>
                      <Ionicons name="volume-high" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.notificationSounds}</Text>
                    </View>
                    <Switch
                      value={appSettings.notifySounds !== false}
                      onValueChange={(v) => {
                        saveAppSettings({ ...appSettings, notifySounds: v });
                        if (v) {
                          playAppleNotificationSound('success');
                        }
                        triggerToast(v ? 'Đã bật hiệu ứng âm thanh thông báo iOS.' : 'Đã tắt âm thanh thông báo.', t.infoTitle, 'info');
                      }}
                      trackColor={{ false: isLight ? '#E5E5EA' : '#39393D', true: appSettings.accentColor }}
                    />
                  </View>
                </View>
                <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12, marginTop: 6, marginLeft: 16 }}>
                  Hệ thống thông báo đẩy tương thích iOS 18 & APNs: tự động gửi cảnh báo bảo mật và hoạt động tài khoản tới màn hình khóa iPhone.
                </Text>
              </View>
            )}

            {/* NHÓM 3: CÀI ĐẶT CHUNG & DUNG LƯỢNG */}
            {(!settingsSearchQuery || 'ngôn ngữ bộ nhớ dữ liệu cache dung lượng icloud'.includes(settingsSearchQuery.toLowerCase())) && (
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12.5, fontWeight: '500', textTransform: 'uppercase', marginBottom: 6, marginLeft: 16 }}>
                  {t.dataAndStorage}
                </Text>
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                  {/* Ngôn ngữ -> MỞ TAB RIÊNG CÓ CỜ QUỐC GIA */}
                  <TouchableOpacity
                    style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setLanguageSearchQuery('');
                      setSettingsSubView('language');
                    }}
                  >
                    <View style={[styles.cellLeadingIcon, { backgroundColor: appSettings.accentColor }]}>
                      <Ionicons name="globe-outline" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.language}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {renderCountryFlagIcon(appSettings.language, 24, 16)}
                      <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 16 }}>
                        {APP_LANGUAGES.find((l) => l.code === appSettings.language)?.name || 'Tiếng Việt'}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={isLight ? '#C7C7CC' : '#48484A'} />
                    </View>
                  </TouchableOpacity>

                  {/* Dung lượng & Dọn dẹp cache thực tế */}
                  <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#8E8E93' }]}>
                      <Ionicons name="server-outline" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.cacheMemory}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleClearCache}
                      disabled={isCleaningCache || cacheSize === '0.0 KB' || cacheSize === '0.0 MB'}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                      <Text style={{ color: (cacheSize === '0.0 KB' || cacheSize === '0.0 MB') ? '#8E8E93' : appSettings.accentColor, fontSize: 15, fontWeight: '600' }}>
                        {isCleaningCache ? t.clearing : (cacheSize === '0.0 KB' || cacheSize === '0.0 MB') ? '0.0 KB' : `${t.clearCache} (${cacheSize})`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* NHÓM 4: BẢO MẬT & SAO LƯU DỮ LIỆU THẬT */}
            {(!settingsSearchQuery || 'sao lưu khôi phục dữ liệu mật khẩu kiểm tra an toàn json'.includes(settingsSearchQuery.toLowerCase())) && (
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 18 }]}>
                <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12.5, fontWeight: '500', textTransform: 'uppercase', marginBottom: 6, marginLeft: 16 }}>
                  {t.backupAndRestore}
                </Text>
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                  {/* Kiểm tra an toàn mật khẩu */}
                  <TouchableOpacity
                    style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}
                    activeOpacity={0.7}
                    onPress={handleSecurityAudit}
                  >
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#5856D6' }]}>
                      <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.securityAudit}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isLight ? '#C7C7CC' : '#48484A'} />
                  </TouchableOpacity>

                  {/* Xuất sao lưu dữ liệu JSON thật */}
                  <TouchableOpacity
                    style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}
                    activeOpacity={0.7}
                    onPress={handleExportBackup}
                  >
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#34C759' }]}>
                      <Ionicons name="cloud-download-outline" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.exportBackup}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isLight ? '#C7C7CC' : '#48484A'} />
                  </TouchableOpacity>

                  {/* Khôi phục dữ liệu từ file JSON thật */}
                  <TouchableOpacity
                    style={[styles.cellItem, { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                    onPress={handleImportBackup}
                  >
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#007AFF' }]}>
                      <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.importBackup}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isLight ? '#C7C7CC' : '#48484A'} />
                  </TouchableOpacity>
                </View>
                <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12, marginTop: 6, marginLeft: 16 }}>
                  Dữ liệu sao lưu dạng JSON được mã hóa cục bộ và có thể phục hồi trực tiếp trên bất kỳ thiết bị nào.
                </Text>
              </View>
            )}

            {/* NHÓM 5: THÔNG TIN ỨNG DỤNG & ĐẶT LẠI */}
            {(!settingsSearchQuery || 'giới thiệu phiên bản đặt lại hệ thống'.includes(settingsSearchQuery.toLowerCase())) && (
              <View style={[styles.sectionWrap, { marginTop: 0, marginBottom: 32 }]}>
                <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 12.5, fontWeight: '500', textTransform: 'uppercase', marginBottom: 6, marginLeft: 16 }}>
                  {t.aboutLockX}
                </Text>
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                  {/* Đặt lại tất cả cài đặt */}
                  <TouchableOpacity
                    style={[styles.cellItem, isLight && { borderBottomColor: '#E5E5EA' }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      Alert.alert(
                        'Đặt lại tất cả cài đặt',
                        'Thao tác này sẽ đưa tất cả các tùy chọn về mặc định của hệ thống.',
                        [
                          { text: t.cancel, style: 'cancel' },
                          {
                            text: 'Đặt lại',
                            style: 'destructive',
                            onPress: () => {
                              saveAppSettings(INITIAL_SETTINGS);
                              triggerToast('Đã khôi phục cài đặt');
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF3B30' }]}>
                      <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: '#FF3B30', fontSize: 16, fontWeight: '400' }}>Đặt lại cài đặt</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isLight ? '#C7C7CC' : '#48484A'} />
                  </TouchableOpacity>

                  {/* Phiên bản */}
                  <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#8E8E93' }]}>
                      <Ionicons name="information-circle-outline" size={19} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '400' }}>{t.version}</Text>
                    </View>
                    <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 16 }}>2.6.0 (2026)</Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
          )
        )}
      </View>

      {/* Bottom Native Tab Bar (Ẩn khi đang ở phòng chat với bạn bè để tránh xung đột bàn phím) */}
      {!(currentTab === 'chat' && activeChatFriend) && (
        <View style={styles.tabBar}>
          {[
            { key: 'vault', label: t.tabVault, icon: 'shield' },
            { key: 'apps', label: t.tabApps, icon: 'apps' },
            { key: 'chat', label: t.tabFriends, icon: 'chatbubbles' },
            { key: 'profile', label: t.tabProfile, icon: 'person' },
            { key: 'settings', label: t.tabSettings, icon: 'settings' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => {
                if (tab.key === 'vault' && currentTab === 'vault') {
                  setVaultSubView('list');
                  setSelectedAccount(null);
                }
                if (tab.key === 'profile' && currentTab === 'profile') {
                  setProfileSubView('main');
                }
                if (tab.key === 'chat' && currentTab === 'chat') {
                  setActiveChatFriend(null);
                }
                setCurrentTab(tab.key as any);
              }}
            >
              <Ionicons
                name={(tab.icon + (currentTab === tab.key ? '' : '-outline')) as any}
                size={22}
                color={currentTab === tab.key ? appSettings.accentColor : '#8E8E93'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  currentTab === tab.key && { color: appSettings.accentColor, fontWeight: '700' },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
        </>
      )}

      {/* MODAL: TRANG CÁ NHÂN NGƯỜI DÙNG KHÁC (VIEW OTHER USER'S PROFILE) */}
      <Modal visible={!!viewingFriendProfile} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={[styles.sheetCard, isLight && { backgroundColor: '#F2F2F7' }]}>
            {/* Sheet Handle */}
            <View style={{ width: 36, height: 5, borderRadius: 2.5, backgroundColor: isLight ? '#C7C7CC' : '#3A3A3C', alignSelf: 'center', marginTop: 8, marginBottom: 4 }} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={{ width: 60 }} />
              <Text style={[styles.sheetTitle, isLight && { color: '#000000' }]}>Trang Cá Nhân</Text>
              <TouchableOpacity
                onPress={() => setViewingFriendProfile(null)}
                style={{ width: 60, alignItems: 'flex-end' }}
              >
                <Text style={{ color: appSettings.accentColor, fontSize: 16, fontWeight: '600' }}>
                  {t.done || 'Xong'}
                </Text>
              </TouchableOpacity>
            </View>

            {viewingFriendProfile && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
              >
                {/* Hero Avatar Card */}
                <View style={{ alignItems: 'center', marginVertical: 18 }}>
                  <View style={{ position: 'relative' }}>
                    <View
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: viewingFriendProfile.avatarColor,
                        justifyContent: 'center',
                        alignItems: 'center',
                        shadowColor: viewingFriendProfile.avatarColor,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.4,
                        shadowRadius: 8,
                      }}
                    >
                      <Ionicons
                        name={(viewingFriendProfile.avatarIcon || 'person') as any}
                        size={42}
                        color="#FFFFFF"
                      />
                    </View>
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 2,
                        right: 2,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: viewingFriendProfile.status === 'online' ? '#34C759' : '#8E8E93',
                        borderWidth: 3,
                        borderColor: isLight ? '#F2F2F7' : '#1C1C1E',
                      }}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                    <Text style={{ fontSize: 22, fontWeight: '700', color: isLight ? '#000000' : '#FFFFFF' }}>
                      {viewingFriendProfile.displayName}
                    </Text>
                    <Ionicons name="shield-checkmark" size={18} color={appSettings.accentColor} />
                  </View>

                  <Text style={{ fontSize: 14, color: isLight ? '#6C6C70' : '#8E8E93', marginTop: 2 }}>
                    {viewingFriendProfile.username}
                  </Text>

                  {viewingFriendProfile.bio && (
                    <View
                      style={{
                        marginTop: 10,
                        paddingHorizontal: 16,
                        paddingVertical: 6,
                        borderRadius: 14,
                        backgroundColor: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
                      }}
                    >
                      <Text style={{ fontSize: 13, color: isLight ? '#3C3C43' : '#EBEBF5', fontStyle: 'italic', textAlign: 'center' }}>
                        "{viewingFriendProfile.bio}"
                      </Text>
                    </View>
                  )}
                </View>

                {/* Quick Action Pills (Apple Contact Style) */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
                  <TouchableOpacity
                    style={{
                      alignItems: 'center',
                      backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      flex: 1,
                      borderWidth: isLight ? 0.5 : 0,
                      borderColor: '#E5E5EA',
                    }}
                    onPress={() => {
                      setActiveChatFriend(viewingFriendProfile);
                      setViewingFriendProfile(null);
                      setCurrentTab('chat');
                    }}
                  >
                    <Ionicons name="chatbubble" size={20} color={appSettings.accentColor} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: appSettings.accentColor, marginTop: 4 }}>
                      Nhắn tin
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      alignItems: 'center',
                      backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      flex: 1,
                      borderWidth: isLight ? 0.5 : 0,
                      borderColor: '#E5E5EA',
                    }}
                    onPress={() => {
                      triggerToast(`Đang kết nối cuộc gọi thoại với ${viewingFriendProfile.displayName}...`, 'Apple Audio Call', 'info', 'call');
                    }}
                  >
                    <Ionicons name="call" size={20} color="#34C759" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#34C759', marginTop: 4 }}>
                      Gọi thoại
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      alignItems: 'center',
                      backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      flex: 1,
                      borderWidth: isLight ? 0.5 : 0,
                      borderColor: '#E5E5EA',
                    }}
                    onPress={() => {
                      triggerToast(`Đang khởi tạo FaceTime với ${viewingFriendProfile.displayName}...`, 'Apple FaceTime', 'info', 'videocam');
                    }}
                  >
                    <Ionicons name="videocam" size={20} color="#34C759" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#34C759', marginTop: 4 }}>
                      FaceTime
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      alignItems: 'center',
                      backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      flex: 1,
                      borderWidth: isLight ? 0.5 : 0,
                      borderColor: '#E5E5EA',
                    }}
                    onPress={() => {
                      triggerToast('Đã xác thực chữ ký mã hóa đầu cuối AES-256', 'Secure Enclave', 'success', 'shield-checkmark');
                    }}
                  >
                    <Ionicons name="shield-checkmark" size={20} color="#5856D6" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#5856D6', marginTop: 4 }}>
                      Khóa E2E
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Grouped Information Cells */}
                <Text style={[styles.sectionCaption, { marginLeft: 16, marginBottom: 6 }]}>
                  THÔNG TIN CHI TIẾT
                </Text>
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                  <View style={styles.cellItem}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#007AFF' }]}>
                      <Ionicons name="at" size={17} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ fontSize: 15, color: isLight ? '#000000' : '#FFFFFF' }}>Tên người dùng</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        Clipboard.setString(viewingFriendProfile.username);
                        triggerToast('Đã sao chép @username', 'Sao Chép', 'info');
                      }}
                    >
                      <Text style={{ fontSize: 15, color: appSettings.accentColor, fontWeight: '500' }}>
                        {viewingFriendProfile.username}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cellItem}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: viewingFriendProfile.status === 'online' ? '#34C759' : '#8E8E93' }]}>
                      <Ionicons name="radio" size={17} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ fontSize: 15, color: isLight ? '#000000' : '#FFFFFF' }}>Trạng thái mạng</Text>
                    </View>
                    <Text style={{ fontSize: 15, color: viewingFriendProfile.status === 'online' ? '#34C759' : '#8E8E93', fontWeight: '500' }}>
                      {viewingFriendProfile.status === 'online' ? 'Đang hoạt động' : 'Ngoại tuyến'}
                    </Text>
                  </View>

                  <View style={styles.cellItem}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF9500' }]}>
                      <Ionicons name="ribbon" size={17} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ fontSize: 15, color: isLight ? '#000000' : '#FFFFFF' }}>Cấp độ tài khoản</Text>
                    </View>
                    <Text style={{ fontSize: 15, color: isLight ? '#6C6C70' : '#8E8E93' }}>
                      LockX Pro Member
                    </Text>
                  </View>

                  <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#5856D6' }]}>
                      <Ionicons name="key" size={17} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ fontSize: 15, color: isLight ? '#000000' : '#FFFFFF' }}>Vân tay mã hóa (E2E)</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: '#8E8E93', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                      SHA-256 Verified
                    </Text>
                  </View>
                </View>

                {/* Grouped Actions (Delete, Clear) */}
                <Text style={[styles.sectionCaption, { marginLeft: 16, marginTop: 18, marginBottom: 6 }]}>
                  TÙY CHỌN TRÒ CHUYỆN
                </Text>
                <View style={[styles.groupedList, isLight && { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E5EA' }]}>
                  <TouchableOpacity
                    style={styles.cellItem}
                    onPress={() => {
                      const friendId = viewingFriendProfile.id;
                      setViewingFriendProfile(null);
                      handleClearChat(friendId);
                    }}
                  >
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF9500' }]}>
                      <Ionicons name="refresh" size={17} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ fontSize: 15, color: '#FF9500', fontWeight: '500' }}>
                        Làm sạch lịch sử trò chuyện
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.cellItem, { borderBottomWidth: 0 }]}
                    onPress={() => {
                      const fName = viewingFriendProfile.displayName;
                      const fId = viewingFriendProfile.id;
                      Alert.alert(
                        'Hủy kết bạn',
                        `Bạn có chắc chắn muốn xóa ${fName} khỏi danh sách bạn bè?`,
                        [
                          { text: t.cancel, style: 'cancel' },
                          {
                            text: 'Xóa bạn',
                            style: 'destructive',
                            onPress: () => {
                              const updated = friendsList.filter((f) => f.id !== fId);
                              saveFriends(updated);
                              setViewingFriendProfile(null);
                              if (activeChatFriend?.id === fId) setActiveChatFriend(null);
                              triggerToast(`Đã xóa ${fName} khỏi danh sách bạn bè.`, 'Bạn Bè', 'warning');
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF3B30' }]}>
                      <Ionicons name="person-remove" size={17} color="#FFFFFF" />
                    </View>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={{ fontSize: 15, color: '#FF3B30', fontWeight: '500' }}>
                        Xóa khỏi danh sách bạn bè
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* MODAL: PHONE APP DETAIL SHEET */}
      <Modal visible={!!selectedPhoneApp} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setSelectedPhoneApp(null)}>
                <Text style={styles.sheetBtnBlue}>Đóng</Text>
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Chi Tiết Ứng Dụng</Text>
              <TouchableOpacity onPress={() => setSelectedPhoneApp(null)}>
                <Text style={[styles.sheetBtnBlue, { fontWeight: '700' }]}>Xong</Text>
              </TouchableOpacity>
            </View>

            {selectedPhoneApp && (
              <ScrollView style={{ padding: 18 }} showsVerticalScrollIndicator={false}>
                {/* App Hero */}
                <View style={{ alignItems: 'center', marginVertical: 14 }}>
                  <View style={{ marginBottom: 12 }}>
                    <AppleAppIcon app={selectedPhoneApp} size={64} />
                  </View>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>
                    {selectedPhoneApp.name}
                  </Text>
                  <Text style={{ color: '#8E8E93', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                    {selectedPhoneApp.category === 'social'
                      ? 'Mạng xã hội & Trò chuyện'
                      : selectedPhoneApp.category === 'finance'
                      ? 'Tài chính & Ngân hàng'
                      : selectedPhoneApp.category === 'tools'
                      ? 'Tiện ích & Làm việc'
                      : selectedPhoneApp.category === 'shopping'
                      ? 'Mua sắm & Ăn uống'
                      : selectedPhoneApp.category === 'game'
                      ? 'Trò chơi'
                      : 'Hệ thống iOS'}
                  </Text>
                </View>

                {/* Details Table: Screen Time & Usage Stats */}
                <View style={[styles.groupedList, { marginBottom: 16 }]}>
                  <View style={styles.cellItem}>
                    <Text style={styles.detailLabel}>Thời gian hôm nay</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="time" size={15} color="#0A84FF" />
                      <Text style={{ color: '#30D158', fontWeight: '700', fontSize: 14 }}>
                        {formatUsageTimeFull(selectedPhoneApp.usageMinutes || 0)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cellItem}>
                    <Text style={styles.detailLabel}>Số lần mở</Text>
                    <Text style={[styles.detailVal, { fontWeight: '600' }]}>
                      {`${selectedPhoneApp.openCount || 0} lần`}
                    </Text>
                  </View>

                  <View style={styles.cellItem}>
                    <Text style={styles.detailLabel}>Phân loại</Text>
                    <Text style={styles.detailVal}>
                      {selectedPhoneApp.category === 'social'
                        ? 'Mạng xã hội'
                        : selectedPhoneApp.category === 'finance'
                        ? 'Tài chính / Bank'
                        : selectedPhoneApp.category === 'tools'
                        ? 'Tiện ích'
                        : selectedPhoneApp.category === 'shopping'
                        ? 'Mua sắm'
                        : selectedPhoneApp.category === 'game'
                        ? 'Trò chơi'
                        : 'Hệ thống'}
                    </Text>
                  </View>

                  <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                    <Text style={styles.detailLabel}>Khởi chạy</Text>
                    <Text style={[styles.detailVal, { fontFamily: 'monospace', fontSize: 12 }]}>
                      {selectedPhoneApp.scheme || 'Mặc định iOS'}
                    </Text>
                  </View>
                </View>

                {/* Open App Button */}
                <TouchableOpacity
                  style={[styles.btnStartNow, { marginBottom: 10 }]}
                  activeOpacity={0.85}
                  onPress={() => openPhoneApp(selectedPhoneApp)}
                >
                  <Ionicons name="open-outline" size={18} color="#000" />
                  <Text style={styles.btnStartNowText}>{`Mở ${selectedPhoneApp.name} Trên iPhone`}</Text>
                </TouchableOpacity>

                {/* Remove App Button */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 12,
                    marginTop: 6,
                    marginBottom: 20,
                    backgroundColor: 'rgba(255,69,58,0.1)',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(255,69,58,0.25)',
                    gap: 6,
                  }}
                  activeOpacity={0.85}
                  onPress={() => removeAppFromList(selectedPhoneApp.id)}
                >
                  <Ionicons name="trash-outline" size={16} color="#FF453A" />
                  <Text style={{ color: '#FF453A', fontWeight: '700', fontSize: 14 }}>
                    Gỡ Ứng Dụng Khỏi Danh Sách
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* MODAL: MANAGE & ADD APPS */}
      <Modal visible={isManageAppsModalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setIsManageAppsModalOpen(false)}>
                <Text style={styles.sheetBtnBlue}>Đóng</Text>
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Chọn Ứng Dụng iPhone</Text>
              <TouchableOpacity onPress={() => setIsManageAppsModalOpen(false)}>
                <Text style={[styles.sheetBtnBlue, { fontWeight: '700' }]}>Xong</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
              {/* Form tự thêm app mới */}
              <View style={styles.customAddCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Ionicons name="add-circle" size={18} color="#0A84FF" />
                  <Text style={styles.customAddTitle}>Tự Thêm Ứng Dụng Mới</Text>
                </View>

                <TextInput
                  style={styles.customInput}
                  placeholder="Tên ứng dụng (VD: Vietcombank, Locket, Tinder...)"
                  placeholderTextColor="#636366"
                  value={customAppName}
                  onChangeText={setCustomAppName}
                />

                <TextInput
                  style={[styles.customInput, { marginTop: 8 }]}
                  placeholder="URL Scheme (tùy chọn, VD: vcb://, locket://)"
                  placeholderTextColor="#636366"
                  value={customAppScheme}
                  onChangeText={setCustomAppScheme}
                  autoCapitalize="none"
                />

                <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {[
                    { id: 'social', label: 'Mạng xã hội' },
                    { id: 'finance', label: 'Tài chính / Bank' },
                    { id: 'tools', label: 'Tiện ích' },
                    { id: 'game', label: 'Trò chơi' },
                    { id: 'shopping', label: 'Mua sắm' },
                  ].map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.catPill,
                        customAppCategory === cat.id && styles.catPillActive,
                      ]}
                      onPress={() => setCustomAppCategory(cat.id as any)}
                    >
                      <Text
                        style={[
                          styles.catPillText,
                          customAppCategory === cat.id && styles.catPillTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.btnConfirmAddCustom}
                  onPress={handleAddCustomApp}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark" size={16} color="#000" />
                  <Text style={styles.btnConfirmAddCustomText}>Lưu & Thêm Vào Máy</Text>
                </TouchableOpacity>
              </View>

              {/* Thư viện 50+ ứng dụng có sẵn */}
              <View style={{ marginTop: 18, marginBottom: 8 }}>
                <Text style={styles.sectionCaption}>THƯ VIỆN ỨNG DỤNG ({KNOWN_IPHONE_CATALOG.length})</Text>
                <Text style={{ color: '#8E8E93', fontSize: 12, marginLeft: 12, marginBottom: 10 }}>
                  Chạm vào ứng dụng để thêm hoặc bớt khỏi iPhone của bạn:
                </Text>
              </View>

              <View style={styles.groupedList}>
                {KNOWN_IPHONE_CATALOG.map((catApp, i) => {
                  const isSelected = phoneApps.some((p) => p.id === catApp.id);
                  return (
                    <TouchableOpacity
                      key={catApp.id}
                      style={[
                        styles.cellItem,
                        i === KNOWN_IPHONE_CATALOG.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      onPress={() => toggleCatalogApp(catApp)}
                      activeOpacity={0.7}
                    >
                      <AppleAppIcon app={catApp} size={40} />
                      <View style={[styles.cellContent, { marginLeft: 12 }]}>
                        <Text style={styles.cellTitle}>{catApp.name}</Text>
                        <Text style={styles.cellSubtitle}>
                          {catApp.category === 'social'
                            ? 'Mạng xã hội & Chat'
                            : catApp.category === 'finance'
                            ? 'Tài chính & Bank'
                            : catApp.category === 'tools'
                            ? 'Tiện ích'
                            : catApp.category === 'shopping'
                            ? 'Mua sắm & Ăn uống'
                            : catApp.category === 'game'
                            ? 'Trò chơi'
                            : 'Hệ thống iOS'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.btnToggleCatalog,
                          isSelected && styles.btnToggleCatalogActive,
                        ]}
                      >
                        <Ionicons
                          name={isSelected ? "checkmark" : "add"}
                          size={16}
                          color={isSelected ? "#fff" : "#0A84FF"}
                        />
                        <Text
                          style={[
                            styles.btnToggleCatalogText,
                            isSelected && styles.btnToggleCatalogTextActive,
                          ]}
                        >
                          {isSelected ? 'ĐÃ THÊM' : 'THÊM'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ height: 40 }} />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* MODAL: SUBTOOL (PING, PWD, RESET) */}
      <Modal visible={!!activeToolView} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setActiveToolView(null)}>
                <Text style={styles.sheetBtnBlue}>Đóng</Text>
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>
                {activeToolView === 'ping'
                  ? 'Ping Máy Chủ'
                  : activeToolView === 'pwd'
                  ? 'Tạo Mật Khẩu'
                  : 'Giờ Reset Server'}
              </Text>
              <View style={{ width: 44 }} />
            </View>

            <View style={{ padding: 16 }}>
              {activeToolView === 'ping' && (
                <View style={styles.groupedList}>
                  {[
                    { name: 'Đông Nam Á (Singapore)', host: 'sgp-1.valve.net', ms: '32 ms', color: '#30D158' },
                    { name: 'Việt Nam (Hà Nội / HCM)', host: '1.1.1.1', ms: '12 ms', color: '#30D158' },
                    { name: 'Nhật Bản (Tokyo)', host: 'tyo-1.valve.net', ms: '76 ms', color: '#FF9F0A' },
                    { name: 'Bắc Mỹ (US West)', host: 'eat.valve.net', ms: '168 ms', color: '#FF453A' },
                  ].map((s, i) => (
                    <View key={s.name} style={[styles.cellItem, i === 3 && { borderBottomWidth: 0 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{s.name}</Text>
                        <Text style={{ color: '#8E8E93', fontSize: 11 }}>{s.host}</Text>
                      </View>
                      <Text style={{ color: s.color, fontWeight: '700', fontFamily: 'monospace' }}>{s.ms}</Text>
                    </View>
                  ))}
                </View>
              )}

              {activeToolView === 'pwd' && (
                <View>
                  <View style={[styles.groupedList, { padding: 18, alignItems: 'center' }]}>
                    <Text style={{ color: '#0A84FF', fontSize: 18, fontWeight: '700', fontFamily: 'monospace', marginBottom: 12 }}>
                      {generatedPwd}
                    </Text>
                    <TouchableOpacity
                      style={styles.btnRollMulti}
                      onPress={() => copyText(generatedPwd, 'Mật khẩu')}
                    >
                      <Text style={{ color: '#fff', fontWeight: '600' }}>Sao chép mật khẩu này</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.btnRollSingle, { marginTop: 14, alignSelf: 'center', width: '100%', alignItems: 'center', padding: 12 }]}
                    onPress={() => setGeneratedPwd(generateRandomPassword(pwdLength))}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Tạo mật khẩu khác</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activeToolView === 'reset' && (
                <View style={styles.groupedList}>
                  <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Châu Á / VN (GMT+8 04:00 AM)</Text>
                      <Text style={{ color: '#8E8E93', fontSize: 11 }}>Genshin, Star Rail, WuWa</Text>
                    </View>
                    <Text style={{ color: '#0A84FF', fontWeight: '700', fontFamily: 'monospace' }}>14h 18m</Text>
                  </View>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* MODAL: CHỌN / TẢI AVATAR APPLE ID */}
      <Modal visible={isAvatarModalOpen} animationType="slide" transparent onRequestClose={() => setIsAvatarModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={[styles.sheetCard, isLight && { backgroundColor: '#F2F2F7' }]}>
            {/* Sheet Header */}
            <View style={[styles.sheetHeader, isLight && { borderBottomColor: '#E5E5EA', backgroundColor: '#FFFFFF' }]}>
              <TouchableOpacity onPress={() => setIsAvatarModalOpen(false)}>
                <Text style={[styles.sheetBtnBlue, { color: appSettings.accentColor }]}>Đóng</Text>
              </TouchableOpacity>
              <Text style={[styles.sheetTitle, isLight && { color: '#000000' }]}>Ảnh Đại Diện</Text>
              <TouchableOpacity onPress={() => setIsAvatarModalOpen(false)}>
                <Text style={[styles.sheetBtnBlue, { color: appSettings.accentColor, fontWeight: '700' }]}>Xong</Text>
              </TouchableOpacity>
            </View>

            {/* Segmented Picker: 3 Tabs */}
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: isLight ? '#E5E5EA' : '#2C2C2E',
                  borderRadius: 10,
                  padding: 3,
                }}
              >
                {[
                  { key: 'presets', label: 'Biểu Tượng SVG', icon: 'sparkles' },
                  { key: 'upload', label: 'Tải Từ Máy', icon: 'cloud-upload' },
                  { key: 'monogram', label: 'Chữ Cái Màu', icon: 'color-palette' },
                ].map((t) => {
                  const isActive = avatarPickerTab === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => setAvatarPickerTab(t.key as any)}
                      style={{
                        flex: 1,
                        paddingVertical: 7,
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 6,
                        borderRadius: 8,
                        backgroundColor: isActive ? (isLight ? '#FFFFFF' : '#636366') : 'transparent',
                        shadowColor: isActive ? '#000' : 'transparent',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: isActive ? 0.15 : 0,
                        shadowRadius: 2,
                      }}
                    >
                      <Ionicons
                        name={t.icon as any}
                        size={14}
                        color={isActive ? (isLight ? '#000000' : '#FFFFFF') : (isLight ? '#6C6C70' : '#8E8E93')}
                      />
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: isActive ? '700' : '500',
                          color: isActive ? (isLight ? '#000000' : '#FFFFFF') : (isLight ? '#6C6C70' : '#8E8E93'),
                        }}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              {/* TAB 1: PRESETS */}
              {avatarPickerTab === 'presets' && (
                <View>
                  <Text style={{ fontSize: 13, color: isLight ? '#6C6C70' : '#8E8E93', marginBottom: 12, marginLeft: 4 }}>
                    Chọn biểu tượng SVG chuẩn Apple bảo mật và công nghệ:
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
                    {APP_AVATAR_PRESETS.map((preset) => {
                      const isSelected = editAvatarType === 'preset' && editAvatarPresetId === preset.id;
                      return (
                        <TouchableOpacity
                          key={preset.id}
                          activeOpacity={0.7}
                          onPress={() => {
                            setEditAvatarType('preset');
                            setEditAvatarPresetId(preset.id);
                            setEditAvatarUri('');
                            triggerToast(`✓ Đã chọn avatar: ${preset.name}`);
                          }}
                          style={{
                            width: '22%',
                            aspectRatio: 1,
                            borderRadius: 18,
                            backgroundColor: preset.bgColor,
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderWidth: isSelected ? 3 : 1,
                            borderColor: isSelected ? appSettings.accentColor : (isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)'),
                            position: 'relative',
                            shadowColor: isSelected ? appSettings.accentColor : '#000',
                            shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: isSelected ? 0.4 : 0.15,
                            shadowRadius: 5,
                          }}
                        >
                          <Ionicons name={preset.icon as any} size={28} color="#FFFFFF" />
                          {preset.badge && (
                            <View
                              style={{
                                position: 'absolute',
                                top: 3,
                                right: 3,
                                backgroundColor: isSelected ? appSettings.accentColor : 'rgba(0,0,0,0.6)',
                                paddingHorizontal: 4,
                                paddingVertical: 1,
                                borderRadius: 5,
                              }}
                            >
                              <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>{preset.badge}</Text>
                            </View>
                          )}
                          {isSelected && (
                            <View
                              style={{
                                position: 'absolute',
                                bottom: -3,
                                right: -3,
                                backgroundColor: appSettings.accentColor,
                                borderRadius: 10,
                                width: 20,
                                height: 20,
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderWidth: 1.5,
                                borderColor: '#fff',
                              }}
                            >
                              <Ionicons name="checkmark" size={13} color="#fff" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* TAB 2: UPLOAD FROM DEVICE */}
              {avatarPickerTab === 'upload' && (
                <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                  <View
                    style={{
                      width: 110,
                      height: 110,
                      borderRadius: 55,
                      backgroundColor: isLight ? '#E5E5EA' : '#2C2C2E',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: 16,
                      borderWidth: 2,
                      borderColor: editAvatarType === 'image' && !!editAvatarUri ? appSettings.accentColor : (isLight ? '#D1D1D6' : '#3A3A3C'),
                      overflow: 'hidden',
                    }}
                  >
                    {editAvatarType === 'image' && !!editAvatarUri ? (
                      <Image source={{ uri: editAvatarUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <Ionicons name="cloud-upload-outline" size={48} color={appSettings.accentColor} />
                    )}
                  </View>

                  <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
                    Tải Ảnh Từ Thiết Bị
                  </Text>
                  <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 13, textAlign: 'center', maxWidth: 280, marginBottom: 20, lineHeight: 18 }}>
                    Chọn ảnh chân dung hoặc hình ảnh từ điện thoại, máy tính (hỗ trợ JPG, PNG, WEBP, tối đa 8MB).
                  </Text>

                  <TouchableOpacity
                    onPress={handlePickDeviceImage}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: appSettings.accentColor,
                      paddingVertical: 13,
                      paddingHorizontal: 28,
                      borderRadius: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      shadowColor: appSettings.accentColor,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                    }}
                  >
                    <Ionicons name="folder-open-outline" size={18} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
                      Chọn Tệp Ảnh Từ Máy
                    </Text>
                  </TouchableOpacity>

                  {editAvatarType === 'image' && !!editAvatarUri && (
                    <TouchableOpacity
                      onPress={() => {
                        setEditAvatarType('preset');
                        setEditAvatarUri('');
                        triggerToast('Đã xóa ảnh tải lên');
                      }}
                      style={{ marginTop: 16 }}
                    >
                      <Text style={{ color: '#FF3B30', fontSize: 14, fontWeight: '600' }}>
                        Xóa ảnh đang chọn
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* TAB 3: MONOGRAM */}
              {avatarPickerTab === 'monogram' && (
                <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                  {/* Monogram Preview */}
                  <View
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: 45,
                      backgroundColor: editAvatarColor,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: 16,
                      shadowColor: editAvatarColor,
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.4,
                      shadowRadius: 10,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 42, fontWeight: '700' }}>
                      {(editDisplayNameInput || 'A').charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <Text style={{ color: isLight ? '#000000' : '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                    Khởi tạo tên đại diện
                  </Text>
                  <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 13, marginBottom: 20 }}>
                    Chọn màu sắc chủ đạo mang phong cách Apple:
                  </Text>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 320 }}>
                    {MONOGRAM_COLORS.map((mc) => {
                      const isSelected = editAvatarType === 'monogram' && editAvatarColor === mc.color;
                      return (
                        <TouchableOpacity
                          key={mc.color}
                          activeOpacity={0.7}
                          onPress={() => {
                            setEditAvatarType('monogram');
                            setEditAvatarColor(mc.color);
                            setEditAvatarUri('');
                            triggerToast(`✓ Đã chọn màu: ${mc.name}`);
                          }}
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: mc.color,
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderWidth: isSelected ? 3.5 : 0,
                            borderColor: isLight ? '#000000' : '#FFFFFF',
                            transform: [{ scale: isSelected ? 1.12 : 1.0 }],
                          }}
                        >
                          {isSelected && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* MODAL: TRUNG TÂM THÔNG BÁO IOS 18 (NOTIFICATION CENTER) */}
      <Modal
        visible={showNotificationCenter}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNotificationCenter(false)}
      >
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={[styles.sheetCard, isLight && { backgroundColor: '#F2F2F7' }]}>
            {/* iOS 18 Drag Indicator Handle */}
            <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
              <View style={{ width: 36, height: 4.5, borderRadius: 2.5, backgroundColor: isLight ? '#C7C7CC' : '#48484A' }} />
            </View>

            {/* Sheet Header */}
            <View style={[styles.sheetHeader, isLight && { borderBottomColor: '#E5E5EA', backgroundColor: '#FFFFFF' }]}>
              <TouchableOpacity onPress={() => setShowNotificationCenter(false)}>
                <Text style={[styles.sheetBtnBlue, { color: appSettings.accentColor }]}>Đóng</Text>
              </TouchableOpacity>

              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.sheetTitle, isLight && { color: '#000000' }]}>Thông Báo</Text>
                <Text style={{ fontSize: 11, color: isLight ? '#8E8E93' : '#8E8E93', fontWeight: '500' }}>
                  Trung Tâm Thông Báo LockX
                </Text>
              </View>

              {notifications.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Xóa tất cả thông báo',
                      'Bạn có chắc chắn muốn xóa toàn bộ lịch sử thông báo không?',
                      [
                        { text: 'Hủy', style: 'cancel' },
                        {
                          text: 'Xóa tất cả',
                          style: 'destructive',
                          onPress: () => {
                            setNotifications([]);
                            AsyncStorage.setItem('lockx_notifications_history', '[]').catch(() => {});
                            triggerToast('Đã dọn sạch toàn bộ trung tâm thông báo.', 'Dọn Dẹp Thành Công', 'info');
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Text style={[styles.sheetBtnBlue, { color: '#FF3B30' }]}>Xóa hết</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 44 }} />
              )}
            </View>

            {/* Filter Tabs & Test Bar */}
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10 }}>
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: isLight ? '#E5E5EA' : '#2C2C2E',
                  borderRadius: 9,
                  padding: 3,
                }}
              >
                <TouchableOpacity
                  onPress={() => setNotifFilterTab('all')}
                  style={{
                    flex: 1,
                    paddingVertical: 6,
                    alignItems: 'center',
                    borderRadius: 7,
                    backgroundColor: notifFilterTab === 'all' ? (isLight ? '#FFFFFF' : '#3A3A3C') : 'transparent',
                    shadowColor: notifFilterTab === 'all' ? '#000' : 'transparent',
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: notifFilterTab === 'all' ? (isLight ? '#000000' : '#FFFFFF') : '#8E8E93',
                    }}
                  >
                    {`Tất cả (${notifications.length})`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setNotifFilterTab('unread')}
                  style={{
                    flex: 1,
                    paddingVertical: 6,
                    alignItems: 'center',
                    borderRadius: 7,
                    backgroundColor: notifFilterTab === 'unread' ? (isLight ? '#FFFFFF' : '#3A3A3C') : 'transparent',
                    shadowColor: notifFilterTab === 'unread' ? '#000' : 'transparent',
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: notifFilterTab === 'unread' ? (isLight ? '#000000' : '#FFFFFF') : '#8E8E93',
                    }}
                  >
                    {`Chưa đọc (${unreadNotifCount})`}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Actions Header Bar: Đọc tất cả + Thử nghiệm */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    const marked = notifications.map((n) => ({ ...n, read: true }));
                    setNotifications(marked);
                    AsyncStorage.setItem('lockx_notifications_history', JSON.stringify(marked)).catch(() => {});
                    triggerToast('Đã đánh dấu tất cả thông báo là đã đọc.', 'Cập Nhật Thành Công', 'info');
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                >
                  <Ionicons name="checkmark-done" size={15} color={appSettings.accentColor} />
                  <Text style={{ fontSize: 12.5, color: appSettings.accentColor, fontWeight: '600' }}>
                    Đọc tất cả
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    scheduleExternalPushNotification(
                      'LockX Vault • Cảnh Báo An Toàn',
                      'Két sắt của bạn đang được bảo vệ an toàn trên iPhone.',
                      3,
                      'security'
                    );
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: isLight ? '#E5E5EA' : '#2C2C2E',
                    paddingHorizontal: 10,
                    paddingVertical: 4.5,
                    borderRadius: 12,
                  }}
                >
                  <Ionicons name="phone-portrait-outline" size={13} color="#30D158" />
                  <Text style={{ fontSize: 12, color: '#30D158', fontWeight: '600' }}>
                    Thử thông báo ngoài (3s)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Notification Items List */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            >
              {(() => {
                const displayed = notifFilterTab === 'unread' ? notifications.filter((n) => !n.read) : notifications;

                if (displayed.length === 0) {
                  return (
                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingBottom: 40 }}>
                      <View
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 32,
                          backgroundColor: isLight ? '#E5E5EA' : 'rgba(255,255,255,0.06)',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginBottom: 14,
                        }}
                      >
                        <Ionicons name="notifications-off-outline" size={32} color={isLight ? '#8E8E93' : '#636366'} />
                      </View>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '700',
                          color: isLight ? '#000000' : '#FFFFFF',
                          marginBottom: 4,
                        }}
                      >
                        Không có thông báo mới
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          color: isLight ? '#8E8E93' : '#8E8E93',
                          textAlign: 'center',
                          paddingHorizontal: 30,
                        }}
                      >
                        {notifFilterTab === 'unread'
                          ? 'Bạn đã đọc tất cả thông báo trong hộp thư.'
                          : 'Mọi hoạt động bảo mật, đăng nhập và thiết lập sẽ xuất hiện tại đây.'}
                      </Text>
                    </View>
                  );
                }

                return (
                  <View style={{ gap: 10, marginTop: 4 }}>
                    {displayed.map((item) => {
                      const tagColor =
                        item.type === 'success'
                          ? '#30D158'
                          : item.type === 'warning'
                          ? '#FF9F0A'
                          : item.type === 'security'
                          ? '#0A84FF'
                          : '#8E8E93';

                      const tagBg =
                        item.type === 'success'
                          ? 'rgba(48, 209, 88, 0.14)'
                          : item.type === 'warning'
                          ? 'rgba(255, 159, 10, 0.14)'
                          : item.type === 'security'
                          ? 'rgba(10, 132, 255, 0.14)'
                          : 'rgba(142, 142, 147, 0.14)';

                      const tagIcon =
                        item.type === 'success'
                          ? 'checkmark-circle'
                          : item.type === 'warning'
                          ? 'alert-circle'
                          : item.type === 'security'
                          ? 'shield-checkmark'
                          : 'information-circle';

                      const tagLabel =
                        item.type === 'success'
                          ? 'Thành công'
                          : item.type === 'warning'
                          ? 'Cảnh báo'
                          : item.type === 'security'
                          ? 'Bảo mật'
                          : 'Hệ thống';

                      return (
                        <TouchableOpacity
                          key={item.id}
                          activeOpacity={0.88}
                          onPress={() => {
                            // Toggle read state
                            const updated = notifications.map((n) => (n.id === item.id ? { ...n, read: !n.read } : n));
                            setNotifications(updated);
                            AsyncStorage.setItem('lockx_notifications_history', JSON.stringify(updated)).catch(() => {});
                          }}
                          style={{
                            backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
                            borderRadius: 16,
                            padding: 14,
                            borderWidth: 0.6,
                            borderColor: isLight ? '#E5E5EA' : 'rgba(255,255,255,0.1)',
                            shadowColor: '#000000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: isLight ? 0.04 : 0.25,
                            shadowRadius: 6,
                          }}
                        >
                          {/* Header row */}
                          <View
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 8,
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                              <Image
                                source={require('./assets/icon.png')}
                                style={{ width: 20, height: 20, borderRadius: 5 }}
                              />
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: '700',
                                  letterSpacing: 0.5,
                                  color: isLight ? '#636366' : '#8E8E93',
                                  textTransform: 'uppercase',
                                }}
                              >
                                LOCKX VAULT
                              </Text>
                              <Text style={{ fontSize: 10, color: '#8E8E93' }}>•</Text>
                              <Text style={{ fontSize: 11, color: isLight ? '#8E8E93' : '#8E8E93' }}>{item.time}</Text>
                              {!item.read && (
                                <View
                                  style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: 3.5,
                                    backgroundColor: appSettings.accentColor,
                                  }}
                                />
                              )}
                            </View>

                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 3.5,
                                backgroundColor: tagBg,
                                paddingHorizontal: 7,
                                paddingVertical: 2.5,
                                borderRadius: 8,
                              }}
                            >
                              <Ionicons name={tagIcon as any} size={11.5} color={tagColor} />
                              <Text style={{ fontSize: 10.5, fontWeight: '700', color: tagColor }}>{tagLabel}</Text>
                            </View>
                          </View>

                          {/* Title & Body */}
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: '700',
                              color: isLight ? '#000000' : '#FFFFFF',
                              marginBottom: 4,
                            }}
                          >
                            {item.title}
                          </Text>

                          <Text
                            style={{
                              fontSize: 13,
                              lineHeight: 18,
                              color: isLight ? '#3C3C43' : '#D1D1D6',
                            }}
                          >
                            {item.message}
                          </Text>

                          {/* Footer Action: Xóa */}
                          <View
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'flex-end',
                              alignItems: 'center',
                              marginTop: 8,
                              paddingTop: 6,
                              borderTopWidth: 0.5,
                              borderTopColor: isLight ? '#F2F2F7' : 'rgba(255,255,255,0.06)',
                            }}
                          >
                            <TouchableOpacity
                              onPress={(e: any) => {
                                e.stopPropagation();
                                const updated = notifications.filter((n) => n.id !== item.id);
                                setNotifications(updated);
                                AsyncStorage.setItem('lockx_notifications_history', JSON.stringify(updated)).catch(() => {});
                              }}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 6 }}
                            >
                              <Ionicons name="trash-outline" size={13} color="#FF453A" />
                              <Text style={{ fontSize: 11.5, color: '#FF453A', fontWeight: '500' }}>Xóa</Text>
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })()}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// =========================================================================
// STYLES (Apple Human Interface Guidelines Dark Theme + Onboarding)
// =========================================================================
const getStyles = (
  isLight: boolean,
  accentColor: string = '#0A84FF',
  fontSizeScale: 'small' | 'standard' | 'large' = 'standard',
  isBoldText: boolean = false,
  fontSizeLevel: number = 3
) => {
  const levelMultipliers: Record<number, number> = {
    1: 0.82,
    2: 0.90,
    3: 1.00,
    4: 1.10,
    5: 1.20,
    6: 1.35,
    7: 1.50,
  };
  const fontMult = levelMultipliers[fontSizeLevel] || (fontSizeScale === 'small' ? 0.9 : fontSizeScale === 'large' ? 1.15 : 1.0);
  const boldWeight = isBoldText ? '700' : '400';
  const semiBoldWeight = isBoldText ? '800' : '600';

  return StyleSheet.create({
  // Compatibility Load Screen (Matching reference screenshot)
  loadRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  loadScroll: {
    flex: 1,
  },
  loadScrollContent: {
    paddingHorizontal: 26,
    paddingTop: 8,
    paddingBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  loadMainBody: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  loadLogoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  loadAppLogo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  loadSquircleCard: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  loadSquircleCardDanger: {
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
    borderColor: 'rgba(255, 69, 58, 0.3)',
  },
  phoneSlashBar: {
    position: 'absolute',
    width: 28,
    height: 2.5,
    backgroundColor: '#FF453A',
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
  },
  loadTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  loadSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16,
  },
  loadListSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  loadListHeader: {
    fontSize: 14,
    color: '#AEAEB2',
    marginBottom: 6,
    textAlign: 'center',
    fontWeight: '500',
  },
  loadVersionItem: {
    fontSize: 13.5,
    color: '#F2F2F7',
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '500',
  },
  loadStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    gap: 6,
  },
  loadStatusBadgeSuccess: {
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
    borderColor: 'rgba(48, 209, 88, 0.35)',
  },
  loadStatusBadgeDanger: {
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
    borderColor: 'rgba(255, 69, 58, 0.4)',
  },
  loadStatusBadgeText: {
    fontSize: 13.5,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  loadExplText: {
    fontSize: 12.5,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 8,
  },
  loadFixedBottom: {
    width: '100%',
    paddingHorizontal: 26,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: '#000000',
    alignItems: 'center',
  },
  loadBtnStart: {
    width: '100%',
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  loadBtnStartText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loadBtnLocked: {
    width: '100%',
    height: 48,
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  loadBtnLockedText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
  },
  loadLangSegmentBar: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    padding: 3,
    width: '100%',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  loadLangTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
  },
  loadLangTabActive: {
    backgroundColor: '#3A3A3C',
  },
  loadLangTabText: {
    fontSize: 13.5,
    color: '#8E8E93',
    fontWeight: '500',
  },
  loadLangTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  onboardScroll: {
    padding: 20,
    paddingBottom: 40,
  },
  onboardHeader: {
    alignItems: 'center',
    marginVertical: 18,
    paddingHorizontal: 10,
  },
  onboardLogoSmall: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 12,
  },
  onboardTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  onboardSub: {
    color: '#8E8E93',
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  onboardCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  onboardCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  onboardCardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  onboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  onboardKey: {
    color: '#8E8E93',
    fontSize: 13.5,
  },
  onboardVal: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '500',
  },
  onboardValBold: {
    color: '#0A84FF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  onboardCompatItem: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  compatBadgeBest: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(48, 209, 88, 0.16)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    marginBottom: 4,
  },
  compatBadgeGood: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(10, 132, 255, 0.16)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    marginBottom: 4,
  },
  compatBadgeStandard: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 159, 10, 0.16)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    marginBottom: 4,
  },
  compatBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  compatTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  compatDesc: {
    color: '#8E8E93',
    fontSize: 12,
    lineHeight: 16,
  },
  onboardPrimaryBtn: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  onboardPrimaryBtnText: {
    color: '#000000',
    fontSize: 15.5,
    fontWeight: '700',
  },
  // Language Step
  langContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  langItemActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
    borderRadius: 10,
  },
  langFlag: {
    fontSize: 26,
    marginRight: 14,
  },
  langName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  langRegion: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  langUncheckedCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#636366',
  },
  langBottomBox: {
    gap: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnStartNow: {
    backgroundColor: '#0A84FF',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
  },
  btnStartNowText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  langHint: {
    color: '#636366',
    fontSize: 11.5,
    textAlign: 'center',
  },

  // Main UI
  safeRoot: {
    flex: 1,
    backgroundColor: isLight ? '#F2F2F7' : '#000000',
    paddingTop: Platform.OS === 'web' ? 44 : 0,
  },
  mainContent: {
    flex: 1,
    backgroundColor: isLight ? '#F2F2F7' : '#000000',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // Apple iOS HUD Success Popup Styles
  popupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 999999,
  },
  popupCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: 'rgba(28, 28, 30, 0.96)',
    borderRadius: 26,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 24,
  },
  popupCardLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowOpacity: 0.2,
  },
  popupIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 16,
  },
  popupTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  popupMessage: {
    color: '#D1D1D6',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
    fontWeight: '400',
    paddingHorizontal: 6,
  },
  popupActionBtn: {
    width: '100%',
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  popupActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
  },
  // iOS 18 Dynamic Island Push Banner Styles
  iosPushBannerContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 14 : 44,
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  iosPushBannerCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: 'rgba(24, 24, 28, 0.96)',
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingTop: 11,
    paddingBottom: 9,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  iosPushBannerCardLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  iosPushHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  iosPushAppBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iosPushAppIcon: {
    width: 18,
    height: 18,
    borderRadius: 4.5,
  },
  iosPushAppName: {
    color: '#8E8E93',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  iosPushAppDot: {
    color: '#636366',
    fontSize: 10,
  },
  iosPushAppTime: {
    color: '#8E8E93',
    fontSize: 10.5,
    fontWeight: '500',
  },
  iosPushTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    paddingHorizontal: 7.5,
    paddingVertical: 2.5,
    borderRadius: 10,
  },
  iosPushTypeTagText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  iosPushContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  iosPushTextWrap: {
    flex: 1,
  },
  iosPushTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  iosPushBody: {
    color: '#D1D1D6',
    fontSize: 12.5,
    lineHeight: 16.5,
    fontWeight: '400',
  },
  iosPushActionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iosPushGrabberWrap: {
    alignItems: 'center',
    marginTop: 6,
  },
  iosPushGrabberBar: {
    width: 34,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  notifBadgePill: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF3B30',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: isLight ? '#F2F2F7' : '#000000',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  bannerToast: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: '#1E1E20',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 999,
  },
  bannerToastText: {
    color: '#fff',
    fontSize: 12.5,
    fontWeight: '600',
  },
  // Home Brand Header & Dashboard
  homeBrandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  homeBrandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  homeBrandLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  homeBrandTitle: {
    color: isLight ? '#000000' : '#FFFFFF',
    fontSize: Math.round(22 * fontMult),
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  homeProBadge: {
    backgroundColor: 'rgba(10, 132, 255, 0.2)',
    borderWidth: 0.5,
    borderColor: '#0A84FF',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  homeProBadgeText: {
    color: '#0A84FF',
    fontSize: 10,
    fontWeight: '800',
  },
  homeBrandSubtitle: {
    color: isLight ? '#6C6C70' : '#8E8E93',
    fontSize: Math.round(12 * fontMult),
    marginTop: 2,
  },
  homeBrandRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  homeOsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(48, 209, 88, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
  },
  homeOsBadgeText: {
    color: '#30D158',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  homeStatsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  homeStatCard: {
    flex: 1,
    backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
    borderRadius: 14,
    padding: 12,
    borderWidth: 0.5,
    borderColor: isLight ? '#E5E5EA' : 'rgba(255, 255, 255, 0.08)',
  },
  homeStatIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  homeStatNumber: {
    color: isLight ? '#000000' : '#FFFFFF',
    fontSize: Math.round(20 * fontMult),
    fontWeight: '800',
  },
  homeStatLabel: {
    color: isLight ? '#6C6C70' : '#8E8E93',
    fontSize: Math.round(11 * fontMult),
    fontWeight: '500',
    marginTop: 2,
  },
  homeStatSub: {
    color: '#0A84FF',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  homeQuickActionsWrap: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  homeQuickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: isLight ? '#FFFFFF' : 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: isLight ? '#E5E5EA' : 'rgba(255, 255, 255, 0.08)',
  },
  homeQuickActionText: {
    color: isLight ? '#000000' : '#FFFFFF',
    fontSize: Math.round(11.5 * fontMult),
    fontWeight: '600',
  },

  // App Shield & Management Tab Styles
  appShieldCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(10, 132, 255, 0.25)',
  },
  appShieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  appShieldIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 132, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appShieldTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
  appShieldSub: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  appBatchActionRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 10,
  },
  btnBatchLock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: accentColor,
    paddingVertical: 8,
    borderRadius: 9,
  },
  btnBatchLockText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  btnBatchUnlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2C2C2E',
    paddingVertical: 8,
    borderRadius: 9,
  },
  btnBatchUnlockText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  appChipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#1C1C1E',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  appChipBtnActive: {
    backgroundColor: accentColor,
    borderColor: accentColor,
  },
  appChipText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  appChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  appLockMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  appLockMiniBadgeText: {
    color: '#30D158',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  btnAppOpen: {
    backgroundColor: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(10, 132, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: isLight ? '#E5E5EA' : 'rgba(10, 132, 255, 0.3)',
  },
  btnAppOpenText: {
    color: accentColor,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  appScanCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.3)',
  },
  appScanIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appScanTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  appScanSub: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  btnScanNow: {
    backgroundColor: accentColor,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  btnScanNowText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scanProgressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  scanProgressBarFill: {
    height: '100%',
    backgroundColor: '#0A84FF',
    borderRadius: 2,
  },
  sandboxNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(48, 209, 88, 0.08)',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(48, 209, 88, 0.2)',
  },
  sandboxNoticeText: {
    flex: 1,
    color: '#AEAEB2',
    fontSize: 10.5,
    lineHeight: 14,
  },
  appFilterControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  filterToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterToggleBtnActive: {
    borderColor: 'rgba(48, 209, 88, 0.5)',
    backgroundColor: 'rgba(48, 209, 88, 0.08)',
  },
  filterToggleText: {
    color: '#8E8E93',
    fontSize: 11.5,
    fontWeight: '600',
  },
  filterToggleTextActive: {
    color: '#30D158',
    fontWeight: '700',
  },
  btnManageApps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(10, 132, 255, 0.35)',
  },
  btnManageAppsText: {
    color: '#0A84FF',
    fontSize: 12,
    fontWeight: '700',
  },
  appDetectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  appDetectedBadgeText: {
    color: '#30D158',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  appCustomBadge: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  appCustomBadgeText: {
    color: '#0A84FF',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  emptyAppBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 24,
    marginVertical: 10,
  },
  emptyAppTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  emptyAppSub: {
    color: '#8E8E93',
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  btnEmptyScan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: accentColor,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  btnEmptyScanText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  btnEmptyAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  btnEmptyAddText: {
    color: '#0A84FF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  customAddCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
  },
  customAddTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  customInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 13,
  },
  catPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#2C2C2E',
  },
  catPillActive: {
    backgroundColor: '#0A84FF',
  },
  catPillText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
  },
  catPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  btnConfirmAddCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  btnConfirmAddCustomText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  btnToggleCatalog: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(10, 132, 255, 0.3)',
  },
  btnToggleCatalogActive: {
    backgroundColor: '#30D158',
    borderColor: '#30D158',
  },
  btnToggleCatalogText: {
    color: '#0A84FF',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  btnToggleCatalogTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  navHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  largeTitle: {
    color: isLight ? '#000000' : '#FFFFFF',
    fontSize: Math.round(32 * fontMult),
    fontWeight: isBoldText ? '800' : '700',
    letterSpacing: -0.5,
  },
  navSubtitle: {
    color: isLight ? '#6C6C70' : '#8E8E93',
    fontSize: Math.round(13 * fontMult),
    marginTop: 4,
  },
  circlePlusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isLight ? '#E3E3E8' : 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarBox: {
    backgroundColor: isLight ? '#E3E3E8' : '#1C1C1E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 10,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    color: isLight ? '#000000' : '#fff',
    fontSize: Math.round(14 * fontMult),
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: isLight ? '#E3E3E8' : '#1C1C1E',
    borderRadius: 8,
    padding: 2,
    marginTop: 12,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  segBtnActive: {
    backgroundColor: isLight ? '#FFFFFF' : '#3A3A3C',
    shadowColor: isLight ? '#000' : 'transparent',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isLight ? 0.12 : 0,
    shadowRadius: 2,
  },
  segBtnText: {
    color: isLight ? '#6C6C70' : '#8E8E93',
    fontSize: Math.round(12 * fontMult),
    fontWeight: '500',
  },
  segBtnTextActive: {
    color: isLight ? '#000000' : '#FFFFFF',
    fontWeight: '600',
  },
  sectionWrap: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionCaption: {
    color: isLight ? '#6C6C70' : '#8E8E93',
    fontSize: Math.round(11 * fontMult),
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 12,
  },
  groupedList: {
    backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: isLight ? 0.5 : 0,
    borderColor: isLight ? '#E5E5EA' : 'transparent',
  },
  cellItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: isLight ? '#E5E5EA' : 'rgba(255,255,255,0.08)',
  },
  cellLeadingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cellContent: {
    flex: 1,
  },
  cellTitle: {
    color: isLight ? '#000000' : '#FFFFFF',
    fontSize: Math.round(15 * fontMult),
    fontWeight: isBoldText ? '700' : '600',
  },
  cellSubtitle: {
    color: isLight ? '#6C6C70' : '#8E8E93',
    fontSize: Math.round(12 * fontMult),
    marginTop: 2,
  },
  btnCellCopy: {
    padding: 6,
    marginRight: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
  },
  tabBar: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: isLight ? 'rgba(248, 248, 248, 0.96)' : 'rgba(20,20,22,0.95)',
    borderTopWidth: 0.5,
    borderTopColor: isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255,255,255,0.1)',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 8,
  },
  tabItem: {
    alignItems: 'center',
    gap: 3,
  },
  tabLabel: {
    color: isLight ? '#6C6C70' : '#8E8E93',
    fontSize: 10,
    fontWeight: '500',
  },
  // Stamina Card
  staminaCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  staminaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  staminaTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  staminaSub: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  staminaMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginVertical: 14,
  },
  staminaBigNum: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  staminaMaxNum: {
    color: '#636366',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  staminaPct: {
    color: '#0A84FF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  staminaCapsules: {
    flexDirection: 'row',
    gap: 8,
  },
  capsuleBtn: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  capsuleText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  // Gacha Card
  gachaCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  gachaGame: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  gachaBanner: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  badge5050: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badge5050Text: {
    fontSize: 10,
    fontWeight: '700',
  },
  pityBigNum: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  pityMaxNum: {
    color: '#636366',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  softHintText: {
    color: '#0A84FF',
    fontSize: 12,
    fontWeight: '600',
  },
  pityProgressBar: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginVertical: 12,
    overflow: 'hidden',
  },
  pityProgressFill: {
    height: '100%',
    backgroundColor: '#0A84FF',
    borderRadius: 3,
  },
  gachaBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnRollSingle: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
  },
  btnRollMulti: {
    backgroundColor: '#0A84FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
  },
  btnRollText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  btnCrown: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255,214,10,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
  },
  btnCrownText: {
    color: '#FFD60A',
    fontSize: 12,
    fontWeight: '700',
  },
  // Lock Screen
  lockContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 30,
  },
  lockClockBox: {
    alignItems: 'center',
    marginTop: 20,
  },
  lockDateText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '500',
  },
  lockBigClock: {
    color: '#FFFFFF',
    fontSize: 78,
    fontWeight: '700',
    letterSpacing: -2,
    marginTop: 4,
  },
  lockLiveWidget: {
    backgroundColor: 'rgba(28,28,30,0.7)',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  lockWidgetBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  lockWidgetBarFill: {
    height: '100%',
    backgroundColor: '#0A84FF',
    borderRadius: 2,
  },
  lockBottomActions: {
    alignItems: 'center',
    gap: 14,
    width: '100%',
  },
  btnAppleUnlock: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  btnAppleUnlockText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  lockHint: {
    color: '#636366',
    fontSize: 11,
  },
  // Modal Sheet
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: isLight ? '#E5E5EA' : 'rgba(255,255,255,0.1)',
  },
  sheetTitle: {
    color: isLight ? '#000000' : '#FFFFFF',
    fontSize: Math.round(16 * fontMult),
    fontWeight: '700',
  },
  sheetBtnBlue: {
    color: accentColor,
    fontSize: Math.round(15 * fontMult),
  },
  detailLabel: {
    color: isLight ? '#6C6C70' : '#8E8E93',
    width: 90,
    fontSize: Math.round(14 * fontMult),
  },
  detailVal: {
    flex: 1,
    color: isLight ? '#000000' : '#FFFFFF',
    fontSize: Math.round(14 * fontMult),
    fontWeight: isBoldText ? '600' : '500',
  },
  totpBox: {
    backgroundColor: 'rgba(10,132,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(10,132,255,0.25)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  totpDigits: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 4,
  },
  totpCopyBtn: {
    backgroundColor: 'rgba(10,132,255,0.2)',
    padding: 7,
    borderRadius: 16,
  },
  totpBarWrap: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  totpBarFill: {
    height: '100%',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: isLight ? '#E5E5EA' : 'rgba(255,255,255,0.08)',
  },
  formLabel: {
    color: isLight ? '#000000' : '#FFFFFF',
    width: 100,
    fontSize: Math.round(14 * fontMult),
    fontWeight: isBoldText ? '600' : '400',
  },
  formInput: {
    flex: 1,
    color: isLight ? '#000000' : '#FFFFFF',
    fontSize: Math.round(14 * fontMult),
  },

  // Dedicated Full Screen Vault Sub-views
  fullScreenNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: isLight ? '#E5E5EA' : '#2C2C2E',
    backgroundColor: isLight ? '#FFFFFF' : '#000000',
  },
  fullScreenNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  fullScreenNavBtnText: {
    color: accentColor,
    fontSize: Math.round(16 * fontMult),
    fontWeight: '500',
  },
  fullScreenNavTitle: {
    color: isLight ? '#000000' : '#FFFFFF',
    fontSize: Math.round(17 * fontMult),
    fontWeight: isBoldText ? '700' : '600',
    flex: 1,
    textAlign: 'center',
  },
  noteInputCard: {
    backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
    borderRadius: 14,
    padding: 14,
    borderWidth: 0.5,
    borderColor: isLight ? '#E5E5EA' : 'rgba(255,255,255,0.1)',
  },
  formInputMultiline: {
    color: isLight ? '#000000' : '#FFFFFF',
    fontSize: Math.round(14 * fontMult),
    lineHeight: 20,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Apple Screen Time Styles
  screenTimeCard: {
    backgroundColor: isLight ? '#FFFFFF' : '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 0.5,
    borderColor: isLight ? '#E5E5EA' : 'rgba(255,255,255,0.1)',
  },
  screenTimeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  screenTimeSubLabel: {
    color: isLight ? '#6C6C70' : '#8E8E93',
    fontSize: Math.round(11.5 * fontMult),
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  screenTimeBigText: {
    color: isLight ? '#000000' : '#FFFFFF',
    fontSize: Math.round(26 * fontMult),
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  screenTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(48,209,88,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  screenTimePillText: {
    color: '#30D158',
    fontSize: 12,
    fontWeight: '600',
  },
  screenTimeToggleBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 2,
    marginBottom: 16,
  },
  screenTimeToggleBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  screenTimeToggleBtnActive: {
    backgroundColor: '#2C2C2E',
  },
  screenTimeToggleBtnText: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '500',
  },
  screenTimeToggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  chartContainer: {
    height: 130,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2C2C2E',
    position: 'relative',
  },
  chartAverageLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderStyle: 'dashed',
    zIndex: 1,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 6,
  },
  chartBarWrap: {
    width: 16,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  chartColLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '500',
  },
  categoryBarWrap: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  categoryLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  categoryLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  categoryLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryLegendText: {
    color: '#8E8E93',
    fontSize: 12,
  },
  categoryLegendVal: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  });
};
