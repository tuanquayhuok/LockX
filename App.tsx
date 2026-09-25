import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

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
  username: string; // e.g. '@admin_lockx'
  avatarColor: string;
  joinDate: string; // e.g. '15/08/2026'
  daysActive: number; // e.g. 40 ngày
  hoursUsed: number; // e.g. 168 giờ
  currentPasscode: string;
}

export interface LoginHistoryRecord {
  id: string;
  timestamp: string;
  device: string; // e.g. 'iPhone 15 Pro Max'
  os: string; // e.g. 'iOS 18.2'
  location: string; // e.g. 'Hà Nội, Việt Nam'
  method: 'Face ID' | 'Mật khẩu' | 'Passcode';
  ip: string;
}

export interface AppSettings {
  accentColor: string; // e.g. '#0A84FF'
  themeMode: 'dark' | 'light';
  fontSizeScale: 'small' | 'standard' | 'large';
  isBoldText: boolean;
  language: 'vi' | 'en' | 'zh';
}

export interface FriendUser {
  id: string;
  displayName: string;
  username: string; // e.g. '@minh_apple'
  avatarColor: string;
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
  displayName: 'Admin LockX',
  username: '@admin_lockx',
  avatarColor: '#0A84FF',
  joinDate: '15/08/2026',
  daysActive: 40,
  hoursUsed: 168,
  currentPasscode: '123456',
};

export const INITIAL_LOGIN_HISTORY: LoginHistoryRecord[] = [
  {
    id: 'lh-1',
    timestamp: 'Hôm nay, 15:42',
    device: 'iPhone 15 Pro Max',
    os: 'iOS 18.2',
    location: 'Hà Nội, Việt Nam',
    method: 'Face ID',
    ip: '14.225.21.84',
  },
  {
    id: 'lh-2',
    timestamp: 'Hôm qua, 21:18',
    device: 'iPhone 15 Pro Max',
    os: 'iOS 18.2',
    location: 'Hà Nội, Việt Nam',
    method: 'Face ID',
    ip: '14.225.21.84',
  },
  {
    id: 'lh-3',
    timestamp: '21/09/2026, 09:30',
    device: 'MacBook Pro M3',
    os: 'macOS 15.0',
    location: 'TP. Hồ Chí Minh',
    method: 'Mật khẩu',
    ip: '118.69.182.20',
  },
  {
    id: 'lh-4',
    timestamp: '19/09/2026, 14:15',
    device: 'iPhone 15 Pro Max',
    os: 'iOS 18.2',
    location: 'Hà Nội, Việt Nam',
    method: 'Passcode',
    ip: '14.225.21.84',
  },
  {
    id: 'lh-5',
    timestamp: '15/08/2026, 08:00',
    device: 'iPhone 15 Pro Max',
    os: 'iOS 18.1',
    location: 'Hà Nội, Việt Nam',
    method: 'Face ID',
    ip: '14.225.21.84',
  },
];

export const INITIAL_SETTINGS: AppSettings = {
  accentColor: '#0A84FF',
  themeMode: 'dark',
  fontSizeScale: 'standard',
  isBoldText: false,
  language: 'vi',
};

export const ACCENT_COLOR_OPTIONS = [
  { id: '#0A84FF', label: 'Xanh Apple', color: '#0A84FF' },
  { id: '#30D158', label: 'Xanh Ngọc', color: '#30D158' },
  { id: '#BF5AF2', label: 'Tím Cyber', color: '#BF5AF2' },
  { id: '#FF9500', label: 'Cam Sunset', color: '#FF9500' },
  { id: '#FF2D55', label: 'Đỏ Ruby', color: '#FF2D55' },
  { id: '#FFD60A', label: 'Vàng Kim', color: '#FFD60A' },
  { id: '#32ADE6', label: 'Xanh Sky', color: '#32ADE6' },
];

