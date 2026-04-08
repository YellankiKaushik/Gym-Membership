import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Link, CheckCircle } from 'lucide-react';
import { getApiUrl } from '../api/gymApi';

interface SetupProps {
  onComplete: () => void;
}

export default function Setup({ onComplete }: SetupProps) {
  const [apiUrl, setApiUrlState] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existingUrl = getApiUrl();
    if (existingUrl) {
      setApiUrlState(existingUrl);
    }
  }, []);

  const handleSave = () => {
    if (apiUrl.trim()) {
      localStorage.setItem('gymApiUrl', apiUrl.trim());
      setSaved(true);
      setTimeout(() => {
        onComplete();
      }, 1500);
    }
  };


  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col">
      <header className="pt-8 pb-4 px-4">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4 shadow-lg shadow-purple-500/30">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Setup Required</h1>
          <p className="text-purple-200/70">Connect your Google Apps Script</p>
        </motion.div>
      </header>

      <main className="flex-1 px-4 pb-8">
        <div className="max-w-lg mx-auto">
          {/* Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-6 mb-6"
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Link className="w-5 h-5 text-purple-400" />
              How to get your API URL
            </h2>
            <ol className="space-y-3 text-purple-200/80 text-sm">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-300 text-xs font-bold">1</span>
                <span>Create a Google Sheet with the template</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-300 text-xs font-bold">2</span>
                <span>Go to <strong>Extensions → Apps Script</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-300 text-xs font-bold">3</span>
                <span>Paste the Apps Script code provided</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-300 text-xs font-bold">4</span>
                <span>Click <strong>Deploy → New deployment</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-300 text-xs font-bold">5</span>
                <span>Select <strong>Web app</strong> and set access to "Anyone"</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-300 text-xs font-bold">6</span>
                <span>Copy the deployment URL and paste below</span>
              </li>
            </ol>
          </motion.div>

          {/* API URL Input */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm text-purple-300/70 mb-2">Google Apps Script URL</label>
              <input
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrlState(e.target.value)}
                placeholder="https://script.google.com/macros/s/..."
                className="w-full px-4 py-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>

            <motion.button
              onClick={handleSave}
              disabled={!apiUrl.trim() || saved}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full py-4 font-semibold rounded-2xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                saved 
                  ? 'bg-emerald-600 text-white shadow-emerald-500/30' 
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-purple-500/30 hover:shadow-purple-500/50'
              }`}
            >
              {saved ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Saved! Redirecting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Save & Continue
                </>
              )}
            </motion.button>
          </motion.div>

          {/* Help Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl"
          >
            <h3 className="text-amber-300 font-medium mb-2 text-sm">Need help?</h3>
            <p className="text-amber-200/70 text-xs mb-3">
              Check the documentation files included with this project:
            </p>
            <ul className="text-amber-200/70 text-xs space-y-1">
              <li>• <code className="bg-amber-500/20 px-1 rounded">docs/GOOGLE_SHEET_TEMPLATE.md</code> - Sheet setup guide</li>
              <li>• <code className="bg-amber-500/20 px-1 rounded">docs/GOOGLE_APPS_SCRIPT.md</code> - Complete API code</li>
            </ul>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
