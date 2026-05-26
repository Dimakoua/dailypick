(function () {
  'use strict';

  function resolveElement(elementOrId) {
    if (!elementOrId) return null;
    if (typeof elementOrId === 'string') return document.getElementById(elementOrId);
    return elementOrId;
  }

  function createShareEngine(options) {
    const shareButton = resolveElement(options.shareButton);
    const shareModal = resolveElement(options.shareModal);
    const previewImg = resolveElement(options.previewImage);
    const downloadButton = resolveElement(options.downloadButton);
    const nativeShareButton = resolveElement(options.nativeShareButton);

    if (!shareButton || !shareModal || !previewImg || !downloadButton || !nativeShareButton) {
      throw new Error('ShareEngine requires share button, modal, preview image, download button, and native share button.');
    }

    let currentBlob = null;
    let currentShareText = '';

    async function buildBlob(canvas) {
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          currentBlob = blob;
          resolve(blob);
        }, 'image/png');
      });
    }

    async function generateShareContent() {
      shareButton.disabled = true;
      const originalText = shareButton.textContent;
      shareButton.textContent = '⏳ Generating...';

      try {
        const canvas = await options.createCanvas();
        currentShareText = (typeof options.getShareText === 'function')
          ? options.getShareText()
          : '';

        previewImg.src = canvas.toDataURL('image/png');
        await buildBlob(canvas);
        shareModal.style.display = 'flex';
      } finally {
        shareButton.textContent = originalText;
        shareButton.disabled = false;
      }
    }

    function closeModal() {
      shareModal.style.display = 'none';
    }

    function downloadShareImage() {
      if (!currentBlob) return;
      const filename = (typeof options.getFileName === 'function')
        ? options.getFileName()
        : 'share-image.png';

      const anchor = document.createElement('a');
      anchor.href = URL.createObjectURL(currentBlob);
      anchor.download = filename;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(anchor.href), 5000);
    }

    async function nativeShareImage() {
      if (!currentBlob) return;

      const file = new File([currentBlob], (typeof options.getFileName === 'function')
        ? options.getFileName()
        : 'share-image.png',
        { type: 'image/png' });

      const shareData = {
        title: options.shareTitle || document.title,
        text: currentShareText,
        files: [file],
      };

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share(shareData);
        } catch (err) {
          console.debug('Native share cancelled or failed:', err);
        }
      } else {
        if (typeof options.onShareUnavailable === 'function') {
          options.onShareUnavailable();
        } else {
          window.alert('Direct image sharing is not supported on this browser. Use Download PNG instead.');
        }
      }
    }

    shareButton.addEventListener('click', generateShareContent);
    downloadButton.addEventListener('click', downloadShareImage);
    nativeShareButton.addEventListener('click', nativeShareImage);

    shareModal.addEventListener('click', (event) => {
      if (event.target === shareModal) {
        closeModal();
      }
    });

    const closeButton = shareModal.querySelector('.close-modal');
    if (closeButton) {
      closeButton.addEventListener('click', closeModal);
    }

    return {
      open: generateShareContent,
      close: closeModal,
    };
  }

  window.ShareEngine = {
    init: createShareEngine,
  };
}());
