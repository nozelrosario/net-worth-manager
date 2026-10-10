const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withNotificationListener(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    if (!androidManifest.manifest.$['xmlns:tools']) {
      androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const app = androidManifest.manifest.application[0];
    
    if (app.$['tools:replace']) {
      if (!app.$['tools:replace'].includes('android:allowBackup')) {
        app.$['tools:replace'] += ',android:allowBackup';
      }
    } else {
      app.$['tools:replace'] = 'android:allowBackup';
    }

    // Define the service for the Notification Listener
    const service = {
      $: {
        'android:name': 'com.leandrosimoes.notificationlistener.RNAndroidNotificationListener',
        'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [
            {
              $: {
                'android:name': 'android.service.notification.NotificationListenerService',
              },
            },
          ],
        },
      ],
    };

    if (!app.service) {
      app.service = [];
    }

    // Check if it already exists to avoid duplicates
    const exists = app.service.find(
      (s) => s.$['android:name'] === 'com.leandrosimoes.notificationlistener.RNAndroidNotificationListener'
    );
    
    if (!exists) {
      app.service.push(service);
    }

    return config;
  });
};
