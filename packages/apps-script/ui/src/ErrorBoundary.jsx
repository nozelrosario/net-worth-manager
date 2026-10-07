import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div style={{ padding: '20px', backgroundColor: '#fee2e2', color: '#991b1b', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Something went wrong.</h1>
          <div style={{ marginBottom: '1rem' }}>
            <strong>Error:</strong> {this.state.error && this.state.error.toString()}
          </div>
          <div style={{ whiteSpace: 'pre-wrap', backgroundColor: '#fef2f2', padding: '10px', borderRadius: '4px', border: '1px solid #fca5a5', overflowX: 'auto', fontSize: '0.875rem' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </div>
          <div style={{ marginTop: '1rem', whiteSpace: 'pre-wrap', backgroundColor: '#fef2f2', padding: '10px', borderRadius: '4px', border: '1px solid #fca5a5', overflowX: 'auto', fontSize: '0.875rem' }}>
            {this.state.error && this.state.error.stack}
          </div>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '1rem', padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