export const INITIAL_FRIENDS: FriendUser[] = [
  {
    id: 'fr-1',
    displayName: 'Minh Hoàng',
    username: '@minh_apple',
    avatarColor: '#0A84FF',
    status: 'online',
    bio: 'iOS Developer & Apple Fanboy 📱',
    lastMessage: 'LockX bản mới dùng mượt phết ông!',
    lastTime: '15:20',
    unreadCount: 1,
  },
  {
    id: 'fr-2',
    displayName: 'Ngọc Linh',
    username: '@linh_game',
    avatarColor: '#BF5AF2',
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
    avatarColor: '#30D158',
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
    { id: 'm2', sender: 'me', text: 'Ừ bạn, có cả Screen Time biểu đồ cột Apple nữa đấy!', time: '15:18' },
    { id: 'm3', sender: 'friend', text: 'LockX bản mới dùng mượt phết ông!', time: '15:20' },
  ],
  'fr-2': [
    { id: 'm4', sender: 'friend', text: 'Hôm nay banner mới ra rồi nè', time: '13:50' },
    { id: 'm5', sender: 'me', text: 'Tôi tích được 48 roll rồi, chuẩn bị nổ bảo hiểm', time: '14:00' },
    { id: 'm6', sender: 'friend', text: 'Tối nay roll banner không bạn ơi?', time: '14:05' },
  ],
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

export default function App() {
  // Onboarding & Load Stages: 'loading' -> 'onboarding' -> 'ready'
  const [onboardingStage, setOnboardingStage] = useState<'loading' | 'onboarding' | 'ready'>('loading');
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'vi' | 'zh'>('vi');

  // Nhận diện phiên bản iOS và Build ID chính xác từ thiết bị
  const [detectedOsVersion, setDetectedOsVersion] = useState<string>(() => {
    return Device.osVersion || (Platform.OS === 'ios' ? String(Platform.Version) : '18.2');
  });
  const [detectedOsBuild, setDetectedOsBuild] = useState<string>(() => {
    return Device.osBuildId || (Platform.OS === 'ios' ? '22C152' : '23G90');
  });
  const [isSimulatedOverride, setIsSimulatedOverride] = useState<boolean | null>(null);

  // Kiểm tra phiên bản điện thoại có thuộc danh sách hỗ trợ hay không
  const isDeviceSupported = isSimulatedOverride !== null
    ? isSimulatedOverride
    : checkIsSupportedVersion(detectedOsVersion);

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
  const [profileSubView, setProfileSubView] = useState<'main' | 'change_password' | 'edit_profile'>('main');
  const [loginHistory, setLoginHistory] = useState<LoginHistoryRecord[]>(INITIAL_LOGIN_HISTORY);
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmNewPassInput, setConfirmNewPassInput] = useState('');
  const [editDisplayNameInput, setEditDisplayNameInput] = useState(INITIAL_USER_PROFILE.displayName);
  const [editUsernameInput, setEditUsernameInput] = useState(INITIAL_USER_PROFILE.username);

  // Settings State (Màu giao diện, cỡ chữ, chữ in đậm, sáng/tối, ngôn ngữ)
  const [appSettings, setAppSettings] = useState<AppSettings>(INITIAL_SETTINGS);

  // Friends & Messaging State (Tìm kiếm username & phòng chat iMessage)
  const [friendsList, setFriendsList] = useState<FriendUser[]>(INITIAL_FRIENDS);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>(INITIAL_CHAT_MESSAGES);
  const [activeChatFriend, setActiveChatFriend] = useState<FriendUser | null>(null);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [chatInputText, setChatInputText] = useState('');

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

  // Tải danh sách app & cài đặt đã lưu từ AsyncStorage
  useEffect(() => {
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

    AsyncStorage.getItem('lockx_user_profile')
      .then((s) => {
        if (s) {
          try {
            const p = JSON.parse(s);
            setUserProfile(p);
            setEditDisplayNameInput(p.displayName || 'Admin LockX');
            setEditUsernameInput(p.username || '@admin_lockx');
          } catch (e) {}
        }
      })
      .catch(() => {});

    AsyncStorage.getItem('lockx_app_settings')
      .then((s) => {
        if (s) {
          try {
            setAppSettings(JSON.parse(s));
          } catch (e) {}
        }
      })
      .catch(() => {});

    AsyncStorage.getItem('lockx_login_history')
      .then((s) => {
        if (s) {
          try {
            setLoginHistory(JSON.parse(s));
          } catch (e) {}
        }
      })
      .catch(() => {});

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
    const newLog: LoginHistoryRecord = {
      id: `lh-${Date.now()}`,
      timestamp: 'Vừa xong',
      device: 'iPhone 15 Pro Max',
      os: `iOS ${detectedOsVersion}`,
      location: 'Hà Nội, Việt Nam',
      method: 'Mật khẩu',
      ip: '14.225.21.84',
    };
    saveLoginHistory([newLog, ...loginHistory]);

    setCurrentPassInput('');
    setNewPassInput('');
    setConfirmNewPassInput('');
    setProfileSubView('main');
    triggerToast('✓ Đã cập nhật mật khẩu mới thành công!');
  };

  // Xử lý lưu hồ sơ người dùng
  const handleSaveEditProfile = () => {
    if (!editDisplayNameInput.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên hiển thị.');
      return;
    }
    let formattedUsername = editUsernameInput.trim();
    if (!formattedUsername.startsWith('@')) {
      formattedUsername = `@${formattedUsername}`;
    }
    const updated: UserProfile = {
      ...userProfile,
      displayName: editDisplayNameInput.trim(),
      username: formattedUsername,
    };
    saveUserProfile(updated);
    setProfileSubView('main');
    triggerToast('✓ Đã lưu thông tin hồ sơ');
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
            const currentSession: LoginHistoryRecord = {
              id: `lh-${Date.now()}`,
              timestamp: 'Hiện tại (Đang hoạt động)',
              device: 'iPhone 15 Pro Max',
              os: `iOS ${detectedOsVersion}`,
              location: 'Hà Nội, Việt Nam',
              method: 'Face ID',
              ip: '14.225.21.84',
            };
            saveLoginHistory([currentSession]);
            triggerToast('Đã đăng xuất khỏi tất cả các thiết bị khác');
          },
        },
      ]
    );
  };

  // Gửi tin nhắn chat iMessage và nhận phản hồi tự động
  const handleSendMessage = (customText?: string) => {
    const textToSend = (customText || chatInputText).trim();
    if (!textToSend || !activeChatFriend) return;

    const myMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'me',
      text: textToSend,
      time: clockStr,
    };

    const currentList = chatMessages[activeChatFriend.id] || [];
    const updatedList = [...currentList, myMsg];
    const newChatMap = { ...chatMessages, [activeChatFriend.id]: updatedList };
    saveChatMessages(newChatMap);
    setChatInputText('');

    // Cập nhật tin nhắn gần nhất
    const updatedFriends = friendsList.map((f) =>
      f.id === activeChatFriend.id ? { ...f, lastMessage: textToSend, lastTime: clockStr } : f
    );
    saveFriends(updatedFriends);

    // Tự động trả lời thông minh sau 1.2s
    const friendId = activeChatFriend.id;
    const currentFriend = activeChatFriend;
    setTimeout(() => {
      const REPLIES = [
        `OK ${userProfile.displayName || 'bạn'}, mình nhận được tin nhắn rồi nhé!`,
        `Giao diện LockX bản mới này nhìn đẹp và mượt thật đấy ✨`,
        `Tuyệt vời! Tính năng nhắn tin hoạt động rất trơn tru 👍`,
        `Hôm nay rảnh không, vào check Screen Time trên LockX xem dùng hết bao nhiêu tiếng rồi haha!`,
        `Cảm ơn bạn đã nhắn tin nha! Chúc bạn ngày mới tốt lành 🎉`,
      ];
      const replyText = REPLIES[Math.floor(Math.random() * REPLIES.length)];
      const friendReply: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'friend',
        text: replyText,
        time: clockStr,
      };

      setChatMessages((prev) => {
        const friendMsgs = [...(prev[friendId] || []), friendReply];
        const nextMap = { ...prev, [friendId]: friendMsgs };
        saveChatMessages(nextMap);
        return nextMap;
      });

      setFriendsList((prev) => {
        const u = prev.map((f) =>
          f.id === friendId ? { ...f, lastMessage: replyText, lastTime: clockStr } : f
        );
        saveFriends(u);
        return u;
      });
    }, 1200);
  };

  const saveAppsToStorage = async (updated: PhoneAppItem[]) => {
    setPhoneApps(updated);
    try {
      await AsyncStorage.setItem('lockx_user_phone_apps', JSON.stringify(updated));
    } catch (e) {}
  };

  // Yêu cầu cấp quyền cho phép thông báo
  const requestNotificationPermission = async () => {
    try {
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

  // Check on app launch: only show load screen on FIRST launch!
  // Mới vào sẽ yêu cầu cấp quyền cho phép thông báo
  useEffect(() => {
    AsyncStorage.getItem('lockx_has_onboarded')
      .then((val) => {
        if (val === 'true') {
          setOnboardingStage('ready');
        } else {
          setOnboardingStage('onboarding');
          setTimeout(() => {
            requestNotificationPermission();
          }, 400);
        }
      })
      .catch(() => {
        setOnboardingStage('onboarding');
        setTimeout(() => {
          requestNotificationPermission();
        }, 400);
      });
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

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2200);
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
    const LOAD_TEXTS = {
      vi: {
        supportedTitle: 'Thiết bị được hỗ trợ',
        unsupportedTitle: 'Thiết bị không được hỗ trợ',
        supportedSub: `iOS ${detectedOsVersion} đã sẵn sàng hoạt động.`,
        unsupportedSub: `iOS ${detectedOsVersion} chưa được hỗ trợ.`,
        listHeader: 'Các phiên bản hiện được hỗ trợ:',
        supportedNote: 'Phiên bản iOS này nằm trong phạm vi hỗ trợ nên LockX đã mở khóa đầy đủ quyền truy cập vào ứng dụng.',
        unsupportedNote: 'Phiên bản iOS này nằm ngoài phạm vi hỗ trợ nên LockX đã khóa quyền truy cập vào ứng dụng.',
        btnStart: 'BẮT ĐẦU VÀO APP',
        notifGranted: '✓ Đã cho phép nhận thông báo',
        notifRequest: '🔔 Nhấn để cấp quyền thông báo',
      },
      en: {
        supportedTitle: 'Device Supported',
        unsupportedTitle: 'Device Not Supported',
        supportedSub: `iOS ${detectedOsVersion} is ready to use.`,
        unsupportedSub: `iOS ${detectedOsVersion} is not supported.`,
        listHeader: 'Currently supported versions:',
        supportedNote: 'This iOS version is supported. LockX has unlocked full access to all vault features.',
        unsupportedNote: 'This iOS version is out of supported range, LockX has locked access to the app.',
        btnStart: 'GET STARTED',
        notifGranted: '✓ Notifications Allowed',
        notifRequest: '🔔 Tap to allow notifications',
      },
      zh: {
        supportedTitle: '设备受支持',
        unsupportedTitle: '设备不受支持',
        supportedSub: `iOS ${detectedOsVersion} 已就绪可用。`,
        unsupportedSub: `iOS ${detectedOsVersion} 尚未受支持。`,
        listHeader: '当前支持的系统版本：',
        supportedNote: '此 iOS 版本在受支持的范围内，LockX 已完全解锁应用访问权限。',
        unsupportedNote: '此 iOS 版本超出支持范围，LockX 已锁定对应用程序的访问。',
        btnStart: '进入应用',
        notifGranted: '✓ 已允许推送通知',
        notifRequest: '🔔 点击授予通知权限',
      },
    };

    const t = LOAD_TEXTS[selectedLanguage] || LOAD_TEXTS.vi;

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

            {/* Bottom Segmented Language Pill (English | Tiếng Việt | 简体中文) */}
            <View style={styles.loadLangSegmentBar}>
              <TouchableOpacity
                style={[styles.loadLangTab, selectedLanguage === 'en' && styles.loadLangTabActive]}
                onPress={() => setSelectedLanguage('en')}
              >
                <Text style={[styles.loadLangTabText, selectedLanguage === 'en' && styles.loadLangTabTextActive]}>
                  English
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loadLangTab, selectedLanguage === 'vi' && styles.loadLangTabActive]}
                onPress={() => setSelectedLanguage('vi')}
              >
                <Text style={[styles.loadLangTabText, selectedLanguage === 'vi' && styles.loadLangTabTextActive]}>
                  Tiếng Việt
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loadLangTab, selectedLanguage === 'zh' && styles.loadLangTabActive]}
                onPress={() => setSelectedLanguage('zh')}
              >
                <Text style={[styles.loadLangTabText, selectedLanguage === 'zh' && styles.loadLangTabTextActive]}>
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

      {/* Dynamic Island Style Banner Toast */}
      {toastMessage && (
        <View style={styles.bannerToast}>
          <Ionicons name="checkmark-circle" size={16} color="#30D158" />
          <Text style={styles.bannerToastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        {/* TAB 0: TRANG CHỦ LOCKX & KÉT SẮT */}
        {currentTab === 'vault' && (
          vaultSubView === 'add' ? (
            /* DEDICATED FULL-SCREEN ADD ACCOUNT VIEW */
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1, backgroundColor: '#000000' }}
            >
              {/* Top Navigation Bar */}
              <View style={styles.fullScreenNavBar}>
                <TouchableOpacity
                  onPress={() => setVaultSubView('list')}
                  style={styles.fullScreenNavBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="chevron-back" size={20} color="#0A84FF" />
                  <Text style={styles.fullScreenNavBtnText}>Hủy</Text>
                </TouchableOpacity>
                <Text style={styles.fullScreenNavTitle}>Thêm Tài Khoản</Text>
                <TouchableOpacity
                  onPress={handleSaveAccount}
                  style={styles.fullScreenNavBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={[styles.fullScreenNavBtnText, { fontWeight: '700' }]}>Lưu</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
                keyboardShouldPersistTaps="handled"
              >
                {/* Form Input Group */}
                <View style={styles.groupedList}>
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Tên gợi nhớ</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="VD: Acc chính Hutao C6"
                      placeholderTextColor="#636366"
                      value={newTitle}
                      onChangeText={setNewTitle}
                    />
                  </View>

                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Nền tảng / Game</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="VD: Genshin Impact, Facebook..."
                      placeholderTextColor="#636366"
                      value={newGame}
                      onChangeText={setNewGame}
                    />
                  </View>

                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Máy chủ</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="VD: Asia, Việt Nam, Global..."
                      placeholderTextColor="#636366"
                      value={newServer}
                      onChangeText={setNewServer}
                    />
                  </View>

                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Tài khoản</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Email, SĐT hoặc username"
                      placeholderTextColor="#636366"
                      value={newUser}
                      onChangeText={setNewUser}
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Mật khẩu</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Mật khẩu"
                      placeholderTextColor="#636366"
                      value={newPwd}
                      onChangeText={setNewPwd}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        const p = generateRandomPassword(16);
                        setNewPwd(p);
                        triggerToast('Đã tạo mật khẩu mạnh 16 ký tự');
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="sparkles" size={18} color="#0A84FF" />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.formRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.formLabel}>Tên nhân vật (IGN)</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Tùy chọn (VD: WalnutDirector)"
                      placeholderTextColor="#636366"
                      value={newIgn}
                      onChangeText={setNewIgn}
                    />
                  </View>
                </View>

                {/* Danh Mục Segmented Selector */}
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.sectionCaption}>PHÂN LOẠI DANH MỤC</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    {['Game', 'Clone', 'Social', 'Work'].map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.catPill,
                          newCategory === cat && styles.catPillActive,
                        ]}
                        onPress={() => setNewCategory(cat)}
                      >
                        <Text
                          style={[
                            styles.catPillText,
                            newCategory === cat && styles.catPillTextActive,
                          ]}
                        >
                          {cat === 'Clone' ? 'Clone/Smurf' : cat === 'Social' ? 'Mạng xã hội' : cat === 'Work' ? 'Công việc' : 'Game'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* GHI CHÚ (NOTES) ĐƯỢC LÀM NỔI BẬT & RỘNG RÃI */}
                <View style={[styles.noteInputCard, { marginTop: 16 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="document-text" size={17} color="#0A84FF" />
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Ghi Chú Chi Tiết</Text>
                  </View>
                  <TextInput
                    style={styles.formInputMultiline}
                    placeholder="Ghi lại thông tin bảo mật, email khôi phục, danh sách đồ, lịch sử nạp, ngày tạo..."
                    placeholderTextColor="#636366"
                    value={newNotes}
                    onChangeText={setNewNotes}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                {/* Nút Lưu Toàn Màn Hình */}
                <TouchableOpacity
                  style={[styles.btnStartNow, { marginTop: 24 }]}
                  activeOpacity={0.85}
                  onPress={handleSaveAccount}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#000" />
                  <Text style={styles.btnStartNowText}>Lưu Tài Khoản Vào Két Sắt</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : vaultSubView === 'detail' && selectedAccount ? (
            /* DEDICATED FULL-SCREEN ACCOUNT DETAIL VIEW */
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1, backgroundColor: '#000000' }}
            >
              {/* Top Navigation Bar */}
              <View style={styles.fullScreenNavBar}>
                <TouchableOpacity
                  onPress={() => {
                    setVaultSubView('list');
                    setSelectedAccount(null);
                  }}
                  style={styles.fullScreenNavBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="chevron-back" size={20} color="#0A84FF" />
                  <Text style={styles.fullScreenNavBtnText}>Két Sắt</Text>
                </TouchableOpacity>
                <Text style={styles.fullScreenNavTitle} numberOfLines={1}>
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
                contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
              >
                {/* Account Avatar & Headline */}
                <View style={{ alignItems: 'center', marginVertical: 16 }}>
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      backgroundColor: selectedAccount.game.includes('Genshin')
                        ? '#2563EB'
                        : selectedAccount.game.includes('Honkai')
                        ? '#7C3AED'
                        : selectedAccount.game.includes('Valorant')
                        ? '#DC2626'
                        : '#0A84FF',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <Ionicons
                      name={
                        selectedAccount.game.includes('Genshin')
                          ? 'sparkles'
                          : selectedAccount.game.includes('Honkai')
                          ? 'train'
                          : selectedAccount.game.includes('Valorant')
                          ? 'shield-half'
                          : 'game-controller'
                      }
                      size={30}
                      color="#fff"
                    />
                  </View>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' }}>
                    {selectedAccount.title}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <View style={styles.appCustomBadge}>
                      <Text style={styles.appCustomBadgeText}>{selectedAccount.category.toUpperCase()}</Text>
                    </View>
                    <Text style={{ color: '#8E8E93', fontSize: 13 }}>
                      {selectedAccount.game} • {selectedAccount.server}
                    </Text>
                  </View>
                </View>

                {/* Credentials Group */}
                <View style={styles.groupedList}>
                  <View style={styles.cellItem}>
                    <Text style={styles.detailLabel}>Tài khoản</Text>
                    <Text style={styles.detailVal}>{selectedAccount.username}</Text>
                    <TouchableOpacity onPress={() => copyText(selectedAccount.username, 'Tài khoản')}>
                      <Ionicons name="copy-outline" size={18} color="#0A84FF" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cellItem}>
                    <Text style={styles.detailLabel}>Mật khẩu</Text>
                    <Text style={[styles.detailVal, { fontFamily: 'monospace' }]}>
                      {isPwdRevealed ? selectedAccount.password : '••••••••••••'}
                    </Text>
                    <TouchableOpacity onPress={() => setIsPwdRevealed(!isPwdRevealed)} style={{ marginRight: 12 }}>
                      <Ionicons name={isPwdRevealed ? 'eye-off-outline' : 'eye-outline'} size={18} color="#8E8E93" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => copyText(selectedAccount.password, 'Mật khẩu')}>
                      <Ionicons name="copy-outline" size={18} color="#0A84FF" />
                    </TouchableOpacity>
                  </View>

                  {selectedAccount.ign ? (
                    <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                      <Text style={styles.detailLabel}>Tên nhân vật</Text>
                      <Text style={styles.detailVal}>{selectedAccount.ign}</Text>
                      <TouchableOpacity onPress={() => copyText(selectedAccount.ign!, 'Tên nhân vật')}>
                        <Ionicons name="copy-outline" size={18} color="#0A84FF" />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>

                {/* GHI CHÚ (NOTES) CARD */}
                <View style={[styles.noteInputCard, { marginTop: 16 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="document-text" size={16} color="#0A84FF" />
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Ghi Chú</Text>
                    </View>
                    {selectedAccount.notes && (
                      <TouchableOpacity onPress={() => copyText(selectedAccount.notes!, 'Ghi chú')}>
                        <Ionicons name="copy-outline" size={15} color="#0A84FF" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={{ color: selectedAccount.notes ? '#FFFFFF' : '#636366', fontSize: 13.5, lineHeight: 20 }}>
                    {selectedAccount.notes || 'Chưa có ghi chú nào cho tài khoản này.'}
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={{ marginTop: 24, gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.btnStartNow, { backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#2C2C2E' }]}
                    activeOpacity={0.8}
                    onPress={() => {
                      const allInfo = `Tài khoản: ${selectedAccount.username}\nMật khẩu: ${selectedAccount.password}\nGame: ${selectedAccount.game} (${selectedAccount.server})${selectedAccount.notes ? `\nGhi chú: ${selectedAccount.notes}` : ''}`;
                      copyText(allInfo, 'toàn bộ thông tin');
                    }}
                  >
                    <Ionicons name="copy" size={16} color="#fff" />
                    <Text style={[styles.btnStartNowText, { color: '#fff' }]}>Sao Chép Toàn Bộ Thông Tin</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 13,
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
                    <Text style={{ color: '#FF453A', fontWeight: '700', fontSize: 14 }}>
                      Xóa Tài Khoản Khỏi Két Sắt
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : (
            /* VAULT MAIN LIST VIEW */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Top Brand & Status Header */}
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
                    onPress={() => {
                      setNewTitle('');
                      setNewUser('');
                      setNewPwd('');
                      setNewIgn('');
                      setNewNotes('');
                      setVaultSubView('add');
                    }}
                  >
                    <Ionicons name="add" size={22} color="#0A84FF" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Quick Metrics Dashboard */}
              <View style={styles.homeStatsRow}>
                <View style={styles.homeStatCard}>
                  <View style={[styles.homeStatIconWrap, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
                    <Ionicons name="shield-checkmark" size={18} color="#0A84FF" />
                  </View>
                  <Text style={styles.homeStatNumber}>{accounts.length}</Text>
                  <Text style={styles.homeStatLabel}>Tài khoản lưu</Text>
                  <Text style={styles.homeStatSub}>AES-256 Bit</Text>
                </View>

                <TouchableOpacity
                  style={styles.homeStatCard}
                  activeOpacity={0.8}
                  onPress={() => setCurrentTab('apps')}
                >
                  <View style={[styles.homeStatIconWrap, { backgroundColor: 'rgba(48, 209, 88, 0.15)' }]}>
                    <Ionicons name="hourglass" size={18} color="#30D158" />
                  </View>
                  <Text style={styles.homeStatNumber}>
                    {formatUsageTime(totalScreenTimeMinutes)}
                  </Text>
                  <Text style={styles.homeStatLabel}>Thời gian dùng</Text>
                  <Text style={[styles.homeStatSub, { color: '#30D158' }]}>Hôm nay</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.homeStatCard}
                  activeOpacity={0.8}
                  onPress={() => setCurrentTab('apps')}
                >
                  <View style={[styles.homeStatIconWrap, { backgroundColor: 'rgba(255, 159, 10, 0.15)' }]}>
                    <Ionicons name="apps" size={18} color="#FF9F0A" />
                  </View>
                  <Text style={styles.homeStatNumber}>{phoneApps.length}</Text>
                  <Text style={styles.homeStatLabel}>App iPhone</Text>
                  <Text style={styles.homeStatSub}>Đang quản lý</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Actions Shortcuts */}
              <View style={styles.homeQuickActionsWrap}>
                <TouchableOpacity
                  style={styles.homeQuickActionBtn}
                  onPress={() => {
                    setNewTitle('');
                    setNewUser('');
                    setNewPwd('');
                    setNewIgn('');
                    setNewNotes('');
                    setVaultSubView('add');
                  }}
                >
                  <Ionicons name="add-circle" size={16} color="#0A84FF" />
                  <Text style={styles.homeQuickActionText}>Thêm Tài Khoản</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.homeQuickActionBtn}
                  onPress={() => setCurrentTab('apps')}
                >
                  <Ionicons name="hourglass-outline" size={16} color="#30D158" />
                  <Text style={styles.homeQuickActionText}>Thời Gian Dùng ({phoneApps.length})</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.homeQuickActionBtn}
                  onPress={() => setActiveToolView('pwd')}
                >
                  <Ionicons name="key-outline" size={16} color="#FF9F0A" />
                  <Text style={styles.homeQuickActionText}>Tạo Mật Khẩu</Text>
                </TouchableOpacity>
              </View>

              {/* Search & Category Filter */}
              <View style={styles.navHeader}>
                <View style={styles.searchBarBox}>
                  <Ionicons name="search" size={16} color="#8E8E93" style={{ marginRight: 6 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Tìm kiếm tài khoản, mật khẩu, game..."
                    placeholderTextColor="#636366"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                <View style={styles.segmentContainer}>
                  {['all', 'Game', 'Clone', 'Social'].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.segBtn, selectedCategory === cat && styles.segBtnActive]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <Text
                        style={[styles.segBtnText, selectedCategory === cat && styles.segBtnTextActive]}
                      >
                        {cat === 'all' ? 'Tất cả' : cat === 'Clone' ? 'Clone/Smurf' : cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Inset Grouped Accounts List */}
              <View style={styles.sectionWrap}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 12 }}>
                  <Text style={[styles.sectionCaption, { marginLeft: 0, marginBottom: 0 }]}>
                    TÀI KHOẢN ĐÃ LƯU ({filteredAccounts.length})
                  </Text>
                  <Text style={{ color: '#0A84FF', fontSize: 11.5, fontWeight: '600' }}>Apple Keychain</Text>
                </View>

                <View style={styles.groupedList}>
                  {filteredAccounts.map((acc, index) => (
                    <TouchableOpacity
                      key={acc.id}
                      style={[
                        styles.cellItem,
                        index === filteredAccounts.length - 1 && { borderBottomWidth: 0 },
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
                            backgroundColor: acc.game.includes('Genshin')
                              ? '#2563EB'
                              : acc.game.includes('Honkai')
                              ? '#7C3AED'
                              : acc.game.includes('Valorant')
                              ? '#DC2626'
                              : '#1E293B',
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            acc.game.includes('Genshin')
                              ? 'sparkles'
                              : acc.game.includes('Honkai')
                              ? 'train'
                              : acc.game.includes('Valorant')
                              ? 'shield-half'
                              : 'game-controller'
                          }
                          size={17}
                          color="#fff"
                        />
                      </View>
                      <View style={styles.cellContent}>
                        <Text style={styles.cellTitle} numberOfLines={1}>
                          {acc.title}
                        </Text>
                        <Text style={styles.cellSubtitle}>
                          {acc.game} • {acc.server}
                        </Text>
                      </View>
                      {acc.notes ? (
                        <View style={{ marginRight: 6 }}>
                          <Ionicons name="document-text-outline" size={15} color="#8E8E93" />
                        </View>
                      ) : null}
                      <Ionicons name="chevron-forward" size={16} color="#636366" />
                    </TouchableOpacity>
                  ))}
                </View>
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
                  <Text style={styles.largeTitle}>Ứng Dụng</Text>
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

        {/* TAB 2: BẠN BÈ & NHẮN TIN */}
        {currentTab === 'chat' && (
          activeChatFriend ? (
            /* PHÒNG CHAT IMESSAGE */
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1, backgroundColor: '#000000' }}
              keyboardVerticalOffset={0}
            >
              {/* Chat Nav Bar */}
              <View style={styles.fullScreenNavBar}>
                <TouchableOpacity
                  onPress={() => { setActiveChatFriend(null); setChatInputText(''); }}
                  style={styles.fullScreenNavBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="chevron-back" size={20} color={appSettings.accentColor} />
                  <Text style={[styles.fullScreenNavBtnText, { color: appSettings.accentColor }]}>Bạn Bè</Text>
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.fullScreenNavTitle} numberOfLines={1}>{activeChatFriend.displayName}</Text>
                  <Text style={{ color: activeChatFriend.status === 'online' ? '#30D158' : '#8E8E93', fontSize: 11 }}>
                    {activeChatFriend.status === 'online' ? '🟢 Đang hoạt động' : '⚪ Ngoại tuyến'}
                  </Text>
                </View>
                <View style={{ width: 70, alignItems: 'flex-end' }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: activeChatFriend.avatarColor, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                      {activeChatFriend.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Chat Messages */}
              <ScrollView
                style={{ flex: 1, paddingHorizontal: 14 }}
                contentContainerStyle={{ paddingVertical: 12, paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
              >
                {(chatMessages[activeChatFriend.id] || []).map((msg) => (
                  <View
                    key={msg.id}
                    style={{
                      alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start',
                      maxWidth: '78%',
                      marginBottom: 8,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: msg.sender === 'me' ? appSettings.accentColor : '#2C2C2E',
                        borderRadius: 18,
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        borderBottomRightRadius: msg.sender === 'me' ? 4 : 18,
                        borderBottomLeftRadius: msg.sender === 'me' ? 18 : 4,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 15, lineHeight: 21 }}>{msg.text}</Text>
                    </View>
                    <Text style={{ color: '#636366', fontSize: 10, marginTop: 3, alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start', marginHorizontal: 6 }}>
                      {msg.time}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              {/* Chat Input Bar */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#1C1C1E', borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)', gap: 8 }}>
                <TextInput
                  style={{ flex: 1, backgroundColor: '#2C2C2E', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', fontSize: 15, maxHeight: 100 }}
                  placeholder="Nhắn tin..."
                  placeholderTextColor="#636366"
                  value={chatInputText}
                  onChangeText={setChatInputText}
                  multiline
                />
                <TouchableOpacity
                  style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: chatInputText.trim() ? appSettings.accentColor : '#3A3A3C', justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => handleSendMessage()}
                  disabled={!chatInputText.trim()}
                >
                  <Ionicons name="arrow-up" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          ) : (
            /* DANH SÁCH BẠN BÈ & TÌM KIẾM USERNAME */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <View style={styles.navHeader}>
                <Text style={styles.largeTitle}>Bạn Bè</Text>
                <Text style={styles.navSubtitle}>Tìm kiếm bằng @username & nhắn tin trực tiếp</Text>
              </View>

              {/* Search Bar */}
              <View style={[styles.searchBarBox, { marginTop: 4 }]}>
                <Ionicons name="search" size={16} color="#8E8E93" style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm bạn bè bằng @username..."
                  placeholderTextColor="#636366"
                  value={friendSearchQuery}
                  onChangeText={setFriendSearchQuery}
                  autoCapitalize="none"
                />
              </View>

              {/* Friends List */}
              <View style={[styles.sectionWrap, { marginTop: 16 }]}>
                <Text style={styles.sectionCaption}>
                  {friendSearchQuery.trim() ? `KẾT QUẢ TÌM KIẾM` : `BẠN BÈ (${friendsList.length})`}
                </Text>
                <View style={styles.groupedList}>
                  {friendsList
                    .filter((f) =>
                      friendSearchQuery.trim()
                        ? f.username.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
                          f.displayName.toLowerCase().includes(friendSearchQuery.toLowerCase())
                        : true
                    )
                    .map((friend, idx, arr) => (
                      <TouchableOpacity
                        key={friend.id}
                        style={[styles.cellItem, idx === arr.length - 1 && { borderBottomWidth: 0 }]}
                        activeOpacity={0.7}
                        onPress={() => {
                          setActiveChatFriend(friend);
                          setChatInputText('');
                        }}
                      >
                        {/* Avatar */}
                        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: friend.avatarColor, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>
                            {friend.displayName.charAt(0).toUpperCase()}
                          </Text>
                          {friend.status === 'online' && (
                            <View style={{ position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#30D158', borderWidth: 2, borderColor: '#1C1C1E' }} />
                          )}
                        </View>

                        {/* Info */}
                        <View style={[styles.cellContent, { flex: 1 }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.cellTitle} numberOfLines={1}>{friend.displayName}</Text>
                            <Text style={{ color: '#636366', fontSize: 12 }}>{friend.lastTime || ''}</Text>
                          </View>
                          <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 1 }}>{friend.username}</Text>
                          {friend.lastMessage ? (
                            <Text style={{ color: '#636366', fontSize: 13, marginTop: 3 }} numberOfLines={1}>{friend.lastMessage}</Text>
                          ) : null}
                        </View>

                        {/* Unread Badge */}
                        {(friend.unreadCount || 0) > 0 && (
                          <View style={{ backgroundColor: appSettings.accentColor, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 }}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{friend.unreadCount}</Text>
                          </View>
                        )}

                        <Ionicons name="chevron-forward" size={16} color="#636366" />
                      </TouchableOpacity>
                    ))}
                </View>

                {friendsList.filter((f) => friendSearchQuery.trim() ? f.username.toLowerCase().includes(friendSearchQuery.toLowerCase()) || f.displayName.toLowerCase().includes(friendSearchQuery.toLowerCase()) : true).length === 0 && (
                  <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                    <Ionicons name="person-outline" size={40} color="#636366" />
                    <Text style={{ color: '#8E8E93', fontSize: 14, marginTop: 8 }}>Không tìm thấy @username nào phù hợp</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )
        )}

        {/* TAB 3: CÁ NHÂN (PROFILE) */}
        {currentTab === 'profile' && (
          profileSubView === 'change_password' ? (
            /* MÀN HÌNH ĐỔI MẬT KHẨU */
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#000000' }}>
              <View style={styles.fullScreenNavBar}>
                <TouchableOpacity onPress={() => setProfileSubView('main')} style={styles.fullScreenNavBtn}>
                  <Ionicons name="chevron-back" size={20} color={appSettings.accentColor} />
                  <Text style={[styles.fullScreenNavBtnText, { color: appSettings.accentColor }]}>Cá Nhân</Text>
                </TouchableOpacity>
                <Text style={styles.fullScreenNavTitle}>Đổi Mật Khẩu</Text>
                <TouchableOpacity onPress={handleChangePassword} style={styles.fullScreenNavBtn}>
                  <Text style={[styles.fullScreenNavBtnText, { color: appSettings.accentColor, fontWeight: '700' }]}>Lưu</Text>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
                <View style={styles.groupedList}>
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Mật khẩu hiện tại</Text>
                    <TextInput style={styles.formInput} secureTextEntry placeholder="Nhập mật khẩu cũ" placeholderTextColor="#636366" value={currentPassInput} onChangeText={setCurrentPassInput} />
                  </View>
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Mật khẩu mới</Text>
                    <TextInput style={styles.formInput} secureTextEntry placeholder="Nhập mật khẩu mới" placeholderTextColor="#636366" value={newPassInput} onChangeText={setNewPassInput} />
                  </View>
                  <View style={[styles.formRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.formLabel}>Xác nhận lại</Text>
                    <TextInput style={styles.formInput} secureTextEntry placeholder="Nhập lại lần nữa" placeholderTextColor="#636366" value={confirmNewPassInput} onChangeText={setConfirmNewPassInput} />
                  </View>
                </View>
                {/* Password Strength Meter */}
                {newPassInput.length > 0 && (
                  <View style={{ marginTop: 14 }}>
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: '#2C2C2E', overflow: 'hidden' }}>
                      <View style={{ height: '100%', width: `${Math.min(100, Math.max(10, newPassInput.length * 8))}%`, backgroundColor: newPassInput.length < 6 ? '#FF453A' : newPassInput.length < 10 ? '#FF9F0A' : '#30D158', borderRadius: 2 }} />
                    </View>
                    <Text style={{ color: newPassInput.length < 6 ? '#FF453A' : newPassInput.length < 10 ? '#FF9F0A' : '#30D158', fontSize: 12, marginTop: 6, fontWeight: '600' }}>
                      {newPassInput.length < 6 ? '⚠️ Yếu — Cần thêm ký tự' : newPassInput.length < 10 ? '🔸 Trung bình' : '✅ Rất mạnh'}
                    </Text>
                  </View>
                )}
                <TouchableOpacity style={[styles.btnStartNow, { marginTop: 24, backgroundColor: appSettings.accentColor }]} activeOpacity={0.85} onPress={handleChangePassword}>
                  <Ionicons name="key" size={17} color="#000" />
                  <Text style={styles.btnStartNowText}>Cập Nhật Mật Khẩu Mới</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : profileSubView === 'edit_profile' ? (
            /* MÀN HÌNH CHỈNH SỬA HỒ SƠ */
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#000000' }}>
              <View style={styles.fullScreenNavBar}>
                <TouchableOpacity onPress={() => setProfileSubView('main')} style={styles.fullScreenNavBtn}>
                  <Ionicons name="chevron-back" size={20} color={appSettings.accentColor} />
                  <Text style={[styles.fullScreenNavBtnText, { color: appSettings.accentColor }]}>Hủy</Text>
                </TouchableOpacity>
                <Text style={styles.fullScreenNavTitle}>Chỉnh Sửa Hồ Sơ</Text>
                <TouchableOpacity onPress={handleSaveEditProfile} style={styles.fullScreenNavBtn}>
                  <Text style={[styles.fullScreenNavBtnText, { color: appSettings.accentColor, fontWeight: '700' }]}>Lưu</Text>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
                <View style={{ alignItems: 'center', marginVertical: 16 }}>
                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: userProfile.avatarColor, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 32 }}>{editDisplayNameInput.charAt(0).toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.groupedList}>
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Tên hiển thị</Text>
                    <TextInput style={styles.formInput} placeholder="VD: Admin LockX" placeholderTextColor="#636366" value={editDisplayNameInput} onChangeText={setEditDisplayNameInput} />
                  </View>
                  <View style={[styles.formRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.formLabel}>Username</Text>
                    <TextInput style={styles.formInput} placeholder="@admin_lockx" placeholderTextColor="#636366" value={editUsernameInput} onChangeText={setEditUsernameInput} autoCapitalize="none" />
                  </View>
                </View>
                <TouchableOpacity style={[styles.btnStartNow, { marginTop: 24, backgroundColor: appSettings.accentColor }]} activeOpacity={0.85} onPress={handleSaveEditProfile}>
                  <Ionicons name="checkmark-circle" size={17} color="#000" />
                  <Text style={styles.btnStartNowText}>Lưu Hồ Sơ</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : (
            /* MÀN HÌNH CÁ NHÂN CHÍNH */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <View style={styles.navHeader}>
                <Text style={styles.largeTitle}>Cá Nhân</Text>
              </View>

              {/* User Profile Card */}
              <View style={[styles.screenTimeCard, { alignItems: 'center', paddingVertical: 24 }]}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: userProfile.avatarColor, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 28 }}>{userProfile.displayName.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{userProfile.displayName}</Text>
                <Text style={{ color: '#8E8E93', fontSize: 14, marginTop: 3 }}>{userProfile.username}</Text>
                <View style={[styles.homeProBadge, { marginTop: 8, paddingHorizontal: 12, paddingVertical: 4 }]}>
                  <Text style={[styles.homeProBadgeText, { fontSize: 11 }]}>PRO MEMBER</Text>
                </View>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' }}
                  onPress={() => {
                    setEditDisplayNameInput(userProfile.displayName);
                    setEditUsernameInput(userProfile.username);
                    setProfileSubView('edit_profile');
                  }}
                >
                  <Ionicons name="pencil" size={14} color={appSettings.accentColor} />
                  <Text style={{ color: appSettings.accentColor, fontSize: 13, fontWeight: '600' }}>Chỉnh sửa hồ sơ</Text>
                </TouchableOpacity>
              </View>

              {/* Usage Stats Cards */}
              <View style={styles.homeStatsRow}>
                <View style={styles.homeStatCard}>
                  <View style={[styles.homeStatIconWrap, { backgroundColor: 'rgba(48,209,88,0.15)' }]}>
                    <Ionicons name="calendar" size={18} color="#30D158" />
                  </View>
                  <Text style={styles.homeStatNumber}>{userProfile.joinDate}</Text>
                  <Text style={styles.homeStatLabel}>Ngày gia nhập</Text>
                </View>
                <View style={styles.homeStatCard}>
                  <View style={[styles.homeStatIconWrap, { backgroundColor: `${appSettings.accentColor}25` }]}>
                    <Ionicons name="time" size={18} color={appSettings.accentColor} />
                  </View>
                  <Text style={styles.homeStatNumber}>{userProfile.daysActive}</Text>
                  <Text style={styles.homeStatLabel}>Ngày đồng hành</Text>
                </View>
                <View style={styles.homeStatCard}>
                  <View style={[styles.homeStatIconWrap, { backgroundColor: 'rgba(191,90,242,0.15)' }]}>
                    <Ionicons name="hourglass" size={18} color="#BF5AF2" />
                  </View>
                  <Text style={styles.homeStatNumber}>{userProfile.hoursUsed}h</Text>
                  <Text style={styles.homeStatLabel}>Giờ hoạt động</Text>
                </View>
              </View>

              {/* Quick Actions */}
              <View style={[styles.sectionWrap, { marginTop: 16 }]}>
                <Text style={styles.sectionCaption}>BẢO MẬT TÀI KHOẢN</Text>
                <View style={styles.groupedList}>
                  <TouchableOpacity style={styles.cellItem} onPress={() => { setCurrentPassInput(''); setNewPassInput(''); setConfirmNewPassInput(''); setProfileSubView('change_password'); }}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF9500' }]}>
                      <Ionicons name="key" size={17} color="#fff" />
                    </View>
                    <View style={styles.cellContent}>
                      <Text style={styles.cellTitle}>Đổi Mật Khẩu</Text>
                      <Text style={styles.cellSubtitle}>Cập nhật mật khẩu bảo vệ tài khoản</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#636366" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cellItem, { borderBottomWidth: 0 }]} onPress={handleClearOtherSessions}>
                    <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF3B30' }]}>
                      <Ionicons name="log-out" size={17} color="#fff" />
                    </View>
                    <View style={styles.cellContent}>
                      <Text style={styles.cellTitle}>Đăng Xuất Thiết Bị Khác</Text>
                      <Text style={styles.cellSubtitle}>Kết thúc phiên đăng nhập trên các máy khác</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#636366" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Login History */}
              <View style={[styles.sectionWrap, { marginTop: 16 }]}>
                <Text style={styles.sectionCaption}>LỊCH SỬ ĐĂNG NHẬP ({loginHistory.length})</Text>
                <View style={styles.groupedList}>
                  {loginHistory.slice(0, 5).map((log, idx) => (
                    <View key={log.id} style={[styles.cellItem, idx === Math.min(4, loginHistory.length - 1) && { borderBottomWidth: 0 }]}>
                      <View style={[styles.cellLeadingIcon, { backgroundColor: log.method === 'Face ID' ? '#30D158' : log.method === 'Passcode' ? '#FF9500' : '#0A84FF' }]}>
                        <Ionicons name={log.method === 'Face ID' ? 'happy' : log.method === 'Passcode' ? 'keypad' : 'lock-closed'} size={17} color="#fff" />
                      </View>
                      <View style={[styles.cellContent, { flex: 1 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.cellTitle} numberOfLines={1}>{log.device}</Text>
                          <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                            <Text style={{ color: '#8E8E93', fontSize: 10 }}>{log.method}</Text>
                          </View>
                        </View>
                        <Text style={styles.cellSubtitle}>{log.timestamp} • {log.location}</Text>
                        <Text style={{ color: '#636366', fontSize: 11, fontFamily: 'monospace' }}>{log.ip}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          )
        )}

        {/* TAB 4: CÀI ĐẶT MỞ RỘNG */}
        {currentTab === 'settings' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.navHeader}>
              <Text style={styles.largeTitle}>Cài Đặt</Text>
              <Text style={styles.navSubtitle}>Tùy biến giao diện, ngôn ngữ & hiệu suất</Text>
            </View>

            {/* Accent Color Picker */}
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionCaption}>MÀU GIAO DIỆN (ACCENT COLOR)</Text>
              <View style={[styles.groupedList, { padding: 16 }]}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {ACCENT_COLOR_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => saveAppSettings({ ...appSettings, accentColor: opt.color })}
                      style={{ alignItems: 'center', gap: 4 }}
                    >
                      <View style={{
                        width: 40, height: 40, borderRadius: 20, backgroundColor: opt.color,
                        borderWidth: appSettings.accentColor === opt.color ? 3 : 0,
                        borderColor: '#FFFFFF',
                        justifyContent: 'center', alignItems: 'center',
                      }}>
                        {appSettings.accentColor === opt.color && (
                          <Ionicons name="checkmark" size={20} color="#fff" />
                        )}
                      </View>
                      <Text style={{ color: appSettings.accentColor === opt.color ? '#fff' : '#8E8E93', fontSize: 10, fontWeight: '600' }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Theme Mode */}
            <View style={[styles.sectionWrap, { marginTop: 16 }]}>
              <Text style={styles.sectionCaption}>CHẾ ĐỘ MÀN HÌNH</Text>
              <View style={styles.groupedList}>
                <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                  <View style={[styles.cellLeadingIcon, { backgroundColor: '#5856D6' }]}>
                    <Ionicons name={appSettings.themeMode === 'dark' ? 'moon' : 'sunny'} size={17} color="#fff" />
                  </View>
                  <View style={[styles.cellContent, { flex: 1 }]}>
                    <Text style={styles.cellTitle}>Chế Độ Sáng / Tối</Text>
                    <Text style={styles.cellSubtitle}>{appSettings.themeMode === 'dark' ? 'Đang dùng: Tối (Dark Mode)' : 'Đang dùng: Sáng (Light Mode)'}</Text>
                  </View>
                  <Switch
                    value={appSettings.themeMode === 'dark'}
                    onValueChange={(v) => {
                      saveAppSettings({ ...appSettings, themeMode: v ? 'dark' : 'light' });
                      triggerToast(v ? '🌙 Đã bật chế độ tối' : '☀️ Đã bật chế độ sáng');
                    }}
                    trackColor={{ false: '#39393D', true: '#30D158' }}
                  />
                </View>
              </View>
            </View>

            {/* Font Size */}
            <View style={[styles.sectionWrap, { marginTop: 16 }]}>
              <Text style={styles.sectionCaption}>CỠ CHỮ</Text>
              <View style={[styles.groupedList, { padding: 14 }]}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {([
                    { id: 'small' as const, label: 'Nhỏ (90%)', icon: 'text' },
                    { id: 'standard' as const, label: 'Vừa (100%)', icon: 'text' },
                    { id: 'large' as const, label: 'Lớn (115%)', icon: 'text' },
                  ] as const).map((sz) => (
                    <TouchableOpacity
                      key={sz.id}
                      style={{
                        flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                        backgroundColor: appSettings.fontSizeScale === sz.id ? appSettings.accentColor : '#2C2C2E',
                      }}
                      onPress={() => {
                        saveAppSettings({ ...appSettings, fontSizeScale: sz.id });
                        triggerToast(`Cỡ chữ: ${sz.label}`);
                      }}
                    >
                      <Text style={{
                        color: appSettings.fontSizeScale === sz.id ? '#000' : '#fff',
                        fontWeight: '700', fontSize: sz.id === 'small' ? 11 : sz.id === 'large' ? 14 : 12.5,
                      }}>
                        {sz.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Bold Text */}
            <View style={[styles.sectionWrap, { marginTop: 16 }]}>
              <Text style={styles.sectionCaption}>HIỂN THỊ</Text>
              <View style={styles.groupedList}>
                <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                  <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF9500' }]}>
                    <Ionicons name="text" size={17} color="#fff" />
                  </View>
                  <View style={[styles.cellContent, { flex: 1 }]}>
                    <Text style={[styles.cellTitle, appSettings.isBoldText && { fontWeight: '900' }]}>Chữ In Đậm</Text>
                    <Text style={styles.cellSubtitle}>Tăng khả năng đọc cho mọi văn bản</Text>
                  </View>
                  <Switch
                    value={appSettings.isBoldText}
                    onValueChange={(v) => {
                      saveAppSettings({ ...appSettings, isBoldText: v });
                      triggerToast(v ? '𝗕 Đã bật chữ đậm' : 'Đã tắt chữ đậm');
                    }}
                    trackColor={{ false: '#39393D', true: '#30D158' }}
                  />
                </View>
              </View>
            </View>

            {/* Language */}
            <View style={[styles.sectionWrap, { marginTop: 16 }]}>
              <Text style={styles.sectionCaption}>NGÔN NGỮ</Text>
              <View style={styles.groupedList}>
                {[
                  { id: 'vi' as const, label: 'Tiếng Việt', flag: '🇻🇳' },
                  { id: 'en' as const, label: 'English', flag: '🇬🇧' },
                  { id: 'zh' as const, label: '简体中文', flag: '🇨🇳' },
                ].map((lang, idx) => (
                  <TouchableOpacity
                    key={lang.id}
                    style={[styles.cellItem, idx === 2 && { borderBottomWidth: 0 }]}
                    onPress={() => {
                      saveAppSettings({ ...appSettings, language: lang.id });
                      setSelectedLanguage(lang.id);
                      triggerToast(`Ngôn ngữ: ${lang.label}`);
                    }}
                  >
                    <Text style={{ fontSize: 22, marginRight: 10 }}>{lang.flag}</Text>
                    <View style={[styles.cellContent, { flex: 1 }]}>
                      <Text style={styles.cellTitle}>{lang.label}</Text>
                    </View>
                    {appSettings.language === lang.id && (
                      <Ionicons name="checkmark-circle" size={22} color={appSettings.accentColor} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* System Tools & Reset */}
            <View style={[styles.sectionWrap, { marginTop: 16 }]}>
              <Text style={styles.sectionCaption}>HỆ THỐNG & DỮ LIỆU</Text>
              <View style={styles.groupedList}>
                <TouchableOpacity style={styles.cellItem} onPress={() => triggerSplashFlow()}>
                  <View style={[styles.cellLeadingIcon, { backgroundColor: '#007AFF' }]}>
                    <Ionicons name="play-circle" size={17} color="#fff" />
                  </View>
                  <View style={styles.cellContent}>
                    <Text style={styles.cellTitle}>Xem Lại Màn Hình Tương Thích</Text>
                    <Text style={styles.cellSubtitle}>Hiển thị lại giao diện kiểm tra thiết bị</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#636366" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cellItem, { borderBottomWidth: 0 }]}
                  onPress={() => {
                    Alert.alert('Đặt lại dữ liệu', 'Đặt lại toàn bộ trạng thái onboarding?', [
                      { text: 'Hủy', style: 'cancel' },
                      { text: 'Đặt lại', style: 'destructive', onPress: async () => { try { await AsyncStorage.removeItem('lockx_has_onboarded'); triggerToast('Đã đặt lại Onboarding.'); } catch (e) {} } },
                    ]);
                  }}
                >
                  <View style={[styles.cellLeadingIcon, { backgroundColor: '#FF3B30' }]}>
                    <Ionicons name="refresh" size={17} color="#fff" />
                  </View>
                  <View style={styles.cellContent}>
                    <Text style={[styles.cellTitle, { color: '#FF3B30' }]}>Đặt Lại Onboarding</Text>
                    <Text style={styles.cellSubtitle}>Lần mở app sau sẽ chạy lại intro</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Build Info */}
            <View style={[styles.sectionWrap, { marginTop: 16 }]}>
              <Text style={styles.sectionCaption}>THÔNG TIN BẢN DỰNG</Text>
              <View style={styles.groupedList}>
                <View style={styles.cellItem}>
                  <Text style={{ color: '#fff', fontSize: 14 }}>Tên ứng dụng</Text>
                  <Text style={{ color: '#8E8E93', fontSize: 14, fontWeight: '700' }}>LockX</Text>
                </View>
                <View style={styles.cellItem}>
                  <Text style={{ color: '#fff', fontSize: 14 }}>Phiên bản</Text>
                  <Text style={{ color: '#8E8E93', fontSize: 14 }}>2.0.0 (Build 200)</Text>
                </View>
                <View style={[styles.cellItem, { borderBottomWidth: 0 }]}>
                  <Text style={{ color: '#fff', fontSize: 14 }}>Mã hóa</Text>
                  <Text style={{ color: '#8E8E93', fontSize: 14 }}>Apple Keychain AES-256</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Bottom Native Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { key: 'vault', label: 'Két Sắt', icon: 'shield' },
          { key: 'apps', label: 'Ứng Dụng', icon: 'apps' },
          { key: 'chat', label: 'Bạn Bè', icon: 'chatbubbles' },
          { key: 'profile', label: 'Cá Nhân', icon: 'person' },
          { key: 'settings', label: 'Cài Đặt', icon: 'settings' },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={styles.tabItem}
            onPress={() => {
              if (t.key === 'vault' && currentTab === 'vault') {
                setVaultSubView('list');
                setSelectedAccount(null);
              }
              if (t.key === 'profile' && currentTab === 'profile') {
                setProfileSubView('main');
              }
              if (t.key === 'chat' && currentTab === 'chat') {
                setActiveChatFriend(null);
              }
              setCurrentTab(t.key as any);
            }}
          >
            <Ionicons
              name={(t.icon + (currentTab === t.key ? '' : '-outline')) as any}
              size={22}
              color={currentTab === t.key ? '#0A84FF' : '#8E8E93'}
            />
            <Text
              style={[
                styles.tabLabel,
                currentTab === t.key && { color: '#0A84FF', fontWeight: '600' },
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
    </SafeAreaView>
  );
}

// =========================================================================
// STYLES (Apple Human Interface Guidelines Dark Theme + Onboarding)
// =========================================================================
const styles = StyleSheet.create({
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
    backgroundColor: '#000000',
  },
  mainContent: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
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
    color: '#FFFFFF',
    fontSize: 22,
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
    color: '#8E8E93',
    fontSize: 12,
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
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  homeStatLabel: {
    color: '#8E8E93',
    fontSize: 11,
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  homeQuickActionText: {
    color: '#FFFFFF',
    fontSize: 11.5,
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
    backgroundColor: '#0A84FF',
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
    backgroundColor: '#0A84FF',
    borderColor: '#0A84FF',
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
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(10, 132, 255, 0.3)',
  },
  btnAppOpenText: {
    color: '#0A84FF',
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
    backgroundColor: '#0A84FF',
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
    backgroundColor: '#0A84FF',
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
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  navSubtitle: {
    color: '#8E8E93',
    fontSize: 13,
    marginTop: 4,
  },
  circlePlusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarBox: {
    backgroundColor: '#1C1C1E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 10,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
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
    backgroundColor: '#3A3A3C',
  },
  segBtnText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  segBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sectionWrap: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionCaption: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 12,
  },
  groupedList: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    overflow: 'hidden',
  },
  cellItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
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
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  cellSubtitle: {
    color: '#8E8E93',
    fontSize: 12,
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
    backgroundColor: 'rgba(20,20,22,0.95)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 8,
  },
  tabItem: {
    alignItems: 'center',
    gap: 3,
  },
  tabLabel: {
    color: '#8E8E93',
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
    backgroundColor: '#1C1C1E',
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
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sheetBtnBlue: {
    color: '#0A84FF',
    fontSize: 15,
  },
  detailLabel: {
    color: '#8E8E93',
    width: 90,
    fontSize: 14,
  },
  detailVal: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
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
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  formLabel: {
    color: '#FFFFFF',
    width: 100,
    fontSize: 14,
  },
  formInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },

  // Dedicated Full Screen Vault Sub-views
  fullScreenNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2C2C2E',
    backgroundColor: '#000000',
  },
  fullScreenNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  fullScreenNavBtnText: {
    color: '#0A84FF',
    fontSize: 16,
    fontWeight: '500',
  },
  fullScreenNavTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  noteInputCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  formInputMultiline: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Apple Screen Time Styles
  screenTimeCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  screenTimeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  screenTimeSubLabel: {
    color: '#8E8E93',
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  screenTimeBigText: {
    color: '#FFFFFF',
    fontSize: 26,
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
