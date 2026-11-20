"use strict";

// A small monotonic gate for async UI work where only the latest request may commit state.
function createLatestRequestGate() {
  let sequence = 0;
  return {
    begin() {
      sequence += 1;
      return sequence;
    },
    invalidate() {
      sequence += 1;
      return sequence;
    },
    isCurrent(requestId) {
      return requestId === sequence;
    },
  };
}

exports.createLatestRequestGate = createLatestRequestGate;
