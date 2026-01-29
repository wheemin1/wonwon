import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { AddLog } from './pages/AddLog';
import { Export } from './pages/Export';
import { Settings } from './pages/Settings';
import { useEffect } from 'react';
import { initializeSettings } from './db';
import { ToastProvider } from './components/Toast';

function App() {
  useEffect(() => {
    initializeSettings();
  }, []);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/add" element={<AddLog />} />
            <Route path="/export" element={<Export />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
