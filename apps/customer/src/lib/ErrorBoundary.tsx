import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface State { failed: boolean }

/** Catches any render crash and shows a friendly screen instead of a blank app. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch(error: unknown) { console.warn('[BEVER] screen crashed', error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={s.wrap}>
        <Text style={s.title}>Something went wrong</Text>
        <Text style={s.body}>Sorry about that. Your cart and orders are safe.</Text>
        <TouchableOpacity style={s.btn} onPress={() => this.setState({ failed: false })} accessibilityLabel="Try again">
          <Text style={s.btnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#FFFFFF' },
  title: { fontSize: 20, fontWeight: '800', color: '#0B0B0C' },
  body: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  btn: { marginTop: 22, backgroundColor: '#0B0B0C', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 13 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
