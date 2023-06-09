import { replaceHTMLContent } from './utils';

const ENGAGED_SESSION_THRESHOLD = 10000; // 10 seconds in milliseconds

let start_time = null;
let is_engaged = false;
let is_converted = false;
let is_bounced = true;
let coframe_session_ids = [];

// Retrieve variants of your copy for each coframe you've set up from Coframe
export async function getVariants(coframe_page_id, start_time, navigator, referrer) {
  const apiUrl = "https://coframe.ai/api/v1/retrieve_variants_page/";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      coframe_page_id: coframe_page_id,
      time: start_time,
      languages: typeof navigator !== 'undefined' ? (navigator.languages || navigator.language) : undefined,
      platform: typeof navigator !== 'undefined' ? (navigator.platform || (navigator.userAgentData && navigator.userAgentData.platform)) : undefined,
      referrer: referrer
    })
  });
  return response.json();
}

// Send results of the user's session (engagement, bounce, conversion, etc) to Coframe
export async function sendDataToBackend(data) {
  const returnEndpointUrl = "https://coframe.ai/api/v1/session_result/";

  try {
    const response = await fetch(returnEndpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    return response.json();
  } catch (error) {
    console.error("Failed to send data:", error);
  }
}

export function measureEngagement() {
  const time_spent = new Date() - start_time;
  if (time_spent >= ENGAGED_SESSION_THRESHOLD) {
    is_engaged = true;
    sendDataToBackend({ "engagement": true, "session_ids": coframe_session_ids });
  } else {
    setTimeout(measureEngagement, ENGAGED_SESSION_THRESHOLD - time_spent);
  }
}

export function measureConversion() {
  is_converted = true;
  is_bounced = false;
  sendDataToBackend({ "conversion": true, "session_ids": coframe_session_ids });
}

export function measureBounce() {
  if (is_bounced) {
    sendDataToBackend({ "bounced": true, "session_ids": coframe_session_ids });
  }
}

const Coframe = {}

Coframe.init = async function () {
  var coframe_page_id = window.COFRAME_PAGE_ID;
  start_time = new Date();
  window.addEventListener("beforeunload", measureBounce);
  document.addEventListener("visibilitychange", measureEngagement);
  document.addEventListener("conversion", measureConversion);
  setTimeout(measureEngagement, ENGAGED_SESSION_THRESHOLD);

  const variants_response = await getVariants(coframe_page_id,start_time,navigator,document.referrer);
  const variants = variants_response.variants;
  coframe_session_ids = variants_response.session_ids;
  try {
    variants.forEach(({ original, copy }) => {
      replaceHTMLContent(original, copy);
    });
  } catch {
    // failed to replace text
  }
  
}
Coframe.logCoframeConversion = function () {
    document.dispatchEvent(new CustomEvent('conversion', {}));
};

window.Coframe = Coframe;
Coframe.init();