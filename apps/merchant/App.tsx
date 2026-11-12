import App from './src/App';
import { ErrorBoundary } from './src/lib/ErrorBoundary';

export default function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
