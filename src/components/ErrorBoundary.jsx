import { Component } from 'react';
import { Button, ErrorState } from './ui';

// Lazy route chunks can fail to load after a deploy (old hashed file gone) or on a flaky network.
const CHUNK_ERROR = /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS/i;

/** Contains render errors to the page that threw them instead of blanking the whole app. */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (CHUNK_ERROR.test(error.message || '')) {
      return (
        <div className="empty" role="alert">
          <strong>This page could not be loaded</strong>
          <span className="small">The app may have been updated, or the connection dropped. Reload to get the latest version.</span>
          <Button size="sm" variant="primary" onClick={() => window.location.reload()}>Reload</Button>
        </div>
      );
    }
    return <ErrorState error={{ message: error.message || 'Unexpected error' }} onRetry={() => this.setState({ error: null })} />;
  }
}
