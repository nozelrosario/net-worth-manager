import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
  Platform,
  BackHandler,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as Network from 'expo-network';
import SetupScreen from './src/components/SetupScreen';
import {
  validateAppUrl,
  parseConnectionInput,
  verifyIdentityPayload,
  isNavigationAllowed,
} from './src/utils/urlSecurity';

const STORAGE_URL_KEY = 'NWM_APP_URL';
const STORAGE_CUSTOM_DOMAIN_KEY = 'NWM_ALLOW_CUSTOM_DOMAIN';

const IDENTITY_CHECK_SCRIPT = `
  (function() {
    try {
      var id = window.__NWM_IDENTITY__;
      if (id && id.app === 'net-worth-manager' && id.signature) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'NWM_IDENTITY_VERIFIED',
          app: id.app,
          version: id.version,
          origin: id.origin || window.location.origin,
          signature: id.signature,
          isAppsScript: Boolean(id.isAppsScript || (window.google && window.google.script && window.google.script.run))
        }));
      }
    } catch (e) {}
  })();
  true;
`;

export default function App() {
  const webviewRef = useRef(null);
  const verifyTimeoutRef = useRef(null);

  const [isConnected, setIsConnected] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [appUrl, setAppUrl] = useState('');
  const [allowCustomDomain, setAllowCustomDomain] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [identityStatus, setIdentityStatus] = useState('pending'); // 'pending' | 'verified' | 'unverified' | 'bypassed'

  const IS_UAT = Constants.expoConfig?.extra?.env === 'uat';
  const presetUrl = Constants.expoConfig?.extra?.defaultAppUrl || '';

  useEffect(() => {
    bootstrapConfiguration();
    checkNetwork();

    const sub = Linking.addEventListener('url', ({ url }) => {
      handleIncomingDeepLink(url);
    });

    return () => {
      sub?.remove?.();
      if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const backAction = () => {
      if (canGoBack && webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [canGoBack]);

  const bootstrapConfiguration = async () => {
    try {
      const initialLink = await Linking.getInitialURL();
      if (initialLink) {
        const handled = await handleIncomingDeepLink(initialLink);
        if (handled) {
          setIsBootstrapping(false);
          return;
        }
      }

      const [savedUrl, savedCustomFlag] = await Promise.all([
        AsyncStorage.getItem(STORAGE_URL_KEY),
        AsyncStorage.getItem(STORAGE_CUSTOM_DOMAIN_KEY),
      ]);

      const customEnabled = savedCustomFlag === 'true';
      setAllowCustomDomain(customEnabled);

      const candidate = savedUrl || presetUrl;
      if (candidate) {
        const check = validateAppUrl(candidate, { allowCustomDomain: customEnabled });
        if (check.valid) {
          setAppUrl(check.url);
          setShowSetup(false);
          setIdentityStatus('pending');
          setIsBootstrapping(false);
          return;
        }
      }

      setShowSetup(true);
    } catch (e) {
      setShowSetup(true);
    } finally {
      setIsBootstrapping(false);
    }
  };

  const handleIncomingDeepLink = async (rawDeepLink) => {
    const targetUrl = parseConnectionInput(rawDeepLink);
    if (!targetUrl) return false;
    const check = validateAppUrl(targetUrl, { allowCustomDomain: false });
    if (!check.valid) return false;

    await saveInstanceConfig({ url: check.url, allowCustomDomain: false });
    return true;
  };

  const saveInstanceConfig = async ({ url, allowCustomDomain: customFlag }) => {
    try {
      await AsyncStorage.setItem(STORAGE_URL_KEY, url);
      await AsyncStorage.setItem(STORAGE_CUSTOM_DOMAIN_KEY, customFlag ? 'true' : 'false');
    } catch (e) {}

    if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current);
    setAllowCustomDomain(Boolean(customFlag));
    setAppUrl(url);
    setIdentityStatus('pending');
    setShowSetup(false);
  };

  const handleResetInstanceUrl = async () => {
    if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current);
    try {
      await AsyncStorage.removeItem(STORAGE_URL_KEY);
      await AsyncStorage.removeItem(STORAGE_CUSTOM_DOMAIN_KEY);
    } catch (e) {}
    setAppUrl('');
    setIdentityStatus('pending');
    setShowSetup(true);
  };

  const checkNetwork = async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      setIsConnected(Boolean(networkState.isConnected));
    } catch (e) {
      setIsConnected(true);
    }
  };

  const handleWebViewMessage = (event) => {
    const raw = event?.nativeEvent?.data;
    if (typeof raw !== 'string') return;

    try {
      const msg = JSON.parse(raw);
      if (msg?.type === 'NWM_IDENTITY_VERIFIED') {
        const verification = verifyIdentityPayload(msg, appUrl);
        if (verification.verified) {
          if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current);
          setIdentityStatus('verified');
        }
      } else if (msg?.type === 'NWM_RESET_INSTANCE_URL') {
        handleResetInstanceUrl();
      }
    } catch (e) {}
  };

  const handleLoadEnd = () => {
    if (webviewRef.current) {
      webviewRef.current.injectJavaScript(IDENTITY_CHECK_SCRIPT);
    }

    if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current);
    verifyTimeoutRef.current = setTimeout(() => {
      setIdentityStatus((prev) => (prev === 'pending' ? 'unverified' : prev));
    }, 10000);
  };

  if (isBootstrapping) {
    return (
      <View style={[styles.container, styles.center, styles.darkBg]}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0F17" />
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (showSetup || !appUrl) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="#0B0F17" />
        <SetupScreen
          initialUrl={appUrl}
          initialAllowCustomDomain={allowCustomDomain}
          onComplete={saveInstanceConfig}
        />
      </>
    );
  }

  if (!isConnected) {
    return (
      <View style={[styles.container, styles.center, styles.darkBg, { padding: 24 }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0F17" />
        <Text style={styles.errorTitle}>No Internet Connection</Text>
        <Text style={styles.errorBody}>Please check your network connection and retry.</Text>
        <TouchableOpacity onPress={checkNetwork} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Retry Connection</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowSetup(true)} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Change Instance URL</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={IS_UAT ? 'light-content' : 'dark-content'}
        backgroundColor={IS_UAT ? '#ea580c' : '#ffffff'}
      />
      <WebView
        ref={webviewRef}
        source={{ uri: appUrl }}
        applicationNameForUserAgent="NetWorthManagerApp/2.0"
        style={styles.webview}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        injectedJavaScript={IDENTITY_CHECK_SCRIPT}
        injectedJavaScriptForMainFrameOnly={false}
        onMessage={handleWebViewMessage}
        onLoadEnd={handleLoadEnd}
        onShouldStartLoadWithRequest={(request) => isNavigationAllowed(request.url, appUrl)}
        onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
        startInLoadingState={true}
        renderError={(errorDomain, errorCode, errorDesc) => (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: '#0B0F17', padding: 20 }]}>
            <Text style={styles.errorTitle}>Connection Error</Text>
            <Text style={styles.errorBody}>
              We couldn't connect to your instance. Please check your internet connection or instance URL.
            </Text>
            <TouchableOpacity onPress={() => webviewRef.current?.reload()} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Retry Connection</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSetup(true)} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Change Instance URL</Text>
            </TouchableOpacity>
            <Text style={styles.errorCodeText}>
              {errorDesc} (Code: {errorCode})
            </Text>
          </View>
        )}
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, styles.center, styles.darkBg]}>
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        )}
      />

      {identityStatus === 'unverified' && (
        <View style={styles.unverifiedOverlay}>
          <View style={styles.unverifiedCard}>
            <Text style={styles.unverifiedTitle}>Unverified App Instance</Text>
            <Text style={styles.unverifiedBody}>
              The page at this URL could not be verified as a Net Worth Manager instance. Do not enter personal information unless you personally deployed this URL.
            </Text>
            <TouchableOpacity onPress={() => setShowSetup(true)} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Go Back to Setup</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIdentityStatus('bypassed')} style={styles.warningBypassBtn}>
              <Text style={styles.warningBypassText}>I understand the risk — Continue anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  darkBg: { backgroundColor: '#0B0F17' },
  webview: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorTitle: { fontSize: 18, fontWeight: 'bold', color: '#fb7185', marginBottom: 10 },
  errorBody: { textAlign: 'center', color: '#94A3B8', marginBottom: 20, lineHeight: 20 },
  errorCodeText: { textAlign: 'center', color: '#64748B', fontSize: 11, marginTop: 20 },
  primaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#10b981',
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  secondaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#E2E8F0', fontWeight: '600', fontSize: 14 },
  unverifiedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 15, 23, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 100,
  },
  unverifiedCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  unverifiedTitle: { color: '#FBBF24', fontSize: 17, fontWeight: '700', marginBottom: 10 },
  unverifiedBody: { color: '#CBD5E1', fontSize: 13, lineHeight: 20, marginBottom: 20 },
  warningBypassBtn: { paddingVertical: 10, alignItems: 'center' },
  warningBypassText: { color: '#94A3B8', fontSize: 12, textDecorationLine: 'underline' },
});
