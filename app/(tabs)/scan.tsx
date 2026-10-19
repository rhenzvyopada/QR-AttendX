import { MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { registerAttendance } from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { getProfile, type ProfileRole } from '@/lib/profiles';

export default function ScanScreen() {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 768;
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [role, setRole] = useState<ProfileRole | null>(null);
  const [scanned, setScanned] = useState(false);
  const [lastData, setLastData] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (user) getProfile(user.id).then((profile) => active && setRole(profile?.role ?? 'student'));
      return () => {
        active = false;
      };
    }, [user]),
  );

  if (!role) return <CenteredMessage icon="person-search" title="Checking your account..." />;
  if (role !== 'student')
    return (
      <CenteredMessage
        icon="block"
        title="Students Only"
        subtitle="QR attendance scanning is available to student accounts."
      />
    );
  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <CenteredMessage
        icon="camera-alt"
        subtitle="We need access to your camera to scan QR codes."
        title="Camera Permission Needed"
      >
        <AppButton icon="camera-alt" onPress={requestPermission} theme="primary" title="Grant Permission" />
      </CenteredMessage>
    );
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setScanned(true);
    setLastData(data);
    const result = await registerAttendance(data);
    setMessage(result.message);
    setSuccess(result.success);
  };

  return (
    <View style={styles.container}>
      <CameraView
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        style={styles.camera}
      />

      <View style={styles.scanFrame}>
        <View style={styles.scanMarker}>
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerTopRight} />
          <View style={styles.cornerBottomLeft} />
          <View style={styles.cornerBottomRight} />
        </View>
      </View>

      <View style={[styles.overlay, desktop && styles.overlayDesktop]}>
        <Text style={styles.overlayTitle}>QR Scan</Text>
        <Text style={styles.overlayText}>
          {scanned ? 'QR code detected successfully.' : 'Position the QR code inside the frame.'}
        </Text>
        <Text style={styles.overlayHint}>
          {scanned ? 'It will be validated automatically.' : 'It will be detected automatically.'}
        </Text>

        {message && (
          <View style={styles.resultBanner}>
            <MaterialIcons
              color={success ? COLORS.success : COLORS.danger}
              name={success ? 'check-circle' : 'error-outline'}
              size={18}
            />
            <Text style={[styles.result, { color: success ? COLORS.success : COLORS.danger }]}>
              {message}
            </Text>
          </View>
        )}

        {lastData && <Text style={styles.data} numberOfLines={2}>{lastData}</Text>}

        {scanned && (
          <AppButton
            icon="refresh"
            onPress={() => {
              setScanned(false);
              setLastData(null);
              setMessage(null);
            }}
            theme="primary"
            title="Scan Again"
          />
        )}
      </View>
    </View>
  );
}

function CenteredMessage({
  title,
  subtitle,
  icon = 'qr-code-scanner',
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  children?: ReactNode;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.stateIcon}>
        <MaterialIcons color={COLORS.primary} name={icon} size={28} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  camera: StyleSheet.absoluteFillObject,
  scanFrame: {
    position: 'absolute',
    top: '32%',
    width: 220,
    height: 220,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 17, 17, 0.34)',
  },
  scanMarker: {
    width: 170,
    height: 170,
    borderRadius: 12,
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cornerTopLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 18,
    height: 18,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: COLORS.primary,
    borderTopLeftRadius: 6,
  },
  cornerTopRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 18,
    height: 18,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: COLORS.primary,
    borderTopRightRadius: 6,
  },
  cornerBottomLeft: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 18,
    height: 18,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: COLORS.primary,
    borderBottomLeftRadius: 6,
  },
  cornerBottomRight: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 18,
    height: 18,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: COLORS.primary,
    borderBottomRightRadius: 6,
  },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 420,
  },
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    maxWidth: 460,
    alignSelf: 'center',
    backgroundColor: '#1B1B1A',
    borderWidth: 1,
    borderColor: '#3B3B39',
    borderRadius: 20,
    padding: 18,
    gap: 8,
    shadowColor: '#111111',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  overlayDesktop: { bottom: 116 },
  overlayTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textOnPrimary,
    marginBottom: 2,
  },
  overlayText: {
    fontSize: 14,
    color: COLORS.textOnPrimary,
    lineHeight: 20,
  },
  overlayHint: {
    fontSize: 12,
    color: COLORS.onPrimaryMuted,
    opacity: 0.85,
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1B1B1A',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  result: { fontSize: 14, fontWeight: '600', flex: 1 },
  data: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },
});
