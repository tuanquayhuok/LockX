import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  Line,
  Circle,
  G,
  Mask,
} from 'react-native-svg';

interface SvgIconProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
  color?: string;
}

/**
 * Biểu tượng vector SVG chính thức của LockX Vault
 * Thiết kế chuẩn Apple Human Interface Guidelines: Tối giản, sang trọng, chuẩn vector 100%
 */
export const LockXLogoSvg: React.FC<SvgIconProps> = ({ size = 64, style }) => {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg viewBox="0 0 1024 1024" width="100%" height="100%">
        <Defs>
          <LinearGradient id="lxBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#050811" />
            <Stop offset="100%" stopColor="#0A1120" />
          </LinearGradient>
          <LinearGradient id="lxSquircle" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#0E1B33" />
            <Stop offset="100%" stopColor="#060C17" />
          </LinearGradient>
          <LinearGradient id="lxBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#0A84FF" />
            <Stop offset="100%" stopColor="#5E5CE6" />
          </LinearGradient>
        </Defs>

        {/* Squircle nền */}
        <Rect
          x="70"
          y="70"
          width="884"
          height="884"
          rx="210"
          ry="210"
          fill="url(#lxSquircle)"
          stroke="#0A84FF"
          strokeWidth="6"
          strokeOpacity="0.35"
        />

        {/* Quai khóa Titan Apple */}
        <Path
          d="M 367 480 L 367 380 A 145 145 0 0 1 657 380 L 657 480"
          fill="none"
          stroke="#38BDF8"
          strokeWidth="48"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Thân Két Sắt Vault */}
        <Rect
          x="290"
          y="440"
          width="444"
          height="380"
          rx="75"
          ry="75"
          fill="url(#lxBody)"
          stroke="#FFFFFF"
          strokeWidth="4"
          strokeOpacity="0.4"
        />

        {/* Biểu tượng chữ X cách điệu */}
        <Line
          x1="437"
          y1="550"
          x2="587"
          y2="700"
          stroke="#FFFFFF"
          strokeWidth="40"
          strokeLinecap="round"
        />
        <Line
          x1="587"
          y1="550"
          x2="437"
          y2="700"
          stroke="#FFFFFF"
          strokeWidth="40"
          strokeLinecap="round"
        />

        {/* Lõi bảo mật trung tâm */}
        <Circle
          cx="512"
          cy="625"
          r="34"
          fill="#0A84FF"
          stroke="#FFFFFF"
          strokeWidth="9"
        />
      </Svg>
    </View>
  );
};

/**
 * Biểu tượng Apple Face ID chuẩn vector SVG sắc nét
 */
export const AppleFaceIdSvg: React.FC<SvgIconProps> = ({ size = 32, color = '#30D158', style }) => {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg viewBox="0 0 64 64" width="100%" height="100%">
        {/* 4 Góc khung viền Face ID */}
        <Path
          d="M 8 20 L 8 14 A 6 6 0 0 1 14 8 L 20 8"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <Path
          d="M 44 8 L 50 8 A 6 6 0 0 1 56 14 L 56 20"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <Path
          d="M 8 44 L 8 50 A 6 6 0 0 0 14 56 L 20 56"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <Path
          d="M 44 56 L 50 56 A 6 6 0 0 0 56 50 L 56 44"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Đôi mắt */}
        <Line x1="23" y1="23" x2="23" y2="29" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
        <Line x1="41" y1="23" x2="41" y2="29" stroke={color} strokeWidth="3.5" strokeLinecap="round" />

        {/* Chiếc mũi */}
        <Path
          d="M 32 23 L 32 35 L 28 35"
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Nụ cười */}
        <Path
          d="M 23 43 C 27 48 37 48 41 43"
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

/**
 * Biểu tượng ngôi sao 4 cánh Google Gemini AI chuẩn vector SVG
 */
export const GoogleGeminiSvg: React.FC<SvgIconProps> = ({ size = 28, style }) => {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg viewBox="0 0 100 100" width="100%" height="100%">
        <Defs>
          <LinearGradient id="geminiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FF453A" />
            <Stop offset="35%" stopColor="#AF52DE" />
            <Stop offset="70%" stopColor="#0A84FF" />
            <Stop offset="100%" stopColor="#30D158" />
          </LinearGradient>
        </Defs>
        <Path
          d="M 50 0 C 50 27.6 27.6 50 0 50 C 27.6 50 50 72.4 50 100 C 50 72.4 72.4 50 100 50 C 72.4 50 50 27.6 50 0 Z"
          fill="url(#geminiGrad)"
        />
      </Svg>
    </View>
  );
};
