import { useState, useEffect, useRef, useCallback } from "react";
import { mergeMediaFiles } from "../utils/mergeMedia";

export default function Canvas({
  mediaFiles,
  setMediaFiles,
  textElements,
  setTextElements,
}) {
  const [sizes, setSizes] = useState({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedTextIndex, setSelectedTextIndex] = useState(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(null);
  const [mergedVideoUrl, setMergedVideoUrl] = useState(null);
  const videoRef = useRef(null);

  // Handle playing the merged video when it's ready
  useEffect(() => {
    if (mergedVideoUrl && videoRef.current) {
     videoRef.current.src = mergedVideoUrl;
    videoRef.current.load();
    videoRef.current.play()
      .catch(e => console.error("Playback error:", e));
    }
  }, [mergedVideoUrl]);

  // Set first media as selected when files are added
  useEffect(() => {
    if (mediaFiles.length > 0 && selectedMediaIndex === null) {
      setSelectedMediaIndex(0);
    }
  }, [mediaFiles.length, selectedMediaIndex]);

  const handleDeleteText = useCallback(
    (index) => {
      setTextElements((prev) => prev.filter((_, i) => i !== index));
      setSelectedTextIndex(null);
    },
    [setTextElements]
  );

  const handleFontSizeChange = useCallback(
    (index, delta) => {
      setTextElements((prev) => {
        const updated = [...prev];
        const currentSize = updated[index].fontSize || 28;
        updated[index].fontSize = Math.max(8, currentSize + delta);
        return updated;
      });
    },
    [setTextElements]
  );

  const handleColorChange = useCallback(
    (index, color) => {
      setTextElements((prev) => {
        const updated = [...prev];
        updated[index].color = color;
        return updated;
      });
    },
    [setTextElements]
  );

  const handleTextDrag = useCallback(
    (index, e) => {
      const newX = e.clientX - 100;
      const newY = e.clientY - 100;
      setTextElements((prev) => {
        const updated = [...prev];
        updated[index].x = newX;
        updated[index].y = newY;
        return updated;
      });
    },
    [setTextElements]
  );

  const handleFileChange = (e) => {
    if (!e.target.files) return;
    processFiles(Array.from(e.target.files));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    processFiles(Array.from(e.dataTransfer.files));
  };

  const handleDragOver = useCallback((e) => e.preventDefault(), []);

  const processFiles = useCallback(
    (files) => {
      const newOnes = files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        type: file.type.startsWith("video/") ? "video" : "image",
        name: file.name,
        start: 0,
        end: null,
        width: 300,
        height: 200,
      }));

      setMediaFiles((prev) => [...prev, ...newOnes]);
    },
    [setMediaFiles]
  );

  const startResize = useCallback(
    (e, idx, direction) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = sizes[idx]?.width || 300;
      const startHeight = sizes[idx]?.height || 200;

      const handleMouseMove = (moveEvent) => {
        let newWidth = startWidth;
        let newHeight = startHeight;

        if (direction === "right") {
          newWidth = Math.max(50, startWidth + (moveEvent.clientX - startX));
        }
        if (direction === "bottom") {
          newHeight = Math.max(50, startHeight + (moveEvent.clientY - startY));
        }

        setSizes((prev) => ({
          ...prev,
          [idx]: { width: newWidth, height: newHeight },
        }));
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [sizes]
  );

  const handleMerge = useCallback(async () => {
    try {
      setLoading(true);
      setProgress(0);

      if (mediaFiles.length === 0) {
        throw new Error("No media files to merge");
      }

      // Prepare media files with proper timing information
      const filesToMerge = mediaFiles.map(file => {
        // For images, use trimmed duration if available
        if (file.type === 'image') {
          return {
            ...file,
            duration: file.trimmed ? (file.trimEnd - file.trimStart) : 5 // default 5 sec for images
          };
        }
        // For videos, use trimmed duration if available, otherwise original duration
        if (file.type === 'video') {
          return {
            ...file,
            duration: file.trimmed ? (file.trimEnd - file.trimStart) : file.duration
          };
        }
        return file;
      });

      const mergedUrl = await mergeMediaFiles(filesToMerge, (p) => {
        setProgress(p);
      });

      if (mergedUrl) {
        setMergedVideoUrl(mergedUrl);

        // Calculate total duration of merged video
        const totalDuration = filesToMerge.reduce((sum, file) => {
          return sum + (file.duration || 0);
        }, 0);

        const mergedFile = {
          file: null,
          url: mergedUrl,
          type: "video",
          name: "merged-video.webm",
          start: 0,
          duration: totalDuration,
          end: totalDuration,
          width: sizes[0]?.width || 660,
          height: sizes[0]?.height || 343,
        };

        setMediaFiles([mergedFile]);
        setSelectedMediaIndex(0);
      }
    } catch (error) {
      console.error("Merge failed:", error);
      alert(`Merge failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [mediaFiles, setMediaFiles, sizes]);

  return (
    <div
      className="flex-1 flex flex-col items-center justify-start bg-black text-white p-4 overflow-auto"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {textElements.map((textItem, idx) => (
        <div
          key={idx}
          className="absolute cursor-move group"
          style={{
            left: textItem.x,
            top: textItem.y,
            fontFamily: textItem.font,
            fontSize: textItem.fontSize || 28,
            color: textItem.color || "white",
            userSelect: "none",
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            setSelectedTextIndex(idx);
            const onMove = (moveEvent) => handleTextDrag(idx, moveEvent);
            const onUp = () => {
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
        >
          <div>{textItem.text}</div>
          {selectedTextIndex === idx && (
            <div className="absolute left-0 top-full mt-1 flex gap-2 bg-gray p-1 rounded text-xs z-10">
              <button
                onClick={() => handleFontSizeChange(idx, 2)}
                className="hover:text-yellow-300"
              >
                A+
              </button>
              <button
                onClick={() => handleFontSizeChange(idx, -2)}
                className="hover:text-yellow-300"
              >
                A-
              </button>
              <input
                type="color"
                value={textItem.color || "#ffffff"}
                onChange={(e) => handleColorChange(idx, e.target.value)}
                className="w-5 h-5 border-0"
              />
              <button
                onClick={() => handleDeleteText(idx)}
                className="hover:text-red-500"
              >
                🗑
              </button>
            </div>
          )}
        </div>
      ))}

      {mediaFiles.length === 0 ? (
        <label
          htmlFor="file-upload"
          className="border-2 border-dashed border-yellow-400 p-30 mt-20 text-center cursor-pointer"
        >
          <p className="text-lg mb-2">Add Files</p>
          <p className="text-sm">or drop files here</p>
          <input
            id="file-upload"
            type="file"
            multiple
            accept="video/*,image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      ) : (
        <>
          <div className="mb-4 w-full flex justify-center">
            {selectedMediaIndex !== null && mediaFiles[selectedMediaIndex] && (
              <div
                className="relative bg-gray-800 border-3 border-yellow-400 border-dotted p-7 mt-2"
                style={{
                  width: sizes[selectedMediaIndex]?.width || 660,
                  height: sizes[selectedMediaIndex]?.height || 343,
                }}
              >
                {mediaFiles[selectedMediaIndex].type === "video" ? (
                  <video
                    ref={
                      mediaFiles[selectedMediaIndex].name ===
                      "merged-video.webm"
                        ? videoRef
                        : null
                    }
                    src={mediaFiles[selectedMediaIndex].url}
                    controls
                    className="w-full h-full object-contain"
                    autoPlay={
                      mediaFiles[selectedMediaIndex].name ===
                      "merged-video.webm"
                    }
                    muted
                  />
                ) : (
                  <img
                    src={mediaFiles[selectedMediaIndex].url}
                    alt={mediaFiles[selectedMediaIndex].name}
                    className="w-full h-full object-contain"
                  />
                )}

                {["right", "bottom"].map((dir) => (
                  <div
                    key={dir}
                    onMouseDown={(e) => startResize(e, selectedMediaIndex, dir)}
                    className={`absolute ${dir}-0 ${
                      dir === "right" ? "top-0 w-2 h-full" : "left-0 w-full h-2"
                    } opacity-50 cursor-${
                      dir === "right" ? "ew-resize" : "ns-resize"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-center mb-2 mt-2">
            <button
              onClick={handleMerge}
              disabled={loading || mediaFiles.length === 0}
              className={`px-4 py-2 rounded transition ${
                loading || mediaFiles.length === 0
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-800 text-white hover:bg-blue-500"
              }`}
            >
              {loading ? `Merging... ${progress}%` : "Merge All"}
            </button>
          </div>

          {loading && (
            <div className="w-full bg-gray-300 rounded-full h-2.5 dark:bg-gray mb-3">
              <div
                className="bg-blue-800 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto border-t border-blue-800 pt-2">
            {mediaFiles.map((media, idx) => (
              <div
                key={idx}
                className={`relative border-2 rounded cursor-pointer ${
                  idx === selectedMediaIndex
                    ? "border-yellow-400 p-1"
                    : "border-transparent"
                }`}
                onClick={() => setSelectedMediaIndex(idx)}
              >
                {media.type === "video" ? (
                  <video
                    src={media.url}
                    className="w-24 h-16 object-cover"
                    muted
                  />
                ) : (
                  <img
                    src={media.url}
                    className="w-24 h-16 object-cover"
                    alt=""
                  />
                )}
                {media.name === "merged-video.webm" && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1">
                    Merged
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
