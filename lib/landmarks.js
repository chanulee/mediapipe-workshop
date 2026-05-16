// Named indices for MediaPipe face and hand landmarks.
// Face has 478 landmarks; hand has 21 per hand.
// See https://developers.google.com/mediapipe for full topology.

// ---------- Face ----------
export const NOSE_TIP        = 1;
export const FOREHEAD        = 10;
export const CHIN            = 152;

export const LEFT_EYE        = 33;   // outer corner
export const RIGHT_EYE       = 263;  // outer corner
export const LEFT_EYE_INNER  = 133;
export const RIGHT_EYE_INNER = 362;
export const LEFT_EYE_TOP    = 159;
export const LEFT_EYE_BOTTOM = 145;
export const RIGHT_EYE_TOP   = 386;
export const RIGHT_EYE_BOTTOM = 374;

export const LEFT_BROW       = 105;
export const RIGHT_BROW      = 334;

export const UPPER_LIP       = 13;
export const LOWER_LIP       = 14;
export const LEFT_MOUTH      = 61;
export const RIGHT_MOUTH     = 291;

export const LEFT_CHEEK      = 234;
export const RIGHT_CHEEK     = 454;

// ---------- Hand ----------
export const WRIST           = 0;

export const THUMB_CMC       = 1;
export const THUMB_MCP       = 2;
export const THUMB_IP        = 3;
export const THUMB_TIP       = 4;

export const INDEX_KNUCKLE   = 5;   // MCP
export const INDEX_MID       = 6;   // PIP
export const INDEX_DIP       = 7;
export const INDEX_TIP       = 8;

export const MIDDLE_KNUCKLE  = 9;
export const MIDDLE_MID      = 10;
export const MIDDLE_DIP      = 11;
export const MIDDLE_TIP      = 12;

export const RING_KNUCKLE    = 13;
export const RING_MID        = 14;
export const RING_DIP        = 15;
export const RING_TIP        = 16;

export const PINKY_KNUCKLE   = 17;
export const PINKY_MID       = 18;
export const PINKY_DIP       = 19;
export const PINKY_TIP       = 20;

// Convenience groupings
export const FINGERTIPS = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP];
export const FINGER_KNUCKLES = [THUMB_MCP, INDEX_KNUCKLE, MIDDLE_KNUCKLE, RING_KNUCKLE, PINKY_KNUCKLE];
export const FINGER_PIPS = [THUMB_IP, INDEX_MID, MIDDLE_MID, RING_MID, PINKY_MID];
