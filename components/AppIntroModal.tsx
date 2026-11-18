import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  TouchableOpacity,
  Easing,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AppIntroModalProps {
  visible: boolean;
  onFinish: () => void;
  initialMode?: 'auto' | 'phone_ipa' | 'web';
}

export const AppIntroModal: React.FC<AppIntroModalProps> = ({
  visible,
  onFinish,
  initialMode = 'auto',
}) => {
  // Mode: 1 = 'phone_ipa' (Điện thoại iOS / IPA), 2 = 'web' (Trình duyệt Web máy tính / Safari)
  const defaultMode =
    initialMode === 'auto'
      ? Platform.OS === 'web' && Dimensions.get('window').width > 600
        ? 'web'
        : 'phone_ipa'
      : initialMode;

  const [introMode, setIntroMode] = useState<'phone_ipa' | 'web'>(defaultMode);

  // Animation values
  const overlayFade = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoGlow = useRef(new Animated.Value(0.6)).current;
  const textTranslateY = useRef(new Animated.Value(28)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const progressFill = useRef(new Animated.Value(0)).current;
  const progressPercentVal = useRef(0);
  const [displayPercent, setDisplayPercent] = useState<number>(0);
  const [loadingStepText, setLoadingStepText] = useState<string>('Khởi tạo nhân bảo mật...');

  const startAnimation = (mode: 'phone_ipa' | 'web') => {
    // Reset values
    overlayFade.setValue(1);
    logoScale.setValue(mode === 'phone_ipa' ? 0.35 : 0.6);
    logoOpacity.setValue(0);
    textTranslateY.setValue(24);
    textOpacity.setValue(0);
    badgeScale.setValue(0);
    progressFill.setValue(0);
    setDisplayPercent(0);

    const stepTexts =
      mode === 'phone_ipa'
        ? [
            'Kiểm tra chứng chỉ IPA (Enterprise / TrollStore)...',
            'Kích hoạt Secure Enclave & Face ID native...',
            'Đồng bộ hóa kho khóa AES-256 nội bộ...',
            'Đã sẵn sàng trên thiết bị iPhone!',
          ]
        : [
            'Kết nối máy chủ mã hóa LockX Web Cloud...',
            'Tải bộ nhớ cache ứng dụng siêu tốc PWA...',
            'Xác thực phiên bảo mật đám mây 2FA...',
            'Môi trường Web đã sẵn sàng!',
          ];

    setLoadingStepText(stepTexts[0]);

    // 1. Logo & Badge Pop
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(badgeScale, {
        toValue: 1,
        friction: 5,
        tension: 100,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 400,
        delay: 250,
        useNativeDriver: true,
      }),
      Animated.timing(textTranslateY, {
        toValue: 0,
        duration: 400,
        delay: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Loop logo breathing glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlow, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(logoGlow, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    // 2. Progress loader animation
    const progressDuration = mode === 'phone_ipa' ? 1900 : 1600;
    
    // Update percentage counter state smoothly
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const fraction = Math.min(elapsed / progressDuration, 1);
      const currentPct = Math.round(fraction * 100);
      setDisplayPercent(currentPct);

      if (fraction < 0.3) {
        setLoadingStepText(stepTexts[0]);
      } else if (fraction < 0.65) {
        setLoadingStepText(stepTexts[1]);
      } else if (fraction < 0.95) {
        setLoadingStepText(stepTexts[2]);
      } else {
        setLoadingStepText(stepTexts[3]);
      }

      if (fraction >= 1) {
        clearInterval(interval);
      }
    }, 40);

    Animated.timing(progressFill, {
      toValue: 1,
      duration: progressDuration,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    }).start(() => {
      clearInterval(interval);
      setDisplayPercent(100);
      setLoadingStepText(stepTexts[3]);

      // Fade out dismiss after loaded
      setTimeout(() => {
        Animated.timing(overlayFade, {
          toValue: 0,
          duration: 380,
          useNativeDriver: true,
        }).start(() => {
          onFinish();
        });
      }, 350);
    });
  };

  useEffect(() => {
    if (visible) {
      startAnimation(introMode);
    }
  }, [visible, introMode]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.overlayRoot,
        {
          opacity: overlayFade,
          backgroundColor: introMode === 'phone_ipa' ? '#020617' : '#050D1A',
        },
      ]}
    >
      {/* Background Ambience Neon Glow */}
      <View
        pointerEvents="none"
        style={[
          styles.glowCircleTop,
          {
            backgroundColor:
              introMode === 'phone_ipa'
                ? 'rgba(0, 122, 255, 0.22)'
                : 'rgba(56, 189, 248, 0.25)',
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.glowCircleBottom,
          {
            backgroundColor:
              introMode === 'phone_ipa'
                ? 'rgba(48, 209, 88, 0.15)'
                : 'rgba(99, 102, 241, 0.20)',
          },
        ]}
      />

      {/* Top Segment Switcher: Chuyển đổi linh hoạt giữa 2 phong cách intro */}
      <View style={styles.topModeBar}>
        <View style={styles.modeSegmentContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIntroMode('phone_ipa')}
            style={[
              styles.modeTab,
              introMode === 'phone_ipa' && styles.modeTabActivePhone,
            ]}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={14}
              color={introMode === 'phone_ipa' ? '#FFFFFF' : '#94A3B8'}
            />
            <Text
              style={[
                styles.modeTabText,
                introMode === 'phone_ipa' && styles.modeTabTextActive,
              ]}
            >
              1. Điện thoại (IPA iOS)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIntroMode('web')}
            style={[
              styles.modeTab,
              introMode === 'web' && styles.modeTabActiveWeb,
            ]}
          >
            <Ionicons
              name="globe-outline"
              size={14}
              color={introMode === 'web' ? '#FFFFFF' : '#94A3B8'}
            />
            <Text
              style={[
                styles.modeTabText,
                introMode === 'web' && styles.modeTabTextActive,
              ]}
            >
              2. Trình duyệt (Web)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Nút Bỏ Qua Intro */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onFinish}
          style={styles.skipBtn}
        >
          <Text style={styles.skipBtnText}>Bỏ qua</Text>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* Main Center Intro Body */}
      <View style={styles.centerContainer}>
        {/* Animated App Icon & Holographic Halo */}
        <Animated.View
          style={[
            styles.logoWrap,
            {
              transform: [{ scale: logoScale }],
              opacity: logoOpacity,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.logoHaloPulse,
              {
                opacity: logoGlow,
                borderColor:
                  introMode === 'phone_ipa' ? '#007AFF' : '#38BDF8',
              },
            ]}
          />
          <View
            style={[
              styles.logoInnerBox,
              {
                borderColor:
                  introMode === 'phone_ipa'
                    ? 'rgba(0,122,255,0.45)'
                    : 'rgba(56,189,248,0.5)',
              },
            ]}
          >
            <Image
              source={require('../assets/icon.png')}
              style={styles.logoImage}
              resizeMode="cover"
            />
          </View>
        </Animated.View>

        {/* Badge Label: Phone IPA vs Web App */}
        <Animated.View
          style={[
            styles.platformBadge,
            {
              transform: [{ scale: badgeScale }],
              backgroundColor:
                introMode === 'phone_ipa'
                  ? 'rgba(0, 122, 255, 0.16)'
                  : 'rgba(56, 189, 248, 0.16)',
              borderColor:
                introMode === 'phone_ipa'
                  ? 'rgba(0, 122, 255, 0.45)'
                  : 'rgba(56, 189, 248, 0.45)',
            },
          ]}
        >
          <Ionicons
            name={
              introMode === 'phone_ipa'
                ? 'shield-checkmark'
                : 'cloud-done-outline'
            }
            size={13}
            color={introMode === 'phone_ipa' ? '#38BDF8' : '#34D399'}
          />
          <Text
            style={[
              styles.platformBadgeText,
              {
                color:
                  introMode === 'phone_ipa' ? '#38BDF8' : '#34D399',
              },
            ]}
          >
            {introMode === 'phone_ipa'
              ? 'NATIVE IOS IPA BUILD • APPLE SECURE'
              : 'LOCKX WEB CLOUD EDITION • ZERO-INSTALL'}
          </Text>
        </Animated.View>

        {/* Brand App Name */}
        <Animated.View
          style={{
            transform: [{ translateY: textTranslateY }],
            opacity: textOpacity,
            alignItems: 'center',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.brandTitleText}>LockX</Text>
            <View
              style={[
                styles.proPill,
                {
                  backgroundColor:
                    introMode === 'phone_ipa' ? '#007AFF' : '#0284C7',
                },
              ]}
            >
              <Text style={styles.proPillText}>
                {introMode === 'phone_ipa' ? 'IPA' : 'WEB'}
              </Text>
            </View>
          </View>

          <Text style={styles.brandSlogan}>
            {introMode === 'phone_ipa'
              ? 'Két sắt bảo mật & Hệ sinh thái tài chính trên iPhone'
              : 'Nền tảng quản lý tài khoản & Banking trực tuyến bảo mật'}
          </Text>
        </Animated.View>

        {/* Loader Progress Block */}
        <View style={styles.progressSection}>
          <View style={styles.progressInfoRow}>
            <Text style={styles.stepTitleText} numberOfLines={1}>
              {loadingStepText}
            </Text>
            <Text style={styles.percentText}>{displayPercent}%</Text>
          </View>

          {/* Progress bar line */}
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressFill.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor:
                    introMode === 'phone_ipa' ? '#0A84FF' : '#38BDF8',
                },
              ]}
            />
          </View>

          {/* Mini Tech Indicator */}
          <View style={styles.techFeatureRow}>
            <View style={styles.techFeatureItem}>
              <Ionicons name="lock-closed" size={11} color="#64748B" />
              <Text style={styles.techFeatureText}>Mã hóa AES-256</Text>
            </View>
            <View style={styles.techFeatureItem}>
              <Ionicons
                name={introMode === 'phone_ipa' ? 'finger-print' : 'shield'}
                size={11}
                color="#64748B"
              />
              <Text style={styles.techFeatureText}>
                {introMode === 'phone_ipa' ? 'Biometrics' : 'SSL TLS 1.3'}
              </Text>
            </View>
            <View style={styles.techFeatureItem}>
              <Ionicons name="flash" size={11} color="#64748B" />
              <Text style={styles.techFeatureText}>Ultra Fast Engine</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Footer Info */}
      <View style={styles.bottomFooterInfo}>
        <Text style={styles.footerCopyright}>
          © 2026 LockX Corporation. All Rights Reserved.
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlayRoot: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999999,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'ios' ? 44 : 20,
    paddingHorizontal: 20,
  },
  glowCircleTop: {
    position: 'absolute',
    top: -90,
    width: 320,
    height: 320,
    borderRadius: 160,
    filter: Platform.OS === 'web' ? 'blur(90px)' : undefined,
  } as any,
  glowCircleBottom: {
    position: 'absolute',
    bottom: -110,
    right: -50,
    width: 340,
    height: 340,
    borderRadius: 170,
    filter: Platform.OS === 'web' ? 'blur(100px)' : undefined,
  } as any,
  topModeBar: {
    width: '100%',
    maxWidth: 500,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    zIndex: 10,
  },
  modeSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  modeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 11,
  },
  modeTabActivePhone: {
    backgroundColor: '#007AFF',
  },
  modeTabActiveWeb: {
    backgroundColor: '#0284C7',
  },
  modeTabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  modeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 4,
  },
  skipBtnText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 420,
    marginVertical: 'auto',
  },
  logoWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoHaloPulse: {
    position: 'absolute',
    width: 124,
    height: 124,
    borderRadius: 36,
    borderWidth: 2,
  },
  logoInnerBox: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    marginBottom: 14,
  },
  platformBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  brandTitleText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  proPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  proPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  brandSlogan: {
    fontSize: 12.5,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 18,
    fontWeight: '500',
  },
  progressSection: {
    width: '100%',
    maxWidth: 320,
    marginTop: 34,
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepTitleText: {
    fontSize: 11.5,
    color: '#CBD5E1',
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  percentText: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  progressBarTrack: {
    width: '100%',
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  techFeatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  techFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  techFeatureText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  bottomFooterInfo: {
    alignItems: 'center',
    marginBottom: 10,
  },
  footerCopyright: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
});

export default AppIntroModal;
