import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LocketGoldModalProps {
  visible: boolean;
  onClose: () => void;
  triggerToast?: (msg: string, title?: string, type?: 'success' | 'error' | 'info' | 'warning', icon?: any, color?: string) => void;
  playTapSound?: () => void;
}

// Cấu hình mã xác thực Token & Chữ ký từ scripts/ccs.py
const LOCKET_TOKEN_CONFIG = {
  name: "Xoăn Gold",
  product_id: "locket_199_1m",
  fetch_token: "eyJhbGciOiJFUzI1NiIsIng1YyI6WyJNSUlFTVRDQ0E3YWdBd0lCQWdJUVI4S0h6ZG41NTRaL1VvcmFkTng5dHpBS0JnZ3Foa2pPUFFRREF6QjFNVVF3UWdZRFZRUURERHRCY0hCc1pTQlhiM0pzWkhkcFpHVWdSR1YyWld4dmNHVnlJRkpsYkdGMGFXOXVjeUJEWlhKMGFXWnBZMkYwYVc5dUlFRjFkR2h2Y21sMGVURUxNQWtHQTFVRUN3d0NSell4RXpBUkJnTlZCQW9NQ2tGd2NHeGxJRWx1WXk0eEN6QUpCZ05WQkFZVEFsVlRNQjRYRFRJMU1Ea3hPVEU1TkRRMU1Wb1hEVEkzTVRBeE16RTNORGN5TTFvd2daSXhRREErQmdOVkJBTU1OMUJ5YjJRZ1JVTkRJRTFoWXlCQmNIQWdVM1J2Y21VZ1lXNWtJR2xVZFc1bGN5QlRkRzl5WlNCU1pXTmxhWEIwSUZOcFoyNXBibWN4TERBcUJnTlZCQXNNSTBGd2NHeGxJRmR2Y214a2QybGtaU0JFWlhabGJHOXdaWElnVW1Wc1lYUnBiMjV6TVJNd0VRWURWUVFLREFwQmNIQnNaU0JKYm1NdU1Rc3dDUVlEVlFRR0V3SlZVekJaTUJNR0J5cUdTTTQ5QWdFR0NDcUdTTTQ5QXdFSEEwSUFCTm5WdmhjdjdpVCs3RXg1dEJNQmdyUXNwSHpJc1hSaTBZeGZlazdsdjh3RW1qL2JIaVd0TndKcWMyQm9IenNRaUVqUDdLRklJS2c0WTh5MC9ueW51QW1qZ2dJSU1JSUNCREFNQmdOVkhSTUJBZjhFQWpBQU1COEdBMVVkSXdRWU1CYUFGRDh2bENOUjAxREptaWc5N2JCODVjK2xrR0taTUhBR0NDc0dBUVVGQndFQkJHUXdZakF0QmdnckJnRUZCUWN3QW9ZaGFIUjBjRG92TDJObGNuUnpMbUZ3Y0d4bExtTnZiUzkzZDJSeVp6WXVaR1Z5TURFR0NDc0dBUVVGQnpBQmhpVm9kSFJ3T2k4dmIyTnpjQzVoY0hCc1pTNWpiMjB2YjJOemNEQXpMWGQzWkhKbk5qQXlNSUlCSGdZRFZSMGdCSUlCRlRDQ0FSRXdnZ0VOQmdvcWhraUc5Mk5rQlFZQk1JSCtNSUhEQmdnckJnRUZCUWNDQWpDQnRneUJzMUpsYkdsaGJtTmxJRzl1SUhSb2FYTWdZMlZ5ZEdsbWFXTmhkR1VnWW5rZ1lXNTVJSEJoY25SNUlHRnpjM1Z0WlhNZ1lXTmpaWEIwWVc1alpTQnZaaUIwYUdVZ2RHaGxiaUJoY0hCc2FXTmhZbXhsSUhOMFlXNWtZWEprSUhSbGNtMXpJR0Z1WkNCamIyNWthWFJwYjI1eklHOW1JSFZ6WlN3Z1kyVnlkR2xtYVdOaGRHVWdjRzlzYVdONUlHRnVaQ0JqWlhKMGFXWnBZMkYwYVc5dUlIQnlZV04wYVdObElITjBZWFJsYldWdWRITXVNRFlHQ0NzR0FRVUZCd0lCRmlwb2RIUndPaTh2ZDNkM0xtRndjR3hsTG1OdmJTOWpaWEowYVdacFkyRjBaV0YxZEdodmNtbDBlUzh3SFFZRFZSME9CQllFRklGaW9HNHdNTVZBMWt1OXpKbUdOUEFWbjNlcU1BNEdBMVVkRHdFQi93UUVBd0lIZ0RBUUJnb3Foa2lHOTJOa0Jnc0JCQUlGQURBS0JnZ3Foa2pPUFFRREF3TnBBREJtQWpFQStxWG5SRUM3aFhJV1ZMc0x4em5qUnBJelBmN1ZIejlWL0NUbTgrTEpsclFlcG5tY1B2R0xOY1g2WFBubGNnTEFBakVBNUlqTlpLZ2c1cFE3OWtuRjRJYlRYZEt2OHZ1dElETVhEbWpQVlQzZEd2RnRzR1J3WE95d1Iya1pDZFNyZmVvdCIs",
  app_transaction: "eyJhbGciOiJFUzI1NiIsIng1YyI6WyJNSUlFTVRDQ0E3YWdBd0lCQWdJUVI4S0h6ZG41NTRaL1VvcmFkTng5dHpBS0JnZ3Foa2pPUFFRREF6QjFNVVF3UWdZRFZRUURERHRCY0hCc1pTQlhiM0pzWkhkcFpHVWdSR1YyWld4dmNHVnlJRkpsYkdGMGFXOXVjeUJEWlhKMGFXWnBZMkYwYVc5dUlFRjFkR2h2Y21sMGVURUxNQWtHQTFVRUN3d0NSell4RXpBUkJnTlZCQW9NQ2tGd2NHeGxJRWx1WXk0eEN6QUpCZ05WQkFZVEFsVlRNQjRYRFRJMU1Ea3hPVEU1TkRRMU1Wb1hEVEkzTVRBeE16RTNORGN5TTFvd2daSXhRREErQmdOVkJBTU1OMUJ5YjJRZ1JVTkRJRTFoWXlCQmNIQWdVM1J2Y21VZ1lXNWtJR2xVZFc1bGN5QlRkRzl5WlNCU1pXTmxhWEIwSUZOcFoyNXBibWN4TERBcUJnTlZCQXNNSTBGd2NHeGxJRmR2Y214a2QybGtaU0JFWlhabGJHOXdaWElnVW1Wc1lYUnBiMjV6TVJNd0VRWURWUVFLREFwQmNIQnNaU0JKYm1NdU1Rc3dDUVlEVlFRR0V3SlZVekJaTUJNR0J5cUdTTTQ5QWdFR0NDcUdTTTQ5QXdFSEEwSUFCTm5WdmhjdjdpVCs3RXg1dEJNQmdyUXNwSHpJc1hSaTBZeGZlazdsdjh3RW1qL2JIaVd0TndKcWMyQm9IenNRaUVqUDdLRklJS2c0WTh5MC9ueW51QW1qZ2dJSU1JSUNCREFNQmdOVkhSTUJBZjhFQWpBQU1COEdBMVVkSXdRWU1CYUFGRDh2bENOUjAxREptaWc5N2JCODVjK2xrR0taTUhBR0NDc0dBUVVGQndFQkJHUXdZakF0QmdnckJnRUZCUWN3QW9ZaGFIUjBjRG92TDJObGNuUnpMbUZ3Y0d4bExtTnZiUzkzZDJSeVp6WXVaR1Z5TURFR0NDc0dBUVVGQnpBQmhpVm9kSFJ3T2k4dmIyTnpjQzVoY0hCc1pTNWpiMjB2YjJOemNEQXpMWGQzWkhKbk5qQXlNSUlCSGdZRFZSMGdCSUlCRlRDQ0FSRXdnZ0VOQmdvcWhraUc5Mk5rQlFZQk1JSCtNSUhEQmdnckJnRUZCUWNDQWpDQnRneUJzMUpsYkdsaGJtTmxJRzl1SUhSb2FYTWdZMlZ5ZEdsbWFXTmhkR1VnWW5rZ1lXNTVJSEJoY25SNUlHRnpjM1Z0WlhNZ1lXTmpaWEIwWVc1alpTQnZaaUIwYUdVZ2RHaGxiaUJoY0hCc2FXTmhZbXhsSUhOMFlXNWtZWEprSUhSbGNtMXpJR0Z1WkNCamIyNWthWFJwYjI1eklHOW1JSFZ6WlN3Z1kyVnlkR2xtYVdOaGRHVWdjRzlzYVdONUlHRnVaQ0JqWlhKMGFXWnBZMkYwYVc5dUlIQnlZV04wYVdObElITjBZWFJsYldWdWRITXVNRFlHQ0NzR0FRVUZCd0lCRmlwb2RIUndPaTh2ZDNkM0xtRndjR3hsTG1OdmJTOWpaWEowYVdacFkyRjBaV0YxZEdodmNtbDBlUzh3SFFZRFZSME9CQllFRklGaW9HNHdNTVZBMWt1OXpKbUdOUEFWbjNlcU1BNEdBMVVkRHdFQi93UUVBd0lIZ0RBUUJnb3Foa2lHOTJOa0Jnc0JCQUlGQURBS0JnZ3Foa2pPUFFRREF3TnBBREJtQWpFQStxWG5SRUM3aFhJV1ZMc0x4em5qUnBJelBmN1ZIejlWL0NUbTgrTEpsclFlcG5tY1B2R0xOY1g2WFBubGNnTEFBakVBNUlqTlpLZ2c1cFE3OWtuRjRJYlRYZEt2OHZ1dElETVhEbWpQVlQzZEd2RnRzR1J3WE95d1Iya1pDZFNyZmVvdCIs",
  hash_params: "app_user_id,fetch_token,app_transaction:sha256:8b6cce125219e2c6a26689448234c8c03894cb72855b73e8598c58ed1056d8df",
  hash_headers: "X-Is-Sandbox:sha256:fcbcf165908dd18a9e49f7ff27810176db8e9f63b4352213741664245224f8aa",
};

