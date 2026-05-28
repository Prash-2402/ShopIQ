import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleResetState = async () => {
    try {
      // Clear core stores or async storage if corrupt
      await AsyncStorage.removeItem('bill-store');
      // Reload application
      this.setState({ hasError: false, error: null, errorInfo: null });
      // In Expo we can reload via Expo Updates or simply rely on resetting react state
      // We'll reset error boundary state to allow a re-render
    } catch (e) {
      console.error('Failed to reset storage:', e);
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.innerContainer}>
            <View style={styles.errorHeader}>
              <Text style={styles.icon}>⚠️</Text>
              <Text style={styles.title}>System Recovered</Text>
              <Text style={styles.subtitle}>
                An unexpected interface crash occurred. We've safely isolated it to protect your local billing data.
              </Text>
            </View>

            <View style={styles.detailsCard}>
              <Text style={styles.detailsTitle}>Error Signature</Text>
              <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <Text style={styles.errorText}>
                  {this.state.error && this.state.error.toString()}
                </Text>
                {this.state.errorInfo && (
                  <Text style={styles.stackText}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </ScrollView>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.primaryButton} onPress={this.handleRetry}>
                <Text style={styles.primaryButtonText}>Try Re-rendering</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={this.handleResetState}>
                <Text style={styles.secondaryButtonText}>Reset Cart & State</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  innerContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  detailsCard: {
    width: width - 48,
    maxHeight: 200,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    marginBottom: 32,
  },
  detailsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  errorText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#EF4444',
    marginBottom: 8,
  },
  stackText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#64748B',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#1E293B',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  secondaryButtonText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '500',
  },
});
export default ErrorBoundary;
