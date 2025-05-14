export async function mergeMediaFiles(mediaFiles, progressCallback) {
  try {
    if (!mediaFiles || mediaFiles.length === 0) {
      throw new Error("No media files to merge");
    }

    progressCallback(5);

    // Create canvas for processing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // First pass to determine output dimensions
    let maxWidth = 0, maxHeight = 0;
    for (const media of mediaFiles) {
      const dims = await getMediaDimensions(media);
      maxWidth = Math.max(maxWidth, dims.width);
      maxHeight = Math.max(maxHeight, dims.height);
    }
    canvas.width = maxWidth;
    canvas.height = maxHeight;

    // Process each media file with proper timing
    const mediaElements = [];
    for (let i = 0; i < mediaFiles.length; i++) {
      const media = mediaFiles[i];
      const element = await createMediaElement(media, canvas);
      if (element) {
        mediaElements.push(element);
      }
      progressCallback(5 + (i / mediaFiles.length) * 70);
    }

    if (mediaElements.length === 0) {
      throw new Error("No valid media elements to merge");
    }

    // Create final video
    const outputBlob = await recordMediaElements(mediaElements, canvas, progressCallback);
    progressCallback(95);

    const mergedUrl = URL.createObjectURL(outputBlob);
    progressCallback(100);
    return mergedUrl;
  } catch (error) {
    console.error('Error merging media:', error);
    throw error;
  }
}

async function getMediaDimensions(media) {
  return new Promise((resolve) => {
    if (media.type === 'video') {
      const video = document.createElement('video');
      video.src = media.url;
      video.onloadedmetadata = () => {
        resolve({ width: video.videoWidth, height: video.videoHeight });
        video.remove();
      };
      video.onerror = () => resolve({ width: 0, height: 0 });
    } else {
      const img = new Image();
      img.src = media.url;
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => resolve({ width: 0, height: 0 });
    }
  });
}

async function createMediaElement(media, canvas) {
  if (media.type === 'video') {
    return await createVideoElement(media, canvas);
  } else {
    return await createImageElement(media, canvas);
  }
}

function createVideoElement(videoMedia) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = videoMedia.url;
    video.muted = true;
    video.playsInline = true;
    
    video.onloadedmetadata = () => {
      resolve({
        type: 'video',
        element: video,
        duration: video.duration * 1000, // convert to ms
        width: video.videoWidth,
        height: video.videoHeight
      });
    };
    
    video.onerror = () => resolve(null);
  });
}

function createImageElement(imageMedia) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = imageMedia.url;
    
    img.onload = () => {
      // Use trimmed duration if available, otherwise default to 5 seconds
      const duration = imageMedia.trimmed 
        ? (imageMedia.trimEnd - imageMedia.trimStart) * 1000 // convert to ms
        : 5000; // default 5 seconds for images
      
      resolve({
        type: 'image',
        element: img,
        duration: duration,
        width: img.width,
        height: img.height
      });
    };
    
    img.onerror = () => resolve(null);
  });
}

async function recordMediaElements(mediaElements, canvas, progressCallback) {
  return new Promise((resolve) => {
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(30); // 30 FPS
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 2500000
    });

    const chunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
        const progress = 80 + (chunks.length / 20) * 15;
        progressCallback(Math.min(progress, 95));
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };

    mediaRecorder.start(100); // Collect data every 100ms

    let currentElementIndex = 0;
    let startTime = 0;
    let isPlaying = false;

    function drawFrame() {
      if (currentElementIndex >= mediaElements.length) {
        mediaRecorder.stop();
        return;
      }

      const currentElement = mediaElements[currentElementIndex];
      const currentTime = performance.now() - startTime;

      // Clear canvas and draw current frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (currentElement.type === 'video') {
        const video = currentElement.element;
        if (!isPlaying) {
          video.currentTime = 0;
          video.play().catch(e => console.error("Video play error:", e));
          isPlaying = true;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.drawImage(currentElement.element, 0, 0, canvas.width, canvas.height);
      }

      // Check if we should move to next element
      if (currentTime >= currentElement.duration) {
        if (currentElement.type === 'video') {
          currentElement.element.pause();
        }
        currentElementIndex++;
        startTime = performance.now();
        isPlaying = false;
      }

      requestAnimationFrame(drawFrame);
    }

    startTime = performance.now();
    drawFrame();
  });
}