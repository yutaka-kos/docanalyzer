import { useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { MainPanel } from './components/layout/MainPanel';

function App() {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar onUploadClick={() => setShowUpload(true)} />
      <MainPanel showUpload={showUpload} onCloseUpload={() => setShowUpload(false)} />
    </div>
  );
}

export default App;
