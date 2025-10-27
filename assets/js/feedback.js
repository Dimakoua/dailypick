(function() {
  const form = document.querySelector('[data-feedback-form]');
  if (!form) {
    return;
  }

  const endpoint = form.dataset.endpoint;
  if (!endpoint) {
    return;
  }

  const successEl = form.querySelector('[data-feedback-success]');
  const errorEl = form.querySelector('[data-feedback-error]');
  const submitButton = form.querySelector('button[type="submit"]');
  const submitButtonText = submitButton ? submitButton.textContent : '';

  const setAlert = (el, message) => {
    if (!el) {
      return;
    }
    el.textContent = message;
    el.setAttribute('aria-hidden', 'false');
  };

  const hideAlert = el => {
    if (!el) {
      return;
    }
    el.setAttribute('aria-hidden', 'true');
    el.textContent = '';
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();

    hideAlert(successEl);
    hideAlert(errorEl);

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Sending…';
    }

    const formData = new FormData(form);
    if (!formData.has('_captcha')) {
      formData.append('_captcha', 'false');
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json'
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to send feedback');
      }

      try {
        await response.json();
      } catch (err) {
        // Ignore JSON parsing issues; FormSubmit sometimes returns empty bodies.
      }

      form.reset();
      setAlert(successEl, 'Thanks for your feedback! We\'ll review it shortly.');
    } catch (error) {
      console.error(error);
      setAlert(
        errorEl,
        'We could not send your feedback right now. Please try again or reach us at hello@dailypick.dev.'
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitButtonText;
      }
    }
  });
})();
