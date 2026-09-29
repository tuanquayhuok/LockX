import { registerRootComponent } from 'expo';
import React from 'react';
import { View, Text, ScrollView, SafeAreaView } from 'react-native';

let RootComponent: React.ComponentType<any>;

try {
  const App = require('./App').default;
  RootComponent = App;
} catch (startupError: any) {
  console.error('LockX Fatal Startup Error:', startupError);
  RootComponent = () =>
    React.createElement(
      SafeAreaView,
      { style: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center', padding: 20 } },
      React.createElement(
        Text,
        { style: { fontSize: 22, fontWeight: '800', color: '#FF453A', textAlign: 'center', marginBottom: 12 } },
        '⚠️ Lỗi Khởi Động Mã Nguồn'
      ),
      React.createElement(
        Text,
        { style: { fontSize: 13, color: '#8E8E93', textAlign: 'center', marginBottom: 16 } },
        'Mã nguồn gặp ngoại lệ khi tải module. Chi tiết lỗi bên dưới:'
      ),
      React.createElement(
        ScrollView,
        { style: { maxHeight: 300, width: '100%', backgroundColor: '#1C1C1E', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FF453A' } },
        React.createElement(
          Text,
          { selectable: true, style: { fontSize: 12, color: '#FF453A', fontFamily: 'Courier' } },
          String(startupError?.stack || startupError?.message || startupError)
        )
      )
    );
}

registerRootComponent(RootComponent);
