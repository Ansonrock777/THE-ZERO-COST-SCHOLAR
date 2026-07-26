# Selected-text prompt dismiss control

## Goal

Let users clear the selected PDF text that is staged in the chat composer.

## Design

`Dashboard` remains the owner of `selectedPdfText`. It passes an
`onClearSelectedText` callback into `ChatPane`. When selected text is present,
`ChatPane` renders an accessible close button beside the “Selected text to ask
about” label. Activating the button calls the callback, which clears the
selection and returns the composer to its normal state.

## Verification

Add a focused `ChatPane` test that renders selected text, activates the close
button, and verifies the callback is called. Run the focused test and the full
frontend test suite.