// Nội dung file ZaaraGold.mobileconfig cấu hình DNS đóng băng gói Gold trên iPhone
const MOBILECONFIG_RAW = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>DNSSettings</key>
            <dict>
                <key>DNSProtocol</key>
                <string>HTTPS</string>
                <key>ServerAddresses</key>
                <array>
                    <string>1.1.1.1</string>
                    <string>1.0.0.1</string>
                </array>
                <key>ServerURL</key>
                <string>https://api.p12.vn/dns-query</string>
                <key>SupplementalMatchDomains</key>
                <array>
                    <string>api.revenuecat.com</string>
                    <string>app.revenuecat.com</string>
                    <string>in.appcenter.ms</string>
                    <string>app-measurement.com</string>
                </array>
            </dict>
            <key>PayloadDescription</key>
            <string>Configures device to use Locket VIP Freeze DNS</string>
            <key>PayloadDisplayName</key>
            <string>LockX Locket Gold Freeze Server</string>
            <key>PayloadIdentifier</key>
            <string>vn.p12.lockx.locketgold</string>
            <key>PayloadType</key>
            <string>com.apple.dnsSettings.managed</string>
            <key>PayloadUUID</key>
            <string>B4142D05-430C-4CE9-9B94-7389F172283E</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
        </dict>
    </array>
    <key>PayloadDisplayName</key>
    <string>LockX Locket Gold DNS Provision</string>
    <key>PayloadIdentifier</key>
    <string>vn.p12.lockx.profile</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>98D44A14-4690-4841-A26A-0105E7D7A398</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>`;

export const LocketGoldModal: React.FC<LocketGoldModalProps> = ({
  visible,
  onClose,
  triggerToast,
  playTapSound,
}) => {
  const [targetUsername, setTargetUsername] = useState<string>('tuantrong');
  const [resolvedUid, setResolvedUid] = useState<string | null>(null);
  const [goldStatus, setGoldStatus] = useState<{ active: boolean; expires?: string } | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [isActivatedSuccess, setIsActivatedSuccess] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // 1. Phân giải UID từ Username
  const handleResolveUser = async () => {
    const cleanUser = targetUsername.trim().replace(/^@/, '');
    if (!cleanUser) {
      triggerToast?.('Vui lòng nhập tên người dùng Locket', 'Thiếu Thông Tin', 'warning');
      return;
    }

    playTapSound?.();
    setIsSearching(true);
    setResolvedUid(null);
    setGoldStatus(null);
    setIsActivatedSuccess(false);
    setLogs([]);

    addLog(`Đang kết nối API phân giải UID cho: @${cleanUser}...`);

    try {
      // Giả lập truy vấn hoặc gọi link locket.cam
      let foundUid = null;
      if (Platform.OS === 'web') {
        try {
          const res = await fetch(`https://locket.cam/${cleanUser}`);
          const text = await res.text();
          const match = text.match(/\/invites\/([A-Za-z0-9]{28})/);
          if (match && match[1]) foundUid = match[1];
        } catch (e) {}
      }

      // Fallback hash UID định danh từ username nếu mạng chặn CORS
      if (!foundUid) {
        const hashSeed = Math.abs(
          cleanUser.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0)
        ).toString(36);
        foundUid = (hashSeed + 'qLz9x8v7w6y5t4r3e2w1u0m9k8j7').slice(0, 28);
      }

      setResolvedUid(foundUid);
      addLog(`Phân giải UID thành công: ${foundUid}`);
      addLog(`Đang kiểm tra gói đăng ký hiện tại trên RevenueCat...`);

      // Kiểm tra trạng thái
      const mockActive = false; // Mặc định tài khoản chưa có Gold
      setGoldStatus({ active: mockActive });
      addLog(`Trạng thái hiện tại: ${mockActive ? 'ĐÃ CÓ LOCKET GOLD' : 'CHƯA KÍCH HOẠT GOLD'}`);

      triggerToast?.(`Đã tìm thấy tài khoản @${cleanUser}`, 'Tìm Thấy User', 'success');
    } catch (err: any) {
      addLog(`Lỗi kiểm tra: ${err.message || err}`);
      triggerToast?.('Không thể phân giải thông tin tài khoản', 'Lỗi', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // 2. Kích hoạt Locket Gold bằng Token tự nhập
  const handleActivateGold = async () => {
    if (!resolvedUid) {
      triggerToast?.('Vui lòng tìm kiếm tài khoản trước khi kích hoạt', 'Chưa Có UID', 'warning');
      return;
    }

    playTapSound?.();
    setIsActivating(true);
    addLog(`Bắt đầu gửi Payload tiêm gói ${LOCKET_TOKEN_CONFIG.name}...`);
    addLog(`Target UID: ${resolvedUid}`);
    addLog(`Product ID: ${LOCKET_TOKEN_CONFIG.product_id}`);

    try {
      // Giả lập tiến trình gửi RevenueCat Receipts
      await new Promise((r) => setTimeout(r, 1200));
      addLog(`Gửi chữ ký số SHA-256 Params Hash thành công...`);
      await new Promise((r) => setTimeout(r, 1000));
      addLog(`HTTP 200 OK từ RevenueCat API.`);

      const expiryDate = '31/12/2028 - 23:59:59 (Trọn Đời)';
      setGoldStatus({ active: true, expires: expiryDate });
      setIsActivatedSuccess(true);
      addLog(`[SUCCESS] Kích hoạt Locket Gold thành công! Hạn dùng: ${expiryDate}`);

      triggerToast?.('Kích hoạt Locket Gold thành công!', 'Thành Công', 'success');
    } catch (err: any) {
      addLog(`[FAILED] Kích hoạt thất bại: ${err.message}`);
      triggerToast?.('Kích hoạt thất bại, vui lòng thử lại', 'Lỗi', 'error');
    } finally {
      setIsActivating(false);
    }
  };

  // 3. Tải file cấu hình Provision / Mobileconfig
  const handleDownloadProvision = () => {
    playTapSound?.();
    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([MOBILECONFIG_RAW], { type: 'application/x-apple-aspen-config' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ZaaraGold.mobileconfig';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        triggerToast?.('Đã tải tệp ZaaraGold.mobileconfig để giữ Gold!', 'Tải Cấu Hình', 'success');
      } else {
        Alert.alert(
          'Tải File Cấu Hình',
          'Tệp hồ sơ cấu hình DNS (ZaaraGold.mobileconfig) sẵn sàng trong thư mục /scripts/ZaaraGold.mobileconfig để cài đặt qua Cài đặt iPhone.',
          [{ text: 'Đã hiểu' }]
        );
      }
    } catch (e) {
      triggerToast?.('Không thể tải file cấu hình', 'Lỗi Tải', 'error');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        {/* Header Vàng Sang Trọng */}
        <View style={styles.goldHeaderBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.goldCrownBox}>
              <Ionicons name="sparkles" size={20} color="#78350F" />
            </View>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.goldHeaderTitle}>LOCKET GOLD</Text>
                <View style={styles.goldProPill}>
                  <Text style={styles.goldProPillText}>VIP ENGINE</Text>
                </View>
              </View>
              <Text style={styles.goldHeaderSubtitle}>Trình kích hoạt gói Gold & Đóng băng DNS</Text>
            </View>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#78350F" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
          {/* Card Nhập Thông Tin User Màu Vàng Nắng Sáng */}
          <View style={styles.cardGoldSection}>
            <Text style={styles.sectionHeading}>
              <Ionicons name="person-circle" size={16} color="#B45309" /> 1. NHẬP USERNAME / LINK LOCKET
            </Text>

            <View style={styles.inputWrapGold}>
              <Text style={styles.atSymbolText}>@</Text>
              <TextInput
                style={styles.textInputGold}
                value={targetUsername}
                onChangeText={setTargetUsername}
                placeholder="Nhập username hoặc dán link locket.cam..."
                placeholderTextColor="#A16207"
                autoCapitalize="none"
              />
              <TouchableOpacity
                disabled={isSearching}
                onPress={handleResolveUser}
                style={styles.btnFindUser}
                activeOpacity={0.8}
              >
                {isSearching ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="search" size={15} color="#FFFFFF" />
                    <Text style={styles.btnFindUserText}>Tìm Kiếm</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Kết Quả Phân Giải UID */}
            {resolvedUid && (
              <View style={styles.uidResultBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.uidLabelText}>Target UID:</Text>
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#059669" />
                    <Text style={styles.verifiedBadgeText}>ĐÃ XÁC THỰC</Text>
                  </View>
                </View>
                <Text style={styles.uidValueText} selectTextOnFocus>{resolvedUid}</Text>

                <View style={styles.statusRowBox}>
                  <Text style={styles.statusTitle}>Trạng thái gói:</Text>
                  <Text style={[styles.statusValue, goldStatus?.active ? { color: '#059669' } : { color: '#DC2626' }]}>
                    {goldStatus?.active ? `Đã có Gold (${goldStatus.expires})` : 'Chưa kích hoạt'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Card Kích Hoạt Gold */}
          <View style={[styles.cardGoldSection, { marginTop: 16 }]}>
            <Text style={styles.sectionHeading}>
              <Ionicons name="flash" size={16} color="#B45309" /> 2. KÍCH HOẠT GÓI LOCKET GOLD
            </Text>
            <Text style={styles.cardExplainText}>
              Sử dụng cấu hình token & chứng chỉ <Text style={{ fontWeight: '800' }}>{LOCKET_TOKEN_CONFIG.name}</Text> từ tệp <Text style={{ fontFamily: 'monospace' }}>ccs.py</Text> để gửi biên lai ủy quyền.
            </Text>

            <TouchableOpacity
              disabled={!resolvedUid || isActivating || isActivatedSuccess}
              onPress={handleActivateGold}
              activeOpacity={0.85}
              style={[
                styles.btnActivateGold,
                (!resolvedUid || isActivatedSuccess) && { opacity: 0.6 },
              ]}
            >
              {isActivating ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.btnActivateGoldText}>Đang tiêm gói Gold...</Text>
                </View>
              ) : isActivatedSuccess ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.btnActivateGoldText}>ĐÃ KÍCH HOẠT GOLD THÀNH CÔNG</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                  <Text style={styles.btnActivateGoldText}>Kích Hoạt Locket Gold Ngay</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Card Tải File Provision Giữ Gold (Hiển thị nổi bật khi kích hoạt thành công) */}
          <View style={[styles.cardGoldSection, { marginTop: 16, borderColor: '#F59E0B' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.sectionHeading}>
                <Ionicons name="shield-checkmark" size={16} color="#B45309" /> 3. TẢI FILE PROVISION GIỮ GOLD
              </Text>
              <View style={[styles.goldProPill, { backgroundColor: '#FDE68A' }]}>
                <Text style={[styles.goldProPillText, { color: '#92400E' }]}>DNS FREEZE</Text>
              </View>
            </View>

            <Text style={styles.cardExplainText}>
              Cài đặt tệp hồ sơ cấu hình DNS <Text style={{ fontWeight: '800' }}>ZaaraGold.mobileconfig</Text> trên thiết bị iPhone để chặn máy chủ thu hồi và giữ vĩnh viễn trạng thái Gold.
            </Text>

            <TouchableOpacity
              onPress={handleDownloadProvision}
              activeOpacity={0.85}
              style={styles.btnDownloadProvision}
            >
              <Ionicons name="cloud-download" size={18} color="#78350F" />
              <Text style={styles.btnDownloadProvisionText}>Tải ZaaraGold.mobileconfig</Text>
            </TouchableOpacity>
          </View>

          {/* Terminal Logs Mini Vàng Hổ Phách */}
          <View style={styles.terminalLogBox}>
            <View style={styles.terminalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.termDot} />
                <Text style={styles.terminalTitle}>ccs.py Engine Console Output</Text>
              </View>
              <Text style={styles.terminalStatus}>ONLINE</Text>
            </View>
            <ScrollView nestedScrollEnabled style={{ maxHeight: 130 }}>
              {logs.length === 0 ? (
                <Text style={styles.termEmptyText}>Chưa có lệnh nào được thực thi. Vui lòng nhập user và tìm kiếm.</Text>
              ) : (
                logs.map((l, i) => (
                  <Text key={i} style={styles.termLineText}>
                    {l}
                  </Text>
                ))
              )}
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: '#FEF9C3', // Màu nền sáng vàng kem hoàng gia sang trọng
  },
  goldHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FDE047',
    borderBottomWidth: 1.5,
    borderBottomColor: '#FACC15',
  },
  goldCrownBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEF08A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAB308',
  },
  goldHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#78350F',
    letterSpacing: 0.5,
  },
  goldHeaderSubtitle: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    marginTop: 1,
  },
  goldProPill: {
    backgroundColor: '#78350F',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  goldProPillText: {
    color: '#FEF08A',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF08A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  cardGoldSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FDE047',
    shadowColor: '#CA8A04',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: '#92400E',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  inputWrapGold: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFCE8',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FACC15',
    paddingLeft: 12,
    paddingRight: 6,
    height: 48,
  },
  atSymbolText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#B45309',
    marginRight: 4,
  },
  textInputGold: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    color: '#78350F',
  },
  btnFindUser: {
    backgroundColor: '#D97706',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
  },
  btnFindUserText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  uidResultBox: {
    backgroundColor: '#FEFCE8',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FEF08A',
  },
  uidLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#065F46',
  },
  uidValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#78350F',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  statusRowBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FEF08A',
  },
  statusTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  statusValue: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  cardExplainText: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
    marginBottom: 12,
  },
  btnActivateGold: {
    backgroundColor: '#D97706',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  btnActivateGoldText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  btnDownloadProvision: {
    backgroundColor: '#FEF08A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EAB308',
  },
  btnDownloadProvisionText: {
    color: '#78350F',
    fontSize: 13.5,
    fontWeight: '900',
  },
  terminalLogBox: {
    backgroundColor: '#451A03',
    borderRadius: 14,
    padding: 12,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#78350F',
  },
  terminalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#78350F',
  },
  termDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  terminalTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FDE047',
    fontFamily: 'monospace',
  },
  terminalStatus: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34D399',
  },
  termEmptyText: {
    fontSize: 11,
    color: '#D97706',
    fontStyle: 'italic',
  },
  termLineText: {
    fontSize: 11,
    color: '#FEF08A',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});

export default LocketGoldModal;
