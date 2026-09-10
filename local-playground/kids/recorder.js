// One canvas contains the camera and artwork; controls never enter the capture.
export function setupCapture(canvas, photo, record, overlay, status, link, getAudioTracks = () => []) {
  let recorder, stream, timer, url, active = false;
  const supported = typeof MediaRecorder !== 'undefined' && !!canvas.captureStream;
  record.disabled = !supported;
  if (!supported) status.textContent = '이 브라우저에서는 사진으로 저장해 주세요. 영상은 Chrome / Edge에서 해볼 수 있어요.';
  function download(blob, extension) {
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `stretch-it-${Date.now()}.${extension}`;
    link.hidden = false;
    link.click();
    status.textContent = '파일을 저장했어요! 다운로드가 안 보이면 “파일 다시 저장”을 눌러요. Google Drive의 내 폴더에 올려주세요.';
  }
  function cleanup() {
    clearInterval(timer);
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    active = false;
    record.disabled = !supported;
    overlay.textContent = '';
  }
  photo.onclick = () => {
    try { canvas.toBlob(blob => {
      if (blob) download(blob, 'png');
      else status.textContent = '사진을 저장하지 못했어요. 다시 눌러주세요.';
    }, 'image/png'); } catch { status.textContent = '사진을 저장하지 못했어요. 다시 눌러주세요.'; }
  };
  record.onclick = () => {
    if (active || !supported) return;
    active = true;
    record.disabled = true;
    let countdown = 3;
    overlay.textContent = `${countdown}초 뒤 시작!`;
    timer = setInterval(() => {
      countdown--;
      if (countdown > 0) { overlay.textContent = `${countdown}초 뒤 시작!`; return; }
      clearInterval(timer);
      try {
        stream = canvas.captureStream(30);
        for (const track of getAudioTracks()) stream.addTrack(track.clone());
        const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
        const chunks = [];
        let failed = false;
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => { failed = true; cleanup(); status.textContent = '영상 저장이 멈췄어요. 사진으로 저장하거나 다시 녹화해 주세요.'; };
        recorder.onstop = () => {
          const type = recorder.mimeType || 'video/webm';
          if (!failed && chunks.length) download(new Blob(chunks, { type }), type.includes('mp4') ? 'mp4' : 'webm');
          else if (!failed) status.textContent = '영상이 비어 있어요. 다시 녹화해 주세요.';
          cleanup();
        };
        recorder.start();
        const end = performance.now() + 10000;
        overlay.textContent = '● 녹화 중 · 10초';
        timer = setInterval(() => {
          const remaining = Math.ceil((end - performance.now()) / 1000);
          overlay.textContent = `● 녹화 중 · ${remaining}초`;
          if (remaining <= 0) { clearInterval(timer); if (recorder.state !== 'inactive') recorder.stop(); }
        }, 100);
      } catch { cleanup(); status.textContent = '이 환경에서는 녹화가 어려워요. 사진으로 저장해 주세요.'; }
    }, 1000);
  };
  function stop() {
    if (recorder?.state === 'recording') recorder.stop();
    else cleanup();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && active) { stop(); status.textContent = '다른 탭으로 이동해 녹화를 마쳤어요.'; }
  });
  return { stop, get active() { return active; } };
}
