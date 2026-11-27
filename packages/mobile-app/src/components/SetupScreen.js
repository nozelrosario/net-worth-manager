import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Switch,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { validateAppUrl, parseConnectionInput } from '../utils/urlSecurity';

export default function SetupScreen({ initialUrl = '', initialAllowCustomDomain = false, onComplete }) {
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [allowCustomDomain, setAllowCustomDomain] = useState(Boolean(initialAllowCustomDomain));
  const [errorMsg, setErrorMsg] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (initialUrl) {
      setUrlInput(initialUrl);
    }
  }, [initialUrl]);

  const handleConnect = (candidateUrl = urlInput, customFlag = allowCustomDomain) => {
    const check = validateAppUrl(candidateUrl, { allowCustomDomain: customFlag });
    if (!check.valid) {
      setErrorMsg(check.message);
      return;
    }
    setErrorMsg('');
    onComplete({
      url: check.url,
      allowCustomDomain: Boolean(check.isCustomDomain),
    });
  };

  const handleOpenScanner = async () => {
    setErrorMsg('');
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setErrorMsg('Camera permission is required to scan a QR code. You can also paste your URL below.');
        return;
      }
    }
    setHasScanned(false);
    setShowScanner(true);
  };

  const handleBarCodeScanned = ({ data }) => {
    if (hasScanned) return;
    setHasScanned(true);
    setShowScanner(false);

    const extracted = parseConnectionInput(data);
    if (!extracted) {
      setErrorMsg('The scanned QR code does not contain a valid Net Worth Manager URL.');
      return;
    }

    setUrlInput(extracted);
    const check = validateAppUrl(extracted, { allowCustomDomain });
    if (!check.valid) {
      setErrorMsg(check.message);
      return;
    }

    setErrorMsg('');
    onComplete({
      url: check.url,
      allowCustomDomain: Boolean(check.isCustomDomain),
    });
  };

  const liveValidation = urlInput.trim()
    ? validateAppUrl(urlInput, { allowCustomDomain })
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brandHeader}>
            <View style={styles.shieldBadge}>
              <Text style={styles.shieldText}>NWM</Text>
            </View>
            <Text style={styles.title}>Net Worth Manager</Text>
            <Text style={styles.subtitle}>
              Connect this app to your personal Google Apps Script or Firebase deployment.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Option 1: Scan Setup QR Code</Text>
            <Text style={styles.helperText}>
              Open your Net Worth Manager web app on another screen, go to Settings (or Profile) &rarr; Connect Mobile App, and scan the QR code.
            </Text>
            <TouchableOpacity style={styles.qrButton} onPress={handleOpenScanner} activeOpacity={0.85}>
              <Text style={styles.qrButtonText}>Scan QR Code</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Option 2: Enter Instance URL</Text>
            <Text style={styles.helperText}>
              Only verified Google hosting domains are allowed by default:
            </Text>
            <View style={styles.allowListBox}>
              <Text style={styles.allowListItem}>&bull; https://&lt;your-app&gt;.web.app</Text>
              <Text style={styles.allowListItem}>&bull; https://&lt;your-app&gt;.firebaseapp.com</Text>
              <Text style={styles.allowListItem}>&bull; https://script.google.com/macros/s/.../exec</Text>
            </View>

            <TextInput
              style={styles.input}
              value={urlInput}
              onChangeText={(text) => {
                setUrlInput(text);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="https://your-app.web.app"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={() => handleConnect()}
            />

            {liveValidation?.valid && (
              <Text style={styles.validHint}>
                Ready to connect ({liveValidation.provider === 'firebase' ? 'Firebase Hosting' : liveValidation.provider === 'apps-script' ? 'Apps Script' : 'Custom Domain'})
              </Text>
            )}

            <View style={styles.customDomainRow}>
              <View style={styles.customDomainTextCol}>
                <Text style={styles.customDomainLabel}>Advanced: Allow Custom Domain</Text>
                <Text style={styles.customDomainDesc}>
                  Only enable if you mapped your own custom domain to Firebase Hosting.
                </Text>
              </View>
              <Switch
                value={allowCustomDomain}
                onValueChange={(val) => {
                  setAllowCustomDomain(val);
                  if (errorMsg) setErrorMsg('');
                }}
                trackColor={{ false: '#334155', true: '#10b981' }}
                thumbColor="#F8FAFC"
              />
            </View>

            {allowCustomDomain && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  Warning: Custom domains bypass the Google domain allowlist. Only connect to a domain you personally control.
                </Text>
              </View>
            )}

            {Boolean(errorMsg) && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.connectButton, !urlInput.trim() && styles.connectButtonDisabled]}
              onPress={() => handleConnect()}
              disabled={!urlInput.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.connectButtonText}>Connect Instance</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footerNote}>
            Your financial data stays in your personal Google account. This app never sends data to external servers.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <SafeAreaView style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scan Pairing QR Code</Text>
            <TouchableOpacity onPress={() => setShowScanner(false)} style={styles.scannerCloseBtn}>
              <Text style={styles.scannerCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.cameraWrapper}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={hasScanned ? undefined : handleBarCodeScanned}
            />
            <View style={styles.reticleOverlay}>
              <View style={styles.reticleBox} />
              <Text style={styles.reticleHint}>Point camera at QR code in Web App Settings</Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F17',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  flex: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  brandHeader: { alignItems: 'center', marginTop: 12, marginBottom: 24 },
  shieldBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  shieldText: { color: '#10b981', fontWeight: '800', fontSize: 16, letterSpacing: 1 },
  title: { color: '#F8FAFC', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  helperText: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  qrButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  qrButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: { color: '#64748B', fontSize: 11, fontWeight: '700', marginHorizontal: 12 },
  allowListBox: {
    backgroundColor: '#0B0F17',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  allowListItem: { color: '#CBD5E1', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginVertical: 2 },
  input: {
    backgroundColor: '#0B0F17',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 13,
    marginBottom: 10,
  },
  validHint: { color: '#10b981', fontSize: 12, fontWeight: '600', marginBottom: 10 },
  customDomainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 10,
    gap: 12,
  },
  customDomainTextCol: { flex: 1 },
  customDomainLabel: { color: '#E2E8F0', fontSize: 12, fontWeight: '600' },
  customDomainDesc: { color: '#64748B', fontSize: 11, marginTop: 2 },
  warningBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  warningText: { color: '#FBBF24', fontSize: 11, lineHeight: 16 },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderColor: 'rgba(244, 63, 94, 0.35)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  errorText: { color: '#FB7185', fontSize: 12, lineHeight: 17 },
  connectButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  connectButtonDisabled: { opacity: 0.45 },
  connectButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  footerNote: { color: '#64748B', fontSize: 11, textAlign: 'center', marginTop: 20, lineHeight: 16 },
  scannerContainer: { flex: 1, backgroundColor: '#000000' },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0B0F17',
  },
  scannerTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  scannerCloseBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  scannerCloseText: { color: '#10b981', fontSize: 14, fontWeight: '600' },
  cameraWrapper: { flex: 1, position: 'relative' },
  reticleOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  reticleBox: {
    width: 240,
    height: 240,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#10b981',
    backgroundColor: 'transparent',
  },
  reticleHint: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 20,
    backgroundColor: 'rgba(11, 15, 23, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
});
