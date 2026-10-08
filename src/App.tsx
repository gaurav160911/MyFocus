import { AppProvider, useApp } from './context/AppContext';
import { Widget } from './components/Widget';
import { Shell } from './components/Shell';
import './App.css';

/**
 * One page, two chromes. `viewMode` decides whether we render the small
 * floating widget or the full management window; the native window is resized
 * to match by the context.
 */
function Root() {
  const { viewMode, state } = useApp();

  if (viewMode === 'widget' || viewMode === 'collapsed') {
    return (
      <div className="widget-root" style={{ opacity: state.settings.widgetOpacity }}>
        <Widget />
      </div>
    );
  }

  return <Shell />;
}

export default function App() {
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  );
}
