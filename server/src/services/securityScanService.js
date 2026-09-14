const axios = require('axios');

const VIRUSTOTAL_API_URL = 'https://www.virustotal.com/api/v3';

/**
 * Extracts URLs from a given message text
 * @param {string} text
 * @returns {string[]}
 */
function extractUrlsFromText(text) {
  if (!text || typeof text !== 'string') return [];
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const matches = text.match(urlRegex) || [];
  return matches.map((u) => (u.startsWith('www.') ? `https://${u}` : u));
}

/**
 * Checks if user explicitly asked to verify/scan a link
 * @param {string} text
 * @returns {boolean}
 */
function isSafetyCheckRequested(text) {
  if (!text || typeof text !== 'string') return false;
  return /\b(safe hai|virus|scan|check|phishing|scam|fraud|malware|link safe|kya ye safe hai|is this safe)\b/i.test(text);
}

/**
 * Scans a URL using VirusTotal API v3
 * @param {string} url - Target URL to scan
 * @returns {Promise<{ success: boolean, url: string, isMalicious: boolean, maliciousCount: number, harmlessCount: number, totalEngines: number, reputation: number, categories: object }>}
 */
async function scanUrlSafety(url) {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey || !url || apiKey.includes('your_')) {
    return { success: false, url, isMalicious: false, maliciousCount: 0, harmlessCount: 0, totalEngines: 0, reputation: 0, categories: {} };
  }

  try {
    console.log(`[VirusTotal] 🛡️ Scanning link security: ${url}...`);

    // In VirusTotal v3, the URL identifier is base64 representation without padding '='
    const urlId = Buffer.from(url).toString('base64').replace(/=/g, '');

    const res = await axios.get(`${VIRUSTOTAL_API_URL}/urls/${urlId}`, {
      headers: {
        'x-apikey': apiKey.trim(),
      },
      timeout: 10000,
    });

    const attributes = res.data?.data?.attributes || {};
    const stats = attributes.last_analysis_stats || {};
    const maliciousCount = (stats.malicious || 0) + (stats.suspicious || 0);
    const harmlessCount = (stats.harmless || 0) + (stats.undetected || 0);
    const totalEngines = maliciousCount + harmlessCount;
    const reputation = attributes.reputation || 0;
    const isMalicious = maliciousCount > 0;

    return {
      success: true,
      url,
      isMalicious,
      maliciousCount,
      harmlessCount,
      totalEngines,
      reputation,
      categories: attributes.categories || {},
    };
  } catch (err) {
    // If URL hasn't been scanned yet in VirusTotal database, submit for scan
    if (err.response?.status === 404) {
      try {
        console.log(`[VirusTotal] 📤 Submitting new URL for scan: ${url}...`);
        await axios.post(
          `${VIRUSTOTAL_API_URL}/urls`,
          new URLSearchParams({ url }),
          {
            headers: {
              'x-apikey': apiKey.trim(),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 8000,
          }
        );
        return {
          success: true,
          url,
          isMalicious: false,
          maliciousCount: 0,
          harmlessCount: 0,
          totalEngines: 0,
          reputation: 0,
          categories: {},
          isPendingAnalysis: true,
        };
      } catch (submitErr) {
        console.warn('[VirusTotal] Submit error:', submitErr.message);
      }
    }
    console.warn('[VirusTotal] Scan error:', err.response?.data || err.message);
    return { success: false, url, isMalicious: false, maliciousCount: 0, harmlessCount: 0, totalEngines: 0, reputation: 0, categories: {} };
  }
}

/**
 * Formats a VirusTotal security report for WhatsApp
 * @param {object} scanResult
 * @returns {string}
 */
function formatSafetyReportForWhatsApp(scanResult) {
  if (!scanResult || !scanResult.success) {
    return `🛡️ *Security Link Scanner*\n\nMaaf kijiye, is link ki safety scan report prapt nahi ho saki. Anjaan links par click karte waqt savdhan rahein!`;
  }

  if (scanResult.isPendingAnalysis) {
    return `🛡️ *Security Link Scanner*\n🔗 *Link:* ${scanResult.url}\n\n⏳ *Status:* Yeh link naya hai aur ise VirusTotal security database me scan ke liye bhej diya gaya hai. Kripya bina vishwas ke personal details na share karein.`;
  }

  const lines = [`🛡️ *VirusTotal Security Link Analysis* 🔒\n`];
  lines.push(`🔗 *Scanned URL:* ${scanResult.url}`);

  if (scanResult.isMalicious) {
    lines.push(`\n🚨 *WARNING: POTENTIALLY DANGEROUS LINK!*`);
    lines.push(`❌ *Threat Engines Flagged:* ${scanResult.maliciousCount} security vendors flagged this as malicious/phishing.`);
    lines.push(`⚠️ *Risk Verdict:* High Risk. Kripya is link ko open mat karein aur koi password ya OTP na daalein.`);
  } else {
    lines.push(`\n✅ *VERDICT: SAFE / CLEAN LINK*`);
    lines.push(`🟢 *Security Scanners:* ${scanResult.harmlessCount} vendors confirmed this link is harmless & clean.`);
    lines.push(`🛡️ *Reputation Score:* Good (Clean Web Resource)`);
  }

  lines.push(`\n_Real-time threat intelligence powered by VirusTotal_`);
  return lines.join('\n');
}

module.exports = {
  extractUrlsFromText,
  isSafetyCheckRequested,
  scanUrlSafety,
  formatSafetyReportForWhatsApp,
};
