import { useState, useCallback } from 'react';
import Topbar from './components/Topbar';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import Timeline from './components/Timeline';
import UploadPanel from './components/UploadPanel';
import TextPanel from './components/TextPanel';

function App() {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [textElements, setTextElements] = useState([]);
  const [activePanel, setActivePanel] = useState('');
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);

  const resetProject = useCallback(() => {
    setMediaFiles([]);
    setTextElements([]);
    setActivePanel('');
    setSelectedMediaIndex(0);
  }, []);

  const processFiles = useCallback((files) => {
    const newFiles = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
      name: file.name,
      start: 0,
      end: null,
    }));

    setMediaFiles((prev) => {
      const combined = [...prev, ...newFiles];
      return combined;
    });

    // Select first file if this is the first upload
    if (mediaFiles.length === 0 && newFiles.length > 0) {
      setSelectedMediaIndex(0);
    }

    setActivePanel('');
  }, [mediaFiles.length]);

  const handleFileChange = useCallback((e) => {
    if (!e.target.files) return;
    processFiles(Array.from(e.target.files));
  }, [processFiles]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    processFiles(Array.from(e.dataTransfer.files));
  }, [processFiles]);

  const handleDragOver = useCallback((e) => e.preventDefault(), []);

  const handleMenuClick = useCallback((menuName) => {
    setActivePanel((prev) => (prev === menuName ? '' : menuName));
  }, []);

  const handleAddText = useCallback((text, font) => {
    setTextElements((prev) => [
      ...prev,
      {
        text,
        font,
        x: 100,
        y: 100,
        fontSize: 28,
        color: '#ffffff'
      },
    ]);
    setActivePanel('');
  }, []);

  return (
    <div className="flex flex-col h-screen w-383">
      <Topbar onNewVideo={resetProject} />

      <div className="flex flex-1">
        <Sidebar activePanel={activePanel} onMenuClick={handleMenuClick} />

        <div className="flex flex-1 relative bg-gray">
          <Canvas
            mediaFiles={mediaFiles}
            setMediaFiles={setMediaFiles}
            textElements={textElements}
            setTextElements={setTextElements}
            selectedMediaIndex={selectedMediaIndex}
            setSelectedMediaIndex={setSelectedMediaIndex}
          />

          {activePanel === 'Files' && (
            <div className="absolute right-0 top-0 h-full w-80 bg-gray z-10">
              <UploadPanel
                handleFileChange={handleFileChange}
                handleDrop={handleDrop}
                handleDragOver={handleDragOver}
              />
            </div>
          )}

          {activePanel === 'Text' && (
            <div className="absolute right-0 top-0 h-full w-80 bg-gray-800 z-10">
              <TextPanel handleAddText={handleAddText} />
            </div>
          )}
        </div>
      </div>

      <div className='border border-white'>
        <Timeline
          mediaFiles={mediaFiles}
          setMediaFiles={setMediaFiles}
          currentTime={0}
          onSelect={setSelectedMediaIndex}
          selectedMediaIndex={selectedMediaIndex}
        />
      </div>
    </div>
  );
}

export default App;